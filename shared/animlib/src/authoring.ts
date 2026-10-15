import type { SceneContext, ElementHandle, AnimationAction } from './types.js';
import type { AuthoringBuilders, TimingAnchor, TimingSpan } from './authoring-types.js';

/** Self-contained: the same factory is serialized into the scene VM. */
export function createAuthoringBuilders(s: SceneContext, currentTime: () => number): AuthoringBuilders {
  const kinds = new Set(['circle','sphere','rectangle','path','line','arrow','text','latex','mesh']);
  const validId = (id: unknown): id is string => typeof id === 'string' && /^[A-Za-z][A-Za-z0-9_-]{0,127}$/.test(id);
  const interval = (span: TimingSpan, duration: number, label: string) => {
    if (!span || !Number.isFinite(span.startSec) || !Number.isFinite(span.endSec)
      || span.startSec < 0 || span.endSec < span.startSec || span.endSec > duration + 1e-6) {
      throw new Error(`Invalid ${label} timing interval`);
    }
  };
  return {
    compose(prefix, parts) {
      if (typeof prefix !== 'string' || !prefix || prefix.length > 127 || prefix.startsWith('@')) throw new Error('Invalid composition prefix');
      if (!parts || typeof parts !== 'object' || Array.isArray(parts)) throw new Error('Composition parts must be a named object');
      const entries = Object.entries(parts);
      if (!entries.length || entries.length > 256) throw new Error('Composition requires 1–256 parts');
      for (const [name, part] of entries) {
        if (!validId(name)) throw new Error(`Invalid composition part name: ${name}`);
        if (typeof part !== 'function' && (!part || !kinds.has(part.kind))) throw new Error(`Invalid composition part kind: ${name}`);
      }
      s.validateGroup([], [prefix, ...entries.map(([name]) => `${prefix}/${name}`)]);
      const handles = new Map<string, ElementHandle>();
      for (const [name, part] of entries) {
        const id = `${prefix}/${name}`;
        const handle = typeof part === 'function' ? part(s, id) : s[part.kind](id, part.props ?? {});
        if (!handle || handle.id !== id) throw new Error(`Custom composition part ${name} must return its scoped ID ${id}`);
        handles.set(name, handle);
      }
      const group = s.group(prefix, [...handles.values()]);
      return Object.freeze({ group, get(name: string) {
        const handle = handles.get(name);
        if (!handle) throw new Error(`Unknown composition part: ${name}`);
        return handle;
      } });
    },
    schedule(narration, operations) {
      if (!narration || !Number.isFinite(narration.durationSec) || narration.durationSec < 0 || narration.durationSec > 86400) throw new Error('Invalid narration duration');
      if (!Array.isArray(operations) || operations.length > 1000) throw new Error('Schedule requires at most 1000 operations');
      const duration = narration.durationSec;
      const pauses = Object.entries(narration.pauses ?? {});
      for (const [id, pause] of pauses) interval(pause, duration, `pause ${id}`);
      const resolve = (anchor: TimingAnchor): number => {
        if (!anchor || typeof anchor !== 'object' || Array.isArray(anchor)) throw new Error('Invalid timing anchor');
        const selectors = (['cue','word','utterance','pause'] as const).filter(key => Object.hasOwn(anchor,key));
        if (selectors.length !== 1 || (anchor.edge !== undefined && anchor.edge !== 'start' && anchor.edge !== 'end')) throw new Error('Timing anchor requires exactly one cue, word, utterance or pause');
        const key=selectors[0], id=(anchor as unknown as Record<string,string>)[key];
        const map=key==='cue'?narration.cues:key==='word'?narration.words:key==='utterance'?narration.utterances:narration.pauses;
        if (typeof id !== 'string' || !map || !Object.hasOwn(map,id)) throw new Error(`Unknown ${key}: ${id}`);
        interval(map[id], duration, `${key} ${id}`);
        return map[id][anchor.edge==='end'?'endSec':'startSec'];
      };
      let cursor = currentTime();
      if (cursor > duration + 1e-6) throw new Error('Scene cursor exceeds narration duration');
      const ids = new Set<string>();
      // Preflight every window before changing the scene; never reorder authored state.
      const windows = operations.map(operation => {
        if (!operation || !validId(operation.id) || ids.has(operation.id)) throw new Error('Schedule operation IDs must be valid and unique');
        ids.add(operation.id);
        if ((operation.cue!==undefined)===(operation.at!==undefined)) throw new Error(`Operation ${operation.id} requires exactly one cue or at anchor`);
        if (operation.cue!==undefined && (operation.through!==undefined || operation.duration!==undefined)) throw new Error(`Operation ${operation.id} cue uses its full span; omit through and duration`);
        if (operation.through !== undefined && operation.duration !== undefined) throw new Error(`Operation ${operation.id} must use through or duration, not both`);
        const startSec=resolve(operation.cue!==undefined?{cue:operation.cue}:operation.at!);
        const endSec=operation.cue!==undefined?resolve({cue:operation.cue,edge:'end'}):operation.through!==undefined?resolve(operation.through):startSec+(operation.duration??0);
        interval({startSec,endSec},duration,`operation ${operation.id} duration`);
        if (startSec < cursor - 1e-6) throw new Error(`Operation ${operation.id} overlaps or goes backwards from ${cursor} to ${startSec}`);
        if (operation.notBefore && startSec < resolve(operation.notBefore) - 1e-6) throw new Error(`Operation ${operation.id} occurs before its reveal guard`);
        for (const [id,pause] of pauses) {
          if ((startSec < pause.endSec && endSec > pause.startSec)
            || (startSec === endSec && startSec >= pause.startSec && startSec < pause.endSec)) throw new Error(`Operation ${operation.id} changes information during pause ${id}`);
        }
        const actions: AnimationAction[] = operation.actions===undefined?[]:Array.isArray(operation.actions)?[...operation.actions]:[operation.actions];
        if (operation.reveal !== undefined && !Array.isArray(operation.reveal)) throw new Error(`Operation ${operation.id} reveal must be an array`);
        for (const target of operation.reveal ?? []) actions.push(target.fadeIn());
        if (!actions.length) throw new Error(`Operation ${operation.id} requires actions or reveal targets`);
        cursor = endSec;
        return {id:operation.id,startSec,endSec,actions,ease:operation.ease};
      });
      for (const window of windows) {
        s.wait(Math.max(0,window.startSec-currentTime()));
        s.play(window.actions,{duration:window.endSec-window.startSec,...(window.ease?{ease:window.ease}:{})});
      }
      s.wait(Math.max(0,duration-currentTime()));
      return Object.freeze(windows.map(({id,startSec,endSec})=>Object.freeze({id,startSec,endSec})));
    },
  };
}

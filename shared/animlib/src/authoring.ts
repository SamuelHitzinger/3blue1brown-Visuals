import type { SceneContext, ElementHandle, AnimationAction } from './types.js';
import type { AuthoringBuilders, ScheduledStep, TimingAnchor, TimingSpan } from './authoring-types.js';

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
      const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
      const effects = (step: ScheduledStep, label: string): AnimationAction[] => {
        const actions = step.actions === undefined ? [] : Array.isArray(step.actions) ? [...step.actions] : [step.actions];
        if (step.reveal !== undefined && !Array.isArray(step.reveal)) throw new Error(`${label} reveal must be an array`);
        for (const target of step.reveal ?? []) {
          if (!target || typeof target.id !== 'string' || typeof target.fadeIn !== 'function') throw new Error(`${label} has an invalid reveal target`);
          actions.push(target.fadeIn());
        }
        for (const action of actions) {
          if (!record(action) || !['animate', 'morph', 'camera', 'numbers'].includes(action.type)
            || !Array.isArray(action.ids) || Array.from(action.ids).some(id => typeof id !== 'string')
            || (action.properties !== undefined && !record(action.properties))
            || (action.geometry !== undefined && !record(action.geometry))
            || (action.type === 'morph' && (!record(action.geometry) || typeof action.geometry.kind !== 'string'))
            || (action.map !== undefined && !record(action.map))
            || (action.values !== undefined && !record(action.values))) throw new Error(`${label} has an invalid action`);
        }
        if (!actions.length) throw new Error(`${label} requires actions or reveal targets`);
        return actions;
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
        let steps: { endSec: number; actions: AnimationAction[] }[] | undefined;
        if (operation.steps !== undefined) {
          if (operation.actions !== undefined || operation.reveal !== undefined) throw new Error(`Operation ${operation.id} steps cannot be combined with top-level actions or reveal`);
          if (!Array.isArray(operation.steps) || !operation.steps.length || operation.steps.length > 64) throw new Error(`Operation ${operation.id} requires 1–64 steps`);
          const prepared = Array.from(operation.steps, (step, index) => {
            const label = `Operation ${operation.id} step ${index + 1}`;
            if (!record(step) || Object.keys(step).some(key => !['actions', 'reveal', 'weight'].includes(key))) throw new Error(`Invalid ${label}; only actions, reveal and weight are allowed`);
            const weight = step.weight === undefined ? 1 : step.weight;
            if (typeof weight !== 'number' || !Number.isFinite(weight) || weight < 0) throw new Error(`${label} weight must be finite and nonnegative`);
            return { weight, actions: effects(step, label) };
          });
          // Normalize first: finite weights may have an overflowing raw sum.
          const maximum = Math.max(...prepared.map(step => step.weight));
          if (endSec > startSec && maximum === 0) throw new Error(`Operation ${operation.id} requires positive step weight for a positive window`);
          const total = maximum ? prepared.reduce((sum, step) => sum + step.weight / maximum, 0) : 0;
          const lastPositive = prepared.reduce((last, step, index) => step.weight > 0 ? index : last, -1);
          let cumulative = 0, stepEnd = startSec;
          steps = prepared.map((step, index) => {
            if (step.weight > 0) {
              cumulative += step.weight / maximum;
              stepEnd = index === lastPositive ? endSec : startSec + (endSec - startSec) * (cumulative / total);
            }
            return { endSec: stepEnd, actions: step.actions };
          });
        }
        const actions = steps ? undefined : effects(operation, `Operation ${operation.id}`);
        cursor = endSec;
        return {id:operation.id,startSec,endSec,actions,steps,ease:operation.ease};
      });
      for (const window of windows) {
        s.wait(Math.max(0,window.startSec-currentTime()));
        const ease = window.ease ? { ease: window.ease } : {};
        if (window.steps) {
          for (const step of window.steps) s.play(step.actions, { duration: Math.max(0, step.endSec - currentTime()), ...ease });
        } else s.play(window.actions!, { duration: window.endSec - window.startSec, ...ease });
      }
      s.wait(Math.max(0,duration-currentTime()));
      return Object.freeze(windows.map(({id,startSec,endSec})=>Object.freeze({id,startSec,endSec})));
    },
  };
}

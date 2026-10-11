import type { AgentTask } from '../../backend/src/agents/runtime.js';
import type { ConstructionContext } from './construction-runner.js';

function object(value: unknown, name: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error(`Invalid ${name} object.`);
  return value as Record<string, unknown>;
}
function pick(value: Record<string, unknown>, names: readonly string[]): Record<string, unknown> {
  return Object.fromEntries(names.filter(name => Object.hasOwn(value, name)).map(name => [name, value[name]]));
}

/** Parse only the production initial-author packet; leave the author's entire task untouched. */
export function constructionContext(task: AgentTask): ConstructionContext {
  const prefix = 'Generate this scene using the authoritative narration packet and lesson plan:';
  const boundary = task.prompt.lastIndexOf('\n{');
  if (task.logContext?.stage !== 'scene' || !task.prompt.startsWith(prefix) || boundary < prefix.length) {
    throw Error('Unknown initial scene prompt boundary.');
  }
  const packet = object(JSON.parse(task.prompt.slice(boundary + 1)), 'scene packet');
  const planning = object(packet.planning, 'approved planning');
  const current = object(planning.current, 'approved current scene');
  const viewMode = object(current.view, 'approved current scene view').mode;
  if (viewMode !== '2d' && viewMode !== '3d') throw Error('Missing approved per-scene view mode.');
  const scene = object(packet.scene, 'narration scene');
  if (typeof current.id !== 'string' || current.id !== scene.id) throw Error('Planning and narration scene IDs disagree.');
  const context = { ...pick(packet, ['request', 'timingBasis', 'audioAssetId', 'endMode', 'videoMode', 'modelAssets']),
    planning: pick(planning, ['lesson', 'shared', 'current', 'outline', 'previous', 'next', 'stateAuthority']), scene,
    ...(packet.previousFrame === undefined || packet.previousFrame === null ? {} : {
      previousFrameSummary: summarizeFrame(object(packet.previousFrame, 'previous frame'), planning),
    }) };
  const prompt = JSON.stringify(context);
  if (prompt.length > 40000) throw Error('Construction semantic context exceeds 40000 characters; do not silently truncate.');
  return { viewMode, prompt };
}

function summarizeFrame(frame: Record<string, unknown>, planning: Record<string, unknown>) {
  if (!Array.isArray(frame.elements) || frame.elements.length > 128) throw Error('Previous-frame summary requires at most 128 elements; do not silently truncate.');
  const meanings = new Map<string, string>();
  for (const shared of [planning.lesson, planning.shared]) {
    if (!shared || typeof shared !== 'object' || Array.isArray(shared)) continue;
    const entities = (shared as Record<string, unknown>).entities;
    if (!Array.isArray(entities)) continue;
    for (const entity of entities) {
      const item = object(entity, 'shared entity');
      if (typeof item.id === 'string' && typeof item.meaning === 'string') meanings.set(item.id, item.meaning);
    }
  }
  const elements = frame.elements.map((value: unknown) => {
    const element = object(value, 'previous element'), geometry = object(element.geometry, 'previous geometry');
    if (typeof element.id !== 'string' || typeof geometry.kind !== 'string') throw Error('Missing previous element identity or geometry kind.');
    const meaning = typeof element.meaning === 'string' ? element.meaning : meanings.get(element.id);
    return { id: element.id, type: geometry.kind, ...(meaning === undefined ? {} : { meaning }),
      ...pick(element, ['position', 'rotation', 'scale', 'opacity', 'space', 'view', 'persistent']) };
  });
  return { geometryOmitted: true, elementCount: elements.length,
    ...pick(frame, ['camera', 'cameraAnimated', 'views', 'duration']), elements };
}

// Generic, fixed section selection: no subject-keyword branching or inferred API summary.
export const SPECIALIST_REFERENCE_RANGES = [
  ['### Elements and coordinates', '### Shaded meshes'],
  ['### Shaded meshes', '### Scene lighting and planar shadows'],
  ['### Function and parametric surfaces', '### Basic solids and swept tubes'],
  ['### Basic solids and swept tubes', '### Molecular display beads'],
  ['### Curved paths and organic shapes', '### Choosing how objects relate and move'],
  ['### Choosing how objects relate and move', '### Fading a composed object'],
  ['### Element animation and coordinates', '## 4. Persistence and scene handoffs'],
  ['### Independent view regions', '### Geometry and camera transitions'],
  ['### Geometry and camera transitions', '### Domain helpers and prepared assets'],
  ['### Execution environment', '## 8. One audio track per scene'],
  ['### Scene-agent publication', undefined],
] as const;

function lineIndex(text: string, line: string): number {
  const hits = [...text.matchAll(new RegExp(`^${line.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=\\r?$)`, 'gm'))];
  if (hits.length !== 1) throw Error(`Expected exactly one boundary: ${line}`);
  return hits[0].index!;
}

/** Exact existing checklist and literal installed API sections; never rewrites either source. */
export function constructionAnchors(craft: string, reference: string): { checklist: string; apiReference: string; referenceExcerpts: string[] } {
  const start = lineIndex(craft, 'For a complex spatial mechanism, make two construction checks before coding.');
  const end = lineIndex(craft, 'Implement the planned dimensional choice through its named visible evidence.');
  if (start >= end) throw Error('Construction checklist boundaries are reversed.');
  const checklist = craft.slice(start, end);
  if (!/(?:\r?\n){2}$/.test(checklist)) throw Error('Construction checklist lost its trailing blank-line boundary.');
  const referenceExcerpts = SPECIALIST_REFERENCE_RANGES.map(([startHeading, endHeading]) => {
    const from = lineIndex(reference, startHeading), to = endHeading === undefined ? reference.length : lineIndex(reference, endHeading);
    if (from >= to) throw Error(`Reference section boundaries reversed: ${startHeading}`);
    const result = reference.slice(from, to);
    if (!result.slice(startHeading.length).trim()) throw Error(`Empty reference section: ${startHeading}`);
    return result;
  });
  if (referenceExcerpts.reduce((sum, excerpt) => sum + excerpt.length, 0) > 32000) {
    throw Error('Selected construction API excerpts exceed 32000 characters; review the fixed section selection.');
  }
  return { checklist, apiReference: reference, referenceExcerpts };
}

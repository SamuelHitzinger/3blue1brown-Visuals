import { compileSource, detectSceneOverlaps, evaluateScene, getScreenBounds } from 'animlib/core';
import type { Bounds2D, CompiledScene, Frame, CompileInput } from 'animlib/core';

export const SCENE_VIEWPORT = { width: 960, height: 540 };
export interface InspectionOptions { times?: number[]; objectIds?: string[]; includeAnimating?: boolean }
export interface PreviewOptions { times?: number[]; focusObjectId?: string }
export interface SceneCandidate { source: string; compiled: CompiledScene; previous?: Frame; models?: CompileInput['models'] }
export interface FrameSample { time: number; frame: Frame; focus?: Bounds2D }
export interface InspectionReport {
  viewport: typeof SCENE_VIEWPORT;
  times: number[];
  warnings: { time: number; kind: string; elements: string[]; bounds?: Bounds2D }[];
  bounds: { time: number; id: string; bounds: Bounds2D | null }[];
  truncated: boolean;
  note: string;
}

/** Sample across the scene, including settled layouts and transition midpoints. */
export function sceneSampleTimes(scene: CompiledScene, requested: number[] | undefined, limit: number): number[] {
  if (requested) {
    if (!requested.length || requested.length > limit || requested.some(t => !Number.isFinite(t) || t < 0 || t > scene.duration)) {
      throw new Error(`Provide 1–${limit} finite local timestamps between 0 and ${scene.duration}.`);
    }
    return [...new Set(requested)].sort((a, b) => a - b);
  }
  const candidates = [...new Set([0, scene.duration,
    ...Array.from({ length: limit }, (_, i) => scene.duration * i / (limit - 1)),
    ...scene.tracks.flatMap(t => [t.start + t.duration / 2, t.start + t.duration]),
    ...scene.lifecycle.map(e => e.time),
  ])].filter(t => t >= 0 && t <= scene.duration).sort((a, b) => a - b);
  if (candidates.length <= limit) return candidates;
  return Array.from({ length: limit }, (_, i) => candidates[Math.round(i * (candidates.length - 1) / (limit - 1))]);
}

async function sampled(candidate: SceneCandidate, time: number): Promise<CompiledScene> {
  // Time callbacks must be evaluated at each requested time, not frozen at validation's end frame.
  return candidate.compiled.reactiveBindings?.some(b => b.time)
    ? compileSource(candidate.source, { previous: candidate.previous, models: candidate.models }, { sampleTime: time }) : candidate.compiled;
}

export async function sampleScene(candidate: SceneCandidate, options: PreviewOptions = {}): Promise<FrameSample[]> {
  const result: FrameSample[] = [];
  for (const time of sceneSampleTimes(candidate.compiled, options.times, 6)) {
    const frame = evaluateScene(await sampled(candidate, time), time);
    const focus = options.focusObjectId ? getScreenBounds(frame, options.focusObjectId,
      { ...SCENE_VIEWPORT, palette: candidate.compiled.options.palette }) : undefined;
    if (options.focusObjectId && !focus) throw new Error(`Object ${options.focusObjectId} has no visible bounds at ${time}s. Choose another time or omit focusObjectId.`);
    result.push({ time, frame, focus });
  }
  return result;
}

export async function inspectScene(candidate: SceneCandidate, options: InspectionOptions = {}): Promise<InspectionReport> {
  if (options.objectIds && (options.objectIds.length > 20 || options.objectIds.some(id => typeof id !== 'string' || id.length > 256))) {
    throw new Error('Query at most 20 object IDs of up to 256 characters.');
  }
  const times = sceneSampleTimes(candidate.compiled, options.times, 24);
  const report: InspectionReport = { viewport: SCENE_VIEWPORT, times, warnings: [], bounds: [], truncated: false,
    note: 'Warnings are advisory. Samples can miss brief defects; bounds do not prove visibility or account for occlusion. Text size is a heuristic. Default controls and authored cameras only; no playback or audio review.' };
  const warn = (warning: InspectionReport['warnings'][number]) => {
    if (report.warnings.length < 60) report.warnings.push(warning); else report.truncated = true;
  };
  for (const time of times) {
    const compiled = await sampled(candidate, time), frame = evaluateScene(compiled, time);
    const viewport = { ...SCENE_VIEWPORT, palette: compiled.options.palette };
    for (const sample of detectSceneOverlaps(compiled, { ...viewport, times: [time], includeAnimating: options.includeAnimating })) {
      for (const overlap of sample.overlaps) warn({ time, kind: 'text-overlap', elements: overlap.elements, bounds: overlap.bounds });
    }
    const elements = frame.elements.filter(e => e.geometry.kind !== 'group');
    if (elements.length > 200) report.truncated = true;
    for (const element of elements.slice(0, 200)) {
      const bounds = getScreenBounds(frame, element.id, { ...viewport, clip: false });
      if (!bounds) continue;
      const rect = frame.views?.find(v => v.id === element.view)?.rect ?? [0, 0, 1, 1];
      const [left, top, width, height] = rect;
      if (bounds.left < left * SCENE_VIEWPORT.width - 1 || bounds.top < top * SCENE_VIEWPORT.height - 1 ||
          bounds.right > (left + width) * SCENE_VIEWPORT.width + 1 || bounds.bottom > (top + height) * SCENE_VIEWPORT.height + 1) {
        warn({ time, kind: 'outside-view', elements: [element.id], bounds });
      }
      if (['text', 'latex'].includes(element.geometry.kind) && bounds.bottom - bounds.top < 12) {
        warn({ time, kind: 'possibly-small-text', elements: [element.id], bounds });
      }
    }
    for (const id of options.objectIds ?? []) report.bounds.push({ time, id,
      bounds: getScreenBounds(frame, id, { ...viewport, clip: false, includeInvisible: true }) ?? null });
  }
  return report;
}

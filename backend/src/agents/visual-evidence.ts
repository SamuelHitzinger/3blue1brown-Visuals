import type { CompiledScene } from 'animlib/core';
import type { FrameEvidence } from './frame-renderer.js';
import type { VisualVerification } from './visual-edits.js';

export interface ReviewSample {
  time: number;
  reasons: string[];
}
export interface ReviewEvidencePlan {
  coverage: 'partial';
  samples: ReviewSample[];
  nativeTimes: number[];
  omittedOperationInteriors: number;
  omittedCueBoundaries: number;
  uncoveredDefectTimes: number[];
  normalizedDefectTimes: { requested: number; sample: number }[];
}
export interface ReviewImage {
  path: string;
  kind: 'contact-sheet' | 'native-frame';
  width: number;
  height: number;
  times: number[];
  columns: number;
}

/** Prioritize demonstrated transition risks without claiming complete coverage. */
export function planReviewEvidence(scene: CompiledScene, history: VisualVerification[] = [],
  speechCues: Record<string, { startSec: number; endSec: number }> = {}): ReviewEvidencePlan {
  const { duration } = scene;
  const candidates = new Map<number, { reasons: Set<string>; risk: number }>();
  const add = (time: number, reason: string, risk = 0) => {
    // Match the scene-duration validator's tolerance, but render only legal
    // compiled times. Decimal speech endpoints can differ by a few ULPs.
    if (!Number.isFinite(time) || time < -1e-6 || time > duration + 1e-6) return;
    time = Math.max(0, Math.min(duration, time));
    const candidate = candidates.get(time) ?? { reasons: new Set<string>(), risk: 0 };
    candidate.reasons.add(reason); candidate.risk = Math.max(candidate.risk, risk); candidates.set(time, candidate);
    return time;
  };
  add(0, 'opening'); add(Math.min(0.5, duration / 4), 'visible-opening'); add(duration, 'end-state');
  const selected = new Set(candidates.keys());
  const defects = [...new Set(history.flatMap(review => review.findings.flatMap(finding => finding.timeSec === null ? [] : [finding.timeSec])))];
  const defectSamples = defects.map(requested => ({ requested, sample: add(requested, 'prior-defect', 100) }));
  for (const { sample } of defectSamples) if (sample !== undefined && selected.size < 16) selected.add(sample);
  for (const [id, cue] of Object.entries(speechCues)) {
    add(cue.startSec, `speech-cue-start:${id}`, 2); add(cue.endSec, `speech-cue-end:${id}`, 2);
  }
  const boundaries = new Set([0, duration]);
  for (const track of scene.tracks) {
    add(track.start, 'operation-start'); add(track.start + track.duration, 'operation-end');
    boundaries.add(track.start); boundaries.add(track.start + track.duration);
    if (track.duration > 0) add(track.start + track.duration / 2,
      track.action.type === 'camera' ? 'camera-interior' : 'operation-interior', track.action.type === 'camera' ? 3 : 2);
  }
  // Text replacement can temporarily draw both geometries, even when a hidden
  // handle is revealed concurrently. Treat this as an inspection priority, not
  // a proven defect. Geometry and track state, rather than object names, drive it.
  const isText = (kind: string | undefined) => kind === 'text' || kind === 'latex';
  const active = scene.tracks.filter(track => track.duration > 0);
  const textMorphs = active.filter(track => track.action.type === 'morph'
    && (isText(track.action.geometry?.kind) || Object.values(track.from).some(element => isText(element.geometry.kind))));
  const fades = active.flatMap(track => {
    const properties = track.action.properties;
    if (track.action.type !== 'animate' || !properties || !('opacity' in properties) || typeof properties.opacity !== 'number') return [];
    return track.action.ids.flatMap(id => {
      const from = track.action.fromOpacity ?? track.from[id]?.opacity;
      return typeof from === 'number' && from !== properties.opacity
        ? [{ track, id, revealing: properties.opacity! > from, text: isText(track.from[id]?.geometry.kind) }] : [];
    });
  });
  const overlapMidpoint = (a: typeof scene.tracks[number], b: typeof scene.tracks[number]) => {
    const start = Math.max(a.start, b.start), end = Math.min(a.start + a.duration, b.start + b.duration);
    return end > start ? start + (end - start) / 2 : undefined;
  };
  for (const track of textMorphs) {
    add(track.start + track.duration / 2, 'text-morph-interior', 5);
    for (const fade of fades) {
      if (!fade.revealing || !track.action.ids.includes(fade.id)) continue;
      const midpoint = overlapMidpoint(track, fade.track);
      if (midpoint !== undefined) add(midpoint, 'text-morph-reveal-interior', 6);
    }
  }
  for (const hiding of fades.filter(fade => !fade.revealing)) {
    for (const revealing of fades.filter(fade => fade.revealing)) {
      if (!hiding.text && !revealing.text) continue;
      const midpoint = overlapMidpoint(hiding.track, revealing.track);
      if (midpoint !== undefined) add(midpoint, 'text-hide-reveal-interior', 4);
    }
  }
  for (const event of scene.lifecycle) { add(event.time, `lifecycle-${event.type ?? 'change'}`); boundaries.add(event.time); }
  const ordered = [...boundaries].sort((a, b) => a - b);
  for (let i = 1; i < ordered.length; i++) {
    const midpoint = (ordered[i - 1] + ordered[i]) / 2;
    if (!scene.tracks.some(track => track.start < midpoint && track.start + track.duration > midpoint)) add(midpoint, 'hold');
  }
  for (let i = 1; i < 12; i++) add(duration * i / 12, 'coverage');
  const risks = [...candidates].filter(([, candidate]) => candidate.risk >= 2);
  const target = Math.min(16, Math.max(12, selected.size + risks.length + 2));
  const distance = (time: number) => Math.min(...[...selected].map(other => Math.abs(other - time)));
  const pick = (riskOnly: boolean) => {
    let best: number | undefined, score = -1;
    for (const [time, candidate] of candidates) {
      if (selected.has(time) || riskOnly && candidate.risk < 2) continue;
      const next = riskOnly ? candidate.risk + distance(time) / Math.max(duration, 1) : distance(time);
      if (next > score) { best = time; score = next; }
    }
    if (best === undefined) return false;
    selected.add(best); return true;
  };
  // Reserve two remaining slots for holds/boundaries/global coverage.
  while (selected.size < target - 2 && pick(true)) { /* bounded by target */ }
  while (selected.size < target && pick(false)) { /* bounded by target */ }
  const samples = [...selected].sort((a, b) => a - b).map(time => ({ time, reasons: [...candidates.get(time)!.reasons] }));
  // Known defects retain native priority. Otherwise spend detail on the highest
  // semantic risks, not the earliest motion. The end state remains in overview
  // evidence and fills a spare native slot when fewer than two such risks exist.
  const ranked = [...candidates].filter(([time]) => selected.has(time))
    .sort(([a, ca], [b, cb]) => cb.risk - ca.risk || a - b);
  const semantic = ranked.filter(([, candidate]) => candidate.risk >= 4);
  const interiors = ranked.filter(([, candidate]) => [...candidate.reasons].some(reason => reason.endsWith('-interior')));
  const nativeTimes = [...new Set([
    ...defectSamples.flatMap(({ sample }) => sample !== undefined && selected.has(sample) ? [sample] : []),
    ...(semantic.length ? semantic : interiors.slice(0, 1)).map(([time]) => time),
    duration,
  ])].slice(0, 2);
  return { coverage: 'partial', samples, nativeTimes,
    omittedOperationInteriors: risks.filter(([time, candidate]) => !selected.has(time)
      && [...candidate.reasons].some(reason => reason.endsWith('-interior'))).length,
    omittedCueBoundaries: risks.filter(([time, candidate]) => !selected.has(time)
      && [...candidate.reasons].some(reason => reason.startsWith('speech-cue-'))).length,
    uncoveredDefectTimes: defectSamples.filter(({ sample }) => sample === undefined || !selected.has(sample)).map(({ requested }) => requested),
    normalizedDefectTimes: defectSamples.flatMap(({ requested, sample }) => sample !== undefined && sample !== requested ? [{ requested, sample }] : []),
  };
}

/** Keep all overview evidence and add at most two native frames per viewport. */
export function selectReviewImages(evidence: FrameEvidence, plan: ReviewEvidencePlan): ReviewImage[] {
  if (!evidence.frames.length || !evidence.sheets.length) throw new Error('Visual review requires rendered frames and contact sheets.');
  const images: ReviewImage[] = evidence.sheets.map(sheet => {
    if (!sheet.times.length || !Number.isInteger(sheet.columns) || sheet.columns < 1
      || !sheet.times.every(time => evidence.frames.some(frame => frame.time === time && frame.width === sheet.width && frame.height === sheet.height))) {
      throw new Error('Contact sheet timestamps must match native frame evidence.');
    }
    return { ...sheet, kind: 'contact-sheet' };
  });
  const viewports = [...new Set(evidence.frames.map(frame => `${frame.width}x${frame.height}`))];
  for (const viewport of viewports) {
    const frames = evidence.frames.filter(frame => `${frame.width}x${frame.height}` === viewport);
    for (const sample of plan.samples.filter(sample => sample.reasons.includes('prior-defect'))) {
      if (!frames.some(frame => frame.time === sample.time)
        || !evidence.sheets.some(sheet => `${sheet.width}x${sheet.height}` === viewport && sheet.times.includes(sample.time))) {
        throw new Error(`Known defect at ${sample.time}s is missing rendered evidence for ${viewport}.`);
      }
    }
    const chosen = plan.nativeTimes.map(time => frames.find(frame => frame.time === time)).filter(frame => frame !== undefined);
    // Alternate renderers may provide fewer samples; still include their actual
    // native evidence rather than silently representing sheets as full detail.
    if (!chosen.length) chosen.push(frames.at(-1)!);
    for (const frame of chosen) images.push({ path: frame.path, kind: 'native-frame', width: frame.width, height: frame.height, times: [frame.time], columns: 1 });
  }
  return images;
}

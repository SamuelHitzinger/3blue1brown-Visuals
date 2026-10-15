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

/** Deliberately reserve action interiors before filling temporal coverage gaps. */
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
  const defectSamples = defects.map(requested => ({ requested, sample: add(requested, 'prior-defect', 4) }));
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
  for (const event of scene.lifecycle) { add(event.time, `lifecycle-${event.type ?? 'change'}`); boundaries.add(event.time); }
  const ordered = [...boundaries].sort((a, b) => a - b);
  for (let i = 1; i < ordered.length; i++) {
    const midpoint = (ordered[i - 1] + ordered[i]) / 2;
    if (!scene.tracks.some(track => track.start < midpoint && track.start + track.duration > midpoint)) add(midpoint, 'hold');
  }
  for (let i = 1; i < 12; i++) add(duration * i / 12, 'coverage');
  const risks = [...candidates].filter(([, candidate]) => candidate.risk >= 2 && candidate.risk < 4);
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
  // A repair gets native views of known defects first. Otherwise inspect an
  // action interior and the settled end state, at both renderer aspect ratios.
  const nativeTimes = [...new Set([
    ...defectSamples.flatMap(({ sample }) => sample !== undefined && selected.has(sample) ? [sample] : []),
    ...samples.filter(sample => sample.reasons.includes('camera-interior') || sample.reasons.includes('operation-interior')).map(sample => sample.time),
    duration,
  ])].slice(0, 2);
  if (!defects.length && nativeTimes.length === 2 && !nativeTimes.includes(duration)) nativeTimes[1] = duration;
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

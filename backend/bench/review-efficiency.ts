/** Deterministic host/evidence benchmark. Scripted reviewers do not measure visual quality. */
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { compileSource } from 'animlib/core';
import type { CompiledScene } from 'animlib/core';
import type { FrameRenderer } from '../src/agents/frame-renderer.js';
import { renderSceneFrames } from '../src/agents/frame-renderer.js';
import { reviewGeneratedScene } from '../src/agents/visual-gate.js';
import { planReviewEvidence, selectReviewImages } from '../src/agents/visual-evidence.js';
import { sourceHash } from '../src/agents/visual-edits.js';

/** Frozen sampler from inherited checkpoint 6d9798e (unchanged from fba95bd). */
function baselineTimes(scene: CompiledScene): number[] {
  const duration = scene.duration, times = new Set([0, Math.min(0.5, duration / 4), duration]);
  const candidates = new Set<number>();
  for (let i = 1; i < 12; i++) candidates.add(duration * i / 12);
  const cameraMids = scene.tracks.filter(t => t.action.type === 'camera').map(t => t.start + t.duration / 2);
  for (const t of cameraMids.slice(0, 4)) times.add(t);
  for (const track of scene.tracks) for (const t of [track.start, track.start + track.duration / 2, track.start + track.duration]) candidates.add(t);
  for (const event of scene.lifecycle) candidates.add(event.time);
  while (times.size < 12) {
    let best: number | undefined, gap = 1e-6;
    for (const t of candidates) {
      if (t < 0 || t > duration) continue;
      const distance = Math.min(...[...times].map(other => Math.abs(other - t)));
      if (distance > gap) { best = t; gap = distance; }
    }
    if (best === undefined) break; times.add(best);
  }
  return [...times].sort((a, b) => a - b);
}

const seededSources = [
  { id: 'brief-overlap', start: 6.23, end: 6.31, source: `export default scene({},s=>{
    const a=s.circle('a',{position:[-2,0],radius:.6,fill:'BLUE'}),b=s.circle('b',{position:[2,0],radius:.6,fill:'YELLOW'});
    s.text('caption',{text:'Two separate objects',position:[0,2]});s.wait(6.23);
    s.play([a.moveTo([2,0]),b.moveTo([-2,0])],{duration:.08,ease:'linear'});s.wait(53.69);
  });` },
  { id: 'fifth-camera', start: 50, end: 50.2, source: `export default scene({mode:'3d'},s=>{
    s.sphere('a',{radius:1,fill:'BLUE'});s.text('caption',{text:'Inspect the complete sphere',position:[0,2]});s.wait(10);
    for(let i=0;i<5;i++){s.play(s.camera.to3D({yaw:(i+1)/5}),{duration:.2});s.wait(9.8);}
  });` },
];

export async function runReviewEfficiencyBenchmark(options: { directory?: string; native?: boolean } = {}) {
  const directory = options.directory ? resolve(options.directory) : await mkdtemp(join(tmpdir(), 'review-benchmark-'));
  await mkdir(directory, { recursive: true });
  const started = performance.now();
  try {
    const sampling = [];
    for (const fixture of seededSources) {
      const scene = await compileSource(fixture.source), baseline = baselineTimes(scene), candidate = planReviewEvidence(scene);
      const output = join(directory, fixture.id); await mkdir(output, { recursive: true });
      await writeFile(join(output, 'source.js'), fixture.source);
      const result = { id: fixture.id, sourceSha256: sourceHash(fixture.source), riskInterval: [fixture.start, fixture.end],
        baseline: { times: baseline, interiorCovered: baseline.some(t => t > fixture.start && t < fixture.end) },
        candidate: { ...candidate, interiorCovered: candidate.samples.some(sample => sample.time > fixture.start && sample.time < fixture.end) },
        nativeEvidence: undefined as unknown };
      if (options.native) {
        const evidence = await renderSceneFrames({ source: fixture.source, directory: output,
          times: candidate.samples.map(sample => sample.time), signal: AbortSignal.timeout(120_000) });
        result.nativeEvidence = { ...evidence, reviewImages: selectReviewImages(evidence, candidate) };
      }
      sampling.push(result);
    }
    const gateCases = [];
    const initial = `export default scene({audio:'voice',end:'hold'},s=>{s.text('label',{text:'DNA',position:[5,0]});s.wait(4);});`;
    const repaired = initial.replace('[5,0]', '[0,0]');
    for (const name of ['clean', 'one-repair', 'rejected', 'malformed-protocol'] as const) {
      const output = join(directory, name); await mkdir(output, { recursive: true });
      let reviews = 0, repairs = 0, renders = 0, images = 0, nativeImages = 0;
      const renderFrames: FrameRenderer = async input => {
        renders++;
        const frames = [], sheets = [];
        for (const width of [1280, 960]) {
          for (const time of input.times) {
            const path = join(input.directory, `${width}-${time}.png`); await writeFile(path, 'Scripted native frame');
            frames.push({ path, time, width, height: 720 });
          }
          const path = join(input.directory, `${width}-sheet.png`); await writeFile(path, 'Scripted sheet');
          sheets.push({ path, width, height: 720, times: input.times, columns: 2 });
        }
        return { backend: 'scripted-boundary', frames, sheets };
      };
      let status = '', error: string | undefined, approvedSourceSha256: string | undefined;
      try {
        const approved = await reviewGeneratedScene({ source: initial, directory: output, index: 0, videoId: crypto.randomUUID(),
          input: { audioAssetId: 'voice', endMode: 'hold', scene: { id: 'beat-1', durationSec: 4 }, planning: {} },
          task: { systemPrompt: 'Benchmark author contract.', prompt: 'Show the label clearly.' },
          policy: { id: 'benchmark', guidance: 'Review supplied evidence.', repairGuidance: 'Repair verified findings.' },
          renderFrames, signal: new AbortController().signal, recoveryWait: async () => {},
          validate: async candidate => { await compileSource(candidate); },
          runner: { async run(task) {
            if (task.logContext?.stage === 'repair') {
              repairs++; return JSON.stringify({ sourceSha256: sourceHash(initial), edits: [{ finding: 0, before: '[5,0]', after: '[0,0]' }] });
            }
            reviews++; images += task.images?.length ?? 0;
            nativeImages += task.images?.filter(image => Buffer.from(image.data, 'base64').toString() === 'Scripted native frame').length ?? 0;
            if (name === 'malformed-protocol') return '{"approved":true,"findings":[],"source":"forbidden"}';
            return JSON.stringify(name === 'clean' || name === 'one-repair' && reviews > 1 ? { approved: true, findings: [] }
              : { approved: false, findings: [{ timeSec: 1.234, objectIds: ['label'], problem: 'Clipped label', fix: 'Move inside the viewport.' }] });
          } },
        });
        status = 'approved'; approvedSourceSha256 = sourceHash(approved);
        if (approved !== (name === 'one-repair' ? repaired : initial)) throw new Error('Approved source identity mismatch.');
      } catch (failure) {
        status = 'rejected'; error = failure && typeof failure === 'object' && 'code' in failure ? String(failure.code) : String(failure);
      }
      gateCases.push({ name, status, error, reviews, repairs, renders, images, nativeImages, approvedSourceSha256 });
    }
    const report = { benchmark: 'review-efficiency', evidenceKind: 'deterministic-host-and-sampling', baselineRevision: '6d9798e',
      candidateSourceSha256: sourceHash(await readFile(new URL('../src/agents/visual-gate.ts', import.meta.url), 'utf8')),
      evidenceSourceSha256: sourceHash(await readFile(new URL('../src/agents/visual-evidence.ts', import.meta.url), 'utf8')),
      nativeRendered: options.native ?? false, elapsedMs: performance.now() - started, sampling, gateCases,
      limitation: 'Scripted reviewers establish host budgets and evidence delivery, not real-model defect detection, false positives, visual quality or model latency.' };
    if (options.directory) await writeFile(join(directory, 'result.json'), JSON.stringify(report, null, 2));
    return report;
  } finally {
    if (!options.directory) await rm(directory, { recursive: true, force: true });
  }
}

if (import.meta.main) {
  const directory = process.argv.find(argument => argument.startsWith('--output='))?.slice('--output='.length);
  console.log(JSON.stringify(await runReviewEfficiencyBenchmark({ directory, native: process.argv.includes('--native') }), null, 2));
}

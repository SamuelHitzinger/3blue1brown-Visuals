/** Blinded real-model evidence experiment. Freeze first; running is explicit.
 * No scene source, arm names, or seeded truth enters the reviewer prompt.
 */
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { compileSource } from 'animlib/core';
import type { CompiledScene } from 'animlib/core';
import { agentConfig, AgentError } from '../src/agents/config.js';
import { PiAgentRunner } from '../src/agents/runtime.js';
import type { AgentRunMetrics, AgentTask } from '../src/agents/runtime.js';
import { renderSceneFrames } from '../src/agents/frame-renderer.js';
import { planReviewEvidence, selectReviewImages } from '../src/agents/visual-evidence.js';
import type { ReviewEvidencePlan, ReviewImage } from '../src/agents/visual-evidence.js';
import { parseVisualVerification } from '../src/agents/visual-edits.js';
import type { VisualVerification } from '../src/agents/visual-edits.js';

const repo = resolve(import.meta.dir, '../..');
const hash = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
const save = (path: string, value: unknown) => writeFile(path, JSON.stringify(value, null, 2));
type Arm = 'baseline' | 'candidate';
type Pair = 'visibility' | 'count';
type Condition = 'clean' | 'defect';
const trackedSources = [
  'backend/bench/review-detection.ts', 'backend/src/agents/runtime.ts', 'backend/src/agents/config.ts',
  'backend/src/agents/frame-renderer.ts', 'backend/src/agents/visual-evidence.ts', 'backend/src/agents/visual-edits.ts',
  'shared/animlib/tools/render-frames.mjs', 'shared/animlib/dist/core.js',
  'shared/animlib/dist/compiler.js', 'shared/animlib/dist/renderer.js',
];
const settings = () => {
  const config = agentConfig();
  return { provider: config.provider, model: config.model, thinking: config.thinking, authMode: config.authMode,
    outputMode: 'text' as const, allowWeb: false, timeoutMs: 180_000, modelConversationsPerCell: 1,
    providerRetry: 'disabled-by-benchmark-wait-hook', protocolRetry: 'none' };
};

/** Frozen inherited sampler from checkpoint 6d9798e; sheets only in that arm. */
export function inheritedReviewTimes(scene: CompiledScene): number[] {
  const duration = scene.duration, times = new Set([0, Math.min(.5, duration / 4), duration]);
  const candidates = new Set<number>();
  for (let i = 1; i < 12; i++) candidates.add(duration * i / 12);
  const cameraMids = scene.tracks.filter(track => track.action.type === 'camera').map(track => track.start + track.duration / 2);
  for (const time of cameraMids.slice(0, 4)) times.add(time);
  for (const track of scene.tracks) for (const time of [track.start, track.start + track.duration / 2, track.start + track.duration]) candidates.add(time);
  for (const event of scene.lifecycle) candidates.add(event.time);
  while (times.size < 12) {
    let best: number | undefined, gap = 1e-6;
    for (const time of candidates) {
      if (time < 0 || time > duration) continue;
      const distance = Math.min(...[...times].map(other => Math.abs(other - time)));
      if (distance > gap) { best = time; gap = distance; }
    }
    if (best === undefined) break;
    times.add(best);
  }
  return [...times].sort((a, b) => a - b);
}

const systemPrompt = `Assess only the supplied visual intent and rendered images. Check every supplied image for demonstrated violations of that intent. Contact-sheet cells are complete viewports, ordered left-to-right then top-to-bottom; their timestamps are listed. Native images, when present, show one full-resolution viewport. Do not infer that an unsampled interval was inspected. Missing intervals alone are not defects. Do not demand extra decoration, animation, or style changes. No source, narration, external evidence, or tools are available.
Return exactly one JSON object with approved and findings. Approve if and only if no substantive defect is demonstrated by supplied images. Each finding must give its supplied frame timestamp (or null if unknown), identifiable objectIds from the intent, concrete problem, and smallest correction. Format: {"approved":true,"findings":[]} or {"approved":false,"findings":[{"timeSec":1.5,"objectIds":["disk-b"],"problem":"Observed violation","fix":"Correction"}]}. No markdown or extra keys.`;

function fixture(pair: Pair, condition: Condition) {
  const x = condition === 'defect' ? 20 : 3;
  const count = condition === 'defect' ? '3' : '2';
  const source = pair === 'visibility'
    ? `export default scene({},s=>{
  s.text('heading',{text:'Two separate objects',position:[0,2],fontSize:.5});
  s.circle('disk-a',{position:[-2,0],radius:.65,fill:'BLUE'});
  s.text('label-a',{text:'A',position:[-2,0],fontSize:.5,fill:'WHITE'});
  const b=s.circle('disk-b',{position:[2,0],radius:.65,fill:'YELLOW'});
  const label=s.text('label-b',{text:'B',position:[2,0],fontSize:.5,fill:'BLACK'});
  s.wait(6.23);s.play([b.moveTo([${x},0]),label.moveTo([${x},0])],{duration:.04,ease:'linear'});
  s.play([b.moveTo([2,0]),label.moveTo([2,0])],{duration:.04,ease:'linear'});s.wait(53.69);
});`
    : `export default scene({},s=>{
  s.text('count',{text:'Total = ${count}',position:[0,2],fontSize:.55});
  s.circle('disk-a',{position:[-2,0],radius:.65,fill:'BLUE'});
  s.text('label-a',{text:'A',position:[-2,0],fontSize:.5,fill:'WHITE'});
  s.circle('disk-b',{position:[2,0],radius:.65,fill:'YELLOW'});
  s.text('label-b',{text:'B',position:[2,0],fontSize:.5,fill:'BLACK'});s.wait(12);
});`;
  const intent = pair === 'visibility'
    ? 'Show exactly two labeled disks throughout: blue A (disk-a, label-a) and yellow B (disk-b, label-b). Both disks and their labels must remain fully visible and clearly separated in each viewport. Small motion is allowed; neither disk may leave the viewport or cover the other. The heading is heading.'
    : 'Show two labeled disks: blue A (disk-a, label-a) and yellow B (disk-b, label-b). Both disks and their labels must remain fully visible and separated. The displayed Total (objectId count) must equal the number of visible disks in every frame.';
  return { id: `${pair}-${condition}`, pair, condition, source, sourceSha256: hash(source), intent,
    truth: { defective: condition === 'defect', seedObjectIds: pair === 'visibility' ? ['disk-b', 'label-b'] : ['count'],
      seedDescription: pair === 'visibility' ? 'B and its label leave the viewport during the brief excursion.' : 'Displayed Total is 3 although exactly two disks are visible.',
      seedInterval: pair === 'visibility' ? [6.23, 6.31] : [0, 12],
      adjudication: 'A rejection alone does not establish seed detection. Inspect findings, timestamp, and corresponding saved native frame; retain unrelated findings as possible false positives.' } };
}

async function sourceHashes() {
  return Object.fromEntries(await Promise.all(trackedSources.map(async path => [path, hash(await readFile(join(repo, path)))])));
}
export async function buildReviewDetectionManifest() {
  const fixtures = [];
  for (const pair of ['visibility', 'count'] as const) for (const condition of ['clean', 'defect'] as const) {
    const value = fixture(pair, condition), compiled = await compileSource(value.source);
    const baseline = inheritedReviewTimes(compiled), candidate = planReviewEvidence(compiled);
    fixtures.push({ ...value, duration: compiled.duration, baselineTimes: baseline, candidatePlan: candidate });
  }
  // Fixed before any model result; reverse ordering in pair 2 limits simple arm-order confounding.
  const order: { fixtureId: string; arm: Arm }[] = [
    { fixtureId: 'visibility-clean', arm: 'baseline' }, { fixtureId: 'visibility-defect', arm: 'candidate' },
    { fixtureId: 'visibility-clean', arm: 'candidate' }, { fixtureId: 'visibility-defect', arm: 'baseline' },
    { fixtureId: 'count-defect', arm: 'baseline' }, { fixtureId: 'count-clean', arm: 'candidate' },
    { fixtureId: 'count-defect', arm: 'candidate' }, { fixtureId: 'count-clean', arm: 'baseline' },
  ];
  return { benchmark: 'review-detection', version: 1, frozenAt: new Date().toISOString(), baselineRevision: '6d9798e',
    settings: settings(), sourceHashes: await sourceHashes(), systemPrompt, systemPromptSha256: hash(systemPrompt), fixtures, order,
    design: 'Two predeclared clean/defect pairs, two evidence arms, eight independent blinded conversations. Same renderer, intent, reviewer prompt, model, and configuration. Evidence arm jointly changes timestamps and inclusion of selected native frames.',
    limitations: ['One response per cell; this is a smoke experiment, not a general detection rate estimate.',
      'The visibility interval deliberately tests known sampling weakness; count tests an obvious persistent error. Neither represents scientific scene difficulty.',
      'Baseline and candidate may legitimately disagree when one arm never shows the defect. Approval certifies supplied evidence only.',
      'Rejection rate is not seed detection. Human adjudication of raw findings and pixels is required.',
      'No continuous-motion, interaction, acoustic sync, or full production prompting claim.'],
  };
}
type Manifest = Awaited<ReturnType<typeof buildReviewDetectionManifest>>;

/** Pure compilation/manifest preparation only; never renders or calls a model. */
export async function freezeReviewDetection(directory: string) {
  directory = resolve(directory);
  const manifest = await buildReviewDetectionManifest();
  await mkdir(resolve(directory, '..'), { recursive: true });
  await mkdir(directory); // Refuse replacement of any earlier experiment, including partial runs.
  for (const value of manifest.fixtures) await writeFile(join(directory, `${value.id}.js`), value.source, { flag: 'wx' });
  await writeFile(join(directory, 'manifest.json'), JSON.stringify(manifest, null, 2), { flag: 'wx' });
  await writeFile(join(directory, 'manifest.sha256'), hash(JSON.stringify(manifest)), { flag: 'wx' });
  return { directory, manifestSha256: hash(JSON.stringify(manifest)), cells: manifest.order.length, status: 'frozen-not-run' };
}

interface CellResult {
  fixtureId: string; arm: Arm; status: 'running' | 'complete' | 'failed'; elapsedMs?: number; renderMs?: number;
  inputSha256?: string; outputSha256?: string; review?: VisualVerification; metrics?: AgentRunMetrics;
  rejected?: boolean; expectedDefect?: boolean; findingTimesInSeedInterval?: number[];
  error?: { code: string; message: string };
}

/** Explicit eight-cell experiment; a durable exclusive marker prevents reruns. */
export async function runReviewDetection(directory: string) {
  directory = resolve(directory);
  const manifest = JSON.parse(await readFile(join(directory, 'manifest.json'), 'utf8')) as Manifest;
  if (hash(JSON.stringify(manifest)) !== (await readFile(join(directory, 'manifest.sha256'), 'utf8')).trim()) throw new Error('Frozen manifest changed. Create a new deliberate trial.');
  if (manifest.benchmark !== 'review-detection' || manifest.version !== 1) throw new Error('Unknown frozen experiment.');
  if (JSON.stringify(manifest.settings) !== JSON.stringify(settings())) throw new Error('Model/settings changed since freeze. Create a new deliberate trial.');
  if (JSON.stringify(manifest.sourceHashes) !== JSON.stringify(await sourceHashes())) throw new Error('Benchmark/runtime/rendering code changed since freeze. Create a new deliberate trial.');
  if (hash(manifest.systemPrompt) !== manifest.systemPromptSha256) throw new Error('Frozen prompt hash mismatch.');
  for (const value of manifest.fixtures) {
    if (hash(value.source) !== value.sourceSha256 || hash(await readFile(join(directory, `${value.id}.js`))) !== value.sourceSha256) throw new Error('Frozen scene changed.');
  }
  await writeFile(join(directory, 'run-started.json'), JSON.stringify({ startedAt: new Date().toISOString(), manifestSha256: hash(JSON.stringify(manifest)) }), { flag: 'wx' });
  const runner = new PiAgentRunner(agentConfig(), undefined, async () => {
    throw new AgentError('BENCHMARK_PROVIDER_RETRY_DISABLED', 'Provider retry prevented. Original failure is retained in the runner log; this cell will not rerun.');
  });
  const result = { benchmark: manifest.benchmark, manifestSha256: hash(JSON.stringify(manifest)), startedAt: new Date().toISOString(),
    status: 'running', cells: [] as CellResult[], finishedAt: undefined as string | undefined, elapsedMs: 0,
    summary: undefined as unknown, limitations: manifest.limitations };
  const started = performance.now();
  await save(join(directory, 'result.json'), result);
  for (const [index, entry] of manifest.order.entries()) {
    const value = manifest.fixtures.find(value => value.id === entry.fixtureId)!;
    if (!value || !['baseline', 'candidate'].includes(entry.arm)) throw new Error('Unknown frozen cell.');
    const cellDirectory = join(directory, `cell-${String(index).padStart(2, '0')}`);
    await mkdir(cellDirectory);
    const cell: CellResult = { ...entry, status: 'running' };
    result.cells.push(cell); await save(join(directory, 'result.json'), result);
    const cellStarted = performance.now();
    try {
      const times = entry.arm === 'baseline' ? value.baselineTimes : value.candidatePlan.samples.map(sample => sample.time);
      const renderStarted = performance.now();
      const evidence = await renderSceneFrames({ source: value.source, times, directory: cellDirectory, signal: AbortSignal.timeout(120_000) });
      cell.renderMs = performance.now() - renderStarted;
      const images: ReviewImage[] = entry.arm === 'baseline'
        ? evidence.sheets.map(sheet => ({ ...sheet, kind: 'contact-sheet' as const }))
        : selectReviewImages(evidence, value.candidatePlan as ReviewEvidencePlan);
      const imageMap = images.map(({ path: _path, ...image }, index) => ({ image: index + 1, ...image }));
      // No fixture ID, condition, seed interval, risk reason, source or arm name enters this payload.
      const prompt = `Visual intent:\n${value.intent}\nScene duration: ${value.duration} seconds.\nRendered image map:\n${JSON.stringify(imageMap)}`;
      const contents = await Promise.all(images.map(async image => readFile(image.path)));
      const allFrameHashes = await Promise.all(evidence.frames.map(async frame => ({ ...frame, sha256: hash(await readFile(frame.path)) })));
      const selectedImageHashes = images.map((image, i) => ({ ...image, sha256: hash(contents[i]) }));
      const input = { systemPrompt: manifest.systemPrompt, prompt, imageMap, imageSha256: contents.map(hash) };
      cell.inputSha256 = hash(JSON.stringify(input));
      await save(join(cellDirectory, 'review-input.json'), input);
      await save(join(cellDirectory, 'evidence.json'), { ...evidence, allFrameHashes, selectedImageHashes });
      const task: AgentTask = { systemPrompt: manifest.systemPrompt, prompt, outputMode: 'text', allowWeb: false,
        images: contents.map(data => ({ type: 'image' as const, mimeType: 'image/png', data: data.toString('base64') })),
        signal: AbortSignal.timeout(manifest.settings.timeoutMs), onMetrics: metrics => { cell.metrics = metrics; } };
      console.log(JSON.stringify({ event: 'review-detection.cell.started', index, fixtureId: entry.fixtureId, arm: entry.arm }));
      const output = await runner.run(task);
      await writeFile(join(cellDirectory, 'review-output.txt'), output, { flag: 'wx' });
      cell.outputSha256 = hash(output);
      cell.review = parseVisualVerification(output, value.duration);
      cell.rejected = !cell.review.approved; cell.expectedDefect = value.truth.defective;
      cell.findingTimesInSeedInterval = cell.review.findings.flatMap(finding => finding.timeSec !== null
        && finding.timeSec >= value.truth.seedInterval[0] && finding.timeSec <= value.truth.seedInterval[1] ? [finding.timeSec] : []);
      cell.status = 'complete';
    } catch (error) {
      cell.status = 'failed'; cell.error = { code: error instanceof AgentError ? error.code : 'BENCHMARK', message: error instanceof Error ? error.message : String(error) };
    }
    cell.elapsedMs = performance.now() - cellStarted;
    await save(join(cellDirectory, 'result.json'), cell);
    result.elapsedMs = performance.now() - started;
    await save(join(directory, 'result.json'), result);
    console.log(JSON.stringify({ event: 'review-detection.cell.finished', index, status: cell.status, elapsedMs: cell.elapsedMs, error: cell.error }));
  }
  result.status = result.cells.every(cell => cell.status === 'complete') ? 'complete' : 'incomplete';
  result.finishedAt = new Date().toISOString(); result.elapsedMs = performance.now() - started;
  const byArm = (['baseline', 'candidate'] as const).map(arm => {
    const complete = result.cells.filter(cell => cell.arm === arm && cell.status === 'complete');
    return { arm, complete: complete.length, total: result.cells.filter(cell => cell.arm === arm).length,
      rejectedCleanControls: complete.filter(cell => !cell.expectedDefect && cell.rejected).length,
      rejectedSeededScenes: complete.filter(cell => cell.expectedDefect && cell.rejected).length,
      confirmedSeedDetections: null,
      interpretation: 'Counts are raw model decisions, not adjudicated detection or false-positive rates. Inspect every finding and relevant native frame; no reruns were performed.' };
  });
  const disagreements = manifest.fixtures.flatMap(value => {
    const baseline = result.cells.find(cell => cell.fixtureId === value.id && cell.arm === 'baseline');
    const candidate = result.cells.find(cell => cell.fixtureId === value.id && cell.arm === 'candidate');
    return baseline?.status === 'complete' && candidate?.status === 'complete' && baseline.rejected !== candidate.rejected
      ? [{ fixtureId: value.id, baselineRejected: baseline.rejected, candidateRejected: candidate.rejected,
        interpretation: 'Different evidence can justify different decisions. Inspect the raw findings and available frames before scoring.' }] : [];
  });
  result.summary = { byArm, disagreements };
  await save(join(directory, 'result.json'), result);
  return result;
}

if (import.meta.main) {
  const mode = process.argv[2], directory = process.argv[3];
  if (!directory || !['freeze', 'run'].includes(mode)) throw new Error('Usage: review-detection.ts freeze|run OUTPUT_DIRECTORY. Freeze and inspect before run.');
  const result = mode === 'freeze' ? await freezeReviewDetection(directory) : await runReviewDetection(directory);
  console.log(JSON.stringify(result, null, 2));
  if ('status' in result && result.status === 'incomplete') process.exitCode = 1;
}

import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { agentConfig, agentFailure } from '../../backend/src/agents/config.js';
import { PiAgentRunner, AGENT_COMPLETION_INSTRUCTIONS } from '../../backend/src/agents/runtime.js';
import type { AgentTask, AgentRunMetrics } from '../../backend/src/agents/runtime.js';
import { PLANNING_CONTRACT } from '../../backend/src/agents/planning.js';
import { createPiGenerator } from '../../backend/src/agents/generator.js';
import { atomicWrite } from '../../backend/src/narration/service.js';
import type { NarrationService } from '../../backend/src/narration/service.js';
import type { VideoRequest } from '../../shared/video/contract.js';
import type { Frame } from 'animlib/core';
import { replacePromptFragments } from './prompt-substitution.js';

const root = fileURLToPath(new URL('.', import.meta.url));
const repo = resolve(root, '../..');
const hash = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
const args = process.argv.slice(2);
function option(name: string, fallback?: string) {
  const index = args.indexOf(name);
  if (index < 0) return fallback;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) throw Error(`Missing ${name} value`);
  return value;
}
const strategy = option('--strategy', 'baseline')!;
const caseId = option('--case', 'sine')!;
if (!/^[a-z][a-z0-9-]*$/.test(strategy)) throw Error('Use a simple strategy name.');
const dryRun = args.includes('--dry-run');
const strategyDirectory = resolve(option('--strategy-dir', join(root, strategy))!);
const cases = JSON.parse(await readFile(join(root, 'cases.json'), 'utf8')) as { id: string; expectation: string; request: VideoRequest }[];
const testCase = cases.find(item => item.id === caseId);
if (!testCase) throw Error(`Unknown case: ${caseId}`);
const request = testCase.request;
if (request.sceneRequest || request.narrationMode !== 'subtitles') throw Error('Harness requires full lesson planning and supported subtitle delivery.');

// The exact current production files are assembly anchors. Candidates live only in
// research. Never overwrite production prompts to switch an experiment.
const promptDirectory = join(repo, 'backend/prompts');
const baselineDirectory = join(root, 'baseline');
const fragments: Record<string, { original: string; candidate: string }> = {};
const liveFiles: Record<string, string> = {};
const baselineHashes: Record<string, string> = {};
const candidateHashes: Record<string, string> = {};
async function optionalText(path: string) {
  try { return await readFile(path, 'utf8'); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined; throw error; }
}
for (const name of (await readdir(join(baselineDirectory, 'prompts'))).filter(name => name.endsWith('.md')).sort()) {
  const originalPath = join(promptDirectory, name);
  const original = await readFile(originalPath, 'utf8');
  const baseline = await readFile(join(baselineDirectory, 'prompts', name), 'utf8');
  const candidate = strategy === 'baseline' ? baseline
    : await optionalText(join(strategyDirectory, name)) ?? await optionalText(join(strategyDirectory, 'prompts', name)) ?? baseline;
  fragments[name] = { original, candidate };
  liveFiles[originalPath] = hash(original);
  baselineHashes[name] = hash(baseline);
  candidateHashes[name] = hash(candidate);
}
const planningPath = join(baselineDirectory, 'planning-contract.txt');
await writeFile(planningPath, PLANNING_CONTRACT, { flag: 'wx' }).catch(error => { if (error.code !== 'EEXIST') throw error; });
const baselinePlanning = await readFile(planningPath, 'utf8');
const candidatePlanning = strategy === 'baseline' ? baselinePlanning
  : await optionalText(join(strategyDirectory, 'planning-contract.txt')) ?? baselinePlanning;
fragments['planning-contract.txt'] = { original: PLANNING_CONTRACT, candidate: candidatePlanning };
baselineHashes['planning-contract.txt'] = hash(baselinePlanning);
candidateHashes['planning-contract.txt'] = hash(candidatePlanning);
const guideHashes: Record<string, string> = {};
for (const name of ['reference.md', 'capabilities.md']) {
  const file = join(repo, 'shared/animlib/docs', name);
  const value = await readFile(file, 'utf8');
  const baseline = await readFile(join(baselineDirectory, 'guides', name), 'utf8');
  if (value !== baseline) throw Error(`Shared guide changed since baseline snapshot: ${name}`);
  guideHashes[name] = liveFiles[file] = hash(value);
}
liveFiles[join(repo, 'backend/src/agents/planning.ts')] = hash(await readFile(join(repo, 'backend/src/agents/planning.ts')));
const formalText = await optionalText(join(root, 'formal-experiment.json'));
const formalExperiment = formalText ? JSON.parse(formalText) : undefined;
if (!formalExperiment || resolve(formalExperiment.checkoutPath) !== repo) throw Error('Formal isolated experiment manifest is missing or belongs to another checkout.');
if (hash(await readFile(join(root, 'cases.json'))) !== formalExperiment.casesSha256) throw Error('Formal test requests changed.');
if (hash(await readFile(join(baselineDirectory, 'snapshot.json'))) !== formalExperiment.promptSettingsSnapshotSha256) throw Error('Formal baseline prompt/settings snapshot changed.');
const sourceSnapshotText = await optionalText(join(baselineDirectory, 'production-source-hashes.json'));
if (!sourceSnapshotText || hash(sourceSnapshotText) !== formalExperiment.sourceSnapshotSha256) throw Error('Formal production source snapshot is missing or changed.');
const sourceSnapshot = sourceSnapshotText ? JSON.parse(sourceSnapshotText) as { capturedAt: string; files: Record<string, string> } : undefined;
if (sourceSnapshot) for (const [relative, expected] of Object.entries(sourceSnapshot.files)) {
  const file = join(repo, relative);
  if (hash(await readFile(file)) !== expected) throw Error(`Production assembly changed since source snapshot: ${relative}`);
  liveFiles[file] = expected;
}
// These settings are identical for every strategy. Subscription auth settings and
// its directory are read from backend/.env.local by running Bun from backend/.
const config = agentConfig({ ...process.env, AGENT_MODEL: 'gpt-6-astra', AGENT_THINKING: 'high',
  AGENT_SCENE_OUTPUT_MODE: 'validated-reference', AGENT_SCENE_TIMING_MODE: 'host' });
const settings = { model: config.model, provider: config.provider, thinking: config.thinking,
  outputMode: config.sceneOutputMode, timingMode: config.sceneTimingMode, preview: false,
  timeoutMinutes: 35, maximumScenes: 3 };
const snapshot = { baselineHashes, guideHashes, settings };
await writeFile(join(baselineDirectory, 'snapshot.json'), JSON.stringify(snapshot, null, 2), { flag: 'wx' })
  .catch(error => { if (error.code !== 'EEXIST') throw error; });
const originalSnapshot = JSON.parse(await readFile(join(baselineDirectory, 'snapshot.json'), 'utf8'));
if (JSON.stringify(originalSnapshot) !== JSON.stringify(snapshot)) throw Error('Baseline snapshot or common model settings changed. Start a distinct evaluation, never mix results.');
const changedFragments = Object.keys(candidateHashes).filter(name => candidateHashes[name] !== baselineHashes[name]);
if (strategy !== 'baseline' && !changedFragments.length) throw Error(`Strategy ${strategy} has no changed prompt fragments.`);
if (dryRun) {
  console.log(JSON.stringify({ dryRun: true, strategy, caseId, strategyDirectory, settings, request,
    changedFragments, baselineHashes, candidateHashes, guideHashes }, null, 2));
  process.exit(0);
}

const id = randomUUID();
const outputRoot = join(repo, 'data/dimensional-prompt-eval/runs', strategy, caseId);
const directory = join(outputRoot, id);
await mkdir(directory, { recursive: true });
const result: any = {
  schemaVersion: 1, strategy, caseId, id, directory, status: 'running', createdAt: new Date().toISOString(),
  formalExperimentId: formalExperiment.id, checkoutPath: repo, branch: formalExperiment.branch,
  request, requestSha256: hash(JSON.stringify(request)), expectation: testCase.expectation,
  ...settings, baselineHashes, candidateHashes, guideHashes, changedFragments, tasks: [], scenes: [],
  productionSourceSnapshot: sourceSnapshotText ? { sha256: hash(sourceSnapshotText), capturedAt: sourceSnapshot!.capturedAt, fileCount: Object.keys(sourceSnapshot!.files).length } : null,
  boundary: 'Fresh production createPiGenerator and PiAgentRunner: full lesson draft/editorial review, supported subtitle timing, every planned scene, compiler/analytical inspection, native WebGPU visual gate and bounded repair. No seeded lesson, no source edits. Supported subtitles bypass TTS. Optional Chromium preview disabled uniformly. Library thumbnail/storage/HTTP are outside this content-generation experiment.',
  promptProvenance: 'task-N-STAGE.effective.json/.system.txt/.user.txt are authoritative model task prompts. Generator *.prompt.md and *.instructions.json reflect the original assembly before isolated exact-fragment substitutions. Runtime completion suffix saved separately; provider-added tool/schema formatting is not a stage prompt.',
};
const resultPath = join(root, `${strategy}-${caseId}.result.json`);
const save = async () => {
  const text = JSON.stringify(result, null, 2);
  await atomicWrite(join(directory, 'result.json'), text);
  const summary = { ...result, scenes: result.scenes.map(({ source, ...scene }: any) => ({
    ...scene, sourcePath: join(directory, `scene-${scene.index}.subtitles.js`),
  })) };
  await atomicWrite(resultPath, JSON.stringify(summary, null, 2));
};
await atomicWrite(join(directory, 'request.json'), JSON.stringify(request, null, 2));
await save();
async function assertAssemblyUnchanged() {
  for (const [file, expected] of Object.entries(liveFiles)) {
    if (hash(await readFile(file)) !== expected) throw Error(`Production assembly changed during isolated run: ${file}`);
  }
}
let counter = 0;
const pi = new PiAgentRunner(config);
const runner = { async run(task: AgentTask) {
  await assertAssemblyUnchanged();
  const number = counter++;
  const stage = task.logContext?.sceneIndex === undefined ? task.logContext?.stage ?? 'unknown'
    : task.logContext.stage === 'review' ? 'visual-review' : task.logContext.stage === 'repair' ? 'visual-repair' : task.logContext.stage ?? 'unknown';
  result.stage = stage;
  const substituted = replacePromptFragments(task.systemPrompt, fragments);
  const mode = task.outputMode ?? 'text';
  const completion = AGENT_COMPLETION_INSTRUCTIONS[mode] + (task.sceneTools && mode === 'validated-reference'
    ? '\nYou may also select a candidateId returned by inspect_scene or preview_scene; both run the same host validation before inspection. No extra validate_output call is needed for that candidate.' : '');
  const prefix = join(directory, `task-${number}-${stage}`);
  const promptInfo = { number, stage, sceneIndex: task.logContext?.sceneIndex, outputMode: mode,
    originalSystemSha256: hash(task.systemPrompt), effectiveSystemSha256: hash(substituted.text),
    effectiveSystemWithCompletionSha256: hash(substituted.text + completion), userSha256: hash(task.prompt),
    matchedFragments: substituted.matches, images: (task.images ?? []).map(image => ({ mimeType: image.mimeType, sha256: hash(Buffer.from(image.data, 'base64')) })) };
  await atomicWrite(`${prefix}.effective.json`, JSON.stringify(promptInfo, null, 2));
  await atomicWrite(`${prefix}.system.txt`, substituted.text);
  await atomicWrite(`${prefix}.completion.txt`, completion);
  await atomicWrite(`${prefix}.user.txt`, task.prompt);
  await save();
  console.log(JSON.stringify({ event: 'dimensional.task.start', strategy, caseId, id, number, stage }));
  const toolEffort: Record<string, { calls: number; elapsedMs: number; failures: number }> = {};
  const tracked = <T extends (...args: any[]) => Promise<any>>(name: string, fn: T): T => (async (...input: Parameters<T>) => {
    const entry = toolEffort[name] ??= { calls: 0, elapsedMs: 0, failures: 0 };
    entry.calls++; const start = performance.now();
    try { return await fn(...input); } catch (error) { entry.failures++; throw error; }
    finally { entry.elapsedMs += performance.now() - start; }
  }) as T;
  let metrics: AgentRunMetrics | undefined;
  const start = performance.now();
  try {
    const output = await pi.run({ ...task, systemPrompt: substituted.text,
      ...(task.publishModel ? { publishModel: tracked('publish_model', task.publishModel) } : {}),
      ...(task.sceneTools ? { sceneTools: { inspect: tracked('inspect_scene', task.sceneTools.inspect),
        ...(task.sceneTools.preview ? { preview: tracked('preview_scene', task.sceneTools.preview) } : {}) } } : {}),
      onMetrics(value) { metrics = value; task.onMetrics?.(value); },
    });
    await atomicWrite(`${prefix}.output.txt`, output);
    return output;
  } finally {
    const entry = { ...promptInfo, elapsedMs: performance.now() - start, toolEffort, metrics };
    result.tasks.push(entry);
    await atomicWrite(`${prefix}.metrics.json`, JSON.stringify(entry, null, 2));
    await save();
    console.log(JSON.stringify({ event: 'dimensional.task.finish', strategy, caseId, number, stage, elapsedMs: entry.elapsedMs }));
  }
} };
const generate = createPiGenerator(runner, { available: false } as NarrationService, outputRoot,
  { outputMode: config.sceneOutputMode, timingMode: config.sceneTimingMode });
const started = performance.now();
const signal = AbortSignal.timeout(settings.timeoutMinutes * 60 * 1000);
let previousFrame: Frame | undefined;
console.log(JSON.stringify({ event: 'dimensional.started', strategy, caseId, id, directory, resultPath, pid: process.pid }));
try {
  for (let index = 0; index <= settings.maximumScenes; index++) {
    const output = await generate(request, index, { owner: 'dimensional-prompt-eval', videoId: id, signal, previousFrame });
    if (!output) break;
    result.scenes.push({ ...output.scene, sourceSha256: hash(output.scene.source) });
    await atomicWrite(join(directory, `scene-${index}.silent-clock.wav`), output.audio);
    previousFrame = JSON.parse(await readFile(join(directory, `scene-${index}.final-frame.json`), 'utf8'));
    const lesson = JSON.parse(await readFile(join(directory, 'lesson.json'), 'utf8'));
    result.plannedSceneCount = lesson.plan.scenes.length;
    result.editorialAttempt = lesson.editorialReview.attempt;
    if (result.plannedSceneCount > settings.maximumScenes) throw Error(`Scene budget exceeded: planner returned ${result.plannedSceneCount} scenes.`);
    result.scenes.at(-1).visualReview = JSON.parse(await readFile(join(directory, `scene-${index}.visual-review.json`), 'utf8'));
    await save();
  }
  if (!result.scenes.length || result.scenes.length !== result.plannedSceneCount) throw Error('Full planned lesson did not complete.');
  await assertAssemblyUnchanged();
  result.singleSceneAdherence = result.scenes.length === 1;
  result.durationSec = result.scenes.reduce((total: number, scene: any) => total + scene.duration, 0);
  result.durationTargetAdherence = result.durationSec >= 35 && result.durationSec <= 45;
  await atomicWrite(join(directory, 'export-manifest.json'), JSON.stringify({ narrationMode: 'subtitles', scenes: result.scenes.map((scene: any) => ({
    id: scene.id, file: `scene-${scene.index}.subtitles.js`, duration: scene.duration,
  })), captions: result.scenes.flatMap((scene: any) => scene.captions), models: result.scenes.at(-1).assets }, null, 2));
  result.status = 'complete';
} catch (error) {
  const failure = agentFailure(error);
  result.status = 'failed'; result.error = { code: failure.code, message: failure.message };
  // These local errors contain only harness/renderer/validation facts. Raw provider
  // errors never escape PiAgentRunner's sanitizer.
  result.localError = error instanceof Error ? error.message : String(error);
  result.failureKind = /Automatic frame rendering failed \(\d+\):\s*interrupted\b/i.test(result.localError) ? 'source-runtime-limit'
    : /Production assembly changed|snapshot/i.test(result.localError) ? 'provenance-interference'
    : /Automatic frame rendering failed/i.test(result.localError) ? 'render-infrastructure'
    : ['AUTH', 'MODEL', 'LIMIT', 'CONFIG'].includes(failure.code) ? 'model-infrastructure' : 'generation-or-quality';
  process.exitCode = 1;
} finally {
  result.elapsedMs = performance.now() - started;
  const turns = result.tasks.flatMap((task: any) => task.metrics?.turns ?? []);
  result.effort = { taskCount: result.tasks.length, providerCalls: result.tasks.reduce((n: number, task: any) => n + (task.metrics?.providerCalls ?? 0), 0),
    inputTokens: turns.reduce((n: number, turn: any) => n + turn.inputTokens, 0), outputTokens: turns.reduce((n: number, turn: any) => n + turn.outputTokens, 0),
    reasoningTokens: turns.reduce((n: number, turn: any) => n + (turn.reasoningTokens ?? 0), 0), cacheReadTokens: turns.reduce((n: number, turn: any) => n + turn.cacheReadTokens, 0) };
  await save();
  console.log(JSON.stringify({ event: 'dimensional.finished', strategy, caseId, status: result.status, directory, elapsedMs: result.elapsedMs, effort: result.effort, error: result.error }));
}

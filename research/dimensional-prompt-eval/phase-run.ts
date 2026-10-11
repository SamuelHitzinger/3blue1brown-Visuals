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
import { createConstructionRunner } from './construction-runner.js';
import { PhaseTaskEvents, sumEffort, taskContextKey } from './phase-provenance.js';
import { constructionContext, constructionAnchors } from './phase-support.js';
import { buildAuthoringReference } from '../../backend/src/agents/authoring-reference.js';

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
const manifestPath = resolve(option('--manifest') ?? (() => { throw Error('Required --manifest'); })());
const casesPath = resolve(option('--cases') ?? (() => { throw Error('Required --cases'); })());
const formalText = await readFile(manifestPath, 'utf8');
const formalExperiment = JSON.parse(formalText);
if (resolve(formalExperiment.checkoutPath) !== repo || formalExperiment.phase !== 'construction-enzyme') throw Error('Wrong phase manifest/checkout.');
const arm = formalExperiment.arms.find((item: any) => item.strategy === strategy && item.caseId === caseId);
if (!arm || !['order-only','specialist'].includes(arm.constructionMode)) throw Error('Arm is not authorized by the phase manifest.');
if (option('--construction-mode', arm.constructionMode) !== arm.constructionMode) throw Error('Construction mode differs from manifest.');
const constructionMode = arm.constructionMode as 'order-only' | 'specialist';
const strategyDirectory = resolve(repo, arm.strategyDirectory);
const phaseDirectory = join(root, 'phases', formalExperiment.id);
const cases = JSON.parse(await readFile(casesPath, 'utf8')) as { id: string; expectation: string; request: VideoRequest }[];
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
if (hash(await readFile(casesPath)) !== formalExperiment.casesSha256) throw Error('Formal test requests changed.');
if (hash(JSON.stringify(request)) !== arm.requestSha256) throw Error('Arm request differs from frozen phase request.');
for (const [relative, expected] of Object.entries(formalExperiment.experimentInputs) as [string,string][]) {
  const file = resolve(repo, relative);
  if (hash(await readFile(file)) !== expected) throw Error('Experiment input changed: ' + relative);
  liveFiles[file] = expected;
}
liveFiles[manifestPath] = hash(formalText);
liveFiles[casesPath] = hash(await readFile(casesPath));
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
const apiReference = buildAuthoringReference(await readFile(join(repo, 'shared/animlib/docs/reference.md'), 'utf8'));
const anchors = constructionAnchors(fragments['scene-craft.md'].candidate, apiReference);
const specialistPrompt = await readFile(join(root, 'construction-specialist.md'), 'utf8');
if (hash(anchors.checklist) !== formalExperiment.construction.checklistSha256
  || hash(apiReference) !== formalExperiment.construction.apiReferenceSha256
  || JSON.stringify(anchors.referenceExcerpts.map(hash)) !== JSON.stringify(formalExperiment.construction.excerptSha256)) throw Error('Construction anchors changed.');
const changedFragments = Object.keys(candidateHashes).filter(name => candidateHashes[name] !== baselineHashes[name]);
if (strategy !== 'baseline' && !changedFragments.length) throw Error(`Strategy ${strategy} has no changed prompt fragments.`);
if (dryRun) {
  console.log(JSON.stringify({ dryRun: true, strategy, caseId, strategyDirectory, settings, request,
    changedFragments, baselineHashes, candidateHashes, guideHashes, constructionMode,
    manifestPath, manifestStatus: formalExperiment.status, phaseDirectory,
    construction: formalExperiment.construction }, null, 2));
  process.exit(0);
}

if (formalExperiment.status !== 'frozen') throw Error('Inference requires a reviewed frozen manifest.');
const priorMatrix = JSON.parse(await readFile(join(root, 'matrix-state.json'), 'utf8'));
if (priorMatrix.formalExperimentId !== formalExperiment.priorExperimentId || priorMatrix.status !== 'complete'
  || priorMatrix.runs.length !== 9 || priorMatrix.runs.some((run: any) => ['running', 'queued'].includes(run.status))) throw Error('Phase 1 must finish before phase 2 inference.');
await mkdir(phaseDirectory, { recursive: true });
const resultPath = join(phaseDirectory, strategy + '-' + caseId + '.result.json');
const id = randomUUID();
// Reserve one immutable summary slot before starting inference. Failed attempts remain evidence.
await writeFile(resultPath, JSON.stringify({ status: 'reserved', id, createdAt: new Date().toISOString() }), { flag: 'wx' });
const outputRoot = join(repo, 'data/dimensional-prompt-eval/phases', formalExperiment.id, 'runs', strategy, caseId);
const directory = join(outputRoot, id);
await mkdir(directory, { recursive: true });
const result: any = {
  schemaVersion: 2, constructionMode, manifestSha256: hash(formalText), strategy, caseId, id, directory, status: 'running', createdAt: new Date().toISOString(),
  formalExperimentId: formalExperiment.id, checkoutPath: repo, branch: formalExperiment.branch,
  request, requestSha256: hash(JSON.stringify(request)), expectation: testCase.expectation,
  ...settings, baselineHashes, candidateHashes, guideHashes, changedFragments, tasks: [], scenes: [],
  productionSourceSnapshot: sourceSnapshotText ? { sha256: hash(sourceSnapshotText), capturedAt: sourceSnapshot!.capturedAt, fileCount: Object.keys(sourceSnapshot!.files).length } : null,
  boundary: 'Phase 2: exact frozen spatial candidate plus checklist ordering, optionally a real construction-specialist Pi conversation counted in effort. Fresh production createPiGenerator and PiAgentRunner: full lesson draft/editorial review, supported subtitle timing, every planned scene, compiler/analytical inspection, native WebGPU visual gate and bounded repair. No seeded lesson, no source edits. Supported subtitles bypass TTS. Optional Chromium preview disabled uniformly. Library thumbnail/storage/HTTP are outside this content-generation experiment.',
  promptProvenance: 'task-N-STAGE.effective.json/.system.txt/.user.txt are authoritative model task prompts. Generator *.prompt.md and *.instructions.json reflect the original assembly before isolated exact-fragment substitutions. Runtime completion suffix saved separately; provider-added tool/schema formatting is not a stage prompt.',
};
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
const assemblyByContext = new Map<string, { originalSystemSha256: string; substitutedSystemSha256: string; originalUserSha256: string; matchedFragments: Record<string, number> }>();
const pendingEvents = new PhaseTaskEvents();
const taskKey = taskContextKey;
const loggedPi = { async run(task: AgentTask) {
  await assertAssemblyUnchanged();
  const number = counter++;
  const event = pendingEvents.take(task);
  const stage = event?.role === 'construction-specialist' ? 'construction-specialist' : task.logContext?.sceneIndex === undefined ? task.logContext?.stage ?? 'unknown'
    : task.logContext.stage === 'review' ? 'visual-review' : task.logContext.stage === 'repair' ? 'visual-repair' : task.logContext.stage ?? 'unknown';
  result.stage = stage;
  const assembly = event?.role === 'construction-specialist' ? undefined : assemblyByContext.get(taskKey(task));
  if (!assembly && event?.role !== 'construction-specialist') throw Error('Missing production assembly provenance.');
  const mode = task.outputMode ?? 'text';
  const completion = AGENT_COMPLETION_INSTRUCTIONS[mode] + (task.sceneTools && mode === 'validated-reference'
    ? '\nYou may also select a candidateId returned by inspect_scene or preview_scene; both run the same host validation before inspection. No extra validate_output call is needed for that candidate.' : '');
  const prefix = join(directory, `task-${number}-${stage}`);
  const promptInfo = { number, stage, sceneIndex: task.logContext?.sceneIndex, outputMode: mode,
    originalSystemSha256: assembly?.originalSystemSha256 ?? hash(task.systemPrompt),
    substitutedSystemSha256: assembly?.substitutedSystemSha256, originalUserSha256: assembly?.originalUserSha256,
    effectiveSystemSha256: hash(task.systemPrompt),
    effectiveSystemWithCompletionSha256: hash(task.systemPrompt + completion), userSha256: hash(task.prompt),
    constructionTaskId: event?.taskId, constructionRole: event?.role,
    matchedFragments: assembly?.matchedFragments ?? {}, images: (task.images ?? []).map(image => ({ mimeType: image.mimeType, sha256: hash(Buffer.from(image.data, 'base64')) })) };
  await atomicWrite(`${prefix}.effective.json`, JSON.stringify(promptInfo, null, 2));
  await atomicWrite(`${prefix}.system.txt`, task.systemPrompt);
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
    const output = await pi.run({ ...task,
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
const spatialScenes = new Set<number>();
const construction = createConstructionRunner(loggedPi, {
  mode: constructionMode, checklist: anchors.checklist, apiReference,
  async contextForScene(task) {
    const context = await constructionContext(task);
    const index = task.logContext!.sceneIndex!;
    if (context.viewMode === '3d') spatialScenes.add(index);
    await atomicWrite(join(directory, 'scene-' + index + '.construction-context.json'), JSON.stringify(context, null, 2));
    return context;
  }, specialistPrompt,
  referenceExcerpts: anchors.referenceExcerpts, maxSpecialists: settings.maximumScenes,
  async onEvent(event) {
    await atomicWrite(join(directory, event.taskId + '.' + event.kind + '.json'), JSON.stringify(event, null, 2));
    if (event.kind === 'start') {
      pendingEvents.start(event);
    }
  },
  modelSystemForTask(task) {
    const mode = task.outputMode ?? 'text';
    return task.systemPrompt + AGENT_COMPLETION_INSTRUCTIONS[mode] + (task.sceneTools && mode === 'validated-reference'
      ? '\nYou may also select a candidateId returned by inspect_scene or preview_scene; both run the same host validation before inspection. No extra validate_output call is needed for that candidate.' : '');
  },
});
const runner = { async run(task: AgentTask) {
  await assertAssemblyUnchanged();
  const substituted = replacePromptFragments(task.systemPrompt, fragments);
  assemblyByContext.set(taskKey(task), { originalSystemSha256: hash(task.systemPrompt),
    substitutedSystemSha256: hash(substituted.text), originalUserSha256: hash(task.prompt), matchedFragments: substituted.matches });
  return construction.run({ ...task, systemPrompt: substituted.text });
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
  result.failureKind = result.localError === 'interrupted' ? 'source-runtime-limit'
    : /Automatic frame rendering failed \(\d+\):\s*interrupted\b/i.test(result.localError) ? 'source-runtime-limit'
    : /Production assembly changed|snapshot/i.test(result.localError) ? 'provenance-interference'
    : /Automatic frame rendering failed/i.test(result.localError) ? 'render-infrastructure'
    : ['AUTH', 'MODEL', 'LIMIT', 'CONFIG'].includes(failure.code) ? 'model-infrastructure' : 'generation-or-quality';
  process.exitCode = 1;
} finally {
  result.elapsedMs = performance.now() - started;
  result.construction = { mode: constructionMode, spatialSceneCount: spatialScenes.size,
    helperTaskCount: result.tasks.filter((task: any) => task.stage === 'construction-specialist').length,
    eventTaskIds: result.tasks.filter((task: any) => task.constructionTaskId).map((task: any) => task.constructionTaskId),
    pendingEventCount: pendingEvents.size,
    helperEffort: sumEffort(result.tasks.filter((task: any) => task.stage === 'construction-specialist')) };
  result.effort = sumEffort(result.tasks);
  await save();
  console.log(JSON.stringify({ event: 'dimensional.finished', strategy, caseId, status: result.status, directory, elapsedMs: result.elapsedMs, effort: result.effort, error: result.error }));
}

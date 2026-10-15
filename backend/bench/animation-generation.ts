/** Paired production runs against a frozen source snapshot and identical speech.
 * Run each arm in its own Bun process. No paid speech or production jobs are created.
 */
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import type { Frame } from 'animlib/core';
import type { Generator } from '../src/videos.js';

const repo = resolve(import.meta.dir, '../..');
const hash = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
const json = async (path: string) => JSON.parse(await readFile(path, 'utf8'));
const save = async (path: string, value: unknown) => writeFile(path, JSON.stringify(value, null, 2));
const cues: Record<string, string[][]> = {
  binary: [['Check the lower', 'We can rule out'], ['Check their lower middle', 'The remaining value']],
  derivative: [['Increase each side', 'The extra area splits'], ['Now shrink', 'The limiting rate']],
  rna: [['opens a small region', 'An RNA base pairs'], ['New bases attach', 'The new RNA peels away']],
};

export async function runGenerationBenchmark(variant: string, topic: string, trial: string) {
  if (!['baseline', 'candidate'].includes(variant) || !Object.hasOwn(cues, topic) || !/^[a-z0-9-]+$/.test(trial)) {
    throw new Error('Use baseline|candidate rna|binary|derivative TRIAL. Each trial directory is immutable.');
  }
  const sourceRoot = variant === 'baseline' ? join(repo, '.tmp/animation-efficiency/baseline') : repo;
  const load = (relative: string) => import(pathToFileURL(join(sourceRoot, relative)).href);
  const [{ createPiGenerator }, { PiAgentRunner }, { agentConfig }, { reviewGeneratedScene }, core] = await Promise.all([
    load('backend/src/agents/generator.ts'), load('backend/src/agents/runtime.ts'), load('backend/src/agents/config.ts'),
    load('backend/src/agents/visual-gate.ts'), load('shared/animlib/dist/core.js'),
  ]);
  const fixtureDir = join(repo, 'data/scene-speed/fixtures', topic);
  const [lesson, pkg, frozen] = await Promise.all([
    json(join(fixtureDir, 'lesson.json')), json(join(fixtureDir, 'narration.json')), json(join(fixtureDir, 'frozen.json')),
  ]);
  if (hash(JSON.stringify(lesson)) !== frozen.fixtureHash || hash(JSON.stringify(pkg)) !== frozen.packageHash) throw new Error('Frozen fixture changed.');
  for (const scene of pkg.scenes) if (hash(await readFile(join(fixtureDir, `${scene.id}.wav`))) !== frozen.audioHashes[scene.id]) throw new Error('Frozen audio changed.');
  // Identical semantic plan for both arms. Baseline parser ignores the new optional
  // cue field; candidate resolves it. Neither speech nor required visuals change.
  for (const [index, scene] of lesson.plan.scenes.entries()) {
    scene.view = { mode: '2d', rationale: 'The fixed benchmark teaches a planar schematic operation.' };
    scene.speechCues = cues[topic][index].map((phrase, i) => ({ id: `operation-${i + 1}`, phrase }));
    scene.visualDescription += ` Speech anchors: ${scene.speechCues.map((cue: {id: string; phrase: string}) => `${cue.id}: "${cue.phrase}"`).join('; ')}.`;
  }
  const root = join(repo, 'data/animation-efficiency/live', trial, topic, variant);
  const resultPath = join(root, 'result.json');
  try { await access(resultPath); throw new Error('Run already exists. Inspect it; choose a new trial for a deliberate rerun.'); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  const videoId = randomUUID(), directory = join(root, videoId);
  await mkdir(directory, { recursive: true });
  await save(join(directory, 'lesson.json'), { ...lesson, instructionVersion: 3 });
  const config = agentConfig(), pi = new PiAgentRunner(config);
  const metrics: any[] = [];
  let taskIndex = 0;
  const runner = { async run(task: any) {
    const index = taskIndex++;
    const summary: any = { stage: task.logContext?.stage, scene: task.logContext?.sceneIndex,
      promptBytes: Buffer.byteLength(task.systemPrompt + task.prompt) };
    try { return await pi.run({ ...task, onMetrics(value: unknown) { summary.metrics = value; task.onMetrics?.(value); } }); }
    finally { metrics.push(summary); await save(join(root, `task-${index}.json`), summary); }
  } };
  const narration = { available: true,
    async submit() { return { id: pkg.id, status: 'complete' }; },
    async get() { return { id: pkg.id, status: 'complete' }; },
    async scenePackage() { return pkg; },
    async audio(_owner: unknown, _id: unknown, audioId: string) {
      const scene = pkg.scenes.find((scene: any) => scene.audio.id === audioId);
      if (!scene) throw new Error('Unknown frozen audio');
      return join(fixtureDir, `${scene.id}.wav`);
    },
  };
  const generate: Generator = createPiGenerator(runner, narration, root, { outputMode: 'validated-reference', timingMode: 'host',
    // Same bounded review budget for both arms; actual evidence strategy differs.
    visualGate: (options: any) => reviewGeneratedScene({ ...options, maxReviewRounds: 2 }),
  });
  const sourceHashes = Object.fromEntries(await Promise.all([
    'backend/src/agents/generator.ts', 'backend/src/agents/runtime.ts', 'backend/src/agents/visual-gate.ts',
    'backend/src/agents/timing-prelude.ts', 'backend/src/agents/authoring-reference.ts',
    'backend/prompts/scene-craft.md', 'backend/prompts/scene-verify.md', 'shared/animlib/docs/reference.md',
    'shared/animlib/dist/core.js', 'shared/animlib/dist/compiler.js', 'shared/animlib/dist/runtime.js',
  ].map(async file => [file, hash(await readFile(join(sourceRoot, file)))])));
  const result: any = { variant, topic, trial, videoId, directory, status: 'running',
    baselineRevision: '6d9798e', revision: execFileSync('git', ['rev-parse', variant === 'baseline' ? '6d9798e' : 'HEAD'], { cwd: repo, encoding: 'utf8', windowsHide: true }).trim(), sourceHashes,
    model: config.model, thinking: config.thinking, fixtureHash: frozen.fixtureHash, packageHash: frozen.packageHash,
    planSha256: hash(JSON.stringify(lesson)), audioHashes: frozen.audioHashes, reviewRoundCap: 2,
    startedAt: new Date().toISOString(), elapsedMs: 0, metrics, scenes: [] };
  await save(resultPath, result);
  const started = performance.now();
  let previousFrame: Frame | undefined;
  try {
    for (let index = 0; index < pkg.scenes.length; index++) {
      console.log(JSON.stringify({ event: 'benchmark.scene.started', variant, topic, index, directory }));
      const output = await generate({ title: lesson.plan.centralQuestion, topic: lesson.plan.learningGoal, documents: [], videoMode: 'classic' }, index,
        { owner: 'animation-efficiency-benchmark', videoId, previousFrame, signal: AbortSignal.timeout(15 * 60 * 1000) });
      if (!output) throw new Error('Missing scene');
      const receipt = await json(join(directory, `scene-${index}.visual-review.json`));
      if (!receipt.approved || receipt.sourceSha256 !== hash(output.scene.source)) throw new Error('Approval/source mismatch');
      const compiled = await core.compileSource(output.scene.source, { previous: previousFrame });
      previousFrame = core.evaluateScene(compiled, compiled.duration);
      result.scenes.push({ ...output.scene, sourceSha256: hash(output.scene.source), sourceBytes: Buffer.byteLength(output.scene.source), approvedAttempt: receipt.attempt });
      result.elapsedMs = performance.now() - started;
      await save(resultPath, result);
    }
    result.status = 'complete';
  } catch (error) {
    result.status = 'failed';
    result.error = { code: (error as any)?.code ?? 'BENCHMARK', message: error instanceof Error ? error.message : String(error) };
  }
  result.elapsedMs = performance.now() - started;
  result.finishedAt = new Date().toISOString();
  await save(resultPath, result);
  console.log(JSON.stringify({ variant, topic, status: result.status, elapsedMs: result.elapsedMs, resultPath, error: result.error }));
  return result;
}

if (import.meta.main) {
  const result = await runGenerationBenchmark(process.argv[2], process.argv[3], process.argv[4]);
  if (result.status !== 'complete') process.exitCode = 1;
}

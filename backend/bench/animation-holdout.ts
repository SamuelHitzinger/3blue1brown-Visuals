/** A new spatial holdout, independent of the three matched planar fixtures.
 * `bun --env-file=backend/.env.local backend/bench/animation-holdout.ts TRIAL`
 * Runs the real author and native visual gate. Each trial is write-once.
 */
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { withOfflineScene } from 'animlib/core';
import type { Frame, ModelAsset, MolecularStructure, Vec3 } from 'animlib/core';
import { SpatialFrame } from '../../shared/animlib/src/spatial.js';
import { createBundledModelPreparer, describeBundledModel } from '../src/bundled-models.js';
import { ModelAssets } from '../src/model-assets.js';
import { createVisualizationResolver } from '../src/visualization-resolver.js';
import { buildSubtitlePackage } from '../src/narration/subtitles.js';
import { parseStoryline } from '../src/narration/markdown.js';
import { parsePlannedLesson } from '../src/agents/planning.js';
import type { PlannedLesson } from '../src/agents/planning.js';
import { resolveSpeechCues } from '../src/agents/timing-prelude.js';
import { inspectScene } from '../src/agents/scene-inspection.js';
import type { AgentRunMetrics, AgentRunner } from '../src/agents/runtime.js';
import type { VideoRequest } from '../../shared/video/contract.js';

const repo = resolve(import.meta.dir, '../..');
const hash = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
const save = (path: string, value: unknown) => writeFile(path, JSON.stringify(value, null, 2));
const json = async (path: string) => JSON.parse(await readFile(path, 'utf8'));
const PINNED_STRUCTURE_HASH = 'a5ccb3b7356bdcac54bc9ad69d38dc6f0c2d0716d18142a99dd60f74c6c8a607';
const PINNED_GLB_HASH = 'cb6fb2a3879d3e9b82549c270ec866b1241e7f30f62e1b1b4ea45a7c3aad0529';
const distance = (a: Vec3, b: Vec3) => Math.hypot(...a.map((value, axis) => value - b[axis]));
const close = (a: Vec3, b: Vec3, tolerance = 1e-6) => distance(a, b) <= tolerance;
function requireCheck(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Holdout acceptance: ${message}`);
}

export interface HoldoutLandmark { atomId: string; residueId: string; part: string; label: string; localPosition: Vec3 }
export function holdoutLandmarks(structure: MolecularStructure): [HoldoutLandmark, HoldoutLandmark] {
  requireCheck(hash(JSON.stringify(structure)) === PINNED_STRUCTURE_HASH, 'pinned deposited structure changed');
  const atoms = new Map(structure.atoms.map(atom => [atom.id, atom]));
  const points = structure.residues.map((residue, index) => {
    const atom = atoms.get(residue.anchorId!);
    requireCheck(atom?.name === 'CA', 'expected a deposited C-alpha anchor for every bead');
    return { atomId: atom.id, residueId: residue.id, part: `residue-${index}`,
      label: `${residue.name} ${residue.authorSequence}${residue.insertionCode} (C-alpha)`,
      localPosition: atom.position.map((value, axis) => value - structure.center[axis]) as Vec3 };
  });
  // Choose before generation, with stable source order as the tie breaker.
  let pair: [HoldoutLandmark, HoldoutLandmark] = [points[0], points[1]], longest = -1;
  for (let i = 0; i < points.length; i++) for (let j = i + 1; j < points.length; j++) {
    const length = distance(points[i].localPosition, points[j].localPosition);
    if (length > longest) { longest = length; pair = [points[i], points[j]]; }
  }
  return pair;
}

/** Pure fixture construction; timings are deterministic reading estimates, never speech alignment. */
export function buildHoldoutFixture(modelId: string, landmarks: [HoldoutLandmark, HoldoutLandmark]) {
  const title = 'Turning a protein is not folding it';
  const request: VideoRequest = { title, topic: 'Distinguish a rigid change of orientation or location from a change of molecular shape.',
    documents: [], videoMode: 'classic', narrationMode: 'subtitles' };
  const common = `Use the actual already published 1crn-beads model ${modelId}; its residue spheres are a schematic representation of deposited C-alpha sites, not atom radii or bonds. `
    + `Host landmarks in model-local angstrom coordinates (common origin already subtracted): ${JSON.stringify(landmarks)}. Their deposited separation is ${distance(landmarks[0].localPosition, landmarks[1].localPosition).toFixed(3)} angstrom. `
    + 'Use stable IDs assembly (common parent), protein (model root), marker-a and marker-b (world-space spheres centered on the exact supplied sites), distance-brace (annotation, not a molecular bond), and turn-indicator/ribbon (custom triangulated sector mesh). '
    + 'Build the annotation ribbon with a custom s.compose callback and computed vertices/triangles; retain freedom to choose its shape and framing. Keep one dominant spatial construction, with local readable labels. '
    + 'Use one common display scale. Apply the authored rotation/translation to assembly, whose origin is the chosen rotation pivot. The full model and the two markers move rigidly together; never move residues relative to each other or rescale during motion. Keep a static spatial camera during each scene. '
    + 'Place the distance brace outside the silhouette with leaders to the marked sites; its two ends may use the same model-local offset. Label residue representation and illustrative rigid motion concisely. '
    + 'Use s.schedule with the named speech cues. Cue timing comes from the host; do not copy timestamps or compute a manual cursor. Final explicit pause is a static hold.';
  const first = common + ' At mark-sites, reveal both markers and the distance brace. During turn-whole-structure, rotate the complete assembly through a clearly visible spatial angle, with no translation. '
    + 'Show the custom turn-indicator ribbon during that motion, then remove it by the end. The measured separation remains fixed. Reveal the conclusion at same-distance. '
    + 'Keep assembly and all its descendants for the next scene. Protein, markers, and bracket must exist from time zero; initially hidden annotations are allowed.';
  const second = common + ' Begin from the exact retained previousFrame, including camera, poses, colors and model child identities. Do not instantiate another protein or reconstruct retained objects. '
    + 'During slide-whole-structure, translate the assembly visibly sideways with no rotation or scale change. Preserve marker attachment and distance. Reveal the conclusion at shape-unchanged. '
    + 'Do not redraw the turn ribbon. Final picture holds the same protein, two markers, bracket and short conclusion.';
  const markdown = `# ${title}\n\n## Beat 1: Same shape, new orientation\n\nContent needed: ${first}\n\nNarration: This is a residue-level view of deposited crambin. Mark these two sites on the same structure. Turn the whole structure together through a new angle. The marked sites stay the same distance apart.\n\nPause: 2s\n\n## Beat 2: Same shape, new location\n\nContent needed: ${second}\n\nNarration: Keep the same structure from the previous view. Slide the whole structure sideways without changing its orientation. The shape and the marked distance stay unchanged. These are authored rigid motions, not folding trajectories.\n\nPause: 2s`;
  const lesson: PlannedLesson = { schemaVersion: 1, markdown, plan: {
    audience: 'Curious beginner', prerequisites: ['Recognize a three-dimensional object'], learningGoal: request.topic,
    centralQuestion: title, keyInsight: 'Rigid motion changes placement while preserving internal distances.',
    runningExample: 'The same deposited 1CRN residue-bead model and two fixed C-alpha landmarks.',
    misconceptions: ['A rotating protein model is not evidence of folding or measured dynamics.', 'The bracket is an annotation, not a chemical bond.'],
    entities: [
      { id: 'assembly', meaning: 'Protein and attached measurement annotations', color: 'GREY' },
      { id: 'protein', meaning: 'Deposited crambin represented by residue beads', color: 'GREY' },
      { id: 'marker-a', meaning: landmarks[0].label, color: 'TEAL' },
      { id: 'marker-b', meaning: landmarks[1].label, color: 'YELLOW' },
      { id: 'distance-brace', meaning: 'Constant deposited separation', color: 'WHITE' },
      { id: 'turn-indicator', meaning: 'Illustrative rigid rotation annotation', color: 'BLUE' },
    ], scenes: [first, second].map((visualDescription, i) => ({
      id: `beat-${i + 1}`, purpose: i ? 'Translate while preserving shape' : 'Rotate while preserving shape',
      whyNow: i ? 'Continue the exact preceding state to distinguish location from shape.' : 'Establish deposited geometry and a visible invariant.',
      keyPoints: [i ? 'The entire retained structure translates without changing orientation or internal distance.' : 'The entire deposited structure rotates without changing internal distance.'],
      visualDescription, endsWith: 'The protein and attached landmarks remain visible with their constant distance.',
      carry: i ? [] : ['assembly'], cleanup: i ? [] : ['turn-indicator'], interactions: [],
      view: { mode: '3d', rationale: 'A spatial rigid transform must preserve a real deposited three-dimensional shape.' },
      sourceRefs: [{ document: 'request', location: 'Pinned holdout source and host-provided model/landmark identities', supports: 'Static deposited 1CRN geometry; all motion is authored illustration.' }],
      speechCues: i ? [
        { id: 'slide-whole-structure', phrase: 'Slide the whole structure sideways without changing its orientation' },
        { id: 'shape-unchanged', phrase: 'The shape and the marked distance stay unchanged' },
      ] : [
        { id: 'mark-sites', phrase: 'Mark these two sites on the same structure' },
        { id: 'turn-whole-structure', phrase: 'Turn the whole structure together through a new angle' },
        { id: 'same-distance', phrase: 'The marked sites stay the same distance apart' },
      ],
    })),
  } };
  const validated = parsePlannedLesson(JSON.stringify(lesson), request);
  const pkg = buildSubtitlePackage(parseStoryline(validated.markdown));
  const cues = pkg.scenes.map((scene, i) => resolveSpeechCues(scene, validated.plan.scenes[i].speechCues!));
  return { request, lesson: validated, pkg, cues, landmarks, timingScope: 'Deterministic subtitle-reading estimates; no acoustic timing or spoken audio evidence.' };
}

const visibleState = (frame: Frame, ids: string[]) => ids.map(id => {
  const element = frame.elements.find(e => e.id === id);
  if (!element) return { id, missing: true };
  const { persistent: _persistent, transient: _transient, ...state } = element;
  return state;
});
const pose = (frame: Frame) => {
  const spatial = new SpatialFrame(frame);
  const origin = spatial.world('assembly');
  return { origin, basis: ([[1, 0, 0], [0, 1, 0], [0, 0, 1]] as Vec3[])
    .map(point => spatial.world('assembly', point).map((value, axis) => value - origin[axis]) as Vec3) };
};
const samePose = (a: ReturnType<typeof pose>, b: ReturnType<typeof pose>) => close(a.origin, b.origin)
  && a.basis.every((axis, i) => close(axis, b.basis[i]));
const cameras = (frame: Frame) => ({ camera: frame.camera,
  views: frame.views?.map(({ cameraAnimated: _animated, ...view }) => view) });

export async function runAnimationHoldout(trial: string) {
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(trial ?? '')) throw new Error('Use a fresh lowercase TRIAL name.');
  const parent = join(repo, 'data/animation-efficiency/holdout');
  await mkdir(parent, { recursive: true });
  const root = join(parent, trial);
  await mkdir(root); // EEXIST is deliberate: failed or interrupted trials are immutable.
  const videoId = randomUUID(), directory = join(root, videoId), resultPath = join(root, 'result.json');
  await mkdir(directory);
  const started = performance.now();
  let generationStarted: number | undefined;
  const result: Record<string, any> = { schemaVersion: 1, trial, videoId, directory, status: 'preparing',
    startedAt: new Date().toISOString(), elapsedMs: 0, generationElapsedMs: 0,
    timingScope: 'Subtitle-reading estimates. This run provides no acoustic synchronization evidence.',
    nativeVisualScope: 'Production native frame review, not continuous playback or interactive/orbit validation.',
    reviewRoundCap: 2, metrics: [], scenes: [], toolCalls: [] };
  await save(resultPath, result);
  const oldModelDirectory = process.env.MODEL_ASSET_DIR, oldCacheDirectory = process.env.BUNDLED_MODEL_CACHE_DIR;
  process.env.MODEL_ASSET_DIR = join(root, 'models');
  process.env.BUNDLED_MODEL_CACHE_DIR = join(root, 'prepared-bundled');
  try {
    result.revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8', windowsHide: true }).trim();
    const files = ['backend/bench/animation-holdout.ts', 'backend/src/agents/generator.ts', 'backend/src/agents/runtime.ts',
      'backend/src/agents/visual-gate.ts', 'backend/src/agents/visual-evidence.ts', 'backend/src/agents/timing-prelude.ts',
      'backend/src/agents/authoring-reference.ts', 'backend/src/visualization-resolver.ts', 'backend/src/bundled-models.ts',
      'backend/src/narration/subtitles.ts', 'backend/prompts/scene-craft.md', 'backend/prompts/scene-verify.md',
      'shared/animlib/docs/reference.md', 'shared/animlib/dist/core.js', 'shared/animlib/dist/compiler.js',
      'shared/animlib/dist/runtime.js', 'shared/animlib/dist/authoring.js', 'shared/animlib/src/spatial.ts'];
    result.sourceHashes = Object.fromEntries(await Promise.all(files.map(async file => [file, hash(await readFile(join(repo, file)))])));
    const structure = await json(join(repo, 'shared/animlib/fixtures/biological/1crn/structure.json')) as MolecularStructure;
    const landmarks = holdoutLandmarks(structure), store = new ModelAssets(), assets: Record<string, ModelAsset> = {};
    const preparer = createBundledModelPreparer({ directory: process.env.BUNDLED_MODEL_CACHE_DIR! });
    const preparationStarted = performance.now();
    let publications = 0;
    const resolver = createVisualizationResolver({ publishModel: async input => {
      publications++;
      const prepared = await preparer.prepare(input.fixtureId!);
      requireCheck(isDeepStrictEqual(prepared.context.origin, structure.center), 'landmark/model common origin mismatch');
      const scientific = prepared.context;
      const published = await store.publish(prepared.bytes, { source: scientific.provenance.source,
        license: scientific.provenance.license, attribution: scientific.provenance.creator, scientific });
      assets[published.id] = published.asset;
      await save(join(directory, 'model-assets.json'), assets);
      return { id: published.id, ...published.asset.metadata, context: describeBundledModel(scientific) };
    } });
    const selection = { catalogId: 'crambin-1crn', requiredCapabilities: ['model.static', 'model.named-parts'],
      selection: { fixtureId: '1crn-beads' }, prepare: true };
    const packets = await Promise.all(Array.from({ length: 4 }, () => resolver.resolve(selection, new AbortController().signal)));
    const modelId = packets[0].packageRefs[0].id, asset = assets[modelId];
    requireCheck(packets.every(packet => packet.status === 'ready' && packet.packageRefs[0].id === modelId), 'concurrent resolution changed model identity');
    requireCheck(publications === 1 && preparer.stats().conversions === 1, 'cold shared preparation/publication did not run exactly once');
    requireCheck(asset.sha256 === PINNED_GLB_HASH, 'pinned 1crn-beads GLB changed');
    const coldMs = performance.now() - preparationStarted;
    const fresh = createBundledModelPreparer({ directory: process.env.BUNDLED_MODEL_CACHE_DIR! });
    const reuseStart = performance.now(), reused = await fresh.prepare('1crn-beads');
    const diskReuseMs = performance.now() - reuseStart;
    requireCheck(fresh.stats().conversions === 0 && hash(reused.bytes) === asset.sha256, 'fresh preparer did not reuse exact persistent bytes');
    let separatePublications = 0;
    const separateRegistry: Record<string, ModelAsset> = {};
    const secondResolver = createVisualizationResolver({ publishModel: async () => {
      separatePublications++;
      const scientific = reused.context;
      const published = await store.publish(reused.bytes, { source: scientific.provenance.source,
        license: scientific.provenance.license, attribution: scientific.provenance.creator, scientific });
      separateRegistry[published.id] = published.asset;
      return { id: published.id, ...published.asset.metadata, context: describeBundledModel(scientific) };
    } });
    await secondResolver.resolve(selection, new AbortController().signal);
    requireCheck(separatePublications === 1 && !!separateRegistry[modelId], 'fresh job registry did not receive the reused model');
    await save(join(root, 'separate-job-model-assets.json'), separateRegistry);
    await save(join(root, 'resource-resolution.json'), packets[0]);
    result.preparation = { coldMs, diskReuseMs, publications, conversions: preparer.stats().conversions,
      freshPreparerConversions: fresh.stats().conversions, separatePublications, modelId,
      glbSha256: asset.sha256, provenanceSha256: asset.provenanceSha256, triangles: asset.metadata.triangles };
    const fixture = buildHoldoutFixture(modelId, landmarks);
    await save(join(root, 'fixture.json'), fixture);
    await save(join(directory, 'lesson.json'), { ...fixture.lesson, instructionVersion: 3 });
    await save(join(directory, 'subtitles.json'), fixture.pkg);
    result.fixtureHash = hash(JSON.stringify(fixture));
    result.packageHash = hash(JSON.stringify(fixture.pkg));
    result.structureHash = PINNED_STRUCTURE_HASH;
    result.cues = fixture.cues;
    const [{ createPiGenerator }, { PiAgentRunner }, { agentConfig }, { reviewGeneratedScene }, { NarrationService }] = await Promise.all([
      import('../src/agents/generator.js'), import('../src/agents/runtime.js'), import('../src/agents/config.js'), import('../src/agents/visual-gate.js'),
      import('../src/narration/service.js'),
    ]);
    const config = agentConfig(), pi = new PiAgentRunner(config);
    result.settings = { provider: config.provider, model: config.model, thinking: config.thinking,
      outputMode: 'validated-reference', timingMode: 'host', narrationMode: 'subtitles', allowWeb: false, sceneTimeoutMs: 900_000 };
    const runner: AgentRunner = { async run(task) {
      const index = result.metrics.length;
      const summary: { stage: string | undefined; scene: number | undefined; promptBytes: number; metrics?: AgentRunMetrics } = {
        stage: task.logContext?.stage, scene: task.logContext?.sceneIndex, promptBytes: Buffer.byteLength(task.systemPrompt + task.prompt) };
      result.metrics.push(summary);
      await writeFile(join(root, `task-${index}.prompt.md`), `${task.systemPrompt}\n\n${task.prompt}`);
      const resourceTools = task.resourceTools ? { ...task.resourceTools, async resolve(input: Parameters<typeof task.resourceTools.resolve>[0], signal: AbortSignal) {
        const began = performance.now();
        try {
          const packet = await task.resourceTools!.resolve(input, signal);
          result.toolCalls.push({ task: index, tool: 'resolve_visualization_resource', input, status: packet.status,
            packageIds: packet.packageRefs.map(ref => ref.id), elapsedMs: performance.now() - began });
          return packet;
        } catch (error) { result.toolCalls.push({ task: index, tool: 'resolve_visualization_resource', input, failed: true, elapsedMs: performance.now() - began }); throw error; }
      } } : undefined;
      try { return await pi.run({ ...task, allowWeb: false, resourceTools, onMetrics(value) { summary.metrics = value; task.onMetrics?.(value); } }); }
      finally { await save(join(root, `task-${index}.json`), summary); await save(resultPath, result); }
    } };
    // Subtitle mode never calls a speech provider. Fail if that contract changes.
    const unavailable = async (): Promise<never> => { throw new Error('Holdout must not call a narration provider.'); };
    const narration = Object.assign(new NarrationService({ root: join(root, 'unused-narration'), provider: {
      settings: { voiceId: 'holdout-no-audio', modelId: 'none', outputFormat: 'pcm_24000',
        voiceSettings: { stability: 0, similarity_boost: 0, style: 0, use_speaker_boost: false, speed: 1 } }, synthesize: unavailable,
    } }), { submit: unavailable, get: unavailable, retry: unavailable, scenePackage: unavailable, audio: unavailable });
    const generate = createPiGenerator(runner, narration, root, {
      outputMode: 'validated-reference', timingMode: 'host',
      visualGate: options => reviewGeneratedScene({ ...options, maxReviewRounds: 2 }),
    });
    result.status = 'running';
    await save(resultPath, result);
    generationStarted = performance.now();
    let previousFrame: Frame | undefined;
    for (let index = 0; index < fixture.pkg.scenes.length; index++) {
      const previous = previousFrame, scene = fixture.pkg.scenes[index], cueMap = fixture.cues[index];
      console.log(JSON.stringify({ event: 'holdout.scene.started', trial, index, directory }));
      const output = await generate(fixture.request, index, { owner: 'animation-efficiency-holdout', videoId,
        previousFrame: previous, signal: AbortSignal.timeout(900_000) });
      requireCheck(output, 'generator returned no scene');
      const receipt = await json(join(directory, `scene-${index}.visual-review.json`));
      requireCheck(receipt.approved && receipt.sourceSha256 === hash(output.scene.source), 'approval does not match exact returned source');
      const registered = await json(join(directory, 'model-assets.json')) as Record<string, ModelAsset>;
      requireCheck(registered[modelId]?.sha256 === PINNED_GLB_HASH, 'job lost the pinned asset registration');
      await store.forRendering(registered); // Hash-check actual local GLB delivery bytes, not metadata alone.
      const models = Object.fromEntries(Object.entries(registered).map(([id, value]) => [id, value.metadata]));
      const motion = cueMap[index ? 'slide-whole-structure' : 'turn-whole-structure'];
      const times = [...new Set([0, scene.durationSec, ...Object.values(cueMap).flatMap(cue => [Math.max(0, cue.startSec - .001), cue.startSec, (cue.startSec + cue.endSec) / 2, cue.endSec]),
        ...scene.pauses.flatMap(pause => [pause.startSec, (pause.startSec + pause.endSec) / 2, pause.endSec])])].sort((a, b) => a - b);
      const checks = await withOfflineScene(output.scene.source, { previous, models }, async sampler => {
        const frames = new Map(times.map(time => [time, sampler.sample(time)]));
        await save(join(root, `scene-${index}.sampled-frames.json`), Object.fromEntries(frames));
        for (const time of [...times].reverse().concat(times.filter((_, i) => i % 2 === 0))) {
          requireCheck(isDeepStrictEqual(frames.get(time), sampler.sample(time)), `seek changed frame at ${time}`);
        }
        const initial = frames.get(0)!, final = frames.get(scene.durationSec)!;
        const firstModels = initial.elements.filter(element => element.geometry.model);
        requireCheck(firstModels.length === asset.metadata.primitives.length && firstModels.every(element => element.geometry.model!.asset === modelId), 'expected exactly one full instance of the pinned model');
        requireCheck(['protein', 'assembly'].every(id => initial.elements.some(element => element.id === id)), 'stable protein/assembly root missing');
        const original = new Map(firstModels.map(element => [element.id, element.geometry]));
        const baseline = new SpatialFrame(initial);
        const probes = (element: typeof firstModels[number]): Vec3[] => {
          const { min, max } = element.geometry.model!.bounds;
          return [min, [max[0], min[1], min[2]], [min[0], max[1], min[2]], [min[0], min[1], max[2]]];
        };
        const relative = new Map(firstModels.map(element => [element.id,
          probes(element).map(point => baseline.local('protein', baseline.world(element.id, point)))]));
        let maxMarkerError = 0, maxInternalPoseError = 0;
        for (const [time, frame] of frames) {
          const spatial = new SpatialFrame(frame);
          requireCheck(isDeepStrictEqual(cameras(initial), cameras(frame)), `camera changed during the fixed-view scene at ${time}`);
          requireCheck(isDeepStrictEqual(frame.elements.filter(element => element.geometry.model).map(element => element.id), firstModels.map(element => element.id)), `model instance/primitive set changed at ${time}`);
          for (const element of firstModels) {
            const actual = spatial.elements.get(element.id);
            requireCheck(actual && isDeepStrictEqual(actual.geometry, original.get(element.id)), `model primitive identity/geometry changed at ${time}`);
            for (const [i, point] of probes(element).entries()) maxInternalPoseError = Math.max(maxInternalPoseError,
              distance(relative.get(element.id)![i], spatial.local('protein', spatial.world(element.id, point))));
            requireCheck(isDeepStrictEqual(actual.rotation, element.rotation) && actual.scale === element.scale, `a model primitive changed local shape pose at ${time}`);
          }
          for (const [i, id] of ['marker-a', 'marker-b'].entries()) {
            requireCheck(spatial.elements.has(id), `stable landmark ${id} missing`);
            maxMarkerError = Math.max(maxMarkerError, distance(spatial.world(id), spatial.world('protein', landmarks[i].localPosition)));
          }
        }
        requireCheck(maxMarkerError < 1e-5 && maxInternalPoseError < 1e-5, 'markers detached or model parts moved internally');
        const startPose = pose(frames.get(motion.startSec)!), endPose = pose(frames.get(motion.endSec)!);
        const scale = (p: ReturnType<typeof pose>) => p.basis.map(axis => Math.hypot(...axis));
        for (const [time, frame] of frames) {
          const current = pose(frame);
          requireCheck(scale(startPose).every((value, axis) => Math.abs(value - scale(current)[axis]) < 1e-6), `display scale changed at ${time}`);
          if (time <= motion.startSec) requireCheck(samePose(current, startPose), `assembly moved before cue at ${time}`);
          if (time >= motion.endSec) requireCheck(samePose(current, endPose), `assembly moved after cue at ${time}`);
          if (index === 0) requireCheck(close(current.origin, startPose.origin), `turn cue translated its pivot at ${time}`);
          else requireCheck(current.basis.every((axis, i) => close(axis, startPose.basis[i])), `slide cue changed orientation at ${time}`);
        }
        for (const pause of scene.pauses) {
          const before = frames.get(pause.startSec)!;
          const ids = before.elements.map(element => element.id);
          for (const time of [(pause.startSec + pause.endSec) / 2, pause.endSec]) {
            const frame = frames.get(time)!;
            requireCheck(isDeepStrictEqual(visibleState(before, ids), visibleState(frame, ids))
              && isDeepStrictEqual(before.camera, frame.camera), `explicit pause changed at ${time}`);
          }
        }
        requireCheck(samePose(pose(initial), startPose), 'protein moved before the named motion cue');
        requireCheck(samePose(endPose, pose(final)), 'protein moved after the named motion cue');
        if (index === 0) {
          requireCheck(close(startPose.origin, endPose.origin), 'turn cue unexpectedly translated protein');
          requireCheck(startPose.basis.some((axis, i) => distance(axis, endPose.basis[i]) > .05), 'turn cue produced no meaningful rotation');
          requireCheck([...frames.values()].some(frame => frame.elements.some(element => element.id === 'turn-indicator/ribbon'
            && element.geometry.kind === 'mesh' && (element.geometry.vertices?.length ?? 0) >= 12 && (element.geometry.triangles?.length ?? 0) >= 8)), 'custom triangulated turn ribbon missing');
        } else {
          requireCheck(distance(startPose.origin, endPose.origin) > .1, 'slide cue produced no meaningful translation');
          requireCheck(startPose.basis.every((axis, i) => close(axis, endPose.basis[i])), 'slide cue changed orientation');
        }
        let retainedIds: string[] = [];
        if (previous) {
          retainedIds = previous.elements.filter(element => element.persistent).map(element => element.id);
          requireCheck(isDeepStrictEqual(visibleState(previous, retainedIds), visibleState(initial, retainedIds)), 'retained state jumped at scene boundary');
          requireCheck(isDeepStrictEqual(cameras(previous), cameras(initial)), 'camera jumped at scene boundary');
        }
        const inspection = await inspectScene({ source: output.scene.source, compiled: sampler.scene, previous, models },
          { times: times.slice(0, 24), objectIds: ['protein', 'marker-a', 'marker-b', 'distance-brace'], includeAnimating: true });
        previousFrame = structuredClone(final);
        await save(join(root, `scene-${index}.inspection.json`), inspection);
        return { times, deterministicSeek: true, maxMarkerError, maxInternalPoseError, retainedIds,
          modelPrimitiveCount: firstModels.length, cueMotionChecked: motion, advisoryWarnings: inspection.warnings.length };
      });
      result.scenes.push({ index, sourceSha256: hash(output.scene.source), sourceBytes: Buffer.byteLength(output.scene.source),
        approvedAttempt: receipt.attempt, checks, nativeEvidenceReceipt: join(directory, `scene-${index}.visual-review.json`) });
      result.generationElapsedMs = performance.now() - generationStarted;
      await save(resultPath, result);
    }
    result.status = 'complete';
    result.acceptance = 'Exact-source native review and deterministic spatial/cue/carry checks passed; continuous playback and acoustic review remain outside this fixture.';
  } catch (error) {
    result.status = 'failed';
    result.error = { code: (error as { code?: unknown })?.code ?? 'HOLDOUT', message: error instanceof Error ? error.message : String(error) };
  } finally {
    if (oldModelDirectory === undefined) delete process.env.MODEL_ASSET_DIR; else process.env.MODEL_ASSET_DIR = oldModelDirectory;
    if (oldCacheDirectory === undefined) delete process.env.BUNDLED_MODEL_CACHE_DIR; else process.env.BUNDLED_MODEL_CACHE_DIR = oldCacheDirectory;
    result.elapsedMs = performance.now() - started;
    if (generationStarted !== undefined) result.generationElapsedMs = performance.now() - generationStarted;
    result.finishedAt = new Date().toISOString();
    result.tokenTotals = result.metrics.reduce((sum: Record<string, number>, task: { metrics?: AgentRunMetrics }) => {
      for (const turn of task.metrics?.turns ?? []) for (const key of ['inputTokens', 'outputTokens', 'cacheReadTokens', 'cacheWriteTokens'] as const) sum[key] += turn[key];
      return sum;
    }, { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 });
    await save(resultPath, result);
  }
  console.log(JSON.stringify({ trial, status: result.status, elapsedMs: result.elapsedMs, resultPath, error: result.error }));
  return result;
}

if (import.meta.main) {
  const result = await runAnimationHoldout(process.argv[2]);
  if (result.status !== 'complete') process.exitCode = 1;
}

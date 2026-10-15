/** Reassess approved scene 0 without generation, rendering, or writes inside the historical trial.
 * bun backend/bench/animation-holdout-assess.ts TRIAL ASSESSMENT_NAME
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { withOfflineScene } from 'animlib/core';
import type { Frame, ModelAsset } from 'animlib/core';
import { ModelAssets } from '../src/model-assets.js';
import { checkHoldoutFrames, holdoutLandmarks, loadHoldoutModelGeometry } from './animation-holdout.js';

const repo = resolve(import.meta.dir, '../..');
const hash = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
const requireMatch = (condition: unknown, message: string) => { if (!condition) throw new Error(`Holdout assessment: ${message}`); };
type ContinuationInputs = Record<'source' | 'assets' | 'fixture' | 'boundaryFrame', string>;

/** A continuation must validate these exact bytes against the separate assessment, before copying or generation. */
export function verifyHoldoutContinuationInputs(expected: ContinuationInputs, inputs: ContinuationInputs): void {
  for (const key of ['source', 'assets', 'fixture', 'boundaryFrame'] as const)
    requireMatch(hash(inputs[key]) === expected[key], `${key} drift from assessed input`);
}

export async function assessAnimationHoldoutScene(trial: string) {
  requireMatch(/^[a-z0-9][a-z0-9-]{0,63}$/.test(trial), 'invalid trial name');
  const root = join(repo, 'data/animation-efficiency/holdout', trial);
  const resultText = await readFile(join(root, 'result.json'), 'utf8'), historical = JSON.parse(resultText);
  requireMatch(/^[a-f0-9-]{36}$/.test(historical.videoId), 'invalid historical job ID');
  const directory = join(root, historical.videoId);
  const paths = { source: join(directory, 'scene-0.subtitles.js'), assets: join(directory, 'model-assets.json'),
    fixture: join(root, 'fixture.json'), boundaryFrame: join(directory, 'scene-0.final-frame.json') };
  const inputs = Object.fromEntries(await Promise.all(Object.entries(paths).map(async ([key, path]) => [key, await readFile(path, 'utf8')]))) as ContinuationInputs;
  const inputHashes = Object.fromEntries(Object.entries(inputs).map(([key, value]) => [key, hash(value)])) as ContinuationInputs;
  const fixture = JSON.parse(inputs.fixture), assets = JSON.parse(inputs.assets) as Record<string, ModelAsset>;
  const reviewText = await readFile(join(directory, 'scene-0.visual-review.json'), 'utf8'), review = JSON.parse(reviewText);
  requireMatch(review.approved && review.sourceSha256 === inputHashes.source && hash(review.source) === inputHashes.source,
    'approved source hash mismatch');
  requireMatch(hash(JSON.stringify(fixture)) === historical.fixtureHash, 'frozen fixture drift');
  requireMatch(hash(JSON.stringify(fixture.pkg)) === historical.packageHash, 'frozen subtitle package drift');
  requireMatch(isDeepStrictEqual(fixture.cues, historical.cues), 'frozen cue drift');
  requireMatch(isDeepStrictEqual(JSON.parse(await readFile(join(directory, 'subtitles.json'), 'utf8')), fixture.pkg), 'saved subtitle package drift');
  const structure = JSON.parse(await readFile(join(repo, 'shared/animlib/fixtures/biological/1crn/structure.json'), 'utf8'));
  const landmarks = holdoutLandmarks(structure);
  requireMatch(isDeepStrictEqual(landmarks, fixture.landmarks), 'pinned landmark drift');
  // The checker is intentionally corrected; generation and compilation dependencies must still be frozen.
  for (const [path, expected] of Object.entries(historical.sourceHashes)) {
    if (path === 'backend/bench/animation-holdout.ts') continue;
    requireMatch(hash(await readFile(join(repo, path))) === expected, `frozen dependency drift: ${path}`);
  }
  const modelId = historical.preparation.modelId;
  requireMatch(assets[modelId]?.sha256 === historical.preparation.glbSha256, 'pinned registration drift');
  const geometry = await loadHoldoutModelGeometry(await new ModelAssets(join(root, 'models')).forRendering(assets));
  const models = Object.fromEntries(Object.entries(assets).map(([id, asset]) => [id, asset.metadata]));
  const samplesText = await readFile(join(root, 'scene-0.sampled-frames.json'), 'utf8');
  const samples = JSON.parse(samplesText) as Record<string, Frame>;
  const frames = new Map(Object.entries(samples).map(([time, frame]) => [Number(time), frame]));
  const scene = fixture.pkg.scenes[0];
  const boundary = JSON.parse(inputs.boundaryFrame) as Frame;
  const checks = await withOfflineScene(inputs.source, { models }, async sampler => {
    for (const time of [...frames.keys()].reverse().concat([...frames.keys()]))
      requireMatch(isDeepStrictEqual(sampler.sample(time), frames.get(time)), `saved sample or seek drift at ${time}`);
    requireMatch(isDeepStrictEqual(sampler.sample(scene.durationSec), boundary), 'saved boundary frame drift');
    return checkHoldoutFrames({ frames, source: inputs.source, modelId, metadata: assets[modelId].metadata, modelGeometry: geometry,
      landmarks, scene, motion: fixture.cues[0]['turn-whole-structure'], kind: 'turn' });
  });
  verifyHoldoutContinuationInputs(inputHashes, Object.fromEntries(await Promise.all(Object.entries(paths)
    .map(async ([key, path]) => [key, await readFile(path, 'utf8')]))) as ContinuationInputs);
  requireMatch(await readFile(join(root, 'result.json'), 'utf8') === resultText, 'historical result changed during assessment');
  return { schemaVersion: 1, kind: 'corrected-checker-assessment', assessedAt: new Date().toISOString(),
    trial, historicalStatus: historical.status, historicalResultSha256: hash(resultText), historicalRevision: historical.revision,
    checkerRevision: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8', windowsHide: true }).trim(),
    checkerHashes: Object.fromEntries(await Promise.all(['backend/bench/animation-holdout.ts', 'backend/bench/animation-holdout-assess.ts']
      .map(async path => [path, hash(await readFile(join(repo, path)))]))),
    sceneIndex: 0, status: 'passed', fullHoldoutComplete: false, approvedAttempt: review.attempt,
    inputPaths: paths, inputHashes, fixtureHash: historical.fixtureHash, packageHash: historical.packageHash,
    nativeReviewReceiptSha256: hash(reviewText), sampledFramesSha256: hash(samplesText),
    assets: Object.fromEntries(Object.entries(assets).map(([id, asset]) => [id, { sha256: asset.sha256, primitives: asset.metadata.primitives.length }])),
    deterministicSeek: true, checks,
    scope: 'Corrected deterministic checks on the unchanged approved source and stored frames; no new generation, native rendering, or acoustic evidence.',
    continuation: { nextSceneIndex: 1, requiredInputHashes: inputHashes,
      rule: 'Use a fresh labeled continuation directory; verify these hashes, copy the approved source, registry, frozen fixture/package, and exact final frame, then generate only scene 1. Keep original trial result and timings unchanged; report new scene timing separately.' } };
}

if (import.meta.main) {
  const [trial, name] = process.argv.slice(2);
  requireMatch(/^[a-z0-9][a-z0-9-]{0,95}$/.test(name ?? ''), 'use a fresh lowercase assessment name');
  const assessment = await assessAnimationHoldoutScene(trial);
  const directory = join(repo, 'data/animation-efficiency/holdout-assessments');
  await mkdir(directory, { recursive: true });
  const path = join(directory, `${name}.json`);
  await writeFile(path, JSON.stringify(assessment, null, 2), { flag: 'wx' });
  console.log(JSON.stringify({ status: assessment.status, sceneIndex: 0, fullHoldoutComplete: false, path, checks: assessment.checks }));
}

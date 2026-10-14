import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('package includes full animation tree, original engine and player, but no credentials or job data', async () => {
  const { includeRuntimeFile } = await import('../scripts/package.mjs');
  for (const file of ['shared/animlib/src/renderer.ts', 'shared/animlib/fixtures/custom/model.glb', 'shared/animlib/docs/reference.md', 'shared/animlib/demo/proofs/data/dna.json',
    'shared/animlib/tools/render-video.mjs', 'shared/video/contract.ts', 'backend/src/agents/generator.ts', 'backend/prompts/scene-verify.md',
    'frontend/app/src/LessonPlayer.tsx', 'frontend/site/assets/player.js', 'scenegen/prompts/planning.md', 'package-lock.json']) assert.ok(includeRuntimeFile(file), file);
  for (const file of ['backend/.env.local', 'backend/data/videos.sqlite', 'backend/.narration/job.json', 'node_modules/pkg/index.js',
    'backend/auth.json', 'backend/private.pem', '.git/config', 'exports/private.mp4', 'backend/.env.production',
    'shared/animlib/node_modules/secret', '../auth.json', '/backend/src/index.ts']) assert.equal(includeRuntimeFile(file), false, file);
});

test('every tracked file in the full animation library is included', async () => {
  const { includeRuntimeFile } = await import('../scripts/package.mjs');
  const repo = fileURLToPath(new URL('../..', import.meta.url));
  // This repository test pins packaging completeness; installed packages have no Git checkout.
  const tracked = execFileSync('git', ['ls-files', '-z', 'shared/animlib'], { cwd: repo, encoding: 'utf8' }).split('\0').filter(Boolean);
  assert.ok(tracked.length > 1000);
  assert.deepEqual(tracked.filter(path => !includeRuntimeFile(path)), []);
});

test('source integrity checks original bytes and catches changed or missing assets', async () => {
  const { writeIntegrity, verifyIntegrity } = await import('../scripts/package.mjs');
  const dir = await mkdtemp(join(tmpdir(), 'aha-integrity-'));
  try {
    await mkdir(join(dir, 'shared'), { recursive: true });
    await writeFile(join(dir, 'shared/model.glb'), Buffer.from([0, 255, 13, 10]));
    await writeIntegrity(dir, ['shared/model.glb'], 'test-revision');
    assert.equal((await verifyIntegrity(dir)).ok, true);
    await writeFile(join(dir, 'shared/model.glb'), 'changed');
    assert.equal((await verifyIntegrity(dir)).ok, false);
    await rm(join(dir, 'shared/model.glb'));
    assert.equal((await verifyIntegrity(dir)).ok, false);
    const manifest = JSON.parse(await readFile(join(dir, 'source-integrity.json'), 'utf8'));
    assert.equal(manifest.revision, 'test-revision');
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('distribution verification includes the actual generated chat UI', async () => {
  const { writeIntegrity, verifyDistribution } = await import('../scripts/package.mjs');
  const dir = await mkdtemp(join(tmpdir(), 'aha-ui-integrity-'));
  await mkdir(join(dir, 'runtime'));
  await mkdir(join(dir, 'dist'));
  await writeFile(join(dir, 'runtime/engine.ts'), 'original engine');
  await writeFile(join(dir, 'dist/player.html'), 'original chat player');
  await writeIntegrity(join(dir, 'runtime'), ['engine.ts'], 'test');
  await writeIntegrity(dir, [], 'test', ['dist/player.html']);
  assert.equal((await verifyDistribution(dir)).ok, true);
  await writeFile(join(dir, 'dist/player.html'), 'changed');
  assert.equal((await verifyDistribution(dir)).ok, false);
  await rm(join(dir, 'dist/player.html'));
  assert.equal((await verifyDistribution(dir)).ok, false);
});

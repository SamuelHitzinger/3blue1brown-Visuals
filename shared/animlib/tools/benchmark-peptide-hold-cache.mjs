/** Bounded authored-scene optimization, not a generic pose cache.
 * From repository root after building:
 * node shared/animlib/tools/benchmark-peptide-hold-cache.mjs [output.json]
 * Requires the generated, preserved revision-3 source and manifest.
 */
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { withOfflineScene } from '../dist/core.js';
import { loadAssetRegistry } from './load-assets.mjs';

const directory = resolve('data/animlib-expansion/biological-motion-revision3');
const manifest = JSON.parse(await readFile(resolve(directory, 'peptide-manifest.json'), 'utf8'));
const original = await readFile(resolve(directory, 'peptide.js'), 'utf8');
const marker = 'const sample=t=>{if(previous===t)return cached;previous=t;';
const replacement = 'const sample=t=>{t=Math.min(t,7);if(previous===t)return cached;previous=t;';
assert.equal(original.split(marker).length, 2, 'expected one known revision-3 geometry cache');
const optimized = original.replace(marker, replacement);
const registry = await loadAssetRegistry(manifest.modelAssets, { colorPolicy: 'source' });
const sha = text => createHash('sha256').update(text).digest('hex');
const boundaryTimes = [0, .4, 3.1, 4.2, 6.5, 6.6, 4.2 + 2.4, 6.999999999999999, 7, 7.000000000000001, 7.4, 7.8, 8.2, 10];
const times = [...new Set([...Array.from({ length: 101 }, (_, i) => i / 10), ...boundaryTimes])].sort((a, b) => a - b);
const hashes = new Map();
const percentile = (values, fraction) => [...values].sort((a, b) => a - b)[Math.ceil(values.length * fraction) - 1];
const run = async (source, baseline) => withOfflineScene(source, { palette: manifest.palette }, async sampler => {
  // Every frame property is compared, including hidden geometry, camera and opacity.
  // Revisit each time from the opposite direction and after an unrelated early seek.
  for (const time of times) {
    const hash = sha(JSON.stringify(sampler.sample(time)));
    if (baseline) hashes.set(time, hash);
    else assert.equal(hash, hashes.get(time), `forward frame parity at ${time}`);
  }
  for (const time of [...times].reverse()) {
    sampler.sample(.23);
    assert.equal(sha(JSON.stringify(sampler.sample(time))), hashes.get(time), `direct/reverse frame parity at ${time}`);
  }
}, { modelAssets: registry });

await run(original, true);
await run(optimized, false);
const before = {}, after = {};
// Keep both contexts live and alternate which is measured first for each time.
// This reduces run-order bias; wall time still includes host scheduling and GC.
await withOfflineScene(original, { palette: manifest.palette }, async baseline =>
  withOfflineScene(optimized, { palette: manifest.palette }, async candidate => {
    for (const [phase, start, end] of [['moving', 4.3, 6.4], ['settled-visible', 7.1, 8.1], ['surface-only', 8.3, 9.9]]) {
      const probes = Array.from({ length: 31 }, (_, i) => start + (end - start) * i / 30);
      for (const time of probes.slice(0, 5)) { baseline.sample(time); candidate.sample(time); }
      const readings = [[], []], lengths = [[], []], samplers = [baseline, candidate];
      for (let repeat = 0; repeat < 3; repeat++) for (const [index, time] of probes.entries()) {
        const order = (repeat + index) % 2 ? [1, 0] : [0, 1];
        for (const which of order) {
          const begin = performance.now();
          const text = JSON.stringify(samplers[which].sample(time));
          readings[which].push(performance.now() - begin);
          lengths[which].push(text.length);
        }
      }
      for (const [which, output] of [before, after].entries()) output[phase] = {
        samples: readings[which].length, medianMs: percentile(readings[which], .5),
        p95Ms: percentile(readings[which], .95), maxFrameStringUnits: Math.max(...lengths[which]),
      };
    }
  }, { modelAssets: registry }), { modelAssets: registry });
const result = {
  scope: 'revision-3 authored source; interleaved frame evaluation plus JSON serialization, no render/GPU timing',
  sourceHashes: { original: sha(original), optimized: sha(optimized) },
  transform: { marker, replacement },
  parity: { distinctTimes: times.length, forwardAndDirectReverseChecks: times.length * 3, completeFrames: 'exact SHA-256 equality', times },
  before, after, finalRegistryStats: registry.stats(),
};
assert.equal(result.finalRegistryStats.leases, 0);
assert.equal(result.finalRegistryStats.pinnedBytes, 0);
if (process.argv[2]) await writeFile(resolve(process.argv[2]), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));

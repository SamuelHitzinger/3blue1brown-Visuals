import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { compileSource } from '../../shared/animlib/dist/core.js';

const sourcePath = resolve(process.argv[2]);
const source = await readFile(sourcePath, 'utf8');
const results = [];
for (const executionLimitMs of [200, 200, 1000]) {
  const start = performance.now();
  try {
    const compiled = await compileSource(source, {}, { executionLimitMs });
    results.push({ executionLimitMs, success: true, elapsedMs: performance.now() - start,
      duration: compiled.duration });
  } catch (error) {
    results.push({ executionLimitMs, success: false, elapsedMs: performance.now() - start,
      error: error.message, diagnostic: error.diagnostic });
  }
}
const result = { sourcePath, runtime: process.version, results,
  boundary: 'Diagnostic compilation of untouched generated source. The 1000ms diagnostic is not a changed production gate, published scene or successful full pipeline trial.' };
const output = join(dirname(sourcePath), 'node-compile-diagnostic.json');
await writeFile(output, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));

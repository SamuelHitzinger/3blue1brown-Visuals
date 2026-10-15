/** Render exact completed probe outputs. Never repair or strip model output. */
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, join, basename } from 'node:path';
import { createHash } from 'node:crypto';
import { SourceCompiler } from '../../shared/animlib/src/compiler-client.js';
import { evaluateScene } from '../../shared/animlib/src/timeline.js';
import { renderSceneFrames } from '../src/agents/frame-renderer.js';
import { lowerOperations } from './realtime-probe/lower.js';

Object.defineProperty(globalThis, 'Worker', { configurable: true, writable: true, value: undefined });
if (process.argv.length < 3) throw new Error('Pass one or more completed create-probe directories.');
const root = resolve('data/realtime-workshop/rendered', new Date().toISOString().replaceAll(':', '-'));
await mkdir(root, { recursive: true });
const reports: unknown[] = [];
for (const input of process.argv.slice(2)) {
  const directory = resolve(input), name = basename(directory), compiler = new SourceCompiler();
  const report: Record<string, unknown> = { name, directory, evidenceKind: 'offline-render-only',
    limitation: 'Offline rendering excludes media ingestion and model latency. This is not a live presentation or quality verdict.' };
  try {
    const meta = JSON.parse(await readFile(join(directory, 'result.json'), 'utf8'));
    if (meta.status !== 'complete' || meta.action !== 'create') throw new Error('Requires a complete create response.');
    const raw = await readFile(join(directory, 'output.txt'), 'utf8');
    const sha = createHash('sha256').update(raw).digest('hex');
    if (sha !== meta.sourceSha256) throw new Error('Recorded output hash mismatch.');
    const source = meta.format === 'ops' ? lowerOperations(raw) : raw;
    report.rawSha256 = sha;
    const start = performance.now();
    const scene = await compiler.compile(source);
    report.compileMs = performance.now() - start;
    report.duration = scene.duration;
    if (!(scene.duration > 0) || scene.duration > 300) throw new Error('Invalid probe duration.');
    const times = [0, scene.duration / 4, scene.duration / 2, scene.duration * 3 / 4, scene.duration];
    report.elementCounts = times.map(t => evaluateScene(scene, t).elements.length);
    const renderStart = performance.now();
    report.evidence = await renderSceneFrames({ source, times, directory: join(root, name), signal: AbortSignal.timeout(30_000) });
    report.renderProcessMs = performance.now() - renderStart;
    report.status = 'rendered';
  } catch (error) {
    report.status = 'failed';
    report.error = error instanceof Error ? error.message : String(error);
  } finally { compiler.dispose(); }
  reports.push(report);
  console.log(JSON.stringify(report));
}
await writeFile(join(root, 'result.json'), JSON.stringify(reports, null, 2), { flag: 'wx' });
console.log(JSON.stringify({ report: join(root, 'result.json') }));

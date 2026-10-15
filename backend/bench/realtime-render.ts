/** Render exact completed probe outputs. Never repair or strip model output. */
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, join, basename } from 'node:path';
import { createHash } from 'node:crypto';
import { SourceCompiler } from '../../shared/animlib/src/compiler-client.js';
import { evaluateScene } from '../../shared/animlib/src/timeline.js';
import { renderSceneFrames } from '../src/agents/frame-renderer.js';
import { lowerOperations } from './realtime-probe/lower.js';

/** Select the recorded artifact, never prose, a fallback file, or a repaired source. */
export async function loadProbeSource(directory: string) {
  const metadataBytes = await readFile(join(directory, 'result.json'));
  const meta = JSON.parse(metadataBytes.toString('utf8'));
  if (meta.status !== 'complete' || meta.action !== 'create') throw new Error('Requires a complete create response.');
  const structured = meta.evidenceKind === 'single-structured-model-submission';
  if (structured) {
    if (meta.schemaVersion !== 1 || meta.kind !== 'scene' || meta.format !== 'native-js'
      || meta.providerComplete !== true || meta.submissionAccepted !== true || meta.completedToolCalls !== 1) {
      throw new Error('Requires an accepted, complete structured scene submission.');
    }
  } else if (meta.evidenceKind !== 'model-stream-only' || !['native-js', 'ops'].includes(meta.format)) {
    throw new Error('Unsupported probe evidence kind or source format.');
  }
  const sourceFilename = structured ? 'source.js' : 'output.txt';
  const bytes = await readFile(join(directory, sourceFilename));
  const rawSha256 = createHash('sha256').update(bytes).digest('hex');
  if (rawSha256 !== (structured ? meta.submissionSha256 : meta.sourceSha256)) throw new Error('Recorded output hash mismatch.');
  if (structured && bytes.length !== meta.submissionBytes) throw new Error('Recorded submission byte count mismatch.');
  const raw = bytes.toString('utf8');
  if (!Buffer.from(raw).equals(bytes)) throw new Error('Source artifact is not valid UTF-8.');
  return { source: meta.format === 'ops' ? lowerOperations(raw) : raw, rawSha256, sourceFilename,
    sourceEvidenceKind: meta.evidenceKind as string,
    probeResultSha256: createHash('sha256').update(metadataBytes).digest('hex') };
}

export async function main(inputs = process.argv.slice(2)) {
Object.defineProperty(globalThis, 'Worker', { configurable: true, writable: true, value: undefined });
if (!inputs.length) throw new Error('Pass one or more completed create-probe directories.');
const root = resolve('data/realtime-workshop/rendered', new Date().toISOString().replaceAll(':', '-'));
await mkdir(root, { recursive: true });
const reports: unknown[] = [];
for (const input of inputs) {
  const directory = resolve(input), name = basename(directory), compiler = new SourceCompiler();
  const report: Record<string, unknown> = { name, directory, evidenceKind: 'offline-render-only',
    limitation: 'Offline rendering excludes media ingestion and model latency. This is not a live presentation or quality verdict.' };
  try {
    const { source, ...provenance } = await loadProbeSource(directory);
    Object.assign(report, provenance);
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
}

if (import.meta.main) await main();

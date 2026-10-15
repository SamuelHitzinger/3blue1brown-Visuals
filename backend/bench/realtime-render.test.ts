import { expect, test } from 'bun:test';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { loadProbeSource } from './realtime-render.js';

const source = '\n// exact source, including whitespace\nexport default scene({}, s => { s.wait(1); });\n';
const sha = (text: string) => createHash('sha256').update(text).digest('hex');
const structured = { schemaVersion: 1, evidenceKind: 'single-structured-model-submission', status: 'complete',
  kind: 'scene', format: 'native-js', action: 'create', providerComplete: true, submissionAccepted: true,
  completedToolCalls: 1, submissionSha256: sha(source), submissionBytes: Buffer.byteLength(source) };
async function fixture(metadata: unknown, filename: string, text = source) {
  const directory = await mkdtemp(join(tmpdir(), 'aha-render-input-'));
  await writeFile(join(directory, 'result.json'), JSON.stringify(metadata));
  await writeFile(join(directory, filename), text);
  return directory;
}

test('structured renderer input preserves exact accepted source and its recorded provenance', async () => {
  const directory = await fixture(structured, 'source.js');
  await writeFile(join(directory, 'output.txt'), 'unrelated prose must never become source');
  const loaded = await loadProbeSource(directory);
  expect(loaded.source).toBe(source);
  expect(loaded.rawSha256).toBe(structured.submissionSha256);
  expect(loaded.sourceFilename).toBe('source.js');
  expect(loaded.sourceEvidenceKind).toBe(structured.evidenceKind);
});

test('structured input requires successful accepted scene metadata and rejects briefing or editing runs', async () => {
  for (const patch of [{ status: 'failed' }, { providerComplete: false }, { submissionAccepted: false },
    { completedToolCalls: 2 }, { kind: 'brief' }, { format: 'causal-brief' }, { action: 'edit' },
    { schemaVersion: 2 }, { submissionSha256: undefined }, { submissionBytes: undefined }]) {
    const directory = await fixture({ ...structured, ...patch }, 'source.js');
    await expect(loadProbeSource(directory)).rejects.toThrow();
  }
});

test('changed source or byte count fails without falling back to raw output', async () => {
  const directory = await fixture(structured, 'source.js', source + '// changed');
  await writeFile(join(directory, 'output.txt'), source);
  await expect(loadProbeSource(directory)).rejects.toThrow('hash mismatch');
  await expect(loadProbeSource(await fixture({ ...structured, submissionBytes: 1 }, 'source.js'))).rejects.toThrow('byte count mismatch');
  await expect(loadProbeSource(await fixture(structured, 'output.txt'))).rejects.toThrow();
});

test('original raw native and ops probes keep their exact hash checks and lowering behavior', async () => {
  const raw = { evidenceKind: 'model-stream-only', status: 'complete', action: 'create', format: 'native-js', sourceSha256: sha(source) };
  expect((await loadProbeSource(await fixture(raw, 'output.txt'))).source).toBe(source);
  await expect(loadProbeSource(await fixture(raw, 'output.txt', source + ' '))).rejects.toThrow('hash mismatch');
  const ops = '{"op":"scene","mode":"2d","end":"hold"}\n{"op":"wait","duration":1}\n{"op":"commit"}';
  const loaded = await loadProbeSource(await fixture({ ...raw, format: 'ops', sourceSha256: sha(ops) }, 'output.txt', ops));
  expect(loaded.source).toContain('export default scene');
  expect(loaded.rawSha256).toBe(sha(ops));
  expect(loaded.sourceFilename).toBe('output.txt');
  await expect(loadProbeSource(await fixture({ ...raw, format: 'unknown' }, 'output.txt'))).rejects.toThrow();
});

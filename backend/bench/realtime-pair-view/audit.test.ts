import { expect, test } from 'bun:test';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { loadPair } from '../realtime-pair-view.js';

const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const brief = { claim: 'One narrow claim', basis: 'E1', operation: 'Compare two positions', objects: [], uncertainty: '' };
const briefText = JSON.stringify(brief, null, 2);
async function pair() {
  const root = await mkdtemp(join(tmpdir(), 'aha-pair-'));
  const dirs = ['baseline', 'candidate', 'brief'].map(name => join(root, name));
  for (const [index, directory] of dirs.entries()) {
    await mkdir(directory);
    const isBrief = index === 2, source = isBrief ? briefText : 'export default scene({}, s => { s.wait(8); });';
    const prompts = { systemPrompt: index === 0 ? 'ordinary' : 'compact', prompt: isBrief ? 'Evidence E1' : `Evidence E1\n${briefText}` };
    const meta = { schemaVersion: 1, evidenceKind: 'single-structured-model-submission', kind: isBrief ? 'brief' : 'scene',
      format: isBrief ? 'causal-brief' : 'native-js', action: 'create', status: 'complete', providerComplete: true,
      submissionAccepted: true, completedToolCalls: 1, submissionSha256: hash(source), submissionBytes: Buffer.byteLength(source),
      promptSha256: hash(JSON.stringify(prompts)), image: null, model: 'same-model', provider: 'openai-codex',
      thinkingRequested: 'low', serviceTierRequested: 'priority', strictRequested: 'require', maxTokensRequested: 4096,
      timeoutMs: 30000, maxRetries: 0, transportRequested: 'sse', toolSchemaSha256: 'same-schema',
      payloadSent: { serviceTier: 'priority', reasoningEffort: 'low', maxOutputTokens: null }, serviceTierActual: 'default',
      providerTerminalMs: isBrief ? 5000 : 7000, validToolCallCompleteMs: isBrief ? 4900 : 6900, tokens: { output: 123 } };
    await writeFile(join(directory, 'result.json'), JSON.stringify(meta));
    await writeFile(join(directory, 'prompt.json'), JSON.stringify(prompts));
    await writeFile(join(directory, isBrief ? 'brief.json' : 'source.js'), source);
  }
  return dirs;
}
async function patch(directory: string, field: string, value: unknown) {
  const path = join(directory, 'result.json'), meta = JSON.parse(await readFile(path, 'utf8'));
  meta[field] = value; await writeFile(path, JSON.stringify(meta));
}

test('pair keeps exact sources, equal duration and separately attributed shared perception cost', async () => {
  const [a, b, briefDir] = await pair();
  const loaded = await loadPair(a, b, briefDir);
  expect(loaded.duration).toBe(8);
  expect(loaded.arms.map(arm => arm.label)).toEqual(['A', 'B']);
  expect(loaded.arms[0].source).toBe('export default scene({}, s => { s.wait(8); });');
  expect(loaded.brief?.providerTerminalMs).toBe(5000);
  expect(loaded.arms[0].modelStageSumMs).toBe(12000);
  expect(loaded.match.systemPromptsEqual).toBe(false);
});

test('changed settings, author prompt or image identity reject the pairing', async () => {
  for (const [field, value] of [['thinkingRequested', 'high'], ['serviceTierActual', 'priority'],
    ['image', { sha256: 'different', bytes: 3, mimeType: 'image/png' }]] as const) {
    const [a, b] = await pair(); await patch(b, field, value);
    await expect(loadPair(a, b)).rejects.toThrow();
  }
  const [a, b] = await pair();
  const prompts = { systemPrompt: 'compact', prompt: 'different input' };
  await writeFile(join(b, 'prompt.json'), JSON.stringify(prompts)); await patch(b, 'promptSha256', hash(JSON.stringify(prompts)));
  await expect(loadPair(a, b)).rejects.toThrow('user prompt');
});

test('unequal durations reject without stretching or repairing either source', async () => {
  const [a, b] = await pair(), source = 'export default scene({}, s => { s.wait(7); });';
  await writeFile(join(b, 'source.js'), source);
  await patch(b, 'submissionSha256', hash(source)); await patch(b, 'submissionBytes', Buffer.byteLength(source));
  await expect(loadPair(a, b)).rejects.toThrow('duration');
});

test('unverified brief or prompt evidence cannot contribute perception cost', async () => {
  const [a, b, briefDir] = await pair();
  await writeFile(join(briefDir, 'brief.json'), briefText + ' ');
  await expect(loadPair(a, b, briefDir)).rejects.toThrow('brief hash');
  const [c, d] = await pair();
  await writeFile(join(c, 'prompt.json'), JSON.stringify({ systemPrompt: 'changed', prompt: 'changed' }));
  await expect(loadPair(c, d)).rejects.toThrow('prompt hash');
});

async function source(directory: string, value: string) {
  await writeFile(join(directory, 'source.js'), value);
  await patch(directory, 'submissionSha256', hash(value));
  await patch(directory, 'submissionBytes', Buffer.byteLength(value));
}

test('declared host data is hashed separately and exact model source remains untouched', async () => {
  const [a, b] = await pair(), data = '{"seconds":8}', path = join(a, 'data.json');
  await writeFile(path, data);
  for (const directory of [a, b]) {
    const prompts = JSON.parse(await readFile(join(directory, 'prompt.json'), 'utf8'));
    prompts.prompt += '\nHost defines read-only lexical DATA before your exact submitted source is compiled.';
    await writeFile(join(directory, 'prompt.json'), JSON.stringify(prompts));
    await patch(directory, 'promptSha256', hash(JSON.stringify(prompts)));
    await source(directory, 'export default scene({}, s => { s.wait(DATA.seconds); });');
  }
  const loaded = await loadPair(a, b, undefined, { declaredData: { path, sha256: hash(data) } });
  expect(loaded.duration).toBe(8);
  expect(loaded.arms[0].source.startsWith('export default')).toBe(true);
  expect(loaded.arms[0].executionSource).toBe('const DATA={"seconds":8};\n' + loaded.arms[0].source);
  expect(loaded.arms[0].executionSourceSha256).toBe(hash(loaded.arms[0].executionSource));
  expect(loaded.declaredData?.sha256).toBe(hash(data));
  await expect(loadPair(a, b, undefined, { declaredData: { path, sha256: 'wrong' } })).rejects.toThrow('data hash');
  const [c, d] = await pair();
  await expect(loadPair(c, d, undefined, { declaredData: { path, sha256: hash(data) } })).rejects.toThrow('DATA declaration');
});

test('diagnostic mode keeps failures and unequal durations without admitting invalid provenance', async () => {
  const [a, b] = await pair();
  await source(b, 'export default scene({}, s => { s.invented(); });');
  await expect(loadPair(a, b)).rejects.toThrow();
  const failed = await loadPair(a, b, undefined, { reportCompilationFailures: true });
  expect(failed.playable).toBe(false);
  expect(failed.duration).toBeNull();
  expect(failed.arms[0].duration).toBe(8);
  expect(failed.arms[1].compileError).toBeTruthy();
  expect(failed.arms[1].providerTerminalMs).toBe(7000);
  await source(b, 'export default scene({}, s => { s.wait(7); });');
  const unequal = await loadPair(a, b, undefined, { reportCompilationFailures: true });
  expect(unequal.playable).toBe(false);
  expect(unequal.pairError).toContain('equal');
  expect(unequal.arms.map(arm => arm.duration)).toEqual([8, 7]);
  await patch(b, 'thinkingRequested', 'high');
  await expect(loadPair(a, b, undefined, { reportCompilationFailures: true })).rejects.toThrow('setting');
});

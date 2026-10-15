import { expect, test } from 'bun:test';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { convertResponsesTools } from '../../node_modules/@earendil-works/pi-ai/dist/api/openai-responses-shared.js';
import type { AssistantMessage } from '@earendil-works/pi-ai';
import { submissionTool, validateSubmission, acceptSubmission, preparePayload, submissionTrace, observeSubmission } from './realtime-tool-probe.js';

const source = 'export default scene({}, s => {\n  s.text("label", { text: "quoted \\\"word\\\"" });\n});';
const call = { type: 'toolCall' as const, id: 'call-1', name: 'submit_scene', arguments: { source } };

test('stream text and partial argument deltas cannot contaminate completed source or satisfy completion', () => {
  const trace = submissionTrace();
  const partial = { content: [] } as unknown as AssistantMessage;
  observeSubmission(trace, 'scene', { type: 'text_delta', contentIndex: 0, delta: 'Here is code: WRONG', partial }, 100);
  observeSubmission(trace, 'scene', { type: 'toolcall_delta', contentIndex: 1, delta: '{"source":"partial', partial }, 200);
  expect(trace.completed).toEqual([]);
  expect(trace.toolCallCompleteMs).toBeNull();
  observeSubmission(trace, 'scene', { type: 'toolcall_end', contentIndex: 1, toolCall: call, partial }, 700);
  observeSubmission(trace, 'scene', { type: 'text_delta', contentIndex: 2, delta: 'More commentary.', partial }, 800);
  expect(trace.commentary).toBe('Here is code: WRONGMore commentary.');
  expect(trace.toolCallCompleteMs).toBe(700);
  expect(trace.validToolCallCompleteMs).toBe(700);
  expect(acceptSubmission('scene', trace.completed, [call], true)).toEqual({ source });
  expect(() => acceptSubmission('scene', trace.completed, [call], false)).toThrow();
});

test('extracts exact source only from a completed call agreeing with the terminal message', () => {
  expect(acceptSubmission('scene', [call], [call], true)).toEqual({ source });
  expect(() => acceptSubmission('scene', [], [call], true)).toThrow();
  expect(() => acceptSubmission('scene', [call, call], [call], true)).toThrow();
  expect(() => acceptSubmission('scene', [call], [call, call], true)).toThrow();
  expect(() => acceptSubmission('scene', [call], [{ ...call, id: 'different' }], true)).toThrow();
  expect(() => acceptSubmission('scene', [call], [{ ...call, arguments: { source: 'changed' } }], true)).toThrow();
  expect(() => acceptSubmission('scene', [call], [call], false)).toThrow();
  expect(() => acceptSubmission('scene', [{ ...call, name: 'other' }], [call], true)).toThrow();
});

test('closed bounded scene arguments reject extras, wrong types and prototype keys', () => {
  for (const args of [{}, { source: '' }, { source: 12 }, { source, commentary: 'extra' },
    { source: 'x'.repeat(256001) }, JSON.parse('{"source":"ok","__proto__":{}}')]) {
    expect(() => validateSubmission('scene', args)).toThrow();
  }
  expect(validateSubmission('scene', { source: '  exact whitespace  ' })).toEqual({ source: '  exact whitespace  ' });
});

test('brief is a closed causal record without a source answer or topic template', () => {
  const brief = { claim: 'Observed change', basis: 'image evidence-1', operation: 'move then compare',
    objects: [{ id: 'a', meaning: 'observed object' }], uncertainty: '' };
  expect(validateSubmission('brief', brief)).toEqual(brief);
  expect(() => validateSubmission('brief', { ...brief, source: 'code' })).toThrow();
  expect(() => validateSubmission('brief', { ...brief, objects: [...brief.objects, ...brief.objects] })).toThrow();
  expect(() => validateSubmission('brief', { ...brief, objects: [{ id: 'a', meaning: 'x', extra: true }] })).toThrow();
  expect(() => validateSubmission('brief', { ...brief, basis: '' })).toThrow();
});

test('real Pi conversion sends strict closed JSON schema and a forced single tool', () => {
  for (const kind of ['scene', 'brief'] as const) {
    const tool = submissionTool(kind, 'require');
    const converted = convertResponsesTools([tool], { supportsStrictMode: true });
    const prepared = preparePayload({ tools: converted, tool_choice: 'required', parallel_tool_calls: true,
      service_tier: 'priority', reasoning: { effort: 'low' }, max_output_tokens: 2048,
      input: 'private prompt content must not be in metadata' }, kind, 'require', 'priority');
    expect(prepared.payload.parallel_tool_calls).toBe(false);
    expect(prepared.metadata.tools[0].strict).toBe(true);
    expect(prepared.metadata.tools[0].parameters.additionalProperties).toBe(false);
    expect(prepared.metadata.tools[0].parameters.required).toContain(kind === 'scene' ? 'source' : 'claim');
    expect(JSON.stringify(prepared.metadata)).not.toContain('private prompt');
    expect(() => preparePayload({ ...prepared.payload, service_tier: 'default' }, kind, 'require', 'priority')).toThrow();
    expect(() => preparePayload({ ...prepared.payload, tool_choice: 'auto' }, kind, 'require', 'priority')).toThrow();
    expect(() => preparePayload({ ...prepared.payload, tools: [{ ...converted[0], strict: false }] }, kind, 'require', 'priority')).toThrow();
  }
});

test('unknown model remains offline, writes immutable sanitized evidence and no accepted source', async () => {
  const directory = join(await mkdtemp(join(tmpdir(), 'aha-tool-probe-')), 'run');
  const cli = fileURLToPath(new URL('./realtime-tool-probe.ts', import.meta.url));
  const args = [process.execPath, cli, 'run', '--kind=scene', '--case=cube', '--model=offline-nonexistent-probe-model',
    '--thinking=low', '--service-tier=priority', `--out=${directory}`];
  const env = { ...process.env, AGENT_AUTH_MODE: 'api-key', AGENT_PROVIDER: 'openai', OPENAI_API_KEY: 'offline-test-placeholder' };
  const first = Bun.spawn(args, { env, stdout: 'pipe', stderr: 'pipe' });
  expect(await first.exited).toBe(1);
  const resultPath = join(directory, 'result.json');
  const before = await readFile(resultPath, 'utf8');
  const result = JSON.parse(before);
  expect(result.status).toBe('failed');
  expect(result.failure.code).toBe('MODEL');
  expect(result.requestElapsedMs).toBeNull();
  expect(result.toolCallCompleteMs).toBeNull();
  expect(result.providerTerminalMs).toBeNull();
  expect(result.submissionAccepted).toBe(false);
  expect(result.priorityConfirmed).toBe(false);
  expect(before).not.toContain('offline-test-placeholder');
  expect(await readFile(join(directory, 'commentary.txt'), 'utf8')).toBe('');
  const second = Bun.spawn(args, { env, stdout: 'pipe', stderr: 'pipe' });
  expect(await second.exited).toBe(1);
  expect(await readFile(resultPath, 'utf8')).toBe(before);
});

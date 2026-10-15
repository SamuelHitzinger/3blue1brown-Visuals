/** One structured model submission; no agent loop, execution, retry, repair or quality claim. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Type } from 'typebox';
import type { Model, AssistantMessage, AssistantMessageEvent, StreamOptions, ImageContent, TextContent, Tool, ToolCall } from '@earendil-works/pi-ai';
import { createModelRuntime } from '../src/agents/auth.js';
import { agentConfig, AgentError } from '../src/agents/config.js';
import { safeFailure } from './realtime-probe/metrics.js';
import { buildPrompt, cases } from './realtime-probe/prompts.js';
import type { ProbeCase } from './realtime-probe/prompts.js';

type Kind = 'scene' | 'brief';
type Strict = 'require' | 'prefer';
type SceneSubmission = { source: string };
type BriefSubmission = { claim: string; basis: string; operation: string; objects: { id: string; meaning: string }[]; uncertainty: string };
type Submission = SceneSubmission | BriefSubmission;
const hash = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
const save = (path: string, value: unknown) => writeFile(path, JSON.stringify(value, null, 2), { flag: 'wx' });
const nameFor = (kind: Kind) => `submit_${kind}`;
const help = 'run --kind=scene|brief --model=ID --thinking=off|minimal|low|medium|high|xhigh|max --service-tier=priority|default --out=NEW_DIRECTORY [--case=cube|curve|diagram|external] [--action=create|edit] [--strict=require|prefer] [--prompt-file=PATH] [--system-file=PATH] [--image=PNG_OR_JPEG] [--timeout-ms=90000] [--max-tokens=2048]. Case defaults to cube, action to create, kind to scene, strict to require. External and brief require prompt-file. This makes exactly one real request and never executes the result.';

export function submissionTool(kind: Kind, strict: Strict = 'require'): Tool {
  return {
    name: nameFor(kind),
    description: kind === 'scene' ? 'Submit the complete native scene source exactly once.' : 'Submit one source-grounded causal visual brief, identifying uncertainty explicitly.',
    parameters: kind === 'scene'
      ? Type.Object({ source: Type.String() }, { additionalProperties: false })
      : Type.Object({ claim: Type.String(), basis: Type.String(), operation: Type.String(),
        objects: Type.Array(Type.Object({ id: Type.String(), meaning: Type.String() }, { additionalProperties: false })),
        uncertainty: Type.String() }, { additionalProperties: false }),
    constrainedSampling: { type: 'json_schema', strict },
  };
}

function closed(value: unknown, keys: string[]): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw new Error('Invalid submission object');
  const actual = Object.keys(value);
  if (actual.length !== keys.length || actual.some(key => !keys.includes(key))) throw new Error('Invalid submission fields');
  return value as Record<string, unknown>;
}
function boundedString(value: unknown, bytes: number, allowEmpty = false): string {
  if (typeof value !== 'string' || (!allowEmpty && !value.trim()) || Buffer.byteLength(value) > bytes) throw new Error('Invalid submission string');
  return value;
}
export function validateSubmission(kind: Kind, args: unknown): Submission {
  if (kind === 'scene') return { source: boundedString(closed(args, ['source']).source, 256000) };
  const item = closed(args, ['claim', 'basis', 'operation', 'objects', 'uncertainty']);
  if (!Array.isArray(item.objects) || item.objects.length > 64) throw new Error('Invalid brief objects');
  const ids = new Set<string>();
  const objects = item.objects.map(value => {
    const object = closed(value, ['id', 'meaning']);
    const id = boundedString(object.id, 128), meaning = boundedString(object.meaning, 2048);
    if (ids.has(id)) throw new Error('Duplicate brief object ID');
    ids.add(id);
    return { id, meaning };
  });
  return { claim: boundedString(item.claim, 4096), basis: boundedString(item.basis, 8192),
    operation: boundedString(item.operation, 8192), objects, uncertainty: boundedString(item.uncertainty, 4096, true) };
}

/** toolcall_end arguments are authoritative, but incomplete/failed provider output is never accepted. */
export function acceptSubmission(kind: Kind, completed: ToolCall[], terminal: ToolCall[], providerComplete: boolean): Submission {
  if (!providerComplete || completed.length !== 1 || terminal.length !== 1) throw new Error('Expected one successful completed tool call');
  const call = completed[0], final = terminal[0];
  if (call.name !== nameFor(kind) || final.name !== call.name || !call.id || call.id !== final.id) throw new Error('Tool call identity mismatch');
  const result = validateSubmission(kind, call.arguments);
  if (JSON.stringify(result) !== JSON.stringify(validateSubmission(kind, final.arguments))) throw new Error('Tool call arguments mismatch');
  return result;
}

export function submissionTrace() {
  return { commentary: '', completed: [] as ToolCall[], toolCallCompleteMs: null as number | null, validToolCallCompleteMs: null as number | null };
}
export function observeSubmission(trace: ReturnType<typeof submissionTrace>, kind: Kind, event: AssistantMessageEvent, elapsedMs: number) {
  if (event.type === 'text_delta') trace.commentary += event.delta;
  if (event.type === 'toolcall_end') {
    // Snapshot authoritative parsed arguments, never partial JSON or text commentary.
    trace.completed.push(JSON.parse(JSON.stringify(event.toolCall)) as ToolCall);
    trace.toolCallCompleteMs ??= elapsedMs;
    try {
      if (event.toolCall.name !== nameFor(kind)) throw new Error('Wrong submission tool');
      validateSubmission(kind, event.toolCall.arguments);
      trace.validToolCallCompleteMs ??= elapsedMs;
    } catch { /* Retain invalid call evidence; acceptance rejects it. */ }
  }
}

/** Inspect only the known tool schema and options; never log messages, headers, keys or the full payload. */
export function preparePayload(payload: unknown, kind: Kind, strict: Strict, tier: string) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new AgentError('CONFIG', 'Invalid adapter payload.');
  const data = payload as Record<string, any>;
  const tools = data.tools;
  if (data.service_tier !== tier || data.tool_choice !== 'required' || !Array.isArray(tools) || tools.length !== 1
    || tools[0].type !== 'function' || tools[0].name !== nameFor(kind)
    || strict === 'require' && tools[0].strict !== true) throw new AgentError('CONFIG', 'Adapter did not forward required tool settings.');
  const expected = submissionTool(kind, strict).parameters;
  if (JSON.stringify(tools[0].parameters) !== JSON.stringify(expected)) throw new AgentError('CONFIG', 'Adapter changed the requested schema.');
  const outgoing = { ...data, parallel_tool_calls: false };
  const metadata = { toolChoice: data.tool_choice as string, parallelToolCalls: false,
    serviceTier: data.service_tier as string, reasoningEffort: typeof data.reasoning?.effort === 'string' ? data.reasoning.effort as string : null,
    maxOutputTokens: typeof data.max_output_tokens === 'number' ? data.max_output_tokens as number : null,
    tools: [{ name: tools[0].name as string, type: 'function', strict: tools[0].strict === true,
      parameters: tools[0].parameters as Record<string, any> }] };
  return { payload: outgoing, metadata };
}

function argumentsFor(args: string[]) {
  const flags: Record<string, string> = {};
  const allowed = new Set(['kind', 'case', 'action', 'model', 'thinking', 'service-tier', 'out', 'strict', 'prompt-file', 'system-file', 'image', 'timeout-ms', 'max-tokens']);
  for (const arg of args) {
    const match = /^--([a-z-]+)=(.+)$/.exec(arg);
    if (!match || !allowed.has(match[1]) || Object.hasOwn(flags, match[1])) throw new AgentError('CONFIG', help);
    flags[match[1]] = match[2];
  }
  return flags;
}
async function promptFile(path: string) {
  const text = await readFile(resolve(path), 'utf8');
  if (!text.trim() || text.length > 128000) throw new AgentError('CONFIG', 'Prompt files must contain 1–128000 characters.');
  return text;
}

export async function main(args = process.argv.slice(2)) {
  if (['help', '--help'].includes(args[0])) { console.log(help); return; }
  if (args[0] !== 'run') throw new AgentError('CONFIG', help);
  const flags = argumentsFor(args.slice(1));
  const kind = (flags.kind ?? 'scene') as Kind, strict = (flags.strict ?? 'require') as Strict;
  const which = (flags.case ?? 'cube') as ProbeCase | 'external', action = (flags.action ?? 'create') as 'create' | 'edit';
  if (!flags.model || !flags.thinking || !flags.out || !['priority', 'default'].includes(flags['service-tier'])
    || !['scene', 'brief'].includes(kind) || !['require', 'prefer'].includes(strict)
    || (!Object.hasOwn(cases, which) && which !== 'external') || !['create', 'edit'].includes(action)
    || (which === 'external' || kind === 'brief') && !flags['prompt-file']) throw new AgentError('CONFIG', help);
  const config = agentConfig({ ...process.env, AGENT_MODEL: flags.model, AGENT_THINKING: flags.thinking });
  const timeoutMs = Number(flags['timeout-ms'] ?? 90000), maxTokens = Number(flags['max-tokens'] ?? 2048);
  if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 300000 || !Number.isInteger(maxTokens) || maxTokens < 64 || maxTokens > 16384) throw new AgentError('CONFIG', help);
  const prompts = kind === 'scene' ? buildPrompt(which === 'external' ? 'diagram' : which, 'native-js', action)
    : { systemPrompt: 'Read the supplied evidence and produce a compact causal visual brief. Ground claims and objects in the evidence IDs provided in the prompt. State uncertainty; do not invent unreadable details.', prompt: '' };
  if (flags['prompt-file']) prompts.prompt = await promptFile(flags['prompt-file']);
  if (flags['system-file']) prompts.systemPrompt = await promptFile(flags['system-file']);
  prompts.systemPrompt += `\n\nSubmission contract: call ${nameFor(kind)} exactly once with the complete ${kind === 'scene' ? 'native scene source in its source field' : 'causal brief in the specified fields'}. Do not put the submission in prose or a code fence. This is a single request; tools will not execute and no repair turn follows.`;
  const images: ImageContent[] = [];
  let imageMetadata: { path: string; sha256: string; bytes: number; mimeType: string } | null = null;
  if (flags.image) {
    const path = resolve(flags.image), bytes = await readFile(path);
    const png = bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
    const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
    if ((!png && !jpeg) || bytes.length > 20 * 1024 * 1024) throw new AgentError('CONFIG', 'Image must be PNG or JPEG, at most 20 MiB.');
    const mimeType = png ? 'image/png' : 'image/jpeg';
    images.push({ type: 'image', data: bytes.toString('base64'), mimeType });
    imageMetadata = { path, sha256: hash(bytes), bytes: bytes.length, mimeType };
  }
  const tool = submissionTool(kind, strict);
  const sourceHashes = Object.fromEntries(await Promise.all([
    ['probe', import.meta.url], ['prompts', new URL('./realtime-probe/prompts.ts', import.meta.url).href],
    ['auth', new URL('../src/agents/auth.ts', import.meta.url).href], ['config', new URL('../src/agents/config.ts', import.meta.url).href],
  ].map(async ([name, path]) => [name, hash(await readFile(fileURLToPath(path)))])));
  const directory = resolve(flags.out);
  await mkdir(dirname(directory), { recursive: true });
  try { await mkdir(directory); } catch { throw new AgentError('CONFIG', 'Output directory must be new; retained runs cannot be overwritten.'); }
  const identity = { schemaVersion: 1, evidenceKind: 'single-structured-model-submission', kind, case: which, action,
    format: kind === 'scene' ? 'native-js' : 'causal-brief', model: config.model, provider: config.provider, authMode: config.authMode,
    thinkingRequested: config.thinking, serviceTierRequested: flags['service-tier'], strictRequested: strict,
    maxTokensRequested: maxTokens, timeoutMs, maxRetries: 0, transportRequested: 'sse', systemPromptOverridden: !!flags['system-file'],
    promptSha256: hash(JSON.stringify(prompts)), promptBytes: Buffer.byteLength(prompts.systemPrompt + prompts.prompt),
    toolSchemaSha256: hash(JSON.stringify(tool.parameters)), image: imageMetadata, sourceHashes, piVersion: '1.1.0',
    startedAt: new Date().toISOString(),
    limitation: 'Tool completion and provider stop are model-only timestamps measured from request dispatch. They exclude input capture, compile, render and presentation, and do not establish execution, scientific correctness, source coverage, visual quality or ten-second readiness. JSON schema only constrains the argument container. No retry, repair or execution is performed.' };
  await save(join(directory, 'started.json'), identity);
  await save(join(directory, 'prompt.json'), prompts);
  await save(join(directory, 'tool.json'), tool);
  const started = performance.now();
  let requestStart: number | null = null, requestStartedAt: string | null = null;
  let providerTerminalMs: number | null = null;
  let final: AssistantMessage | undefined, providerComplete = false, accepted: Submission | null = null;
  let failure: ReturnType<typeof safeFailure> | null = null, submissionFailure: string | null = null;
  let payloadMetadata: ReturnType<typeof preparePayload>['metadata'] | null = null, actualTier: string | null = null;
  let modelMetadata: { id: string; api: string; reasoning: boolean; thinkingLevelMap: unknown; maxTokens: number } | null = null;
  const trace = submissionTrace(), events: { type: string; elapsedMs: number; chars?: number }[] = [];
  try {
    const runtime = await createModelRuntime(config);
    const model = runtime.getModel(config.provider, config.model);
    if (!model) throw new AgentError('MODEL', 'Model is absent from local provider catalog.');
    modelMetadata = { id: model.id, api: model.api, reasoning: model.reasoning, thinkingLevelMap: model.thinkingLevelMap ?? null, maxTokens: model.maxTokens };
    if (!['openai-responses', 'openai-codex-responses'].includes(model.api)) throw new AgentError('CONFIG', 'Requires a Responses adapter with explicit serviceTier support.');
    if (model.thinkingLevelMap?.[config.thinking] === null) throw new AgentError('CONFIG', 'Requested reasoning level is unsupported.');
    const options: StreamOptions & { serviceTier: 'priority' | 'default'; toolChoice: 'required'; reasoningEffort?: Exclude<typeof config.thinking, 'off'> } = {
      serviceTier: flags['service-tier'] as 'priority' | 'default', toolChoice: 'required',
      ...(config.thinking === 'off' ? {} : { reasoningEffort: config.thinking }),
      maxTokens, timeoutMs, maxRetries: 0, signal: AbortSignal.timeout(timeoutMs), transport: 'sse',
      onPayload(payload) {
        const prepared = preparePayload(payload, kind, strict, flags['service-tier']);
        payloadMetadata = prepared.metadata;
        return prepared.payload;
      },
      onProviderStreamEvent(event) {
        const data = event as { response?: { service_tier?: unknown }; service_tier?: unknown };
        const tier = data.response?.service_tier ?? data.service_tier;
        if (typeof tier === 'string' && ['auto','default','flex','scale','priority','fast'].includes(tier)) actualTier = tier;
      },
    };
    const content: (TextContent | ImageContent)[] = [{ type: 'text', text: prompts.prompt }, ...images];
    const context = { systemPrompt: prompts.systemPrompt, messages: [{ role: 'user' as const, content, timestamp: Date.now() }], tools: [tool] };
    requestStartedAt = new Date().toISOString();
    requestStart = performance.now();
    // Direct API options preserve serviceTier; streamSimple in Pi 1.1.0 omits it.
    const stream = model.api === 'openai-responses'
      ? runtime.stream(model as Model<'openai-responses'>, context, options)
      : runtime.stream(model as Model<'openai-codex-responses'>, context, options);
    for await (const event of stream) {
      const elapsedMs = performance.now() - requestStart;
      events.push({ type: event.type, elapsedMs, ...('delta' in event && typeof event.delta === 'string' ? { chars: event.delta.length } : {}) });
      observeSubmission(trace, kind, event, elapsedMs);
      if (event.type === 'done' || event.type === 'error') {
        providerTerminalMs = elapsedMs;
        final = event.type === 'done' ? event.message : event.error;
        providerComplete = event.type === 'done' && ['stop', 'toolUse'].includes(event.reason);
        if (!providerComplete) failure = safeFailure(new Error('Provider did not complete successfully'));
      }
    }
    if (!final) failure = safeFailure(new Error('Incomplete provider stream'));
  } catch (error) { providerComplete = false; failure = safeFailure(error); }
  const { commentary, completed, toolCallCompleteMs, validToolCallCompleteMs } = trace;
  try {
    accepted = acceptSubmission(kind, completed, final?.content.filter((part): part is ToolCall => part.type === 'toolCall') ?? [], providerComplete);
  } catch { submissionFailure = 'Expected exactly one schema-valid completed submission matching a successful terminal response.'; }
  const status = accepted ? 'complete' : 'failed';
  const acceptedText = accepted === null ? null : 'source' in accepted ? accepted.source : JSON.stringify(accepted, null, 2);
  const report = { ...identity, status, finishedAt: new Date().toISOString(), elapsedMs: performance.now() - started,
    requestStartedAt, requestElapsedMs: requestStart === null ? null : performance.now() - requestStart,
    toolCallCompleteMs, validToolCallCompleteMs, providerTerminalMs, providerComplete, submissionAccepted: accepted !== null,
    completedToolCalls: completed.length, payloadSent: payloadMetadata, serviceTierActual: actualTier,
    priorityConfirmed: actualTier === 'priority' || actualTier === 'fast', modelMetadata,
    acceptedToolCallWithin5s: accepted !== null && validToolCallCompleteMs !== null && validToolCallCompleteMs <= 5000,
    acceptedToolCallWithin10s: accepted !== null && validToolCallCompleteMs !== null && validToolCallCompleteMs <= 10000,
    completeProviderResponseWithin5s: providerComplete && providerTerminalMs !== null && providerTerminalMs <= 5000,
    completeProviderResponseWithin10s: providerComplete && providerTerminalMs !== null && providerTerminalMs <= 10000,
    stopReason: final?.stopReason ?? null, tokens: final?.usage && (providerComplete || final.usage.totalTokens > 0) ? {
      input: final.usage.input, output: final.usage.output, reasoning: final.usage.reasoning ?? null,
      cacheRead: final.usage.cacheRead, cacheWrite: final.usage.cacheWrite, total: final.usage.totalTokens,
    } : null, submissionSha256: acceptedText === null ? null : hash(acceptedText), submissionBytes: acceptedText === null ? null : Buffer.byteLength(acceptedText),
    commentaryBytes: Buffer.byteLength(commentary), failure, submissionFailure };
  await writeFile(join(directory, 'commentary.txt'), commentary, { flag: 'wx' });
  await save(join(directory, 'completed-tool-calls.json'), completed);
  await save(join(directory, 'terminal-tool-calls.json'), final?.content.filter(part => part.type === 'toolCall') ?? []);
  if (accepted !== null) {
    await save(join(directory, 'submission.json'), accepted);
    if ('source' in accepted) await writeFile(join(directory, 'source.js'), accepted.source, { flag: 'wx' });
    else await save(join(directory, 'brief.json'), accepted);
  }
  await save(join(directory, 'events.json'), events);
  await save(join(directory, 'result.json'), report);
  console.log(JSON.stringify({ status, result: join(directory, 'result.json'), toolCallCompleteMs, validToolCallCompleteMs,
    providerTerminalMs, providerComplete, submissionAccepted: accepted !== null, serviceTierActual: actualTier, failure, submissionFailure }, null, 2));
  if (status !== 'complete') process.exitCode = 1;
}

if (import.meta.main) main().catch(error => {
  console.error(JSON.stringify({ status: 'failed', failure: safeFailure(error), hint: help }));
  process.exitCode = 1;
});

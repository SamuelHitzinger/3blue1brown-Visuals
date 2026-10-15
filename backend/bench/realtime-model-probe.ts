/** Model-only latency probe. No agent loop, scene execution, quality or render-time claims.
 * From repo root: bun --env-file=backend/.env backend/bench/realtime-model-probe.ts list
 * run requires explicit --model, --thinking, --service-tier, --out; all flags use =.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import type { Model, AssistantMessage, StreamOptions, ImageContent, TextContent } from '@earendil-works/pi-ai';
import { createModelRuntime } from '../src/agents/auth.js';
import { agentConfig, AgentError } from '../src/agents/config.js';
import { createTextMetrics, observeText, finishText, safeFailure } from './realtime-probe/metrics.js';
import type { Format } from './realtime-probe/metrics.js';
import { buildPrompt, cases } from './realtime-probe/prompts.js';
import type { ProbeCase } from './realtime-probe/prompts.js';

const hash = (text: string | Uint8Array) => createHash('sha256').update(text).digest('hex');
const save = (path: string, value: unknown) => writeFile(path, JSON.stringify(value, null, 2), { flag: 'wx' });
const help = 'Use list OR run --case=cube|curve|diagram|external --format=native-js|ops --action=create|edit --model=ID --thinking=off|minimal|low|medium|high|xhigh|max --service-tier=priority|default --out=NEW_DIRECTORY [--timeout-ms=90000] [--max-tokens=2048] [--prompt-file=PATH] [--system-file=PATH] [--image=PNG_OR_JPEG]. External requires prompt-file. System override is external-only; format then selects text metrics, not a grammar guarantee. Run makes one real model request; list uses local catalog/auth metadata only.';
function argumentsFor(args: string[]) {
  const values: Record<string, string> = {};
  const allowed = new Set(['case','format','action','model','thinking','service-tier','out','timeout-ms','max-tokens','prompt-file','system-file','image']);
  for (const arg of args) {
    const match = /^--([a-z-]+)=(.+)$/.exec(arg);
    if (!match || !allowed.has(match[1]) || Object.hasOwn(values, match[1])) throw new AgentError('CONFIG', help);
    values[match[1]] = match[2];
  }
  return values;
}
const modelMetadata = (model: Model<any>) => ({ id: model.id, name: model.name, api: model.api,
  reasoning: model.reasoning, thinkingLevelMap: model.thinkingLevelMap ?? null, maxTokens: model.maxTokens });

export async function main(args = process.argv.slice(2)) {
  const command = args[0];
  if (command === 'help' || command === '--help') { console.log(help); return; }
  if (command === 'list') {
    if (args.length !== 1) throw new AgentError('CONFIG', help);
    const config = agentConfig();
    const runtime = await createModelRuntime(config);
    console.log(JSON.stringify({ provider: config.provider, authMode: config.authMode,
      authConfiguredSnapshot: runtime.hasConfiguredAuth(config.provider), subscriptionSnapshot: runtime.isUsingSubscription(config.provider),
      storedOAuthCredentialFound: config.authMode === 'subscription', availabilitySnapshotRefreshed: false,
      catalogOnly: true, entitlementVerified: false, models: runtime.getModels(config.provider).map(modelMetadata) }, null, 2));
    return;
  }
  if (command !== 'run') throw new AgentError('CONFIG', help);
  const flags = argumentsFor(args.slice(1));
  if (!flags.model || !flags.thinking || !flags.out || !['priority','default'].includes(flags['service-tier'])) throw new AgentError('CONFIG', help);
  const which = flags.case as ProbeCase | 'external', format = flags.format as Format, action = flags.action as 'create' | 'edit';
  if ((!Object.hasOwn(cases, which) && which !== 'external') || !['native-js','ops'].includes(format) || !['create','edit'].includes(action) || which === 'external' && !flags['prompt-file']) throw new AgentError('CONFIG', help);
  const config = agentConfig({ ...process.env, AGENT_MODEL: flags.model, AGENT_THINKING: flags.thinking });
  const timeoutMs = Number(flags['timeout-ms'] ?? 90000), maxTokens = Number(flags['max-tokens'] ?? 2048);
  if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 300000 || !Number.isInteger(maxTokens) || maxTokens < 64 || maxTokens > 16384) throw new AgentError('CONFIG', help);
  const directory = resolve(flags.out);
  const prompts = buildPrompt(which === 'external' ? 'diagram' : which, format, action);
  if (flags['prompt-file']) {
    const supplied = await readFile(resolve(flags['prompt-file']), 'utf8');
    if (!supplied.trim() || supplied.length > 128000) throw new AgentError('CONFIG', 'Prompt file must contain 1–128000 characters.');
    prompts.prompt = supplied;
  }
  if (flags['system-file']) {
    if (which !== 'external') throw new AgentError('CONFIG', 'System override requires external case.');
    const supplied = await readFile(resolve(flags['system-file']), 'utf8');
    if (!supplied.trim() || supplied.length > 128000) throw new AgentError('CONFIG', 'System file must contain 1–128000 characters.');
    prompts.systemPrompt = supplied;
  }
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
  const sourceHashes = Object.fromEntries(await Promise.all([
    ['probe', import.meta.url], ['prompts', new URL('./realtime-probe/prompts.ts', import.meta.url).href],
    ['metrics', new URL('./realtime-probe/metrics.ts', import.meta.url).href],
    ['auth', new URL('../src/agents/auth.ts', import.meta.url).href], ['config', new URL('../src/agents/config.ts', import.meta.url).href],
  ].map(async ([name, path]) => [name, hash(await readFile(fileURLToPath(path), 'utf8'))])));
  await mkdir(dirname(directory), { recursive: true });
  try { await mkdir(directory); } catch { throw new AgentError('CONFIG', 'Output directory must be new; retained runs cannot be overwritten.'); }
  const identity = { schemaVersion: 1, evidenceKind: 'model-stream-only', case: which, format, action, systemPromptOverridden: !!flags['system-file'],
    model: config.model, provider: config.provider, authMode: config.authMode, thinkingRequested: config.thinking,
    serviceTierRequested: flags['service-tier'], timeoutMs, maxTokensRequested: maxTokens, maxRetries: 0, transportRequested: 'sse',
    promptSha256: hash(JSON.stringify(prompts)), promptBytes: Buffer.byteLength(prompts.systemPrompt + prompts.prompt), sourceHashes, image: imageMetadata,
    startedAt: new Date().toISOString(), piVersion: '1.1.0',
    limitation: 'Text and line arrival are not first-visible, parse, compile, render, executable-operation or quality metrics. Provider stop is not proof of valid visual source. Local catalog is not entitlement proof. No retry or repair is performed.' };
  await save(join(directory, 'started.json'), identity);
  await save(join(directory, 'prompt.json'), prompts);
  const state = createTextMetrics(format);
  let requestStart: number | null = null, terminalMs: number | null = null, final: AssistantMessage | undefined;
  let outcome = 'failed', failure: ReturnType<typeof safeFailure> | null = null;
  let requestTier: string | null = null, actualTier: string | null = null, payloadReasoning: unknown = null, maxTokensSent: number | null = null;
  let metadata: ReturnType<typeof modelMetadata> | null = null;
  const events: { type: string; elapsedMs: number; chars?: number }[] = [];
  const started = performance.now();
  try {
    const runtime = await createModelRuntime(config);
    const model = runtime.getModel(config.provider, config.model);
    if (!model) throw new AgentError('MODEL', 'Model is absent from local provider catalog.');
    metadata = modelMetadata(model);
    if (!['openai-responses','openai-codex-responses'].includes(model.api)) throw new AgentError('CONFIG', 'This probe requires a Responses API adapter with explicit serviceTier support.');
    if (model.thinkingLevelMap?.[config.thinking] === null) throw new AgentError('CONFIG', 'Requested reasoning level is unsupported by this model catalog.');
    const options: StreamOptions & { serviceTier: 'priority' | 'default'; reasoningEffort?: Exclude<typeof config.thinking, 'off'> } = {
      serviceTier: flags['service-tier'] as 'priority' | 'default',
      ...(config.thinking === 'off' ? {} : { reasoningEffort: config.thinking }),
      maxTokens, timeoutMs, maxRetries: 0, signal: AbortSignal.timeout(timeoutMs), transport: 'sse',
      onPayload(payload) {
        const data = payload as { service_tier?: unknown; reasoning?: { effort?: unknown }; max_output_tokens?: unknown };
        requestTier = typeof data.service_tier === 'string' ? data.service_tier : null;
        payloadReasoning = typeof data.reasoning?.effort === 'string' ? data.reasoning.effort : null;
        maxTokensSent = typeof data.max_output_tokens === 'number' ? data.max_output_tokens : null;
        if (requestTier !== flags['service-tier']) throw new AgentError('CONFIG', 'Adapter did not forward the requested service tier.');
      },
      onProviderStreamEvent(event) {
        const data = event as { response?: { service_tier?: unknown }; service_tier?: unknown };
        const tier = data.response?.service_tier ?? data.service_tier;
        if (typeof tier === 'string' && ['auto','default','flex','scale','priority','fast'].includes(tier)) actualTier = tier;
      },
    };
    requestStart = performance.now();
    const content: (TextContent | ImageContent)[] = [{ type: 'text', text: prompts.prompt }, ...images];
    const context = { systemPrompt: prompts.systemPrompt, messages: [{ role: 'user' as const, content, timestamp: Date.now() }] };
    // streamSimple omits serviceTier in Pi 1.1.0; use the typed direct API path.
    const stream = model.api === 'openai-responses'
      ? runtime.stream(model as Model<'openai-responses'>, context, options)
      : runtime.stream(model as Model<'openai-codex-responses'>, context, options);
    for await (const event of stream) {
      const elapsedMs = performance.now() - requestStart;
      events.push({ type: event.type, elapsedMs, ...(event.type === 'text_delta' ? { chars: event.delta.length } : {}) });
      if (event.type === 'text_delta') observeText(state, event.delta, elapsedMs);
      if (event.type === 'done' || event.type === 'error') {
        terminalMs = elapsedMs;
        final = event.type === 'done' ? event.message : event.error;
        outcome = event.type === 'done' && event.reason === 'stop' ? 'complete' : 'failed';
        finishText(state, elapsedMs, outcome === 'complete');
        if (event.type === 'error') failure = safeFailure(new Error(event.error.errorMessage ?? 'Provider stream error'));
      }
    }
    if (!final) failure = safeFailure(new Error('Incomplete model response'));
  } catch (error) { outcome = 'failed'; state.completeOutputMs = null; failure = safeFailure(error); }
  const { text, pendingLine: _pending, ...textMetrics } = state;
  const report = { ...identity, status: outcome, finishedAt: new Date().toISOString(), elapsedMs: performance.now() - started,
    requestElapsedMs: requestStart === null ? null : performance.now() - requestStart, terminalMs,
    textMetrics, modelMetadata: metadata, serviceTierSent: requestTier, serviceTierActual: actualTier,
    priorityConfirmed: actualTier === 'priority' || actualTier === 'fast', reasoningEffortSent: payloadReasoning, maxTokensSent,
    completeResponseWithin5s: state.completeOutputMs !== null && state.completeOutputMs <= 5000,
    completeResponseWithin10s: state.completeOutputMs !== null && state.completeOutputMs <= 10000,
    stopReason: final?.stopReason ?? null, tokens: final?.usage && (outcome === 'complete' || final.usage.totalTokens > 0) ? {
      input: final.usage.input, output: final.usage.output, reasoning: final.usage.reasoning ?? null,
      cacheRead: final.usage.cacheRead, cacheWrite: final.usage.cacheWrite, total: final.usage.totalTokens,
    } : null, sourceSha256: hash(text), sourceBytes: Buffer.byteLength(text), failure };
  await writeFile(join(directory, 'output.txt'), text, { flag: 'wx' });
  await save(join(directory, 'events.json'), events);
  await save(join(directory, 'result.json'), report);
  console.log(JSON.stringify({ status: outcome, result: join(directory, 'result.json'), textMetrics,
    terminalMs, serviceTierActual: actualTier, priorityConfirmed: report.priorityConfirmed, failure }, null, 2));
  if (outcome !== 'complete') process.exitCode = 1;
}

if (import.meta.main) main().catch(error => {
  console.error(JSON.stringify({ status: 'failed', failure: safeFailure(error), hint: help }));
  process.exitCode = 1;
});

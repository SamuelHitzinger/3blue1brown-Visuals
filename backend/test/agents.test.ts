import { loadPrompt, instructionSnapshot, INSTRUCTION_VERSION } from '../src/agents/prompts.js';
import { afterEach, expect, spyOn, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createAssistantMessageEventStream } from "@earendil-works/pi-ai";
import type { AssistantMessage, Context } from "@earendil-works/pi-ai";
import { compileSource, SceneCompileError } from "animlib/core";
import { agentConfig, AgentError, agentFailure } from "../src/agents/config.js";
import { authPath, createModelRuntime, deviceId, revokeSubscription } from "../src/agents/auth.js";
import { PiAgentRunner } from "../src/agents/runtime.js";
import type { AgentTask } from "../src/agents/runtime.js";
import { createPiGenerator as createProductionGenerator } from "../src/agents/generator.js";
import { NarrationService } from "../src/narration/service.js";
import { settingsFromEnv } from "../src/narration/elevenlabs.js";
import { VideoService } from "../src/videos.js";
import { parseStoryline } from '../src/narration/markdown.js';
import type { LessonPlan } from '../src/agents/planning.js';

function planned(script: string, overrides: Partial<LessonPlan> = {}) {
  return JSON.stringify({ schemaVersion: 1, markdown: script, plan: {
    audience: 'Newcomer', prerequisites: [], learningGoal: 'Count dots', centralQuestion: 'How many dots?',
    keyInsight: 'Adding one increases the count by one', runningExample: 'One blue dot, then another', misconceptions: [], entities: [],
    scenes: parseStoryline(script).beats.map(beat => ({ id: beat.id, purpose: beat.title, whyNow: 'Build on counting',
      keyPoints: ['Count the dots'], visualDescription: beat.context, endsWith: 'The dots remain', carry: [], cleanup: [], sourceRefs: [], interactions: [] })),
    ...overrides,
  } });
}

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))); });
async function config() {
  const root = await mkdtemp(join(tmpdir(), "aha-agents-")); roots.push(root);
  return agentConfig({ PI_CODING_AGENT_DIR: root, AGENT_DATA_DIR: join(root, "jobs"), AGENT_AUTH_MODE: "api-key", OPENAI_API_KEY: "test-api-key" });
}
const oauth = { type: "oauth", access: "test-subscription-token", refresh: "test-refresh-token", expires: Date.now() + 3600_000, clientId: "test-client" };

test("unsupported account models report an actionable configuration error", () => {
  const failure = agentFailure(new Error('OpenAI API error (400): The model is not supported when using Codex with a ChatGPT account.'));
  expect(failure.code).toBe("MODEL");
  expect(failure.message).toContain("AGENT_MODEL");
  expect(failure.message).not.toContain("OpenAI API error");
});

test("auth mode is explicit: subscription requires OAuth and API-key mode ignores saved OAuth", async () => {
  const settings = await config();
  await expect(createModelRuntime({ ...settings, authMode: "subscription" })).rejects.toMatchObject({ code: "AUTH" });
  await writeFile(authPath(settings), JSON.stringify({ openai: oauth }));
  const api = await createModelRuntime(settings);
  expect((await api.getAuth("openai"))?.auth.apiKey).toBe("test-api-key");
  expect(api.getProvider("openai")!.auth.oauth).toBeUndefined();
  const subscription = await createModelRuntime({ ...settings, authMode: "subscription" });
  expect((await subscription.getAuth("openai"))?.auth.apiKey).toBe("test-subscription-token");
  expect(subscription.getProvider("openai")!.auth.apiKey).toBeUndefined();
  expect(JSON.parse(await readFile(authPath(settings), "utf8")).openai).toEqual(oauth);
  await expect(createModelRuntime({ ...settings, apiKey: undefined })).rejects.toMatchObject({ code: "AUTH" });
});

test("each installation retains a stable host identity", async () => {
  const first = await config(), second = await config();
  expect(deviceId(first)).toBe(deviceId(first));
  expect(deviceId(first)).not.toBe(deviceId(second));
});

test("logout revokes at the provider before removing local credentials and retains them on failure", async () => {
  const settings = await config();
  await writeFile(authPath(settings), JSON.stringify({ openai: oauth }));
  const calls: { url: string; options?: RequestInit }[] = [];
  const fetcher = (async (url, options) => {
    calls.push({ url: String(url), options });
    if (String(url).endsWith("openid-configuration")) return Response.json({ revocation_endpoint: "https://auth.openai.com/oauth/revoke" });
    expect(JSON.parse(await readFile(authPath(settings), "utf8")).openai).toEqual(oauth);
    return new Response(null, { status: 503 });
  }) as typeof fetch;
  await expect(revokeSubscription(settings, fetcher)).rejects.toMatchObject({ code: "REVOKE" });
  expect(JSON.parse(await readFile(authPath(settings), "utf8")).openai).toEqual(oauth);
  const body = calls[1].options!.body as URLSearchParams;
  expect(body.get("token")).toBe("test-refresh-token");
  expect(body.get("client_id")).toBe("test-client");
  expect(calls[1].url).not.toContain("test-refresh-token");
  const success = (async (url, options) => options?.method === "POST" ? new Response(null, { status: 200 }) : fetcher(url, options)) as typeof fetch;
  expect(await revokeSubscription(settings, success)).toBe(true);
  expect(JSON.parse(await readFile(authPath(settings), "utf8")).openai).toBeUndefined();
});

function message(text: string, stopReason: AssistantMessage["stopReason"] = "stop"): AssistantMessage {
  return { role: "assistant", content: [{ type: "text", text }], provider: "openai", api: "openai-responses", model: "gpt-6-astra",
    usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
    stopReason, timestamp: Date.now(), ...(stopReason === "error" ? { errorMessage: "401 sensitive-provider-detail" } : {}) };
}
async function fakeRuntime(outputs: AssistantMessage[]) {
  const settings = await config();
  const runtime = await createModelRuntime(settings);
  const contexts: Context[] = [];
  runtime.streamSimple = (_model, context, options) => {
    contexts.push(structuredClone(context));
    const stream = createAssistantMessageEventStream();
    const reply = options?.signal?.aborted ? message("", "aborted") : outputs.shift() ?? message("Unexpected call", "error");
    queueMicrotask(() => {
      stream.push({ type: "start", partial: reply });
      if (reply.stopReason === "error" || reply.stopReason === "aborted") stream.push({ type: "error", reason: reply.stopReason, error: reply });
      else if (reply.stopReason !== "pending") stream.push({ type: "done", reason: reply.stopReason, message: reply });
    });
    return stream;
  };
  const waits: number[] = [];
  return { settings, runtime, contexts, waits, runner: new PiAgentRunner(settings, async () => runtime, async ms => { waits.push(ms); }) };
}

function providerFailure(detail: string) {
  return { ...message('private-partial-output', 'error'), errorMessage: detail };
}

test('transient failures recover with fresh conversations and safe, correlated diagnostics', async () => {
  const { runner, contexts, waits } = await fakeRuntime([
    providerFailure('OpenAI API error (503): Authorization: Bearer private-token'),
    providerFailure('OpenAI Responses stream ended without a stop reason'), message('valid'),
  ]);
  const lines: string[] = [];
  const warn = spyOn(console, 'warn').mockImplementation(line => { lines.push(String(line)); });
  const info = spyOn(console, 'info').mockImplementation(line => { lines.push(String(line)); });
  try {
    const checked: string[] = [];
    const image = { type: 'image' as const, mimeType: 'image/png', data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGOQi7rzHwAEQgJUZSSrPwAAAABJRU5ErkJggg==' };
    expect(await runner.run({ systemPrompt: 'Write', prompt: 'Generate', images: [image],
      logContext: { videoId: 'test-video', stage: 'scene', sceneIndex: 0 },
      validate: async output => { checked.push(output); } })).toBe('valid');
    expect(checked).toEqual(['valid']);
    expect(contexts).toHaveLength(3);
    for (const context of contexts) {
      expect(JSON.stringify(context)).not.toContain('private-partial-output');
      expect(context.messages.filter(message => message.role === 'user')).toHaveLength(1);
      expect(context.messages.find(message => message.role === 'user')?.content).toContainEqual(image);
    }
    expect(waits).toHaveLength(2);
    expect(waits[0]).toBeGreaterThanOrEqual(1000); expect(waits[0]).toBeLessThan(1250);
    expect(waits[1]).toBeGreaterThanOrEqual(2000); expect(waits[1]).toBeLessThan(2250);
    const records = lines.map(line => JSON.parse(line));
    expect(records[0]).toMatchObject({ event: 'agent.retrying', reason: 'server', httpStatus: 503, providerAttempt: 1, videoId: 'test-video', stage: 'scene', sceneIndex: 0 });
    expect(records[1]).toMatchObject({ event: 'agent.retrying', reason: 'incomplete', providerAttempt: 2 });
    expect(records[2]).toMatchObject({ event: 'agent.recovered', providerAttempt: 3 });
    expect(new Set(records.map(record => record.agentRunId)).size).toBe(1);
    expect(lines.join('\n')).not.toMatch(/private-token|Authorization|private-image|private-partial-output/);
    expect(lines.join('\n')).not.toContain(image.data);
  } finally { warn.mockRestore(); info.mockRestore(); }
});

test('transient provider failures stop after three requests', async () => {
  const { runner, contexts, waits } = await fakeRuntime(Array.from({ length: 4 }, () => providerFailure('fetch failed')));
  await expect(runner.run({ systemPrompt: 'Write', prompt: 'Generate' })).rejects.toMatchObject({ code: 'PROVIDER', diagnostics: { reason: 'network' } });
  expect(contexts).toHaveLength(3); expect(waits).toHaveLength(2);
});

test('temporary throttling retries while permanent failures and quota exhaustion do not', async () => {
  const transient = await fakeRuntime([providerFailure('429 rate_limit_exceeded'), message('OK')]);
  expect(await transient.runner.run({ systemPrompt: 'Write', prompt: 'Generate' })).toBe('OK');
  expect(transient.waits).toHaveLength(1);
  for (const [detail, code] of [
    ['401 Unauthorized', 'AUTH'], ['403 Forbidden', 'AUTH'],
    ['400 model is not supported', 'MODEL'], ['429 insufficient_quota', 'LIMIT'],
    ['429 subscription_sharing_usage_limit_exceeded', 'LIMIT'],
    ['usage_not_included', 'LIMIT'], ['400 invalid request: network option', 'PROVIDER'],
    ['unknown sensitive-provider-detail', 'PROVIDER'],
  ]) {
    const { runner, contexts, waits } = await fakeRuntime([providerFailure(detail), message('Unexpected retry')]);
    await expect(runner.run({ systemPrompt: 'Write', prompt: 'Generate' })).rejects.toMatchObject({ code });
    expect(contexts).toHaveLength(1); expect(waits).toHaveLength(0);
  }
  expect(agentFailure({ status: 503, message: 'private-body' }).diagnostics).toMatchObject({ httpStatus: 503, reason: 'server', retryable: true });
  expect(agentFailure(new Error('subscription_sharing_usage_unavailable')).diagnostics).toMatchObject({ reason: 'server', retryable: true });
});

test('cancellation interrupts retry backoff without issuing another model request', async () => {
  const { settings, runtime, contexts } = await fakeRuntime([providerFailure('fetch failed'), message('Unexpected retry')]);
  const runner = new PiAgentRunner(settings, async () => runtime);
  let scheduled!: () => void;
  const ready = new Promise<void>(resolve => { scheduled = resolve; });
  const warn = spyOn(console, 'warn').mockImplementation(() => { scheduled(); });
  const controller = new AbortController();
  try {
    const result = runner.run({ systemPrompt: 'Write', prompt: 'Generate', signal: controller.signal });
    await ready; controller.abort();
    await expect(result).rejects.toMatchObject({ code: 'ABORTED' });
    expect(contexts).toHaveLength(1);
  } finally { controller.abort(); warn.mockRestore(); }
});

test('output validation, truncation and aborts do not consume provider retries', async () => {
  const invalid = await fakeRuntime([message('bad'), message('bad'), message('bad'), message('valid')]);
  await expect(invalid.runner.run({ systemPrompt: 'Write', prompt: 'Generate', validate: async () => { throw new Error('Invalid'); } })).rejects.toMatchObject({ code: 'VALIDATION' });
  expect(invalid.contexts).toHaveLength(3); expect(invalid.waits).toHaveLength(0);
  for (const [reason, code] of [['length', 'OUTPUT'], ['aborted', 'ABORTED']] as const) {
    const { runner, contexts, waits } = await fakeRuntime([message('partial', reason), message('Unexpected retry')]);
    await expect(runner.run({ systemPrompt: 'Write', prompt: 'Generate' })).rejects.toMatchObject({ code });
    expect(contexts).toHaveLength(1); expect(waits).toHaveLength(0);
  }
});

test("real Pi sessions expose validation and web access while ignoring local instructions", async () => {
  const { runner, contexts, settings } = await fakeRuntime([message("bad"), message("valid"), message("separate")]);
  await writeFile(join(settings.agentDir, "AGENTS.md"), "UNTRUSTED_LOCAL_INSTRUCTION");
  await writeFile(join(settings.agentDir, "APPEND_SYSTEM.md"), "UNTRUSTED_APPEND");
  const result = await runner.run({ systemPrompt: "Host instructions", prompt: "Generate", validate: async output => {
    if (output !== "valid") throw new Error("Use valid output");
  } });
  expect(result).toBe("valid");
  expect(contexts).toHaveLength(2);
  const toolNames = (context: Context) => context.messages.flatMap(message => message.role === "system" ? (message.toolsAdded ?? []).map(tool => tool.name) : []);
  expect(toolNames(contexts[0])).toEqual(["validate_output", "web_enable"]);
  expect(JSON.stringify(contexts[0])).not.toContain("UNTRUSTED_");
  expect(JSON.stringify(contexts[1])).toContain("Use valid output");
  expect(await runner.run({ systemPrompt: "Other task", prompt: "New task" })).toBe("separate");
  expect(toolNames(contexts[2])).toEqual(["web_enable"]);
  expect(JSON.stringify(contexts[2])).not.toContain("Use valid output");
});

test('Pi activates web tools, searches through Exa, and returns sources to the model', async () => {
  const enable = message('', 'toolUse');
  enable.content = [{ type: 'toolCall', id: 'enable-1', name: 'web_enable', arguments: {} }];
  const search = message('', 'toolUse');
  search.content = [{ type: 'toolCall', id: 'search-1', name: 'web_search', arguments: {
    query: 'Pi agent documentation', provider: 'exa', workflow: 'none',
  } }];
  const { runner, contexts } = await fakeRuntime([enable, search, message('Researched answer')]);
  const fetcher = spyOn(globalThis, 'fetch').mockImplementation((async (url, options) => {
    expect(String(url)).toStartWith('https://mcp.exa.ai/');
    const request = JSON.parse(String(options?.body));
    expect(request.method).toBe('tools/call');
    expect(request.params.arguments.query).toBe('Pi agent documentation');
    return Response.json({ jsonrpc: '2.0', id: 1, result: { content: [{ type: 'text', text: JSON.stringify({
      results: [{ title: 'Pi documentation', url: 'https://pi.dev/docs', text: 'Pi supports extension tools.' }],
    }) }] } });
  }) as typeof fetch);
  try {
    expect(await runner.run({ systemPrompt: 'Research the topic', prompt: 'Find Pi documentation' })).toBe('Researched answer');
    expect(fetcher).toHaveBeenCalledTimes(1);
    const names = contexts[1].messages.flatMap(message => message.role === 'system' ? (message.toolsAdded ?? []).map(tool => tool.name) : []);
    expect(names).toEqual(expect.arrayContaining(['web_search', 'fetch_content', 'get_search_content', 'source_check']));
    for (const name of ['bash', 'read', 'write', 'edit']) expect(names).not.toContain(name);
    const result = contexts[2].messages.find(message => message.role === 'toolResult' && message.toolName === 'web_search');
    expect(result?.role === 'toolResult' && result.isError).toBe(false);
    expect(JSON.stringify(result?.content)).toContain('https://pi.dev/docs');
    expect(JSON.stringify(result?.content)).toContain('Pi supports extension tools.');
  } finally { fetcher.mockRestore(); }
});

test("Pi executes the validation tool and returns its result to the model", async () => {
  const call = message("", "toolUse");
  call.content = [{ type: "toolCall", id: "validate-1", name: "validate_output", arguments: { output: "candidate" } }];
  const { runner, contexts } = await fakeRuntime([call, message("final")]);
  const checked: string[] = [];
  expect(await runner.run({ systemPrompt: "Write", prompt: "Generate", validate: async output => { checked.push(output); } })).toBe("final");
  expect(checked).toEqual(["candidate", "final"]);
  expect(contexts[1].messages.some(message => message.role === "toolResult" && message.toolName === "validate_output")).toBe(true);
});

test('Pi includes uploaded image attachments in the script conversation', async () => {
  const { runner, contexts } = await fakeRuntime([message('Narration: One dot.')]);
  const image = { type: 'image' as const, mimeType: 'image/png', data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGOQi7rzHwAEQgJUZSSrPwAAAABJRU5ErkJggg==' };
  await runner.run({ systemPrompt: 'Describe the image', prompt: 'Write a lesson', images: [image] });
  const user = contexts[0].messages.find(message => message.role === 'user');
  expect(user?.content).toContainEqual(image);
});

test("partial provider failures cannot be accepted as a successful script or leak provider details", async () => {
  const { runner } = await fakeRuntime([message("partial content", "error")]);
  const error = await runner.run({ systemPrompt: "Write", prompt: "Generate" }).catch(error => error);
  expect(error).toBeInstanceOf(AgentError);
  expect(error.code).toBe("AUTH");
  expect(error.message).not.toContain("sensitive-provider-detail");
});

test("repeated tool calls stop at the agent turn limit", async () => {
  const calls = Array.from({ length: 20 }, (_, index) => {
    const call = message("", "toolUse");
    call.content = [{ type: "toolCall", id: `validate-${index}`, name: "validate_output", arguments: { output: "candidate" } }];
    return call;
  });
  const { runner, contexts } = await fakeRuntime(calls);
  await expect(runner.run({ systemPrompt: "Write", prompt: "Generate", validate: async () => {} })).rejects.toMatchObject({ code: "TURN_LIMIT" });
  expect(contexts.length).toBeLessThanOrEqual(13);
});

test("cancelling a running Pi request stops generation", async () => {
  const { runner, runtime } = await fakeRuntime([]);
  let started!: () => void;
  const ready = new Promise<void>(resolve => { started = resolve; });
  runtime.streamSimple = (_model, _context, options) => {
    const stream = createAssistantMessageEventStream();
    const abort = () => stream.push({ type: "error", reason: "aborted", error: message("", "aborted") });
    options!.signal!.addEventListener("abort", abort, { once: true });
    started(); return stream;
  };
  const controller = new AbortController();
  const result = runner.run({ systemPrompt: "Write", prompt: "Generate", signal: controller.signal });
  await ready; controller.abort();
  await expect(result).rejects.toMatchObject({ code: "ABORTED" });
});

test("the video pipeline preserves narration audio IDs and reuses completed script, speech and scenes", async () => {
  const settings = await config();
  const script = "# Counting\n\n## Beat 1\n\nContent needed: Show one dot.\n\nNarration: One dot.\n\n## Beat 2\n\nContent needed: Add another dot.\n\nNarration: Another dot.";
  let speechCalls = 0, agentCalls = 0;
  const narration = new NarrationService({ root: join(settings.agentDir, "narration"), provider: {
    settings: settingsFromEnv({ ELEVENLABS_VOICE_ID: "test" }),
    async synthesize({ text }) {
      speechCalls++;
      const characters = Array.from(text);
      return { pcm: new Uint8Array(48_000), normalizedAlignment: { characters,
        character_start_times_seconds: characters.map((_, i) => i * 0.01), character_end_times_seconds: characters.map((_, i) => (i + 1) * 0.01) } };
    },
  } });
  const tasks: AgentTask[] = [];
  const runner = { async run(task: AgentTask) {
    agentCalls++; tasks.push(task);
    if (task.prompt.startsWith("Review")) {
      expect(speechCalls).toBe(0);
      const output = JSON.stringify({ schemaVersion: 1, verdict: "pass", summary: "Sound counting example", issues: [], checks: ["One plus another makes two."] });
      await task.validate!(output); return output;
    }
    if (task.prompt.startsWith("Write")) { const output = planned(script); await task.validate!(output); return output; }
    const packet = JSON.parse(task.prompt.slice(task.prompt.indexOf("\n") + 1));
    const source = `export default scene({audio:${JSON.stringify(packet.audioAssetId)},end:${JSON.stringify(packet.endMode)}},s=>{s.circle('dot');s.wait(${packet.scene.durationSec});});`;
    await task.validate!(source); return source;
  } };
  const generate = createPiGenerator(runner, narration, settings.dataDir);
  const service = new VideoService(join(settings.agentDir, "videos.sqlite"), generate, "pi");
  try {
    const request = { title: "Counting", topic: "Dots", documents: [], videoMode: 'interactive' as const };
    const created = service.create("user:demo", "one", request);
    for (let i = 0; i < 200 && service.get(created.id, "user:demo")?.status !== "complete"; i++) await Bun.sleep(10);
    const video = service.get(created.id, "user:demo")!;
    expect(video.status).toBe("complete");
    expect(video.provider).toBe("pi");
    expect(video.scenes).toHaveLength(2);
    for (const scene of video.scenes) {
      expect((await compileSource(scene.source)).options.audio).toBe(scene.audio.id);
      const audio = await service.handle(new Request(`http://localhost${scene.audio.url}`, { headers: { "x-user-id": "demo" } }));
      expect(audio.status).toBe(200);
      expect((await audio.arrayBuffer()).byteLength).toBe(48044);
    }
    expect(agentCalls).toBe(4); expect(speechCalls).toBe(2);
    expect(tasks[3].prompt).toContain('"previousFrame"');
    const endpoint = JSON.parse(await readFile(join(settings.dataDir, video.id, 'scene-0.final-frame.json'), 'utf8'));
    expect(endpoint.elements.some((element: { id: string }) => element.id === 'dot')).toBe(true);
    const packet = JSON.parse(tasks[2].prompt.slice(tasks[2].prompt.indexOf('\n') + 1));
    expect(packet.planning.lesson.learningGoal).toBe('Count dots');
    expect(packet.planning.outline.map((scene: { id: string }) => scene.id)).toEqual(['beat-1', 'beat-2']);
    expect(packet.planning.next.id).toBe('beat-2');
    expect(JSON.parse(await readFile(join(settings.dataDir, video.id, 'lesson.json'), 'utf8')).plan.learningGoal).toBe('Count dots');
    const approval = JSON.parse(await readFile(join(settings.dataDir, video.id, 'lesson.json'), 'utf8')).editorialReview;
    expect(approval.attempt).toBe(0);
    expect(JSON.parse(await readFile(join(settings.dataDir, video.id, 'lesson.json'), 'utf8')).instructionVersion).toBe(INSTRUCTION_VERSION);
    const scenePrompt = await readFile(join(settings.dataDir, video.id, 'scene-0.prompt.md'), 'utf8');
    const sceneSystem = scenePrompt.split('\n\nGenerate this scene')[0];
    expect(JSON.parse(await readFile(join(settings.dataDir, video.id, 'scene-0.instructions.json'), 'utf8'))).toEqual(instructionSnapshot(sceneSystem));
    expect(JSON.parse(await readFile(join(settings.dataDir, video.id, 'editorial', approval.runId, 'lesson-review-0.json'), 'utf8')).verdict).toBe('pass');
    expect(await readFile(join(settings.dataDir, video.id, 'scene-0.prompt.md'), 'utf8')).toContain('Count dots');
    // Recreate the generator and request a previously completed stage, as after a crash before publication.
    const reopened = createPiGenerator(runner, narration, settings.dataDir);
    const result = await reopened(request, 0, { videoId: video.id, owner: "user:demo", signal: new AbortController().signal });
    expect(result?.scene.source).toBe(video.scenes[0].source);
    expect(agentCalls).toBe(4); expect(speechCalls).toBe(2);
    // A process replacement resumes interrupted speech from the persisted chunk cache.
    const narrationId = await readFile(join(settings.dataDir, video.id, 'narration-id'), 'utf8');
    const job = await narration.get('user:demo', narrationId);
    await writeFile(join(narration.root, narrationId, 'job.json'), JSON.stringify({ ...job, status: 'running' }));
    const restartedNarration = new NarrationService({ root: narration.root, provider: narration.provider });
    const resumed = createPiGenerator(runner, restartedNarration, settings.dataDir);
    expect((await resumed(request, 0, { videoId: video.id, owner: 'user:demo', signal: new AbortController().signal }))?.scene.source).toBe(video.scenes[0].source);
    await restartedNarration.idle();
    expect((await restartedNarration.get('user:demo', narrationId)).status).toBe('complete');
    expect(agentCalls).toBe(4); expect(speechCalls).toBe(2);
  } finally { await service.close(); await narration.idle(); }
});

test.each(['classic', 'interactive', undefined] as const)('%s requests generate interactive scenes that receive the shared policy and evaluated end-state while later TTS is pending', async videoMode => {
  const settings = await config();
  let release!: () => void, secondSpeechStarted = false;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const script = '# Dots\n\n## Beat 1\n\nContent needed: Show a blue dot.\n\nNarration: One dot.\n\n## Beat 2\n\nContent needed: Keep the previous dot.\n\nNarration: Keep it.';
  const narration = new NarrationService({ root: join(settings.agentDir, 'progressive-narration'), provider: {
    settings: settingsFromEnv({ ELEVENLABS_VOICE_ID: 'test' }),
    async synthesize({ text }) {
      if (text === 'Keep it.') { secondSpeechStarted = true; await gate; }
      const characters = Array.from(text);
      return { pcm: new Uint8Array(48_000), normalizedAlignment: { characters,
        character_start_times_seconds: characters.map((_, i) => i * 0.01), character_end_times_seconds: characters.map((_, i) => (i + 1) * 0.01) } };
    },
  } });
  const runner = { async run(task: AgentTask) {
    if (task.prompt.startsWith('Review')) return JSON.stringify({ schemaVersion: 1, verdict: 'pass', summary: 'Sound example', issues: [], checks: ['The same dot continues into beat-2.'] });
    if (task.prompt.startsWith('Write')) {
      const base = JSON.parse(planned(script)) as { plan: LessonPlan };
      base.plan.entities = [{ id: 'dot', meaning: 'The original dot', color: 'BLUE' }];
      base.plan.scenes.forEach(scene => { scene.carry = ['dot']; });
      return planned(script, base.plan);
    }
    const input = JSON.parse(task.prompt.slice(task.prompt.indexOf('\n') + 1));
    expect(task.systemPrompt.split(await loadPrompt('scene-craft'))).toHaveLength(2);
    expect(task.systemPrompt).toContain(await loadPrompt('viewing-mode'));
    expect(task.systemPrompt).toContain('# animlib scene-authoring reference');
    expect(task.systemPrompt).not.toContain('### Player API');
    expect(task.systemPrompt).not.toContain('3D is the default');
    expect(input.videoMode).toBe('interactive');
    expect(input.legacyPlan).toBe(false);
    expect(task.systemPrompt).toContain('s.previous');
    expect(input.scene.utterances[0].words[0].startSec).toBe(0);
    expect(input.planning.lesson.entities[0].id).toBe('dot');
    expect(input.planning.outline).toHaveLength(2); // Full plan is available even while later speech is blocked.
    let commands: string;
    if (input.scene.id === 'beat-1') {
      expect(input.endMode).toBe('advance');
      commands = "const dot=s.circle('dot',{position:[2,0]});s.keep(dot);";
    } else {
      expect(input.endMode).toBe('hold');
      expect(input.previousFrame.elements[0].position).toEqual([2, 0, 0]);
      commands = "const dot=s.previous.get('dot');s.keep(dot);";
    }
    const source = `export default scene({audio:${JSON.stringify(input.audioAssetId)},end:${JSON.stringify(input.endMode)}},s=>{${commands}s.wait(${input.scene.durationSec});});`;
    const withOrbit = source.replace('scene({', 'scene({orbit:true,');
    await expect(task.validate!(withOrbit)).rejects.toThrow('whole-scene orbit');
    const targetedOrbit = source.replace('s=>{', "s=>{s.view('inspection',{rect:[0,0,1,1],orbit:true,orbitHitTest:'geometry'},v=>v.circle('inspection-dot'));");
    await task.validate!(targetedOrbit);
    await task.validate!(source); return source;
  } };
  const service = new VideoService(join(settings.agentDir, 'progressive.sqlite'), createPiGenerator(runner, narration, settings.dataDir), 'pi');
  const video = service.create('shared-user', 'progressive', { title: 'Dots', topic: 'Dots', documents: [], videoMode });
  const until = async (check: () => boolean) => {
    for (let i = 0; i < 300; i++) { if (check()) return; await Bun.sleep(10); }
    throw new Error('Timed out waiting for scene');
  };
  try {
    await until(() => secondSpeechStarted && service.get(video.id, 'shared-user')!.scenes.length === 1);
    const first = service.get(video.id, 'shared-user')!;
    expect(first.status).toBe('generating');
    expect(first.scenes[0].narration).toBe('One dot.');
    expect(first.scenes[0].visualDescription).toContain('blue dot');
    expect(first.scenes[0].words!.map(word => word.text)).toEqual(['One', 'dot']);
    const events = await service.handle(new Request(`http://localhost/api/videos/${video.id}/events`));
    const reader = events.body!.getReader();
    expect(new TextDecoder().decode((await reader.read()).value)).toContain('beat-1');
    await reader.cancel(); // Leaving playback must not cancel generation.
    release();
    await until(() => service.get(video.id, 'shared-user')!.status === 'complete');
    expect(service.get(video.id, 'shared-user')!.scenes).toHaveLength(2);
  } finally { release(); await service.close(); await narration.idle(); }
});

test('compiler repair messages retain locations and hints in the actual Pi conversation', async () => {
  const { runner, contexts } = await fakeRuntime([message('bad'), message('valid')]);
  await runner.run({ systemPrompt: 'Keep facts and timing', prompt: 'Generate', validate: async output => {
    if (output === 'bad') throw new SceneCompileError({ severity: 'error', code: 'SCENE_CODE', message: 'Unknown method', line: 7, column: 3, hint: 'Use moveTo.' });
  } });
  expect(JSON.stringify(contexts[1])).toContain('SCENE_CODE at line 7:3: Unknown method');
  expect(JSON.stringify(contexts[1])).toContain('Hint: Use moveTo.');
  expect(JSON.stringify(contexts[1])).toContain('Preserve the task');
});

test.each(['markdown', 'planned', 'version-1'])('existing saved %s videos resume their historical contract without a new planning call', async format => {
  const settings = await config();
  const videoId = crypto.randomUUID(), owner = 'shared-user';
  const request = { title: 'Old lesson', topic: 'Dots', documents: [], ...(format === 'version-1' ? { videoMode: 'interactive' as const } : {}) };
  const directory = join(settings.dataDir, videoId);
  const { mkdir } = await import('node:fs/promises');
  await mkdir(directory, { recursive: true });
  const markdown = '# Old lesson\n\n## Beat 1\n\nContent needed: One dot.\n\nNarration: One dot.';
  if (format === 'markdown') await writeFile(join(directory, 'script.md'), markdown);
  else {
    const cached = JSON.parse(planned(markdown));
    if (format === 'version-1') cached.instructionVersion = 1;
    cached.plan.scenes[0].interactions = [{ id: 'explore', type: 'toggle', label: 'Explore', drives: 'Example', discover: 'Count' }];
    await writeFile(join(directory, 'lesson.json'), JSON.stringify(cached));
  }
  const narration = new NarrationService({ root: join(settings.agentDir, 'old-narration'), provider: {
    settings: settingsFromEnv({ ELEVENLABS_VOICE_ID: 'test' }),
    async synthesize({ text }) {
      const characters = Array.from(text);
      return { pcm: new Uint8Array(48_000), normalizedAlignment: { characters,
        character_start_times_seconds: characters.map((_, i) => i * 0.01), character_end_times_seconds: characters.map((_, i) => (i + 1) * 0.01) } };
    },
  } });
  let calls = 0;
  const generator = createPiGenerator({ async run(task) {
    calls++;
    expect(task.prompt).toStartWith('Generate');
    const input = JSON.parse(task.prompt.slice(task.prompt.indexOf('\n') + 1));
    expect(input.legacyPlan).toBe(format !== 'version-1');
    expect(input.instructionVersion).toBe(format === 'version-1' ? 1 : undefined);
    expect(input.videoMode).toBe(format === 'version-1' ? 'interactive' : 'classic');
    if (format === 'markdown') expect(input.planning.outline[0].context).toContain('One dot');
    return `export default scene({audio:${JSON.stringify(input.audioAssetId)},end:"hold",orbit:true},s=>{s.circle('dot');${format !== 'markdown' ? "s.toggle('explore',{default:false});" : ''}s.wait(${input.scene.durationSec});});`;
  } }, narration, settings.dataDir);
  const result = await generator(request, 0, { videoId, owner, signal: new AbortController().signal });
  expect(result?.scene.narration).toBe('One dot.'); expect(calls).toBe(1);
  const resumed = await generator(request, 0, { videoId, owner, signal: new AbortController().signal });
  expect(resumed?.scene.source).toBe(result?.scene.source); expect(calls).toBe(1);
  await narration.idle();
});

test('existing Pi subscription credentials use their selected provider without falling back to OpenAI keys', async () => {
  const settings = { ...await config(), authMode: 'subscription', provider: 'openai-codex' as const };
  const legacy = { type: 'oauth', access: 'existing-pi-token', refresh: 'pi-refresh', expires: Date.now() + 3600_000, accountId: 'pi-account' };
  await writeFile(authPath(settings), JSON.stringify({ 'openai-codex': legacy, openai: oauth }));
  const runtime = await createModelRuntime(settings);
  expect((await runtime.getAuth('openai-codex'))?.auth.apiKey).toBe('existing-pi-token');
  expect(runtime.getModel('openai-codex', settings.model)).toBeDefined();
  expect(runtime.getProvider('openai-codex')!.auth.apiKey).toBeUndefined();
  await expect(revokeSubscription(settings)).rejects.toMatchObject({ code: 'REVOKE' });
  expect(JSON.parse(await readFile(authPath(settings), 'utf8'))['openai-codex']).toEqual(legacy);
  expect(() => agentConfig({ AGENT_PROVIDER: 'openai-codex', AGENT_AUTH_MODE: 'api-key' })).toThrow('subscription mode');
});

// These tests isolate narration/timing contracts. visual-gate.test.ts covers rendered review.
function createPiGenerator(...args: Parameters<typeof createProductionGenerator>) {
  return createProductionGenerator(args[0], args[1], args[2], { ...args[3], visualGate: async ({ source }) => source });
}

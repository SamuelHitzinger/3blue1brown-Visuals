import { afterEach, expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { alignWords, validateAlignment } from "../src/narration/alignment.js";
import { sampleCount, silence, wav } from "../src/narration/audio.js";
import { createElevenLabs, settingsFromEnv } from "../src/narration/elevenlabs.js";
import type { SpeechProvider } from "../src/narration/elevenlabs.js";
import { NarrationError } from "../src/narration/errors.js";
import { buildNarrationPreview, buildSceneAgentInput, validateSceneAgainstNarration } from "../src/narration/handoff.js";
import { parseStoryline } from "../src/narration/markdown.js";
import { narrationRoutes } from "../src/narration/routes.js";
import { atomicWrite, chunkStoryline, NarrationService } from "../src/narration/service.js";
import type { Alignment, SpeechResult } from "../src/narration/types.js";
import { buildStorylineMessages } from "../src/storyline-prompt.js";

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))); });
const settings = settingsFromEnv({ ELEVENLABS_VOICE_ID: "test-voice" });
const script = `# Counting\n\n## Beat 1 — Question\n\nContent needed: Two dots; do not reveal the answer.\n\nNarration:\nOne, two.\n\nPause: 3s\n\nReveal (spoken):\nTwo dots.\n\n## Beat 2 — Check\n\nNarration:\nTwo again.`;
function alignment(text: string): Alignment {
  const characters = Array.from(text);
  return { characters, character_start_times_seconds: characters.map((_, i) => i * 0.02), character_end_times_seconds: characters.map((_, i) => (i + 1) * 0.02) };
}
function speech(text: string): SpeechResult { return { pcm: new Uint8Array(96_000), normalizedAlignment: alignment(text), alignment: alignment(text) }; }
async function setup(synthesize = async (input: { text: string }) => speech(input.text)) {
  const root = await mkdtemp(join(tmpdir(), "aha-narration-")); roots.push(root);
  const inputs: { text: string; previousText: string; nextText: string }[] = [];
  const provider: SpeechProvider = { settings, synthesize: async input => { inputs.push(input); return synthesize(input); } };
  return { root, inputs, provider, service: new NarrationService({ root, provider }) };
}
test("independent narration jobs synthesize concurrently and identical submissions are deduplicated", async () => {
  const started: string[] = [];
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const { service } = await setup(async input => { started.push(input.text); await gate; return speech(input.text); });
  try {
    const scripts = ['One.', 'Two.', 'Three.'].map(text => `Narration: ${text}`);
    const jobs = await Promise.all(scripts.map(markdown => service.submit('owner', markdown)));
    expect((await service.submit('owner', scripts[0])).id).toBe(jobs[0].id);
    for (let i = 0; i < 300 && started.length < 3; i++) await Bun.sleep(10);
    expect(started.sort()).toEqual(['One.', 'Three.', 'Two.']);
    let idle = false;
    const draining = service.idle().then(() => { idle = true; });
    await Bun.sleep(10);
    expect(idle).toBe(false);
    release(); await draining;
    for (const job of jobs) expect((await service.get('owner', job.id)).status).toBe('complete');
  } finally { release(); await service.idle(); }
});

test("parses labelled Markdown without speaking context, preserving order and roles", () => {
  const parsed = parseStoryline(script);
  expect(parsed.title).toBe("Counting");
  expect(parsed.beats.map(b => b.id)).toEqual(["beat-1", "beat-2"]);
  expect(parsed.beats[0].blocks.map(b => b.kind === "speech" ? b.role : b.kind)).toEqual(["narration", "pause", "reveal"]);
  expect(parsed.beats[0].context).toContain("Two dots");
  expect(parsed.beats[0].blocks[0]).toMatchObject({ text: "One, two.", source: { line: 8 } });
});
test("supports bold labels, labelled headings, soft breaks, Unicode and pause aliases", () => {
  const result = parseStoryline(`# T\n\n## Ponder one — Pensez\n\n**Narration:** “L'été est là.”\nPause: 3s\nInvitation (spoken): Réfléchissez.\n\n[pause: 2s]\n\n### Reveal (spoken)\n\nOui, c'est ça.\n\npause_s: 1`);
  expect(result.beats[0].blocks).toHaveLength(6);
  expect(result.beats[0].blocks[0]).toMatchObject({ text: "L'été est là." });
});
test("rejects ambiguity, empty labels, duplicate scenes, stage directions and pause ranges", () => {
  for (const markdown of ["Read me?\n\nNotes: Mixed unlabelled speech and notes.", "Narration:\n\nPause: 3s", "Narration: Hello [show a circle]", "Narration: x = 2", "Narration: Hi\n\nPause: 3–5s", "Narration: Hi\n\nPause: -2s", "## Beat 1\n\nNarration: Hi\n\n## Beat 1\n\nNarration: Again"]) {
    expect(() => parseStoryline(markdown)).toThrow(NarrationError);
  }
});
test("guidance production example is accepted by the actual parser", async () => {
  const guidance = await readFile(new URL("../prompts/guidance.md", import.meta.url), "utf8");
  const example = /```md\r?\n([\s\S]*?)```/.exec(guidance)![1];
  const parsed = parseStoryline(example);
  expect(parsed.beats).toHaveLength(2);
  expect(parsed.beats[0].blocks.filter(b => b.kind === "pause")).toHaveLength(2);
  expect(parsed.beats[1].blocks.filter(b => b.kind === "pause")).toHaveLength(0);
  const messages = await buildStorylineMessages("Explain binary search.");
  const capabilities = await readFile(new URL("../../shared/animlib/docs/capabilities.md", import.meta.url), "utf8");
  expect(messages[0].role).toBe("system");
  expect(messages[0].content).toContain(guidance);
  expect(messages[0].content).toContain(capabilities);
  expect(messages[1]).toEqual({ role: "user", content: "Explain binary search." });
});
test("oversized passages split without losing or duplicating words", () => {
  const text = "A useful sentence. ".repeat(600).trim();
  const chunked = chunkStoryline(parseStoryline(`Narration: ${text}`));
  const parts = chunked.beats[0].blocks.filter(b => b.kind === "speech");
  expect(parts.every(p => p.text.length <= 8000)).toBe(true);
  expect(parts.map(p => p.text).join(" ")).toBe(text);
  expect(new Set(parts.map(p => p.id)).size).toBe(parts.length);
});
test("word timing follows normalized characters, including Unicode and repeated words", () => {
  const a = alignment("😀 Don't count twenty-two twice. Go, go!");
  validateAlignment(a, 2);
  const result = alignWords(a, "u1", 3);
  expect(result.words.map(w => w.text)).toEqual(["Don't", "count", "twenty-two", "twice", "Go", "go"]);
  expect(result.words[0].characterRange).toEqual([2, 7]);
  expect(result.words[0].startSec).toBeCloseTo(3.04);
  expect(new Set(result.words.map(w => w.id)).size).toBe(6);
  expect(result.sentences).toHaveLength(2);
});
test("alignment validation fails on missing data, array mismatch, reversal and out-of-audio values", () => {
  const valid = alignment("Hi");
  for (const value of [null, { ...valid, characters: [] }, { ...valid, character_end_times_seconds: [0.1] },
    { ...valid, character_start_times_seconds: [0.02, 0] }, { ...valid, character_end_times_seconds: [0.02, NaN] },
    { ...valid, character_end_times_seconds: [0.02, 4] }]) expect(() => validateAlignment(value, 1)).toThrow("alignment");
});
test("WAV headers and scripted silence use exact samples", () => {
  const pcm = silence(3.125), bytes = wav(pcm), view = new DataView(bytes.buffer);
  expect(sampleCount(pcm)).toBe(75_000);
  expect(bytes.slice(0, 4)).toEqual(new TextEncoder().encode("RIFF"));
  expect(view.getUint32(24, true)).toBe(24000);
  expect(view.getUint32(40, true)).toBe(150_000);
  expect(bytes.slice(44).some(Boolean)).toBe(false);
  expect(() => sampleCount(new Uint8Array(3))).toThrow();
});
test("allows provider millisecond rounding at the PCM boundary without extending the audio", () => {
  const a = { characters: ["A"], character_start_times_seconds: [0], character_end_times_seconds: [2.508] };
  validateAlignment(a, 2.50775);
  expect(alignWords(a, "u", 0, 2.50775).words[0].endSec).toBe(2.50775);
  expect(() => validateAlignment(a, 2.5)).toThrow("alignment");
});
test("coalesces submissions and measures offsets from full audio including trailing silence", async () => {
  const { service, inputs } = await setup();
  const [job, duplicate] = await Promise.all([service.submit("alice", script), service.submit("alice", script)]);
  expect(job.id).toBe(duplicate.id); await service.idle();
  expect(inputs).toHaveLength(3);
  expect(inputs[0].nextText).toBe("Two dots.");
  const pkg = await service.package("alice", job.id);
  expect(pkg.scenes[0].pauses[0]).toMatchObject({ startSec: 2, endSec: 5 });
  expect(pkg.scenes[0].utterances[1].words[0].startSec).toBe(5);
  expect(pkg.scenes[1].startSec).toBe(7);
  expect(pkg.durationSec).toBe(9);
  expect(pkg.combinedAudio.sampleCount).toBe(9 * 24000);
  expect((await service.submit("alice", script)).status).toBe("complete");
  expect(inputs).toHaveLength(3);
  await expect(service.package("bob", job.id)).rejects.toMatchObject({ status: 404 });
  await expect(service.audio("alice", job.id, "../../.env")).rejects.toMatchObject({ status: 404 });
});
test("failure retries reuse completed chunks, and repeated submission does not auto-retry", async () => {
  let count = 0;
  const { service, inputs } = await setup(async input => {
    if (++count === 2) throw new NarrationError("PROVIDER_OUTCOME_UNKNOWN", "Explicit retry required", 502, true);
    return speech(input.text);
  });
  const job = await service.submit("alice", script); await service.idle();
  expect((await service.get("alice", job.id)).status).toBe("failed");
  await service.submit("alice", script); await service.idle(); expect(inputs).toHaveLength(2);
  await service.retry("alice", job.id); await service.idle();
  expect((await service.get("alice", job.id)).status).toBe("complete"); expect(inputs).toHaveLength(4);
});
test("restart marks unfinished jobs interrupted and retains the chunk cache", async () => {
  const { service, root, provider, inputs } = await setup();
  const job = await service.submit("alice", script); await service.idle();
  await atomicWrite(join(root, job.id, "job.json"), JSON.stringify({ ...job, status: "running" }));
  const restarted = new NarrationService({ root, provider });
  expect((await restarted.get("alice", job.id)).status).toBe("interrupted");
  await restarted.retry("alice", job.id); await restarted.idle();
  expect((await restarted.get("alice", job.id)).status).toBe("complete"); expect(inputs).toHaveLength(3);
});
test("packages preserve original notes and compile synchronized demo scenes", async () => {
  const { service } = await setup(); const job = await service.submit("a", script); await service.idle();
  const pkg = await service.package("a", job.id);
  const packet = buildSceneAgentInput(pkg, "beat-1");
  expect(packet.scene.context).toContain("Two dots"); expect(packet.endMode).toBe("advance");
  expect(packet.audioSha256).toHaveLength(64);
  expect(await service.artifact("a", job.id, "scene-agent.md")).toContain("Silent pause");
  const wave = await validateSceneAgainstNarration(`export default scene({audio:${JSON.stringify(packet.audioAssetId)},end:'advance'},s=>{
    const mesh=s.surface('wave',{fn:()=>0,xSegments:2,ySegments:2});
    s.deform(mesh,[s.time],([x,y],i,t)=>[x,y,t]);s.keep(mesh);s.wait(${packet.scene.durationSec});
  });`, pkg, 'beat-1');
  expect(wave.compiled.reactiveTime).toBe(packet.scene.durationSec);
  expect(wave.finalFrame.elements[0].geometry.vertices!.every(v=>v[2]===packet.scene.durationSec)).toBe(true);
  const preview = buildNarrationPreview(pkg);
  let previous;
  for (const scene of preview.scenes) previous = (await validateSceneAgainstNarration(scene.source, pkg, scene.id, previous)).finalFrame;
  await expect(validateSceneAgainstNarration(`export default scene({audio:"wrong",end:"advance"},s=>s.wait(1));`, pkg, "beat-1")).rejects.toThrow("assigned");
  await expect(validateSceneAgainstNarration(`export default scene({audio:${JSON.stringify(packet.audioAssetId)},end:"advance"},s=>s.wait(99));`, pkg, "beat-1")).rejects.toThrow("exceeds");
});
test("HTTP interfaces share one user, validate input and serve committed assets", async () => {
  const { service } = await setup(); const route = narrationRoutes(service);
  const req = (path: string, options?: RequestInit) => route(new Request(`http://localhost${path}`, options), path);
  const headers = { "x-user-id": "alice", "Content-Type": "application/json" };
  expect((await req("/api/narrations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ markdown: script }) })).status).toBe(202);
  expect((await req("/api/narrations", { method: "POST", headers: { ...headers, origin: "https://evil.test" }, body: "{}" })).status).toBe(403);
  expect((await req("/api/narrations", { method: "POST", headers, body: "{" })).status).toBe(400);
  expect((await req("/api/narrations", { method: "POST", headers, body: JSON.stringify({ markdown: "Narration: Unclear [pause a bit]" }) })).status).toBe(422);
  const response = await req("/api/narrations", { method: "POST", headers, body: JSON.stringify({ markdown: script }) });
  expect(response.status).toBe(202); const job = await response.json(); expect(job.owner).toBeUndefined();
  await service.idle();
  const result = await (await req(job.statusUrl, { headers })).json();
  expect(result.package.durationSec).toBe(9);
  const audio = await req(result.package.scenes[0].audio.url, { headers });
  expect(audio.headers.get("content-type")).toBe("audio/wav"); expect((await audio.arrayBuffer()).byteLength).toBeGreaterThan(44);
  expect((await req(job.statusUrl, { headers: { "x-user-id": "bob" } })).status).toBe(200);
  expect((await req(job.statusUrl, { method: "HEAD", headers })).body).toBeNull();
  expect((await req(job.statusUrl + "/alignment", { headers })).status).toBe(200);
  expect((await req(job.statusUrl + "/scenes/beat-1", { headers })).status).toBe(200);
});
test("ElevenLabs uses normalized speech, masks provider messages, and only retries explicit temporary rejection", async () => {
  const sent: { url: string; body: any }[] = []; const sleeps: number[] = [];
  const fakeFetch = (async (url, options) => {
    sent.push({ url: String(url), body: JSON.parse(options!.body as string) });
    if (sent.length === 1) return Response.json({ detail: { status: "too_many_concurrent_requests" } }, { status: 429 });
    return Response.json({ audio_base64: Buffer.from(speech("sixty four").pcm).toString("base64"), normalized_alignment: alignment("sixty four"), alignment: alignment("64") });
  }) as typeof fetch;
  const provider = createElevenLabs(settings, "private-test-key", fakeFetch, async ms => { sleeps.push(ms); });
  const output = await provider.synthesize({ text: "64", previousText: "Before", nextText: "After" });
  expect(sent).toHaveLength(2); expect(sleeps).toEqual([1000]);
  expect(sent[0].body).toMatchObject({ text: "64", previous_text: "Before", next_text: "After", model_id: "eleven_multilingual_v2",
    voice_settings: { stability: 0.15, similarity_boost: 0.75, style: 0.9, use_speaker_boost: true, speed: 1.12 } });
  expect(alignWords(output.normalizedAlignment, "u", 0).words.map(w => w.text)).toEqual(["sixty", "four"]);
  const auth = createElevenLabs(settings, "secret", (async () => Response.json({ detail: "secret echo" }, { status: 401 })) as unknown as typeof fetch);
  await expect(auth.synthesize({ text: "Hi", previousText: "", nextText: "" })).rejects.toMatchObject({ code: "PROVIDER_AUTH" });
  let calls = 0;
  const disconnected = createElevenLabs(settings, "secret", (async () => { calls++; throw new Error("secret"); }) as unknown as typeof fetch);
  await expect(disconnected.synthesize({ text: "Hi", previousText: "", nextText: "" })).rejects.toMatchObject({ code: "PROVIDER_OUTCOME_UNKNOWN" });
  expect(calls).toBe(1);
});

test("variable Markdown travels through HTTP, the ElevenLabs provider and animlib with notes excluded", async () => {
  const root = await mkdtemp(join(tmpdir(), "aha-normalization-")); roots.push(root);
  const sent: string[] = [];
  const provider = createElevenLabs(settings, "test-key", (async (_url, options) => {
    const input = JSON.parse(options!.body as string); sent.push(input.text);
    return Response.json({ audio_base64: Buffer.from(speech(input.text).pcm).toString("base64"), normalized_alignment: alignment(input.text) });
  }) as typeof fetch);
  const service = new NarrationService({ root, provider }), route = narrationRoutes(service);
  const markdown = "Here's the script:\n\n```md\n# Counting\n\n| Scene | Voice-over | Visuals | Reveal |\n| --- | --- | --- | --- |\n| 1 — Count | One. [pause 500ms] Two. | Do not speak these notes. | Two dots. |\n| 2 — Check | Count again. | Keep the dots. | |\n```";
  const created = await route(new Request("http://localhost/api/narrations", { method: "POST", headers: { "x-user-id": "alice", "Content-Type": "application/json" }, body: JSON.stringify({ markdown }) }), "/api/narrations");
  expect(created.status).toBe(202);
  const job = await created.json(); await service.idle();
  expect(sent).toEqual(["One.", "Two.", "Two dots.", "Count again."]);
  const status = await route(new Request(`http://localhost${job.statusUrl}`, { headers: { "x-user-id": "alice" } }), job.statusUrl);
  const result = await status.json(); expect(result.status).toBe("complete");
  const pkg = result.package;
  expect(pkg.schemaVersion).toBe(1);
  expect(pkg.scenes.map((s: { id: string }) => s.id)).toEqual(["scene-1", "scene-2"]);
  expect(pkg.scenes[0].pauses[0]).toMatchObject({ startSec: 2, endSec: 2.5 });
  expect(pkg.scenes[0].utterances[1].words[0].startSec).toBe(2.5);
  expect(pkg.scenes[1].startSec).toBe(6.5);
  expect(pkg.durationSec).toBe(8.5);
  expect(buildSceneAgentInput(pkg, "scene-1").scene.context).toContain("Do not speak these notes.");
  const preview = buildNarrationPreview(pkg);
  for (const scene of preview.scenes) await validateSceneAgainstNarration(scene.source, pkg, scene.id);
  const bytes = new Uint8Array(await readFile(await service.audio("shared-user", job.id, pkg.scenes[0].audio.id)));
  expect(bytes.slice(44 + 2 * 24000 * 2, 44 + 2.5 * 24000 * 2).some(Boolean)).toBe(false);
});

test("ambiguous scripts fail before provider calls, and failed retry parsing cannot strand a job as queued", async () => {
  const { service, root, inputs } = await setup(async () => { throw new NarrationError("PROVIDER_REJECTED", "Test failure", 502, true); });
  await expect(service.submit("alice", "Narration: One [pause a bit] two.")).rejects.toMatchObject({ code: "SCRIPT_FORMAT" });
  expect(inputs).toHaveLength(0);
  const job = await service.submit("alice", "Voiceover: One."); await service.idle();
  expect((await service.get("alice", job.id)).status).toBe("failed");
  await atomicWrite(join(root, job.id, "script.md"), "Narration: One [pause a bit] two.");
  await expect(service.retry("alice", job.id)).rejects.toMatchObject({ code: "SCRIPT_FORMAT" });
  expect((await service.get("alice", job.id)).status).toBe("failed");
  expect(inputs).toHaveLength(1);
});

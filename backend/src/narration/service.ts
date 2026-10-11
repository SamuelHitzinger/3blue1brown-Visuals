import { mkdir, readFile, readdir, rename, unlink, writeFile } from "node:fs/promises";
import { setTimeout as delay } from 'node:timers/promises';
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { alignWords, validateAlignment } from "./alignment.js";
import { hash, joinPcm, sampleCount, SAMPLE_RATE, silence, wav } from "./audio.js";
import { createElevenLabs, settingsFromEnv } from "./elevenlabs.js";
import type { SpeechProvider } from "./elevenlabs.js";
import { NarrationError, publicError } from "./errors.js";
import { parseStoryline } from "./markdown.js";
import { sceneAgentMarkdown } from "./handoff.js";
import type { AudioAsset, NarrationJob, NarrationPackageV1, NarrationScene, NarrationScenePackage, RawAlignment, ScriptBlock, SpeechResult, Storyline, SynthesisInput } from "./types.js";
import { logEvent } from '../logging.js';

const PROCESSING_VERSION = "narration-v1.1";
const validId = /^[a-f0-9]{64}$/;
export async function atomicWrite(path: string, data: string | Uint8Array) {
  const tmp = `${path}.${randomUUID()}.tmp`;
  try {
    await writeFile(tmp, data, { mode: 0o600 });
    for (let attempt = 0; ; attempt++) {
      try { await rename(tmp, path); return; }
      catch (error) {
        // Windows readers/antivirus may briefly prevent replacement. Never unlink
        // the destination: readers must always see either the old or new state.
        const code = (error as NodeJS.ErrnoException).code;
        if (attempt >= 4 || !['EPERM', 'EACCES', 'EBUSY'].includes(code ?? '')) throw error;
        await delay(10 * 2 ** attempt);
      }
    }
  } catch (error) { await unlink(tmp).catch(() => {}); throw error; }
}
async function json<T>(path: string): Promise<T> { return JSON.parse(await readFile(path, "utf8")); }
function split(text: string): string[] {
  const parts: string[] = [];
  while (text.length > 8000) {
    const prefix = text.slice(0, 8001);
    const boundaries = [...prefix.matchAll(/[.!?]\s+/g)];
    const sentence = boundaries.at(-1);
    const at = sentence && sentence.index! > 1000 ? sentence.index! + 1 : prefix.lastIndexOf(" ");
    if (at <= 0) throw new NarrationError("SCRIPT_CHUNK", "A spoken word exceeds the speech request limit.");
    parts.push(text.slice(0, at).trim()); text = text.slice(at).trim();
  }
  if (text) parts.push(text); return parts;
}
export function chunkStoryline(story: Storyline): Storyline {
  return { ...story, beats: story.beats.map(beat => ({ ...beat, blocks: beat.blocks.flatMap((b): ScriptBlock[] => {
    if (b.kind === "pause") return [b];
    const parts = split(b.text);
    return parts.map((text, index) => ({ ...b, text, id: parts.length === 1 ? b.id : `${b.id}.c${index + 1}` }));
  }) })) };
}
export class NarrationService {
  readonly root: string;
  readonly provider: SpeechProvider;
  readonly available: boolean;
  private initialized?: Promise<void>;
  private mutations: Promise<unknown> = Promise.resolve();
  private work = new Set<Promise<void>>();
  constructor(options: { root?: string; provider?: SpeechProvider } = {}) {
    this.root = resolve(options.root ?? process.env.NARRATION_DATA_DIR ?? ".narration");
    this.provider = options.provider ?? createElevenLabs(settingsFromEnv());
    this.available = Boolean(options.provider || (process.env.ELEVENLABS_API_KEY && this.provider.settings.voiceId));
  }
  private dir(id: string) {
    if (!validId.test(id)) throw new NarrationError("NOT_FOUND", "Narration not found.", 404);
    return join(this.root, id);
  }
  private initialize() {
    return this.initialized ??= (async () => {
      await mkdir(this.root, { recursive: true, mode: 0o700 });
      for (const entry of await readdir(this.root, { withFileTypes: true })) {
        if (!entry.isDirectory() || !validId.test(entry.name)) continue;
        try {
          const job = await json<NarrationJob>(join(this.dir(entry.name), "job.json"));
          if (job.status === "running" || job.status === "queued") {
            job.status = "interrupted";
            job.error = { code: "INTERRUPTED", message: "The server stopped during narration. Completed chunks are saved; explicitly retry to resume. The last request may already have been billed.", retryable: true };
            await this.saveJob(job);
            logEvent('narration.interrupted', { narrationId: job.id, completedChunks: job.completedChunks, totalChunks: job.totalChunks }, 'warn');
          }
        } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
      }
    })();
  }
  private async saveJob(job: NarrationJob) {
    job.updatedAt = new Date().toISOString();
    await atomicWrite(join(this.dir(job.id), "job.json"), JSON.stringify(job));
  }
  private serial<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.mutations.then(operation); this.mutations = result.catch(() => undefined); return result;
  }
  async get(owner: string, id: string): Promise<NarrationJob> {
    await this.initialize();
    let job: NarrationJob;
    try { job = await json<NarrationJob>(join(this.dir(id), "job.json")); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") throw new NarrationError("NOT_FOUND", "Narration not found.", 404);
      throw error;
    }
    if (job.owner !== owner) throw new NarrationError("NOT_FOUND", "Narration not found.", 404);
    return job;
  }
  submit(owner: string, markdown: string): Promise<NarrationJob> {
    return this.serial(async () => {
      const story = chunkStoryline(parseStoryline(markdown));
      if (!this.available) throw new NarrationError("NOT_CONFIGURED", "Narration requires ELEVENLABS_API_KEY and a verified ELEVENLABS_VOICE_ID.", 503);
      await this.initialize();
      // Include the original document too: a changed source must never receive stale source ranges.
      const id = hash(JSON.stringify({ owner, story, settings: this.provider.settings, version: PROCESSING_VERSION }));
      try { return await this.get(owner, id); }
      catch (error) { if (!(error instanceof NarrationError) || error.code !== "NOT_FOUND") throw error; }
      await mkdir(this.dir(id), { recursive: true, mode: 0o700 });
      const createdAt = new Date().toISOString();
      const job: NarrationJob = { id, owner, status: "queued", settings: structuredClone(this.provider.settings), createdAt, updatedAt: createdAt,
        completedChunks: 0, totalChunks: story.beats.flatMap(b => b.blocks).filter(b => b.kind === "speech").length };
      await atomicWrite(join(this.dir(id), "script.md"), markdown);
      await this.saveJob(job); this.enqueue(job, story); return structuredClone(job);
    });
  }
  retry(owner: string, id: string): Promise<NarrationJob> {
    return this.serial(async () => {
      const job = await this.get(owner, id);
      if (job.status === "complete" || job.status === "running" || job.status === "queued") return job;
      if (!this.available) throw new NarrationError("NOT_CONFIGURED", "Configure ElevenLabs before retrying.", 503);
      if (JSON.stringify(job.settings) !== JSON.stringify(this.provider.settings)) throw new NarrationError("SETTINGS_CHANGED", "Narration settings have changed; submit the script as a new job.", 409);
      const story = chunkStoryline(parseStoryline(await readFile(join(this.dir(id), "script.md"), "utf8")));
      job.status = "queued"; delete job.error;
      await this.saveJob(job);
      this.enqueue(job, story);
      return structuredClone(job);
    });
  }
  private enqueue(job: NarrationJob, story: Storyline) {
    logEvent('narration.queued', { narrationId: job.id, totalChunks: job.totalChunks });
    const work = this.run(job, story).catch(() => {
      // run normally persists failure; reaching here means that persistence also failed.
      logEvent('narration.persistence_failed', { narrationId: job.id, code: 'PERSISTENCE' }, 'error');
    }).finally(() => { this.work.delete(work); });
    this.work.add(work);
  }
  async idle() { await this.mutations; await Promise.all(this.work); }
  async package(owner: string, id: string): Promise<NarrationPackageV1> {
    const job = await this.get(owner, id);
    if (job.status !== "complete") throw new NarrationError("NOT_READY", "Narration is not complete.", 409);
    return json(join(this.dir(id), "narration.json"));
  }
  async scenePackage(owner: string, id: string, index: number): Promise<NarrationScenePackage | undefined> {
    const job = await this.get(owner, id);
    if (job.status === 'complete') return this.package(owner, id);
    try {
      const pkg = await json<NarrationScenePackage>(join(this.dir(id), 'progress.json'));
      return pkg.scenes[index] ? pkg : undefined;
    } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined; throw error; }
  }
  async artifact(owner: string, id: string, name: "scene-agent.md" | "alignment.raw.json") {
    await this.package(owner, id); return readFile(join(this.dir(id), name), "utf8");
  }
  async audio(owner: string, id: string, assetId: string): Promise<string> {
    const job = await this.get(owner, id);
    const pkg = job.status === 'complete' ? await this.package(owner, id) : await this.scenePackage(owner, id, 0);
    const assets = [...(pkg?.scenes.map(s => s.audio) ?? []), ...((pkg && 'combinedAudio' in pkg) ? [pkg.combinedAudio as AudioAsset] : [])];
    if (!assets.some(a => a.id === assetId)) throw new NarrationError("NOT_FOUND", "Audio asset not found.", 404);
    return join(this.dir(id), `${assetId}.wav`);
  }
  private async speech(job: NarrationJob, input: SynthesisInput): Promise<SpeechResult> {
    const key = hash(JSON.stringify({ input, settings: job.settings, version: PROCESSING_VERSION }));
    const path = join(this.dir(job.id), `chunk-${key}.json`);
    try {
      const cached = await json<Omit<SpeechResult, "pcm"> & { pcmBase64: string }>(path);
      const pcm = new Uint8Array(Buffer.from(cached.pcmBase64, "base64"));
      validateAlignment(cached.normalizedAlignment, sampleCount(pcm) / SAMPLE_RATE);
      logEvent('narration.chunk_reused', { narrationId: job.id, completedChunks: job.completedChunks, cached: true });
      return { ...cached, pcm };
    } catch (error) {
      const missing = (error as NodeJS.ErrnoException).code === 'ENOENT';
      const corrupt = error instanceof SyntaxError || error instanceof TypeError
        || (error instanceof NarrationError && error.code === 'ALIGNMENT_INVALID');
      if (!missing && !corrupt) throw error;
      if (corrupt) {
        await unlink(path);
        logEvent('narration.chunk_invalidated', { narrationId: job.id, code: 'ALIGNMENT_INVALID' }, 'warn');
      }
    }
    const started = performance.now();
    logEvent('narration.speech_started', { narrationId: job.id, completedChunks: job.completedChunks, totalChunks: job.totalChunks });
    const result = await this.provider.synthesize(input);
    validateAlignment(result.normalizedAlignment, sampleCount(result.pcm) / SAMPLE_RATE);
    // A single atomic cache artifact cannot expose audio without its matching alignment after a crash.
    await atomicWrite(path, JSON.stringify({ ...result, pcm: undefined, pcmBase64: Buffer.from(result.pcm).toString("base64") }));
    logEvent('narration.speech_completed', { narrationId: job.id, completedChunks: job.completedChunks + 1, totalChunks: job.totalChunks, elapsedMs: Math.round(performance.now() - started) });
    return result;
  }
  private async run(job: NarrationJob, story: Storyline) {
    const started = performance.now();
    logEvent('narration.started', { narrationId: job.id, totalChunks: job.totalChunks });
    try {
      job.status = "running"; job.completedChunks = 0; await this.saveJob(job);
      const speeches = story.beats.flatMap(b => b.blocks).filter(b => b.kind === "speech");
      let speechIndex = 0, lessonSamples = 0;
      const scenes: NarrationScene[] = [], allPcm: Uint8Array[] = [], raw: RawAlignment[] = [];
      const saveAudio = async (id: string, pcm: Uint8Array): Promise<AudioAsset> => {
        const bytes = wav(pcm);
        await atomicWrite(join(this.dir(job.id), `${id}.wav`), bytes);
        return { id, url: `/api/narrations/${job.id}/audio/${id}`, sha256: hash(bytes), sampleCount: sampleCount(pcm) };
      };
      for (const beat of story.beats) {
        const parts: Uint8Array[] = [];
        let samples = 0;
        const scene: NarrationScene = { id: beat.id, title: beat.title, context: beat.context, startSec: lessonSamples / SAMPLE_RATE, durationSec: 0,
          audio: undefined!, utterances: [], pauses: [] };
        for (const block of beat.blocks) {
          const offsetSec = samples / SAMPLE_RATE;
          if (block.kind === "pause") {
            const pcm = silence(block.durationSec); parts.push(pcm); samples += pcm.length / 2;
            if (lessonSamples + samples > 1800 * SAMPLE_RATE) throw new NarrationError("AUDIO_LIMIT", "Narration exceeds the thirty-minute audio limit; split the lesson.");
            scene.pauses.push({ id: block.id, startSec: offsetSec, endSec: samples / SAMPLE_RATE }); continue;
          }
          const input = { text: block.text, previousText: speeches[speechIndex - 1]?.text.slice(-1000) ?? "", nextText: speeches[speechIndex + 1]?.text.slice(0, 1000) ?? "" };
          const result = await this.speech(job, input);
          const aligned = alignWords(result.normalizedAlignment, block.id, offsetSec, sampleCount(result.pcm) / SAMPLE_RATE);
          parts.push(result.pcm); samples += sampleCount(result.pcm);
          if (lessonSamples + samples > 1800 * SAMPLE_RATE) throw new NarrationError("AUDIO_LIMIT", "Narration exceeds the thirty-minute audio limit; split the lesson.");
          scene.utterances.push({ id: block.id, role: block.role, text: block.text, spokenText: aligned.text, source: block.source,
            startSec: offsetSec, endSec: samples / SAMPLE_RATE, words: aligned.words, sentences: aligned.sentences });
          raw.push({ sceneId: beat.id, utteranceId: block.id, offsetSec, requestId: result.requestId, original: result.alignment, normalized: result.normalizedAlignment });
          speechIndex++; job.completedChunks = speechIndex; await this.saveJob(job);
        }
        const pcm = joinPcm(parts); allPcm.push(pcm); scene.durationSec = samples / SAMPLE_RATE;
        scene.audio = await saveAudio(`${job.id}.${beat.id}`, pcm);
        lessonSamples += samples; scenes.push(scene);
        // Audio is durable before its matching timing packet becomes visible.
        await atomicWrite(join(this.dir(job.id), 'progress.json'), JSON.stringify({
          id: job.id, scriptHash: hash(story.markdown), totalScenes: story.beats.length, scenes,
        } satisfies NarrationScenePackage));
        logEvent('narration.scene_ready', { narrationId: job.id, sceneIndex: scenes.length - 1, completedChunks: job.completedChunks, totalChunks: job.totalChunks });
      }
      const pkg: NarrationPackageV1 = { schemaVersion: 1, id: job.id, title: story.title, scriptHash: hash(story.markdown), settings: job.settings,
        sampleRate: SAMPLE_RATE, durationSec: lessonSamples / SAMPLE_RATE, scenes, combinedAudio: await saveAudio(`${job.id}.full`, joinPcm(allPcm)) };
      await atomicWrite(join(this.dir(job.id), "alignment.raw.json"), JSON.stringify(raw));
      await atomicWrite(join(this.dir(job.id), "narration.json"), JSON.stringify(pkg, null, 2));
      await atomicWrite(join(this.dir(job.id), "scene-agent.md"), sceneAgentMarkdown(pkg));
      job.status = "complete"; delete job.error; await this.saveJob(job);
      logEvent('narration.completed', { narrationId: job.id, sceneCount: scenes.length, completedChunks: job.completedChunks, totalChunks: job.totalChunks, elapsedMs: Math.round(performance.now() - started) });
    } catch (error) {
      const failure = publicError(error); job.status = "failed";
      logEvent('narration.failed', { narrationId: job.id, code: failure.code, completedChunks: job.completedChunks, totalChunks: job.totalChunks, elapsedMs: Math.round(performance.now() - started) }, 'error');
      job.error = { code: failure.code, message: failure.message, retryable: failure.retryable }; await this.saveJob(job);
    }
  }
}

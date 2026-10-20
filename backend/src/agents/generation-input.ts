import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import type { Generator, GenerationContext } from '../videos.js';
import { parseStoryline } from '../narration/markdown.js';
import { atomicWrite } from '../narration/service.js';
import type { NarrationService } from '../narration/service.js';
import { buildSubtitlePackage } from '../narration/subtitles.js';
import { hash } from '../narration/audio.js';
import type { NarrationScenePackage } from '../narration/types.js';
import { AgentError } from './config.js';
import type { AgentRunner } from './runtime.js';
import { parsePlannedLesson, validateStory } from './planning.js';
import type { LessonPlan } from './planning.js';
import { authorReviewedLesson } from './editorial.js';
import { logEvent, logStage } from '../logging.js';

export async function readSaved(path: string): Promise<string | undefined> {
  try { return await readFile(path, "utf8"); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined; throw error; }
}

/** Resume the approved lesson without rewriting its script or paid speech identity. */
export async function prepareLesson(runner: AgentRunner, request: Parameters<Generator>[0], directory: string, context: GenerationContext,
  capabilities: Parameters<typeof authorReviewedLesson>[6] = {}) {
  const { owner, videoId, signal } = context;
  const fingerprint = createHash("sha256").update(JSON.stringify({ owner, request })).digest("hex");
  const prior = await readSaved(join(directory, "request.sha256"));
  if (prior && prior !== fingerprint) throw new AgentError("CONTEXT", "Saved generation belongs to a different request.");
  if (!prior) await atomicWrite(join(directory, "request.sha256"), fingerprint);
  const lessonPath = join(directory, 'lesson.json');
  const cachedLesson = await readSaved(lessonPath);
  let plan: LessonPlan | undefined;
  let markdown: string | undefined;
  let legacyPlan = false;
  let instructionVersion: number | undefined;
  if (cachedLesson) {
    instructionVersion = JSON.parse(cachedLesson).instructionVersion;
    legacyPlan = instructionVersion === undefined;
    const lesson = parsePlannedLesson(cachedLesson, request, { legacy: legacyPlan });
    markdown = lesson.markdown; plan = lesson.plan;
  } else {
    markdown = await readSaved(join(directory, 'script.md')); // Resume videos authored before structured planning.
    legacyPlan = !!markdown;
  }
  if (!markdown) {
    context.onProgress?.({ stage: 'script' });
    const lesson = await logStage({ videoId, stage: 'script' }, () => authorReviewedLesson(runner, request, directory, signal, context.images, videoId, capabilities));
    markdown = lesson.markdown; plan = lesson.plan; instructionVersion = lesson.instructionVersion;
    signal.throwIfAborted();
    await atomicWrite(join(directory, 'storyline.prompt.md'), await readFile(join(directory, 'editorial', lesson.editorialReview.runId,
      `lesson-draft-${lesson.editorialReview.attempt}.prompt.md`), 'utf8'));
    // The atomic envelope is authoritative; script.md is a readable export for local review.
    await atomicWrite(lessonPath, JSON.stringify(lesson, null, 2));
    await atomicWrite(join(directory, "script.md"), markdown);
  } else logEvent('script.reused', { videoId, cached: true });
  const story = parseStoryline(markdown); validateStory(story);
  return { markdown, story, plan, legacyPlan, instructionVersion };
}

/** Wait for one durable speech scene, or reuse the deterministic subtitle timing. */
export async function prepareNarration(narration: NarrationService, request: Parameters<Generator>[0], markdown: string,
  story: ReturnType<typeof parseStoryline>, directory: string, index: number, context: GenerationContext): Promise<NarrationScenePackage> {
  const { owner, videoId, signal } = context;
  if (request.narrationMode === 'subtitles') {
    const path = join(directory, 'subtitles.json');
    const cached = await readSaved(path);
    const packet: NarrationScenePackage = cached ? JSON.parse(cached) : buildSubtitlePackage(story);
    if (packet.scriptHash !== hash(markdown) || packet.timingBasis !== 'subtitle-reading') throw new AgentError('CONTEXT', 'Subtitle timing belongs to a different script.');
    if (!cached) await atomicWrite(path, JSON.stringify(packet));
    return packet;
  } else {
    const narrationId = await readSaved(join(directory, "narration-id"));
    const job = narrationId ? await narration.get(owner, narrationId) : await narration.submit(owner, markdown);
    if (!narrationId) await atomicWrite(join(directory, "narration-id"), job.id);
    if (job.status === 'interrupted' || job.status === 'failed') await narration.retry(owner, job.id);
    return await logStage({ videoId, narrationId: job.id, stage: 'narration', sceneIndex: index }, async () => {
      // Poll only local durable state; the speech service owns its work and retry policy.
      while (true) {
        signal.throwIfAborted();
        const ready = await narration.scenePackage(owner, job.id, index);
        if (ready) return ready;
        const status = await narration.get(owner, job.id);
        if (status.status === "failed" || status.status === "interrupted") throw new AgentError(status.error?.code ?? "NARRATION", "Narration is waiting for recovery.");
        await new Promise<void>((resolve, reject) => {
          const abort = () => { clearTimeout(timer); reject(signal.reason); };
          const timer = setTimeout(() => { signal.removeEventListener("abort", abort); resolve(); }, 200);
          signal.addEventListener("abort", abort, { once: true });
        });
      }
    });
  }
}

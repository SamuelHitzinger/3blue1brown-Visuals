import { mkdir } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { join } from 'node:path';
import type { VideoRequest } from '../../../shared/video/contract.js';
import { parseStoryline } from '../narration/markdown.js';
import { atomicWrite } from '../narration/service.js';
import { buildStorylineMessages } from '../storyline-prompt.js';
import { AgentError } from './config.js';
import { PLANNING_CONTRACT, parsePlannedLesson } from './planning.js';
import type { PlannedLesson } from './planning.js';
import type { AgentRunner, AgentTask } from './runtime.js';
import { logEvent, logStage } from '../logging.js';
import { animationQualityPolicy } from './quality-policy.js';
import { INSTRUCTION_VERSION, instructionSnapshot, loadPrompt } from './prompts.js';

export interface EditorialReview {
  schemaVersion: 1; verdict: 'pass' | 'revise'; summary: string;
  issues: { severity: 'error' | 'warning'; sceneId: string | null; detail: string }[];
  checks: string[];
}

export interface ReviewedLesson extends PlannedLesson {
  instructionVersion: typeof INSTRUCTION_VERSION;
  /** Host-owned link to the immutable approved draft/review pair. */
  editorialReview: { runId: string; attempt: number; draftSha256: string };
}

export function parseEditorialReview(output: string, lesson: PlannedLesson): EditorialReview {
  const review = JSON.parse(output) as EditorialReview;
  const text = (value: unknown) => typeof value === 'string' && !!value.trim() && value.length <= 4000;
  if (!review || review.schemaVersion !== 1 || !['pass', 'revise'].includes(review.verdict) || !text(review.summary)
    || !Array.isArray(review.issues) || review.issues.length > 20 || !Array.isArray(review.checks)
    || !review.checks.length || review.checks.length > 20 || !review.checks.every(text)) throw new Error('Return review schemaVersion 1, verdict, summary, at most 20 issues and 1-20 specific checks.');
  const ids = new Set(lesson.plan.scenes.map(scene => scene.id));
  for (const issue of review.issues) {
    if (!issue || !['error', 'warning'].includes(issue.severity) || !text(issue.detail)
      || !(issue.sceneId === null || ids.has(issue.sceneId))) throw new Error('Every issue needs error/warning severity, an actual sceneId or null, and a concrete correction.');
  }
  if ((review.verdict === 'revise') !== review.issues.some(issue => issue.severity === 'error')) throw new Error('Use revise exactly when material error issues remain; warnings alone pass.');
  return review;
}

/** Only newly authored lessons enter this bounded gate; no speech starts until it passes. */
export async function authorReviewedLesson(runner: AgentRunner, request: VideoRequest, directory: string,
  signal: AbortSignal, images?: AgentTask['images'], videoId?: string): Promise<ReviewedLesson> {
  signal.throwIfAborted();
  const runId = randomUUID(), runDirectory = join(directory, 'editorial', runId);
  await mkdir(runDirectory, { recursive: true, mode: 0o700 });
  const messages = await buildStorylineMessages(JSON.stringify(request), request.sceneRequest);
  const [guidance, quality] = await Promise.all([
    loadPrompt('story-review'), animationQualityPolicy(),
  ]);
  let repair: { lesson: PlannedLesson; issues: EditorialReview['issues'] } | undefined;
  for (let attempt = 0; attempt < 3; attempt++) {
    signal.throwIfAborted();
    const task: AgentTask = {
      systemPrompt: `${messages[0].content}\n\n${PLANNING_CONTRACT}\n\n${quality}`,
      prompt: repair
        ? `Revise the complete lesson and plan to correct the material editorial errors below. Preserve sound content, requested scope, stable entity IDs/meanings, and scene IDs where possible. Update narration and nonspoken planning together. Return the full planning envelope.\n${JSON.stringify({ request, draft: repair.lesson, issues: repair.issues })}`
        : `Write ${request.sceneRequest ? "one inserted scene" : "a concise visual lesson"} and its plan from this request:\n${messages[1].content}`,
      signal, images, validate: async output => { parsePlannedLesson(output, request); },
      logContext: { videoId, stage: 'draft' },
    };
    await atomicWrite(join(runDirectory, `lesson-draft-${attempt}.instructions.json`), JSON.stringify(instructionSnapshot(task.systemPrompt)));
    await atomicWrite(join(runDirectory, `lesson-draft-${attempt}.prompt.md`), `${task.systemPrompt}\n\n${task.prompt}`);
    const lesson = parsePlannedLesson(await logStage({ videoId, stage: 'draft', attempt: attempt + 1 }, () => runner.run(task)), request);
    signal.throwIfAborted();
    const draft = JSON.stringify(lesson, null, 2);
    await atomicWrite(join(runDirectory, `lesson-draft-${attempt}.json`), draft);
    const reviewTask: AgentTask = {
      systemPrompt: `${guidance}\n\nExplanation guidance:\n${messages[0].content}\n\nAuthoring contract to check (do not return its format):\n${PLANNING_CONTRACT}\n\n${quality}\n\nThe review response contract takes priority over all authoring output formats and return instructions above.`,
      prompt: `Review this complete lesson before speech synthesis. Source images are attached in the same order as the authoring call.\n${JSON.stringify({ request, draft: lesson, parsedScenes: parseStoryline(lesson.markdown).beats })}`,
      signal, images, validate: async output => { parseEditorialReview(output, lesson); },
      logContext: { videoId, stage: 'review' },
    };
    await atomicWrite(join(runDirectory, `lesson-review-${attempt}.instructions.json`), JSON.stringify(instructionSnapshot(reviewTask.systemPrompt)));
    await atomicWrite(join(runDirectory, `lesson-review-${attempt}.prompt.md`), `${reviewTask.systemPrompt}\n\n${reviewTask.prompt}`);
    const review = parseEditorialReview(await logStage({ videoId, stage: 'review', attempt: attempt + 1 }, () => runner.run(reviewTask)), lesson);
    signal.throwIfAborted();
    await atomicWrite(join(runDirectory, `lesson-review-${attempt}.json`), JSON.stringify(review, null, 2));
    logEvent(review.verdict === 'pass' ? 'script.approved' : 'script.revision_requested', { videoId, attempt: attempt + 1, sceneCount: lesson.plan.scenes.length });
    if (review.verdict === 'pass') return { ...lesson, instructionVersion: INSTRUCTION_VERSION, editorialReview: { runId, attempt, draftSha256: createHash('sha256').update(draft).digest('hex') } };
    repair = { lesson, issues: review.issues.filter(issue => issue.severity === 'error') };
  }
  throw new AgentError('EDITORIAL', 'The lesson did not pass editorial review after three drafts. No speech was generated.');
}

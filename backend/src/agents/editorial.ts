import { mkdir, readFile, readdir, stat, rm } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { join } from 'node:path';
import type { VideoRequest } from '../../../shared/video/contract.js';
import { parseStoryline } from '../narration/markdown.js';
import { atomicWrite } from '../narration/service.js';
import { buildStorylineMessages } from '../storyline-prompt.js';
import { AgentError } from './config.js';
import { MAX_REVIEW_ROUNDS, runWithValidationRecovery } from './recovery.js';
import { PLANNING_CONTRACT, parsePlannedLesson } from './planning.js';
import type { PlannedLesson } from './planning.js';
import type { AgentRunner, AgentTask } from './runtime.js';
import { logEvent, logStage } from '../logging.js';
import { INSTRUCTION_VERSION, instructionSnapshot, loadPrompt } from './prompts.js';
import { bundledModelCatalog } from '../bundled-models.js';
import { compactVideoRequestContext } from '../scene-requests.js';
import { prepareStylePacket, styleAudit, styleImages, styleInstructions } from './visual-references.js';

export interface EditorialReview {
  schemaVersion: 1; verdict: 'pass' | 'revise'; summary: string;
  issues: { severity: 'error' | 'warning'; sceneId: string | null; detail: string }[];
  checks: string[];
}

export interface ReviewedLesson extends PlannedLesson {
  instructionVersion: typeof INSTRUCTION_VERSION;
  /** Host-owned link to the immutable approved draft/review pair. */
  editorialReview: { runId: string; attempt: number; draftSha256: string };
  visualReferences?: ReturnType<typeof styleAudit>;
}

export interface EditorialCapabilities {
  /** Host-controlled catalog location; useful for isolated validation environments. */
  styleCatalogPath?: string;
  publishModel?: AgentTask['publishModel'];
  modelAssets?: () => unknown;
  modelAssetContext?: () => unknown;
}

type EditorialRepair = { lesson: PlannedLesson; issues: EditorialReview['issues'] };
const requestDigest = (request: VideoRequest, images?: AgentTask['images']) => createHash('sha256')
  .update(JSON.stringify({ request, images: images ?? [] })).digest('hex');

async function saved(path: string): Promise<string | undefined> {
  try { return await readFile(path, 'utf8'); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined; throw error; }
}

/** Rejected pairs are repair material only. Every restart still creates a new, reviewed audit pair. */
async function latestRejectedDraft(directory: string, request: VideoRequest, images?: AgentTask['images']): Promise<EditorialRepair | undefined> {
  const digest = requestDigest(request, images);
  const candidates: { runDirectory: string; attempt: number; modified: number; legacy: boolean }[] = [];
  for (const run of await readdir(join(directory, 'editorial'), { withFileTypes: true })) {
    if (!run.isDirectory() || !/^[a-f0-9-]{36}$/.test(run.name)) continue;
    const runDirectory = join(directory, 'editorial', run.name), prior = await saved(join(runDirectory, 'request.sha256'));
    if (prior !== undefined && prior !== digest) continue;
    // Legacy audit prompts did not record images, so they cannot establish image identity.
    if (prior === undefined && images?.length) continue;
    for (const name of await readdir(runDirectory)) {
      const match = /^lesson-review-(0|[1-9]\d*)\.json$/.exec(name);
      const attempt = match ? Number(match[1]) : -1;
      if (Number.isInteger(attempt) && attempt >= 0 && attempt < MAX_REVIEW_ROUNDS) {
        candidates.push({ runDirectory, attempt, modified: (await stat(join(runDirectory, name))).mtimeMs, legacy: prior === undefined });
      }
    }
  }
  candidates.sort((a, b) => b.modified - a.modified || b.attempt - a.attempt);
  for (const { runDirectory, attempt, legacy } of candidates) {
    const draft = await saved(join(runDirectory, `lesson-draft-${attempt}.json`));
    const reviewed = await saved(join(runDirectory, `lesson-review-${attempt}.json`));
    if (!draft || !reviewed) continue;
    try {
      if (legacy) {
        const prompt = await saved(join(runDirectory, `lesson-review-${attempt}.prompt.md`));
        if (!prompt) continue;
        const context = JSON.parse(prompt.slice(prompt.lastIndexOf('\n') + 1));
        if (requestDigest(context.request) !== digest || JSON.stringify(context.draft) !== JSON.stringify(JSON.parse(draft))) continue;
      }
      const lesson = parsePlannedLesson(draft, request), review = parseEditorialReview(reviewed, lesson);
      if (review.verdict === 'revise') return { lesson, issues: review.issues.filter(issue => issue.severity === 'error') };
    } catch { /* Partial or invalid audits cannot supply a repair or an approval. */ }
  }
  return undefined;
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

/** Preserve each revision across recovery; no speech starts before approval. */
export async function authorReviewedLesson(runner: AgentRunner, request: VideoRequest, directory: string,
  signal: AbortSignal, images?: AgentTask['images'], videoId?: string, capabilities: EditorialCapabilities = {}): Promise<ReviewedLesson> {
  signal.throwIfAborted();
  const styles = await prepareStylePacket(JSON.stringify(compactVideoRequestContext(request)), join(directory, 'lesson.styles.json'),
    capabilities.styleCatalogPath, runner.routeStyles?.bind(runner), signal);
  const visualReferences = styleAudit(styles), attached = styleImages(styles, images);
  const molecular = styles.families.some(f => f.id === 'molecular-mechanisms');
  const styleGuidance = `${styleInstructions(styles)}${molecular ? '\n\n' + await loadPrompt('molecular-planning') : ''}\n\n${attached.roleMap}`;
  const contextHash = createHash('sha256').update(JSON.stringify({ requestDigest: requestDigest(request, images), instructionVersion: INSTRUCTION_VERSION, visualReferences })).digest('hex');
  const checkpoint = join(directory, 'editorial-state.json');
  type Progress = { contextHash: string; runId: string; attempt: number; lesson?: PlannedLesson;
    repair?: { lesson: PlannedLesson; issues: EditorialReview['issues'] } };
  let state: Progress = { contextHash, runId: randomUUID(), attempt: 0 };
  try {
    const saved = JSON.parse(await readFile(checkpoint, 'utf8')) as Progress;
    if (saved.contextHash === contextHash) state = saved;
  } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  const save = () => atomicWrite(checkpoint, JSON.stringify(state));
  const { runId } = state, runDirectory = join(directory, 'editorial', runId);
  await mkdir(runDirectory, { recursive: true, mode: 0o700 });
  await atomicWrite(join(runDirectory, 'request.sha256'), requestDigest(request, images));
  const modelCatalog=molecular ? await bundledModelCatalog() : [];
  const promptRequest = compactVideoRequestContext(request);
  const messages = await buildStorylineMessages('', request.sceneRequest);
  const modelContext = () => ({ modelCatalog, modelAssets: capabilities.modelAssets?.() ?? {}, modelAssetContext: capabilities.modelAssetContext?.() ?? {} });
  const guidance = await loadPrompt('story-review');
  if (!state.lesson && !state.repair && state.attempt === 0) {
    state.repair = await latestRejectedDraft(directory, request, images);
    if (state.repair) logEvent('script.repair_resumed', { videoId, sceneCount: state.repair.lesson.plan.scenes.length });
  }
  for (;;) {
    signal.throwIfAborted();
    const { attempt, repair } = state;
    if (attempt >= MAX_REVIEW_ROUNDS) throw new AgentError('RECOVERY_EXHAUSTED', 'Editorial review reached 50 rounds.');
    await save();
    if (attempt >= 3) {
      for (const phase of ['draft', 'review']) for (const suffix of ['json', 'instructions.json', 'prompt.md', 'diagnostics.json']) {
        await rm(join(runDirectory, `lesson-${phase}-${attempt - 3}.${suffix}`), { force: true });
      }
    }
    const draftPrompt = () => repair
      ? `Revise the complete lesson and plan to correct the material editorial errors below. Preserve sound content, requested scope, stable entity IDs/meanings, and scene IDs where possible. Update narration and nonspoken planning together. Return the full planning envelope.\n${JSON.stringify({ request: promptRequest, draft: repair.lesson, issues: repair.issues, ...modelContext() })}`
      : `Write ${request.sceneRequest ? "one inserted scene" : "a complete visual explanation at the pace required for understanding"} and its plan from this request:\n${JSON.stringify({ ...promptRequest, ...modelContext() })}`;
    const task: AgentTask = {
      systemPrompt: `${messages[0].content}\n\n${styleGuidance}\n\n${PLANNING_CONTRACT}${capabilities.publishModel ? '\n\nPrepare any required model with publish_model before finishing this plan. Use the returned asset ID, node names, and scientific provenance as evidence; modelAssets and modelAssetContext list assets already prepared for this job. The editorial reviewer receives updated prepared asset evidence.' : ''}`,
      prompt: draftPrompt(),
      signal, images: attached.images, publishModel: capabilities.publishModel, validate: async output => { parsePlannedLesson(output, request); },
      logContext: { videoId, stage: 'draft' },
    };
    await atomicWrite(join(runDirectory, `lesson-draft-${attempt}.instructions.json`), JSON.stringify(instructionSnapshot(task.systemPrompt)));
    await atomicWrite(join(runDirectory, `lesson-draft-${attempt}.prompt.md`), `${task.systemPrompt}\n\n${task.prompt}`);
    const lesson = state.lesson ?? parsePlannedLesson(await logStage({ videoId, stage: 'draft', attempt: attempt + 1 }, () => runWithValidationRecovery(runner, task,
      { diagnosticsPath: join(runDirectory, `lesson-draft-${attempt}.diagnostics.json`), prompt: draftPrompt })), request);
    signal.throwIfAborted();
    const draft = JSON.stringify(lesson, null, 2);
    await atomicWrite(join(runDirectory, `lesson-draft-${attempt}.json`), draft);
    state.lesson = lesson; await save();
    const reviewTask: AgentTask = {
      systemPrompt: `${guidance}\n\nExplanation guidance:\n${messages[0].content}\n\n${styleGuidance}\n\nAuthoring contract to check (do not return its format):\n${PLANNING_CONTRACT}\n\nThe review response contract takes priority over all authoring output formats and return instructions above.`,
      prompt: `Review this complete lesson before speech synthesis. Source images are attached in the same order as the authoring call.\n${JSON.stringify({ request: promptRequest, draft: lesson, parsedScenes: parseStoryline(lesson.markdown).beats, ...modelContext() })}`,
      signal, images: attached.images, validate: async output => { parseEditorialReview(output, lesson); },
      logContext: { videoId, stage: 'review' },
    };
    await atomicWrite(join(runDirectory, `lesson-review-${attempt}.instructions.json`), JSON.stringify(instructionSnapshot(reviewTask.systemPrompt)));
    await atomicWrite(join(runDirectory, `lesson-review-${attempt}.prompt.md`), `${reviewTask.systemPrompt}\n\n${reviewTask.prompt}`);
    const review = parseEditorialReview(await logStage({ videoId, stage: 'review', attempt: attempt + 1 }, () => runWithValidationRecovery(runner, reviewTask,
      { diagnosticsPath: join(runDirectory, `lesson-review-${attempt}.diagnostics.json`) })), lesson);
    signal.throwIfAborted();
    await atomicWrite(join(runDirectory, `lesson-review-${attempt}.json`), JSON.stringify(review, null, 2));
    logEvent(review.verdict === 'pass' ? 'script.approved' : 'script.revision_requested', { videoId, attempt: attempt + 1, sceneCount: lesson.plan.scenes.length });
    if (review.verdict === 'pass') return { ...lesson, instructionVersion: INSTRUCTION_VERSION, visualReferences, editorialReview: { runId, attempt, draftSha256: createHash('sha256').update(draft).digest('hex') } };
    state = { contextHash, runId, attempt: attempt + 1, repair: { lesson, issues: review.issues.filter(issue => issue.severity === 'error') } };
    await save();
  }
}

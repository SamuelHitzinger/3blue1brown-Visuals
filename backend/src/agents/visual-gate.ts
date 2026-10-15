import type { RenderModelAssets } from '../model-assets.js';
import { mkdir, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { compileSource } from 'animlib/core';
import type { CompiledScene, Frame } from 'animlib/core';
import type { AgentRunner, AgentTask, AgentRunMetrics } from './runtime.js';
import { renderSceneFrames } from './frame-renderer.js';
import type { FrameRenderer } from './frame-renderer.js';
import { applyVisualEdits, parseVisualVerification, sourceHash } from './visual-edits.js';
import type { VisualVerification } from './visual-edits.js';
import type { ScenePlan } from './planning.js';
import { loadPrompt } from './prompts.js';
import { atomicWrite } from '../atomic-write.js';
import { logStage, logEvent } from '../logging.js';
import { AgentError } from './config.js';
import { validationMessage } from './runtime.js';
import { runWithValidationRecovery, waitForRecovery } from './recovery.js';
import { planReviewEvidence, selectReviewImages } from './visual-evidence.js';
import type { ReviewEvidencePlan } from './visual-evidence.js';

export const DEFAULT_VISUAL_REVIEW_ROUNDS = 2;
const MAX_VISUAL_REVIEW_ROUNDS = 5;
const PROTOCOL_ATTEMPTS = 2;
const PATCH_ATTEMPTS = 3;
export const sampleReviewTimes = (scene: CompiledScene): number[] => planReviewEvidence(scene).samples.map(sample => sample.time);

export interface SceneVerificationInput {
  audioAssetId: string; endMode: 'hold' | 'advance'; scene: { id: string; durationSec: number };
  videoMode?: 'classic' | 'interactive'; legacyPlan?: boolean;
  /** Absent in historical scene packets, before targeted orbit became policy. */
  instructionVersion?: number;
  sceneBrief?: { speechCues?: Record<string, { startSec: number; endSec: number }> };
  previousFrame?: Frame; planning: { current?: ScenePlan };
}

export interface VisualGateInput {
  runner: AgentRunner; source: string; input: SceneVerificationInput;
  task: Pick<AgentTask,'systemPrompt'|'prompt'|'catalogTools'|'referenceTools'|'allowWeb'>;
  directory: string; index: number; videoId: string; signal: AbortSignal;
  validate: (source: string) => Promise<unknown>;
  renderFrames?: FrameRenderer;
  models?: RenderModelAssets;
  recoveryWait?: typeof waitForRecovery;
  /** Two reviews normally; explicit callers may request 1–5. Never bypasses approval. */
  maxReviewRounds?: number;
  /** Caller-owned product policy. Omitted only for the full-video workflow. */
  policy?: VisualReviewPolicy;
}

export interface VisualReviewPolicy {
  id: string;
  guidance: string;
  repairGuidance: string;
  styleReference?: NonNullable<AgentTask['images']>[number];
}

interface VisualProgress {
  contextHash: string;
  initialSourceSha256?: string;
  source: string;
  attempt: number;
  phase: 'review' | 'repair' | 'approved';
  history: VisualVerification[];
  rewrite?: boolean;
  sourceHashes?: string[];
  phaseAttempts?: Record<string, number>;
  rewrites?: number;
  terminal?: string;
  evidenceImages?: string[];
}

/** Every candidate must pass validation, actual rendering and independent review.
 * Normal path is one comprehensive review, one targeted repair and verification.
 */
export async function reviewGeneratedScene(options: VisualGateInput): Promise<string> {
  const { runner, input, directory, index, videoId, signal } = options;
  const wait = options.recoveryWait ?? waitForRecovery;
  const requestedRounds = options.maxReviewRounds ?? DEFAULT_VISUAL_REVIEW_ROUNDS;
  const maxReviewRounds = Number.isFinite(requestedRounds)
    ? Math.max(1, Math.min(MAX_VISUAL_REVIEW_ROUNDS, Math.floor(requestedRounds))) : DEFAULT_VISUAL_REVIEW_ROUNDS;
  signal.throwIfAborted();
  const policy = options.policy ?? await videoReviewPolicy();
  const { guidance, repairGuidance, styleReference } = policy;
  // Never resume an approval/repair checkpoint under a different product policy.
  const contextHash = sourceHash(JSON.stringify({ input, policy, authorContract: options.task.systemPrompt }));
  const initialSourceSha256 = sourceHash(options.source);
  const checkpoint = join(directory, `scene-${index}.visual-state.json`);
  const approvalPath = join(directory, `scene-${index}.visual-review.json`);
  let state: VisualProgress = { contextHash, initialSourceSha256, source: options.source, attempt: 0, phase: 'review', history: [] };
  let resumedCheckpoint = false;
  try {
    const saved = JSON.parse(await readFile(checkpoint, 'utf8')) as VisualProgress;
    if (saved.contextHash === contextHash && (saved.initialSourceSha256 === undefined || saved.initialSourceSha256 === initialSourceSha256)) {
      state = saved; resumedCheckpoint = true;
    }
  } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  state.initialSourceSha256 ??= initialSourceSha256;
  const save = () => atomicWrite(checkpoint, JSON.stringify(state));
  const exhaust = async (reason: string): Promise<never> => {
    state.terminal = reason;
    await save();
    await atomicWrite(join(directory, `scene-${index}.visual-failure.json`), JSON.stringify({
      approved: false, reason, attempt: state.attempt, sourceSha256: sourceHash(state.source), history: state.history,
    }, null, 2));
    throw new AgentError('RECOVERY_EXHAUSTED', reason);
  };
  // The receipt commits first so interruption before the final checkpoint or
  // generator scene write cannot discard independent approval. Legacy receipts
  // without context/source identity are deliberately not reusable.
  let receipt: { approved?: boolean; contextHash?: string; initialSourceSha256?: string; source?: string;
    sourceSha256?: string; attempt?: number; review?: unknown } | undefined;
  try { receipt = JSON.parse(await readFile(approvalPath, 'utf8')); }
  catch (error) { if (!(error instanceof SyntaxError) && (error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  if (receipt?.approved === true && receipt.contextHash === contextHash && receipt.initialSourceSha256 === initialSourceSha256
    && typeof receipt.source === 'string' && receipt.sourceSha256 === sourceHash(receipt.source)
    && Number.isInteger(receipt.attempt) && receipt.attempt! >= 0
    && (!resumedCheckpoint || state.source === receipt.source)) {
    let independentlyApproved = false;
    try { independentlyApproved = parseVisualVerification(JSON.stringify(receipt.review), input.scene.durationSec).approved; }
    catch { /* A malformed or rejected receipt cannot authorize publication. */ }
    if (independentlyApproved) {
      await options.validate(receipt.source);
      signal.throwIfAborted();
      state.source = receipt.source; state.attempt = receipt.attempt!; state.phase = 'approved';
      delete state.terminal;
      await save();
      return state.source;
    }
  }
  if (state.phase === 'approved') return exhaust('The approved checkpoint has no matching context and exact-source approval receipt.');
  if (state.terminal) throw new AgentError('RECOVERY_EXHAUSTED', state.terminal);
  state.sourceHashes ??= [sourceHash(state.source)];
  state.phaseAttempts ??= {};
  state.rewrites ??= 0;
  const authorContract = options.task.systemPrompt;
  const run = async (task: AgentTask, attemptDirectory: string, phase: 'review' | 'patch' | 'rewrite') => {
    const limit = phase === 'patch' ? PATCH_ATTEMPTS : PROTOCOL_ATTEMPTS;
    const key = `${state.attempt}:${phase}`;
    const remaining = limit - (state.phaseAttempts![key] ?? 0);
    if (remaining <= 0) {
      if (phase === 'patch') throw new AgentError('VALIDATION', 'Targeted patch submissions exhausted.');
      return exhaust(`Visual ${phase} protocol exhausted its ${limit} submissions.`);
    }
    let metrics: AgentRunMetrics | undefined;
    const started = performance.now();
    await atomicWrite(join(attemptDirectory, `${phase}.prompt.md`), `${task.systemPrompt}\n\n${task.prompt}`);
    const countedRunner: AgentRunner = { run: async nextTask => {
      state.phaseAttempts![key] = (state.phaseAttempts![key] ?? 0) + 1;
      await save();
      let validationRejected = false;
      try { return await runner.run({ ...nextTask, validate: nextTask.validate ? async output => {
        try { await nextTask.validate!(output); }
        catch (error) { validationRejected = true; throw error; }
      } : undefined }); }
      catch (error) {
        // Infrastructure failures retain their durable recovery path. Invalid
        // protocol attempts and interrupted processes cannot reset their budget.
        if (!validationRejected && !(error instanceof AgentError && ['VALIDATION', 'OUTPUT', 'TURN_LIMIT'].includes(error.code))) {
          state.phaseAttempts![key]--; await save();
        }
        throw error;
      }
    } };
    try {
      return await logStage({ videoId, sceneIndex: index, stage: phase === 'review' ? 'review' : 'repair', attempt: state.attempt }, () => runWithValidationRecovery(countedRunner, {
        ...task, catalogTools: options.task.catalogTools, referenceTools: options.task.referenceTools,
        allowWeb: options.task.allowWeb, onMetrics: value => { metrics = value; },
      }, { diagnosticsPath: join(attemptDirectory, `${phase}.diagnostics.json`), maxAttempts: remaining, wait }));
    } catch (error) {
      signal.throwIfAborted();
      if (phase !== 'patch' && error instanceof AgentError && ['VALIDATION', 'OUTPUT', 'TURN_LIMIT'].includes(error.code)) {
        return exhaust(`Visual ${phase} protocol exhausted its ${limit} submissions.`);
      }
      throw error;
    } finally {
      await atomicWrite(join(attemptDirectory, `${phase}.metrics.json`), JSON.stringify(metrics ?? { elapsedMs: performance.now() - started }, null, 2));
    }
  };
  for (;;) {
    signal.throwIfAborted();
    if (state.attempt >= maxReviewRounds) return exhaust(`Visual review reached its ${maxReviewRounds}-round budget without approval.`);
    const attemptDirectory = join(directory, `scene-${index}.visual`, String(state.attempt));
    await mkdir(attemptDirectory, { recursive: true });
    await save();
    // Keep rendered evidence bounded independently of the number of repairs.
    if (state.attempt >= 3) await rm(join(directory, `scene-${index}.visual`, String(state.attempt - 3)), { recursive: true, force: true });
    let images: AgentTask['images'];
    const loadImages = async (paths: string[]) => {
      const result: NonNullable<AgentTask['images']> = await Promise.all(paths.map(async path => ({
        type: 'image' as const, mimeType: 'image/png', data: (await readFile(path)).toString('base64'),
      })));
      if (styleReference) result.push(styleReference);
      return result;
    };
    if (state.phase === 'repair' && state.evidenceImages) images = await loadImages(state.evidenceImages);
    if (state.phase === 'review') {
      await atomicWrite(join(attemptDirectory, 'candidate.js'), state.source);
      let evidence: Awaited<ReturnType<FrameRenderer>> | undefined;
      let evidencePlan: ReviewEvidencePlan | undefined;
      let renderProblem: string | undefined;
      for (let renderAttempt = 0; renderAttempt < 2; renderAttempt++) {
        let validating = true;
        try {
          await options.validate(state.source);
          const compiled = await compileSource(state.source, { previous: input.previousFrame,
            models: Object.fromEntries(Object.entries(options.models?.assets ?? {}).map(([id, a]) => [id, a.metadata])) });
          evidencePlan = planReviewEvidence(compiled, state.history, input.sceneBrief?.speechCues);
          if (evidencePlan.uncoveredDefectTimes.length) return exhaust(`Known defect timestamps are outside the candidate duration or exceed the bounded evidence budget: ${JSON.stringify(evidencePlan.uncoveredDefectTimes)}. Approval requires their verification.`);
          validating = false;
          evidence = await (options.renderFrames ?? renderSceneFrames)({ source: state.source, previousFrame: input.previousFrame,
            models: options.models, times: evidencePlan.samples.map(sample => sample.time), directory: attemptDirectory, signal });
          break;
        } catch (error) {
          signal.throwIfAborted();
          // An unavailable renderer needs infrastructure recovery, not another model rewrite.
          if (!validating && !(error instanceof AgentError && error.code === 'RENDER_SOURCE')) throw error;
          renderProblem = validationMessage(error);
          await atomicWrite(join(attemptDirectory, 'render-error.json'), JSON.stringify({ detail: renderProblem }));
          if (renderAttempt === 0) await wait(1000, signal);
        }
      }
      if (evidence) {
        signal.throwIfAborted();
        const selectedImages = selectReviewImages(evidence, evidencePlan!);
        state.evidenceImages = selectedImages.map(image => image.path);
        images = await loadImages(state.evidenceImages);
        const sampleMap = selectedImages.map(({ path: _path, ...image }, i) => ({ image: i + 1, ...image }));
        const output = await run({
          systemPrompt: `${authorContract}\n\n${guidance}`,
          prompt: `Verify all supplied rendered evidence in one comprehensive pass. Contact sheets are reduced overview images read left-to-right, then top-to-bottom; each cell is one whole viewport. Native-frame images retain full viewport resolution for fine detail. Sampling is partial, not continuous-motion or interaction proof. Image map: ${JSON.stringify(sampleMap)}. Evidence plan: ${JSON.stringify(evidencePlan)}.${styleReference ? ' Last image is style reference.' : ''}\nEarlier verification (preserve corrections and check regressions): ${JSON.stringify(state.history)}\nAuthoritative request:\n${options.task.prompt}\nCurrent candidate source (SHA-256 ${sourceHash(state.source)}):\n${state.source}`,
          images, signal, outputMode: 'submit-only', logContext: { videoId, sceneIndex: index, stage: 'review' },
          validate: async output => { parseVisualVerification(output, input.scene.durationSec); },
        }, attemptDirectory, 'review');
        const review = parseVisualVerification(output, input.scene.durationSec);
        signal.throwIfAborted();
        await atomicWrite(join(attemptDirectory, 'review.json'), JSON.stringify({ sourceSha256: sourceHash(state.source), sampleMap, evidencePlan, ...review }, null, 2));
        if (review.approved) {
          await atomicWrite(approvalPath, JSON.stringify({ approved: true, contextHash, initialSourceSha256, source: state.source,
            sourceSha256: sourceHash(state.source), attempt: state.attempt, evidence, sampleMap, evidencePlan, review }, null, 2));
          state.phase = 'approved';
          await save();
          return state.source;
        }
        state.history = [...state.history, review].slice(-3);
        state.rewrite = false;
      } else {
        state.history = [...state.history, { approved: false, findings: [{ timeSec: null, objectIds: [],
          problem: `The candidate cannot be compiled/rendered reliably: ${renderProblem}`,
          fix: 'Simplify expensive geometry, loops and timeline construction. Preserve the authoring contract, timing, IDs and required interactions. Use supported animation APIs and keep within the existing compiler resource limits.',
        }] }].slice(-3);
        state.rewrite = true;
      }
      state.phase = 'repair';
      await save();
    }
    // This also guards a checkpoint interrupted after recording its last rejection.
    if (state.attempt + 1 >= maxReviewRounds) return exhaust(`Visual review reached its ${maxReviewRounds}-round budget without approval.`);
    if (hasRepeatedFinding(state.history)) return exhaust('The same demonstrated defect remains after two repairs.');
    const review = state.history.at(-1)!;
    const originalSource = state.source;
    const validatedPatches = new Map<string, string>();
    const validatePatch = async (output: string) => {
      signal.throwIfAborted();
      const cached = validatedPatches.get(output);
      if (cached !== undefined) return cached;
      const repaired = applyVisualEdits(output, originalSource, review.findings.length);
      await options.validate(repaired);
      signal.throwIfAborted();
      if (validatedPatches.size >= 4) validatedPatches.delete(validatedPatches.keys().next().value!);
      validatedPatches.set(output, repaired);
      return repaired;
    };
    if (!state.rewrite) {
      try {
        const patch = await run({
          systemPrompt: `${authorContract}\n\n${repairGuidance}`,
          prompt: `Repair these verified findings (zero-based indexes): ${JSON.stringify(review.findings)}.\nPreserve corrections from earlier reviews: ${JSON.stringify(state.history.slice(0, -1))}.\nAuthoritative request:\n${options.task.prompt}\nOriginal candidate sourceSha256: ${sourceHash(originalSource)}\n${originalSource}`,
          images, signal, outputMode: 'submit-only', logContext: { videoId, sceneIndex: index, stage: 'repair' },
          validate: async output => { await validatePatch(output); },
        }, attemptDirectory, 'patch');
        state.source = await validatePatch(patch);
        await atomicWrite(join(attemptDirectory, 'repair.json'), patch);
      } catch (error) {
        signal.throwIfAborted();
        if (!(error instanceof AgentError) || !['VALIDATION', 'OUTPUT', 'TURN_LIMIT'].includes(error.code)) throw error;
        state.rewrite = true;
        await save();
      }
    }
    if (state.rewrite) {
      if (state.rewrites >= 1 && !Object.hasOwn(state.phaseAttempts!, `${state.attempt}:rewrite`)) return exhaust('Visual recovery already used its one full regeneration.');
      if (!Object.hasOwn(state.phaseAttempts!, `${state.attempt}:rewrite`)) { state.rewrites++; await save(); }
      logEvent('scene.regenerating', { videoId, sceneIndex: index, attempt: state.attempt }, 'warn');
      state.source = await run({
        systemPrompt: `${authorContract}\n\nReturn complete replacement scene JavaScript, without markdown fences. Preserve the authoritative request, exact duration, inherited IDs, required controls and earlier corrections.`,
        prompt: `Repair this scene with a complete implementation. The targeted patch or rendering path could not finish. Simplify the implementation where needed; do not relax its required behavior.\nFindings: ${JSON.stringify(state.history)}\nAuthoritative request:\n${options.task.prompt}\nCurrent source:\n${originalSource}`,
        images, signal, outputMode: 'text', logContext: { videoId, sceneIndex: index, stage: 'repair' }, validate: async output => { await options.validate(output); },
      }, attemptDirectory, 'rewrite');
    }
    signal.throwIfAborted();
    const nextHash = sourceHash(state.source);
    if (state.sourceHashes.includes(nextHash)) return exhaust('Visual repair repeated a previously rejected source.');
    state.sourceHashes.push(nextHash);
    state.attempt++;
    state.phase = 'review';
    state.rewrite = false;
    delete state.evidenceImages;
    await save();
  }
}

/** Exact demonstrated-problem identity only; never infer stagnation from taste or fuzzy similarity. */
export function hasRepeatedFinding(history: VisualVerification[]): boolean {
  if (history.length < 3) return false;
  const keys = history.slice(-3).map(review => new Set(review.findings.map(finding => JSON.stringify([
    finding.timeSec, [...new Set(finding.objectIds)].sort(), finding.problem.trim().replace(/\s+/g, ' ').toLowerCase(),
  ]))));
  return [...keys[0]].some(key => keys.slice(1).every(set => set.has(key)));
}

async function videoReviewPolicy(): Promise<VisualReviewPolicy> {
  const [guidance, repairGuidance, style] = await Promise.all([
    loadPrompt('scene-verify'), loadPrompt('scene-repair'),
    readFile(new URL('../../prompts/visual-style-reference.jpg', import.meta.url)),
  ]);
  return { id: 'full-video', guidance, repairGuidance,
    styleReference: { type: 'image', mimeType: 'image/jpeg', data: style.toString('base64') } };
}

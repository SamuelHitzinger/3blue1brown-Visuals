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
import { atomicWrite } from '../narration/service.js';
import { logStage, logEvent } from '../logging.js';
import { AgentError } from './config.js';
import { validationMessage } from './runtime.js';
import { MAX_REVIEW_ROUNDS, runWithValidationRecovery, waitForRecovery } from './recovery.js';

/** Bound image cost while sampling actual action interiors, holds and camera transitions. */
export function sampleReviewTimes(scene: CompiledScene): number[] {
  const duration=scene.duration, times=new Set([0,Math.min(0.5,duration/4),duration]);
  const candidates=new Set<number>();
  for(let i=1;i<12;i++)candidates.add(duration*i/12);
  const cameraMids=scene.tracks.filter(t=>t.action.type==='camera').map(t=>t.start+t.duration/2);
  for(const t of cameraMids.slice(0,4))times.add(t);
  for(const track of scene.tracks)for(const t of [track.start,track.start+track.duration/2,track.start+track.duration])candidates.add(t);
  for(const event of scene.lifecycle)candidates.add(event.time);
  while(times.size<12) {
    let best:number|undefined,gap=1e-6;
    for(const t of candidates){if(t<0||t>duration)continue;const distance=Math.min(...[...times].map(other=>Math.abs(other-t)));if(distance>gap){best=t;gap=distance;}}
    if(best===undefined)break;times.add(best);
  }
  return [...times].sort((a,b)=>a-b);
}

export interface SceneVerificationInput {
  audioAssetId: string; endMode: 'hold' | 'advance'; scene: { id: string; durationSec: number };
  videoMode?: 'classic' | 'interactive'; legacyPlan?: boolean;
  /** Absent in historical scene packets, before targeted orbit became policy. */
  instructionVersion?: number;
  previousFrame?: Frame; planning: { current?: ScenePlan };
}

export interface VisualGateInput {
  runner: AgentRunner; source: string; input: SceneVerificationInput;
  task: Pick<AgentTask,'systemPrompt'|'prompt'>;
  directory: string; index: number; videoId: string; signal: AbortSignal;
  validate: (source: string) => Promise<unknown>;
  renderFrames?: FrameRenderer;
  models?: RenderModelAssets;
  recoveryWait?: typeof waitForRecovery;
}

interface VisualProgress {
  contextHash: string;
  source: string;
  attempt: number;
  phase: 'review' | 'repair';
  history: VisualVerification[];
  rewrite?: boolean;
}

/** Every candidate must pass validation, actual rendering and independent review.
 * A checkpoint preserves up to 50 review rounds across interruptions.
 */
export async function reviewGeneratedScene(options: VisualGateInput): Promise<string> {
  const { runner, input, directory, index, videoId, signal } = options;
  const wait = options.recoveryWait ?? waitForRecovery;
  signal.throwIfAborted();
  const [guidance, repairGuidance, style] = await Promise.all([
    loadPrompt('scene-verify'), loadPrompt('scene-repair'),
    readFile(new URL('../../prompts/visual-style-reference.jpg', import.meta.url)),
  ]);
  const contextHash = sourceHash(JSON.stringify(input));
  const checkpoint = join(directory, `scene-${index}.visual-state.json`);
  let state: VisualProgress = { contextHash, source: options.source, attempt: 0, phase: 'review', history: [] };
  try {
    const saved = JSON.parse(await readFile(checkpoint, 'utf8')) as VisualProgress;
    if (saved.contextHash === contextHash) state = saved;
  } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  const save = () => atomicWrite(checkpoint, JSON.stringify(state));
  const authorContract = options.task.systemPrompt;
  const run = async (task: AgentTask, attemptDirectory: string, phase: 'review' | 'repair', maxAttempts?: number) => {
    let metrics: AgentRunMetrics | undefined;
    const started = performance.now();
    await atomicWrite(join(attemptDirectory, `${phase}.prompt.md`), `${task.systemPrompt}\n\n${task.prompt}`);
    try {
      return await logStage({ videoId, sceneIndex: index, stage: phase, attempt: state.attempt }, () => runWithValidationRecovery(runner, {
        ...task, onMetrics: value => { metrics = value; },
      }, { diagnosticsPath: join(attemptDirectory, `${phase}.diagnostics.json`), maxAttempts, wait }));
    } finally {
      await atomicWrite(join(attemptDirectory, `${phase}.metrics.json`), JSON.stringify(metrics ?? { elapsedMs: performance.now() - started }, null, 2));
    }
  };
  for (;;) {
    signal.throwIfAborted();
    if (state.attempt >= MAX_REVIEW_ROUNDS) throw new AgentError('RECOVERY_EXHAUSTED', 'Visual review reached 50 rounds.');
    const attemptDirectory = join(directory, `scene-${index}.visual`, String(state.attempt));
    await mkdir(attemptDirectory, { recursive: true });
    await save();
    // Keep rendered evidence bounded independently of the number of repairs.
    if (state.attempt >= 3) await rm(join(directory, `scene-${index}.visual`, String(state.attempt - 3)), { recursive: true, force: true });
    let images: AgentTask['images'];
    if (state.phase === 'review') {
      await atomicWrite(join(attemptDirectory, 'candidate.js'), state.source);
      let evidence: Awaited<ReturnType<FrameRenderer>> | undefined;
      let renderProblem: string | undefined;
      for (let renderAttempt = 0; renderAttempt < 2; renderAttempt++) {
        let validating = true;
        try {
          await options.validate(state.source);
          const compiled = await compileSource(state.source, { previous: input.previousFrame,
            models: Object.fromEntries(Object.entries(options.models?.assets ?? {}).map(([id, a]) => [id, a.metadata])) });
          validating = false;
          evidence = await (options.renderFrames ?? renderSceneFrames)({ source: state.source, previousFrame: input.previousFrame,
            models: options.models, times: sampleReviewTimes(compiled), directory: attemptDirectory, signal });
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
        images = await Promise.all(evidence.sheets.map(async sheet => ({ type: 'image' as const, mimeType: 'image/png', data: (await readFile(sheet.path)).toString('base64') })));
        images.push({ type: 'image', mimeType: 'image/jpeg', data: style.toString('base64') });
        const sampleMap = evidence.sheets.map((sheet, i) => ({ image: i + 1, width: sheet.width, height: sheet.height, columns: sheet.columns, times: sheet.times }));
        const output = await run({
          systemPrompt: `${authorContract}\n\n${guidance}`,
          prompt: `Verify these actual native WebGPU frames. Contact sheets read left-to-right, then top-to-bottom; each cell is one whole viewport. Sampling map: ${JSON.stringify(sampleMap)}. Last image is style reference.\nEarlier verification (preserve corrections): ${JSON.stringify(state.history)}\nAuthoritative request and narration:\n${options.task.prompt}\nCurrent candidate source (SHA-256 ${sourceHash(state.source)}):\n${state.source}`,
          images, signal, outputMode: 'submit-only', logContext: { videoId, sceneIndex: index, stage: 'review' },
          validate: async output => { parseVisualVerification(output, input.scene.durationSec); },
        }, attemptDirectory, 'review');
        const review = parseVisualVerification(output, input.scene.durationSec);
        signal.throwIfAborted();
        await atomicWrite(join(attemptDirectory, 'review.json'), JSON.stringify({ sourceSha256: sourceHash(state.source), sampleMap, ...review }, null, 2));
        if (review.approved) {
          await atomicWrite(join(directory, `scene-${index}.visual-review.json`), JSON.stringify({ approved: true,
            sourceSha256: sourceHash(state.source), attempt: state.attempt, evidence, review }, null, 2));
          return state.source;
        }
        state.history = [...state.history, review].slice(-3);
        state.rewrite = false;
      } else {
        state.history = [...state.history, { approved: false, findings: [{ timeSec: null, objectIds: [],
          problem: `The candidate cannot be compiled/rendered reliably: ${renderProblem}`,
          fix: 'Simplify expensive geometry, loops and timeline construction. Preserve narration, timing, IDs and planned interactions. Use supported animation APIs and keep within the existing compiler resource limits.',
        }] }].slice(-3);
        state.rewrite = true;
      }
      state.phase = 'repair';
      await save();
    }
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
          prompt: `Repair these verified findings (zero-based indexes): ${JSON.stringify(review.findings)}.\nPreserve corrections from earlier reviews: ${JSON.stringify(state.history.slice(0, -1))}.\nAuthoritative request and narration:\n${options.task.prompt}\nOriginal candidate sourceSha256: ${sourceHash(originalSource)}\n${originalSource}`,
          images, signal, outputMode: 'submit-only', logContext: { videoId, sceneIndex: index, stage: 'repair' },
          validate: async output => { await validatePatch(output); },
        }, attemptDirectory, 'repair', 3);
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
      logEvent('scene.regenerating', { videoId, sceneIndex: index, attempt: state.attempt }, 'warn');
      state.source = await run({
        systemPrompt: `${authorContract}\n\nReturn complete replacement scene JavaScript, without markdown fences. Preserve the authoritative narration, exact duration, inherited IDs, planned controls and earlier corrections.`,
        prompt: `Repair this scene with a complete implementation. The targeted patch or rendering path could not finish. Simplify the implementation where needed; do not relax its required behavior.\nFindings: ${JSON.stringify(state.history)}\nAuthoritative request:\n${options.task.prompt}\nCurrent source:\n${originalSource}`,
        signal, outputMode: 'text', logContext: { videoId, sceneIndex: index, stage: 'repair' }, validate: async output => { await options.validate(output); },
      }, attemptDirectory, 'repair');
    }
    signal.throwIfAborted();
    state.attempt++;
    state.phase = 'review';
    state.rewrite = false;
    await save();
  }
}

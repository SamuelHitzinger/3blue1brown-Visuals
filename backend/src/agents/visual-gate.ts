import type { RenderModelAssets } from '../model-assets.js';
import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { compileSource } from 'animlib/core';
import type { CompiledScene } from 'animlib/core';
import type { AgentRunner, AgentTask, AgentRunMetrics } from './runtime.js';
import { renderSceneFrames } from './frame-renderer.js';
import type { FrameRenderer } from './frame-renderer.js';
import { applyVisualEdits, parseVisualVerification, sourceHash } from './visual-edits.js';
import type { VisualVerification } from './visual-edits.js';
import type { ReviewInput } from './review.js';
import { animationQualityPolicy } from './quality-policy.js';
import { loadPrompt } from './prompts.js';
import { atomicWrite } from '../narration/service.js';
import { logStage } from '../logging.js';

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

export interface VisualGateInput {
  runner: AgentRunner; source: string; input: ReviewInput;
  task: Pick<AgentTask,'systemPrompt'|'prompt'>;
  directory: string; index: number; videoId: string; signal: AbortSignal;
  validate: (source: string) => Promise<unknown>;
  renderFrames?: FrameRenderer;
  models?: RenderModelAssets;
}

/** Mandatory pre-publication gate: every repair is validated, rendered and independently reviewed. */
export async function reviewGeneratedScene(options: VisualGateInput): Promise<string> {
  const {runner,input,directory,index,videoId,signal}=options;
  signal.throwIfAborted();
  const [guidance, repairGuidance, quality, style] = await Promise.all([
    loadPrompt('scene-verify'),
    loadPrompt('scene-repair'),
    animationQualityPolicy(),
    readFile(new URL('../../prompts/visual-style-reference.jpg',import.meta.url)),
  ]);
  // The author already receives this policy. Avoid pasting it twice without dropping context.
  const authorContract = options.task.systemPrompt.includes(quality)
    ? options.task.systemPrompt : `${options.task.systemPrompt}\n\n${quality}`;
  let source=options.source;
  let previousReview: VisualVerification | undefined;
  const run = async (task: AgentTask, attemptDirectory: string, phase: 'review' | 'repair', attempt: number) => {
    let metrics: AgentRunMetrics | undefined;
    const started = performance.now();
    await atomicWrite(join(attemptDirectory,`${phase}.prompt.md`),`${task.systemPrompt}\n\n${task.prompt}`);
    try {
      return await logStage({videoId,sceneIndex:index,stage:phase,attempt},()=>runner.run({
        ...task, onMetrics: value => { metrics = value; },
      }));
    } finally {
      await atomicWrite(join(attemptDirectory,`${phase}.metrics.json`),JSON.stringify(metrics ?? { elapsedMs: performance.now()-started },null,2));
    }
  };
  // One findings-only verification, at most one targeted repair, then final verification.
  for(let attempt=0;attempt<2;attempt++) {
    signal.throwIfAborted();
    await options.validate(source);
    const sourceSha256=sourceHash(source);
    const attemptDirectory=join(directory,`scene-${index}.visual`,String(attempt));
    await mkdir(attemptDirectory,{recursive:true});
    await atomicWrite(join(attemptDirectory,'candidate.js'),source);
    const compiled=await compileSource(source,{previous:input.previousFrame,models:Object.fromEntries(Object.entries(options.models?.assets??{}).map(([id,a])=>[id,a.metadata]))});
    const evidence=await (options.renderFrames??renderSceneFrames)({source,previousFrame:input.previousFrame,models:options.models,times:sampleReviewTimes(compiled),directory:attemptDirectory,signal});
    signal.throwIfAborted();
    const images=await Promise.all(evidence.sheets.map(async sheet=>({type:'image' as const,mimeType:'image/png',data:(await readFile(sheet.path)).toString('base64')})));
    images.push({type:'image',mimeType:'image/jpeg',data:style.toString('base64')});
    const sampleMap=evidence.sheets.map((sheet,i)=>({image:i+1,width:sheet.width,height:sheet.height,columns:sheet.columns,times:sheet.times}));
    const task:AgentTask={
      systemPrompt:`${authorContract}\n\n${guidance}`,
      prompt:`Verify these actual native WebGPU frames. Contact sheets read left-to-right, then top-to-bottom; each cell is one whole viewport. Sampling map: ${JSON.stringify(sampleMap)}. Last image is style reference.\nEarlier verification (if any): ${JSON.stringify(previousReview ?? null)}\nAuthoritative request and narration:\n${options.task.prompt}\nCurrent candidate source (SHA-256 ${sourceSha256}):\n${source}`,
      images,signal,outputMode:'submit-only',logContext:{videoId,sceneIndex:index,stage:'review'},
      validate:async output=>{parseVisualVerification(output,input.scene.durationSec);},
    };
    const output=await run(task,attemptDirectory,'review',attempt);
    const review=parseVisualVerification(output,input.scene.durationSec);signal.throwIfAborted();
    await atomicWrite(join(attemptDirectory,'review.json'),JSON.stringify({sourceSha256,sampleMap,...review},null,2));
    if(review.approved){
      await atomicWrite(join(directory,`scene-${index}.visual-review.json`),JSON.stringify({approved:true,sourceSha256,attempt,evidence,review},null,2));
      return source;
    }
    if(attempt===1)break;
    previousReview=review;
    const originalSource=source;
    // Successful patch validation is deterministic in this immutable candidate/context.
    const validatedPatches=new Map<string,string>();
    const validatePatch=async(output:string)=>{
      signal.throwIfAborted();
      const cached=validatedPatches.get(output);if(cached!==undefined)return cached;
      const repaired=applyVisualEdits(output,originalSource,review.findings.length);
      await options.validate(repaired);
      signal.throwIfAborted();
      if(validatedPatches.size>=4)validatedPatches.delete(validatedPatches.keys().next().value!);
      validatedPatches.set(output,repaired);return repaired;
    };
    const patch=await run({
      systemPrompt:`${authorContract}\n\n${repairGuidance}`,
      prompt:`Repair only these verified findings (zero-based indexes): ${JSON.stringify(review.findings)}.\nRendered evidence uses this sampling map: ${JSON.stringify(sampleMap)}. Last image is style reference.\nAuthoritative request and narration:\n${options.task.prompt}\nOriginal candidate sourceSha256: ${sourceSha256}\n${originalSource}`,
      images,signal,outputMode:'submit-only',logContext:{videoId,sceneIndex:index,stage:'repair'},
      validate:async output=>{await validatePatch(output);},
    },attemptDirectory,'repair',attempt);
    source=await validatePatch(patch);
    await atomicWrite(join(attemptDirectory,'repair.json'),patch);
  }
  throw new Error('Automatic visual review rejected the scene after one targeted repair; no scene was published. See saved frame evidence and findings.');
}

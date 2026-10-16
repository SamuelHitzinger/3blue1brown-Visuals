import type { RenderModelAssets } from '../model-assets.js';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import type { Frame, detectLabelStrokeOverlaps } from 'animlib/core';
import { atomicWrite } from '../atomic-write.js';
import { AgentError } from './config.js';

export interface StrokeWarningEvidence {
  records: { time: number; width: number; height: number; warning: ReturnType<typeof detectLabelStrokeOverlaps>[number] }[];
  truncated: boolean;
  elapsedMs: number;
  failedFrames?: number;
}
export interface FrameEvidence {
  backend: string;
  frames: { time: number; width: number; height: number; path: string }[];
  sheets: { path: string; width: number; height: number; times: number[]; columns: number }[];
  strokeWarnings?: StrokeWarningEvidence;
}
export interface FrameRenderInput { source: string; models?: RenderModelAssets; previousFrame?: Frame; times: number[]; directory: string; signal: AbortSignal; includeStrokeWarnings?: boolean }
export type FrameRenderer = (input: FrameRenderInput) => Promise<FrameEvidence>;

/** Omitted by default so frozen evidence-only experiments keep their original contract. */
export function frameRenderRequest(input: FrameRenderInput) {
  return {source:input.source,models:input.models,previousFrame:input.previousFrame,times:input.times,directory:input.directory,
    ...(input.includeStrokeWarnings === true ? {includeStrokeWarnings:true} : {})};
}

/** Optional advisory evidence never invalidates usable pixels. Bound alternate workers too. */
export function parseFrameEvidence(stdout: string): FrameEvidence {
  const result = JSON.parse(stdout) as FrameEvidence;
  if (!result.frames?.length || !result.sheets?.length) throw new Error('No rendered evidence.');
  if (result.strokeWarnings !== undefined) {
    const raw = result.strokeWarnings;
    const report: StrokeWarningEvidence = {records: [], truncated: raw?.truncated === true,
      elapsedMs: Number.isFinite(raw?.elapsedMs) && raw.elapsedMs >= 0 ? raw.elapsedMs : 0};
    if (Number.isSafeInteger(raw?.failedFrames) && raw.failedFrames! > 0) report.failedFrames = raw.failedFrames;
    const validBounds = (value: unknown): value is ReturnType<typeof detectLabelStrokeOverlaps>[number]['bounds'] => {
      if (!value || typeof value !== 'object') return false;
      const bounds = value as ReturnType<typeof detectLabelStrokeOverlaps>[number]['bounds'];
      return [bounds.left,bounds.top,bounds.right,bounds.bottom].every(Number.isFinite) && bounds.left <= bounds.right && bounds.top <= bounds.bottom;
    };
    const copyBounds = (value: ReturnType<typeof detectLabelStrokeOverlaps>[number]['bounds']) => ({left:value.left,top:value.top,right:value.right,bottom:value.bottom});
    const seen = new Set<string>();
    if (!Array.isArray(raw?.records)) report.truncated = true;
    else for (const record of raw.records) {
      const warning = record?.warning, bounds = warning?.bounds;
      if (!record || !result.frames.some(frame => frame.time === record.time && frame.width === record.width && frame.height === record.height)
        || warning?.kind !== 'text-stroke-overlap' || warning.severity !== 'warning' || !Array.isArray(warning.elements) || warning.elements.length !== 2
        || !warning.elements.every(id => typeof id === 'string' && id.length <= 256)
        || !validBounds(bounds) || !Array.isArray(warning.elementBounds) || warning.elementBounds.length !== 2 || !warning.elementBounds.every(validBounds)
        || !Array.isArray(warning.witness) || warning.witness.length !== 2 || !warning.witness.every(Number.isFinite)) {
        report.truncated = true; continue;
      }
      const key = JSON.stringify([record.time,record.width,record.height,[...warning.elements].sort()]);
      if (seen.has(key)) continue;
      if (report.records.length >= 32) {report.truncated = true; continue;}
      seen.add(key);
      report.records.push({time:record.time,width:record.width,height:record.height,warning: {
        kind:'text-stroke-overlap',severity:'warning',elements:[warning.elements[0],warning.elements[1]],
        bounds:copyBounds(bounds),elementBounds:[copyBounds(warning.elementBounds[0]),copyBounds(warning.elementBounds[1])],
        witness:[warning.witness[0],warning.witness[1]],
      }});
    }
    result.strokeWarnings = report;
  }
  return result;
}

/** Keep native GPU globals outside the Bun server and enforce a bounded render deadline. */
export const renderSceneFrames: FrameRenderer = async input => {
  input.signal.throwIfAborted();
  await mkdir(input.directory,{recursive:true});
  const request=join(input.directory,'render-input.json');
  await atomicWrite(request,JSON.stringify(frameRenderRequest(input)));
  const worker=fileURLToPath(new URL('../../../shared/animlib/tools/render-frames.mjs',import.meta.url));
  const signal=AbortSignal.any([input.signal,AbortSignal.timeout(120_000)]);
  return await new Promise<FrameEvidence>((resolve,reject)=>{
    const child=spawn('node',[worker,request],{windowsHide:true,stdio:['ignore','pipe','pipe'],signal});
    let stdout='',stderr='';
    child.stdout.setEncoding('utf8');child.stderr.setEncoding('utf8');
    child.stdout.on('data',chunk=>{stdout+=chunk;if(stdout.length>1_000_000)child.kill();});
    child.stderr.on('data',chunk=>{stderr=(stderr+chunk).slice(-4000);});
    child.on('error',reject);
    child.on('close',code=>{
      if(signal.aborted){reject(signal.reason);return;}
      if(code!==0){
        let diagnostic: { code?: string; message?: string } | undefined;
        try { diagnostic = JSON.parse(stderr.trim().split('\n').at(-1)!); } catch { /* Older or crashed workers may have plain stderr. */ }
        const sourceFailure = diagnostic?.code === 'SCENE_COMPILE' || stderr.trim() === 'interrupted';
        reject(new AgentError(sourceFailure ? 'RENDER_SOURCE' : 'RENDER', sourceFailure
          ? `Scene rendering could not compile the candidate: ${diagnostic?.message ?? 'execution limit exceeded'}`
          : 'The scene renderer is temporarily unavailable.'));return;
      }
      try {resolve(parseFrameEvidence(stdout));}catch(error){reject(error);}
    });
  });
};

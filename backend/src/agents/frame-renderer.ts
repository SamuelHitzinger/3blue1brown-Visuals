import type { RenderModelAssets } from '../model-assets.js';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import type { Frame } from 'animlib/core';
import { atomicWrite } from '../narration/service.js';

export interface FrameEvidence {
  backend: string;
  frames: { time: number; width: number; height: number; path: string }[];
  sheets: { path: string; width: number; height: number; times: number[]; columns: number }[];
}
export interface FrameRenderInput { source: string; models?: RenderModelAssets; previousFrame?: Frame; times: number[]; directory: string; signal: AbortSignal }
export type FrameRenderer = (input: FrameRenderInput) => Promise<FrameEvidence>;

/** Keep native GPU globals outside the Bun server and enforce a bounded render deadline. */
export const renderSceneFrames: FrameRenderer = async input => {
  input.signal.throwIfAborted();
  await mkdir(input.directory,{recursive:true});
  const request=join(input.directory,'render-input.json');
  await atomicWrite(request,JSON.stringify({source:input.source,models:input.models,previousFrame:input.previousFrame,times:input.times,directory:input.directory}));
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
      if(code!==0){reject(new Error(`Automatic frame rendering failed (${code}): ${stderr}. Check Node, native WebGPU and the animlib build.`));return;}
      try {const result=JSON.parse(stdout) as FrameEvidence;if(!result.frames?.length||!result.sheets?.length)throw new Error('No rendered evidence.');resolve(result);}catch(error){reject(error);}
    });
  });
};

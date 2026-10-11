import {CanvasRenderer} from '../src/renderer.js';
import {SceneSequence} from '../src/sequence.js';
import {focusSettings,opticalSource,opticalIssues,focusViewSource,focusOcclusionSource,focusOcclusionIssues} from './depth-focus-cases.js';
async function run(){
 const useGPU=new URL(location.href).searchParams.has('webgpu');
 if(!useGPU)Object.defineProperty(navigator,'gpu',{configurable:true,value:undefined});
 Object.defineProperty(window,'devicePixelRatio',{configurable:true,value:1});
 const canvas=document.createElement('canvas');canvas.width=256;canvas.height=192;document.querySelector('#stage')!.append(canvas);
 const renderer=new CanvasRenderer(canvas),errors:string[]=[];renderer.onError=e=>errors.push(e.message);const sequence=new SceneSequence({prepare:scenes=>renderer.prepare(scenes)});
 const results:{name:string;ok:boolean;issues?:string[];milliseconds?:number}[]=[];
 const capture=async()=>{
  if(useGPU){const copy=document.createElement('canvas');copy.width=256;copy.height=192;copy.getContext('2d')!.drawImage(renderer.canvasElement,0,0);return copy.getContext('2d')!.getImageData(0,0,256,192).data;}
  const gl=renderer.canvasElement.getContext('webgl2')!,bottom=new Uint8Array(256*192*4),top=new Uint8Array(bottom.length);gl.readPixels(0,0,256,192,gl.RGBA,gl.UNSIGNED_BYTE,bottom);for(let y=0;y<192;y++)top.set(bottom.subarray(y*1024,(y+1)*1024),(191-y)*1024);if(gl.getError()!==gl.NO_ERROR)throw new Error('WebGL pixel read error');return top;
 };
 try{
  const load=await sequence.submit({type:'load',scenes:[{id:'focus',source:opticalSource}]});if(!load.ok)throw new Error(JSON.stringify(load));const initialBackend=renderer.backend;if(initialBackend!==(useGPU?'webgpu':'webgl2'))throw new Error('Requested initial backend unavailable');
  const images:Uint8Array[]=[];const start=performance.now();
  for(const focus of focusSettings){const frame=sequence.frame(0,0);frame.camera.focus=focus;renderer.render(frame,sequence.compiled[0].options);images.push(new Uint8Array(await capture()));const image=new Image();image.src=renderer.canvasElement.toDataURL();document.querySelector('#gallery')!.append(image);}
  const issues=opticalIssues(...images as [Uint8Array,Uint8Array,Uint8Array,Uint8Array]);results.push({name:'zero aperture, sharp plane, near/far blur, rack focus, HUD',ok:!issues.length,issues,milliseconds:performance.now()-start});
  const occ=await sequence.submit({type:'load',scenes:[{id:'occlusion',source:focusOcclusionSource}]});if(!occ.ok)throw new Error(JSON.stringify(occ));renderer.render(sequence.frame(0,0),sequence.compiled[0].options);const occlusion=await capture(),oi=focusOcclusionIssues((x,y)=>[...occlusion.slice((y*256+x)*4,(y*256+x)*4+3)]);results.push({name:'opaque foreground coverage and aperture-dependent rear visibility',ok:!oi.length,issues:oi});
  const view=await sequence.submit({type:'load',scenes:[{id:'views',source:focusViewSource}]});if(!view.ok)throw new Error(JSON.stringify(view));renderer.render(sequence.frame(0,0),sequence.compiled[0].options);await capture();results.push({name:'focused isolated groups, retained instances and per-view HUD',ok:!errors.length});
  if(!useGPU){const gl=canvas.getContext('webgl2')!,loss=gl.getExtension('WEBGL_lose_context')!;const lost=new Promise<void>(r=>canvas.addEventListener('webglcontextlost',()=>r(),{once:true}));loss.loseContext();await lost;const restored=new Promise<void>(r=>canvas.addEventListener('webglcontextrestored',()=>r(),{once:true}));await new Promise(r=>setTimeout(r,100));loss.restoreContext();await restored;errors.length=0;renderer.render(sequence.frame(0,0),sequence.compiled[0].options);await capture();results.push({name:'focus surfaces recreate after WebGL context recovery',ok:!errors.length});}
  else {const recovered=new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Device recovery timed out')),5000);renderer.onRecovered=()=>{clearTimeout(timer);resolve();};});(renderer as any).device.destroy();await recovered;errors.length=0;renderer.render(sequence.frame(0,0),sequence.compiled[0].options);await capture();results.push({name:'focused WebGPU device loss rebuilds with WebGL2 fallback',ok:renderer.backend==='webgl2'&&!errors.length});}
  const backend=renderer.backend;renderer.dispose();renderer.dispose();(window as any).focusResult={initialBackend,backend,results,errors};document.querySelector('#results')!.textContent=JSON.stringify((window as any).focusResult,null,2);
 }catch(e){document.querySelector('#results')!.textContent=String(e instanceof Error?e.stack:e);(window as any).focusResult={error:String(e),errors};}finally{sequence.dispose();renderer.dispose();}
}
(window as any).focusTests=run();

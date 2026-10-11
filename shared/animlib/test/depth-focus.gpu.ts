import {it,expect,vi} from 'vitest';
import {create,globals} from 'webgpu';
import {CanvasRenderer} from '../src/renderer.js';
import {SceneSequence} from '../src/sequence.js';
import {opticalSource,opticalIssues,focusViewSource,focusOcclusionSource,focusOcclusionIssues} from './depth-focus-cases.js';
import {createAssetRegistry} from '../src/asset-registry.js';
import {imageInput,secondImageInput} from './image-fixture.js';
import {imageCaseSource,imageCases} from './image-render-cases.js';

it('real optical focus keeps its plane sharp, softens near/far edges, racks focus and preserves zero aperture',async()=>{
 Object.entries(globals).forEach(([k,v])=>vi.stubGlobal(k,v));vi.stubGlobal('ResizeObserver',class{observe(){}disconnect(){}});vi.stubGlobal('devicePixelRatio',1);
 let gpu:GPU|undefined=create([]);const adapter=await gpu.requestAdapter();expect(adapter).toBeTruthy();const device=await adapter!.requestDevice(),format=gpu.getPreferredCanvasFormat(),errors:string[]=[];
 device.addEventListener('uncapturederror',e=>errors.push(e.error.message));
 let target=device.createTexture({size:[256,192],format,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC});
 vi.stubGlobal('navigator',{gpu:{requestAdapter:async()=>({requestDevice:async()=>device}),getPreferredCanvasFormat:()=>format}});
 let dimensions={width:256,height:192};
 const canvas={width:256,height:192,style:{},getBoundingClientRect:()=>dimensions,getContext:()=>({configure(){},unconfigure(){},getCurrentTexture:()=>{if(target.width!==canvas.width||target.height!==canvas.height){target.destroy();target=device.createTexture({size:[canvas.width,canvas.height],format,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC});}return target;}}),addEventListener(){},removeEventListener(){}} as unknown as HTMLCanvasElement;
 const renderer=new CanvasRenderer(canvas);renderer.onError=e=>errors.push(e.message);const registry=await createAssetRegistry([imageInput(),secondImageInput()],{colorPolicy:'source'});const sequence:SceneSequence=new SceneSequence({modelAssets:registry,prepare:scenes=>renderer.prepare(scenes,sequence.assetGeometry)});
 try{
  const result=await sequence.submit({type:'load',scenes:[{id:'focus',source:opticalSource}]});expect(result.ok,JSON.stringify(result)).toBe(true);
  const capture=async(focus?:{distance:number;aperture:number;samples?:16})=>{
   const frame=sequence.frame(0,0);Object.assign(frame.camera,{focus});renderer.render(frame,sequence.compiled[0].options);
   const buffer=device.createBuffer({size:256*192*4,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});const e=device.createCommandEncoder();e.copyTextureToBuffer({texture:target},{buffer,bytesPerRow:1024},[256,192]);device.queue.submit([e.finish()]);await buffer.mapAsync(GPUMapMode.READ);const rgba=new Uint8Array(buffer.getMappedRange()).slice();buffer.unmap();buffer.destroy();expect(errors).toEqual([]);return rgba;
  };
  const sharp=await capture(),zero=await capture({distance:20,aperture:0}),focused=await capture({distance:20,aperture:.8}),rack=await capture({distance:10,aperture:.8});
  expect(zero).toEqual(sharp);
  const row=(a:Uint8Array,left:number,right:number)=>Array.from({length:right-left},(_,i)=>a[(96*256+left+i)*4]);
  expect(row(focused,108,148)).toEqual(row(sharp,108,148));
  expect(row(focused,48,88).filter(v=>v>8&&v<240).length).toBeGreaterThan(row(sharp,48,88).filter(v=>v>8&&v<240).length+4);
  expect(row(focused,168,208).filter(v=>v>8&&v<240).length).toBeGreaterThan(row(sharp,168,208).filter(v=>v>8&&v<240).length+4);
  expect(row(rack,48,88)).toEqual(row(sharp,48,88));expect(rack).not.toEqual(focused);
  expect(opticalIssues(sharp,zero,focused,rack)).toEqual([]);
  const createTexture=vi.spyOn(device,'createTexture'),write=vi.spyOn(device.queue,'writeBuffer'),submit=vi.spyOn(device.queue,'submit');
  const invalid=sequence.frame(0,0);invalid.camera.focus={distance:0,aperture:1};renderer.render(invalid,sequence.compiled[0].options);
  expect(errors.pop()).toContain('Focus distance');expect(createTexture).not.toHaveBeenCalled();expect(write).not.toHaveBeenCalled();expect(submit).not.toHaveBeenCalled();
  invalid.camera.focus={distance:20,aperture:1};canvas.width=8192;canvas.height=8192;renderer.render(invalid,sequence.compiled[0].options);expect(errors.pop()).toContain('256 MiB');expect(createTexture).not.toHaveBeenCalled();expect(write).not.toHaveBeenCalled();expect(submit).not.toHaveBeenCalled();canvas.width=256;canvas.height=192;
  createTexture.mockRestore();write.mockRestore();submit.mockRestore();expect(await capture({distance:20,aperture:.8})).toEqual(focused);
  // Real source-image sampling, including straight-alpha compositing, remains attached to each optical camera.
  const imageLoad=await sequence.submit({type:'load',scenes:[{id:'image',source:imageCaseSource(imageCases[0],registry.catalog[0].hash)}]});expect(imageLoad.ok,JSON.stringify(imageLoad)).toBe(true);
  const imageSharp=await capture(),imageFocused=await capture({distance:12,aperture:.8});expect(imageFocused.every((v,i)=>Math.abs(v-imageSharp[i])<=1)).toBe(true);
  const occ=await sequence.submit({type:'load',scenes:[{id:'occlusion',source:focusOcclusionSource}]});expect(occ.ok,JSON.stringify(occ)).toBe(true);const occlusion=await capture({distance:20,aperture:.8});expect(focusOcclusionIssues((x,y)=>{const p=[...occlusion.slice((y*256+x)*4,(y*256+x)*4+3)];return format==='bgra8unorm'?[p[2],p[1],p[0]]:p;})).toEqual([]);
  const views=await sequence.submit({type:'load',scenes:[{id:'views',source:focusViewSource}]});expect(views.ok,JSON.stringify(views)).toBe(true);
  const first=await capture(),again=await capture();expect(again).toEqual(first);expect(errors).toEqual([]);
  expect([...first.slice((36*256+64)*4,(36*256+64)*4+3)].every(v=>Math.abs(v-179)<=1)).toBe(true);
  // Changing only the left view focus cannot alter the right view or either HUD.
  const leftOff=sequence.frame(0,0);leftOff.views![0].camera.focus!.aperture=0;renderer.render(leftOff,sequence.compiled[0].options);
  const read=device.createBuffer({size:256*192*4,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});const encoder=device.createCommandEncoder();encoder.copyTextureToBuffer({texture:target},{buffer:read,bytesPerRow:1024},[256,192]);device.queue.submit([encoder.finish()]);await read.mapAsync(GPUMapMode.READ);const off=new Uint8Array(read.getMappedRange()).slice();read.unmap();read.destroy();
  for(let y=0;y<192;y++)expect(off.slice((y*256+128)*4,(y*256+256)*4)).toEqual(first.slice((y*256+128)*4,(y*256+256)*4));
  const old=(renderer as any).depthFocus.surfaces;const destroyed=Object.values(old).map((t:any)=>vi.spyOn(t,'destroy'));
  dimensions={width:320,height:240};(renderer as any).resize();renderer.render(sequence.frame(0,0),sequence.compiled[0].options);await device.queue.onSubmittedWorkDone();expect(errors).toEqual([]);for(const destroy of destroyed)expect(destroy).toHaveBeenCalledOnce();
  const final=(renderer as any).depthFocus.surfaces;const released=Object.values(final).map((t:any)=>vi.spyOn(t,'destroy'));renderer.dispose();renderer.dispose();for(const destroy of released)expect(destroy).toHaveBeenCalledOnce();
 }finally{sequence.dispose();renderer.dispose();target.destroy();device.destroy();gpu=undefined;vi.unstubAllGlobals();}
});

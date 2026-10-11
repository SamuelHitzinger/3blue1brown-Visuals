/// <reference types="@webgpu/types" />
import {it,expect,vi} from 'vitest';
import {create,globals} from 'webgpu';
import {CanvasRenderer} from '../src/renderer.js';
import {compileSource} from '../src/compiler.js';
import {evaluateScene} from '../src/timeline.js';
import {createAssetRegistry} from '../src/asset-registry.js';
import {sceneAssetRefs} from '../src/asset-geometry.js';
import {ModelStore} from '../src/model-store.js';
import {parseModelGLB} from '../src/models.js';
import {RetainedGeometry} from '../src/retained-geometry.js';
import {imageInput} from './image-fixture.js';
import {model} from './asset-fixture.js';
import {modelFixture} from './model-fixture.js';

it('co-renders prepared images/meshes and UV1 GLB with focus, isolation, retained replay and complete disposal',async()=>{
 Object.entries(globals).forEach(([k,v])=>vi.stubGlobal(k,v));
 vi.stubGlobal('ResizeObserver',class{observe(){}disconnect(){}});vi.stubGlobal('devicePixelRatio',1);
 const gpu=create([]),adapter=await gpu.requestAdapter();expect(adapter).toBeTruthy();
 const device=await adapter!.requestDevice(),format=gpu.getPreferredCanvasFormat(),errors:string[]=[];
 device.addEventListener('uncapturederror',e=>errors.push(e.error.message));
 const width=256,height=128,target=device.createTexture({size:[width,height],format,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC});
 vi.stubGlobal('navigator',{gpu:{requestAdapter:async()=>({requestDevice:async()=>device}),getPreferredCanvasFormat:()=>format}});
 const canvas={width,height,style:{},getBoundingClientRect:()=>({width,height}),getContext:(kind:string)=>{expect(kind).toBe('webgpu');return {configure(){},unconfigure(){},getCurrentTexture:()=>target};},addEventListener(){},removeEventListener(){}} as unknown as HTMLCanvasElement;
 const mesh=model('science');mesh.parts[0].vertices=[[-.5,-.5,0],[.5,-.5,0],[0,.5,0]];
 const registry=await createAssetRegistry([imageInput(),mesh],{colorPolicy:'source'});
 const bytes=await modelFixture({uv1:true,transform:true}),parsed=await parseModelGLB(bytes);
 const models=new ModelStore({fixture:{kind:'model',url:'fixture.glb',metadata:parsed.metadata}},{read:async()=>bytes,decode:async()=>({width:2,height:2,pixels:new Uint8Array([255,0,0,255,0,255,0,255,0,0,255,255,255,255,255,255])})});
 const source=(isolated:boolean)=>`export default scene({background:'BLACK'},s=>{
  const image=s.image('image',{asset:'corners',width:2,position:[-2,0,0],filter:'nearest'});
  const imported=s.model('imported',{asset:'fixture',position:[2,0,0]});
  const prepared=s.model('prepared',{asset:'science',fill:'PURE_RED',shading:'unlit',strokeWidth:0});
  ${isolated?"s.group('mixed',[image,imported,prepared],{isolated:true,opacity:.5});":''}
  s.play(s.camera.animate({height:4,distance:12}),{duration:0});s.wait(1);
 });`;
 const scenes=await Promise.all([false,true].map(isolated=>compileSource(source(isolated),{assetCatalog:registry.catalog,models:models.metadata})));
 const lease=registry.acquire(sceneAssetRefs(scenes));
 const renderer=new CanvasRenderer(canvas,undefined,lease,models);renderer.onError=e=>errors.push(e.message);
 const textures:ReturnType<typeof vi.spyOn>[]=[];const createTexture=device.createTexture.bind(device);
 vi.spyOn(device,'createTexture').mockImplementation(d=>{const t=createTexture(d);textures.push(vi.spyOn(t,'destroy'));return t;});
 try{
  await models.prepare(scenes);await renderer.prepare(scenes);
  const capture=async(isolated=false,focus=false)=>{
   const scene=scenes[isolated?1:0],frame=evaluateScene(scene,0);
   if(focus)frame.camera.focus={distance:12,aperture:.8,samples:16};
   renderer.render(frame,scene.options);
   const buffer=device.createBuffer({size:width*height*4,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}),encoder=device.createCommandEncoder();
   encoder.copyTextureToBuffer({texture:target},{buffer,bytesPerRow:width*4},[width,height]);device.queue.submit([encoder.finish()]);await buffer.mapAsync(GPUMapMode.READ);
   const rgba=new Uint8Array(buffer.getMappedRange()).slice();buffer.unmap();buffer.destroy();
   if(format==='bgra8unorm')for(let i=0;i<rgba.length;i+=4)[rgba[i],rgba[i+2]]=[rgba[i+2],rgba[i]];
   expect(errors).toEqual([]);return rgba;
  };
  const at=(p:Uint8Array,x:number,y:number)=>[...p.slice((y*width+x)*4,(y*width+x)*4+3)];
  const sharp=await capture();expect(at(sharp,48,48)).toEqual([203,71,19]);expect(at(sharp,176,48)).toEqual([0,255,0]);expect(at(sharp,128,64)).toEqual([255,0,0]);
  const focus=await capture(false,true);expect(focus.every((v,i)=>Math.abs(v-sharp[i])<=1)).toBe(true);
  const faded=await capture(true,true);for(const [x,y] of [[48,48],[176,48],[128,64]])at(faded,x,y).forEach((v,i)=>expect(Math.abs(v-at(sharp,x,y)[i]*.5)).toBeLessThanOrEqual(1));
  expect(await capture()).toEqual(sharp);
  const bypass=vi.spyOn(RetainedGeometry.prototype,'get').mockReturnValue(undefined);
  try{expect(await capture()).toEqual(sharp);}finally{bypass.mockRestore();}
  renderer.dispose();renderer.dispose();expect(textures.length).toBeGreaterThan(5);for(const destroy of textures)expect(destroy).toHaveBeenCalledOnce();expect(errors).toEqual([]);
 }finally{renderer.dispose();lease.dispose();models.dispose();target.destroy();device.destroy();vi.restoreAllMocks();vi.unstubAllGlobals();}
 expect(registry.stats().leases).toBe(0);
});

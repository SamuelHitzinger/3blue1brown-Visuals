/// <reference types="@webgpu/types" />
import { beforeAll,afterAll,describe,it,expect,vi } from 'vitest';
import { create,globals } from 'webgpu';
import { CanvasRenderer } from '../src/renderer.js';
import { parseModelGLB } from '../src/models.js';
import type { ModelData } from '../src/models.js';
import { compileSource } from '../src/compiler.js';
import { evaluateScene } from '../src/timeline.js';
import { RetainedGeometry } from '../src/retained-geometry.js';
import type { ModelStore, ResolvedModelGeometry, DecodedModelImage } from '../src/model-store.js';
import type { Frame } from '../src/types.js';
import { modelFixture,modelSource } from './model-fixture.js';
import type { FixtureOptions } from './model-fixture.js';

describe('imported model native WebGPU pixels',()=>{
 const width=320,height=320,errors:string[]=[];
 let gpu:GPU,device:GPUDevice,target:GPUTexture,renderer:CanvasRenderer,format:GPUTextureFormat,data:ModelData;
 const images=new Map();
 // Image decoding is exercised by the browser suite. Supply the fixture's exact decoded pixels here.
 const modelHost={images,resolve:(frame:Frame):Frame=>({...frame,elements:frame.elements.map(e=>{const ref=e.geometry.model;if(!ref)return e;const p=data.primitives[ref.primitive];return {...e,geometry:{...p.geometry,_model:p,_modelKey:`fixture-${revision}/${ref.primitive}`} as ResolvedModelGeometry};})})};
 let revision=0;
 beforeAll(async()=>{
  for(const [name,value] of Object.entries(globals))vi.stubGlobal(name,value);
  vi.stubGlobal('ResizeObserver',class{observe(){}disconnect(){}});vi.stubGlobal('devicePixelRatio',1);
  gpu=create([]);const adapter=await gpu.requestAdapter();if(!adapter)throw new Error('Native WebGPU adapter required');device=await adapter.requestDevice();format=gpu.getPreferredCanvasFormat();
  device.addEventListener('uncapturederror',e=>errors.push(e.error.message));target=device.createTexture({size:[width,height],format,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC});
  vi.stubGlobal('navigator',{gpu:{requestAdapter:async()=>({requestDevice:async()=>device}),getPreferredCanvasFormat:()=>format}});
  const canvas={width,height,style:{},getBoundingClientRect:()=>({width,height}),getContext:(kind:string)=>{if(kind!=='webgpu')throw new Error('Unexpected backend fallback');return {configure(){},unconfigure(){},getCurrentTexture:()=>target};},addEventListener(){},removeEventListener(){}} as unknown as HTMLCanvasElement;
  renderer=new CanvasRenderer(canvas,undefined,modelHost as unknown as ModelStore);renderer.onError=e=>errors.push(e.message);await renderer.prepare([]);
 });
 afterAll(()=>{target?.destroy();renderer?.dispose();device?.destroy();vi.unstubAllGlobals();});
 async function fixture(options:FixtureOptions={},source=modelSource){
  data=await parseModelGLB(await modelFixture(options));revision++;
  for(const image of data.images)images.set(image,{width:2,height:2,pixels:new Uint8Array([255,0,0,255,0,255,0,255,0,0,255,255,255,255,255,255])} satisfies DecodedModelImage);
  return compileSource(source,{models:{fixture:data.metadata}});
 }
 async function pixels(){
  const bytesPerRow=Math.ceil(width*4/256)*256,buffer=device.createBuffer({size:bytesPerRow*height,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}),encoder=device.createCommandEncoder();
  encoder.copyTextureToBuffer({texture:target},{buffer,bytesPerRow},[width,height]);device.queue.submit([encoder.finish()]);await buffer.mapAsync(GPUMapMode.READ);
  const out=new Uint8Array(width*height*4),mapped=new Uint8Array(buffer.getMappedRange());for(let y=0;y<height;y++)out.set(mapped.subarray(y*bytesPerRow,y*bytesPerRow+width*4),y*width*4);buffer.unmap();buffer.destroy();
  if(format==='bgra8unorm')for(let i=0;i<out.length;i+=4)[out[i],out[i+2]]=[out[i+2],out[i]];expect(errors).toEqual([]);return out;
 }
 const at=(p:Uint8Array,x=.5,y=.5)=>Array.from(p.slice((Math.floor(y*height)*width+Math.floor(x*width))*4,(Math.floor(y*height)*width+Math.floor(x*width))*4+3));
 async function draw(scene:Awaited<ReturnType<typeof fixture>>,time=1){renderer.render(evaluateScene(scene,time),scene.options);return pixels();}
 it('samples embedded UV texture with correct orientation and colors',async()=>{const p=await draw(await fixture());expect(at(p,.44,.44)).toEqual([255,0,0]);expect(at(p,.56,.44)).toEqual([0,255,0]);expect(at(p,.44,.56)).toEqual([0,0,255]);expect(at(p,.56,.56)).toEqual([255,255,255]);});
 it('supports UV1 and texture transforms',async()=>{expect(at(await draw(await fixture({uv1:true,transform:true})),.44,.44)).toEqual([0,255,0]);});
 it('uses linear base factors and sRGB output',async()=>{const scene=await fixture({textured:false});data.primitives[0].material.base=[.5,.5,.5,1];const c=at(await draw(scene));expect(c[0]).toBeGreaterThan(180);expect(c[0]).toBeLessThan(195);});
 it.each(['OPAQUE','MASK','BLEND'] as const)('renders alpha %s',async mode=>{const c=at(await draw(await fixture({textured:false,alpha:.25,alphaMode:mode})));expect(Math.abs(c[0]-(mode==='OPAQUE'?255:mode==='MASK'?0:64))).toBeLessThan(2);});
 it.each(['OPAQUE','MASK','BLEND'] as const)('applies vertex alpha before %s material policy',async mode=>{const scene=await fixture({textured:false,alphaMode:mode});data.primitives[0].colors=Array.from({length:4},()=>[1,1,1,.25]);const c=at(await draw(scene));expect(Math.abs(c[0]-(mode==='OPAQUE'?255:mode==='MASK'?0:64))).toBeLessThan(2);});
 it('preserves object fades independently of material alpha',async()=>{const c=at(await draw(await fixture({textured:false,alphaMode:'OPAQUE'}),.5));expect(c[0]).toBeGreaterThan(120);expect(c[0]).toBeLessThan(135);});
 it('preserves winding through negative nonuniform scales',async()=>{expect(at(await draw(await fixture({mirrored:true,doubleSided:false})),.44,.44).some(v=>v>50)).toBe(true);});
 it('samples normal and all PBR maps',async()=>{const plain=await draw(await fixture({unlit:false})),mapped=await draw(await fixture({unlit:false,normal:true,metallic:true,occlusion:true,emission:true}));expect(mapped.some((v,i)=>Math.abs(v-plain[i])>20)).toBe(true);});
 it('matches streamed geometry and replays backwards seeks exactly',async()=>{const scene=await fixture(),a=await draw(scene,1.3);await draw(scene,2);expect(await draw(scene,1.3)).toEqual(a);const get=RetainedGeometry.prototype.get;try{RetainedGeometry.prototype.get=()=>undefined;expect(await draw(scene,1.3)).toEqual(a);}finally{RetainedGeometry.prototype.get=get;}});
 it('composites isolated model groups',async()=>{const scene=await fixture({},`export default scene({},s=>{const m=s.model('panel',{asset:'fixture'});const g=s.group('assembly',[m],{isolated:true});s.play(g.fadeIn(),{duration:1});s.wait(1);});`);const c=at(await draw(scene,.5),.44,.44);expect(c[0]).toBeGreaterThan(120);expect(c[0]).toBeLessThan(135);expect(c[1]).toBe(0);});
 it('tints named parts and restores imported materials',async()=>{const scene=await fixture({textured:false},`export default scene({},s=>{const m=s.model('panel',{asset:'fixture'});s.play(m.part('Panel').tintTo(Color.PURE_RED),{duration:1});s.play(m.tintTo(Color.WHITE),{duration:1});});`);expect(at(await draw(scene,1))).toEqual([255,0,0]);expect(at(await draw(scene,2))).toEqual([255,255,255]);});
});

import {it,expect,vi} from 'vitest';
import {create,globals} from 'webgpu';
import {CanvasRenderer} from '../src/renderer.js';
import {createAssetRegistry} from '../src/asset-registry.js';
import {SceneSequence} from '../src/sequence.js';
import {imageInput,secondImageInput} from './image-fixture.js';
import {imageCases,imageCaseSource} from './image-render-cases.js';

it('samples exact non-palette source RGB, top-left UV and straight alpha on native WebGPU',async()=>{
  Object.entries(globals).forEach(([k,v])=>vi.stubGlobal(k,v));
  vi.stubGlobal('ResizeObserver',class {observe(){}disconnect(){}});vi.stubGlobal('devicePixelRatio',1);
  let gpu:GPU|undefined=create([]);const adapter=await gpu.requestAdapter();expect(adapter).toBeTruthy();
  const device=await adapter!.requestDevice(),format=gpu.getPreferredCanvasFormat(),errors:string[]=[];
  device.addEventListener('uncapturederror',e=>errors.push(e.error.message));
  const target=device.createTexture({size:[128,128],format,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC});
  vi.stubGlobal('navigator',{gpu:{requestAdapter:async()=>({requestDevice:async()=>device}),getPreferredCanvasFormat:()=>format}});
  const canvas={width:128,height:128,style:{},getBoundingClientRect:()=>({width:128,height:128}),getContext:()=>({configure(){},unconfigure(){},getCurrentTexture:()=>target}),addEventListener(){},removeEventListener(){}} as unknown as HTMLCanvasElement;
  const registry=await createAssetRegistry([imageInput(),secondImageInput()],{colorPolicy:'source'}),renderer=new CanvasRenderer(canvas);
  renderer.onError=e=>errors.push(e.message);
  const sequence:SceneSequence=new SceneSequence({modelAssets:registry,prepare:scenes=>renderer.prepare(scenes,sequence.assetGeometry)});
  try {
    const uploads=vi.spyOn(device.queue,'writeTexture');
    for(const entry of imageCases){
    const result=await sequence.submit({type:'load',scenes:[{id:'image',source:imageCaseSource(entry,registry.catalog[0].hash)}]});
    expect(result.ok,JSON.stringify(result)).toBe(true);renderer.render(sequence.frame(0,0),sequence.compiled[0].options);
    const buffer=device.createBuffer({size:128*128*4,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
    const encoder=device.createCommandEncoder();encoder.copyTextureToBuffer({texture:target},{buffer,bytesPerRow:512},[128,128]);device.queue.submit([encoder.finish()]);
    await buffer.mapAsync(GPUMapMode.READ);const rgba=new Uint8Array(buffer.getMappedRange()).slice();buffer.unmap();buffer.destroy();
    if(format==='bgra8unorm')for(let i=0;i<rgba.length;i+=4)[rgba[i],rgba[i+2]]=[rgba[i+2],rgba[i]];
    const pixel=(x:number,y:number)=>[...rgba.slice((y*128+x)*4,(y*128+x)*4+3)];
    expect(errors).toEqual([]);
    for(const [x,y,...expected] of entry.probes){const actual=pixel(x,y);expect(actual.every((v,i)=>Math.abs(v-expected[i])<=1),entry.name+': '+JSON.stringify({actual,expected})).toBe(true);}
    }
    expect(uploads).toHaveBeenCalledTimes(2);uploads.mockRestore();
  } finally {sequence.dispose();renderer.dispose();target.destroy();device.destroy();gpu=undefined;vi.unstubAllGlobals();}
});

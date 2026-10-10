import {integrationCases} from './integration-cases.js';
import { capClippingCases, capClippingIssues, explanatoryCases, explanatoryMorphSource, labelProjectionCases, labelProjectionIssues } from './explanatory-cases.js';
/// <reference types="@webgpu/types" />
import {beforeAll,afterAll,describe,it,expect,vi} from 'vitest';
import {create,globals} from 'webgpu';
import {VertexBufferLimitError} from '../src/vertex-buffer.js';
import {VERTEX_FLOATS} from '../src/texture-shader.js';
import {createPlayer} from '../src/player.js';
import {CanvasRenderer} from '../src/renderer.js';
import {SceneSequence} from '../src/sequence.js';
import {initialSources} from '../demo/scenes.js';
import {interactionSource} from '../demo/interaction.js';
import {project} from '../src/geometry.js';
import {mkdir,writeFile} from 'node:fs/promises';
import {deflateSync} from 'node:zlib';
import {join} from 'node:path';
import colorString from 'color-string';
import {Color,paletteResolver} from '../src/palette.js';
import type {PaletteColor} from '../src/types.js';
import {lessonScenes} from '../../../frontend/app/src/lessonScenes';
import {lessons} from '../../../frontend/app/src/data';
import {compositionCases} from './composition-cases.js';
import {waveSource} from './dynamic-surface-cases.js';
import {reactiveCases} from './reactive-cases.js';
import {lightingCases} from './lighting-cases.js';
import {materialCases,materialSource,bumpSource} from './material-cases.js';
import {textureCases,texturePixelIssues} from './texture-cases.js';
import {retainedPrecisionCases,retainedCases,occlusionGateSource,occlusionGateFrames} from './retained-cases.js';
import {RetainedGeometry} from '../src/retained-geometry.js';
import {transparencyCases} from './transparency-cases.js';

// Uses a real native WebGPU device and render target. Only the window/canvas surface is stubbed.
// This is a development test adapter, never a browser renderer fallback.
describe('native WebGPU rendering',()=> {
  const width=640,height=480;
  let gpu:GPU|undefined,device:GPUDevice|undefined,texture:GPUTexture|undefined;
  let renderer:CanvasRenderer,sequence:SceneSequence,canvas:HTMLCanvasElement;
  const errors:string[]=[];
  let format:GPUTextureFormat;
  beforeAll(async()=> {
    for(const [name,value] of Object.entries(globals))vi.stubGlobal(name,value);
    vi.stubGlobal('ResizeObserver',class {observe(){}disconnect(){}});
    vi.stubGlobal('devicePixelRatio',1);
    // Match production frame rendering: let Dawn select the native platform backend.
    gpu=create([]);
    const adapter=await gpu.requestAdapter();
    if(!adapter)throw new Error('Native WebGPU smoke test requires a native adapter; this is not a rendering fallback.');
    device=await adapter.requestDevice();
    device.addEventListener('uncapturederror',event=>errors.push(event.error.message));
    format=gpu.getPreferredCanvasFormat();
    texture=device.createTexture({size:[width,height],format,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC});
    const context={configure:()=>{},unconfigure:()=>{},getCurrentTexture:()=> {
      if(texture!.width!==canvas.width||texture!.height!==canvas.height){texture!.destroy();texture=device!.createTexture({size:[canvas.width,canvas.height],format,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC});}
      return texture;
    }};
    canvas={width,height,style:{},getBoundingClientRect:()=>({width,height}),getContext:(kind:string)=>{expect(kind).toBe('webgpu');return context;},addEventListener:()=>{},removeEventListener:()=>{}} as unknown as HTMLCanvasElement;
    // The renderer still calls its production requestAdapter/requestDevice path.
    vi.stubGlobal('navigator',{gpu:{requestAdapter:async()=>({requestDevice:async()=>device}),getPreferredCanvasFormat:()=>format}});
    renderer=new CanvasRenderer(canvas);renderer.onError=error=>errors.push(error.message);
    // Large allocation fixtures test GPU limits, not the default sandbox time budget.
    sequence=new SceneSequence({executionLimitMs:1000,prepare:scenes=>renderer.prepare(scenes)});
    const result=await sequence.submit({type:'load',scenes:initialSources});
    expect(result).toEqual({ok:true,revision:1,diagnostics:[]});
  });
  afterAll(()=> {
    sequence?.dispose();texture?.destroy();renderer?.dispose();device?.destroy();gpu=undefined;vi.unstubAllGlobals();
  });
  async function pixels():Promise<Uint8Array> {
    const width=texture!.width,height=texture!.height;
    const bytesPerRow=Math.ceil(width*4/256)*256;
    const buffer=device!.createBuffer({size:bytesPerRow*height,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
    const command=device!.createCommandEncoder();
    command.copyTextureToBuffer({texture:texture!},{buffer,bytesPerRow,rowsPerImage:height},[width,height]);
    device!.queue.submit([command.finish()]);
    await buffer.mapAsync(GPUMapMode.READ);
    const rgba=new Uint8Array(width*height*4),mapped=new Uint8Array(buffer.getMappedRange());
    for(let y=0;y<height;y++)rgba.set(mapped.subarray(y*bytesPerRow,y*bytesPerRow+width*4),y*width*4);
    buffer.unmap();buffer.destroy();
    if(format==='bgra8unorm')for(let i=0;i<rgba.length;i+=4)[rgba[i],rgba[i+2]]=[rgba[i+2],rgba[i]];
    return rgba;
  }
  async function artifact(name:string,image:Uint8Array):Promise<void> {
    const width=texture!.width,height=texture!.height;
    const directory=process.env.ANIMLIB_GPU_ARTIFACTS;if(!directory)return;
    // Small dependency-free RGBA PNG encoder for optional real GPU readback artifacts.
    const crc=(data:Uint8Array)=>{let crc=0xffffffff;for(const byte of data){crc^=byte;for(let k=0;k<8;k++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;};
    const chunk=(kind:string,data:Buffer)=>{const type=Buffer.from(kind),size=Buffer.alloc(4),checksum=Buffer.alloc(4);size.writeUInt32BE(data.length);checksum.writeUInt32BE(crc(Buffer.concat([type,data])));return Buffer.concat([size,type,data,checksum]);};
    const header=Buffer.alloc(13);header.writeUInt32BE(width);header.writeUInt32BE(height,4);header[8]=8;header[9]=6;
    const rows=Buffer.alloc(height*(width*4+1));for(let y=0;y<height;y++)rows.set(image.subarray(y*width*4,(y+1)*width*4),y*(width*4+1)+1);
    await mkdir(directory,{recursive:true});await writeFile(join(directory,name+'.png'),Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(rows)),chunk('IEND',Buffer.alloc(0))]));
  }
  function changedPixels(image:Uint8Array,background:PaletteColor=Color.BLACK):number {const rgb=colorString.get.rgb(paletteResolver().resolve(background))!;let count=0;for(let i=0;i<image.length;i+=4)if(Math.abs(image[i]-rgb[0])+Math.abs(image[i+1]-rgb[1])+Math.abs(image[i+2]-rgb[2])>12)count++;return count;}
  it.each(integrationCases)('cross-feature: $name',async entry=>{
    renderer.resetInteraction();
    await entry.run({sequence,draw:async(frame,options,reference=false)=>{
      const bypass=reference?vi.spyOn(RetainedGeometry.prototype,'get').mockReturnValue(undefined):undefined;
      const uploads=vi.spyOn(device!.queue,'writeBuffer');
      const encoder=device!.createCommandEncoder.bind(device!);let indexed=0;
      const encoding=vi.spyOn(device!,'createCommandEncoder').mockImplementation((...args)=>{
        const e=encoder(...args),begin=e.beginRenderPass.bind(e);
        e.beginRenderPass=(...args)=>{const p=begin(...args),draw=p.drawIndexed.bind(p);p.drawIndexed=(...args)=>{indexed++;return draw(...args);};return p;};return e;
      });
      try {
        renderer.render(frame,options);
        return {pixels:await pixels(),indexed,resources:(renderer as unknown as {gpuRetained:{meshes:Map<unknown,unknown>}}).gpuRetained.meshes.size,
          uploads:uploads.mock.calls.filter(([buffer])=>buffer.usage&(GPUBufferUsage.VERTEX|GPUBufferUsage.INDEX)).length};
      } finally {bypass?.mockRestore();uploads.mockRestore();encoding.mockRestore();}
    }});
    expect(errors).toEqual([]);
  });
  it.each(lightingCases)('lighting: $name',async test=>{
    let imageIndex=0;
    await test.run(async(source,yaw=0,time=0)=>{
      renderer.resetInteraction();
      (renderer as unknown as {retained:RetainedGeometry}).retained.clear();
      const result=await sequence.submit({type:'load',scenes:[{id:'lighting',source}]});
      expect(result.ok,JSON.stringify(result)).toBe(true);
      renderer.setOrbit({yaw,pitch:0});
      renderer.render(sequence.frame(0,time),sequence.compiled[0].options);
      const image=await pixels();await artifact('lighting-'+test.name.replace(/[^a-z]+/gi,'-')+'-'+imageIndex++,image);return image;
    });
    expect(errors).toEqual([]);
    expect((await sequence.submit({type:'load',scenes:initialSources})).ok).toBe(true);
  });
  it('caps shadow-expanded allocations and rejects oversized uploads without losing the last frame',async()=>{
    const source=(count:number)=>`export default scene({mode:'3d',lighting:{directional:{direction:[0,1,0],space:'world',shadow:{quality:'high'}},receiver:{size:[8,8]}}},s=>{
      for(let i=0;i<${count};i++)s.parametricSurface('surface'+i,{uSegments:100,vSegments:100,fn:(u,v)=>[u,1+i*.1,v]});s.wait(1);
    });`;
    // Default production requestDevice() guarantees at least this limit; the
    // regression target requests no increased maxBufferSize on the test device.
    const limit=device!.limits.maxBufferSize;
    expect(limit).toBe(268435456);
    const create=vi.spyOn(device!,'createBuffer'),submit=vi.spyOn(device!.queue,'submit'),write=vi.spyOn(device!.queue,'writeBuffer');
    const controlled:Error[]=[],previousError=renderer.onError;
    renderer.onError=error=>controlled.push(error);
    try {
      const loaded=await sequence.submit({type:'load',scenes:[{id:'large-shadow',source:source(2)}]});
      expect(loaded.ok,JSON.stringify(loaded)).toBe(true);
      renderer.resetInteraction();renderer.render(sequence.frame(0,0),sequence.compiled[0].options);
      await device!.queue.onSubmittedWorkDone();
      expect(controlled).toEqual([]);expect(errors).toEqual([]);
      const buffers=create.mock.calls.map(([descriptor])=>descriptor).filter(d=>(d.usage&GPUBufferUsage.VERTEX)!==0);
      expect(buffers.map(d=>d.size)).toEqual([limit]); // payload fits; doubled growth does not.
      const expandedBytes=(count:number)=>(count*100*100*6*14+6)*VERTEX_FLOATS*4;
      expect(expandedBytes(2)).toBeLessThanOrEqual(limit);expect(expandedBytes(2)*2).toBeGreaterThan(limit);
      expect(write.mock.calls.some(([, ,data])=>(data as ArrayBufferView).byteLength===expandedBytes(2))).toBe(true);
      const before=await pixels();expect(changedPixels(before)).toBeGreaterThan(1000);
      const oversized=await sequence.submit({type:'load',scenes:[{id:'large-shadow',source:source(3)}]});
      expect(oversized.ok,JSON.stringify(oversized)).toBe(true);
      const allocationCount=create.mock.calls.length,submitCount=submit.mock.calls.length,writeCount=write.mock.calls.length;
      renderer.render(sequence.frame(0,0),sequence.compiled[0].options);
      expect(controlled).toHaveLength(1);expect(controlled[0]).toBeInstanceOf(VertexBufferLimitError);
      expect(expandedBytes(3)).toBeGreaterThan(limit);
      expect(controlled[0].message).toContain(String(expandedBytes(3)));
      expect(create).toHaveBeenCalledTimes(allocationCount);expect(submit).toHaveBeenCalledTimes(submitCount);expect(write).toHaveBeenCalledTimes(writeCount);
      expect(renderer.backend).toBe('webgpu');expect(Buffer.from(await pixels())).toEqual(Buffer.from(before));
      expect(errors).toEqual([]);
      // A scene budget error is recoverable: a smaller frame renders on the same device.
      expect((await sequence.submit({type:'load',scenes:initialSources})).ok).toBe(true);
      renderer.render(sequence.frame(0,0),sequence.compiled[0].options);await device!.queue.onSubmittedWorkDone();
      expect(renderer.backend).toBe('webgpu');expect(controlled).toHaveLength(1);expect(errors).toEqual([]);
    } finally {renderer.onError=previousError;create.mockRestore();submit.mockRestore();write.mockRestore();}
  });
  it.each(retainedCases)('retained/reference pixels: $name',async ({source})=>{
    renderer.resetInteraction();
    expect((await sequence.submit({type:'load',scenes:[{id:'retained',source}]})).ok).toBe(true);
    for(const [yaw,pitch,time] of [[0,0,0],[0.7,0.35,0.5],[-0.8,-0.4,1]]) {
      const frame=sequence.frame(0,time);frame.camera={...frame.camera,yaw,pitch};
      renderer.render(frame,sequence.compiled[0].options);const optimized=await pixels();
      const bypass=vi.spyOn(RetainedGeometry.prototype,'get').mockReturnValue(undefined);
      try {renderer.render(frame,sequence.compiled[0].options);} finally {bypass.mockRestore();}
      const reference=await pixels();
      expect(changedPixels(optimized)).toBeGreaterThan(200);
      expect(optimized.filter((v,i)=>Math.abs(v-reference[i])>3).length).toBeLessThan(optimized.length*0.002);
    }
    expect(errors).toEqual([]);
  });
  it.each(retainedPrecisionCases)('retained precision/reference pixels: $name',async ({source,retained,orbit})=>{
    renderer.resetInteraction();
    expect((await sequence.submit({type:'load',scenes:[{id:'precision',source}]})).ok).toBe(true);
    (renderer as unknown as {retained:RetainedGeometry}).retained.clear();
    let warm=false;
    for(const [yaw,pitch,time] of [[0,0,0],[0,0,0],[0.3,0.15,1],[0,0,0]]) {
      const frame=sequence.frame(0,time);frame.camera={...frame.camera,yaw:orbit===false?0:yaw,pitch:orbit===false?0:pitch};
      const uploads=vi.spyOn(device!.queue,'writeBuffer');
      let geometryUploads=0;
      try {
        renderer.render(frame,sequence.compiled[0].options);
        geometryUploads=uploads.mock.calls.filter(([buffer])=>buffer.usage&(GPUBufferUsage.VERTEX|GPUBufferUsage.INDEX)).length;
      } finally {uploads.mockRestore();}
      const optimized=await pixels();
      const resources=(renderer as unknown as {gpuRetained:{meshes:Map<unknown,unknown>}}).gpuRetained.meshes;
      const usedRetained=resources.size>0;
      const bypass=vi.spyOn(RetainedGeometry.prototype,'get').mockReturnValue(undefined);
      try {renderer.render(frame,sequence.compiled[0].options);} finally {bypass.mockRestore();}
      const reference=await pixels();
      expect(changedPixels(reference)).toBeGreaterThan(200);
      expect(optimized.filter((v,i)=>Math.abs(v-reference[i])>3)).toHaveLength(0);
      expect(usedRetained).toBe(retained);
      if(warm&&retained)expect(geometryUploads).toBe(0);
      // Leave retained resources warm for the next sample (reference rendering
      // deliberately releases them), exercising both cold and reused meshes.
      renderer.render(frame,sequence.compiled[0].options);await pixels();warm=true;
    }
    expect(errors).toEqual([]);
  });
  it('camera-only frames retain GPU vertex/index buffers and instance repeated spheres',async()=>{
    renderer.resetInteraction();
    expect((await sequence.submit({type:'load',scenes:[{id:'retained',source:`export default scene({mode:'3d'},s=>{
      for(let i=0;i<8;i++)s.sphere('s'+i,{radius:0.2,position:[i/2-2,0,0],fill:'BLUE'});s.wait(2);
    });`}]})).ok).toBe(true);
    renderer.render(sequence.frame(0,0),sequence.compiled[0].options);await pixels();
    const uploads=vi.spyOn(device!.queue,'writeBuffer');
    try {
      const frame=sequence.frame(0,1);frame.camera.yaw=0.4;
      renderer.render(frame,sequence.compiled[0].options);expect(changedPixels(await pixels())).toBeGreaterThan(100);
      expect(uploads.mock.calls.filter(([buffer])=>buffer.usage&(GPUBufferUsage.VERTEX|GPUBufferUsage.INDEX))).toHaveLength(0);
      expect(uploads.mock.calls.some(([buffer])=>buffer.usage&GPUBufferUsage.UNIFORM)).toBe(true);
    } finally {uploads.mockRestore();}
    expect(errors).toEqual([]);
    expect((await sequence.submit({type:'load',scenes:initialSources})).ok).toBe(true);
  });
  it('label occlusion integration gate submits final world-space occluders, including morph endpoints',async()=>{
    expect((await sequence.submit({type:'load',scenes:[{id:'occlusion-gate',source:occlusionGateSource}]})).ok).toBe(true);
    const frame=sequence.frame(0,0),options=sequence.compiled[0].options;
    const resourceCount=()=> (renderer as unknown as {gpuRetained:{meshes:Map<unknown,unknown>}}).gpuRetained.meshes.size;
    renderer.render(frame,options);expect(changedPixels(await pixels())).toBeGreaterThan(200);expect(resourceCount()).toBeGreaterThan(0);
    for(const dependent of occlusionGateFrames(frame)) {
      renderer.render(dependent,options);expect(changedPixels(await pixels())).toBeGreaterThan(200);
      expect(resourceCount()).toBe(0);
    }
    renderer.render(frame,options);await pixels();expect(resourceCount()).toBeGreaterThan(0);
    expect(errors).toEqual([]);
    expect((await sequence.submit({type:'load',scenes:initialSources})).ok).toBe(true);
  });
  it.each([false,true])('bump changes normals with constant albedo, metal=%s',async metal=>{
    const images:Uint8Array[]=[];
    for(const strength of [undefined,0,0.15,-0.15]) {
      renderer.resetInteraction();
      expect((await sequence.submit({type:'load',scenes:[{id:'bump',source:bumpSource(strength,false,metal)}]})).ok).toBe(true);
      renderer.render(sequence.frame(0,0),sequence.compiled[0].options);images.push(await pixels());
    }
    expect(Buffer.from(images[0]).equals(Buffer.from(images[1]))).toBe(true);
    expect(images[1].filter((v,i)=>Math.abs(v-images[2][i])>5).length).toBeGreaterThan(1000);
    expect(images[2].filter((v,i)=>Math.abs(v-images[3][i])>5).length).toBeGreaterThan(1000);
    for(let i=0;i<images[0].length;i+=4)expect(images[2][i]>0).toBe(images[0][i]>0);
    expect(errors).toEqual([]);
    expect((await sequence.submit({type:'load',scenes:initialSources})).ok).toBe(true);
  });
  it('explanatory morph pixels are deterministic after backwards seeking',async()=>{
    expect((await sequence.submit({type:'load',scenes:[{id:'explanatory',source:explanatoryMorphSource}]})).ok).toBe(true);
    const captures:Uint8Array[]=[];
    for(const time of [0,1,2,1]){renderer.render(sequence.frame(0,time),sequence.compiled[0].options);captures.push(await pixels());}
    expect(captures[0]).not.toEqual(captures[1]);expect(captures[1]).not.toEqual(captures[2]);expect(captures[3]).toEqual(captures[1]);
    expect((await sequence.submit({type:'load',scenes:initialSources})).ok).toBe(true);
  });
  for (const fixture of labelProjectionCases) it(`explanatory projection: ${fixture.name}`,async()=>{
    const images:Uint8Array[]=[];
    for(const source of fixture.sources) {
      expect((await sequence.submit({type:'load',scenes:[{id:'projection',source}]})).ok).toBe(true);
      renderer.render(sequence.frame(0,0),sequence.compiled[0].options);images.push(await pixels());
    }
    expect(labelProjectionIssues(images.map(image=>(x,y)=>Array.from(image.subarray((y*width+x)*4,(y*width+x)*4+3))))).toEqual([]);
    expect((await sequence.submit({type:'load',scenes:initialSources})).ok).toBe(true);
  });
  for(const dpr of [1,2])for(const fixture of capClippingCases)it(`explanatory DPR ${dpr}: ${fixture.name}`,async()=>{
    vi.stubGlobal('devicePixelRatio',dpr);
    (renderer as unknown as {resize():void}).resize();
    try {
      const images:Uint8Array[]=[];
      for(const [i,source] of fixture.sources.entries()) {
        expect((await sequence.submit({type:'load',scenes:[{id:'cap',source}]})).ok).toBe(true);
        renderer.render(sequence.frame(0,0),sequence.compiled[0].options);
        expect([texture!.width,texture!.height]).toEqual([width*dpr,height*dpr]);
        const image=await pixels();images.push(image);
        await artifact(`cap-DPR${dpr}-${fixture.name.replaceAll(' ','-')}-${i}`,image);
      }
      expect(capClippingIssues(images.map(image=>(x,y)=>{
        const i=(y*dpr*width*dpr+x*dpr)*4;return Array.from(image.subarray(i,i+3));
      }),fixture.laterCut)).toEqual([]);
    } finally {
      vi.stubGlobal('devicePixelRatio',1);(renderer as unknown as {resize():void}).resize();
    }
    expect((await sequence.submit({type:'load',scenes:initialSources})).ok).toBe(true);
  });
  for (const fixture of explanatoryCases) it(`explanatory: ${fixture.name}`,async()=>{
    expect((await sequence.submit({type:'load',scenes:[{id:'explanatory',source:fixture.source}]})).ok).toBe(true);
    renderer.render(sequence.frame(0,0),sequence.compiled[0].options);
    const image=await pixels();
    const at=(x:number,y:number)=>Array.from(image.subarray((y*width+x)*4,(y*width+x)*4+3));
    expect(fixture.check(at)).toEqual([]);
    await artifact('explanatory-'+fixture.name.replaceAll(' ','-'),image);
    expect((await sequence.submit({type:'load',scenes:initialSources})).ok).toBe(true);
  });
  it('bump leaves unlit pixels unchanged',async()=>{
    const images:Uint8Array[]=[];
    for(const strength of [0,0.2]) {
      expect((await sequence.submit({type:'load',scenes:[{id:'bump',source:bumpSource(strength,true)}]})).ok).toBe(true);
      renderer.render(sequence.frame(0,0),sequence.compiled[0].options);images.push(await pixels());
    }
    expect(Buffer.from(images[0]).equals(Buffer.from(images[1]))).toBe(true);
    expect(errors).toEqual([]);
    expect((await sequence.submit({type:'load',scenes:initialSources})).ok).toBe(true);
  });
  it.each(materialCases)('material $name changes real shaded pixels',async ({a,b})=>{
    const images:Uint8Array[]=[];
    for(const material of [a,b]) {
      renderer.resetInteraction();
      expect((await sequence.submit({type:'load',scenes:[{id:'material',source:materialSource(material)}]})).ok).toBe(true);
      renderer.render(sequence.frame(0,0),sequence.compiled[0].options);images.push(await pixels());
    }
    expect(images[0].filter((v,i)=>Math.abs(v-images[1][i])>5).length).toBeGreaterThan(100);
    expect(errors).toEqual([]);
    expect((await sequence.submit({type:'load',scenes:initialSources})).ok).toBe(true);
  });
  it('emission adds the configured color and intensity to unlit geometry',async()=>{
    const source=materialSource('{emissive:"PURE_BLUE",emissiveIntensity:0.5}','mesh');
    expect((await sequence.submit({type:'load',scenes:[{id:'emissive',source}]})).ok).toBe(true);
    renderer.render(sequence.frame(0,0),sequence.compiled[0].options);const image=await pixels();
    const rgb=Array.from(image.slice((240*width+320)*4,(240*width+320)*4+3));
    expect(rgb.slice(0,2)).toEqual([0,0]);expect(Math.abs(rgb[2]-128)).toBeLessThanOrEqual(1);
    expect(errors).toEqual([]);
    expect((await sequence.submit({type:'load',scenes:initialSources})).ok).toBe(true);
  });
  it.each(textureCases)('procedural $pattern fragments and object-space translation',async ({pattern,source})=>{
    renderer.resetInteraction();
    expect((await sequence.submit({type:'load',scenes:[{id:'texture',source}]})).ok).toBe(true);
    renderer.render(sequence.frame(0,0),sequence.compiled[0].options);const original=await pixels();
    const at=(x:number,y:number)=>Array.from(original.slice((y*width+x)*4,(y*width+x)*4+3));
    expect(texturePixelIssues(pattern,at)).toEqual([]);
    await artifact('texture-'+pattern,original);
    renderer.render(sequence.frame(0,1),sequence.compiled[0].options);const moved=await pixels();
    for(let y=160;y<320;y+=9)for(let x=240;x<390;x+=9)for(let c=0;c<3;c++)
      expect(Math.abs(original[(y*width+x)*4+c]-moved[(y*width+x+60)*4+c])).toBeLessThanOrEqual(2);
    renderer.render(sequence.frame(0,0),sequence.compiled[0].options);
    expect(await pixels()).toEqual(original);expect(errors).toEqual([]);
    expect((await sequence.submit({type:'load',scenes:initialSources})).ok).toBe(true);
  });
  it.each(compositionCases)('$name',async ({source,time,samples})=>{
    renderer.resetInteraction();
    expect((await sequence.submit({type:'load',scenes:[{id:'composition',source}]})).ok).toBe(true);
    for (const t of [time,0,time]) {
      renderer.render(sequence.frame(0,t),sequence.compiled[0].options);
      const image=await pixels();
      if(t===time)for(const [x,y,rgb] of samples)for(let c=0;c<3;c++)expect(Math.abs(image[(y*width+x)*4+c]-rgb[c])).toBeLessThanOrEqual(2);
    }
    expect(errors).toEqual([]);
    expect((await sequence.submit({type:'load',scenes:initialSources})).ok).toBe(true);
  });
  it('retained wave seeks and paused input match rebuilt pixels in clipped isolated views',async()=>{
    const reference=new SceneSequence({prepare:scenes=>renderer.prepare(scenes)});
    renderer.resetInteraction();
    try {
      expect((await sequence.submit({type:'load',scenes:[{id:'wave',source:waveSource()}]})).ok).toBe(true);
      const original=sequence.compiled[0];let first:Buffer|undefined;
      for(const [time,amplitude,roughness] of [[0.5,0.6,0.45],[2,1,0.15],[0.5,0.6,0.45]]) {
        await sequence.setControl('wave','amplitude',amplitude);await sequence.setControl('wave','roughness',roughness);
        expect((await reference.submit({type:'load',scenes:[{id:'reference',source:waveSource(time,amplitude,roughness)}]})).ok).toBe(true);
        renderer.render(reference.frame(0,time),reference.compiled[0].options);const expected=Buffer.from(await pixels());
        renderer.render(await sequence.evaluate(0,time),original.options);const actual=Buffer.from(await pixels());
        expect(actual.equals(expected)).toBe(true);expect(changedPixels(actual)).toBeGreaterThan(1000);
        if(first && time===0.5)expect(actual.equals(first)).toBe(true);first??=actual;
        expect(sequence.compiled[0]).toBe(original);
      }
      expect(errors).toEqual([]);
    }finally{reference.dispose();}
    expect((await sequence.submit({type:'load',scenes:initialSources})).ok).toBe(true);
  });
  it.each(reactiveCases)('reactive/rebuilt pixels: $name',async fixture=>{
    const legacy=new SceneSequence({prepare:scenes=>renderer.prepare(scenes)});
    renderer.resetInteraction();
    try {
      expect((await legacy.submit({type:'load',scenes:[{id:'a',source:fixture.legacy}]})).ok).toBe(true);
      expect((await sequence.submit({type:'load',scenes:[{id:'a',source:fixture.reactive}]})).ok).toBe(true);
      for(const value of [0.1,2.5,1]) {
        for(const id of ['x','y']) {await legacy.setControl('a',id,value);await sequence.setControl('a',id,value);}
        for(const time of [0,1.5,3]) {
          renderer.render(legacy.frame(0,time),legacy.compiled[0].options);const expected=Buffer.from(await pixels());
          renderer.render(sequence.frame(0,time),sequence.compiled[0].options);
          expect(Buffer.from(await pixels()).equals(expected),`${fixture.name} ${value} @ ${time}`).toBe(true);
        }
      }
      expect(errors).toEqual([]);
    }finally{legacy.dispose();}
    expect((await sequence.submit({type:'load',scenes:initialSources})).ok).toBe(true);
  });
  it.each(transparencyCases)('$name',async ({source,x,y,red})=>{
    renderer.resetInteraction();
    expect((await sequence.submit({type:'load',scenes:[{id:'transparency',source}]})).ok).toBe(true);
    renderer.render(sequence.frame(0,0),sequence.compiled[0].options);
    const image=await pixels();
    expect(Math.abs(image[(y*width+x)*4]-red)).toBeLessThanOrEqual(2);
    expect(image[(y*width+x)*4+2]).toBeGreaterThan(20);
    expect(errors).toEqual([]);
    expect((await sequence.submit({type:'load',scenes:initialSources})).ok).toBe(true);
  });
  it('compiles the production WGSL and renders all three demonstrations',async()=> {
    const observations:number[]=[];
    for(let i=0;i<sequence.compiled.length;i++) {
      renderer.setOrbitEnabled(sequence.compiled[i].options.orbit);
      renderer.render(sequence.frame(i,sequence.compiled[i].duration),sequence.compiled[i].options);
      const image=await pixels();observations.push(changedPixels(image,sequence.compiled[i].options.background));await artifact(initialSources[i].id,image);
      for(const fraction of [0,0.25,0.5,0.999]){renderer.render(sequence.frame(i,sequence.compiled[i].duration*fraction),sequence.compiled[i].options);await artifact(initialSources[i].id+'-'+fraction,await pixels());}
    }
    expect(observations.every(count=>count>1000)).toBe(true);
    expect(errors).toEqual([]);
    console.log('Native Vulkan rendered demo foreground pixels:',observations);
  });
  it('renders every Aha lesson in light and dark mode with deterministic seeking',async()=> {
    for(const lesson of lessons) for(const dark of [false,true]) {
      const background=dark?Color.BLACK:Color.WHITE;
      const result=await sequence.submit({type:'load',scenes:lessonScenes(lesson,{background,ink:dark?Color.WHITE:Color.GREY_E,accent:dark?Color.BLUE:Color.BLUE_E})});
      expect(result.ok).toBe(true);
      const scene=sequence.compiled[0];
      renderer.render(sequence.frame(0,scene.duration/2),scene.options);
      const middle=await pixels();
      expect(changedPixels(middle,background)).toBeGreaterThan(500);
      renderer.render(sequence.frame(0,scene.duration),scene.options);
      await pixels();
      renderer.render(sequence.frame(0,scene.duration/2),scene.options);
      expect(Buffer.from(await pixels()).equals(Buffer.from(middle))).toBe(true);
      await artifact('aha-'+lesson.id+(dark?'-dark':'-light'),middle);
    }
    expect(errors).toEqual([]);
    // Restore the library demo used by the following tests.
    expect((await sequence.submit({type:'load',scenes:initialSources})).ok).toBe(true);
  });
  it('clips independent view regions and renders scene screen overlays above them',async()=> {
    const result=await sequence.submit({type:'load',scenes:[{id:'regions',source:`export default scene({},s=>{
      s.rectangle("background",{width:100,height:100,fill:"PURE_GREEN"});
      s.view("left",{rect:[0.05,0.1,0.4,0.7],camera:{perspective:0,yaw:0,pitch:0}},v=>{
        v.rectangle("red",{width:100,height:100,fill:"PURE_RED"});
        v.rectangle("local-marker",{space:"screen",width:10,height:10,fill:"YELLOW"});
      });
      s.view("right",{rect:[0.5,0.1,0.4,0.7],camera:{perspective:0,yaw:0,pitch:0}},v=>{
        v.rectangle("blue",{width:100,height:100,fill:"PURE_BLUE"});
      });
      s.rectangle("overlay",{space:"screen",position:[-224,0],width:10,height:10,fill:"WHITE"});
      s.wait(1);
    });`}]});
    expect(result.ok).toBe(true);
    renderer.render(sequence.frame(0,0),sequence.compiled[0].options);
    const image=await pixels();
    const at=(x:number,y:number)=>Array.from(image.subarray((y*width+x)*4,(y*width+x)*4+3));
    expect(at(40,200)).toEqual([255,0,0]);expect(at(340,200)).toEqual([0,0,255]);
    expect(at(30,200)).toEqual([0,255,0]);expect(at(300,200)).toEqual([0,255,0]);
    expect(at(96,240)).toEqual([255,255,255]);expect(at(160,216)).toEqual([255,255,0]);
    expect(errors).toEqual([]);await artifact('independent-regions',image);
  });
  it('rotating one 3D region changes only its pixels',async()=> {
    const result=await sequence.submit({type:'load',scenes:[{id:'rotate-regions',source:`export default scene({},s=>{
      s.view("left",{rect:[0,0,0.5,1]},v=>{
        v.sphere("left-ball",{position:[1,0.5,1],radius:0.6,fill:"PURE_RED"});
      });
      s.view("right",{rect:[0.5,0,0.5,1]},v=>{
        v.sphere("right-ball",{position:[1,0.5,1],radius:0.6,fill:"PURE_BLUE"});
      });
      s.wait(1);
    });`}]});
    expect(result.ok).toBe(true);
    renderer.resetInteraction();
    renderer.render(sequence.frame(0,0),sequence.compiled[0].options);
    const before=await pixels();
    renderer.setOrbit({yaw:1,pitch:0.2},'left');
    renderer.render(sequence.frame(0,0),sequence.compiled[0].options);
    const after=await pixels();
    let leftChanges=0,rightChanges=0;
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
      const i=(y*width+x)*4;
      if(before[i]!==after[i]||before[i+1]!==after[i+1]||before[i+2]!==after[i+2]){
        if(x<width/2)leftChanges++;else rightChanges++;
      }
    }
    expect(leftChanges).toBeGreaterThan(100);expect(rightChanges).toBe(0);
    expect(errors).toEqual([]);await artifact('independent-rotation',after);
    renderer.resetInteraction();
    expect((await sequence.submit({type:'load',scenes:initialSources})).ok).toBe(true);
  });
  it('renders a continuous viewer-to-authored camera handoff while another view stays fixed',async()=> {
    expect((await sequence.submit({type:'load',scenes:[{id:'camera-handoff',source:`export default scene({},s=>{
      let camera;
      s.view("left",{rect:[0,0,0.5,1]},v=>{
        camera=v.camera;v.sphere("left-ball",{position:[1,0.5,1],radius:0.6,fill:"PURE_RED"});
      });
      s.view("right",{rect:[0.5,0,0.5,1]},v=>{
        v.sphere("right-ball",{position:[1,0.5,1],radius:0.6,fill:"PURE_BLUE"});
      });
      s.wait(2);s.play(camera.animate({yaw:1.4,pitch:0.1}),{duration:2,ease:"linear"});s.wait(1);
    });`}] })).ok).toBe(true);
    renderer.resetInteraction();
    const scene=sequence.compiled[0];
    const draw=async(time:number)=>{
      const frame=sequence.frame(0,time);
      renderer.syncInteraction('camera-handoff',time,scene,frame);
      renderer.render(frame,scene.options);
      return pixels();
    };
    await draw(1);
    renderer.setOrbit({yaw:0.6,pitch:-0.2},'left');
    renderer.setOrbit({yaw:-0.5,pitch:0.3},'right');
    const before=await draw(1.999),start=await draw(2);
    expect(Buffer.from(start).equals(Buffer.from(before))).toBe(true);
    const middle=await draw(3);
    expect(Buffer.from(middle).equals(Buffer.from(start))).toBe(false);
    for(let y=0;y<height;y++){
      const from=(y*width+width/2)*4,to=(y+1)*width*4;
      expect(Buffer.from(middle.subarray(from,to)).equals(Buffer.from(before.subarray(from,to)))).toBe(true);
    }
    const expected=sequence.frame(0,3);
    expected.views![0].camera={...expected.views![0].camera,yaw:(0.55+0.6+1.4)/2,pitch:(0.35-0.2+0.1)/2};
    renderer.setOrbit({yaw:0,pitch:0},'left');
    renderer.render(expected,scene.options);
    expect(Buffer.from(await pixels()).equals(Buffer.from(middle))).toBe(true);
    await draw(4);expect(renderer.getOrbit('left')).toEqual({yaw:0,pitch:0});
    expect(Buffer.from(await draw(3)).equals(Buffer.from(middle))).toBe(true);
    await artifact('camera-handoff-start',start);await artifact('camera-handoff-middle',middle);
    expect(errors).toEqual([]);
    renderer.resetInteraction();
    expect((await sequence.submit({type:'load',scenes:initialSources})).ok).toBe(true);
  });
  it('keeps world-up, billboard labels, CPU projection, and lighting aligned throughout an orbit',async()=> {
    expect((await sequence.submit({type:'load',scenes:[{id:'upright-orbit',source:`export default scene({mode:"3d",orbit:false},s=>{
      s.sphere("lit",{radius:0.5,fill:"PURE_GREEN",stroke:"none"});
      s.rectangle("label",{position:[0,1.5,0],billboard:true,billboardOffset:[0.2,0.1,0.25],width:0.6,height:0.3,fill:"PURE_RED",stroke:"none"});
      s.wait(1);
    });`}] })).ok).toBe(true);
    const base=sequence.frame(0,0);
    for(const yaw of [0,Math.PI/2,Math.PI,3*Math.PI/2])for(const pitch of [-0.6,0.6]) {
      const camera={...base.camera,yaw,pitch,height:8,distance:10,perspective:1};
      renderer.render({...base,camera},sequence.compiled[0].options);
      const image=await pixels(),xs:number[]=[],ys:number[]=[];
      for(let y=0;y<height;y++)for(let x=0;x<width;x++){
        const i=(y*width+x)*4;if(image[i]>220&&image[i+1]<20){xs.push(x);ys.push(y);}
      }
      expect(xs.length).toBeGreaterThan(300);
      const anchor=project([0,1.5,0],camera,width,height);
      expect(anchor.x).toBeCloseTo(width/2); // World-up never leans sideways.
      const scale=height/camera.height*camera.distance/(anchor.depth-0.25);
      const expectedX=width/2+0.2*scale;
      const expectedY=height/2-((height/2-anchor.y)/anchor.scale+0.1)*scale;
      const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
      expect(Math.abs((minX+maxX+1)/2-expectedX)).toBeLessThan(1);
      expect(Math.abs((minY+maxY+1)/2-expectedY)).toBeLessThan(1);
      expect(Math.abs(maxX-minX+1-0.6*scale)).toBeLessThan(2);
      expect(Math.abs(maxY-minY+1-0.3*scale)).toBeLessThan(2);
      // A sphere's camera-facing normal stays facing the same screen-space light.
      const green=image[(height/2*width+width/2)*4+1];
      expect(green).toBeGreaterThan(205);expect(green).toBeLessThan(235);
      await artifact(`upright-orbit-${yaw.toFixed(2)}-${pitch}`,image);
    }
    expect(errors).toEqual([]);
    expect((await sequence.submit({type:'load',scenes:initialSources})).ok).toBe(true);
  });
  it('renders intermediate geometric and named LaTeX morph frames',async()=> {
    const first=sequence.compiled[0];
    renderer.render(sequence.frame(0,2.4),first.options);
    const during=await pixels();await artifact('linear-algebra-morph',during);
    renderer.render(sequence.frame(0,first.duration),first.options);
    const end=await pixels();
    expect(changedPixels(during,first.options.background)).toBeGreaterThan(1000);
    expect(during).not.toEqual(end);expect(errors).toEqual([]);
  });
  it('depth-tests intersecting mesh faces per pixel rather than by average face depth',async()=> {
    const result=await sequence.submit({type:'load',scenes:[{id:'depth',source:String.raw`export default scene({mode:"3d",background:"GREY_E"},s=>{
      s.mesh("slanted",{vertices:[[-2,-2,2],[2,-2,-2],[0,2,0]],triangles:[[0,1,2]],fill:"PURE_RED",stroke:"none"});
      s.mesh("flat",{vertices:[[-2,-2,0],[2,-2,0],[0,2,0]],triangles:[[0,1,2]],fill:"PURE_BLUE",stroke:"none"});
      s.wait(1);
    });`}]});
    expect(result.ok).toBe(true);renderer.render(sequence.frame(0,0),sequence.compiled[0].options);
    const image=await pixels();await artifact('mesh-depth',image);
    const at=(x:number,y:number)=>Array.from(image.subarray((y*width+x)*4,(y*width+x)*4+3));
    expect(at(width/2-40,height/2)).toEqual([255,0,0]);
    expect(at(width/2+40,height/2)).toEqual([0,0,255]);expect(errors).toEqual([]);
  });
  it('uses centered CSS pixels for screen labels independently of camera projection',async()=> {
    const result=await sequence.submit({type:'load',scenes:[{id:'screen',source:String.raw`export default scene({mode:"3d",background:"GREY_E"},s=>{
      s.rectangle("marker",{space:"screen",position:[100,50],width:20,height:20,fill:"PURE_RED",stroke:"none"});
      s.wait(1);
    });`}]});
    expect(result.ok).toBe(true);
    renderer.render(sequence.frame(0,0),sequence.compiled[0].options);
    const image=await pixels();
    const at=(x:number,y:number)=>Array.from(image.subarray((y*width+x)*4,(y*width+x)*4+3));
    expect(at(width/2+100,height/2-50)).toEqual([255,0,0]);
    // The scene uses the Manim GREY_E background token.
    expect(at(width/2,height/2)).toEqual([34,34,34]);expect(errors).toEqual([]);
  });  it('keeps the arrow silhouette stable through an identity morph',async()=> {
    const result=await sequence.submit({type:'load',scenes:[{id:'arrow',source:String.raw`export default scene({background:"BLACK"},s=>{
      const a=s.arrow("arrow",{points:[[0,0],[2,1]],stroke:"WHITE",strokeWidth:0.12});
      s.wait(1);s.play(a.morphTo({kind:"arrow",points:[[0,0],[2,1]]}),{duration:2});
    });`}]});expect(result.ok).toBe(true);
    renderer.render(sequence.frame(0,0),sequence.compiled[0].options);const before=await pixels();
    renderer.render(sequence.frame(0,2),sequence.compiled[0].options);const during=await pixels();await artifact('arrow-identity-morph',during);
    let differences=0;for(let i=0;i<during.length;i+=4)if(Math.abs(during[i]-before[i])>12)differences++;
    expect(differences).toBeLessThan(32);expect(changedPixels(during)).toBeGreaterThan(500);expect(errors).toEqual([]);
  });
  it('antialiases stroke boundaries without double-blending shared corner joins',async()=> {
    const result=await sequence.submit({type:'load',scenes:[{id:'stroke',source:String.raw`export default scene({background:"BLACK"},s=>{
      s.rectangle("box",{width:3,height:2,position:[0.013,0.017],fill:"none",stroke:"WHITE",strokeWidth:0.06,opacity:0.5});s.wait(1);
    });`}]});expect(result.ok).toBe(true);
    renderer.render(sequence.frame(0,0),sequence.compiled[0].options);const image=await pixels();await artifact('antialiased-border',image);
    let max=0,antialiased=0;for(let i=0;i<image.length;i+=4){max=Math.max(max,image[i]);if(image[i]>0&&image[i]<120)antialiased++;}
    expect(max).toBeLessThanOrEqual(128);expect(max).toBeGreaterThanOrEqual(127);expect(antialiased).toBeGreaterThan(100);expect(errors).toEqual([]);
  });
  it('occludes a center-to-edge bond behind a lit sphere surface',async()=> {
    const result=await sequence.submit({type:'load',scenes:[{id:'sphere',source:String.raw`export default scene({mode:"3d",background:"BLACK"},s=>{
      s.sphere("atom",{radius:1,fill:"PURE_BLUE",stroke:"none"});
      s.line("bond",{points:[[0,0,0],[2,0,0]],stroke:"WHITE",strokeWidth:0.08});s.wait(1);
    });`}]});expect(result.ok).toBe(true);
    const frame=sequence.frame(0,0);
    renderer.render(frame,sequence.compiled[0].options);const image=await pixels();await artifact('sphere-bond-occlusion',image);
    const at=(x:number,y:number)=>Array.from(image.subarray((y*width+x)*4,(y*width+x)*4+3));
    const center=at(width/2,height/2);expect(center[0]).toBe(0);expect(center[2]).toBeGreaterThan(150);
    const exposedBond=project([1.6,0,0],frame.camera,width,height);
    expect(at(Math.round(exposedBond.x),Math.round(exposedBond.y))).toEqual([255,255,255]);expect(errors).toEqual([]);
  });
  it('retains rear alpha contributions when translucent mesh faces intersect',async()=> {
    const result=await sequence.submit({type:'load',scenes:[{id:'alpha',source:String.raw`export default scene({mode:"3d",background:"BLACK"},s=>{
      s.mesh("slanted",{vertices:[[-2,-2,2],[2,-2,-2],[0,2,0]],triangles:[[0,1,2]],fill:"PURE_RED",stroke:"none",opacity:0.5});
      s.mesh("flat",{vertices:[[-2,-2,0],[2,-2,0],[0,2,0]],triangles:[[0,1,2]],fill:"PURE_BLUE",stroke:"none",opacity:0.5});s.wait(1);
    });`}]});expect(result.ok).toBe(true);
    renderer.render(sequence.frame(0,0),sequence.compiled[0].options);const image=await pixels();await artifact('translucent-depth',image);
    for(const x of [width/2-40,width/2+40]){const at=(height/2*width+x)*4;expect(image[at]).toBeGreaterThan(40);expect(image[at+2]).toBeGreaterThan(40);}
    expect(errors).toEqual([]);
  });
  it('lights both mesh windings identically and interpolates smooth vertex normals',async()=> {
    renderer.resetInteraction();
    const result=await sequence.submit({type:'load',scenes:[{id:'mesh-lighting',source:`export default scene({background:'BLACK'},s=>{
      s.mesh('surface',{vertices:[[-2,-2,0],[2,-2,0],[0,2,0]],triangles:[[0,1,2]],shading:'flat',fill:'WHITE',stroke:'none'});s.wait(1);
    });`}]});expect(result.ok).toBe(true);
    const frame=sequence.frame(0,0),mesh=frame.elements.find(element=>element.id.endsWith('surface'))!;
    const at=(image:Uint8Array,x=width/2,y=height/2)=>image[(y*width+x)*4];
    renderer.render(frame,sequence.compiled[0].options);const front=await pixels();
    const expected=Math.round(255*(0.32+0.68/Math.hypot(-0.4,0.65,1)));
    expect(Math.abs(at(front)-expected)).toBeLessThanOrEqual(1);
    mesh.geometry.triangles=[[2,1,0]];
    renderer.render(frame,sequence.compiled[0].options);const back=await pixels();
    expect(at(back)).toBe(at(front));
    mesh.geometry.shading='unlit';
    renderer.render(frame,sequence.compiled[0].options);expect(at(await pixels())).toBe(255);
    mesh.geometry.triangles=[[0,1,2]];mesh.geometry.shading='smooth';
    mesh.geometry.normals=[[-1,0,1],[1,0,1],[0,0,1]];
    renderer.render(frame,sequence.compiled[0].options);const smooth=await pixels();
    expect(at(smooth,width/2-40)-at(smooth,width/2+40)).toBeGreaterThan(8);
    await artifact('mesh-smooth-lighting',smooth);expect(errors).toEqual([]);
  });
  it('slides a grouped 3D element outside an ultrawide viewport under retained orbit',async()=> {
    const result=await sequence.submit({type:'load',scenes:[{id:'exit',source:String.raw`export default scene({mode:"3d",orbit:true,background:"BLACK"},s=>{
      const sphere=s.sphere("sphere",{radius:0.42,fill:"PURE_BLUE",stroke:"none"});const group=s.group("exit",[sphere]);
      s.play(group.animate({viewportOffset:[-1.5,0]}),{duration:1});
    });`}]});expect(result.ok).toBe(true);
    Object.assign(canvas,{getBoundingClientRect:()=>({width:1920,height:540})});
    (renderer as unknown as {resize():void}).resize();renderer.setOrbit({yaw:Math.PI/2,pitch:0});
    try {
      renderer.render(sequence.frame(0,0),sequence.compiled[0].options);expect(changedPixels(await pixels())).toBeGreaterThan(1000);
      renderer.render(sequence.frame(0,1),sequence.compiled[0].options);const image=await pixels();await artifact('ultrawide-orbit-exit',image);
      expect(changedPixels(image)).toBe(0);expect(errors).toEqual([]);
    } finally {renderer.setOrbit({yaw:0,pitch:0});Object.assign(canvas,{getBoundingClientRect:()=>({width,height})});(renderer as unknown as {resize():void}).resize();}
  });
  it('keeps round 3D shafts and cone arrowheads visible from perpendicular sides and end-on',async()=> {
    const result=await sequence.submit({type:'load',scenes:[{id:'round-lines',source:`export default scene({mode:"3d",orbit:false},s=>{
      s.line3D("line",{points:[[-2,-0.7,0],[2,-0.7,0]],strokeWidth:0.15,stroke:"BLUE"});
      s.arrow3D("arrow",{points:[[-2,0.7,0],[2,0.7,0]],strokeWidth:0.08,stroke:"RED"});
      s.wait(1);
    });`}]});
    expect(result.ok).toBe(true);
    const base=sequence.frame(0,0),counts:number[]=[];
    for(const [name,yaw,pitch] of [['front',0,0],['edge',0,Math.PI/2],['end',Math.PI/2,0]] as const){
      renderer.render({...base,camera:{...base.camera,yaw,pitch,perspective:0}},sequence.compiled[0].options);
      const image=await pixels();counts.push(changedPixels(image));await artifact('round-lines-'+name,image);
    }
    expect(counts[0]).toBeGreaterThan(1000);expect(counts[1]).toBeGreaterThan(1000);expect(counts[2]).toBeGreaterThan(80);
    expect(errors).toEqual([]);
  });
  it('renders the interactive demo with round axes and bonds',async()=> {
    expect((await sequence.submit({type:'load',scenes:[interactionSource]})).ok).toBe(true);
    Object.assign(canvas,{getBoundingClientRect:()=>({width:1280,height:800})});
    (renderer as unknown as {resize():void}).resize();
    renderer.resetInteraction();
    try {
      renderer.render(sequence.frame(0,0),sequence.compiled[0].options);
      const image=await pixels();expect(changedPixels(image)).toBeGreaterThan(10000);
      await artifact('interactive-demo',image);expect(errors).toEqual([]);
    } finally {Object.assign(canvas,{getBoundingClientRect:()=>({width,height})});(renderer as unknown as {resize():void}).resize();}
  });
  it('renders full-size Latin glyph contours cleanly at device pixel ratio two',async()=> {
    vi.stubGlobal('devicePixelRatio',2);
    const result=await sequence.submit({type:'load',scenes:[{id:'text',source:String.raw`export default scene({background:"BLACK"},s=>{
      s.text("word",{text:"ascending",fontSize:1.25,fill:"WHITE",stroke:"none"});s.wait(1);
    });`}]});expect(result.ok).toBe(true);
    // Simulate the native observer after a browser moves the canvas to a high-DPR display.
    (renderer as unknown as {resize():void}).resize();
    renderer.render(sequence.frame(0,0),sequence.compiled[0].options);const image=await pixels();await artifact('ascending-dpr2',image);
    expect(texture!.width).toBe(width*2);expect(texture!.height).toBe(height*2);
    expect(changedPixels(image)).toBeGreaterThan(10000);expect(errors).toEqual([]);
  });

  it('keeps identical text, rectangles, paths and round arrows pixel-identical throughout a morph',async()=> {
    // Also exercise opacity and a non-black background: drawing identical
    // geometry twice can otherwise hide a compositing regression.
    const cases=[
      {kind:'text',text:'A',fontSize:2},
      {kind:'rectangle',width:3,height:2},
      {kind:'path',points:[[-2,-1],[1.3,-0.7],[2,1.5],[-0.4,2],[-1.7,0.4]],closed:true},
      {kind:'path',points:Array.from({length:128},(_,i)=>{const a=i*Math.PI/64,r=1.5+0.2*Math.sin(5*a);return [r*Math.cos(a),r*Math.sin(a)];}),closed:true},
      {kind:'arrow',points:[[-2,-1,0],[2,1,0]]},
    ];
    vi.stubGlobal('devicePixelRatio',1);(renderer as unknown as {resize():void}).resize();
    for(const geometry of cases)for(const opacity of [1,0.45]) {
      const method=geometry.kind==='arrow'?'arrow3D':geometry.kind;
      const props={...geometry,opacity,fill:geometry.kind==='arrow'?Color.NONE:Color.RED,stroke:geometry.kind==='arrow'?Color.RED:Color.NONE,strokeWidth:0.12};
      const result=await sequence.submit({type:'load',scenes:[{id:'identity',source:`export default scene({background:'GREY_E'},s=>{
        const shape=s.${method}('shape',${JSON.stringify(props)});
        s.wait(1);s.play(shape.morphTo(${JSON.stringify(geometry)}),{duration:2,ease:'linear'});s.wait(1);
      });`}]});expect(result.ok).toBe(true);
      const draw=async(time:number)=>{renderer.render(sequence.frame(0,time),sequence.compiled[0].options);return pixels();};
      const before=Buffer.from(await draw(0));
      for(const time of [1,1.000001,1.5,2,2.999999,3,2]) {
        expect(Buffer.from(await draw(time)).equals(before),`${method}, opacity ${opacity}, time ${time}`).toBe(true);
      }
    }
    expect(errors).toEqual([]);
  });

  it('interpolates the font size of unchanged text without fading it',async()=> {
    const result=await sequence.submit({type:'load',scenes:[{id:'text-size',source:`export default scene({background:'GREY_E'},s=>{
      const label=s.text('label',{text:'A',fontSize:1,fill:'WHITE',opacity:0.65});
      s.play(label.morphTo({kind:'text',text:'A',fontSize:3}),{duration:2,ease:'linear'});s.wait(1);
    });`}]});expect(result.ok).toBe(true);
    const scene=sequence.compiled[0],frame=sequence.frame(0,1);
    renderer.render(frame,scene.options);const actual=Buffer.from(await pixels());
    const expected={...frame,elements:frame.elements.map(e=>({...e,morph:undefined,geometry:{kind:'text' as const,text:'A',fontSize:2}}))};
    renderer.render(expected,scene.options);
    expect(Buffer.from(await pixels()).equals(actual)).toBe(true);expect(errors).toEqual([]);
  });

  // Last: this public player owns/disposes the native device supplied by the harness.
  it('public Player recovers from an oversized frame and can play a smaller scene',async()=>{
    Object.assign(canvas,{getAttribute:()=>null,setAttribute:()=>{},removeAttribute:()=>{}});
    const callbacks=new Map<number,FrameRequestCallback>();let id=0;
    vi.stubGlobal('requestAnimationFrame',(callback:FrameRequestCallback)=>{callbacks.set(++id,callback);return id;});
    vi.stubGlobal('cancelAnimationFrame',(id:number)=>callbacks.delete(id));
    const player=createPlayer({canvas,executionLimitMs:1000});
    const source=`export default scene({mode:'3d',lighting:{directional:{direction:[0,1,0],space:'world',shadow:{quality:'high'}},receiver:{size:[8,8]}}},s=>{
      for(let i=0;i<3;i++)s.parametricSurface('surface'+i,{uSegments:100,vSegments:100,fn:(u,v)=>[u,1+i*.1,v]});s.wait(1);
    });`;
    try{
      expect((await player.submit({type:'load',scenes:[{id:'large',source}]})).ok).toBe(true);
      expect(player.getState()).toMatchObject({status:'blocked',error:expect.stringContaining('exceeding WebGPU maxBufferSize')});
      await expect(player.play()).rejects.toBeInstanceOf(VertexBufferLimitError);
      expect((await player.submit({type:'load',scenes:[{id:'small',source:"export default scene({},s=>{s.rectangle('r',{width:3,height:2,fill:'PURE_RED'});s.wait(1)});"}]})).ok).toBe(true);
      expect(player.getState()).toMatchObject({scene:'small',status:'paused'});
      expect(player.getState().error).toBeUndefined();
      const image=await pixels();expect(Array.from(image.slice((240*640+320)*4,(240*640+320)*4+4))).toEqual([255,0,0,255]);
      await player.play();expect(player.getState().status).toBe('playing');expect(callbacks.size).toBe(1);
      const time=performance.now(),clock=vi.spyOn(performance,'now').mockReturnValue(time+250);
      try{
        const [key,callback]=callbacks.entries().next().value!;callbacks.delete(key);callback(time+250);
        expect(player.getState().time).toBeGreaterThanOrEqual(0.25);
        expect(player.getState().status).toBe('playing');expect(callbacks.size).toBe(1);
      }finally{clock.mockRestore();}
      player.pause();expect(player.getState().status).toBe('paused');
      expect(errors).toEqual([]);
    }finally{player.dispose();}
  });

});

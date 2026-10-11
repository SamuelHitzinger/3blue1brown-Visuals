/** Isolated Node worker: real production renderer, native WebGPU readback, no browser UI. */
import { create, globals } from 'webgpu';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';
import { CanvasRenderer } from '../dist/renderer.js';
import { withOfflineScene, SceneCompileError } from '../dist/core.js';
import { loadAssetRegistry } from './load-assets.mjs';
import { createOfflineModelStore } from './load-models.mjs';
import { dirname, resolve } from 'node:path';

function png(width, height, rgba) {
  const crc = data => { let c=0xffffffff; for(const b of data){c^=b;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0; };
  const chunk = (name, data) => { const type=Buffer.from(name),n=Buffer.alloc(4),c=Buffer.alloc(4);n.writeUInt32BE(data.length);c.writeUInt32BE(crc(Buffer.concat([type,data])));return Buffer.concat([n,type,data,c]); };
  const header=Buffer.alloc(13);header.writeUInt32BE(width);header.writeUInt32BE(height,4);header[8]=8;header[9]=6;
  const rows=Buffer.alloc(height*(width*4+1));for(let y=0;y<height;y++)rows.set(rgba.subarray(y*width*4,(y+1)*width*4),y*(width*4+1)+1);
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(rows)),chunk('IEND',Buffer.alloc(0))]);
}
async function readPixels(device, texture, format) {
  const {width,height}=texture, bytesPerRow=Math.ceil(width*4/256)*256;
  const buffer=device.createBuffer({size:bytesPerRow*height,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
  try {
    const encoder=device.createCommandEncoder();encoder.copyTextureToBuffer({texture},{buffer,bytesPerRow,rowsPerImage:height},[width,height]);device.queue.submit([encoder.finish()]);
    await buffer.mapAsync(GPUMapMode.READ);
    const pixels=new Uint8Array(width*height*4),mapped=new Uint8Array(buffer.getMappedRange());
    for(let y=0;y<height;y++)pixels.set(mapped.subarray(y*bytesPerRow,y*bytesPerRow+width*4),y*width*4);
    if(format==='bgra8unorm')for(let i=0;i<pixels.length;i+=4)[pixels[i],pixels[i+2]]=[pixels[i+2],pixels[i]];
    buffer.unmap();return pixels;
  } finally {buffer.destroy();}
}

async function main() {
  const input=JSON.parse(await readFile(process.argv[2],'utf8'));
  if(!Array.isArray(input.times)||!input.times.length||input.times.length>16)throw new Error('Expected 1–16 sample times.');
  const modelAssets=input.modelAssets?await loadAssetRegistry(input.modelAssets.map(path=>resolve(dirname(process.argv[2]),path)),{colorPolicy:input.colorPolicy}):undefined;
  const models=createOfflineModelStore(input.models);
  try {
  await withOfflineScene(input.source,{previous:input.previousFrame,palette:input.palette,models:models.metadata},async sampler=>{
    const compiled=sampler.scene;
    await models.prepare([compiled]);
    if(!input.times.every(t=>Number.isFinite(t)&&t>=0&&t<=compiled.duration))throw new Error('Invalid sample time.');
    Object.assign(globalThis,globals);
    globalThis.ResizeObserver=class {observe(){}disconnect(){}};
    globalThis.devicePixelRatio=1;
    const gpu=create([]);
    const manifest={backend:'native-webgpu',frames:[],sheets:[]};
    await mkdir(input.directory,{recursive:true});
    for(const [width,height] of [[1280,720],[960,720]]) {
      const adapter=await gpu.requestAdapter();
      if(!adapter)throw new Error('Automatic visual review requires a native WebGPU adapter.');
      const device=await adapter.requestDevice(),format=gpu.getPreferredCanvasFormat();
      const texture=device.createTexture({size:[width,height],format,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC});
      const errors=[];
      Object.defineProperty(globalThis,'navigator',{configurable:true,value:{gpu:{requestAdapter:async()=>({requestDevice:async()=>device}),getPreferredCanvasFormat:()=>format}}});
      const context={configure(){},unconfigure(){},getCurrentTexture:()=>texture};
      const canvas={width,height,style:{},getBoundingClientRect:()=>({width,height}),getContext:kind=>kind==='webgpu'?context:null,addEventListener(){},removeEventListener(){}};
      const renderer=new CanvasRenderer(canvas,undefined,sampler.assetGeometry,models);renderer.onError=e=>errors.push(e.message);
      try {
        await renderer.prepare([compiled],sampler.assetGeometry);
        const cellW=640,cellH=Math.round(height*cellW/width),sheetW=cellW*2;
        for(let start=0;start<input.times.length;start+=6) {
          const times=input.times.slice(start,start+6),sheetH=cellH*Math.ceil(times.length/2),sheet=new Uint8Array(sheetW*sheetH*4);
          for(let i=3;i<sheet.length;i+=4)sheet[i]=255;
          for(const [index,time] of times.entries()) {
            renderer.render(sampler.sample(time),compiled.options);
            const pixels=await readPixels(device,texture,format);
            if(errors.length)throw new Error(errors.join('\n'));
            const path=join(input.directory,`${width}x${height}-${start+index}.png`);
            await writeFile(path,png(width,height,pixels));manifest.frames.push({time,width,height,path});
            // Area-average downsample for review sheets; individual PNGs retain native resolution.
            for(let y=0;y<cellH;y++)for(let x=0;x<cellW;x++) {
              const dest=((Math.floor(index/2)*cellH+y)*sheetW+(index%2)*cellW+x)*4;
              const x0=Math.floor(x*width/cellW),x1=Math.floor((x+1)*width/cellW),y0=Math.floor(y*height/cellH),y1=Math.floor((y+1)*height/cellH);
              for(let c=0;c<4;c++){let sum=0,n=0;for(let sy=y0;sy<y1;sy++)for(let sx=x0;sx<x1;sx++){sum+=pixels[(sy*width+sx)*4+c];n++;}sheet[dest+c]=Math.round(sum/n);}
            }
          }
          const path=join(input.directory,`${width}x${height}-sheet-${start/6}.png`);
          await writeFile(path,png(sheetW,sheetH,sheet));manifest.sheets.push({path,width,height,times,columns:2});
        }
      } finally {texture.destroy();renderer.dispose();device.destroy();}
    }
    await writeFile(join(input.directory,'frames.json'),JSON.stringify(manifest,null,2));
    process.stdout.write(JSON.stringify(manifest));
  },{modelAssets});
  } finally { models.dispose(); }
}
main().then(()=>process.exit(0),error=>{console.error(JSON.stringify({code:error instanceof SceneCompileError?'SCENE_COMPILE':'RENDER',message:error instanceof Error?error.message:String(error)}));process.exit(1);});

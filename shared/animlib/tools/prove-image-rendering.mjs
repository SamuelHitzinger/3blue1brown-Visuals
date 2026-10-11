/** Actual native WebGPU upload/draw measurements; no reference renderer or pixel stubs. */
import {create,globals} from 'webgpu';
import {writeFile,mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadAssetRegistry} from './load-assets.mjs';
import {withOfflineScene} from '../dist/core.js';
import {CanvasRenderer} from '../dist/renderer.js';
import {VERTEX_FLOATS} from '../dist/render-geometry.js';
const base=fileURLToPath(new URL('../fixtures/suzanne/textured/',import.meta.url));
const output=resolve(process.argv[2]??'../../data/animlib-expansion/image-proof');
const registry=await loadAssetRegistry([join(base,'suzanne-textured-image-0.json'),join(base,'suzanne-textured.json')],{colorPolicy:'source'});
Object.assign(globalThis,globals);globalThis.ResizeObserver=class{observe(){}disconnect(){}};globalThis.devicePixelRatio=1;
const gpu=create([]),adapter=await gpu.requestAdapter();if(!adapter)throw new Error('Native adapter required');
const device=await adapter.requestDevice(),format=gpu.getPreferredCanvasFormat(),errors=[];
device.addEventListener('uncapturederror',e=>errors.push(e.error.message));
let current={};const samples=[];
const writeTexture=device.queue.writeTexture.bind(device.queue);device.queue.writeTexture=(...args)=>{current.textureUploads=(current.textureUploads??0)+1;current.textureBytes=(current.textureBytes??0)+args[1].byteLength;return writeTexture(...args);};
const writeBuffer=device.queue.writeBuffer.bind(device.queue);device.queue.writeBuffer=(...args)=>{current.bufferBytes=(current.bufferBytes??0)+(args[2].byteLength??args[2].length);return writeBuffer(...args);};
const createEncoder=device.createCommandEncoder.bind(device);device.createCommandEncoder=(...args)=>{const encoder=createEncoder(...args),begin=encoder.beginRenderPass.bind(encoder);encoder.beginRenderPass=(...args)=>{const pass=begin(...args);for(const method of ['draw','drawIndexed']){const draw=pass[method].bind(pass);pass[method]=(...args)=>{current.draws=(current.draws??0)+1;current.instances=(current.instances??0)+(args[1]??1);return draw(...args);};}return pass;};return encoder;};
const target=device.createTexture({size:[640,480],format,usage:GPUTextureUsage.RENDER_ATTACHMENT});
Object.defineProperty(globalThis,'navigator',{configurable:true,value:{gpu:{requestAdapter:async()=>({requestDevice:async()=>device}),getPreferredCanvasFormat:()=>format}}});
const context={configure(){},unconfigure(){},getCurrentTexture:()=>target},canvas={width:640,height:480,style:{},getBoundingClientRect:()=>({width:640,height:480}),getContext:()=>context,addEventListener(){},removeEventListener(){}};
const renderer=new CanvasRenderer(canvas);renderer.onError=e=>errors.push(e.message);
const source=`export default scene({mode:'3d'},s=>{for(let i=0;i<8;i++){const m=s.model('m'+i,{asset:'suzanne-textured',shading:'unlit',position:[(i%4-1.5)*3,i<4?1.5:-1.5,0]});s.bind(m,[s.time],t=>({rotation:[0,t*.4,0]}));}s.play(s.camera.animate({height:9,yaw:0,pitch:0}),{duration:0});s.wait(2);});`;
let payload;
try{await withOfflineScene(source,{},async sampler=>{
  await renderer.prepare([sampler.scene],sampler.assetGeometry);
  payload={source:Buffer.byteLength(source),catalog:Buffer.byteLength(JSON.stringify(registry.catalog)),compiled:Buffer.byteLength(JSON.stringify(sampler.scene)),frame:Buffer.byteLength(JSON.stringify(sampler.sample(0)))};
  for(const time of [0,1,2]){current={time,textureUploads:0,textureBytes:0,bufferBytes:0,draws:0,instances:0};const start=performance.now();renderer.render(sampler.sample(time),sampler.scene.options);await device.queue.onSubmittedWorkDone();current.cpuAndQueueWallMs=performance.now()-start;samples.push(current);}
},{modelAssets:registry});if(errors.length)throw new Error(errors.join('\n'));}
finally{renderer.dispose();target.destroy();device.destroy();}
const result={backend:'native-webgpu',instances:8,logicalVertices:94464,packedFloatsPerVertex:VERTEX_FLOATS,payload,samples,afterDisposal:registry.stats(),timingNote:'CPU evaluation/submission plus queue-completion wall time, not GPU timestamp-query timing.'};
await mkdir(output,{recursive:true});await writeFile(join(output,'native-upload-measurements.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));

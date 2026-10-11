import {readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {create,globals} from 'webgpu';
import {CanvasRenderer} from '../dist/renderer.js';
import {withOfflineScene} from '../dist/core.js';
const directory=resolve('data/animlib-expansion/depth-focus-proof'),source=await readFile(join(directory,'focus.js'),'utf8');
Object.assign(globalThis,globals);globalThis.ResizeObserver=class{observe(){}disconnect(){}};globalThis.devicePixelRatio=1;
const gpu=create([]),adapter=await gpu.requestAdapter(),device=await adapter.requestDevice(),format=gpu.getPreferredCanvasFormat(),errors=[];
device.addEventListener('uncapturederror',e=>errors.push(e.error.message));
let stats={};const write=device.queue.writeBuffer.bind(device.queue);device.queue.writeBuffer=(...a)=>{stats.uploadBytes=(stats.uploadBytes??0)+a[2].byteLength;return write(...a);};
const createEncoder=device.createCommandEncoder.bind(device);device.createCommandEncoder=(...a)=>{const e=createEncoder(...a),begin=e.beginRenderPass.bind(e);e.beginRenderPass=(...a)=>{stats.passes=(stats.passes??0)+1;const p=begin(...a);for(const key of ['draw','drawIndexed']){const draw=p[key].bind(p);p[key]=(...a)=>{stats.draws=(stats.draws??0)+1;stats.vertices=(stats.vertices??0)+a[0]*(a[1]??1);return draw(...a);};}return p;};return e;};
const target=device.createTexture({size:[1280,720],format,usage:GPUTextureUsage.RENDER_ATTACHMENT});
Object.defineProperty(globalThis,'navigator',{configurable:true,value:{gpu:{requestAdapter:async()=>({requestDevice:async()=>device}),getPreferredCanvasFormat:()=>format}}});
const canvas={width:1280,height:720,style:{},getBoundingClientRect:()=>({width:1280,height:720}),getContext:()=>({configure(){},unconfigure(){},getCurrentTexture:()=>target}),addEventListener(){},removeEventListener(){}};
const renderer=new CanvasRenderer(canvas);renderer.onError=e=>errors.push(e.message);const results=[];
try{await withOfflineScene(source,{},async sampler=>{await renderer.prepare([sampler.scene]);for(const quality of [0,8,16,32]){const frames=[];for(let i=0;i<8;i++){const frame=sampler.sample(4);frame.camera.focus=quality?{distance:24,aperture:.35,samples:quality}:undefined;stats={};const t=performance.now();renderer.render(frame,sampler.scene.options);await device.queue.onSubmittedWorkDone();frames.push({...stats,wallMs:performance.now()-t});}const warm=frames.slice(1).map(f=>f.wallMs).sort((a,b)=>a-b);results.push({quality,cold:frames[0],warmMedianMs:warm[3],warmMinMs:warm[0],warmMaxMs:warm.at(-1),warmLast:frames.at(-1)});}});if(errors.length)throw new Error(errors.join('\n'));}
finally{renderer.dispose();target.destroy();device.destroy();}
const result={resolution:[1280,720],adapter:{vendor:adapter.info.vendor,architecture:adapter.info.architecture,description:adapter.info.description},surfaceBytes:1280*720*44,results,note:'Actual native WebGPU, seven warm samples per quality. Scene sampling excluded; CPU render plus GPU queue completion measured, not timestamp queries. Draw/vertex counts include fullscreen focus passes and HUD.'};await writeFile(join(directory,'profile.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));

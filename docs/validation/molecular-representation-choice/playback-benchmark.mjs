import {readFile,writeFile} from 'node:fs/promises';
import {Session} from 'node:inspector';
import {promisify} from 'node:util';
import {CanvasRenderer} from '../../../shared/animlib/dist/renderer.js';
import {withOfflineScene} from '../../../shared/animlib/dist/core.js';
import {createOfflineModelStore} from '../../../shared/animlib/tools/load-models.mjs';
const name=process.argv[2]??'baseline';
const input=JSON.parse(await readFile('data/molecular-representation-choice/proof/final-complex-focus/0/render-input.json','utf8'));
globalThis.ResizeObserver=class {observe(){}disconnect(){}};globalThis.devicePixelRatio=1;
globalThis.GPUBufferUsage={UNIFORM:1,COPY_DST:2,VERTEX:4,INDEX:8};globalThis.GPUTextureUsage={RENDER_ATTACHMENT:1};
let bytes=0,draws=0;
const device={limits:{maxTextureDimension2D:8192,maxBufferSize:1e9},lost:new Promise(()=>{}),addEventListener(){},destroy(){},createShaderModule:()=>({getCompilationInfo:async()=>({messages:[]})}),createRenderPipelineAsync:async()=>({getBindGroupLayout:()=>({})}),createBuffer:()=>({destroy(){}}),createBindGroup:()=>({}),createSampler:()=>({}),createTexture:({size})=>({width:size[0],height:size[1],createView:()=>({}),destroy(){}}),queue:{writeTexture(){},writeBuffer(_b,_o,d){bytes+=d.byteLength;},submit(){}},createCommandEncoder:()=>({beginRenderPass:()=>({setPipeline(){},setBindGroup(){},setVertexBuffer(){},setIndexBuffer(){},setViewport(){},setScissorRect(){},draw(){draws++;},drawIndexed(){draws++;},end(){}}),finish:()=>({})})};
Object.defineProperty(globalThis,'navigator',{configurable:true,value:{gpu:{requestAdapter:async()=>({requestDevice:async()=>device}),getPreferredCanvasFormat:()=> 'bgra8unorm'}}});
const canvas={width:1280,height:720,style:{},getBoundingClientRect:()=>({width:1280,height:720}),getContext:()=>({configure(){},unconfigure(){},getCurrentTexture:()=>({createView:()=>({})})}),addEventListener(){},removeEventListener(){}};
const models=createOfflineModelStore(input.models),profile=new Session();profile.connect();const post=promisify(profile.post.bind(profile));await post('Profiler.enable');
const results=[];
try{await withOfflineScene(input.source,{previous:input.previousFrame,models:models.metadata},async sampler=>{
await models.prepare([sampler.scene]);const renderer=new CanvasRenderer(canvas,undefined,sampler.assetGeometry,models);renderer.onError=e=>{throw e};await renderer.prepare([sampler.scene]);
try{for(const [caseName,start,step] of [['hold',15,0.016],['reveal',22.7,0.05]]){
 const samples=[];for(let i=0;i<15;i++){const frame=sampler.sample(start+i*step);if(i===3)await post('Profiler.start');bytes=0;draws=0;const t=performance.now();renderer.render(frame,sampler.scene.options);const ms=performance.now()-t;if(i>=3)samples.push({ms,bytes,draws});}
 const {profile:cpu}=await post('Profiler.stop');await writeFile('data/molecular-representation-choice/'+name+'-'+caseName+'.cpuprofile',JSON.stringify(cpu));
 const times=samples.map(s=>s.ms).sort((a,b)=>a-b);results.push({case:caseName,medianMs:times[6],p95Ms:times[11],meanUploadBytes:samples.reduce((a,s)=>a+s.bytes,0)/samples.length,meanDraws:samples.reduce((a,s)=>a+s.draws,0)/samples.length,samples});
}}finally{renderer.dispose();}
});}finally{models.dispose();profile.disconnect();}
await writeFile('data/molecular-representation-choice/'+name+'-performance.json',JSON.stringify({scope:'Production renderer CPU preparation, GPU/DOM mocked; same generated complex source, no FPS claim',results},null,2));console.log(JSON.stringify(results.map(({samples,...r})=>r)));

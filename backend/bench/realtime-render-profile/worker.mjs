/** Isolated real WebGPU profiler. No browser automation, model calls or network. */
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {Session} from 'node:inspector';
import {promisify} from 'node:util';
const start=performance.now(),input=JSON.parse(await readFile(process.argv[2],'utf8'));
const base=new URL('../../../',import.meta.url),moduleStart=performance.now();
const [{create,globals},{CanvasRenderer},{createSceneProgram},{evaluateScene},{mergeReactiveUpdates},{buildDrawItems},{RetainedGeometry},{composeItems},{paletteResolver},{createOfflineModelStore}]=await Promise.all([
  import('webgpu'),import(new URL('shared/animlib/dist/renderer.js',base)),import(new URL('shared/animlib/dist/compiler.js',base)),
  import(new URL('shared/animlib/dist/timeline.js',base)),import(new URL('shared/animlib/dist/reactive.js',base)),
  import(new URL('shared/animlib/dist/render-geometry.js',base)),import(new URL('shared/animlib/dist/retained-geometry.js',base)),
  import(new URL('shared/animlib/dist/composition.js',base)),import(new URL('shared/animlib/dist/palette.js',base)),
  import(new URL('shared/animlib/tools/load-models.mjs',base)),
]);
const moduleLoadMs=performance.now()-moduleStart;
const hash=value=>createHash('sha256').update(value).digest('hex');
const stats=values=>{const s=[...values].sort((a,b)=>a-b);return {n:s.length,minMs:s[0],medianMs:s[Math.floor(s.length/2)],p95Ms:s[Math.ceil(s.length*.95)-1],maxMs:s.at(-1),samplesMs:values};};
const measure=async work=>{const begin=performance.now(),value=await work();return {ms:performance.now()-begin,value};};
const models=createOfflineModelStore(input.models),compileInput={models:models.metadata};
let program,renderer,device,texture,profiler;
const result={schemaVersion:1,status:'started',id:input.id,sourceSha256:hash(input.source),node:process.version,moduleLoadMs,
  scope:'Native WebGPU offscreen submission, not display presentation. GPU completion fence and readback are wall time, not isolated GPU execution duration.'};
try{
  const cold=await measure(()=>createSceneProgram(input.source,compileInput));program=cold.value;result.coldCompileMs=cold.ms;
  const warm=[];for(let i=0;i<3;i++){const t=await measure(()=>createSceneProgram(input.source,compileInput));warm.push(t.ms);t.value.dispose();}result.warmCompile=stats(warm);
  const scene=program.scene;result.compiledBytes=Buffer.byteLength(JSON.stringify(scene));result.modelPrepareMs=(await measure(()=>models.prepare([scene]))).ms;
  const values=Object.fromEntries(scene.controls.map(control=>[control.id,control.value]));
  const sample=(time)=>{let current=scene;if(scene.reactiveBindings?.some(b=>b.time)){const updates=program.update(values,[],time);current={...scene,reactiveBindings:mergeReactiveUpdates(scene,updates,[],time),reactiveTime:time};}return evaluateScene(current,time);};
  Object.assign(globalThis,globals);globalThis.ResizeObserver=class {observe(){}disconnect(){}};globalThis.devicePixelRatio=1;
  const gpu=create([]),adapterRun=await measure(()=>gpu.requestAdapter());if(!adapterRun.value)throw Error('No native WebGPU adapter');
  result.adapterMs=adapterRun.ms;const deviceRun=await measure(()=>adapterRun.value.requestDevice());device=deviceRun.value;result.deviceMs=deviceRun.ms;
  result.adapterInfo=adapterRun.value.info;result.timestampQuerySupported=adapterRun.value.features.has('timestamp-query');
  const width=1280,height=720,format=gpu.getPreferredCanvasFormat();
  texture=device.createTexture({size:[width,height],format,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC});
  let counters;const reset=()=>counters={writeBufferCalls:0,writeBufferBytes:0,writeBufferMs:0,submitCalls:0,submitMs:0,drawCalls:0,createBufferBytes:0};reset();
  const queue=new Proxy(device.queue,{get(target,key){
    if(key==='writeBuffer')return (...args)=>{const t=performance.now();target.writeBuffer(...args);counters.writeBufferMs+=performance.now()-t;counters.writeBufferCalls++;counters.writeBufferBytes+=args[2].byteLength;};
    if(key==='submit')return (...args)=>{const t=performance.now();target.submit(...args);counters.submitMs+=performance.now()-t;counters.submitCalls++;};
    const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;
  }});
  const wrappedDevice=new Proxy(device,{get(target,key){
    if(key==='queue')return queue;
    if(key==='createBuffer')return spec=>{counters.createBufferBytes+=spec.size;return target.createBuffer(spec);};
    if(key==='createCommandEncoder')return (...args)=>{
      const encoder=target.createCommandEncoder(...args);
      return new Proxy(encoder,{get(target,key){if(key==='beginRenderPass')return (...args)=>{
        const pass=target.beginRenderPass(...args);return new Proxy(pass,{get(target,key){const value=Reflect.get(target,key,target);if(key==='draw'||key==='drawIndexed')return (...args)=>{counters.drawCalls++;return value.apply(target,args);};return typeof value==='function'?value.bind(target):value;}});
      };const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;}});
    }
    const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;
  }});
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{gpu:{requestAdapter:async()=>({requestDevice:async()=>wrappedDevice}),getPreferredCanvasFormat:()=>format}}});
  const canvas={width,height,style:{},getBoundingClientRect:()=>({width,height}),getContext:kind=>kind==='webgpu'?{configure(){},unconfigure(){},getCurrentTexture:()=>texture}:null,addEventListener(){},removeEventListener(){}};
  renderer=new CanvasRenderer(canvas,undefined,undefined,models);const errors=[];renderer.onError=e=>errors.push(e.message);
  result.rendererPrepareMs=(await measure(()=>renderer.prepare([scene]))).ms;result.rendererBackend=renderer.backend;
  const renderRows=[],sampleTimes=[],renderTimes=[],fenceTimes=[],pixelHashes=[];
  async function readPixels(){const bytesPerRow=Math.ceil(width*4/256)*256,buffer=device.createBuffer({size:bytesPerRow*height,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
    try{const encoder=device.createCommandEncoder();encoder.copyTextureToBuffer({texture},{buffer,bytesPerRow,rowsPerImage:height},[width,height]);device.queue.submit([encoder.finish()]);await buffer.mapAsync(GPUMapMode.READ);const pixels=Buffer.from(buffer.getMappedRange()).subarray(0,bytesPerRow*height);const digest=hash(pixels);buffer.unmap();return digest;}finally{buffer.destroy();}}
  for(let i=0;i<input.samples+3;i++){
    const time=i/60;let t=performance.now();const frame=sample(time);const sampleMs=performance.now()-t;
    reset();t=performance.now();if(!renderer.render(frame,scene.options))throw Error('Native renderer did not submit frame');const renderMs=performance.now()-t;const calls={...counters};
    t=performance.now();await device.queue.onSubmittedWorkDone();const fenceMs=performance.now()-t;
    if(errors.length)throw Error(errors.join('; '));
    if(i===0){const readback=await measure(readPixels);result.firstFrame={sampleMs,renderMs,fenceMs,readbackMs:readback.ms,...calls};pixelHashes.push({time,sha256:readback.value});}
    if(i>=3){sampleTimes.push(sampleMs);renderTimes.push(renderMs);fenceTimes.push(fenceMs);renderRows.push({time,sampleMs,renderMs,fenceMs,...calls});}
  }
  result.sample=stats(sampleTimes);result.renderCPU=stats(renderTimes);result.queueCompletionWait=stats(fenceTimes);result.renderRows=renderRows;
  const lastReadback=await measure(readPixels);result.lastReadbackMs=lastReadback.ms;pixelHashes.push({time:(input.samples+2)/60,sha256:lastReadback.value});result.pixelHashes=pixelHashes;
  // Separate component pass: does not claim additivity with renderer.render's own cache.
  const retained=new RetainedGeometry(),geometryTimes=[],compositionTimes=[],geometryCounts=[];
  const palette=paletteResolver(scene.options.palette);const geometryHash=createHash('sha256');
  for(let i=0;i<input.samples+3;i++){
    const frame=models.resolve(sample(i/60));retained.beginFrame();let t=performance.now();const items=buildDrawItems(frame,frame.camera,width,height,palette,undefined,false,retained);const geometryMs=performance.now()-t;
    t=performance.now();const composed=composeItems(items,0);const compositionMs=performance.now()-t;retained.endFrame();
    if(i>=3){geometryTimes.push(geometryMs);compositionTimes.push(compositionMs);geometryCounts.push({items:items.length,commands:composed.commands.length,streamBytes:items.reduce((n,item)=>n+item.vertices.byteLength,0),retainedMeshes:items.filter(item=>item.mesh).length});}
    if(i===input.samples+2)for(const item of composed.items){geometryHash.update(JSON.stringify([item.depth,item.elementId,item.component,item.transparent]));geometryHash.update(Buffer.from(item.vertices.buffer,item.vertices.byteOffset,item.vertices.byteLength));if(item.mesh){geometryHash.update(Buffer.from(item.mesh.vertices.buffer));geometryHash.update(Buffer.from(item.mesh.indices.buffer));geometryHash.update(Buffer.from(item.instance.buffer));}}
  }
  result.geometryCPU=stats(geometryTimes);result.compositionCPU=stats(compositionTimes);result.geometryCounts=geometryCounts;result.geometrySha256=geometryHash.digest('hex');
  if(input.profile){profiler=new Session();profiler.connect();const post=promisify(profiler.post.bind(profiler));await post('Profiler.enable');await post('Profiler.start');
    for(let i=0;i<input.samples*3;i++){if(!renderer.render(sample(i/60),scene.options))throw Error('Native renderer did not submit frame');await device.queue.onSubmittedWorkDone();}
    const {profile}=await post('Profiler.stop');await writeFile(input.profile,JSON.stringify(profile),{flag:'wx'});result.cpuProfile=input.profile;
  }
  result.status='complete';
}catch(error){result.status='failed';result.error=error instanceof Error?error.message:String(error);}
finally{profiler?.disconnect();renderer?.dispose();texture?.destroy();device?.destroy();program?.dispose();models.dispose();}
result.workerMeasuredMs=performance.now()-start;
await writeFile(input.result,JSON.stringify(result,null,2),{flag:'wx'});console.log(JSON.stringify({id:input.id,status:result.status,result:input.result}));process.exit(result.status==='complete'?0:1);

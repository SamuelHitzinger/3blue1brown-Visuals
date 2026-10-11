/** Production motion profiling, run from the repository root after build and
 * demo/expansion/peptide-motion-proof.mjs. Diagnostic scenes intentionally return
 * only the pose center to distinguish computation from large retained updates.
 * They are timing probes, never proof media or alternate production paths. */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {cpus,platform,release} from 'node:os';
import {resolve,join} from 'node:path';
import {withOfflineScene} from '../dist/core.js';
import {createPeptideBuilders} from '../dist/peptide-motion.js';
import {createMolecularBackboneBuilders} from '../dist/molecular-backbone.js';
import {createMoleculeBuilders} from '../dist/molecules.js';
import {buildDrawItems} from '../dist/render-geometry.js';
import {RetainedGeometry} from '../dist/retained-geometry.js';
import {paletteResolver} from '../dist/palette.js';
import {composeItems} from '../dist/composition.js';
import {loadAssetRegistry} from './load-assets.mjs';

const output=resolve(process.argv[2]??'data/animlib-expansion/performance/motion');
const proof=resolve('data/animlib-expansion/biological-motion-proof');
const source=await readFile(join(proof,'peptide.js'),'utf8');
const manifest=JSON.parse(await readFile(join(proof,'peptide-manifest.json'),'utf8'));
const rig=JSON.parse(await readFile('shared/animlib/fixtures/biological/illustrative-peptide/rig.json','utf8'));
const registry=await loadAssetRegistry(manifest.modelAssets);
const quantiles=values=>{const s=[...values].sort((a,b)=>a-b);return{median:s[Math.ceil(s.length*.5)-1],p95:s[Math.ceil(s.length*.95)-1],samples:s.length};};
const smooth=(t,a,d)=>{const u=Math.max(0,Math.min(1,(t-a)/d));return u*u*(3-2*u);};
const times=Array.from({length:40},(_,i)=>.05+i*5.8/39);
const peptide=createPeptideBuilders(),backbone=createMolecularBackboneBuilders(createMoleculeBuilders());
const angles=t=>{const a={phi:[],psi:[]};for(let i=0;i<72;i++)for(const k of ['phi','psi'])a[k].push(rig.extended[k][i]+(rig.coil[k][i]-rig.extended[k][i])*smooth(t,.35+Math.floor(i/20)*.22,1.8)+(rig.compact[k][i]-rig.coil[k][i])*smooth(t,3.1,2.8));return a;};
const props=pose=>({segments:pose.atoms.map(a=>({id:a.id,chainId:'original',residues:[a]})),bonds:pose.bonds,representation:'sticks',radius:.18,radialSegments:8,origin:pose.center,initialNormal:[.321,.456,.789],colors:['PURE_BLUE','BLUE','TEAL','GREEN','YELLOW','ORANGE','RED'],provenance:{kind:'schematic',source:'Original idealized peptide with prescribed torsions',units:'angstrom'}});
const hostPose=[],hostMesh=[];
for(const t of [...times.slice(0,8),...times]){const a=angles(t),start=performance.now(),p=peptide.peptidePose(rig.spec,a.phi,a.psi),middle=performance.now();backbone.molecularBackbone(props(p));hostPose.push(middle-start);hostMesh.push(performance.now()-middle);}
const first=source.indexOf(' const first=sample(0)');assert(first>0);
const prefix=source.slice(0,first);
const geometryStart=prefix.indexOf(' const geometry=s.molecularBackboneGeometry('),returnStart=prefix.indexOf(' return cached={pose,geometry};');assert(geometryStart>0&&returnStart>geometryStart);
const suffix="const marker=s.circle('probe',{radius:.1});s.bind(marker,[s.time],t=>({position:sample(t).pose.center}));s.wait(8);});";
const probes=[['pose-only',prefix.slice(0,geometryStart)+' return cached={pose};};'+suffix],['pose-and-mesh-small-update',prefix+suffix],['complete-proof',source]];
const results=[];
for(const [name,text] of probes){
  const compile=[];await withOfflineScene(text,{},()=>{},{modelAssets:registry});
  for(let i=0;i<5;i++){const start=performance.now();await withOfflineScene(text,{},()=>compile.push(performance.now()-start),{modelAssets:registry});}
  results.push(await withOfflineScene(text,{},sampler=>{
    const cache=new RetainedGeometry(),evaluation=[],serialization=[],geometry=[];let maxFrameBytes=0;
    for(const t of [...times.slice(0,8),...times]){
      const start=performance.now(),frame=sampler.sample(t),middle=performance.now(),json=JSON.stringify(frame),serialized=performance.now();
      cache.beginFrame();buildDrawItems(frame,frame.camera,1280,720,paletteResolver(),undefined,false,cache,undefined,sampler.assetGeometry);cache.endFrame();
      evaluation.push(middle-start);serialization.push(serialized-middle);geometry.push(performance.now()-serialized);maxFrameBytes=Math.max(maxFrameBytes,Buffer.byteLength(json));
    }
    const seekTimes=[.6,1.8,3.3,4.7,5.9],baseline=seekTimes.map(t=>JSON.stringify(sampler.sample(t)));
    for(const i of [4,1,3,0,2])assert.equal(JSON.stringify(sampler.sample(seekTimes[i])),baseline[i]);
    return{name,sourceBytes:Buffer.byteLength(text),compiledBytes:Buffer.byteLength(JSON.stringify(sampler.scene)),maxFrameBytes,compileAndLeaseMs:quantiles(compile),evaluationMs:quantiles(evaluation.slice(8)),fullFrameSerializationMs:quantiles(serialization.slice(8)),warmDrawGeometryMs:quantiles(geometry.slice(8)),seekChecks:'exact full-frame JSON, forward/reverse/direct'};
  },{modelAssets:registry}));
}
const result={environment:{node:process.version,os:platform(),release:release(),cpu:cpus()[0].model},sourceSha256:createHash('sha256').update(source).digest('hex'),method:{warmup:8,samples:40,compileSamples:5,times,limits:'Unchanged default VM and geometry limits',note:'Evaluation includes QuickJS callback, VM JSON transfer/validation and host timeline. Full-frame serialization is measured separately. Small-update differential is diagnostic, not an exact additive decomposition. Sequential warm process; no GPU FPS claim.'},host:{poseMs:quantiles(hostPose.slice(8)),meshMs:quantiles(hostMesh.slice(8))},results,registryAfterSampling:registry.stats()};
result.packedParity=await withOfflineScene(source,{},sampler=>[...Array.from({length:33},(_,i)=>i/4),4.7,1.8].map(time=>{
  const frame=sampler.sample(time),hash=createHash('sha256');
  for(const item of composeItems(buildDrawItems(frame,frame.camera,1280,720,paletteResolver(),undefined,false,undefined,undefined,sampler.assetGeometry),0).items){hash.update(Buffer.from(item.vertices.buffer,item.vertices.byteOffset,item.vertices.byteLength));hash.update(JSON.stringify({depth:item.depth,transparent:item.transparent,screen:item.screen,groups:item.groups}));}
  return{time,sha256:hash.digest('hex')};
}),{modelAssets:registry});
const comparison=process.argv.find(a=>a.startsWith('--compare='));
if(comparison){const baseline=JSON.parse(await readFile(comparison.slice('--compare='.length),'utf8'));assert.equal(result.sourceSha256,baseline.sourceSha256);assert.deepEqual(result.packedParity,baseline.packedParity);result.comparison='Exact packed Float32 vertices/style/order/depth at all 35 forward/reverse samples';}
if(process.argv.includes('--gpu')){
  const {create,globals}=await import('webgpu');const {CanvasRenderer}=await import('../dist/renderer.js');
  Object.assign(globalThis,globals);globalThis.ResizeObserver=class{observe(){}disconnect(){}};globalThis.devicePixelRatio=1;
  const gpu=create([]),adapter=await gpu.requestAdapter();assert(adapter,'native WebGPU adapter required');const device=await adapter.requestDevice(),format=gpu.getPreferredCanvasFormat(),errors=[],samples=[];let current={};
  device.addEventListener('uncapturederror',e=>errors.push(e.error.message));
  const write=device.queue.writeBuffer.bind(device.queue);device.queue.writeBuffer=(...args)=>{current.bufferBytes=(current.bufferBytes??0)+(args[2].byteLength??args[2].length);return write(...args);};
  const createEncoder=device.createCommandEncoder.bind(device);device.createCommandEncoder=(...args)=>{const encoder=createEncoder(...args),begin=encoder.beginRenderPass.bind(encoder);encoder.beginRenderPass=(...args)=>{const pass=begin(...args);for(const method of ['draw','drawIndexed']){const draw=pass[method].bind(pass);pass[method]=(...args)=>{current.draws=(current.draws??0)+1;return draw(...args);};}return pass;};return encoder;};
  const target=device.createTexture({size:[1280,720],format,usage:GPUTextureUsage.RENDER_ATTACHMENT});
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{gpu:{requestAdapter:async()=>({requestDevice:async()=>device}),getPreferredCanvasFormat:()=>format}}});
  const context={configure(){},unconfigure(){},getCurrentTexture:()=>target},canvas={width:1280,height:720,style:{},getBoundingClientRect:()=>({width:1280,height:720}),getContext:()=>context,addEventListener(){},removeEventListener(){}};
  const renderer=new CanvasRenderer(canvas);renderer.onError=e=>errors.push(e.message);
  try{await withOfflineScene(source,{},async sampler=>{await renderer.prepare([sampler.scene],sampler.assetGeometry);for(const t of [1.8,3.3,4.7,5.9,3.3,1.8]){const frame=sampler.sample(t);current={time:t,bufferBytes:0,draws:0};const start=performance.now();renderer.render(frame,sampler.scene.options);await device.queue.onSubmittedWorkDone();samples.push({...current,renderAndQueueWallMs:performance.now()-start});}},{modelAssets:registry});assert.deepEqual(errors,[]);}finally{renderer.dispose();target.destroy();device.destroy();}
  result.native={adapter:{vendor:adapter.info.vendor,architecture:adapter.info.architecture,device:adapter.info.device,description:adapter.info.description},samples,note:'Actual native WebGPU at 1280x720. Sampling excluded; render CPU plus queue completion included, not timestamp-query timing. First frame cold; remaining frames warm dynamic geometry.'};
}
await mkdir(output,{recursive:true});await writeFile(join(output,'peptide-profile.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));

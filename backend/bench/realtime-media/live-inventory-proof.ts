/** Local integration probe. No model provider, retrieval service, microphone or network. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createCanvas,loadImage} from '@napi-rs/canvas';
import {ModelAssets,type ModelProvenance} from '../../src/model-assets.js';
import {renderSceneFrames,type FrameEvidence} from '../../src/agents/frame-renderer.js';
import {ModelStore} from '../../../shared/animlib/src/model-store.js';
import type {Frame} from '../../../shared/animlib/src/types.js';
import {createLocalAssetIndex} from './asset-index.js';
import {createLectureAssetSession} from './lecture-assets.js';
import {registerPublishedLectureAssets} from './lecture-asset-registration.js';
import {validateLectureModelInventory,reconcileLectureModelInventory} from './inventory-sync.js';
import {createAssetBackedWorld,registerAssetBackedModels} from './asset-world.js';

export interface LiveInventoryProofOptions {directory:string;modelPath:string;provenancePath?:string;render?:boolean}
const nativeSource=`export default scene({mode:'3d',end:'hold',orbit:false},s=>{
 const body=s.box('body',{position:[-3,1,0],width:.5,height:.5,depth:.5,fill:'YELLOW'});
 s.bind(body,[s.time],t=>({rotation:[0,t,0]}));
 const points=Array.from({length:41},(_,i)=>{const x=i/10-2;return [x-3.5,1.5+.25*x*x,0]});
 s.line3D('line-graph',{points,stroke:'BLUE',strokeWidth:.035});
 s.line3D('graph-axis',{points:[[-5.5,1.3,0],[-1.5,1.3,0]],stroke:'GREY_B',strokeWidth:.018});
 const vertices=[],triangles=[];
 for(let j=0;j<=16;j++)for(let i=0;i<=16;i++){const x=(i-8)/5,y=(j-8)/5;vertices.push([x,y,.18*(x*x-y*y)]);}
 for(let j=0;j<16;j++)for(let i=0;i<16;i++){const a=j*17+i;triangles.push([a,a+1,a+17],[a+1,a+18,a+17]);}
 const mesh=s.mesh('surface',{vertices,triangles,position:[-2,-1.6,0],rotation:[.35,.1,0],fill:'TEAL'});
 s.bind(mesh,[s.time],t=>({vertices:vertices.map(([x,y,z])=>[x,y,z+t/10*Math.cos(x)*Math.cos(y)])}));s.wait(60);
});`;
function requireDeadline(deadlineMs:number,nowMs=performance.now()){
 if(nowMs>deadlineMs)throw Error('Original visual deadline expired');
}
function describe(frame:Frame){
 const body=frame.elements.find(e=>e.id==='body')!,surface=frame.elements.find(e=>e.id==='surface')!;
 const deformationZ=surface.geometry.vertices![144][2];assert.equal(typeof deformationZ,'number');
 return {rotationY:body.rotation[1],position:body.position,deformationZ:deformationZ!,
  graphPoints:frame.elements.find(e=>e.id==='line-graph')!.geometry.points!.length,surfaceTriangles:surface.geometry.triangles!.length,camera:frame.camera};
}
const save=(path:string,value:unknown)=>writeFile(path,JSON.stringify(value,null,2));

export async function runLiveInventoryProof(options:LiveInventoryProofOptions){
 const directory=resolve(options.directory);await mkdir(directory,{recursive:true});
 // Avoid unnecessary pathname growth around canonical provenance filenames.
 const runDirectory=await mkdtemp(join(directory,'r')),publicationDirectory=runDirectory,fixtureRoot=join(runDirectory,'fixtures');
 await mkdir(fixtureRoot);
 const index=()=>createLocalAssetIndex({fixtureRoot,modelDirectory:publicationDirectory,dataRoots:[]});
 const session=await createLectureAssetSession(await index(),{ids:[]}),initialManifest=session.manifest();
 let inventory=validateLectureModelInventory(initialManifest),nowSeconds=0,reads=0,cancelPreparation:AbortController|undefined;
 const oldWorker=Object.getOwnPropertyDescriptor(globalThis,'Worker');
 Object.defineProperty(globalThis,'Worker',{configurable:true,writable:true,value:undefined});
 const models=new ModelStore({}, {read:async asset=>{
  const id=new URL(asset.url,'http://local.invalid').searchParams.get('assetId');
  const bytes=id?session.file(id):undefined;assert(bytes,'Registered session must own model bytes');reads++;return new Uint8Array(bytes);
 }});
 const world=createAssetBackedWorld(models,{clock:()=>nowSeconds,prepare:async scene=>{
  if(cancelPreparation&&[...scene.initial,...scene.lifecycle.flatMap(event=>event.elements??[])].some(e=>e.id==='cancelled'))
   cancelPreparation.abort(Error('Evidence corrected during preparation'));
 }});
 const receipt={schemaVersion:1,status:'running',createdAt:new Date().toISOString(),runDirectory,
  measurement:'Local publication to compiled, prepared and resolved geometry; optional offline snapshot readback is timed separately.',
  worldClock:'Controlled monotonic seconds for deterministic state assertions; elapsed work uses performance.now().',
  registration:{initialHostAssets:Object.keys(initialManifest.assets).length,initialWorldModelRevision:world.modelInventoryRevision,
   publishedAfterWorldCreated:false,hostRevision:0,worldModelRevision:0,initialInventoryId:initialManifest.inventoryId,currentInventoryId:initialManifest.inventoryId},
  model:{path:resolve(options.modelPath),sha256:'',runtimeId:'',bytes:0,parts:0,triangles:0,resolvedTriangles:0,readsAfterCold:0,readsAfterReuse:0,
   scientific:null as ModelProvenance['scientific']|null},
  timings:{originMs:0,originalDeadlineMs:0,publishMs:0,indexMs:0,hostRegistrationMs:0,browserRegistrationMs:0,
   coldCompilePrepareResolveMs:0,reusedCompilePrepareResolveMs:0,localPipelineMs:0,localPipelineWithin10s:false,offlineReadbackProcessMs:0},
  invariants:{} as Record<string,boolean>,samples:{} as {before:ReturnType<typeof describe>;after:ReturnType<typeof describe>;reuse:ReturnType<typeof describe>},
  render:{status:'not-requested',liveSubmittedAtMs:null,hardwarePresentedAtMs:null,evidence:null as FrameEvidence|null,
   pixelChecks:[] as {path:string;graphPixels:number;surfacePixels:number}[]},
  limitations:[
   'Local integration evidence only: arbitrary-subject retrieval, speech alignment, semantic relevance and visual explanation quality are unproved.',
   'The local model is selected explicitly before the run; it is not fetched or selected by a language model. Mechanical test fixtures do not establish scientific coverage.',
   'A static scientific representation is not a molecular motion simulation. Original provenance and representation caveats are retained.',
   'The optional image is a native WebGPU readback of a frozen actual-world sample in an isolated renderer, not a live-browser submission or hardware presentation timestamp.',
   'The world begins in 3D. This probe does not establish live 2D-to-3D camera switching, interactive input, clips or unlimited model residency.',
  ],error:undefined as string|undefined};
 try{
  assert.equal(receipt.registration.initialHostAssets,0);assert.equal(world.modelInventoryRevision,0);
  await world.addProgram({id:'native',source:nativeSource,baseRevision:0},0);
  nowSeconds=1;await world.apply({baseRevision:1,changes:[{id:'body',props:{position:[-1,1,0]},duration:4}]},1);
  const before=await world.sample(2),originalSummary=world.summary();receipt.samples.before=describe(before);
  const originMs=performance.now(),deadlineMs=originMs+10_000;
  receipt.timings.originMs=originMs;receipt.timings.originalDeadlineMs=deadlineMs;
  const guard=()=>requireDeadline(deadlineMs);
  const bytes=new Uint8Array(await readFile(options.modelPath));
  let provenance:ModelProvenance={source:'Explicit local integration fixture; no scientific meaning asserted'};
  if(options.provenancePath){
   const saved=JSON.parse(await readFile(options.provenancePath,'utf8'));
   assert.equal(saved.asset?.sha256,createHash('sha256').update(bytes).digest('hex'),'Local provenance must identify these exact model bytes');
   provenance=saved.provenance??{};
  }
  const store=new ModelAssets(publicationDirectory),publishStart=performance.now(),published=await store.publish(bytes,provenance);
  receipt.timings.publishMs=performance.now()-publishStart;receipt.registration.publishedAfterWorldCreated=true;
  Object.assign(receipt.model,{sha256:published.asset.sha256!,runtimeId:published.id,bytes:bytes.length,parts:published.asset.metadata.parts.length,
   triangles:published.asset.metadata.triangles,scientific:provenance.scientific??null});
  const indexStart=performance.now(),freshIndex=await index();receipt.timings.indexMs=performance.now()-indexStart;
  const cancelledAdmission=new AbortController();
  await assert.rejects(registerPublishedLectureAssets(session,freshIndex,[published.id],{signal:cancelledAdmission.signal,
   beforeCommit:()=>cancelledAdmission.abort(Error('Publication evidence cancelled'))}),/cancelled/);
  assert.deepEqual(session.manifest(),initialManifest);receipt.invariants.cancelledHostAdmissionUnpublished=true;
  const hostStart=performance.now(),incoming=await registerPublishedLectureAssets(session,freshIndex,[published.id],{beforeCommit:guard});
  receipt.timings.hostRegistrationMs=performance.now()-hostStart;
  receipt.registration.hostRevision=incoming.revision;
  const append=(assets:Parameters<typeof registerAssetBackedModels>[2])=>{registerAssetBackedModels(world,models,assets,{beforeCommit:guard});};
  // Inject one expired clock reading at the existing deadline; no timer is renewed.
  assert.throws(()=>reconcileLectureModelInventory(inventory,incoming,append,()=>requireDeadline(deadlineMs,deadlineMs+1)),/Original visual deadline/);
  assert.equal(world.modelInventoryRevision,0);assert.equal(Object.keys(models.metadata).length,0);assert.equal(inventory.revision,0);
  receipt.invariants.deadlinePreserved=true;
  const browserStart=performance.now();inventory=reconcileLectureModelInventory(inventory,incoming,append,guard);
  receipt.timings.browserRegistrationMs=performance.now()-browserStart;
  assert.deepEqual(world.summary(),originalSummary);receipt.invariants.registrationDoesNotMutateScene=true;
  receipt.registration.worldModelRevision=world.modelInventoryRevision;receipt.registration.currentInventoryId=inventory.inventoryId;
  const extent=Math.max(...published.asset.metadata.bounds.max.map((value,i)=>value-published.asset.metadata.bounds.min[i]));
  const scale=4/Math.max(extent,.001);
  const modelSource=(id:string,small=false)=>`export default scene({mode:'3d',end:'hold'},s=>{
   const model=s.model('${id}',{asset:'${published.id}',position:[${small?'3,-2.5,0':'2.3,.8,0'}],scale:${scale*(small?.35:1)}});
   s.bind(model,[s.time],t=>({rotation:[0,t*.1,0]}));s.wait(60);
  });`;
  nowSeconds=3;const coldStart=performance.now();
  await world.addProgram({id:'late-model',source:modelSource('specimen'),baseRevision:2},nowSeconds,{beforeCommit:guard});
  const after=await world.sample(4),resolved=models.resolve(after);
  receipt.timings.coldCompilePrepareResolveMs=performance.now()-coldStart;receipt.timings.localPipelineMs=performance.now()-originMs;
  receipt.timings.localPipelineWithin10s=receipt.timings.localPipelineMs<=10_000;receipt.samples.after=describe(after);receipt.model.readsAfterCold=reads;
  const imported=after.elements.filter(e=>e.geometry.model?.asset===published.id),resolvedById=new Map(resolved.elements.map(e=>[e.id,e]));
  receipt.model.resolvedTriangles=imported.reduce((n,e)=>n+(resolvedById.get(e.id)!.geometry.triangles?.length??0),0);
  assert.equal(receipt.model.resolvedTriangles,receipt.model.triangles);assert(imported.length>0);assert.equal(reads,1);
  assert.equal(world.summary().programs[0].epoch,0);receipt.invariants.originalEpochPreserved=true;
  assert.equal(receipt.samples.after.rotationY,4);receipt.invariants.rotationPreserved=true;
  assert(Math.abs(receipt.samples.after.deformationZ-.4)<1e-9);receipt.invariants.deformationPreserved=true;
  assert.deepEqual(receipt.samples.after.position,[-1.5,1,0]);receipt.invariants.hostTransitionPreserved=true;
  assert.deepEqual(after.camera,before.camera);receipt.invariants.cameraPreserved=true;
  assert.equal(receipt.samples.after.graphPoints,41);assert.equal(receipt.samples.after.surfaceTriangles,512);receipt.invariants.graphAndSurfaceRetained=true;
  assert.equal(reconcileLectureModelInventory(inventory,initialManifest,()=>{throw Error('Stale snapshot must not register');}),inventory);
  receipt.invariants.staleSnapshotIgnored=true;
  assert.throws(()=>reconcileLectureModelInventory(inventory,{...incoming,inventoryId:'f'.repeat(64)},append),/conflicting/);
  receipt.invariants.conflictingSnapshotRejected=true;
  const retry=await registerPublishedLectureAssets(session,freshIndex,[published.id]);assert.deepEqual(retry,incoming);
  assert.equal(reconcileLectureModelInventory(inventory,retry,()=>{throw Error('Retry must not register');}),inventory);receipt.invariants.idempotentRetry=true;
  const beforeCancel=world.summary();cancelPreparation=new AbortController();
  await assert.rejects(world.addProgram({id:'cancelled',source:modelSource('cancelled'),baseRevision:world.revision},4,
   {signal:cancelPreparation.signal,beforeCommit:guard}),/Evidence corrected/);
  assert.deepEqual(world.summary(),beforeCancel);assert.equal(describe(await world.sample(4)).rotationY,4);
  receipt.invariants.cancelledCandidateUnpublished=true;cancelPreparation=undefined;
  nowSeconds=5;const reuseStart=performance.now();
  await world.addProgram({id:'reuse',source:modelSource('reused',true),baseRevision:world.revision},nowSeconds,{beforeCommit:guard});
  const reused=await world.sample(6),reusedResolved=models.resolve(reused);receipt.samples.reuse=describe(reused);
  receipt.timings.reusedCompilePrepareResolveMs=performance.now()-reuseStart;receipt.model.readsAfterReuse=reads;assert.equal(reads,1);
  const originalPrimitive=reusedResolved.elements.find(e=>e.id==='specimen/primitive-0')!,reusedPrimitive=reusedResolved.elements.find(e=>e.id==='reused/primitive-0')!;
  assert.equal(originalPrimitive.geometry.vertices,reusedPrimitive.geometry.vertices);receipt.invariants.sharedGeometryReused=true;
  assert.equal(world.modelInventoryRevision,1);assert.equal(world.summary().programs[0].epoch,0);
  assert(receipt.timings.localPipelineWithin10s,'Local publication/prepare/resolve exceeded the original ten-second budget');
  await Promise.all([save(join(runDirectory,'cold-frame.json'),after),save(join(runDirectory,'reuse-frame.json'),reused),
   save(join(runDirectory,'manifest.json'),incoming),writeFile(join(runDirectory,'native-source.js'),nativeSource),writeFile(join(runDirectory,'model-source.js'),modelSource('specimen'))]);
  if(options.render){
   receipt.render.status='running';
   const renderStart=performance.now(),previousFrame=structuredClone(after);for(const element of previousFrame.elements)element.persistent=true;
   const payload={assets:incoming.assets,files:Object.fromEntries(Object.entries(incoming.assets).map(([id,asset])=>[asset.url,session.file(id)!.toString('base64')]))};
   receipt.render.evidence=await renderSceneFrames({source:`export default scene(${JSON.stringify(world.rendererOptions)},s=>s.wait(1));`,
    previousFrame,models:payload,times:[0],directory:join(runDirectory,'native-readback'),signal:AbortSignal.timeout(45_000)});
   for(const frame of receipt.render.evidence.frames){
    const image=await loadImage(frame.path),canvas=createCanvas(image.width,image.height),context=canvas.getContext('2d');
    context.drawImage(image,0,0);const pixels=context.getImageData(0,0,image.width,image.height).data;
    let graphPixels=0,surfacePixels=0;
    for(let y=0;y<image.height;y++)for(let x=0;x<image.width;x++){
     const offset=(y*image.width+x)*4,[r,g,b]=pixels.subarray(offset,offset+3);
     if(x<image.width*.48&&y<image.height*.47&&g>90&&b>90&&g>r*1.25&&b>r*1.25)graphPixels++;
     if(x<image.width*.55&&y>image.height*.5&&g>r*1.5&&g>b*.9&&b>70)surfacePixels++;
    }
    receipt.render.pixelChecks.push({path:frame.path,graphPixels,surfacePixels});
    assert(graphPixels>30,'Offline image must contain the blue graph in the left upper region');
    assert(surfacePixels>1000,'Offline image must contain the teal surface in the left lower region');
   }
   receipt.timings.offlineReadbackProcessMs=performance.now()-renderStart;receipt.render.status='offline-native-readback';
  }
  receipt.status='passed';await save(join(directory,'receipt.json'),receipt);await save(join(runDirectory,'receipt.json'),receipt);return receipt;
 }catch(error){
  if(receipt.render.status==='running')receipt.render.status='failed';
  receipt.status='failed';receipt.error=error instanceof Error?error.message:String(error);
  await save(join(directory,'receipt.json'),receipt);await save(join(runDirectory,'receipt.json'),receipt);throw error;
 }finally{
  world.dispose();models.dispose();
  if(oldWorker)Object.defineProperty(globalThis,'Worker',oldWorker);else Reflect.deleteProperty(globalThis,'Worker');
 }
}

if(import.meta.main){
 const root=fileURLToPath(new URL('../../../',import.meta.url)),args=process.argv.slice(2);
 const value=(flag:string)=>args.find(arg=>arg.startsWith(flag+'='))?.slice(flag.length+1);
 if(args.includes('--help'))console.log('bun backend/bench/realtime-media/live-inventory-proof.ts [--out=DIR] [--model=LOCAL.glb] [--provenance=LOCAL.json] [--no-render]');
 else{
  const modelPath=resolve(value('--model')??join(root,'data/protein-pipeline-proof-20261011/models/14f44b116cf0f9ed7092009fef76b48f620536133be08b10225f9c1533fb2480.glb'));
  const result=await runLiveInventoryProof({directory:resolve(value('--out')??join(root,'data/realtime-workshop/live-inventory-01')),
   modelPath,provenancePath:value('--provenance')??(value('--model')?undefined:modelPath.replace(/\.glb$/,'.json')),render:!args.includes('--no-render')});
  console.log(JSON.stringify({status:result.status,receipt:join(resolve(value('--out')??join(root,'data/realtime-workshop/live-inventory-01')),'receipt.json'),
   localPipelineMs:result.timings.localPipelineMs,triangles:result.model.triangles,render:result.render.status}));
 }
}

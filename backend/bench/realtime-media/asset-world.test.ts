import {expect,test} from 'bun:test';
import {createAssetBackedWorld} from './asset-world.js';
import * as assetWorld from './asset-world.js';
import {ModelStore} from '../../../shared/animlib/src/model-store.js';
import {modelFixture} from '../../../shared/animlib/test/model-fixture.js';
import {parseModelGLB} from '../../../shared/animlib/src/models.js';
import {evaluateScene} from '../../../shared/animlib/src/timeline.js';
import type {ModelAsset} from '../../../shared/animlib/src/model-types.js';
Object.defineProperty(globalThis,'Worker',{configurable:true,writable:true,value:undefined});
const source=`export default scene({mode:'3d',end:'hold'},s=>{const m=s.model('specimen',{asset:'fixture'});s.bind(m,[s.time],t=>({rotation:[0,t,0]}));s.wait(20);});`;

test('shared lecture wiring prepares model bytes before renderer, reuses decode and preserves motion during edits',async()=>{
 const bytes=await modelFixture({textured:false}),data=await parseModelGLB(bytes);let reads=0,prepares=0;
 const models=new ModelStore({fixture:{kind:'model',url:'local:fixture',metadata:data.metadata}},{read:async()=>{reads++;return bytes;}});
 const world=createAssetBackedWorld(models,{clock:()=>0,prepare:async(scene)=>{
  prepares++;expect(reads).toBe(1);
  // Resolution would throw if renderer preparation preceded model preparation.
  expect(models.resolve(evaluateScene(scene,0)).elements.some(e=>e.geometry.vertices?.length)).toBe(true);
 }});
 try{
  await world.addProgram({id:'seed',source,baseRevision:0},0);
  const frame=await world.sample(1);expect(frame.elements.some(e=>e.geometry.model)).toBe(true);
  expect(frame.elements.some(e=>e.geometry.vertices?.length)).toBe(false);
  await world.apply({baseRevision:1,changes:[{id:'specimen',props:{position:[2,0,0]},duration:1}]},1);
  const moved=(await world.sample(2)).elements.find(e=>e.id==='specimen')!;
  expect(moved.position).toEqual([2,0,0]);expect(moved.rotation[1]).toBeCloseTo(2);
  await world.addProgram({id:'reuse',baseRevision:2,source:source.replaceAll('specimen','second')},2);
  expect(reads).toBe(1);expect(prepares).toBe(2);
 }finally{world.dispose();models.dispose();}
});

test('cancellation during asset preparation never reaches renderer or publishes candidate',async()=>{
 const bytes=await modelFixture({textured:false}),data=await parseModelGLB(bytes),controller=new AbortController();let rendered=false;
 const models=new ModelStore({fixture:{kind:'model',url:'local:fixture',metadata:data.metadata}},{read:async()=>{controller.abort(Error('evidence corrected'));return bytes;}});
 const world=createAssetBackedWorld(models,{clock:()=>0,prepare:async()=>{rendered=true;}});
 try{
  await expect(world.addProgram({id:'cancelled',source,baseRevision:0},0,{signal:controller.signal})).rejects.toThrow();
  expect(world.revision).toBe(0);expect(world.summary().entityIds).toEqual([]);expect(rendered).toBe(false);
 }finally{world.dispose();models.dispose();}
});

async function published(){
 const bytes=await modelFixture({textured:false}),data=await parseModelGLB(bytes);
 const sha256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(v=>v.toString(16).padStart(2,'0')).join('');
 return {bytes,asset:{kind:'model',url:'local:fixture',sha256,provenanceSha256:'a'.repeat(64),metadata:data.metadata} satisfies ModelAsset};
}

test('appends a previously absent model while existing motion and transitions continue',async()=>{
 const {bytes,asset}=await published();let now=0,reads=0;
 const models=new ModelStore({},{read:async()=>{reads++;return bytes;}}),world=createAssetBackedWorld(models,{clock:()=>now});
 try{
  await world.addProgram({id:'native',baseRevision:0,source:`export default scene({mode:'3d'},s=>{
   const body=s.box('body'),mesh=s.mesh('mesh',{vertices:[[0,0,0],[1,0,0],[0,1,0]],triangles:[[0,1,2]]});
   s.bind(body,[s.time],t=>({rotation:[0,t,0]}));
   s.bind(mesh,[s.time],t=>({vertices:[[0,0,0],[1,0,0],[0,1,t/10]]}));s.wait(60);
  });`},0);
  now=1;await world.apply({baseRevision:1,changes:[{id:'body',props:{position:[4,0,0]},duration:4}]},now);
  const before=world.summary(),camera=world.rendererOptions;
  expect(assetWorld.registerAssetBackedModels(world,models,{fixture:asset})).toEqual({inventoryRevision:1,added:['fixture']});
  expect(world.summary()).toEqual(before);expect(world.rendererOptions).toEqual(camera);expect(reads).toBe(0);
  now=2;await world.addProgram({id:'imported',source,baseRevision:2},now);
  const frame=await world.sample(3),body=frame.elements.find(e=>e.id==='body')!,mesh=frame.elements.find(e=>e.id==='mesh')!;
  expect(body.rotation[1]).toBe(3);expect(body.position).toEqual([2,0,0]);expect(mesh.geometry.vertices?.[2][2]).toBeCloseTo(.3);
  expect(frame.elements.find(e=>e.id==='specimen')!.rotation[1]).toBe(1);expect(reads).toBe(1);
  expect(models.resolve(frame).elements.some(e=>e.geometry.vertices?.length)).toBe(true);
  expect(world.summary().programs.map(p=>p.epoch)).toEqual([0,2]);
 }finally{world.dispose();models.dispose();}
});

test('coordinator freezes submitted assets before a guard can mutate caller input',async()=>{
 const {bytes,asset}=await published();let loaded='';
 const models=new ModelStore({},{read:async a=>{loaded=a.url;return bytes;}}),world=createAssetBackedWorld(models);
 try{
  assetWorld.registerAssetBackedModels(world,models,{fixture:asset},{beforeCommit:()=>{
   asset.url='local:changed';asset.metadata.primitives.length=0;
  }});
  await world.addProgram({id:'model',source,baseRevision:0},0);
  expect(loaded).toBe('local:fixture');expect(models.metadata.fixture.primitives).toHaveLength(1);
 }finally{world.dispose();models.dispose();}
});

test('mixed invalid batches and store identity conflicts publish neither inventory',async()=>{
 const {asset}=await published(),models=new ModelStore({known:asset}),world=createAssetBackedWorld(models);
 try{
  const invalid=structuredClone(asset);invalid.metadata.triangles++;
  expect(()=>assetWorld.registerAssetBackedModels(world,models,{good:asset,bad:invalid})).toThrow(/metadata/i);
  expect(Object.keys(models.metadata)).toEqual(['known']);expect(world.modelInventoryRevision).toBe(0);
  const changed={...asset,sha256:'b'.repeat(64)};
  expect(()=>assetWorld.registerAssetBackedModels(world,models,{good:asset,known:changed})).toThrow(/immutable/i);
  expect(Object.keys(models.metadata)).toEqual(['known']);expect(world.modelInventoryRevision).toBe(0);
  expect(()=>assetWorld.registerAssetBackedModels(world,models,{good:asset,known:{...asset,provenanceSha256:'b'.repeat(64)}})).toThrow(/immutable/i);
  expect(Object.keys(models.metadata)).toEqual(['known']);expect(world.modelInventoryRevision).toBe(0);
 }finally{world.dispose();models.dispose();}
});

test.each(['preabort','abort','throw','async','world-dispose','store-dispose','reentrant'])(
 'registration guard %s cannot partially publish the candidate batch',async mode=>{
 const {asset}=await published(),models=new ModelStore(),world=createAssetBackedWorld(models),controller=new AbortController();let called=false;
 if(mode==='preabort')controller.abort(Error('cancelled'));
 try{
  expect(()=>assetWorld.registerAssetBackedModels(world,models,{fixture:asset},{signal:controller.signal,beforeCommit:()=>{
   called=true;
   if(mode==='abort')controller.abort(Error('cancelled'));
   if(mode==='throw')throw Error('guard failed');
   if(mode==='async')return Promise.reject(Error('async guard'));
   if(mode==='world-dispose')world.dispose();
   if(mode==='store-dispose')models.dispose();
   if(mode==='reentrant')world.stageModelRegistration({other:asset.metadata}).commit();
  }})).toThrow(mode==='async'?/synchronous/:mode.endsWith('dispose')?/disposed/:mode==='reentrant'?/stale.*inventory/i:mode==='throw'?/guard failed/:/cancelled/);
  expect(Object.keys(models.metadata)).toEqual([]);expect(world.revision).toBe(0);
  expect(world.modelInventoryRevision).toBe(mode==='reentrant'?1:0);
  expect(called).toBe(mode!=='preabort');
 }finally{world.dispose();models.dispose();}
});

test('coordinator rejects accessors without invoking them and accepts identical retries',async()=>{
 const {asset}=await published(),models=new ModelStore(),world=createAssetBackedWorld(models);let reads=0;
 try{
  expect(()=>assetWorld.registerAssetBackedModels(world,models,{get fixture(){reads++;return asset;}})).toThrow(/unsafe|plain/i);
  expect(reads).toBe(0);expect(Object.keys(models.metadata)).toEqual([]);
  expect(assetWorld.registerAssetBackedModels(world,models,{fixture:asset})).toEqual({inventoryRevision:1,added:['fixture']});
  expect(assetWorld.registerAssetBackedModels(world,models,{fixture:structuredClone(asset)})).toEqual({inventoryRevision:1,added:[]});
  expect(world.revision).toBe(0);
 }finally{world.dispose();models.dispose();}
});

test('cumulative inventory limit is checked before adding models to the store',async()=>{
 const {asset}=await published(),models=new ModelStore(),world=createAssetBackedWorld(models);
 try{
  assetWorld.registerAssetBackedModels(world,models,Object.fromEntries(Array.from({length:64},(_,i)=>['model-'+i,asset])));
  expect(()=>assetWorld.registerAssetBackedModels(world,models,{overflow:asset})).toThrow(/inventory limit/i);
  expect(Object.keys(models.metadata)).toHaveLength(64);expect(models.metadata.overflow).toBeUndefined();expect(world.modelInventoryRevision).toBe(1);
 }finally{world.dispose();models.dispose();}
});

test('coordinator normalizes typed undefined optionals without retaining caller aliases',async()=>{
 const {bytes,asset:publishedAsset}=await published(),asset:ModelAsset=publishedAsset;let loaded:ModelAsset|undefined;
 asset.sha256=undefined;asset.provenanceSha256=undefined;asset.metadata.parts[0].parent=undefined;
 const expected=structuredClone(asset.metadata);delete expected.parts[0].parent;
 const models=new ModelStore({},{read:async value=>{loaded=value;return bytes;}}),world=createAssetBackedWorld(models,{clock:()=>0});
 try{
  expect(assetWorld.registerAssetBackedModels(world,models,{fixture:asset})).toEqual({inventoryRevision:1,added:['fixture']});
  expect(Object.hasOwn(asset,'sha256')).toBe(true);expect(Object.hasOwn(asset.metadata.parts[0],'parent')).toBe(true);
  expect(Object.hasOwn(models.metadata.fixture.parts[0],'parent')).toBe(false);
  asset.url='local:changed';asset.metadata.parts[0].name='Changed';asset.metadata.primitives.length=0;
  expect(models.metadata.fixture).toEqual(expected);
  await world.addProgram({id:'normalized',source,baseRevision:0},0);
  expect(loaded?.url).toBe('local:fixture');expect(Object.hasOwn(loaded!,'sha256')).toBe(false);
  expect(Object.hasOwn(loaded!,'provenanceSha256')).toBe(false);
  expect(models.resolve(await world.sample(1)).elements.some(e=>e.geometry.vertices?.length)).toBe(true);
 }finally{world.dispose();models.dispose();}
});

test('normalization rejects undefined array entries and never executes getters or toJSON',async()=>{
 const {asset}=await published(),models=new ModelStore(),world=createAssetBackedWorld(models);let calls=0;
 try{
  const missing=structuredClone(asset);missing.metadata.parts[0].position[0]=undefined as unknown as number;
  const getter=structuredClone(asset);Object.defineProperty(getter,'sha256',{enumerable:true,get(){calls++;return undefined;}});
  const serializer=Object.assign(structuredClone(asset),{toJSON(){calls++;return asset;}});
  for(const bad of [missing,getter,serializer]){
   expect(()=>assetWorld.registerAssetBackedModels(world,models,{first:asset,bad})).toThrow();
   expect(Object.keys(models.metadata)).toEqual([]);expect(world.modelInventoryRevision).toBe(0);
  }
  expect(calls).toBe(0);
 }finally{world.dispose();models.dispose();}
});

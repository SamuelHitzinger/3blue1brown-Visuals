import {expect,test} from 'bun:test';
import {createAssetBackedWorld} from './asset-world.js';
import {ModelStore} from '../../../shared/animlib/src/model-store.js';
import {modelFixture} from '../../../shared/animlib/test/model-fixture.js';
import {parseModelGLB} from '../../../shared/animlib/src/models.js';
import {evaluateScene} from '../../../shared/animlib/src/timeline.js';
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

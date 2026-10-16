import {afterEach,expect,spyOn,test} from 'bun:test';
import {LiveWorld} from './world.js';
import {SourceCompiler} from '../../../shared/animlib/src/compiler-client.js';
import type {ModelMetadata} from '../../../shared/animlib/src/model-types.js';

Object.defineProperty(globalThis,'Worker',{configurable:true,writable:true,value:undefined});
const worlds:LiveWorld[]=[];
afterEach(()=>{for(const world of worlds.splice(0))world.dispose();});
function metadata():ModelMetadata{return {version:1,parts:[{id:'node-0',name:'Panel',position:[0,0,0],primitives:[0]}],
  primitives:[{bounds:{min:[0,0,0],max:[1,1,0]},triangles:1}],bounds:{min:[0,0,0],max:[1,1,0]},triangles:1,materials:[]};}
function world(models:Record<string,ModelMetadata>={}){const value=new LiveWorld({clock:()=>0,models});worlds.push(value);return value;}
const source=(asset:string)=>`export default scene({mode:'3d'},s=>{s.model('specimen',{asset:'${asset}'});s.wait(20);});`;
function deferred(){let resolve!:()=>void;return {promise:new Promise<void>(r=>{resolve=r;}),resolve:()=>resolve()};}

test('stages metadata without exposing it, then appends without a scene revision',async()=>{
  const live=world(),additions={later:metadata()},staged=live.stageModelRegistration(additions);
  expect(staged.revision).toBe(0);expect(staged.added).toEqual(['later']);expect(live.modelInventoryRevision).toBe(0);
  await expect(live.addProgram({id:'before',source:source('later'),baseRevision:0},0)).rejects.toThrow(/unknown model/i);
  additions.later.parts[0].name='Mutated';additions.later.primitives.length=0;
  expect(staged.commit()).toBe(1);expect(live.revision).toBe(0);
  await live.addProgram({id:'after',source:source('later'),baseRevision:0},0);
  expect((await live.sample(0)).elements.some(e=>e.geometry.model?.asset==='later')).toBe(true);
  expect(live.modelInventoryRevision).toBe(1);
});

test('rejects a mixed invalid append before any metadata is visible',async()=>{
  const live=world({known:metadata()}),invalid=metadata();invalid.triangles=2;
  expect(()=>live.stageModelRegistration({good:metadata(),bad:invalid})).toThrow(/metadata/i);
  expect(live.modelInventoryRevision).toBe(0);
  await expect(live.addProgram({id:'unknown',source:source('good'),baseRevision:0},0)).rejects.toThrow(/unknown model/i);
  const changed=metadata();changed.parts[0].name='Replacement';
  expect(()=>live.stageModelRegistration({good:metadata(),known:changed})).toThrow(/immutable/i);
  expect(live.modelInventoryRevision).toBe(0);
});

test('identical retries are no-ops and competing stages cannot overwrite a newer inventory',()=>{
  const live=world({known:metadata()}),noop=live.stageModelRegistration({known:metadata()});
  expect(noop.added).toEqual([]);expect(noop.commit()).toBe(0);
  const first=live.stageModelRegistration({first:metadata()}),second=live.stageModelRegistration({second:metadata()});
  expect(first.commit()).toBe(1);
  expect(()=>second.assertCurrent()).toThrow(/stale.*inventory/i);expect(()=>second.commit()).toThrow(/stale.*inventory/i);
  expect(live.stageModelRegistration({first:metadata()}).commit()).toBe(1);
  expect(live.stageModelRegistration({second:metadata()}).commit()).toBe(2);
  expect(live.revision).toBe(0);
});

test('disposal rejects an already staged registration and future stages',()=>{
  const live=world(),staged=live.stageModelRegistration({later:metadata()});live.dispose();
  expect(()=>staged.assertCurrent()).toThrow(/disposed/i);expect(()=>staged.commit()).toThrow(/disposed/i);
  expect(()=>live.stageModelRegistration({other:metadata()})).toThrow(/disposed/i);
  expect(live.modelInventoryRevision).toBe(0);
});

test('validates plain metadata before reading accessors and bounds cumulative inventory',()=>{
  const live=world();let reads=0;
  expect(()=>live.stageModelRegistration({get unsafe(){reads++;return metadata();}})).toThrow(/unsafe/i);expect(reads).toBe(0);
  expect(()=>live.stageModelRegistration(JSON.parse('{"__proto__":{}}'))).toThrow(/unsafe/i);
  expect(()=>live.stageModelRegistration({symbol:{...metadata(),[Symbol('hidden')]:()=>{}}})).toThrow(/unsafe/i);
  const full=Object.fromEntries(Array.from({length:64},(_,i)=>['model-'+i,metadata()]));
  expect(live.stageModelRegistration(full).commit()).toBe(1);
  expect(()=>live.stageModelRegistration({overflow:metadata()})).toThrow(/inventory limit/i);
  expect(live.stageModelRegistration({'model-0':metadata()}).commit()).toBe(1);
});

test.each(['known','later'])('pending compilation retains its admission snapshot for %s',async asset=>{
  const live=world({known:metadata()}),entered=deferred(),gate=deferred(),original=SourceCompiler.prototype.compile;
  const spy=spyOn(SourceCompiler.prototype,'compile').mockImplementation(async function(this:SourceCompiler,...args:Parameters<typeof original>){
    entered.resolve();await gate.promise;return original.apply(this,args);
  });
  try{
    const pending=live.addProgram({id:'pending',source:source(asset),baseRevision:0},0);
    const outcome=pending.then(commit=>({commit,error:null}),error=>({commit:null,error}));
    await entered.promise;live.stageModelRegistration({later:metadata()}).commit();gate.resolve();
    const result=await outcome;
    if(asset==='known'){expect(result.error).toBeNull();expect(result.commit?.revision).toBe(1);}
    else{expect(result.error?.message).toMatch(/unknown model/i);expect(live.revision).toBe(0);}
    expect(live.modelInventoryRevision).toBe(1);
  }finally{gate.resolve();spy.mockRestore();}
});

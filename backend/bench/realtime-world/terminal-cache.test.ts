import {afterEach,expect,spyOn,test} from 'bun:test';
import {LiveWorld} from './world.js';
import {SourceCompiler} from '../../../shared/animlib/src/compiler-client.js';
import type {Frame} from '../../../shared/animlib/src/types.js';
import type {AssetRegistry} from '../../../shared/animlib/src/asset-types.js';
Object.defineProperty(globalThis,'Worker',{configurable:true,writable:true,value:undefined});
const worlds:LiveWorld[]=[];
afterEach(()=>{for(const world of worlds.splice(0))world.dispose();});
const source=`export default scene({end:'hold'},s=>{
 const body=s.circle('body',{radius:.2,fill:'BLUE'});
 s.bind(body,[s.time],t=>({radius:.2+t}));
 const label=s.text('label',{text:'r',fontSize:.3});s.attach(label,body,{offset:[0,3,0]});
 const end=s.circle('end',{radius:.1,position:[4,0,0]});const line=s.line('link',{points:[[0,0],[4,0]]});s.connect(line,body,end,{endpoints:'center'});
 s.wait(2);
});`;
const element=(frame:Frame,id:string)=>frame.elements.find(item=>item.id===id)!;
const gate=()=>{let resolve!:()=>void;const promise=new Promise<void>(yes=>{resolve=yes;});return {promise,resolve};};
async function setup(){const world=new LiveWorld({clock:()=>0});worlds.push(world);await world.addProgram({id:'short',source,baseRevision:0},0);return world;}

test('terminal snapshots avoid repeated callbacks while active and reverse samples stay exact',async()=>{
 const world=await setup(),original=SourceCompiler.prototype.update;
 const calls:number[]=[];const spy=spyOn(SourceCompiler.prototype,'update').mockImplementation(function(this:SourceCompiler,...args:Parameters<typeof original>){calls.push(args[4]!);return original.apply(this,args);});
 try{
  expect(element(await world.sample(1),'body').geometry.radius).toBe(1.2);
  const held=await world.sample(2);
  for(const t of [3,4,5])expect(await world.sample(t)).toEqual(held);
  expect(calls).toEqual([1,2]);
  expect(element(await world.sample(.5),'body').geometry.radius).toBe(.7);
  expect(await world.sample(6)).toEqual(held);expect(calls).toEqual([1,2,.5]);
  element(held,'body').geometry.radius=999;
  expect(element(await world.sample(7),'body').geometry.radius).toBe(2.2);
 }finally{spy.mockRestore();}
});

test('host tweens, attachments, connectors and removals stay live over terminal callback output',async()=>{
 const world=await setup(),original=SourceCompiler.prototype.update;let calls=0;
 const spy=spyOn(SourceCompiler.prototype,'update').mockImplementation(function(this:SourceCompiler,...args:Parameters<typeof original>){calls++;return original.apply(this,args);});
 try{
  await world.sample(3);
  await world.apply({baseRevision:1,changes:[{id:'body',props:{position:[2,0,0],fill:'RED'},duration:2}]},4);
  const middle=await world.sample(5),end=await world.sample(6);
  expect(element(middle,'body').position).toEqual([1,0,0]);expect(element(end,'body').fill).toBe('RED');
  expect(element(middle,'label').position).toEqual([1,3,0]);expect(element(middle,'link').geometry.points?.[0]).toEqual([1,0,0]);
  expect(element(end,'body').geometry.radius).toBe(2.2);expect(calls).toBe(1);
  await world.apply({baseRevision:2,changes:[],remove:['body']},7);
  expect((await world.sample(8)).elements.some(item=>item.id==='body')).toBe(false);expect(calls).toBe(1);
 }finally{spy.mockRestore();}
});

test('concurrent terminal readers share work and cancelling one edit leaves other reader valid',async()=>{
 const world=await setup(),entered=gate(),release=gate(),original=SourceCompiler.prototype.update;let calls=0;
 const spy=spyOn(SourceCompiler.prototype,'update').mockImplementation(async function(this:SourceCompiler,...args:Parameters<typeof original>){calls++;entered.resolve();await release.promise;return original.apply(this,args);});
 const controller=new AbortController();
 try{
  const first=world.sample(3);await entered.promise;
  const second=world.sample(4),edit=world.apply({baseRevision:1,changes:[{id:'body',props:{fill:'RED'}}]},5,{signal:controller.signal});
  const rejected=edit.catch(error=>error);controller.abort(Error('evidence replaced'));
  expect((await rejected).message).toBe('evidence replaced');expect(calls).toBe(1);
  release.resolve();expect(await second).toEqual(await first);expect(world.revision).toBe(1);
  expect(element(await world.sample(6),'body').fill).toBe('BLUE');expect(calls).toBe(1);
 }finally{release.resolve();spy.mockRestore();}
});

test('failed terminal update is evicted and later sampling can retry',async()=>{
 const world=await setup(),original=SourceCompiler.prototype.update;let calls=0;
 const spy=spyOn(SourceCompiler.prototype,'update').mockImplementation(function(this:SourceCompiler,...args:Parameters<typeof original>){
  calls++;return calls===1?Promise.reject(Error('transient update')):original.apply(this,args);
 });
 try{
  await expect(world.sample(3)).rejects.toThrow('transient update');
  expect(element(await world.sample(4),'body').geometry.radius).toBe(2.2);
  await world.sample(5);expect(calls).toBe(2);
 }finally{spy.mockRestore();}
});

test('retirement waits for shared terminal readers and disposed samples cannot publish',async()=>{
 const world=await setup(),entered=gate(),release=gate(),original=SourceCompiler.prototype.update;let compiler:SourceCompiler|undefined;
 const spy=spyOn(SourceCompiler.prototype,'update').mockImplementation(async function(this:SourceCompiler,...args:Parameters<typeof original>){compiler=this;entered.resolve();await release.promise;return original.apply(this,args);});
 const dispose=spyOn(SourceCompiler.prototype,'dispose');
 try{
  const first=world.sample(3).catch(error=>error);await entered.promise;
  const second=world.sample(4).catch(error=>error);world.dispose();expect(dispose).not.toHaveBeenCalled();
  release.resolve();expect((await first).message).toMatch(/disposed/);expect((await second).message).toMatch(/disposed/);
  expect(dispose).toHaveBeenCalledTimes(1);expect(compiler).toBeDefined();
 }finally{release.resolve();spy.mockRestore();dispose.mockRestore();}
});

test('terminal snapshots keep original asset lease through later commits and release on full removal',async()=>{
 let leases=0;const descriptor={id:'image',kind:'image' as const,hash:'a'.repeat(64),width:1,height:1};
 const assets:AssetRegistry={catalog:[descriptor],stats:()=>({decodedBytes:4,pinnedBytes:leases*4,leases,models:1}),acquire:()=>{
  leases++;return {resolve:()=>{throw Error('No mesh');},resolveImage:()=>({...descriptor,copyPixels:()=>new Uint8Array([0,0,0,255])}),dispose:()=>{leases--;}};
 }};
 const world=new LiveWorld({clock:()=>0,assets});worlds.push(world);
 await world.addProgram({id:'picture',baseRevision:0,source:`export default scene({},s=>{const p=s.image('picture',{asset:'image'});s.bind(p,[s.time],t=>({position:[t,0,0]}));s.wait(2);});`},0);
 await world.sample(3);await world.sample(4);expect(leases).toBe(1);
 await world.addProgram({id:'new',baseRevision:1,source:`export default scene({},s=>{s.circle('new',{radius:.1});s.wait(2);});`},4);
 expect(world.assetGeometry.resolveImage(descriptor).copyPixels()).toEqual(new Uint8Array([0,0,0,255]));expect(leases).toBe(1);
 await world.apply({baseRevision:2,changes:[],remove:['picture']},5);expect(leases).toBe(0);
 expect(()=>world.assetGeometry.resolveImage(descriptor)).toThrow('prepared scene lease');
});

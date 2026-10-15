import { afterEach, expect, test } from 'bun:test';
import { LiveWorld } from './world.js';
import type { Frame } from '../../../shared/animlib/src/types.js';

// Exercise real QuickJS through SourceCompiler's supported headless mode.
Object.defineProperty(globalThis,'Worker',{configurable:true,writable:true,value:undefined});
const worlds: LiveWorld[] = [];
afterEach(()=>{for(const world of worlds.splice(0)) world.dispose();});
const element=(frame:Frame,id:string)=>{const found=frame.elements.find(e=>e.id===id);expect(found).toBeDefined();return found!;};
const cube=`export default scene({mode:'3d',end:'hold',orbit:false},s=>{
  const body=s.box('cube',{width:1,height:1,depth:1,fill:'BLUE'});
  s.bind(body,[s.time],t=>({rotation:[0,t,0]}));
  s.play(body.moveTo([10,0,0]),{duration:10,ease:'linear'});s.wait(50);
});`;
const deform=`export default scene({mode:'3d',end:'hold',orbit:false},s=>{
  const mesh=s.mesh('custom',{vertices:[[0,0,0],[1,0,0],[0,1,0]],triangles:[[0,1,2]],fill:'TEAL'});
  s.bind(mesh,[s.time],t=>({vertices:[[0,0,0],[1,0,0],[0,1,t/10]]}));s.wait(60);
});`;
const dot=(id:string)=>`export default scene({end:'hold'},s=>{s.circle('${id}',{radius:.3});s.wait(60);});`;
function deferred(){let resolve!:()=>void;const promise=new Promise<void>(r=>{resolve=r;});return {promise,resolve};}

test('retains sandbox rotation/deformation while adding a new program and does not restart old time',async()=>{
  let now=0;const world=new LiveWorld({clock:()=>now});worlds.push(world);
  await world.addProgram({id:'cube-program',source:cube,baseRevision:0},now);
  now=2;await world.addProgram({id:'custom-program',source:deform,baseRevision:1},now);
  const a=await world.sample(3),b=await world.sample(4);
  expect(element(a,'cube').rotation[1]).toBeCloseTo(3);
  expect(element(b,'cube').rotation[1]).toBeCloseTo(4);
  expect(element(b,'cube').position[0]).toBeCloseTo(4);
  expect(element(a,'custom').geometry.vertices?.[2][2]).toBeCloseTo(.1);
  expect(element(b,'custom').geometry.vertices?.[2][2]).toBeCloseTo(.2);
});

test('property overrides preserve untouched time bindings and animate from the current pose',async()=>{
  let now=0;const world=new LiveWorld({clock:()=>now});worlds.push(world);
  await world.addProgram({id:'cube-program',source:cube,baseRevision:0},0);
  now=2;const first=await world.apply({baseRevision:1,changes:[{id:'cube',props:{fill:'RED'}}]},now);
  expect(first.committedAt).toBe(2);
  now=3;await world.apply({baseRevision:2,changes:[{id:'cube',props:{position:[7,0,0]},duration:2}]},now);
  const middle=element(await world.sample(4),'cube');
  expect(middle.position[0]).toBeCloseTo(5);expect(middle.rotation[1]).toBeCloseTo(4);expect(middle.fill).toBe('RED');
  expect(element(await world.sample(6),'cube').position[0]).toBe(7);
  expect(element(await world.sample(6),'cube').rotation[1]).toBe(6);
});

test('old world remains sampleable during preparation; new epoch is actual commit time',async()=>{
  let now=0;const entered=deferred(),gate=deferred();
  const world=new LiveWorld({clock:()=>now,prepare:async(scene)=>{if([...scene.initial,...scene.lifecycle.flatMap(event=>event.elements??[])].some(e=>e.id==='custom')){entered.resolve();await gate.promise;}}});worlds.push(world);
  await world.addProgram({id:'cube-program',source:cube,baseRevision:0},now);
  now=1;const adding=world.addProgram({id:'custom-program',source:deform,baseRevision:1},now);await entered.promise;
  now=4;const frame=await world.sample(now);expect(frame.elements.map(e=>e.id)).toEqual(['cube']);expect(element(frame,'cube').rotation[1]).toBe(4);
  now=5;gate.resolve();const commit=await adding;expect(commit.committedAt).toBe(5);
  expect(element(await world.sample(6),'custom').geometry.vertices?.[2][2]).toBeCloseTo(.1);
  expect(element(await world.sample(6),'cube').rotation[1]).toBe(6);
});

test('invalid, stale, unsupported and mixed valid/invalid patches are atomic',async()=>{
  const world=new LiveWorld({clock:()=>0});worlds.push(world);
  await world.addProgram({id:'cube-program',source:cube,baseRevision:0},0);
  const original=await world.sample(2);
  await expect(world.apply({baseRevision:0,changes:[{id:'cube',props:{fill:'RED'}}]},2)).rejects.toThrow(/stale/i);
  await expect(world.apply({baseRevision:1,changes:[{id:'cube',props:{fill:'RED'}},{id:'missing',props:{opacity:0}}]},2)).rejects.toThrow();
  await expect(world.apply({baseRevision:1,changes:[{id:'cube',props:{position:[NaN,0,0]}}]},2)).rejects.toThrow();
  await expect(world.apply({baseRevision:1,changes:[{id:'cube',props:{text:'unsafe'} as never}]},2)).rejects.toThrow();
  expect(world.revision).toBe(1);expect(await world.sample(2)).toEqual(original);
});

test('source cannot modify existing objects, claim duplicates or silently create interactive controls',async()=>{
  const world=new LiveWorld({clock:()=>0});worlds.push(world);await world.addProgram({id:'one',source:cube,baseRevision:0},0);
  await expect(world.addProgram({id:'duplicate',source:dot('cube'),baseRevision:1},0)).rejects.toThrow(/id|own|duplicate/i);
  await expect(world.addProgram({id:'mutate',source:`export default scene({},s=>{s.previous.get('cube');s.wait(1)});`,baseRevision:1},0)).rejects.toThrow();
  await expect(world.addProgram({id:'control',source:`export default scene({},s=>{s.slider('x',{default:1,min:0,max:2});s.circle('control-dot');s.wait(1)});`,baseRevision:1},0)).rejects.toThrow(/control/i);
  expect(world.revision).toBe(1);expect(world.summary().programs).toHaveLength(1);
});

test('preparation failure and stale concurrent add never publish candidate geometry',async()=>{
  const entered=deferred(),gate=deferred();let prepares=0;
  const world=new LiveWorld({clock:()=>0,prepare:async()=>{prepares++;if(prepares===1){entered.resolve();await gate.promise;}}});worlds.push(world);
  const first=world.addProgram({id:'one',source:dot('one'),baseRevision:0},0);const handled=first.catch(e=>e);await entered.promise;
  await world.addProgram({id:'two',source:dot('two'),baseRevision:0},0);gate.resolve();
  expect(await handled).toBeInstanceOf(Error);expect(world.revision).toBe(1);expect((await world.sample(0)).elements.map(e=>e.id)).toEqual(['two']);
  const failed=new LiveWorld({clock:()=>0,prepare:async()=>{throw new Error('prepare failed')}});worlds.push(failed);
  await expect(failed.addProgram({id:'bad',source:dot('bad'),baseRevision:0},0)).rejects.toThrow('prepare failed');
  expect(failed.revision).toBe(0);expect((await failed.sample(0)).elements).toHaveLength(0);expect(failed.summary().pendingPrograms).toBe(0);
});

test('remove filters future samples, releases fully removed programs, and reserves stable IDs',async()=>{
  let now=0;const world=new LiveWorld({clock:()=>now});worlds.push(world);await world.addProgram({id:'one',source:cube,baseRevision:0},0);
  now=2;await world.apply({baseRevision:1,changes:[],remove:['cube']},now);
  expect((await world.sample(3)).elements).toHaveLength(0);expect(world.summary().programs).toHaveLength(0);
  await expect(world.addProgram({id:'replacement',source:dot('cube'),baseRevision:2},2)).rejects.toThrow(/id|own|duplicate/i);
});

test('program/object/pending limits reject bounded work and disposal rejects future use',async()=>{
  const world=new LiveWorld({clock:()=>0,maxPrograms:1,maxObjects:1});worlds.push(world);
  await world.addProgram({id:'one',source:dot('one'),baseRevision:0},0);
  await expect(world.addProgram({id:'two',source:dot('two'),baseRevision:1},0)).rejects.toThrow(/limit/i);
  world.dispose();expect(world.summary().programs).toHaveLength(0);
  await expect(world.sample(0)).rejects.toThrow(/disposed/i);
  await expect(world.addProgram({id:'three',source:dot('three'),baseRevision:1},0)).rejects.toThrow(/disposed/i);
});

test('disposal during candidate preparation prevents publication',async()=>{
  const entered=deferred(),gate=deferred();const world=new LiveWorld({clock:()=>0,prepare:async()=>{entered.resolve();await gate.promise;}});worlds.push(world);
  const adding=world.addProgram({id:'one',source:dot('one'),baseRevision:0},0);const handled=adding.catch(e=>e);await entered.promise;
  world.dispose();gate.resolve();expect(await handled).toBeInstanceOf(Error);expect(world.revision).toBe(0);expect(world.summary().pendingPrograms).toBe(0);
});

test('rejects accessor/prototype input before executing accessors',async()=>{
  const world=new LiveWorld({clock:()=>0});worlds.push(world);let reads=0;
  const request={id:'one',source:dot('one'),get baseRevision(){reads++;return 0;}};
  await expect(world.addProgram(request,0)).rejects.toThrow(/unsafe/i);expect(reads).toBe(0);
  await expect(world.apply(JSON.parse('{"baseRevision":0,"changes":[],"__proto__":{}}'),0)).rejects.toThrow(/unsafe/i);
  expect(world.revision).toBe(0);
});

test('interrupts a host transition from its visible interpolated pose and retains deformation on color edit',async()=>{
  let now=0;const world=new LiveWorld({clock:()=>now});worlds.push(world);
  await world.addProgram({id:'cube',source:cube,baseRevision:0},0);
  await world.addProgram({id:'mesh',source:deform,baseRevision:1},0);
  now=2;await world.apply({baseRevision:2,changes:[{id:'cube',props:{position:[6,0,0]},duration:2}]},now);
  expect(element(await world.sample(3),'cube').position[0]).toBe(4);
  now=3;await world.apply({baseRevision:3,changes:[{id:'cube',props:{position:[10,0,0]},duration:3},{id:'custom',props:{fill:'RED'}}]},now);
  const frame=await world.sample(4);expect(element(frame,'cube').position[0]).toBe(6);
  expect(element(frame,'cube').rotation[1]).toBe(4);expect(element(frame,'custom').geometry.vertices?.[2][2]).toBeCloseTo(.4);
  await expect(world.apply({baseRevision:4,changes:[{id:'cube',props:{rotation:[0,8,0]},duration:1}]},4)).rejects.toThrow(/time-bound/i);
});

test('object and pending limits act independently of active program limits',async()=>{
  const limited=new LiveWorld({clock:()=>0,maxPrograms:4,maxObjects:1});worlds.push(limited);
  await limited.addProgram({id:'one',source:dot('one'),baseRevision:0},0);
  await expect(limited.addProgram({id:'two',source:dot('two'),baseRevision:1},0)).rejects.toThrow(/object limit/i);
  expect(limited.revision).toBe(1);
  const entered=deferred(),gate=deferred();const pending=new LiveWorld({clock:()=>0,maxPendingPrograms:1,prepare:async()=>{entered.resolve();await gate.promise;}});worlds.push(pending);
  const adding=pending.addProgram({id:'one',source:dot('one'),baseRevision:0},0);await entered.promise;
  await expect(pending.addProgram({id:'two',source:dot('two'),baseRevision:0},0)).rejects.toThrow(/pending limit/i);
  gate.resolve();await adding;expect(pending.revision).toBe(1);
});

test('group removal cascades to members and patch values cannot be changed after submission',async()=>{
  const world=new LiveWorld({clock:()=>0});worlds.push(world);
  await world.addProgram({id:'group',source:`export default scene({},s=>{const a=s.circle('a'),b=s.circle('b');s.group('group',[a,b]);s.wait(60)});`,baseRevision:0},0);
  const props={position:[1,0,0] as [number,number,number]};const patch=world.apply({baseRevision:1,changes:[{id:'a',props}]},0);props.position[0]=999;await patch;
  expect(element(await world.sample(0),'a').position[0]).toBe(1);
  await world.apply({baseRevision:2,changes:[],remove:['group']},0);
  expect((await world.sample(0)).elements).toHaveLength(0);expect(world.summary().programs).toHaveLength(0);
});

test('transition epoch and native timeline origin use publication time after validation work',async()=>{
  const ticks=[0,2,3,4];const world=new LiveWorld({clock:()=>ticks.shift()??4});worlds.push(world);
  await world.addProgram({id:'cube',source:cube,baseRevision:0},0);
  const commit=await world.apply({baseRevision:1,changes:[{id:'cube',props:{position:[8,0,0]},duration:2}]},2);
  expect(commit.originSampledAt).toBe(2);expect(commit.committedAt).toBe(4);
  expect(element(await world.sample(5),'cube').position[0]).toBe(6);
});

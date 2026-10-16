import {afterEach,expect,test} from 'bun:test';
import {LiveWorld} from './world.js';
import type {Frame} from '../../../shared/animlib/src/types.js';
Object.defineProperty(globalThis,'Worker',{configurable:true,writable:true,value:undefined});
const worlds:LiveWorld[]=[];
afterEach(()=>{for(const world of worlds.splice(0))world.dispose();});
const element=(frame:Frame,id='cube')=>frame.elements.find(e=>e.id===id)!;
const cube=`export default scene({mode:'3d',end:'hold'},s=>{
 const cube=s.box('cube',{position:[1,0,0]});
 const label=s.text('label',{text:'Cube'});s.attach(label,cube,{offset:[0,1,0]});
 s.bind(cube,[s.time],t=>({rotation:[0,t,0]}));s.wait(2);
});`;
const mesh=`export default scene({mode:'3d',end:'hold'},s=>{
 s.mesh('cube',{vertices:[[0,0,0],[1,0,0],[0,1,0],[0,0,1]],triangles:[[0,1,2],[0,2,3]],position:[1,0,0]});
 s.circle('new-point');s.wait(20);
});`;
async function setup(source=cube){let now=0;const world=new LiveWorld({clock:()=>now});worlds.push(world);await world.addProgram({id:'body',source,baseRevision:0},0);return {world,clock:(t:number)=>{now=t;}};}
function deferred(){let resolve!:()=>void;return {promise:new Promise<void>(r=>resolve=r),resolve:()=>resolve()};}

test('late motion starts at commit pose, changes without jumps, stops, restarts, and outlives source duration',async()=>{
 const {world,clock}=await setup();clock(100);
 expect(element(await world.sample(100)).position).toEqual([1,0,0]);
 await world.setMotion({baseRevision:1,changes:[{id:'cube',velocity:[2,0,0]}]},99,{beforeCommit:()=>clock(101)});
 expect(element(await world.sample(101)).position).toEqual([1,0,0]);
 expect(element(await world.sample(104)).position).toEqual([7,0,0]);
 expect(element(await world.sample(104),'label').position).toEqual([7,1,0]);
 expect(element(await world.sample(104)).rotation).toEqual([0,2,0]);
 clock(104);await world.setMotion({baseRevision:2,changes:[{id:'cube',velocity:[4,0,0]}]},104);
 expect(element(await world.sample(104)).position).toEqual([7,0,0]);
 clock(106);await world.setMotion({baseRevision:3,changes:[{id:'cube',velocity:[0,0,0]}]},106);
 expect(element(await world.sample(1000)).position).toEqual([15,0,0]);
 clock(1000);await world.setMotion({baseRevision:4,changes:[{id:'cube',velocity:[-1,0,0]}]},1000);
 expect(element(await world.sample(1002)).position).toEqual([13,0,0]);
 expect(world.summary().motions[0]).toEqual({id:'cube',origin:[15,0,0],velocity:[-1,0,0],start:1000});
});

test('position edits cancel motion; other edits preserve motion; removal clears motion',async()=>{
 const {world}=await setup();await world.setMotion({baseRevision:1,changes:[{id:'cube',velocity:[2,0,0]}]},5);
 await world.apply({baseRevision:2,changes:[{id:'cube',props:{fill:'RED'}}]},6);
 expect(element(await world.sample(7)).position).toEqual([5,0,0]);
 await world.apply({baseRevision:3,changes:[{id:'cube',props:{position:[20,0,0]},duration:2}]},7);
 expect(element(await world.sample(8)).position[0]).toBe(12.5);expect(world.summary().motions).toEqual([]);
 await world.setMotion({baseRevision:4,changes:[{id:'cube',velocity:[1,0,0]}]},10);
 await world.apply({baseRevision:5,changes:[],remove:['cube']},11);expect(world.summary().motions).toEqual([]);
});

test('motion rejects position ownership conflicts and invalid inputs atomically',async()=>{
 for(const declaration of ["s.bind(cube,[s.time],t=>({position:[t,0,0]}));","const p=s.slider('p',{reactive:true,default:1,min:0,max:2});s.bind(cube,[p],p=>({position:[p,0,0]}));"]){
  const {world}=await setup(`export default scene({},s=>{const cube=s.box('cube');${declaration}s.wait(2)});`);
  await expect(world.setMotion({baseRevision:1,changes:[{id:'cube',velocity:[1,0,0]}]},5)).rejects.toThrow(/owned|bound/i);expect(world.revision).toBe(1);
 }
 const {world}=await setup();
 await expect(world.setMotion({baseRevision:1,changes:[{id:'label',velocity:[1,0,0]}]},5)).rejects.toThrow(/owned/i);
 await expect(world.setMotion({baseRevision:1,changes:[{id:'cube',velocity:[1,0,0]},{id:'missing',velocity:[1,0,0]}]},5)).rejects.toThrow();
 expect(world.summary().motions).toEqual([]);
 await expect(world.setMotion({baseRevision:1,changes:[{id:'cube',velocity:[NaN,0,0]}]},5)).rejects.toThrow();
});

test('motion takes over native position tracks at actual commit without stopping unrelated tracks',async()=>{
 const {world,clock}=await setup(`export default scene({},s=>{const cube=s.box('cube');s.play([cube.moveTo([10,0,0]),cube.rotateTo([0,10,0])],{duration:10,ease:'linear'});s.wait(20)});`);
 clock(2);await world.setMotion({baseRevision:1,changes:[{id:'cube',velocity:[2,0,0]}]},2,{beforeCommit:()=>clock(4)});
 expect(element(await world.sample(4)).position).toEqual([4,0,0]);
 expect(element(await world.sample(5)).position).toEqual([6,0,0]);expect(element(await world.sample(5)).rotation[1]).toBe(5);
 const result=await world.setMotion({baseRevision:2,changes:[{id:'cube',velocity:[2,0,0]}]},5);
 expect(result.revision).toBe(2);expect(world.summary().motions[0].start).toBe(4);
});

test('replacement changes topology atomically while retaining epoch, host pose, motion and unrelated program',async()=>{
 const {world}=await setup();
 await world.addProgram({id:'other',source:`export default scene({},s=>{const b=s.box('other');s.bind(b,[s.time],t=>({rotation:[0,t,0]}));s.wait(200)});`,baseRevision:1},3);
 await world.apply({baseRevision:2,changes:[{id:'cube',props:{fill:'RED'}}]},4);
 await world.setMotion({baseRevision:3,changes:[{id:'cube',velocity:[2,0,0]}]},5);
 await world.replaceProgram({id:'body',source:mesh,baseRevision:4},10);
 const frame=await world.sample(11);expect(element(frame).geometry.triangles).toHaveLength(2);
 expect(element(frame).position).toEqual([13,0,0]);expect(element(frame).fill).toBe('RED');
 expect(element(frame,'other').rotation[1]).toBe(8);expect(world.summary().programs[0].epoch).toBe(0);
 expect(world.programSource('body')).toBe(mesh);expect(world.summary().entityIds).not.toContain('label');
 await expect(world.addProgram({id:'reuse',source:`export default scene({},s=>{s.circle('label');s.wait(1)});`,baseRevision:5},12)).rejects.toThrow(/owned/);
});

test('invalid, foreign-ID, tombstone-ID and conflicting replacement leave live scene untouched',async()=>{
 const {world}=await setup();await world.addProgram({id:'foreign',source:`export default scene({},s=>{s.box('foreign');s.wait(1)});`,baseRevision:1},1);
 await world.apply({baseRevision:2,changes:[],remove:['label']},2);
 await world.setMotion({baseRevision:3,changes:[{id:'cube',velocity:[1,0,0]}]},3);
 const before=await world.sample(4),summary=world.summary();
 for(const source of ['invalid source',cube,mesh.replace('new-point','foreign'),`export default scene({},s=>{const b=s.box('cube');s.bind(b,[s.time],t=>({position:[t,0,0]}));s.wait(20)});`]){
  await expect(world.replaceProgram({id:'body',source,baseRevision:4},4)).rejects.toThrow();
  expect(await world.sample(4)).toEqual(before);expect(world.summary()).toEqual(summary);
 }
 await expect(world.replaceProgram({id:'body',source:mesh,baseRevision:3},4)).rejects.toThrow(/stale/i);
});

test('replacement preparation cancellation and racing publication leave old program usable',async()=>{
 let block=false;const gate=deferred(),entered=deferred();const world=new LiveWorld({clock:()=>0,prepare:async()=>{if(block){entered.resolve();await gate.promise;}}});worlds.push(world);
 await world.addProgram({id:'body',source:cube,baseRevision:0},0);block=true;const controller=new AbortController();
 const pending=world.replaceProgram({id:'body',source:mesh,baseRevision:1},5,{signal:controller.signal});const rejected=pending.catch(e=>e);
 await entered.promise;expect(element(await world.sample(1)).rotation[1]).toBe(1);controller.abort(new Error('corrected'));
 expect((await rejected).message).toBe('corrected');expect(world.revision).toBe(1);expect(world.programSource('body')).toBe(cube);
 gate.resolve();expect(world.summary().pendingPrograms).toBe(0);
});

test('replacement preserves common slider values and rejects narrowing bounds',async()=>{
 const source=(max=4)=>`export default scene({},s=>{const k=s.slider('k',{reactive:true,default:1,min:0,max:${max}});const b=s.sphere('cube');s.bind(b,[k],k=>({radius:k}));s.wait(20)});`;
 const {world}=await setup(source());await world.setParameters({baseRevision:1,programId:'body',values:{k:3}},1);
 await world.replaceProgram({id:'body',source:source()+'\n',baseRevision:2},2);
 expect(element(await world.sample(3)).geometry.radius).toBe(3);expect(world.summary().programs[0].parameters[0].value).toBe(3);
 await expect(world.replaceProgram({id:'body',source:source(2),baseRevision:3},3)).rejects.toThrow(/range|bounds/i);
 expect(element(await world.sample(3)).geometry.radius).toBe(3);
});

test('motion and replacement reject cancellation, async guards, disposal and reentrant revision changes before publication',async()=>{
 for(const operation of ['motion','replace'])for(const guard of ['abort','async','stale','dispose']){
  const {world}=await setup(),controller=new AbortController();
  const options={signal:controller.signal,beforeCommit:()=>{
   if(guard==='abort')controller.abort(new Error('cancelled'));
   if(guard==='async')return Promise.resolve();
   if(guard==='stale')(world as unknown as {version:number}).version++;
   if(guard==='dispose')world.dispose();
  }};
  const action=operation==='motion'?world.setMotion({baseRevision:1,changes:[{id:'cube',velocity:[1,0,0]}]},4,options):world.replaceProgram({id:'body',source:mesh,baseRevision:1},4,options);
  await expect(action).rejects.toThrow(guard==='abort'?'cancelled':guard==='async'?/synchronous/:guard==='stale'?/Stale/:/disposed/);
  expect(world.summary().motions).toEqual([]);expect(world.revision).toBe(guard==='stale'?2:1);
  if(guard!=='dispose'){expect(world.programSource('body')).toBe(cube);expect(element(await world.sample(1)).rotation[1]).toBe(1);}
 }
});

test('a competing commit cancels staged replacement without resetting the winning pose',async()=>{
 let block=false;const gate=deferred(),entered=deferred();const world=new LiveWorld({clock:()=>0,prepare:async()=>{if(block){entered.resolve();await gate.promise;}}});worlds.push(world);
 await world.addProgram({id:'body',source:cube,baseRevision:0},0);block=true;
 const pending=world.replaceProgram({id:'body',source:mesh,baseRevision:1},2);const rejected=pending.catch(e=>e);
 await entered.promise;await world.setMotion({baseRevision:1,changes:[{id:'cube',velocity:[3,0,0]}]},2);
 expect((await rejected).message).toMatch(/Stale/);gate.resolve();expect(world.programSource('body')).toBe(cube);
 expect(element(await world.sample(4)).position).toEqual([7,0,0]);expect(world.revision).toBe(2);
});

test('replacement consumes only new lifetime IDs and cannot silently invalidate host geometry overrides',async()=>{
 const world=new LiveWorld({clock:()=>0,maxObjects:2,maxPrograms:1});worlds.push(world);
 const triangle=`export default scene({},s=>{s.mesh('cube',{vertices:[[0,0,0],[1,0,0],[0,1,0]],triangles:[[0,1,2]]});s.wait(20)});`;
 await world.addProgram({id:'body',source:triangle,baseRevision:0},0);
 await world.apply({baseRevision:1,changes:[{id:'cube',props:{vertices:[[0,0,0],[2,0,0],[0,2,0]]}}]},1);
 await world.replaceProgram({id:'body',source:triangle+'\n',baseRevision:2},2);
 expect(world.summary().reservedIdCount).toBe(1);expect(element(await world.sample(3)).geometry.vertices?.[1]).toEqual([2,0,0]);
 await expect(world.replaceProgram({id:'body',source:mesh,baseRevision:3},3)).rejects.toThrow();
 expect(element(await world.sample(3)).geometry.vertices?.[1]).toEqual([2,0,0]);expect(world.summary().reservedIdCount).toBe(1);
});

test('replacement validates time-only callbacks at retained time after resource preparation',async()=>{
 for(const delayedPrepare of [false,true]){
  let now=0,delay=false;const world=new LiveWorld({clock:()=>now,prepare:async()=>{if(delay)now=10;}});worlds.push(world);
  const original=`export default scene({},s=>{s.box('cube');s.wait(20)});`;
  await world.addProgram({id:'body',source:original,baseRevision:0},0);now=delayedPrepare?1:10;delay=delayedPrepare;
  const source=`export default scene({},s=>{const b=s.box('cube');s.bind(b,[s.time],t=>{if(t>2)throw new Error('bad retained time');return {rotation:[0,t,0]}});s.wait(20)});`;
  await expect(world.replaceProgram({id:'body',source,baseRevision:1},now)).rejects.toThrow('bad retained time');
  expect(world.revision).toBe(1);expect(world.programSource('body')).toBe(original);expect(element(await world.sample(10)).rotation).toEqual([0,0,0]);
 }
});

test('replacement rejects reactive normals conflicting with implicit host vertex ownership',async()=>{
 const source=(binding='')=>`export default scene({},s=>{const b=s.mesh('cube',{vertices:[[0,0,0],[1,0,0],[0,1,0]],triangles:[[0,1,2]]});${binding}s.wait(20)});`;
 const {world}=await setup(source());await world.apply({baseRevision:1,changes:[{id:'cube',props:{vertices:[[0,0,0],[2,0,0],[0,2,0]]}}]},1);
 await expect(world.replaceProgram({id:'body',baseRevision:2,source:source(`s.bind(b,[s.time],t=>({normals:[[0,0,1],[0,0,1],[0,0,1]]}));`)},2)).rejects.toThrow(/owned/);
 expect(world.revision).toBe(2);expect(element(await world.sample(3)).geometry.vertices?.[1]).toEqual([2,0,0]);
});

test('replacement callback preflight follows first publication guard and reports sampled timestamp',async()=>{
 const {world,clock}=await setup();clock(1);let guards=0;
 const source=`export default scene({},s=>{const b=s.box('cube');s.bind(b,[s.time],t=>{if(t>2)throw new Error('guard advanced clock');return {rotation:[0,t,0]}});s.wait(20)});`;
 await expect(world.replaceProgram({id:'body',source,baseRevision:1},1,{beforeCommit:()=>{guards++;clock(10);}})).rejects.toThrow('guard advanced clock');
 expect(guards).toBe(1);expect(world.revision).toBe(1);
 const result=await world.replaceProgram({id:'body',source:mesh,baseRevision:1},10);
 expect(result.originSampledAt).toBe(10);expect(result.committedAt).toBe(10);
});

test('replacement rejects future morph ownership conflicting with retained geometry overrides',async()=>{
 const source=(tail='')=>`export default scene({},s=>{const b=s.mesh('cube',{vertices:[[0,0,0],[1,0,0],[0,1,0]],triangles:[[0,1,2]]});${tail}s.wait(20)});`;
 const {world}=await setup(source());await world.apply({baseRevision:1,changes:[{id:'cube',props:{vertices:[[0,0,0],[2,0,0],[0,2,0]]}}]},1);
 const morph=`s.wait(10);s.play(b.morphTo({kind:'mesh',vertices:[[0,0,0],[1,0,0],[0,1,0],[0,0,1]],triangles:[[0,1,2],[0,2,3]]}),{duration:1});`;
 await expect(world.replaceProgram({id:'body',baseRevision:2,source:source(morph)},2)).rejects.toThrow(/morph/i);
 expect(world.revision).toBe(2);expect(element(await world.sample(12)).geometry.vertices).toHaveLength(3);
 expect(element(await world.sample(12)).geometry.triangles).toEqual([[0,1,2]]);
});

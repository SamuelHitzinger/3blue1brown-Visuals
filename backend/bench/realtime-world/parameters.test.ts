import {afterEach,expect,spyOn,test} from 'bun:test';
import {LiveWorld,type WorldPatch} from './world.js';
import {SourceCompiler} from '../../../shared/animlib/src/compiler-client.js';
import type {Frame} from '../../../shared/animlib/src/types.js';

Object.defineProperty(globalThis,'Worker',{configurable:true,writable:true,value:undefined});
const worlds:LiveWorld[]=[];
afterEach(()=>{for(const world of worlds.splice(0))world.dispose();});
const element=(frame:Frame,id:string)=>{const found=frame.elements.find(e=>e.id===id);expect(found).toBeDefined();return found!;};
function deferred(){let resolve!:()=>void;return {promise:new Promise<void>(r=>{resolve=r;}),resolve:()=>resolve()};}
const source=(prefix='',timed=true)=>`export default scene({mode:'3d',end:'hold'},s=>{
  const k=s.slider('k',{reactive:true,label:'Coefficient',default:1,min:.1,max:4,step:.1});
  const b=s.slider('b',{reactive:true,default:0,min:-2,max:2});
  const curve=s.line3D('${prefix}curve',{points:[[0,0,0],[1,1,0]]});
  s.bind(curve,[k,b],(k,b)=>({points:[[0,b,0],[1,k+b,0]]}));
  const ball=s.sphere('${prefix}ball',{radius:1});s.bind(ball,[k,b],(k,b)=>({radius:k+b}));
  const body=s.box('${prefix}body');
  ${timed?`s.bind(body,[s.time],t=>({rotation:[0,t,0]}));`:''}
  const surface=s.mesh('${prefix}surface',{vertices:[[0,0,0],[1,0,0],[0,1,0]],triangles:[[0,1,2]],normals:[[0,0,1],[0,0,1],[0,0,1]],shading:'smooth'});
  s.bind(surface,[k${timed?',s.time':''}],(k${timed?',t':''})=>({vertices:[[0,0,0],[1,0,0],[0,1,k${timed?'*t':''}]]}));
  s.wait(10);
});`;
async function setup(timed=true){const world=new LiveWorld({clock:()=>0});worlds.push(world);await world.addProgram({id:'plot',source:source('',timed),baseRevision:0},0);return world;}

test('updates retained curve and surface parameters without rebuilding or restarting motion',async()=>{
  const world=await setup();await world.apply({baseRevision:1,changes:[{id:'body',props:{position:[8,0,0]},duration:8}]},0);
  const camera=(await world.sample(2)).camera,compile=spyOn(SourceCompiler.prototype,'compile');
  try{
    const result=await world.setParameters({baseRevision:2,programId:'plot',values:{k:2,b:.5}},3);
    expect(result).toEqual({revision:3,committedAt:3,originSampledAt:3});expect(compile).not.toHaveBeenCalled();
    const frame=await world.sample(4);
    expect(element(frame,'curve').geometry.points).toEqual([[0,.5,0],[1,2.5,0]]);
    expect(element(frame,'ball').geometry.radius).toBe(2.5);expect(element(frame,'surface').geometry.vertices?.[2]).toEqual([0,1,8]);
    expect(element(frame,'surface').geometry.normals).toBeUndefined();expect(element(frame,'body').rotation[1]).toBe(4);
    expect(element(frame,'body').position[0]).toBe(4);expect(frame.camera).toEqual(camera);expect(world.modelInventoryRevision).toBe(0);
    expect(world.summary().programs[0].epoch).toBe(0);
    expect(world.summary().programs[0].parameters).toEqual([
      {id:'k',label:'Coefficient',default:1,value:2,min:.1,max:4,step:.1,dependents:[{target:'curve',properties:['points']},{target:'ball',properties:['radius']},{target:'surface',properties:['vertices','normals']}]},
      {id:'b',label:'b',default:0,value:.5,min:-2,max:2,step:undefined,dependents:[{target:'curve',properties:['points']},{target:'ball',properties:['radius']}]},
    ]);
    const copy=world.summary();copy.programs[0].parameters[0].value=99;copy.programs[0].parameters[0].dependents[0].properties.length=0;
    expect(world.summary().programs[0].parameters[0].value).toBe(2);expect(world.summary().programs[0].parameters[0].dependents[0].properties).toEqual(['points']);
  }finally{compile.mockRestore();}
});

test('retains non-time binding snapshots and supplies unchanged dependency values',async()=>{
  const world=await setup(false);await world.setParameters({baseRevision:1,programId:'plot',values:{b:.5}},2);
  await world.setParameters({baseRevision:2,programId:'plot',values:{k:2}},3);
  for(const t of [0,4,20])expect(element(await world.sample(t),'curve').geometry.points).toEqual([[0,.5,0],[1,2.5,0]]);
});

test('rejects unsupported or unused controls at admission',async()=>{
  for(const declaration of ["s.slider('unused',{reactive:true,default:1,min:0,max:2})","s.slider('ordinary',{default:1,min:0,max:2})","s.toggle('toggle',{default:true})"]){
    const world=new LiveWorld({clock:()=>0});worlds.push(world);
    await expect(world.addProgram({id:'invalid',source:`export default scene({},s=>{${declaration};s.sphere('ball');s.wait(1);});`,baseRevision:0},0)).rejects.toThrow(/parameter|reactive|unused/i);
    expect(world.revision).toBe(0);
  }
});

test('rejects unknown, unsafe, nonfinite and out-of-range input before callbacks',async()=>{
  const world=await setup(false),update=spyOn(SourceCompiler.prototype,'update');
  try{
    const invalid:Record<string,number>[]=[{k:99},{k:0},{k:NaN},{unknown:1},{k:2,b:-99},{}];
    for(const values of invalid){
      await expect(world.setParameters({baseRevision:1,programId:'plot',values},2)).rejects.toThrow();
    }
    let reads=0;const values={get k(){reads++;return 2;}};
    await expect(world.setParameters({baseRevision:1,programId:'plot',values},2)).rejects.toThrow(/unsafe/i);expect(reads).toBe(0);
    await expect(world.setParameters({baseRevision:1,programId:'missing',values:{k:2}},2)).rejects.toThrow(/program/i);
    expect(update).not.toHaveBeenCalled();expect(world.revision).toBe(1);
    await world.setParameters({baseRevision:1,programId:'plot',values:{k:1.234}},2);
    expect(element(await world.sample(2),'ball').geometry.radius).toBe(1.234);
  }finally{update.mockRestore();}
});

test('a later invalid callback publishes neither earlier valid geometry nor parameter values',async()=>{
  const world=await setup(false),before=await world.sample(2),summary=world.summary();
  await expect(world.setParameters({baseRevision:1,programId:'plot',values:{k:.2,b:-2}},2)).rejects.toThrow(/radius/i);
  expect(world.summary()).toEqual(summary);expect(await world.sample(2)).toEqual(before);
  await world.setParameters({baseRevision:1,programId:'plot',values:{k:2}},3);expect(element(await world.sample(3),'ball').geometry.radius).toBe(2);
});

test('unchanged values invoke guards but no callbacks or revision bump',async()=>{
  const world=await setup(),update=spyOn(SourceCompiler.prototype,'update');let guards=0;
  try{
    expect(await world.setParameters({baseRevision:1,programId:'plot',values:{k:1,b:0}},2,{beforeCommit:()=>{guards++;}})).toEqual({revision:1,committedAt:2});
    expect(guards).toBe(1);expect(update).not.toHaveBeenCalled();expect(world.revision).toBe(1);
    await expect(world.setParameters({baseRevision:0,programId:'plot',values:{k:1}},2)).rejects.toThrow(/stale/i);
    await expect(world.setParameters({baseRevision:1,programId:'plot',values:{k:1}},2,{beforeCommit:()=>{throw new Error('expired');}})).rejects.toThrow('expired');
  }finally{update.mockRestore();}
});

test('parameter-owned properties reject direct host overrides including generated normals',async()=>{
  const world=await setup();
  const changes:WorldPatch['changes']=[{id:'curve',props:{points:[[0,0,0],[1,3,0]]}},{id:'ball',props:{radius:3}},{id:'surface',props:{normals:[[0,0,1],[0,0,1],[0,0,1]]}}];
  for(const change of changes){
    await expect(world.apply({baseRevision:1,changes:[change]},2)).rejects.toThrow(/parameter.owned/i);
  }
  await world.apply({baseRevision:1,changes:[{id:'body',props:{rotation:[0,9,0]}}]},2);
  expect(element(await world.sample(3),'body').rotation[1]).toBe(9); // Existing time-only set semantics.
  await world.apply({baseRevision:2,changes:[],remove:['curve']},3);
  await expect(world.setParameters({baseRevision:3,programId:'plot',values:{k:2}},4)).rejects.toThrow(/removed/i);
  expect(world.revision).toBe(3);
});

test('clones requests and permits only one outstanding evaluation for a program',async()=>{
  const world=await setup(false),entered=deferred(),gate=deferred(),original=SourceCompiler.prototype.update;
  const spy=spyOn(SourceCompiler.prototype,'update').mockImplementation(async function(this:SourceCompiler,...args:Parameters<typeof original>){entered.resolve();await gate.promise;return original.apply(this,args);});
  try{
    const request={baseRevision:1,programId:'plot',values:{k:2}},pending=world.setParameters(request,2);await entered.promise;
    request.values.k=3;request.programId='bad';await expect(world.setParameters({baseRevision:1,programId:'plot',values:{b:1}},2)).rejects.toThrow(/pending|busy/i);
    expect(element(await world.sample(2),'ball').geometry.radius).toBe(1);
    gate.resolve();await pending;expect(element(await world.sample(3),'ball').geometry.radius).toBe(2);
  }finally{gate.resolve();spy.mockRestore();}
});

test('cancelled evaluation retains its reader until completion, even after world disposal',async()=>{
  const world=await setup(false),entered=deferred(),gate=deferred(),finished=deferred(),original=SourceCompiler.prototype.update,controller=new AbortController();
  let compiler:SourceCompiler|undefined;
  const spy=spyOn(SourceCompiler.prototype,'update').mockImplementation(async function(this:SourceCompiler,...args:Parameters<typeof original>){compiler=this;entered.resolve();await gate.promise;try{return await original.apply(this,args);}finally{finished.resolve();}});
  const dispose=spyOn(SourceCompiler.prototype,'dispose');
  try{
    const rejected=world.setParameters({baseRevision:1,programId:'plot',values:{k:2}},2,{signal:controller.signal}).catch(error=>error);
    await entered.promise;controller.abort(new Error('corrected'));expect(await rejected).toMatchObject({message:'corrected'});
    expect(world.revision).toBe(1);expect(element(await world.sample(2),'ball').geometry.radius).toBe(1);
    await expect(world.setParameters({baseRevision:1,programId:'plot',values:{k:2}},2)).rejects.toThrow(/pending|busy/i);
    world.dispose();expect(dispose).not.toHaveBeenCalled();gate.resolve();await finished.promise;await Promise.resolve();
    expect(dispose).toHaveBeenCalledTimes(1);expect(compiler).toBeDefined();expect(world.revision).toBe(1);
  }finally{gate.resolve();spy.mockRestore();dispose.mockRestore();}
});

test('publication guard cancellation, thenables and disposal publish no parameters',async()=>{
  for(const kind of ['abort','async','dispose'])for(const value of [1,2]){
    const world=await setup(false),controller=new AbortController();let calls=0;
    await expect(world.setParameters({baseRevision:1,programId:'plot',values:{k:value}},2,{signal:controller.signal,beforeCommit:()=>{
      calls++;if(kind==='abort')controller.abort(new Error('expired'));
      if(kind==='async')return Promise.resolve();if(kind==='dispose')world.dispose();
    }})).rejects.toThrow(kind==='abort'?/expired/:kind==='async'?/synchronous/:/disposed/);
    expect(calls).toBe(1);expect(world.revision).toBe(1);
    if(kind!=='dispose')expect(element(await world.sample(2),'ball').geometry.radius).toBe(1);
  }
});

test('a concurrent world edit makes staging stale without discarding that edit',async()=>{
  const world=await setup(false),entered=deferred(),gate=deferred(),original=SourceCompiler.prototype.update;
  const spy=spyOn(SourceCompiler.prototype,'update').mockImplementation(async function(this:SourceCompiler,...args:Parameters<typeof original>){entered.resolve();await gate.promise;return original.apply(this,args);});
  try{
    const rejected=world.setParameters({baseRevision:1,programId:'plot',values:{k:2}},2).catch(error=>error);await entered.promise;
    await world.apply({baseRevision:1,changes:[{id:'body',props:{fill:'RED'}}]},2);gate.resolve();expect(await rejected).toMatchObject({message:'Stale world revision'});
    const frame=await world.sample(3);expect(element(frame,'body').fill).toBe('RED');expect(element(frame,'ball').geometry.radius).toBe(1);
  }finally{gate.resolve();spy.mockRestore();}
});

test('a pending terminal sample cannot cache old parameter geometry after publication',async()=>{
  const world=await setup(),entered=deferred(),gate=deferred(),original=SourceCompiler.prototype.update;let held=true;
  const spy=spyOn(SourceCompiler.prototype,'update').mockImplementation(async function(this:SourceCompiler,...args:Parameters<typeof original>){
    const result=await original.apply(this,args);if(held&&args[2].length===0){held=false;entered.resolve();await gate.promise;}return result;
  });
  try{
    const pending=world.sample(20);await entered.promise;await world.setParameters({baseRevision:1,programId:'plot',values:{k:2}},20);
    gate.resolve();expect(element(await pending,'surface').geometry.vertices?.[2][2]).toBe(20);
    expect(element(await world.sample(30),'surface').geometry.vertices?.[2][2]).toBe(20);
    expect(element(await world.sample(4),'surface').geometry.vertices?.[2][2]).toBe(8);
  }finally{gate.resolve();spy.mockRestore();}
});

test('bounds global evaluations and rejects a competing stale commit without losing the winner',async()=>{
  const world=await setup(false);
  await world.addProgram({id:'second',source:source('second-',false),baseRevision:1},0);
  await world.addProgram({id:'third',source:source('third-',false),baseRevision:2},0);
  const entered=deferred(),gate=deferred(),original=SourceCompiler.prototype.update;let calls=0;
  const spy=spyOn(SourceCompiler.prototype,'update').mockImplementation(async function(this:SourceCompiler,...args:Parameters<typeof original>){if(++calls===2)entered.resolve();await gate.promise;return original.apply(this,args);});
  try{
    const a=world.setParameters({baseRevision:3,programId:'plot',values:{k:2}},2).then(value=>({value,error:null}),error=>({value:null,error}));
    const b=world.setParameters({baseRevision:3,programId:'second',values:{k:3}},2).then(value=>({value,error:null}),error=>({value:null,error}));
    await entered.promise;await expect(world.setParameters({baseRevision:3,programId:'third',values:{k:4}},2)).rejects.toThrow(/pending.*limit/i);expect(calls).toBe(2);
    gate.resolve();const outcomes=await Promise.all([a,b]);expect(outcomes.filter(outcome=>outcome.value)).toHaveLength(1);
    expect(outcomes.filter(outcome=>outcome.error?.message==='Stale world revision')).toHaveLength(1);expect(world.revision).toBe(4);
    const winner=outcomes[0].value?'plot':'second';
    expect(world.summary().programs.find(program=>program.id===winner)?.parameters[0].value).toBe(winner==='plot'?2:3);
    await world.setParameters({baseRevision:4,programId:'third',values:{k:4}},3);
    expect(element(await world.sample(3),'third-ball').geometry.radius).toBe(4);
  }finally{gate.resolve();spy.mockRestore();}
});

test('parameter publication cancels stale program preparation and preserves original runtime identity',async()=>{
  const entered=deferred(),gate=deferred();
  const world=new LiveWorld({clock:()=>0,prepare:async scene=>{if([...scene.initial,...scene.lifecycle.flatMap(event=>event.elements??[])].some(e=>e.id==='pending')){entered.resolve();await gate.promise;}}});worlds.push(world);
  await world.addProgram({id:'plot',source:source('',false),baseRevision:0},0);
  const adding=world.addProgram({id:'new',source:"export default scene({},s=>{s.sphere('pending');s.wait(10);});",baseRevision:1},1).catch(error=>error);
  await entered.promise;await world.setParameters({baseRevision:1,programId:'plot',values:{k:2}},2);
  expect(await adding).toMatchObject({message:'Stale world revision'});gate.resolve();
  expect(world.summary().pendingPrograms).toBe(0);expect(world.summary().entityIds).not.toContain('pending');
  await world.setParameters({baseRevision:2,programId:'plot',values:{k:3}},3);
  expect(element(await world.sample(4),'ball').geometry.radius).toBe(3);expect(world.summary().programs[0].epoch).toBe(0);
});

test('a failed old terminal result cannot evict the new terminal cache',async()=>{
  const world=await setup(),entered=deferred(),gate=deferred(),original=SourceCompiler.prototype.update;let failOld=true,newTerminalCalls=0;
  const spy=spyOn(SourceCompiler.prototype,'update').mockImplementation(async function(this:SourceCompiler,...args:Parameters<typeof original>){
    if(args[2].length===0&&args[4]===10){
      if(failOld){failOld=false;entered.resolve();await gate.promise;throw new Error('old sample failed');}
      newTerminalCalls++;
    }
    return original.apply(this,args);
  });
  try{
    const old=world.sample(20);await entered.promise;await world.setParameters({baseRevision:1,programId:'plot',values:{k:2}},20);
    expect(element(await world.sample(20),'surface').geometry.vertices?.[2][2]).toBe(20);expect(newTerminalCalls).toBe(1);
    gate.resolve();expect(element(await old,'surface').geometry.vertices?.[2][2]).toBe(20);
    expect(element(await world.sample(30),'surface').geometry.vertices?.[2][2]).toBe(20);expect(newTerminalCalls).toBe(1);
  }finally{gate.resolve();spy.mockRestore();}
});

test('pre-aborted requests skip evaluation and guards, and reentrant guards cannot publish',async()=>{
  const world=await setup(false),update=spyOn(SourceCompiler.prototype,'update'),controller=new AbortController();let guards=0;
  try{
    controller.abort(new Error('already cancelled'));
    await expect(world.setParameters({baseRevision:1,programId:'plot',values:{k:2}},2,{signal:controller.signal,beforeCommit:()=>{guards++;}})).rejects.toThrow('already cancelled');
    expect(guards).toBe(0);expect(update).not.toHaveBeenCalled();
    await expect(world.setParameters({baseRevision:1,programId:'plot',values:{k:2}},2,{beforeCommit:()=>{
      // Same trusted-host reentrancy simulation as the add/apply publication tests.
      (world as unknown as {version:number}).version++;
    }})).rejects.toThrow(/stale/i);
    expect(element(await world.sample(3),'ball').geometry.radius).toBe(1);
  }finally{update.mockRestore();}
});

test('control IDs must be safe stable host-addressable names',async()=>{
  for(const name of ['constructor','prototype','__proto__','bad name','x'.repeat(129)]){
    const world=new LiveWorld({clock:()=>0});worlds.push(world);
    const invalid=source('',false).replaceAll("'k'",JSON.stringify(name));
    await expect(world.addProgram({id:'plot',source:invalid,baseRevision:0},0)).rejects.toThrow(/ID|unsafe/i);expect(world.revision).toBe(0);
  }
});

test('parameter batches reject more than 32 keys before evaluation',async()=>{
  const world=new LiveWorld({clock:()=>0});worlds.push(world);
  await world.addProgram({id:'many',source:`export default scene({},s=>{
    const knobs=Array.from({length:33},(_,i)=>s.slider('p'+i,{reactive:true,default:1,min:0,max:4}));
    const ball=s.sphere('ball');s.bind(ball,knobs,(...values)=>({radius:values.reduce((a,b)=>a+b,0)}));s.wait(10);
  });`,baseRevision:0},0);
  const update=spyOn(SourceCompiler.prototype,'update');
  try{
    await expect(world.setParameters({baseRevision:1,programId:'many',values:Object.fromEntries(Array.from({length:33},(_,i)=>['p'+i,2]))},2)).rejects.toThrow(/limit/i);
    expect(update).not.toHaveBeenCalled();expect(element(await world.sample(2),'ball').geometry.radius).toBe(33);
    await world.setParameters({baseRevision:1,programId:'many',values:Object.fromEntries(Array.from({length:32},(_,i)=>['p'+i,2]))},2);
    expect(element(await world.sample(2),'ball').geometry.radius).toBe(65);
  }finally{update.mockRestore();}
});

test('procedural appearance updates need no new resource preparation',async()=>{
  let preparations=0;const world=new LiveWorld({clock:()=>0,prepare:async()=>{preparations++;}});worlds.push(world);
  await world.addProgram({id:'appearance',source:`export default scene({mode:'3d'},s=>{
    const k=s.slider('k',{reactive:true,default:1,min:1,max:4});const ball=s.sphere('ball');
    s.bind(ball,[k],k=>({texture:{pattern:'stripes',color:'BLUE',scale:k},material:{roughness:k/4}}));s.wait(10);
  });`,baseRevision:0},0);
  await world.setParameters({baseRevision:1,programId:'appearance',values:{k:2}},2);
  const ball=element(await world.sample(3),'ball');expect(ball.geometry.texture).toEqual({pattern:'stripes',color:'BLUE',scale:2});
  expect(ball.geometry.material).toEqual({roughness:.5});expect(preparations).toBe(1);
});

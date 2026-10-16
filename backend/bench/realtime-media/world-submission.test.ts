import {expect,test} from 'bun:test';
import {commitLectureSubmission} from './world-submission.js';
import {CommittedContextJournal} from './committed-context.js';
import {LiveWorld} from '../realtime-world/world.js';

test('motion and replacement dispatch preserve transaction guards and exact journal history',async()=>{
  const calls:unknown[]=[],options={signal:new AbortController().signal,beforeCommit:()=>{}};
  const world={setMotion:async(...args:unknown[])=>{calls.push(args);return {revision:2,committedAt:100};},
    replaceProgram:async(...args:unknown[])=>{calls.push(args);return {revision:3,committedAt:101};}} as unknown as LiveWorld;
  const motion=await commitLectureSubmission(world,{action:'motion',motionChanges:[{id:'cube',velocity:[2,0,0]}]},1,'unused',100,options);
  const replace=await commitLectureSubmission(world,{action:'replace',replacementProgramId:'body',source:'native-source'},2,'unused',101,options);
  expect(calls).toEqual([[{baseRevision:1,changes:[{id:'cube',velocity:[2,0,0]}]},100,options],
    [{id:'body',source:'native-source',baseRevision:2},101,options]]);
  const journal=new CommittedContextJournal();
  for(const result of [motion,replace])journal.record({revision:result.commit.revision,runId:'r',planId:'p'+result.commit.revision,
    committedAtMs:result.commit.committedAt*1000,evidence:{changes:[],context:[]},operation:result.operation});
  expect(journal.snapshot(10000).records.map(r=>r.operation)).toEqual([
    {action:'motion',patch:{baseRevision:1,changes:[{id:'cube',velocity:[2,0,0]}]}},
    {action:'replace',programId:'body',source:'native-source'}]);
});

test('parameter dispatch preserves revision, deadline guard and exact journal payload',async()=>{
  const calls:unknown[]=[],options={signal:new AbortController().signal,beforeCommit:()=>{}};
  const world={setParameters:async(...args:unknown[])=>{calls.push(args);return {revision:3,committedAt:10};}} as unknown as LiveWorld;
  const result=await commitLectureSubmission(world,{action:'parameters',parameterProgramId:'p',parameterValues:[{id:'slope',value:2}]},2,'unused',9,options);
  expect(calls).toEqual([[{baseRevision:2,programId:'p',values:{slope:2}},9,options]]);
  expect(result.changed).toBe(true);
  const journal=new CommittedContextJournal();
  journal.record({revision:3,runId:'r',planId:'plan',committedAtMs:10000,evidence:{changes:[],context:[]},operation:result.operation});
  expect(journal.snapshot(10000).records[0].operation).toEqual({action:'parameters',patch:{baseRevision:2,programId:'p',values:{slope:2}}});
});

test('unchanged parameters are not a new committed revision; duplicate updates never reach world',async()=>{
  let calls=0;
  const world={setParameters:async()=>{calls++;return {revision:2,committedAt:10};}} as unknown as LiveWorld;
  expect((await commitLectureSubmission(world,{action:'parameters',parameterProgramId:'p',parameterValues:[{id:'slope',value:2}]},2,'unused',9)).changed).toBe(false);
  await expect(commitLectureSubmission(world,{action:'parameters',parameterProgramId:'p',parameterValues:[{id:'slope',value:2},{id:'slope',value:3}]},2,'unused',9)).rejects.toThrow('duplicate');
  expect(calls).toBe(1);
});

test('rejected transaction produces no operation result for journal publication',async()=>{
  const world={setParameters:async()=>{throw Error('Original deadline expired');}} as unknown as LiveWorld;
  await expect(commitLectureSubmission(world,{action:'parameters',parameterProgramId:'p',parameterValues:[{id:'slope',value:2}]},2,'unused',9)).rejects.toThrow('deadline');
});

test('accepted tool parameter action changes retained native geometry through browser dispatcher',async()=>{
  const {validateSubmission}=await import('../realtime-tool-probe.js');
  const previous=Object.getOwnPropertyDescriptor(globalThis,'Worker');
  Object.defineProperty(globalThis,'Worker',{configurable:true,writable:true,value:undefined});
  const world=new LiveWorld({clock:()=>0});
  try{
    await commitLectureSubmission(world,{action:'add',source:`export default scene({},s=>{
      const k=s.slider('slope',{reactive:true,min:0,max:3,default:1});
      const line=s.line('line',{points:[[0,0],[1,1]]});
      s.bind(line,[k],v=>({points:[[0,0],[1,v]]}));s.wait(8);
    });`},0,'construction',0);
    const submission=validateSubmission('world',{action:'parameters',reason:'',source:'',changes:[],remove:[],
      parameterProgramId:'construction',parameterValues:[{id:'slope',value:2}]},false,true);
    if(!('action' in submission)||submission.action!=='parameters')throw Error('Expected parameter branch');
    const result=await commitLectureSubmission(world,submission,1,'unused',3);
    expect(result.changed).toBe(true);expect(world.summary().programs[0].epoch).toBe(0);
    expect((await world.sample(4)).elements.find(e=>e.id==='line')?.geometry.points).toEqual([[0,0],[1,2]]);
    const noop=await commitLectureSubmission(world,submission,2,'unused',4);
    expect(noop.changed).toBe(false);expect(noop.commit.revision).toBe(2);
  }finally{world.dispose();if(previous)Object.defineProperty(globalThis,'Worker',previous);else delete (globalThis as any).Worker;}
});

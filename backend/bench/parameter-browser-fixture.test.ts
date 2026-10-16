import {expect,test} from 'bun:test';
import {mkdtemp,readFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {buildRetainedParameterCases} from './realtime-media/retained-parameter-proof.js';
import {createParameterFixture,FIXTURE_LIMITS} from './parameter-browser-fixture.js';
import {MediaReplay} from './realtime-media/replay.js';

const selected=(await buildRetainedParameterCases()).find(c=>c.id==='slope-high')!;
async function setup(clockStep=0){
 const root=await mkdtemp(join(tmpdir(),'parameter-browser-fixture-')),directory=join(root,'new-run');
 const clock={now:1000};
 const fixture=await createParameterFixture({selected,directory,now:()=>{const value=clock.now;clock.now+=clockStep;return value;}});
 return {fixture,clock,directory,async dispose(){await rm(root,{recursive:true,force:true});}};
}
const ref=(stage:number)=>({id:`scripted-speech-${stage}`,version:1});
function world(revision:number){return {summary:{revision,entityIds:revision?['curve','ordinate','epoch-clock']:[],programs:revision?[{id:'run-1-plan-1',epoch:1.6,duration:20,
 ids:['curve','ordinate','epoch-clock'],parameters:[{id:'p',value:revision===1?.5:1.25,min:-2,max:2,usable:true,
 dependents:[{target:'curve',properties:['points']},{target:'ordinate',properties:['points']}],omittedDependentCount:0}]}]:[]},
 frameCurrent:true,sampledRevision:revision,sampledAt:{serverUpperMs:revision===1?4400:6000},
 elements:[{id:'epoch-clock',rotation:[0,0,revision===1?.28:.44]}],omissions:{entityIds:0,elements:0},
 committedOperations:{records:revision?[
 {revision:1,renderingStatus:'render-submitted',operation:{action:'add',programId:'run-1-plan-1',source:selected.source}},
 ...(revision===2?[{revision:2,renderingStatus:'render-submitted',operation:{action:'parameters',patch:{baseRevision:1,programId:'run-1-plan-1',values:{p:1.25}}}}]:[])]:[]}};}
function request(f:any,stage:number,revision=stage-1){return {runId:f.runId,planId:`plan-${stage}`,baseRevision:revision,
 inventoryId:f.inventory.inventoryId,evidence:[ref(stage)],context:[],world:world(revision),deadlineServerMs:30000};}
function rendered(f:any,stage:number,atMs:number){return {runId:f.runId,planId:`plan-${stage}`,type:'render-submitted',
 serverLowerMs:atMs-1,serverUpperMs:atMs,browserAtMs:atMs,hardwarePresentedAtMs:null,
 outcome:{status:'render-submitted',baseWorldRevision:stage-1,worldRevision:stage,committedAtMs:atMs-2,
 renderSubmittedAtMs:atMs,hardwarePresentedAtMs:null,timing:{status:'complete',withinDeadline:true,allChangesWithinDeadline:true,
 dependencies:[ref(stage)]}}};}
function retired(f:any){return {runId:f.runId,planId:'plan-3',type:'scheduler-receipt',serverUpperMs:6200,timing:{
 planId:'plan-3',status:'retired',reason:'unchanged parameters: no visual change committed',finishedAtMs:6200,
 lastRequiredAvailableAtMs:6100,deadlineMs:16100,earliestChangeDeadlineMs:16100,
 withinDeadline:false,allChangesWithinDeadline:false,dependencies:[ref(3)]}};}

test('source-gated add then receipt-gated parameters retain actual program ID and no-op journal evidence',async()=>{
 const h=await setup();try{
  const f=h.fixture;await f.start(f.inventory.inventoryId);
  expect(f.events.map(e=>e.type)).toEqual(['source-clock']);
  await expect(f.generate(request(f,1))).rejects.toThrow('not released');
  h.clock.now=1249;await f.release();expect(f.events).toHaveLength(1);
  h.clock.now=1250;await f.release();expect(f.events[1]).toMatchObject({type:'trial',serverClockDomain:f.clockDomain});
  const added=await f.generate(request(f,1));expect(added.submission).toMatchObject({action:'add',source:selected.source});
  expect(added.resolvedSpeechAnchor).toMatchObject({sourceStartMs:885000,sourceEndMs:885250,hostEndMs:1250,deadlineMs:11250});
  h.clock.now=3000;await f.release();expect(f.events).toHaveLength(2);
  await expect(f.generate(request(f,2))).rejects.toThrow('not released');
  await f.receipt(rendered(f,1,3000));
  h.clock.now=4499;await f.release();expect(f.events).toHaveLength(2);
  h.clock.now=4500;await f.release();
  const changed=await f.generate(request(f,2));
  expect(changed.submission).toMatchObject({action:'parameters',parameterProgramId:'run-1-plan-1',parameterValues:[{id:'p',value:1.25}]});
  h.clock.now=4600;await f.receipt(rendered(f,2,4600));
  h.clock.now=6100;await f.release();
  const unchanged=await f.generate(request(f,3,2));expect(unchanged.submission).toMatchObject({action:'parameters',parameterValues:[{id:'p',value:1.25}]});
  expect(f.events.filter(e=>e.type==='trial')).toHaveLength(3);
  await expect(f.receipt({runId:f.runId,planId:'plan-3',type:'scheduler-receipt',timing:{status:'retired',reason:'unchanged parameters: no visual change committed'}})).rejects.toThrow('no-op');
  await expect(f.receipt({...retired(f),timing:{...retired(f).timing,withinDeadline:true}})).rejects.toThrow('no-op');
  await f.receipt(retired(f));
  expect(f.complete).toBe(true);
  const files=await readdir(h.directory),records=await Promise.all(files.filter(x=>x.endsWith('.json')).map(async x=>JSON.parse(await readFile(join(h.directory,x),'utf8'))));
  expect(records.some(r=>r.kind==='request'&&r.body?.planId==='plan-3'&&r.body.world.committedOperations.records[0].renderingStatus==='render-submitted')).toBe(true);
  expect(records.filter(r=>r.kind==='response')).toHaveLength(3);
  expect(records.filter(r=>r.kind==='event')).toHaveLength(4);
  expect(records.some(r=>r.kind==='result'&&r.body.status==='scripted-browser-sequence-complete')).toBe(true);
 }finally{await h.dispose();}
});

test('stale evidence, wrong world revision, duplicate request and false render receipt cannot release next speech',async()=>{
 const h=await setup();try{
  const f=h.fixture;await f.start(f.inventory.inventoryId);h.clock.now=1250;await f.release();
  await expect(f.generate({...request(f,1),evidence:[{id:'scripted-speech-1',version:2}]})).rejects.toThrow('evidence');
  await expect(f.generate(request(f,1,1))).rejects.toThrow('revision');
  await f.generate(request(f,1));await expect(f.generate(request(f,1))).rejects.toThrow('already');
  await expect(f.receipt({...rendered(f,1,1300),outcome:{status:'failed'}})).rejects.toThrow('render receipt');
  h.clock.now=10000;await f.release();expect(f.events).toHaveLength(2);
  await expect(f.receipt(rendered(f,2,10000))).rejects.toThrow('plan');
  expect(f.complete).toBe(false);
 }finally{await h.dispose();}
});

test('expired phrase, oversized requests and reused output directory fail closed',async()=>{
 const h=await setup();try{
  const f=h.fixture;await f.start(f.inventory.inventoryId);h.clock.now=1250;await f.release();
  await expect(f.generate({...request(f,1),padding:'x'.repeat(FIXTURE_LIMITS.bodyBytes)})).rejects.toThrow('byte');
  h.clock.now=11250;await expect(f.generate(request(f,1))).rejects.toThrow('deadline');
  await expect(createParameterFixture({selected,directory:h.directory,now:()=>1})).rejects.toThrow();
  const before=(await readdir(h.directory)).length;
  for(let i=0;i<FIXTURE_LIMITS.receipts;i++)await f.receipt({runId:f.runId,planId:null,type:'diagnostic'});
  await expect(f.receipt({runId:f.runId,planId:null,type:'diagnostic'})).rejects.toThrow('receipt budget');
  expect((await readdir(h.directory)).length-before).toBe(FIXTURE_LIMITS.receipts);
 }finally{await h.dispose();}
});

test('third request rejects lost epoch, motion, IDs, control ownership, or rendered operation history',async()=>{
 const h=await setup();try{
  const f=h.fixture;await f.start(f.inventory.inventoryId);h.clock.now=1250;await f.release();await f.generate(request(f,1));
  h.clock.now=3000;await f.receipt(rendered(f,1,3000));h.clock.now=4500;await f.release();await f.generate(request(f,2));
  h.clock.now=4600;await f.receipt(rendered(f,2,4600));h.clock.now=6100;await f.release();
  const mutations:((world:any)=>void)[]=[
   w=>{w.summary.programs[0].epoch=2;},
   w=>{w.elements[0].rotation[2]=0;},
   w=>{w.summary.entityIds.pop();},
   w=>{w.summary.programs[0].parameters[0].value=.5;},
   w=>{w.summary.programs[0].parameters[0].max=3;},
   w=>{w.summary.programs[0].parameters[0].dependents.pop();},
   w=>{w.committedOperations.records[1].renderingStatus='not-observed';},
   w=>{w.committedOperations.records[0].operation.source='different source';},
   w=>{w.committedOperations.records[1].operation.patch.values.p=.5;},
  ];
  for(const mutate of mutations){const body=request(f,3,2);mutate(body.world);await expect(f.generate(body)).rejects.toThrow();}
  expect(f.complete).toBe(false);expect((await f.generate(request(f,3,2))).submission.action).toBe('parameters');
 }finally{await h.dispose();}
});

test('moving host clock keeps scheduled speech endpoints exactly mapped for subsequent stages',async()=>{
 const h=await setup(.01);try{
  const f=h.fixture;await f.start(f.inventory.inventoryId);h.clock.now=2000;await f.release();await f.generate(request(f,1));
  h.clock.now=3000;await f.receipt(rendered(f,1,3000));h.clock.now=4600;await f.release();
  const second=await f.generate(request(f,2));
  expect(second.resolvedSpeechAnchor!.hostEndMs-second.resolvedSpeechAnchor!.hostStartMs).toBeCloseTo(250,7);
  h.clock.now=4700;await f.receipt(rendered(f,2,4700));h.clock.now=6300;await f.release();
  const third=await f.generate(request(f,3,2));
  expect(third.resolvedSpeechAnchor!.hostEndMs-third.resolvedSpeechAnchor!.hostStartMs).toBeCloseTo(250,7);
 }finally{await h.dispose();}
});

test.each([0,.0001])('fractional host epoch and clock step %s produce causally ingestible real replay events',async step=>{
 const h=await setup(step);let replay:MediaReplay|undefined;try{
  const f=h.fixture;h.clock.now=16931.8012;await f.start(f.inventory.inventoryId);
  const source=f.events[0];replay=new MediaReplay({sourceClocks:{'scripted-lecture':{sourceStartMs:source.sourceStartMs,monotonicStartMs:source.monotonicStartMs,rate:1}}});
  const ingest=()=>{
   const event=f.events.at(-1)!;
   expect(replay!.ingestAsrTrial({id:event.python.receipt.id,version:event.version,sourceId:event.python.receipt.sourceId,
    trial:event.python.trial,trialRef:event.python.trialRef,availability:event.availability})).toBe('queued');
   expect(event.availability.chunkSentAtMs).toBe(event.availability.trialReceivedAtMs);
   expect(event.availability.trialReceivedAtMs).toBeLessThanOrEqual(h.clock.now);
  };
  h.clock.now=17207.1693;await f.release();ingest();await f.generate(request(f,1));
  h.clock.now=17498.6007;await f.receipt(rendered(f,1,17498.6007));h.clock.now=19016.0952;await f.release();ingest();await f.generate(request(f,2));
  h.clock.now=19225.0201;await f.receipt(rendered(f,2,19225.0201));
  if(step===0){
   h.clock.now=20725.0201;await f.release();expect(f.events).toHaveLength(3);
   // The source endpoint from the real failed trace maps slightly after its
   // nominal host endpoint. Wait for that instant, never stamp future time.
   h.clock.now=16931.8012+(888.7932189*1000-885000);
  }else h.clock.now=20741.3904;
  await f.release();ingest();expect((await f.generate(request(f,3,2))).submission.action).toBe('parameters');
 }finally{replay?.dispose();await h.dispose();}
});

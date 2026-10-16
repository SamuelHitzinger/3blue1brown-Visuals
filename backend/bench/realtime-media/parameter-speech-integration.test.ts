/** Offline composition proof: handwritten transcript/tool output, synthetic host
 * clocks and synthetic render-submission stamps. No ASR inference, provider,
 * browser, GPU or hardware presentation is exercised or claimed here. */
import {afterAll,beforeAll,expect,test} from 'bun:test';
import {joinedSpeechEvidence,selectEvidence,generationDeadline,finalizeSpeechAnchor} from '../realtime-lecture-join.js';
import {acceptSubmission} from '../realtime-tool-probe.js';
import {LiveWorld} from '../realtime-world/world.js';
import {CommittedContextJournal} from './committed-context.js';
import {MediaReplay,type LocalAsrTrial} from './replay.js';
import {commitLectureSubmission} from './world-submission.js';
import {measureSpeechRender} from './speech-anchor.js';
import {buildRetainedParameterCases,auditNativeFrame,compareNativeFrames,type RetainedCase} from './retained-parameter-proof.js';

const cases=await buildRetainedParameterCases();
const clock={sourceStartMs:885000,monotonicStartMs:1000};
const trial:LocalAsrTrial={windowStartSec:0,windowEndSec:4,sourceWindowStartSec:885,sourceWindowEndSec:889,
  availableAfterSourceSec:889,inferenceMs:200,text:'change parameter',segments:[{text:'change parameter',words:[
    {word:'change',startSec:0,endSec:.5,sourceStartSec:885,sourceEndSec:885.5,probability:.9},
    {word:'parameter',startSec:.5,endSec:1,sourceStartSec:885.5,sourceEndSec:886,probability:.8},
  ]}]};
const worker=Object.getOwnPropertyDescriptor(globalThis,'Worker');
beforeAll(()=>Object.defineProperty(globalThis,'Worker',{configurable:true,writable:true,value:undefined}));
afterAll(()=>{if(worker)Object.defineProperty(globalThis,'Worker',worker);else delete (globalThis as {Worker?:unknown}).Worker;});

async function setup(c:RetainedCase){
  const time={nowMs:1000};
  const world=new LiveWorld({clock:()=>time.nowMs/1000});
  const control=new LiveWorld({clock:()=>time.nowMs/1000});
  const replay=new MediaReplay({sourceClocks:{lecture:clock},maxActivePlans:1});
  const journal=new CommittedContextJournal();
  try{
    const added=await commitLectureSubmission(world,{action:'add',source:c.source},0,c.programId,1);
    journal.record({revision:added.commit.revision,runId:'seed',planId:'seed',committedAtMs:1000,
      evidence:{changes:[],context:[]},operation:added.operation});
    // Fresh control has the same nonzero epoch, camera and full detail as candidate.
    await control.addProgram({id:c.programId,source:c.baselineSource,baseRevision:0},1);
    const evidence=joinedSpeechEvidence({id:'speech',version:1,sourceId:'lecture',trial,trialRef:'synthetic:trial',
      clock,sourceReadyAtMs:5000,availableAtMs:5300});
    const ledger=new Map([[evidence.id,evidence]]);
    replay.ingestAsrTrial({id:evidence.id,version:1,sourceId:'lecture',trial,trialRef:'synthetic:trial',
      availability:{kind:'observed-host-bracket',chunkSentAtMs:5000,trialReceivedAtMs:5300}});
    time.nowMs=5300;replay.advance(time.nowMs);
    expect(replay.take(5449,{worldRevision:world.revision})).toBeNull();
    time.nowMs=5450;
    const attempt=replay.take(time.nowMs,{worldRevision:world.revision});
    if(!attempt)throw Error('Expected released speech plan after quiet window');
    const {packet,signal}=attempt;
    const refs={changes:packet.changes.map(({id,version})=>({id,version})),context:packet.context.map(({id,version})=>({id,version}))};
    const deadline=generationDeadline(selectEvidence(refs.changes,ledger,time.nowMs),packet.earliestChangeDeadlineMs,time.nowMs);
    const wire=(value=c.values.p)=>({action:'parameters',reason:'',source:'',changes:[],remove:[],
      parameterProgramId:c.programId,parameterValues:[{id:'p',value}],
      speechAnchor:{evidenceId:evidence.id,version:1,phrase:'change parameter',occurrence:null,utteranceId:null}});
    const accepted=(value=c.values.p)=>{
      const call={type:'toolCall' as const,id:'synthetic-call',name:'submit_world',arguments:wire(value)};
      const submission=acceptSubmission('world',[call],[structuredClone(call)],true,true,true);
      if(!('action' in submission)||submission.action!=='parameters')throw Error('Expected accepted parameter operation');
      return submission;
    };
    time.nowMs=6000;
    const finalize=(submission=accepted(),persist: (receipt:object)=>Promise<void>=async()=>{})=>finalizeSpeechAnchor({
      submission,...refs,ledger,deadline,now:()=>time.nowMs,signal,persist});
    // These are the real transaction hooks used by the joined browser: release
    // queued corrections, check cancellation, then the narrowed phrase deadline.
    // This composition does not test private DOM/run-identity/visibility guards.
    const guard=(operationDeadline:number)=>{
      replay.advance(time.nowMs);signal.throwIfAborted();
      if(time.nowMs>=operationDeadline)throw Error('Original speech phrase deadline expired');
    };
    const commit=(submission:ReturnType<typeof accepted>,operationDeadline:number,beforeGuard=()=>{})=>
      commitLectureSubmission(world,submission,packet.baseWorldRevision,'unused',time.nowMs/1000,
        {signal,beforeCommit:()=>{beforeGuard();guard(operationDeadline);}});
    const record=(result:Awaited<ReturnType<typeof commit>>)=>journal.record({revision:result.commit.revision,runId:'synthetic-run',
      planId:packet.planId,committedAtMs:result.commit.committedAt*1000,evidence:refs,operation:result.operation});
    return {time,world,control,replay,journal,evidence,ledger,packet,signal,refs,deadline,wire,accepted,finalize,commit,record,
      dispose(){world.dispose();control.dispose();replay.dispose();}};
  }catch(error){world.dispose();control.dispose();replay.dispose();throw error;}
}

// Catches loss of source offset/scene epoch, default-only reconstruction, dropped
// topology/detail, time reset, parameter dispatch omission and revision miscredit.
for(const c of cases)test(`synthetic measured speech reaches retained native ${c.id} and exact journal/receipt`,async()=>{
  const h=await setup(c);
  try{
    expect(cases).toHaveLength(10);
    expect(h.packet).toMatchObject({baseWorldRevision:1,plannedAtMs:5450,earliestChangeDeadlineMs:15300});
    expect(h.deadline).toBe(15000); // Complete source window ends at host 5000.
    const submission=h.accepted(),finalized=await h.finalize(submission);
    expect(finalized.operationDeadline).toBe(12000); // Supporting phrase ends at host 2000.
    expect(finalized.resolvedSpeechAnchor).toMatchObject({sourceStartMs:885000,sourceEndMs:886000,
      hostStartMs:1000,hostEndMs:2000,deadlineMs:12000,version:1,wordIds:['window.u1.w1','window.u1.w2']});
    const before=await h.world.sample(6),fresh=await h.control.sample(6);
    auditNativeFrame(c,before,5,c.initialValue);
    // Sensitivity: the untouched state must differ from the requested control.
    expect(()=>compareNativeFrames(before,fresh)).toThrow();
    const result=await h.commit(submission,finalized.operationDeadline);
    expect(result.changed).toBe(true);
    expect(result.commit).toMatchObject({revision:2,committedAt:6,originSampledAt:6});
    expect(h.world.summary().programs[0]).toMatchObject({id:c.programId,epoch:1});
    h.record(result);
    expect(h.journal.snapshot(100000).records[1]).toMatchObject({revision:2,runId:'synthetic-run',planId:h.packet.planId,
      committedAtMs:6000,evidence:{changes:[{id:'speech',version:1}],context:[]},renderingStatus:'not-observed',
      operation:{action:'parameters',patch:{baseRevision:1,programId:c.programId,values:c.values}}});
    for(const hostSeconds of [6,6.1,7,8]){
      h.time.nowMs=hostSeconds*1000;
      const frame=await h.world.sample(hostSeconds),control=await h.control.sample(hostSeconds);
      auditNativeFrame(c,frame,hostSeconds-1,c.values.p);auditNativeFrame(c,control,hostSeconds-1,c.values.p);
      expect(compareNativeFrames(frame,control).maxAbsoluteError).toBeLessThanOrEqual(1e-9);
      expect(frame.camera).toEqual(before.camera);
      expect(frame.elements.map(e=>e.id)).toEqual(before.elements.map(e=>e.id));
      for(const element of frame.elements)expect(element.geometry.triangles).toEqual(before.elements.find(e=>e.id===element.id)!.geometry.triangles);
      // Independent motion remains on the original clock, across the update.
      expect(frame.elements.find(e=>e.id==='epoch-clock')!.rotation[2]).toBeCloseTo((hostSeconds-1)*.1,10);
    }
    // Synthetic submission is exercised as a receipt protocol, never GPU evidence.
    const receipt=h.replay.commit(h.packet.planId,{status:'render-submitted',atMs:8100,committedAtMs:6000,
      baseWorldRevision:1,worldRevision:result.commit.revision,currentWorldRevision:h.world.revision});
    expect(receipt).toMatchObject({status:'render-submitted',worldRevision:2,committedAtMs:6000,renderSubmittedAtMs:8100,
      hardwarePresentedAtMs:null,semanticCompletion:'unknown',timing:{status:'complete',withinDeadline:true,dependencies:[{id:'speech',version:1}]}});
    expect(measureSpeechRender(finalized.resolvedSpeechAnchor!,{serverLowerMs:8090,serverUpperMs:8100}))
      .toMatchObject({cueEndToRenderLowerMs:6090,cueEndToRenderUpperMs:6100,withinDeadline:true,hardwarePresentedAtMs:null});
    expect(h.journal.markRendered(2)).toBe(true);
    expect(h.journal.snapshot(100000).records[1].renderingStatus).toBe('render-submitted');
  }finally{h.dispose();}
},30000);

test('queued evidence correction released at parameter publication cancels without geometry, journal or coverage mutation',async()=>{
  const c=cases.find(c=>c.id==='saddle-high')!,h=await setup(c);
  try{
    const submission=h.accepted(),finalized=await h.finalize(submission),history=h.journal.snapshot(100000);
    h.replay.ingestAsrTrial({id:'speech',version:2,sourceId:'lecture',trial,trialRef:'synthetic:corrected-trial',
      availability:{kind:'observed-host-bracket',chunkSentAtMs:5800,trialReceivedAtMs:6100}});
    expect(h.signal.aborted).toBe(false);
    let reachedPublication=false;
    await expect(h.commit(submission,finalized.operationDeadline,()=>{reachedPublication=true;h.time.nowMs=6100;})).rejects.toThrow();
    expect(reachedPublication).toBe(true);expect(h.signal.aborted).toBe(true);expect(h.world.revision).toBe(1);
    auditNativeFrame(c,await h.world.sample(6.1),5.1,c.initialValue);
    expect(h.journal.snapshot(100000)).toEqual(history);
    expect(h.replay.drainReceipts()).toMatchObject([{status:'cancelled',dependencies:[{id:'speech',version:1}]}]);
    expect(()=>h.replay.commit(h.packet.planId,{status:'render-submitted',atMs:6200,committedAtMs:6100,
      baseWorldRevision:1,worldRevision:2,currentWorldRevision:h.world.revision})).toThrow('not active');
  }finally{h.dispose();}
},30000);

test('original phrase deadline blocks parameter publication even while the whole-window deadline remains open',async()=>{
  const c=cases.find(c=>c.id==='waves-high')!,h=await setup(c);
  try{
    const submission=h.accepted(),finalized=await h.finalize(submission),history=h.journal.snapshot(100000);
    await expect(h.commit(submission,finalized.operationDeadline,()=>{h.time.nowMs=12000;})).rejects.toThrow('phrase deadline');
    expect(h.time.nowMs).toBeLessThan(h.deadline);expect(h.signal.aborted).toBe(false);expect(h.world.revision).toBe(1);
    auditNativeFrame(c,await h.world.sample(12),11,c.initialValue);expect(h.journal.snapshot(100000)).toEqual(history);
    expect(h.replay.retire(h.packet.planId,h.time.nowMs,'original-phrase-deadline-expired').status).toBe('retired');
    expect(h.replay.drainReceipts().some(receipt=>receipt.status==='complete')).toBe(false);
  }finally{h.dispose();}
},30000);

test('accepted same-value speech operation preserves motion but earns no new journal revision or coverage',async()=>{
  const c=cases.find(c=>c.id==='caffeine-high')!,h=await setup(c);
  try{
    const submission=h.accepted(c.initialValue),finalized=await h.finalize(submission),history=h.journal.snapshot(100000);
    const result=await h.commit(submission,finalized.operationDeadline);
    expect(result.changed).toBe(false);expect(result.commit.revision).toBe(1);expect(h.world.revision).toBe(1);
    // Joined client only records changed transactions; unchanged attempts retire.
    if(result.changed)h.record(result);
    expect(h.replay.retire(h.packet.planId,6000,'unchanged parameters: no visual change committed').status).toBe('retired');
    expect(h.journal.snapshot(100000)).toEqual(history);
    expect(h.replay.drainReceipts().some(receipt=>receipt.status==='complete')).toBe(false);
    auditNativeFrame(c,await h.world.sample(7),6,c.initialValue);
  }finally{h.dispose();}
},30000);

test('authoritative evidence replacement during speech finalization cannot reach retained transaction',async()=>{
  const c=cases[0],h=await setup(c);
  try{
    const history=h.journal.snapshot(100000);
    await expect(h.finalize(h.accepted(),async()=>{h.ledger.set('speech',{...h.evidence,version:2});})).rejects.toThrow('Evidence not available');
    expect(h.world.revision).toBe(1);expect(h.journal.snapshot(100000)).toEqual(history);
    auditNativeFrame(c,await h.world.sample(6),5,c.initialValue);
    h.replay.retire(h.packet.planId,6000,'stale-server-evidence');
    expect(h.replay.drainReceipts().some(receipt=>receipt.status==='complete')).toBe(false);
  }finally{h.dispose();}
},30000);

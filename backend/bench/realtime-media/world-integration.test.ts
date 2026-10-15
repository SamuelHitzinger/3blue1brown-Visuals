import {expect,test} from 'bun:test';
import {MediaReplay,type LocalAsrTrial} from './replay.js';
import {LiveWorld} from '../realtime-world/world.js';

Object.defineProperty(globalThis,'Worker',{configurable:true,writable:true,value:undefined});
const trial=(word:string):LocalAsrTrial=>({windowStartSec:0,windowEndSec:1,sourceWindowStartSec:0,sourceWindowEndSec:1,
  availableAfterSourceSec:1,inferenceMs:100,text:word,segments:[{text:word,words:[{word,startSec:.2,endSec:.8,sourceStartSec:.2,sourceEndSec:.8,probability:.8}]}]});
const source=(id:string)=>`export default scene({end:'hold'},s=>{const dot=s.circle('${id}',{radius:.2});s.bind(dot,[s.time],t=>({rotation:[0,0,t]}));s.wait(60);});`;
function deferred(){let resolve!:()=>void;return {promise:new Promise<void>(r=>{resolve=r;}),resolve:()=>resolve()};}
function speech(replay:MediaReplay,version:number,text:string,arrival:number){
  replay.ingestAsrTrial({id:'speech',version,sourceId:'lecture',trialRef:`fixture:trial-${version}`,trial:trial(text),
    availability:{kind:'observed',inferenceStartedAtMs:arrival-100,inferenceCompletedAtMs:arrival}});
}

test('speech correction aborts real native preparation while existing motion survives, then corrected work commits',async()=>{
  let now=0;const entered=deferred(),gate=deferred();
  const replay=new MediaReplay({sourceClocks:{lecture:{monotonicStartMs:0}},quietMs:0,maxWaitMs:0});
  const world=new LiveWorld({clock:()=>now/1000,prepare:async scene=>{
    if([...scene.initial,...scene.lifecycle.flatMap(event=>event.elements??[])].some(element=>element.id==='wrong')){entered.resolve();await gate.promise;}
  }});
  try{
    await world.addProgram({id:'existing',source:source('existing'),baseRevision:0},0);
    speech(replay,1,'cube',1200);now=1200;
    const request=replay.take(now,{worldRevision:world.revision})!;
    const prepared=world.addProgram({id:'wrong',source:source('wrong'),baseRevision:request.packet.baseWorldRevision},now/1000,
      {signal:request.signal,beforeCommit:()=>{replay.advance(now);}});
    const outcome=prepared.then(()=>({published:true}),()=>({published:false}));
    await entered.promise;now=1500;speech(replay,2,'sphere',1500);replay.advance(now);gate.resolve();
    expect((await outcome).published).toBe(false);
    expect(world.revision).toBe(1);expect(world.summary().entityIds).toEqual(['existing']);
    const frame=await world.sample(2);expect(frame.elements[0].rotation[2]).toBeCloseTo(2);
    now=1600;const corrected=replay.take(now,{worldRevision:world.revision})!;
    const change=corrected.packet.changes[0];
    expect(change.kind==='transcript'?change.text:undefined).toBe('sphere');
    const commit=await world.addProgram({id:'corrected',source:source('corrected'),baseRevision:corrected.packet.baseWorldRevision},now/1000,
      {signal:corrected.signal,beforeCommit:()=>{replay.advance(now);}});
    // This is an injected submission timestamp for contract testing, not GPU proof.
    const receipt=replay.commit(corrected.packet.planId,{status:'render-submitted',atMs:1650,committedAtMs:commit.committedAt*1000,
      baseWorldRevision:corrected.packet.baseWorldRevision,worldRevision:commit.revision,currentWorldRevision:world.revision});
    expect(receipt.timing.allChangesWithinDeadline).toBe(true);expect(receipt.hardwarePresentedAtMs).toBeNull();
    expect(world.summary().entityIds).toEqual(['existing','corrected']);
  }finally{gate.resolve();world.dispose();replay.dispose();}
});

test('publication guard activates a queued correction even without an intervening scheduler poll',async()=>{
  let now=1200;
  const replay=new MediaReplay({sourceClocks:{lecture:{monotonicStartMs:0}},quietMs:0,maxWaitMs:0});
  const world=new LiveWorld({clock:()=>now/1000});
  try{
    speech(replay,1,'cube',1200);const request=replay.take(now,{worldRevision:0})!;
    speech(replay,2,'sphere',1400);now=1400;
    expect(request.signal.aborted).toBe(false);
    await expect(world.addProgram({id:'stale',source:source('stale'),baseRevision:0},now/1000,
      {signal:request.signal,beforeCommit:()=>{replay.advance(now);}})).rejects.toThrow();
    expect(request.signal.aborted).toBe(true);expect(world.revision).toBe(0);
    expect((await world.sample(1.5)).elements).toEqual([]);
  }finally{world.dispose();replay.dispose();}
});

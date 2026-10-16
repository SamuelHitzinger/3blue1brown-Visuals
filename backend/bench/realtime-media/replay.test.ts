import {expect,test} from 'bun:test';
import {MediaReplay,type LocalAsrTrial} from './replay.js';

const trial=(text=' body',inferenceMs=200):LocalAsrTrial=>({
  windowStartSec:0,windowEndSec:1,sourceWindowStartSec:0,sourceWindowEndSec:1,
  availableAfterSourceSec:1,inferenceMs,text:text.trim(),segments:[{text,words:[{
    word:text,startSec:.2,endSec:.8,sourceStartSec:.2,sourceEndSec:.8,probability:.9,
  }]}],
});
const bridge=()=>new MediaReplay({sourceClocks:{lecture:{monotonicStartMs:0}},quietMs:0,maxWaitMs:0});
const asr=(version=1,text=' body')=>({id:'speech',version,sourceId:'lecture',trialRef:'artifact:trial.json',trial:trial(text),
  availability:{kind:'observed' as const,inferenceStartedAtMs:1000,inferenceCompletedAtMs:1200}});

test('preloaded frame and full-window ASR are hidden until source time and measured completion',()=>{
  const replay=bridge();
  replay.ingestFrame({id:'frame',version:1,sourceId:'lecture',sourceTimeMs:2000,arrivedAtMs:0,frameRef:'media:frame-2000.png'});
  replay.ingestAsrTrial(asr());
  expect(replay.take(999,{worldRevision:0})).toBeNull();
  expect(replay.take(1199,{worldRevision:0})).toBeNull();
  const speech=replay.take(1200,{worldRevision:0})!;
  expect(speech.packet.changes.map(e=>e.id)).toEqual(['speech']);
  expect(speech.packet.changes[0].availableAtMs).toBe(1200);
  expect(speech.packet.changes[0].sourceEndMs).toBe(1000);
  expect(speech.packet.changes[0].asr?.timing.scene.utterances[0].words[0].startSec).toBe(.2);
  expect(JSON.stringify(speech.packet)).not.toContain('frame-2000');
  expect(replay.take(1999,{worldRevision:0})).toBeNull();
  const frame=replay.take(2000,{worldRevision:0})!;
  expect(frame.packet.changes[0]).toMatchObject({frameRef:'media:frame-2000.png',captureDelayMs:-2000});
  replay.dispose();
});

test('measured ASR corrections cancel dependent model work and stale receipts cannot succeed',()=>{
  const replay=bridge();replay.ingestAsrTrial(asr());const pending=replay.take(1200,{worldRevision:7})!;
  const corrected=asr(2,' sphere');corrected.availability={kind:'observed',inferenceStartedAtMs:1300,inferenceCompletedAtMs:1500};
  replay.ingestAsrTrial(corrected);replay.advance(1500);
  expect(pending.signal.aborted).toBe(true);
  expect(()=>replay.commit(pending.packet.planId,{status:'render-submitted',atMs:1600,committedAtMs:1550,baseWorldRevision:7,worldRevision:8})).toThrow(/active/i);
  const next=replay.take(1600,{worldRevision:7})!;
  expect(next.packet.changes[0]).toMatchObject({version:2,text:'sphere'});
  expect(replay.drainReceipts()[0].status).toBe('cancelled');replay.dispose();
});

test('failed or stale world commit is not a success and retry retains original input deadline',()=>{
  const replay=bridge();replay.ingestAsrTrial(asr());const request=replay.take(1200,{worldRevision:3})!;
  const failed=replay.commit(request.packet.planId,{status:'failed',atMs:2000,reason:'compile-failed'});
  expect(failed.timing.withinDeadline).toBe(false);expect(failed.status).toBe('failed');
  const retry=replay.take(2000,{worldRevision:4})!;
  expect(retry.packet.deadlineMs).toBe(11200);
  const stale=replay.commit(retry.packet.planId,{status:'render-submitted',atMs:2500,committedAtMs:2400,baseWorldRevision:3,worldRevision:4});
  expect(stale.status).toBe('failed');expect(stale.timing.reason).toBe('world-revision-mismatch');
  expect(stale.timing.withinDeadline).toBe(false);replay.dispose();
});

test('render submission receipts expose older event misses even when the newest evidence meets ten seconds',()=>{
  const replay=bridge();
  replay.ingestFrame({id:'old',version:1,sourceId:'lecture',sourceTimeMs:0,arrivedAtMs:0,frameRef:'media:old.png'});
  replay.ingestAsrTrial(asr());const request=replay.take(1200,{worldRevision:0})!;
  const receipt=replay.commit(request.packet.planId,{status:'render-submitted',atMs:10500,committedAtMs:10400,baseWorldRevision:0,worldRevision:1,currentWorldRevision:1});
  expect(receipt.status).toBe('render-submitted');expect(receipt.timing.withinDeadline).toBe(true);
  expect(receipt.timing.allChangesWithinDeadline).toBe(false);
  expect(receipt.obligations.map(o=>o.deadlineMs)).toEqual([10000,11200]);
  expect(receipt.hardwarePresentedAtMs).toBeNull();expect(receipt.semanticCompletion).toBe('unknown');replay.dispose();
});

test('duration replay uses measured inference cost, explicitly labels projection, and rejects future ASR context',()=>{
  const replay=bridge();
  expect(()=>replay.ingestAsrTrial({...asr(),availability:{kind:'measured-duration-replay',inferenceStartedAtMs:900}})).toThrow(/window/i);
  replay.ingestAsrTrial({...asr(),availability:{kind:'measured-duration-replay',inferenceStartedAtMs:1300}});
  expect(replay.take(1499,{worldRevision:0})).toBeNull();
  const request=replay.take(1500,{worldRevision:0})!;
  expect(request.packet.changes[0].asr?.availability).toMatchObject({kind:'measured-duration-replay',inferenceStartedAtMs:1300,inferenceCompletedAtMs:1500,inferenceMs:200});
  expect(request.packet.limitation).toContain('not live');
  const bad=asr(2);bad.trial.segments[0].words[0].sourceEndSec=9;
  expect(()=>replay.ingestAsrTrial(bad)).toThrow();replay.dispose();
});

test('packets are cloned, reference-only frames reject embedded data, and buffering is bounded',()=>{
  const replay=new MediaReplay({sourceClocks:{lecture:{monotonicStartMs:0}},quietMs:0,maxWaitMs:0,maxBufferedEvents:1});
  const input=asr();replay.ingestAsrTrial(input);input.trial.segments[0].words[0].word='invented';
  expect(()=>replay.ingestFrame({id:'frame',version:1,sourceId:'lecture',sourceTimeMs:0,arrivedAtMs:0,frameRef:'data:image/png;base64,AAAA'})).toThrow(/reference/i);
  expect(()=>replay.ingestFrame({id:'frame',version:1,sourceId:'lecture',sourceTimeMs:0,arrivedAtMs:0,frameRef:'media:frame.png'})).toThrow(/buffer/i);
  const request=replay.take(1200,{worldRevision:0})!;
  expect(request.packet.changes[0].asr?.timing.scene.utterances[0].words[0].text).toBe('body');
  request.packet.deadlineMs=999999;request.packet.obligations[0].deadlineMs=999999;
  const receipt=replay.commit(request.packet.planId,{status:'render-submitted',atMs:11201,committedAtMs:11200,baseWorldRevision:0,worldRevision:1});
  expect(receipt.timing.withinDeadline).toBe(false);expect(receipt.obligations[0].deadlineMs).toBe(11200);replay.dispose();
});

test('source playback rates do not scale inference wall time and observed completion cannot omit its cost',()=>{
  const replay=new MediaReplay({sourceClocks:{lecture:{sourceStartMs:100000,monotonicStartMs:5000,rate:2}},quietMs:0,maxWaitMs:0});
  const input=asr();input.trial.sourceWindowStartSec=100;input.trial.sourceWindowEndSec=101;input.trial.availableAfterSourceSec=101;
  input.trial.segments[0].words[0].sourceStartSec=100.2;input.trial.segments[0].words[0].sourceEndSec=100.8;
  input.availability={kind:'observed',inferenceStartedAtMs:5500,inferenceCompletedAtMs:5600};
  expect(()=>replay.ingestAsrTrial(input)).toThrow(/inference time/i);
  input.availability.inferenceCompletedAtMs=5700;replay.ingestAsrTrial(input);
  expect(replay.take(5699,{worldRevision:0})).toBeNull();
  expect(replay.take(5700,{worldRevision:0})!.packet.changes[0]).toMatchObject({sourceReadyAtMs:5500,availableAtMs:5700,captureDelayMs:200});replay.dispose();
});

test('ASR metadata is independently bounded and same-version word timing changes are rejected',()=>{
  const bounded=new MediaReplay({sourceClocks:{lecture:{monotonicStartMs:0}},maxMetadataBytes:1});
  expect(()=>bounded.ingestAsrTrial(asr())).toThrow(/metadata budget/i);expect(bounded.summary().bufferedEvents).toBe(0);bounded.dispose();
  const replay=bridge();replay.ingestAsrTrial(asr());
  const changed=asr();changed.trial.segments[0].words[0].startSec=.3;changed.trial.segments[0].words[0].sourceStartSec=.3;
  expect(()=>replay.ingestAsrTrial(changed)).toThrow(/conflicting ASR/i);
  const request=replay.take(1200,{worldRevision:1})!;
  const receipt=replay.commit(request.packet.planId,{status:'render-submitted',atMs:1400,committedAtMs:1300,baseWorldRevision:1,worldRevision:2,currentWorldRevision:3});
  expect(receipt.status).toBe('failed');expect(receipt.timing.withinDeadline).toBe(false);replay.dispose();
});

test('observed host bracket uses actual receipt availability without inventing a cross-process inference clock',()=>{
  const replay=bridge();
  replay.ingestAsrTrial({...asr(),availability:{kind:'observed-host-bracket',chunkSentAtMs:1010,trialReceivedAtMs:1350}});
  expect(replay.take(1349,{worldRevision:0})).toBeNull();
  const request=replay.take(1350,{worldRevision:0})!;
  expect(request.packet.changes[0]).toMatchObject({sourceReadyAtMs:1000,availableAtMs:1350,captureDelayMs:350});
  expect(request.packet.changes[0].asr?.availability).toEqual({kind:'observed-host-bracket',chunkSentAtMs:1010,trialReceivedAtMs:1350,inferenceMs:200});
  expect(request.packet.changes[0].asr?.availability).not.toHaveProperty('inferenceStartedAtMs');
  expect(request.packet.earliestChangeDeadlineMs).toBe(11350);
  expect(request.packet.limitation).toContain('queueing and transport');
  replay.dispose();
});

test('host brackets reject early source dispatch, reversed receipt, and omission of measured recognition duration',()=>{
  const replay=bridge();
  for(const [sent,received] of [[999,1500],[1200,1100],[1000,1199]]){
    expect(()=>replay.ingestAsrTrial({...asr(),availability:{kind:'observed-host-bracket',chunkSentAtMs:sent,trialReceivedAtMs:received}})).toThrow();
  }
  expect(replay.summary().bufferedEvents).toBe(0);replay.dispose();
});

test('media retirement emits only a terminal timing receipt and unblocks later evidence',()=>{
  const replay=bridge();replay.ingestAsrTrial(asr());const old=replay.take(1200,{worldRevision:7})!;
  replay.ingestFrame({id:'later',version:1,sourceId:'lecture',sourceTimeMs:12000,arrivedAtMs:12000,frameRef:'media:later.png'});
  const receipt=replay.retire(old.packet.planId,12000,'deadline-expired');
  expect(receipt).toMatchObject({status:'retired',reason:'deadline-expired',deadlineMs:11200,
    withinDeadline:false,allChangesWithinDeadline:false,dependencies:[{id:'speech',version:1}]});
  expect(receipt).not.toHaveProperty('renderSubmittedAtMs');expect(receipt).not.toHaveProperty('worldRevision');
  expect(old.signal.aborted).toBe(true);
  expect(()=>replay.commit(old.packet.planId,{status:'failed',atMs:12001,reason:'retry'})).toThrow(/active/i);
  const later=replay.take(12001,{worldRevision:7})!;expect(later.packet.changes.map(event=>event.id)).toEqual(['later']);
  replay.retire(later.packet.planId,12002,'unsupported');expect(replay.take(12002,{worldRevision:7})).toBeNull();
  expect(replay.drainReceipts().map(item=>item.status)).toEqual(['retired','retired']);replay.dispose();
});

test('media retirement rejects revoked and unknown plans while preserving the correction',()=>{
  const replay=bridge();replay.ingestAsrTrial(asr());const old=replay.take(1200,{worldRevision:0})!;
  const correction=asr(2,' corrected');correction.availability={kind:'observed',inferenceStartedAtMs:1300,inferenceCompletedAtMs:1500};
  replay.ingestAsrTrial(correction);
  expect(()=>replay.retire(old.packet.planId,1500,'deferred')).toThrow(/active/i);
  expect(()=>replay.retire('unknown',1500,'unsupported')).toThrow(/active/i);
  const next=replay.take(1500,{worldRevision:0})!;expect(next.packet.changes[0]).toMatchObject({version:2,text:'corrected'});
  expect(()=>replay.retire(next.packet.planId,1499,'unsupported')).toThrow(/dispatch/i);
  expect(next.signal.aborted).toBe(false);replay.retire(next.packet.planId,1500,'deferred');
  expect(replay.take(1500,{worldRevision:0})).toBeNull();replay.dispose();
});

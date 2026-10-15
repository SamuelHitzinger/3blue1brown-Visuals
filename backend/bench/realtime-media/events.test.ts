import { expect, test } from 'bun:test';
import { EvidenceScheduler } from './events.js';
import type { TranscriptEvent } from './events.js';

const speech=(id:string,version:number,arrivedAtMs:number,state:TranscriptEvent['state']='stable',text=`${id}-${version}`):TranscriptEvent=>
  ({id,version,kind:'transcript',state,text:state==='retracted'?'':text,sourceId:'lecture',sourceStartMs:Math.max(0,arrivedAtMs-100),sourceEndMs:arrivedAtMs,arrivedAtMs});
const scheduler=(options:Record<string,unknown>={})=>new EvidenceScheduler({sourceClocks:{lecture:{monotonicStartMs:0}},quietMs:150,maxWaitMs:500,...options});

test('prefetched replay frames and future corrections cannot leak before source time or arrival',()=>{
  const queue=scheduler();
  queue.ingest({id:'frame',version:1,kind:'frame',state:'stable',frameRef:'local:frame-1000',sourceId:'lecture',sourceStartMs:1000,sourceEndMs:1000,arrivedAtMs:0});
  queue.ingest(speech('speech',2,2000));queue.ingest(speech('speech',1,1000));
  queue.advance(999);expect(queue.snapshot().events).toHaveLength(0);expect(queue.revision).toBe(0);
  queue.advance(1000);expect(queue.snapshot().events.map(event=>[event.id,event.version])).toEqual([['frame',1],['speech',1]]);
  expect(queue.snapshot().events[0].captureDelayMs).toBe(-1000);expect(queue.snapshot().events[0].availableAtMs).toBe(1000);
  queue.advance(1999);expect(queue.snapshot().events.find(event=>event.id==='speech')?.version).toBe(1);
  queue.advance(2000);expect(queue.snapshot().events.find(event=>event.id==='speech')?.version).toBe(2);
});

test('partial speech is visible only on request and is not planned until stable',()=>{
  const queue=scheduler();queue.ingest(speech('a',1,100,'partial'));queue.advance(1000);
  expect(queue.snapshot().events).toHaveLength(0);expect(queue.snapshot({includePartial:true}).events).toHaveLength(1);expect(queue.take(1000)).toBeNull();
  queue.ingest(speech('a',2,1100));queue.advance(1100);expect(queue.take(1250)?.changes[0].version).toBe(2);
});

test('quiet-window coalescing has a hard wait bound and preserves every independent event across batches',()=>{
  const queue=scheduler({maxEventsPerPlan:2,maxActivePlans:2});
  for(let i=0;i<6;i++)queue.ingest(speech(`e${i}`,1,i*100));
  expect(queue.take(149)).toBeNull();expect(queue.take(499)).toBeNull();
  const first=queue.take(500)!;expect(first.changes.map(event=>event.id)).toEqual(['e0','e1']);
  const second=queue.take(650)!;expect(second.changes.map(event=>event.id)).toEqual(['e2','e3']);
  expect(queue.take(650)).toBeNull();queue.complete(first.id,700);queue.complete(second.id,700);
  expect(queue.take(700)?.changes.map(event=>event.id)).toEqual(['e4','e5']);
});

test('corrections cancel dependent plans but unrelated arrivals do not cancel independent work',()=>{
  const queue=scheduler();queue.ingest(speech('a',1,0));const first=queue.take(150)!;
  queue.ingest(speech('b',1,200));queue.advance(200);expect(first.signal.aborted).toBe(false);
  queue.ingest(speech('a',2,250,'partial','correcting'));queue.advance(250);expect(first.signal.aborted).toBe(true);
  expect(queue.drainReceipts()[0]).toMatchObject({status:'cancelled',reason:'evidence-revised'});
  expect(()=>queue.complete(first.id,260)).toThrow(/active/i);
  const unrelated=queue.take(400)!;expect(unrelated.changes.map(event=>event.id)).toEqual(['b']);
  queue.ingest(speech('a',3,450));const correction=queue.take(600)!;expect(correction.changes.map(event=>[event.id,event.version])).toEqual([['a',3]]);
});

test('corrections to explicit context cancel plans and context cannot name unavailable evidence',()=>{
  const queue=scheduler();queue.ingest(speech('old',1,0));const old=queue.take(150)!;queue.complete(old.id,160);
  queue.ingest(speech('new',1,200));
  expect(()=>queue.take(350,{contextIds:['future']})).toThrow(/available/i);
  const plan=queue.take(350,{contextIds:['old']})!;expect(plan.context.map(event=>event.id)).toEqual(['old']);
  queue.ingest(speech('old',2,400));queue.advance(400);expect(plan.signal.aborted).toBe(true);
});

test('late lower versions and exact retransmissions cannot roll evidence backward',()=>{
  const queue=scheduler();queue.ingest(speech('a',2,100));queue.advance(100);
  expect(queue.ingest(speech('a',1,200))).toBe('stale');
  const duplicate={...speech('a',2,100),arrivedAtMs:500};expect(queue.ingest(duplicate)).toBe('duplicate');
  expect(()=>queue.ingest({...duplicate,text:'conflicting same version'})).toThrow(/conflict/i);
  queue.advance(500);expect(queue.revision).toBe(1);expect(queue.snapshot().events[0].version).toBe(2);
});

test('earlier arrival on a duplicate is rejected before it can silently extend the measured budget',()=>{
  for(const dispatched of [false,true]){
    const queue=scheduler({quietMs:0,maxWaitMs:0});
    const event={...speech('a',1,2000),sourceStartMs:0,sourceEndMs:1000};
    queue.ingest(event);
    const plan=dispatched?queue.take(2000):null;
    const before=queue.summary();
    expect(()=>queue.ingest({...event,arrivedAtMs:1000})).toThrow(/earlier.*arrival/i);
    expect(queue.summary()).toEqual(before);
    expect(queue.ingest({...event,arrivedAtMs:3000})).toBe('duplicate');
    const retained=plan??queue.take(2000)!;
    expect(retained.lastRequiredAvailableAtMs).toBe(2000);
    expect(retained.deadlineMs).toBe(12000);
    expect(retained.signal.aborted).toBe(false);
  }
});

test('deadlines retain input availability, capture delay and older obligations through queueing/retries',()=>{
  const queue=new EvidenceScheduler({sourceClocks:{lecture:{sourceStartMs:100000,monotonicStartMs:5000,rate:2}},quietMs:0,maxWaitMs:0});
  queue.ingest({...speech('a',1,5300),sourceStartMs:100000,sourceEndMs:100200});
  const plan=queue.take(6000)!;expect(plan.lastRequiredAvailableAtMs).toBe(5300);expect(plan.deadlineMs).toBe(15300);expect(plan.changes[0].captureDelayMs).toBe(200);
  queue.fail(plan.id,7000);const retry=queue.take(7000)!;expect(retry.deadlineMs).toBe(15300);
  const receipt=queue.complete(retry.id,15301);expect(receipt.withinDeadline).toBe(false);expect(receipt.inputToResultMs).toBe(10001);
  expect(queue.drainReceipts().map(item=>item.status)).toEqual(['failed','complete']);
});

test('later coalesced evidence does not conceal an older changed-evidence miss',()=>{
  const queue=scheduler({quietMs:0,maxWaitMs:0});queue.ingest(speech('a',1,0));queue.ingest(speech('b',1,500));
  const plan=queue.take(500)!;expect(plan.deadlineMs).toBe(10500);expect(plan.earliestChangeDeadlineMs).toBe(10000);
  const receipt=queue.complete(plan.id,10200);expect(receipt.withinDeadline).toBe(true);expect(receipt.allChangesWithinDeadline).toBe(false);
});

test('retraction is an explicit correction obligation and cancellation requeues unrelated changes',()=>{
  const queue=scheduler();queue.ingest(speech('a',1,0));queue.ingest(speech('b',1,0));const old=queue.take(150)!;
  queue.ingest(speech('a',2,200,'retracted'));queue.advance(200);expect(old.signal.aborted).toBe(true);
  expect(queue.snapshot().events.map(event=>event.id)).toEqual(['b']);
  const next=queue.take(350)!;expect(next.changes.map(event=>[event.id,event.state])).toEqual([['b','stable'],['a','retracted']]);
});

test('event/plan limits apply backpressure without silently discarding queued evidence',()=>{
  const queue=scheduler({maxBufferedEvents:1,maxEvidence:1,maxActivePlans:1,quietMs:0,maxWaitMs:0});queue.ingest(speech('a',1,0));
  expect(()=>queue.ingest(speech('b',1,0))).toThrow(/buffer limit/i);
  const first=queue.take(0)!;expect(queue.take(0)).toBeNull();
  queue.ingest(speech('b',1,100));expect(()=>queue.advance(100)).toThrow(/evidence limit/i);
  expect(queue.snapshot().events[0].id).toBe('a');expect(first.signal.aborted).toBe(false);
});

test('inputs and returned snapshots cannot mutate retained evidence; invalid clocks and accessors fail',()=>{
  const queue=scheduler();const event=speech('a',1,0);queue.ingest(event);event.text='mutated';queue.advance(0);
  const external=queue.snapshot().events[0];if(external.kind==='transcript')external.text='external mutation';expect(queue.snapshot().events[0]).toMatchObject({text:'a-1'});
  expect(()=>queue.advance(-1)).toThrow();expect(()=>queue.ingest({...speech('b',1,0),sourceId:'unknown'})).toThrow(/clock/i);
  let reads=0;expect(()=>queue.ingest({...speech('bad',1,1),get text(){reads++;return 'bad'}})).toThrow(/accessor/i);expect(reads).toBe(0);
  queue.dispose();expect(()=>queue.take(1)).toThrow(/disposed/i);
});

test('completion activates queued corrections first and cannot approve superseded work',()=>{
  const queue=scheduler();queue.ingest(speech('a',1,0));const plan=queue.take(150)!;
  queue.ingest(speech('a',2,200));expect(()=>queue.complete(plan.id,250)).toThrow(/active/i);
  expect(plan.signal.aborted).toBe(true);expect(queue.drainReceipts()[0].status).toBe('cancelled');
});

test('receipt backpressure preserves the unprocessed correction and resumes after draining',()=>{
  const queue=scheduler({maxReceipts:1});queue.ingest(speech('a',1,0));queue.complete(queue.take(150)!.id,160);
  queue.ingest(speech('a',2,200));const next=queue.take(350)!;queue.ingest(speech('a',3,400));
  expect(()=>queue.advance(400)).toThrow(/receipt limit/i);expect(next.signal.aborted).toBe(false);
  expect(queue.snapshot().events[0].version).toBe(2);queue.drainReceipts();queue.advance(400);
  expect(next.signal.aborted).toBe(true);expect(queue.snapshot().events[0].version).toBe(3);
});

test('opt-in partial planning is marked and caller mutation cannot alter deadlines or dependencies',()=>{
  const queue=scheduler({allowPartialPlans:true});queue.ingest(speech('a',1,0,'partial'));const plan=queue.take(150)!;
  expect(plan.usedPartialEvidence).toBe(true);plan.deadlineMs=1e9;plan.changes[0].version=999;
  const receipt=queue.complete(plan.id,10001);expect(receipt.withinDeadline).toBe(false);expect(receipt.usedPartialEvidence).toBe(true);
  expect(receipt.dependencies).toEqual([{id:'a',version:1}]);
});

test('disposal aborts active work and retains a cancellation receipt',()=>{
  const queue=scheduler();queue.ingest(speech('a',1,0));const plan=queue.take(150)!;queue.dispose();
  expect(plan.signal.aborted).toBe(true);expect(queue.summary().activePlans).toBe(0);
  expect(queue.drainReceipts()[0]).toMatchObject({status:'cancelled',reason:'disposed'});
});

import {expect,test} from 'bun:test';
import {EventEmitter} from 'node:events';
import {selectEvidence,generationDeadline,openEventStream,endEventStreams,watchDisconnect,cancelGeneration,requireAssetInventory,type JoinedEvidence} from './realtime-lecture-join.js';

const speech:JoinedEvidence={id:'chunk-0000',version:1,kind:'transcript',sourceId:'lecture',sourceStartMs:0,sourceEndMs:4000,
  sourceReadyAtMs:5000,availableAtMs:5300,text:'uncertain speech',trialRef:'local:trial'};
const frame:JoinedEvidence={id:'frame-1',version:1,kind:'frame',sourceId:'lecture',sourceStartMs:8000,sourceEndMs:8000,
  sourceReadyAtMs:9000,availableAtMs:9010,frameRef:'local:frame'};

test('stale or missing browser asset inventory cannot start or generate against a different host snapshot',()=>{
 const current='a'.repeat(64);
 expect(()=>requireAssetInventory(current,current)).not.toThrow();
 for(const value of [undefined,null,'b'.repeat(64),{},''])expect(()=>requireAssetInventory(value,current)).toThrow('inventory');
});

test('only released exact evidence versions can enter a model request',()=>{
  const ledger=new Map([[speech.id,speech],[frame.id,frame]]);
  expect(selectEvidence([{id:speech.id,version:1}],ledger,6000)).toEqual([speech]);
  for(const refs of [[{id:frame.id,version:1}],[{id:speech.id,version:2}],[{id:'invented',version:1}],
    [{id:speech.id,version:1,text:'substituted'}],[{id:speech.id,version:1},{id:speech.id,version:1}]])
    expect(()=>selectEvidence(refs,ledger,6000)).toThrow();
});

test('raw source endpoint deadline cannot be rebased by fresh context or caller',()=>{
  expect(generationDeadline([speech],20000,6000)).toBe(15000);
  expect(generationDeadline([speech],14000,6000)).toBe(14000);
  expect(generationDeadline([speech,frame],30000,10000)).toBe(15000);
  expect(()=>generationDeadline([speech],20000,15001)).toThrow('expired');
  expect(()=>generationDeadline([],20000,6000)).toThrow();
});

class Response extends EventEmitter {
  destroyed=false;writableEnded=false;headers:string[]=[];chunks:string[]=[];
  setHeader(name:string,_value:string){this.headers.push(name);return this;}
  flushHeaders(){this.headers.push('flushed');}
  write(chunk:string){this.chunks.push(chunk);return true;}
  end(){this.writableEnded=true;return this;}
}
test('invalid SSE cursors fail before headers; stopped streams replay then close',()=>{
  const response=new Response(),run={sequence:1,events:[{sequence:1,type:'session-stopped'}],clients:new Set<Response>(),stopped:true};
  expect(()=>openEventStream(run,response,'2')).toThrow();expect(response.headers).toEqual([]);
  openEventStream(run,response,'0');expect(response.chunks).toHaveLength(1);expect(response.writableEnded).toBe(true);expect(run.clients.size).toBe(0);
});
test('session finish closes every SSE client and releases retained references',()=>{
  const first=new Response(),second=new Response(),run={clients:new Set([first,second])};
  endEventStreams(run);expect(first.writableEnded).toBe(true);expect(second.writableEnded).toBe(true);expect(run.clients.size).toBe(0);
});
test('disconnect before listener registration aborts immediately and completed replies do not cancel',()=>{
  const early=new Response();early.destroyed=true;const controller=new AbortController();
  const clear=watchDisconnect({aborted:false},early,controller);expect(controller.signal.aborted).toBe(true);clear();
  const complete=new Response(),second=new AbortController(),cleanup=watchDisconnect({aborted:false},complete,second);
  complete.writableEnded=true;complete.emit('close');expect(second.signal.aborted).toBe(false);cleanup();
  expect(complete.listenerCount('close')).toBe(0);
});
test('cancellation acknowledgement waits for provider cleanup before permitting another plan',async()=>{
  let release!:()=>void,acknowledged=false;
  const active={planId:'plan-1',controller:new AbortController(),finished:new Promise<void>(resolve=>{release=resolve;})};
  const pending=cancelGeneration(active,'plan-1').then(()=>{acknowledged=true;});
  await Promise.resolve();expect(active.controller.signal.aborted).toBe(true);expect(acknowledged).toBe(false);
  release();await pending;expect(acknowledged).toBe(true);
});

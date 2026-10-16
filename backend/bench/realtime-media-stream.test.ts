import {expect,test} from 'bun:test';
import {mkdir,writeFile,readFile,unlink} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {openPcmWav,pacePcm,waitUntil,runPacedStream,WorkerLineReader} from './realtime-media-stream.js';

function wav(seconds=8){
  const buffer=Buffer.alloc(44+seconds*32000);
  buffer.write('RIFF');buffer.writeUInt32LE(buffer.length-8,4);buffer.write('WAVE',8);
  buffer.write('fmt ',12);buffer.writeUInt32LE(16,16);buffer.writeUInt16LE(1,20);buffer.writeUInt16LE(1,22);
  buffer.writeUInt32LE(16000,24);buffer.writeUInt32LE(32000,28);buffer.writeUInt16LE(2,32);buffer.writeUInt16LE(16,34);
  buffer.write('data',36);buffer.writeUInt32LE(seconds*32000,40);return buffer;
}
async function fixture(buffer:Buffer,body:(path:string)=>Promise<void>){
  const root=resolve('.tmp/realtime-media/producer-tests');await mkdir(root,{recursive:true});
  const path=join(root,`${randomUUID()}.wav`);await writeFile(path,buffer,{flag:'wx'});
  try{await body(path);}finally{await unlink(path);}
}

test('WAV metadata parser reads validated source ranges without preloading PCM',async()=>{
  const bytes=wav();bytes[44]=123;
  await fixture(bytes,async path=>{
    const source=await openPcmWav(path);
    try{
      expect(source.durationSec).toBe(8);expect(source.dataOffset).toBe(44);
      expect((await source.read(0,4))[0]).toBe(123);
      await expect(source.read(7,4)).rejects.toThrow();
      await expect(source.read(-1,4)).rejects.toThrow();
    }finally{await source.close();}
  });
});

test('WAV rejects unsupported formats, forged sizes and truncated chunks',async()=>{
  const stereo=wav();stereo.writeUInt16LE(2,22);
  const float=wav();float.writeUInt16LE(3,20);
  const size=wav();size.writeUInt32LE(9999999,40);
  const rate=wav();rate.writeUInt32LE(48000,24);
  for(const bytes of [stereo,float,size,rate,wav().subarray(0,43)])
    await fixture(bytes,async path=>{await expect(openPcmWav(path)).rejects.toThrow();});
});

test('paced producer does not read or send before each fixed source endpoint',async()=>{
  let now=100;const reads:number[]=[],sent:{at:number;end:number}[]=[];
  await pacePcm({durationSec:12,epochMs:100,sourceOffsetSec:885,signal:new AbortController().signal,
    now:()=>now,wait:async deadline=>{now=deadline;},
    read:async(start,duration)=>{reads.push(now);expect(now).toBeGreaterThanOrEqual(100+(start+duration)*1000);return Buffer.alloc(duration*32000);},
    send:async chunk=>{sent.push({at:now,end:chunk.sourceEndSec});if(sent.length===1)now+=5000;},
  });
  expect(reads).toEqual([4100,9100,12100]);
  expect(sent.map(x=>x.end)).toEqual([889,893,897]);
});

test('aborted source never reads future bytes and waiting rejects promptly',async()=>{
  const controller=new AbortController();let reads=0;
  await expect(pacePcm({durationSec:4,epochMs:0,sourceOffsetSec:0,signal:controller.signal,now:()=>0,
    wait:async()=>{controller.abort(new Error('cancelled'));},read:async()=>{reads++;return Buffer.alloc(128000);},send:async()=>{}})).rejects.toThrow();
  expect(reads).toBe(0);
  await expect(waitUntil(performance.now()+1000,controller.signal)).rejects.toThrow();
});

test('pacing rejects an early wakeup and invalid duration instead of releasing future bytes',async()=>{
  for(const durationSec of [3,64,NaN])
    await expect(pacePcm({durationSec,epochMs:0,sourceOffsetSec:0,signal:new AbortController().signal,
      now:()=>0,wait:async()=>{},read:async()=>Buffer.alloc(128000),send:async()=>{}})).rejects.toThrow();
  await expect(pacePcm({durationSec:4,epochMs:0,sourceOffsetSec:0,signal:new AbortController().signal,
    now:()=>0,wait:async()=>{},read:async()=>{throw Error('must not read');},send:async()=>{}})).rejects.toThrow('before source endpoint');
});

test('abort during initial mkdir is retained and never starts a worker',async()=>{
  await fixture(wav(),async audioPath=>{
    const out=resolve('.tmp/realtime-media/producer-tests',`setup-abort-${randomUUID()}`);
    const controller=new AbortController(),events:Record<string,unknown>[]=[];
    const running=runPacedStream({audioPath,sourceId:'test-source',sourceOffsetSec:0,
      pythonPath:join(out,'must-not-spawn.exe'),modelPath:join(out,'unused-model'),out,durationSec:4,
      signal:controller.signal,onEvent:event=>events.push(event)});
    // runPacedStream has reached its initial mkdir await; no hook or timer race.
    controller.abort(Error('Abort while creating output directory'));
    const result=await running;
    expect(result.error).toEqual({message:'Abort while creating output directory'});
    expect(result.releasedChunks).toBe(0);expect(result.acceptedTrials).toBe(0);
    expect(events.map(event=>event.type)).toEqual(['error','closed']);
    expect(JSON.parse(await readFile(join(out,'result.json'),'utf8')).status).toBe('failed');
  });
});

test('an inference-start cancellation blocks a trial already in the same stdout buffer',()=>{
  const controller=new AbortController(),published:string[]=[];
  const lines=new WorkerLineReader(event=>{
    published.push(event.type);
    if(event.type==='inference-start')controller.abort(Error('Evidence was corrected'));
  },controller.signal);
  const sameBuffer=Buffer.from('{"type":"inference-start","id":"chunk-0000"}\n{"type":"trial","receipt":{"id":"chunk-0000"}}\n');
  expect(()=>lines.push(sameBuffer)).toThrow('Evidence was corrected');
  expect(published).toEqual(['inference-start']);
  expect(()=>lines.push(Buffer.from('{"type":"trial"}\n'))).toThrow('Evidence was corrected');
  expect(published).toEqual(['inference-start']);
});

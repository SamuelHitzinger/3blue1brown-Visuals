/** Paced local recorded-source producer. No external inference, upload or world mutation. */
import {open,mkdir,readFile,writeFile,type FileHandle} from 'node:fs/promises';
import {openSync,writeSync,closeSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash,randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';

const finite=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value)&&value>=0;
function check(value:unknown,message:string):asserts value {if(!value)throw Error(message);}
const hash=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
async function exact(file:FileHandle,size:number,position:number){
  const bytes=Buffer.alloc(size);let offset=0;
  while(offset<size){const next=await file.read(bytes,offset,size-offset,position+offset);check(next.bytesRead>0,'Truncated WAV');offset+=next.bytesRead;}
  return bytes;
}

/** Read RIFF headers only. PCM is read later through bounded read(start,duration). */
export async function openPcmWav(path:string){
  const file=await open(resolve(path),'r');
  try{
    const stat=await file.stat();check(stat.isFile()&&stat.size>=44&&stat.size<=64*1024*1024,'WAV file size limit');
    const header=await exact(file,12,0);
    check(header.toString('ascii',0,4)==='RIFF'&&header.toString('ascii',8,12)==='WAVE'&&header.readUInt32LE(4)+8===stat.size,'Expected complete RIFF/WAVE');
    let format=false,dataOffset=-1,dataBytes=0,chunks=0,position=12;
    while(position<stat.size){
      check(++chunks<=256&&position+8<=stat.size,'WAV chunk limit');
      const chunk=await exact(file,8,position),kind=chunk.toString('ascii',0,4),size=chunk.readUInt32LE(4),start=position+8;
      check(start+size+(size%2)<=stat.size,'Truncated WAV chunk');
      if(kind==='fmt '){
        check(!format&&size>=16&&size<=64,'Unsupported WAV format chunk');
        const fmt=await exact(file,size,start);
        check(fmt.readUInt16LE(0)===1&&fmt.readUInt16LE(2)===1&&fmt.readUInt32LE(4)===16000&&fmt.readUInt32LE(8)===32000
          &&fmt.readUInt16LE(12)===2&&fmt.readUInt16LE(14)===16,'Expected mono 16kHz PCM16 WAV');format=true;
      }else if(kind==='data'){
        check(dataOffset<0&&size>0&&size%2===0,'Expected one nonempty PCM data chunk');dataOffset=start;dataBytes=size;
      }
      position=start+size+(size%2);
    }
    check(format&&dataOffset>=0,'Missing WAV format or data');
    const unchanged=async()=>{const current=await file.stat();check(current.size===stat.size&&current.mtimeMs===stat.mtimeMs,'WAV changed during run');};
    return {durationSec:dataBytes/32000,dataOffset,dataBytes,fileBytes:stat.size,modifiedAtMs:stat.mtimeMs,
      async read(startSec:number,durationSec:number){
        check(finite(startSec)&&finite(durationSec)&&durationSec>0&&durationSec<=4&&startSec+durationSec<=dataBytes/32000,'Invalid PCM read span');
        check(Number.isInteger(startSec*16000)&&Number.isInteger(durationSec*16000),'PCM span must align to samples');
        await unchanged();const bytes=await exact(file,durationSec*32000,dataOffset+startSec*32000);await unchanged();return bytes;
      },close:()=>file.close()};
  }catch(error){await file.close();throw error;}
}

export async function waitUntil(deadlineMs:number,signal:AbortSignal,now=()=>performance.now()){
  signal.throwIfAborted();
  while(now()<deadlineMs){
    await new Promise<void>((done,fail)=>{
      const cleanup=()=>signal.removeEventListener('abort',abort);
      const timer=setTimeout(()=>{cleanup();done();},Math.min(1000,Math.max(1,deadlineMs-now())));
      const abort=()=>{clearTimeout(timer);cleanup();fail(signal.reason??Error('Aborted'));};
      signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort();
    });
  }
  signal.throwIfAborted();
}

export interface ReleasedChunk {
  index:number;sourceStartSec:number;sourceEndSec:number;sourceReadyAtMs:number;readStartedAtMs:number;pcm:Buffer;
}
export async function pacePcm(options:{durationSec:number;epochMs:number;sourceOffsetSec:number;signal:AbortSignal;
  now?:()=>number;wait?:(deadlineMs:number)=>Promise<void>;beforeRead?:()=>Promise<void>;
  read:(startSec:number,durationSec:number)=>Promise<Buffer>;send:(chunk:ReleasedChunk)=>Promise<void>}){
  check(Number.isInteger(options.durationSec)&&options.durationSec>=4&&options.durationSec<=60&&options.durationSec%4===0,'Duration must be 4..60 seconds in four-second windows');
  check(finite(options.epochMs)&&finite(options.sourceOffsetSec)&&options.sourceOffsetSec<=1e9-options.durationSec,'Invalid source clock');
  const now=options.now??(()=>performance.now()),wait=options.wait??(deadline=>waitUntil(deadline,options.signal,now));
  for(let index=0;index<options.durationSec/4;index++){
    const sourceReadyAtMs=options.epochMs+(index+1)*4000;
    if(now()<sourceReadyAtMs)await wait(sourceReadyAtMs);
    options.signal.throwIfAborted();check(now()>=sourceReadyAtMs,'Cannot read before source endpoint');
    await options.beforeRead?.();options.signal.throwIfAborted();
    const readStartedAtMs=now(),pcm=await options.read(index*4,4);
    options.signal.throwIfAborted();check(pcm.length===128000,'Unexpected four-second PCM size');
    await options.send({index,sourceStartSec:options.sourceOffsetSec+index*4,sourceEndSec:options.sourceOffsetSec+(index+1)*4,
      sourceReadyAtMs,readStartedAtMs,pcm});
  }
}

function deferred<T>(){let resolve!:(value:T)=>void,reject!:(reason:unknown)=>void;const promise=new Promise<T>((a,b)=>{resolve=a;reject=b;});
  // Abort/error may occur before a particular receipt is awaited.
  void promise.catch(()=>{});return {promise,resolve,reject};}
function cancellable<T>(promise:Promise<T>,signal:AbortSignal):Promise<T>{
  return new Promise((done,fail)=>{const cleanup=()=>signal.removeEventListener('abort',abort);
    const abort=()=>{cleanup();fail(signal.reason??Error('Aborted'));};
    signal.addEventListener('abort',abort,{once:true});if(signal.aborted){abort();return;}
    promise.then(value=>{cleanup();done(value);},error=>{cleanup();fail(error);});});
}

/** Bounded worker stdout framing, shared by the process reader and protocol tests. */
export class WorkerLineReader {
  private buffer=Buffer.alloc(0);
  private bytes=0;
  constructor(private consume:(event:any,receivedAtMs:number)=>void,private signal:AbortSignal){}
  push(raw:Uint8Array){
    this.signal.throwIfAborted();
    const bytes=Buffer.from(raw);this.bytes+=bytes.length;check(this.bytes<=32*1024*1024,'Worker output budget exceeded');this.buffer=Buffer.concat([this.buffer,bytes]);
    let end:number;
    while((end=this.buffer.indexOf(10))>=0){this.signal.throwIfAborted();check(end<=1024*1024,'Worker line budget exceeded');const line=this.buffer.subarray(0,end);this.buffer=this.buffer.subarray(end+1);
      this.consume(JSON.parse(line.toString('utf8')),performance.now());this.signal.throwIfAborted();}
    check(this.buffer.length<=1024*1024,'Worker line budget exceeded');
  }
  finish(){this.signal.throwIfAborted();check(this.buffer.length===0,'Incomplete worker output');}
}

export interface PacedStreamOptions {
  audioPath:string;sourceId:string;sourceOffsetSec:number;pythonPath:string;modelPath:string;out:string;durationSec:number;
  language?:string;startupTimeoutMs?:number;trialTimeoutMs?:number;signal?:AbortSignal;onEvent?:(event:Record<string,unknown>)=>void;
}
export async function runPacedStream(options:PacedStreamOptions){
  check(typeof options.sourceId==='string'&&/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(options.sourceId),'Invalid source ID');
  check(finite(options.sourceOffsetSec)&&options.sourceOffsetSec<=1e9-options.durationSec,'Invalid source offset');
  check(Number.isInteger(options.durationSec)&&options.durationSec>=4&&options.durationSec<=60&&options.durationSec%4===0,'Duration must be 4..60 seconds in four-second windows');
  const startupTimeoutMs=options.startupTimeoutMs??30000,trialTimeoutMs=options.trialTimeoutMs??10000;
  const language=options.language??'en';check(/^[a-z]{2,3}$/.test(language),'Invalid ASR language code');
  for(const value of [startupTimeoutMs,trialTimeoutMs])check(Number.isInteger(value)&&value>=100&&value<=60000,'Invalid timeout');
  options.signal?.throwIfAborted();
  const directory=resolve(options.out);await mkdir(directory,{recursive:false});
  const eventsFile=openSync(join(directory,'events.ndjson'),'wx'),stderrFile=openSync(join(directory,'worker-stderr.txt'),'wx');
  const hostClockDomain=`host-performance:${randomUUID()}`,startedAtMs=performance.now();
  let source:Awaited<ReturnType<typeof openPcmWav>>|undefined,child:ReturnType<typeof spawn>|undefined;
  const controller=new AbortController(),signal=controller.signal,ready=deferred<any>(),closed=deferred<{code:number|null;signal:string|null}>();
  let requestedShutdown=false,workerComplete=false,pythonDomain:string|undefined,epochMs:number|null=null,sequence=0,stderrBytes=0;
  let workerExit:{code:number|null;signal:string|null}|null=null,killRequested=false;
  let accepted=0,released=0,pcmBytes=0;const pcmHash=createHash('sha256');
  type Pending={chunk:ReleasedChunk;chunkSentAtMs:number;sha256:string;started:boolean;done:ReturnType<typeof deferred<void>>;timer:ReturnType<typeof setTimeout>};
  const pending=new Map<string,Pending>();
  const emit=(event:Record<string,unknown>)=>{const value={sequence:++sequence,hostClockDomain,...event};writeSync(eventsFile,JSON.stringify(value)+'\n');
    try{options.onEvent?.(value);}catch(error){stop(error);}};
  const stop=(reason:unknown)=>{if(!signal.aborted)controller.abort(reason instanceof Error?reason:Error('Aborted'));};
  const externalAbort=()=>stop(options.signal?.reason);options.signal?.addEventListener('abort',externalAbort,{once:true});
  const kill=()=>{if(child)killRequested=child.kill('SIGKILL')||killRequested;};signal.addEventListener('abort',kill,{once:true});
  // Registration does not replay an abort that occurred during mkdir above.
  if(options.signal?.aborted)externalAbort();
  const hardTimer=setTimeout(()=>stop(Error('Host total deadline exceeded')),startupTimeoutMs+options.durationSec*1000+trialTimeoutMs+5000);
  let startupTimer:ReturnType<typeof setTimeout>|undefined;
  let outcome:Record<string,unknown>={status:'failed'};
  const write=async(message:unknown)=>{
    signal.throwIfAborted();const worker=child!;check(worker.stdin&&!worker.stdin.destroyed,'Worker input closed');
    await cancellable(new Promise<void>((done,fail)=>{worker.stdin!.write(JSON.stringify(message)+'\n',error=>error?fail(error):done());}),signal);
  };
  try{
    signal.throwIfAborted();
    source=await openPcmWav(options.audioPath);check(source.durationSec>=options.durationSec,'Requested duration exceeds source');
    const script=fileURLToPath(new URL('./realtime-media/local-asr.py',import.meta.url));
    const producerSource=await readFile(fileURLToPath(import.meta.url));
    await writeFile(join(directory,'producer-source.ts'),producerSource,{flag:'wx'});
    const identity={schemaVersion:1,evidenceKind:'paced-recorded-wav-to-local-asr',audioPath:resolve(options.audioPath),sourceId:options.sourceId,
      sourceOffsetSec:options.sourceOffsetSec,durationSec:options.durationSec,hostClockDomain,startedAtMs,
      producerSourceSha256:hash(producerSource),
      wav:{fileBytes:source.fileBytes,dataOffset:source.dataOffset,dataBytes:source.dataBytes,modifiedAtMs:source.modifiedAtMs},
      pythonPath:resolve(options.pythonPath),modelPath:resolve(options.modelPath),language,startupTimeoutMs,trialTimeoutMs,
      limitation:'Recorded source paced at one times speed. Python timestamps remain in their own domain. No model authoring, world commit, or presentation.'};
    await writeFile(join(directory,'started.json'),JSON.stringify(identity,null,2),{flag:'wx'});
    signal.throwIfAborted();
    emit({type:'worker-start',atMs:performance.now()});
    signal.throwIfAborted();
    child=spawn(resolve(options.pythonPath),['-B',script,'stream',`--model-path=${resolve(options.modelPath)}`,`--out=${join(directory,'worker')}`,
      `--max-chunks=${options.durationSec/4}`,`--max-audio-seconds=${options.durationSec}`,`--language=${language}`,
      `--idle-seconds=${Math.ceil((options.durationSec*1000+trialTimeoutMs)/1000)+2}`,`--session-seconds=${Math.ceil((options.durationSec*1000+trialTimeoutMs)/1000)+2}`],
      {windowsHide:true,stdio:['pipe','pipe','pipe']});
    child.on('error',error=>{workerExit={code:null,signal:'spawn-error'};closed.resolve(workerExit);stop(error);});
    child.stdin!.on('error',error=>stop(error));
    child.on('close',(code,termSignal)=>{workerExit={code,signal:termSignal};closed.resolve(workerExit);if(!requestedShutdown||code!==0)stop(Error('Worker closed before successful shutdown'));});
    child.stderr!.on('data',(bytes:Buffer)=>{const allowed=Math.max(0,65536-stderrBytes);if(allowed)writeSync(stderrFile,bytes.subarray(0,allowed));stderrBytes+=bytes.length;
      if(stderrBytes>65536)stop(Error('Worker stderr budget exceeded'));});
    startupTimer=setTimeout(()=>stop(Error('Worker ready deadline exceeded')),startupTimeoutMs);
    const consume=(event:any,receivedAtMs:number)=>{
      signal.throwIfAborted();
      check(event&&typeof event==='object'&&!Array.isArray(event)&&typeof event.type==='string','Invalid worker message');
      if(event.type==='ready'){
        check(!pythonDomain&&typeof event.clockDomain==='string'&&event.clockDomain.startsWith('python-perf-counter:'),'Invalid/repeated worker ready');
        pythonDomain=event.clockDomain;clearTimeout(startupTimer);emit({type:'ready',hostReceivedAtMs:receivedAtMs,python:event});signal.throwIfAborted();ready.resolve(event);return;
      }
      if(event.type==='error'){emit({type:'worker-error',hostReceivedAtMs:receivedAtMs,python:event});throw Error('Worker reported failure');}
      check(pythonDomain,'Worker emitted output before ready');
      if(event.type==='complete'){
        check(requestedShutdown&&pending.size===0&&!workerComplete&&event.status==='complete','Unexpected worker completion');
        workerComplete=true;emit({type:'worker-complete',hostReceivedAtMs:receivedAtMs,python:event});return;
      }
      check(event.type==='inference-start'||event.type==='trial','Unexpected worker event');
      const receipt=event.type==='trial'?event.receipt:event,work=pending.get(receipt?.id);
      check(work&&receipt.sourceId===options.sourceId&&receipt.clockDomain===pythonDomain,'Unmatched worker receipt');
      if(event.type==='inference-start'){
        check(!work.started,'Repeated inference start');work.started=true;
        emit({type:'inference-start',hostReceivedAtMs:receivedAtMs,chunkSentAtMs:work.chunkSentAtMs,python:event});return;
      }
      check(work.started&&event.trial&&event.pcmSha256===work.sha256,'Unmatched trial');
      const trial=event.trial;
      check(trial.sourceWindowStartSec===work.chunk.sourceStartSec&&trial.sourceWindowEndSec===work.chunk.sourceEndSec
        &&trial.availableAfterSourceSec===work.chunk.sourceEndSec&&trial.windowEndSec-trial.windowStartSec===4,'Trial source window mismatch');
      check([receipt.receivedAtMs,receipt.dequeuedAtMs,receipt.inferenceStartedAtMs,receipt.inferenceCompletedAtMs,trial.inferenceMs].every(finite)
        &&receipt.receivedAtMs<=receipt.dequeuedAtMs&&receipt.dequeuedAtMs<=receipt.inferenceStartedAtMs
        &&receipt.inferenceStartedAtMs<=receipt.inferenceCompletedAtMs
        &&Math.abs(receipt.inferenceCompletedAtMs-receipt.inferenceStartedAtMs-trial.inferenceMs)<1e-5,'Invalid worker timing');
      check(receivedAtMs-work.chunkSentAtMs+1e-5>=trial.inferenceMs,'Worker duration exceeds observed host bracket');
      signal.throwIfAborted();
      emit({type:'trial',hostReceivedAtMs:receivedAtMs,sourceReadyAtMs:work.chunk.sourceReadyAtMs,
        availability:{kind:'observed-host-bracket',chunkSentAtMs:work.chunkSentAtMs,trialReceivedAtMs:receivedAtMs},
        sourceEndpointToReceiptMs:receivedAtMs-work.chunk.sourceReadyAtMs,python:event});
      signal.throwIfAborted();
      clearTimeout(work.timer);pending.delete(receipt.id);accepted++;work.done.resolve();
    };
    const reading=(async()=>{const lines=new WorkerLineReader(consume,signal);
      for await(const raw of child!.stdout!)lines.push(raw);
      lines.finish();
    })();void reading.catch(stop);
    await cancellable(ready.promise,signal);signal.throwIfAborted();epochMs=performance.now();
    emit({type:'source-clock',sourceId:options.sourceId,sourceStartMs:options.sourceOffsetSec*1000,monotonicStartMs:epochMs,rate:1});
    await pacePcm({durationSec:options.durationSec,epochMs,sourceOffsetSec:options.sourceOffsetSec,signal,read:source.read,
      beforeRead:async()=>{if(pending.size>=2){emit({type:'backpressure',atMs:performance.now(),pendingChunks:pending.size});
        await cancellable(Promise.race([...pending.values()].map(work=>work.done.promise)),signal);}},
      send:async chunk=>{
        const id=`chunk-${String(chunk.index).padStart(4,'0')}`,chunkSentAtMs=performance.now(),sha256=hash(chunk.pcm),done=deferred<void>();
        const timer=setTimeout(()=>stop(Error(`Chunk result deadline exceeded: ${id}`)),trialTimeoutMs);
        pending.set(id,{chunk,chunkSentAtMs,sha256,started:false,done,timer});
        emit({type:'source-release',id,sourceId:options.sourceId,sourceStartSec:chunk.sourceStartSec,sourceEndSec:chunk.sourceEndSec,
          sourceReadyAtMs:chunk.sourceReadyAtMs,readStartedAtMs:chunk.readStartedAtMs,chunkSentAtMs,
          releaseLagMs:chunkSentAtMs-chunk.sourceReadyAtMs,pcmBytes:chunk.pcm.length,pcmSha256:sha256});
        await write({type:'chunk',id,sourceId:options.sourceId,sourceStartSec:chunk.sourceStartSec,sourceEndSec:chunk.sourceEndSec,pcm16Base64:chunk.pcm.toString('base64')});
        pcmHash.update(chunk.pcm);pcmBytes+=chunk.pcm.length;released++;emit({type:'source-sent',id,writeCompletedAtMs:performance.now()});
      }});
    await cancellable(Promise.all([...pending.values()].map(work=>work.done.promise)),signal);
    requestedShutdown=true;emit({type:'shutdown-request',atMs:performance.now()});await write({type:'shutdown'});
    const exit=await cancellable(closed.promise,signal);await cancellable(reading,signal);
    check(workerComplete&&exit.code===0,'Worker did not finish successfully');
    outcome={status:'complete',exit};
  }catch(error){stop(error);outcome={status:'failed',error:{message:error instanceof Error?error.message:'Stream failed'}};
    emit({type:'error',atMs:performance.now(),error:outcome.error});
  }finally{
    clearTimeout(hardTimer);clearTimeout(startupTimer);
    for(const work of pending.values()){clearTimeout(work.timer);work.done.reject(signal.reason??Error('Stream closed'));}
    if(child&&workerExit===null){kill();let timer:ReturnType<typeof setTimeout>|undefined;
      try{await Promise.race([closed.promise,new Promise(done=>{timer=setTimeout(done,3000);})]);}finally{clearTimeout(timer);}}
    await source?.close();options.signal?.removeEventListener('abort',externalAbort);signal.removeEventListener('abort',kill);
    outcome={...outcome,exit:workerExit,killRequested,workerClosed:workerExit!==null,hostClockDomain,pythonClockDomain:pythonDomain??null,sourceEpochMs:epochMs,sourceId:options.sourceId,
      sourceOffsetSec:options.sourceOffsetSec,durationSec:options.durationSec,releasedChunks:released,acceptedTrials:accepted,pcmBytes,
      releasedPcmSha256:pcmHash.digest('hex'),startedAtMs,finishedAtMs:performance.now(),
      limitation:'Host send/receive brackets only; Python absolute timestamps are not clock-mapped. No authoring, world commit or browser presentation.'};
    emit({type:'closed',...outcome});closeSync(eventsFile);closeSync(stderrFile);
    await writeFile(join(directory,'result.json'),JSON.stringify(outcome,null,2),{flag:'wx'});
  }
  return outcome;
}

const help='run --audio=PATH --source-id=ID --source-offset=SECONDS --python=PATH --model-path=PATH --out=NEW_DIRECTORY --duration-seconds=4..60 (multiple of 4) [--language=en] [--startup-timeout-ms=30000] [--trial-timeout-ms=10000]';
export async function main(args=process.argv.slice(2)){
  if(args[0]==='--help'){console.log(help);return;}
  check(args[0]==='run',help);const flags:Record<string,string>={};
  const allowed=['audio','source-id','source-offset','python','model-path','out','duration-seconds','startup-timeout-ms','trial-timeout-ms','language'];
  for(const arg of args.slice(1)){const match=/^--([a-z-]+)=(.+)$/.exec(arg);check(match&&allowed.includes(match[1])&&!Object.hasOwn(flags,match[1]),help);flags[match[1]]=match[2];}
  for(const field of allowed.slice(0,7))check(flags[field],help);
  const controller=new AbortController(),stop=()=>controller.abort(Error('Host interrupted'));process.once('SIGINT',stop);process.once('SIGTERM',stop);
  try{const result=await runPacedStream({audioPath:flags.audio,sourceId:flags['source-id'],sourceOffsetSec:Number(flags['source-offset']),pythonPath:flags.python,
    modelPath:flags['model-path'],out:flags.out,durationSec:Number(flags['duration-seconds']),language:flags.language,signal:controller.signal,
    ...(flags['startup-timeout-ms']?{startupTimeoutMs:Number(flags['startup-timeout-ms'])}:{}),...(flags['trial-timeout-ms']?{trialTimeoutMs:Number(flags['trial-timeout-ms'])}:{}),
    onEvent:event=>process.stdout.write(JSON.stringify(event)+'\n')});if(result.status!=='complete')process.exitCode=1;
  }finally{process.removeListener('SIGINT',stop);process.removeListener('SIGTERM',stop);}
}
if(import.meta.main)await main();

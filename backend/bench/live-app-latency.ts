/** Synthetic, paced audio -> production capture/transcription -> actual app animation.
 * No provider calls occur until the browser starts animation and /__latency/start is called.
 * CLI: NEW_EVIDENCE_DIRECTORY CLIP_MANIFEST_JSON [FRONTEND_DIRECTORY]
 */
import {appendFileSync} from 'node:fs';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {dirname,join,resolve} from 'node:path';
import {randomBytes,randomUUID} from 'node:crypto';
import {LectureService} from '../src/lectures.js';
import {LectureCaptureService} from '../src/lecture-capture.js';
import {createLectureMediaExtractor} from '../src/lecture-media.js';
import {lectureTranscriptionConfig} from '../src/lecture-transcription.js';
import {PiAgentRunner} from '../src/agents/runtime.js';
import {lectureAgentConfig} from '../src/agents/lecture-config.js';
import {LectureAnimationService} from '../src/lecture-animation.js';
import {createHandler} from '../src/server.js';

type Clip = {id:string;file:string;durationMs:number;sourceStartMs:number;releaseAtMs:number};
type Event = {type:string;epochMs:number;monotonicMs:number;[key:string]:unknown};
export async function main(args=process.argv.slice(2)) {
  if(args.length<2||args.length>3)throw Error('Use NEW_EVIDENCE_DIRECTORY CLIP_MANIFEST_JSON [FRONTEND_DIRECTORY].');
  const directory=resolve(args[0]), manifestPath=resolve(args[1]), origin='http://127.0.0.1:5371';
  const plan=JSON.parse(await readFile(manifestPath,'utf8')) as {durationMs:number;cues:unknown[];clips:Clip[]};
  if(!Array.isArray(plan.clips)||!plan.clips.length||plan.clips.length>60)throw Error('Provide 1–60 synthetic WAV clips.');
  const clips=new Map<string,Clip&{bytes:Uint8Array}>();
  for(const clip of plan.clips) {
    if(!/^[a-zA-Z0-9_-]{1,64}$/.test(clip.id)||clips.has(clip.id)||typeof clip.file!=='string'||!Number.isFinite(clip.durationMs)||clip.durationMs<=0||clip.durationMs>45000)throw Error('Invalid clip manifest.');
    if(!Number.isFinite(clip.sourceStartMs)||clip.sourceStartMs<0||clip.releaseAtMs!==clip.sourceStartMs+clip.durationMs)throw Error('Invalid capture window timing.');
    if(clips.size&&clip.releaseAtMs<Math.max(...[...clips.values()].map(item=>item.releaseAtMs)))throw Error('Capture windows must be ordered by release time.');
    const bytes=new Uint8Array(await readFile(resolve(dirname(manifestPath),clip.file)));
    if(bytes.length<44||bytes.length>5000000||Buffer.from(bytes.subarray(0,4)).toString()!=='RIFF'||Buffer.from(bytes.subarray(8,12)).toString()!=='WAVE')throw Error('Provide complete synthetic WAV files.');
    clips.set(clip.id,{...clip,bytes});
  }
  const transcription=lectureTranscriptionConfig();
  if(!transcription.apiKey)throw Error('Configured transcription provider has no API key.');
  await mkdir(directory);
  const events:Event[]=[];
  const record=(type:string,data:Record<string,unknown>={})=>{
    const event={...data,type,epochMs:Date.now(),monotonicMs:performance.now()};
    events.push(event);appendFileSync(join(directory,'events.jsonl'),`${JSON.stringify(event)}\n`);return event;
  };
  class TimedLectures extends LectureService {
    override appendSource(...args:Parameters<LectureService['appendSource']>) {
      const result=super.appendSource(...args);
      record('source_appended',{lectureId:args[1],key:args[2],sourceCursor:result.sourceRevision,sourceId:result.sources.at(-1)?.id,text:args[3],capture:args[4]});
      return result;
    }
  }
  const lectures=new TimedLectures(join(directory,'lectures.sqlite'));
  const extract=createLectureMediaExtractor(new PiAgentRunner(lectureAgentConfig('notes')),{transcription});
  const captureOrigin='https://latency.example.invalid'; // Origin validation only; never contacted.
  const captures=new LectureCaptureService(join(directory,'capture.sqlite'),lectures,{
    publicOrigin:captureOrigin,photo:false,audio:true,transcriptionProvider:transcription.provider,
    extract:async(file,metadata,signal)=>{
      record('transcription_start',{clientId:metadata.clientId});
      try {const result=await extract(file,metadata,signal);record('transcription_complete',{clientId:metadata.clientId,text:typeof result==='string'?result:result.text});return result;}
      catch(error){record('transcription_failed',{clientId:metadata.clientId,error:error instanceof Error?error.message:'Transcription failed'});throw error;}
    },
  });
  const animation=new LectureAnimationService(lectures);
  const handler=createHandler(args[2]?resolve(args[2]):undefined,undefined,undefined,undefined,lectures,captures,undefined,animation);
  const ownerRequest=(path:string,body:unknown)=>new Request(`${origin}${path}`,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','Idempotency-Key':randomUUID()},body:JSON.stringify(body)});
  const created=await handler(ownerRequest('/api/lectures',{title:'Speech-to-screen latency · synthetic audio'}));
  if(!created.ok)throw Error(`Lecture creation failed (${created.status}).`);
  const lecture=await created.json() as {id:string};
  const paired=await captures.handleOwner(ownerRequest(`/api/lectures/${lecture.id}/capture-pairings`,{}));
  if(!paired.ok)throw Error(`Capture pairing failed (${paired.status}).`);
  const pairing=await paired.json() as {url:string};
  const secret=new URLSearchParams(new URL(pairing.url).hash.slice(1)).get('pair'),token=randomBytes(32).toString('hex');
  const claimed=await captures.handleDevice(new Request(`${origin}/api/capture/claim`,{method:'POST',headers:{Origin:captureOrigin,'Content-Type':'application/json'},body:JSON.stringify({secret,deviceToken:token})}));
  if(!claimed.ok)throw Error(`Capture claim failed (${claimed.status}).`);
  let sequence=0,running=false,stopped=false;
  const jobs=new Set<Promise<void>>();
  async function feed(ids:string[],runId:string) {
    const start=record('stream_start',{runId,clipIds:ids});
    for(const id of ids){const clip=clips.get(id)!;record('capture_window',{runId,clipId:id,clientId:`${runId}-${id}`,sourceStartEpochMs:start.epochMs+clip.sourceStartMs,releaseEpochMs:start.epochMs+clip.releaseAtMs,durationMs:clip.durationMs});}
    try {
      for(const id of ids) {
        const clip=clips.get(id)!;const clientId=`${runId}-${id}`;
        await Bun.sleep(Math.max(0,start.monotonicMs+clip.releaseAtMs-performance.now()));
        if(stopped)return;
        const metadata={clientId,kind:'audio',sequence:++sequence,capturedAt:new Date(start.epochMs+clip.sourceStartMs).toISOString(),durationMs:clip.durationMs};
        const form=new FormData();form.set('metadata',JSON.stringify(metadata));form.set('file',new File([new Uint8Array(clip.bytes)],`${id}.wav`,{type:'audio/wav'}));
        record('upload_start',{runId,clipId:id,clientId,scheduledEpochMs:start.epochMs+clip.releaseAtMs});
        // Match CaptureQueue's serial upload lane, but do not wait for transcription.
        const upload=(async()=>{
          try {
            const response=await fetch(`${origin}/api/capture/items`,{method:'POST',headers:{Origin:captureOrigin,Authorization:`Bearer ${token}`},body:form});
            const body=await response.json();record('upload_accepted',{runId,clipId:id,clientId,status:response.status,result:body});
          }catch(error){record('upload_failed',{runId,clipId:id,clientId,error:error instanceof Error?error.message:'Upload failed'});}
        })();jobs.add(upload);await upload.finally(()=>jobs.delete(upload));
      }
      record('stream_end',{runId});
    }finally{running=false;}
  }
  const server=Bun.serve({hostname:'127.0.0.1',port:5371,idleTimeout:30,async fetch(request) {
    const path=new URL(request.url).pathname;
    if(path.startsWith('/__latency/')) {
      const requestOrigin=request.headers.get('origin');
      if(requestOrigin&&requestOrigin!==origin||request.headers.get('sec-fetch-site')==='cross-site')return new Response('Invalid origin',{status:403});
      if(path==='/__latency/clock'&&request.method==='GET')return Response.json({epochMs:Date.now(),monotonicMs:performance.now()});
      if(path==='/__latency/events'&&request.method==='GET')return Response.json({lectureId:lecture.id,running,events});
      if(request.method!=='POST')return new Response('Not found',{status:404});
      if(requestOrigin!==origin)return new Response('Origin required',{status:403});
      const body=await request.text();if(body.length>8192)return new Response('Too large',{status:413});
      let value:Record<string,unknown>;try{value=JSON.parse(body);}catch{return new Response('Invalid JSON',{status:400});}
      if(!value||typeof value!=='object'||Array.isArray(value))return new Response('Invalid object',{status:400});
      if(path==='/__latency/telemetry') {
        // Instrumented fixture reports renderer submission and next-frame opportunity,
        // never claims hardware presentation. Browser timestamps use Date.now().
        if(typeof value.event!=='string'||value.event.length>64||typeof value.browserEpochMs!=='number'||!Number.isFinite(value.browserEpochMs))return new Response('Invalid telemetry',{status:400});
        record('browser_telemetry',{observation:value});return Response.json({ok:true});
      }
      if(path==='/__latency/start') {
        const ids=value.clipIds;
        if(!Array.isArray(ids)||!ids.length||ids.length>60||ids.some(id=>typeof id!=='string'||!clips.has(id))||new Set(ids).size!==ids.length)return new Response('Unknown clip IDs',{status:400});
        if(running)return new Response('Stream already running',{status:409});
        const runId=randomUUID().slice(0,8);running=true;void feed(ids,runId).catch(()=>record('stream_failed',{runId}));
        return Response.json({runId,lectureId:lecture.id});
      }
      return new Response('Not found',{status:404});
    }
    if(path===`/api/lectures/${lecture.id}/animation`&&request.method==='POST') {
      const requestId=randomUUID(),input=await request.clone().json().catch(()=>null);
      record('animation_request_start',{requestId,sourceCursor:input?.sourceCursor,baseRevision:input?.baseRevision});
      const response=await handler(request),reply=await response.clone().json().catch(()=>null);
      record('animation_request_complete',{requestId,status:response.status,reply});return response;
    }
    return handler(request);
  }});
  const manifest={url:`${origin}/lectures/${lecture.id}`,lectureId:lecture.id,directory,transcriptionProvider:transcription.provider,
    clips:plan.clips,cues:plan.cues,durationMs:plan.durationMs,purpose:'Paced synthetic audio through real capture, transcription, model, and main app renderer. Local upload excludes phone network and microphone hardware.',
    startEndpoint:`${origin}/__latency/start`,telemetryEndpoint:`${origin}/__latency/telemetry`,eventsEndpoint:`${origin}/__latency/events`};
  await writeFile(join(directory,'manifest.json'),JSON.stringify(manifest,null,2),{flag:'wx'});
  console.log(JSON.stringify(manifest));
  const close=async()=>{if(stopped)return;stopped=true;server.stop(true);await Promise.allSettled([...jobs]);await animation.close();await captures.close();await lectures.close();process.exit(0);};
  process.on('SIGINT',()=>void close());process.on('SIGTERM',()=>void close());
  return {server,lectures,captures,events};
}
if(import.meta.main)await main();

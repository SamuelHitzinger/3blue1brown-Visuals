/** Offline browser publication fixture. Scripted transcripts/tool calls; no ASR,
 * capture, provider invocation, uploads, or claim about model generation speed. */
import {createServer} from 'vite';
import {mkdir,writeFile} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {dirname,join,resolve} from 'node:path';
import type {IncomingMessage,ServerResponse} from 'node:http';
import {acceptSubmission,type WorldSubmission} from './realtime-tool-probe.js';
import {joinSpeechTiming,resolveOperationSpeechAnchor} from './realtime-media/speech-anchor.js';
import {buildRetainedParameterCases,type RetainedCase} from './realtime-media/retained-parameter-proof.js';
import type {LocalAsrTrial} from './realtime-media/replay.js';

export const FIXTURE_LIMITS=Object.freeze({bodyBytes:120000,receipts:128,requests:24,files:240,outputBytes:16*1024*1024});
const caveat='OFFLINE SCRIPTED FIXTURE. Synthetic transcript and accepted tool calls; real browser runtime and renderer submission. No ASR/provider latency, live lecture, hardware presentation, or full browser topology proof.';
function check(value:unknown,message:string):asserts value{if(!value)throw Error(message);}
const finite=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value)&&value>=0;
const bytes=(value:unknown)=>Buffer.byteLength(JSON.stringify(value),'utf8');
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
type Body=Record<string,any>;
type Evidence={id:string;version:number;kind:'transcript';sourceId:string;sourceStartMs:number;sourceEndMs:number;
 sourceReadyAtMs:number;availableAtMs:number;speech:ReturnType<typeof joinSpeechTiming>};
type Pending={stage:number;planId:string;deadline:number;response:Body;
 dependencies:{id:string;version:number}[];availableAtMs:number;earliestChangeAvailableAtMs:number};

/** A single fixture run; the HTTP adapter serializes calls. Tests use an explicit
 * host clock but browser runs always use this process's performance.now(). */
export async function createParameterFixture(options:{selected:RetainedCase;directory:string;now?:()=>number}){
 const directory=resolve(options.directory),now=options.now??(()=>performance.now()),selected=options.selected;
 await mkdir(dirname(directory),{recursive:true});await mkdir(directory); // Existing output is never reused.
 const runId=randomUUID(),clockDomain=`offline-fixture-${randomUUID()}`;
 const inventory={inventoryId:createHash('sha256').update('offline-empty-model-inventory').digest('hex'),revision:0,assets:{}};
 const events:Body[]=[],ledger=new Map<string,Evidence>(),requests=new Set<string>();
 let files=0,outputBytes=0,requestCount=0,receiptCount=0,started=false,stopped=false,complete=false;
 let sourceEpoch=0,releasedStage=0,next:{stage:number;start:number;end:number}|undefined,pending:Pending|undefined;
 let previousWorld:Body|undefined,programId:string|undefined;
 const persist=async(kind:string,body:unknown)=>{
  const record={kind,serverRecordedAtMs:now(),clockDomain,body},text=JSON.stringify(record);
  check(files<FIXTURE_LIMITS.files&&outputBytes+Buffer.byteLength(text)<=FIXTURE_LIMITS.outputBytes,'Fixture output budget exceeded');
  const index=++files;outputBytes+=Buffer.byteLength(text);
  await writeFile(join(directory,`${String(index).padStart(4,'0')}-${kind}.json`),text,{flag:'wx'});
 };
 const publish=async(event:Body)=>{
  check(events.length<8,'Fixture event budget exceeded');
  const value={...event,sequence:events.length+1,serverClockDomain:clockDomain};
  await persist('event',value);events.push(value);
 };
 const bodyCheck=(body:Body)=>{check(body&&typeof body==='object'&&!Array.isArray(body),'Invalid request body');check(bytes(body)<=FIXTURE_LIMITS.bodyBytes,'Request byte budget exceeded');};
 const recordRequest=async(body:Body)=>{bodyCheck(body);check(++requestCount<=FIXTURE_LIMITS.requests,'Fixture request budget exceeded');await persist('request',body);};
 const refs=(input:unknown,at:number)=>{
  check(Array.isArray(input)&&input.length<=3,'Invalid evidence references');const seen=new Set<string>();
  return input.map((ref:any)=>{
   check(ref&&typeof ref.id==='string'&&Number.isSafeInteger(ref.version)&&Object.keys(ref).length===2&&!seen.has(ref.id),'Invalid evidence reference');
   seen.add(ref.id);const evidence=ledger.get(ref.id);
   check(evidence&&evidence.version===ref.version&&evidence.availableAtMs<=at,'Stale or unavailable evidence');return evidence;
  });
 };
 const inspectWorld=(body:Body,stage:number)=>{
  const w=body.world;check(w&&bytes(w)<=FIXTURE_LIMITS.bodyBytes&&JSON.stringify(w).length<=60000,'Invalid world context');
  const revision=stage===1?0:stage===2?1:2;
  check(body.baseRevision===revision&&w.summary?.revision===revision,'Unexpected world revision');
  check(Array.isArray(w.summary.programs)&&w.summary.programs.length===(stage===1?0:1),'Unexpected world programs');
  if(stage===1)return;
  const program=w.summary.programs[0],parameter=program.parameters?.find((p:any)=>p.id==='p');
  check(typeof program.id==='string'&&finite(program.epoch),'Missing actual program identity/epoch');
  check(parameter?.usable===true&&parameter.value===(stage===2?selected.initialValue:selected.values.p),'Wrong retained parameter value');
  check(Array.isArray(parameter.dependents)&&parameter.dependents.length>0&&parameter.omittedDependentCount===0,'Missing parameter ownership');
  check(w.frameCurrent===true&&w.sampledRevision===revision&&finite(w.sampledAt?.serverUpperMs),'Missing current sampled frame');
  const clock=w.elements?.find((e:any)=>e.id==='epoch-clock');
  const local=Math.max(0,Math.min(program.duration,w.sampledAt.serverUpperMs/1000-program.epoch));
  check(clock&&Math.abs(clock.rotation?.[2]-local*.1)<1e-8,'Original animation clock mismatch');
  check(Array.isArray(w.summary.entityIds)&&w.omissions?.entityIds===0&&w.omissions?.elements===0,'Incomplete entity inventory');
  const records=w.committedOperations?.records;
  check(Array.isArray(records)&&records.length===revision&&records.every((r:any,i:number)=>r.revision===i+1&&r.renderingStatus==='render-submitted'),'Missing rendered journal entries');
  check(records[0].operation?.action==='add'&&records[0].operation.programId===program.id&&records[0].operation.source===selected.source,'Incorrect retained add journal');
  if(stage===2){programId=program.id;previousWorld=structuredClone(w);return;}
  const previous=previousWorld!.summary.programs[0];
  check(program.id===programId&&program.epoch===previous.epoch,'Retained program identity/epoch changed');
  check(same(w.summary.entityIds,previousWorld!.summary.entityIds)&&same(program.ids,previous.ids),'Retained entity IDs changed');
  const before=previous.parameters.find((p:any)=>p.id==='p');
  check(same({...parameter,value:before.value},before),'Parameter controls or ownership changed');
  check(records[1].operation?.action==='parameters'&&same(records[1].operation.patch,{baseRevision:1,programId,values:selected.values}),'Incorrect parameter journal');
 };
 await persist('manifest',{label:caveat,runId,caseId:selected.id,sourceOffsetSeconds:885,inventory,source:selected.source,
  sourceSha256:createHash('sha256').update(selected.source).digest('hex'),initialValue:selected.initialValue,parameterValues:selected.values,
  provenance:selected.provenance??null,limits:FIXTURE_LIMITS});
 return {
  runId,clockDomain,inventory,events,directory,get stopped(){return stopped;},get complete(){return complete;},
  async start(inventoryId:unknown){
   check(inventoryId===inventory.inventoryId,'Unknown inventory');check(!started,'Fixture already started; reload with a new server/output directory');started=true;
   sourceEpoch=now();next={stage:1,start:sourceEpoch,end:sourceEpoch+250};
   await publish({type:'source-clock',sourceId:'scripted-lecture',sourceStartMs:885000,monotonicStartMs:sourceEpoch,rate:1});
   return {runId};
  },
  async release(){
   if(stopped||!next)return;
   const cue=next,offset=(cue.start-sourceEpoch)/1000,start=885+offset,end=start+.25;
   // Match the consumer's source-seconds -> milliseconds -> host mapping exactly.
   // Floating-point round trips may place this just after the nominal cue.end.
   const sourceReadyAtMs=sourceEpoch+(end*1000-885000),at=now();
   if(at<sourceReadyAtMs)return;
   next=undefined;
   const text=cue.stage===1?'show construction':cue.stage===2?'change parameter':'keep parameter';
   const [first,second]=text.split(' '),id=`scripted-speech-${cue.stage}`;
   const trial:LocalAsrTrial={windowStartSec:offset,windowEndSec:offset+.25,sourceWindowStartSec:start,sourceWindowEndSec:end,
    availableAfterSourceSec:end,inferenceMs:0,text,segments:[{text,words:[
     {word:first,startSec:0,endSec:.125,sourceStartSec:start,sourceEndSec:start+.125,probability:1},
     {word:second,startSec:.125,endSec:.25,sourceStartSec:start+.125,sourceEndSec:end,probability:1}]}]};
   const speech=joinSpeechTiming(trial,{sourceStartMs:885000,monotonicStartMs:sourceEpoch,rate:1});
   const evidence:Evidence={id,version:1,kind:'transcript',sourceId:'scripted-lecture',sourceStartMs:start*1000,sourceEndMs:end*1000,
    sourceReadyAtMs,availableAtMs:at,speech};
   await publish({type:'trial',version:1,availability:{kind:'observed-host-bracket',chunkSentAtMs:at,trialReceivedAtMs:at},
    python:{receipt:{id,sourceId:'scripted-lecture'},trial,trialRef:`offline:${selected.id}:${id}`}});
   ledger.set(id,evidence);releasedStage=cue.stage;
  },
  async generate(body:Body){
   await recordRequest(body);check(started&&!stopped&&body.runId===runId,'Unknown or stopped run');
   check(body.inventoryId===inventory.inventoryId,'Unknown inventory');
   check(/^plan-[1-9][0-9]{0,3}$/.test(body.planId),'Invalid plan ID');
   check(releasedStage>0&&body.evidence?.[0]?.id===`scripted-speech-${releasedStage}`,'Scripted speech not released');
   check(!requests.has(body.planId),'Plan already requested');check(!pending,'Previous plan awaits browser receipt');
   const at=now(),changes=refs(body.evidence,at),context=refs(body.context,at);
   check(changes.length===1&&!context.some(e=>e.id===changes[0].id),'Invalid changed/context evidence');
   inspectWorld(body,releasedStage);
   const evidence=changes[0],phrase=releasedStage===1?'show construction':releasedStage===2?'change parameter':'keep parameter';
   const anchor={evidenceId:evidence.id,version:1,phrase,occurrence:null,utteranceId:null};
   const args={action:releasedStage===1?'add':'parameters',reason:'',source:releasedStage===1?selected.source:'',changes:[],remove:[],
    parameterProgramId:releasedStage===1?'':programId!,parameterValues:releasedStage===1?[]:[{id:'p',value:selected.values.p}],speechAnchor:anchor};
   const call={type:'toolCall' as const,id:`scripted-${body.planId}`,name:'submit_world',arguments:args};
   const accepted=acceptSubmission('world',[call],[structuredClone(call)],true,true,true);
   check('action' in accepted&&accepted.action!=='defer','Fixture submission was not accepted');
   const submission=accepted as WorldSubmission;
   const resolvedSpeechAnchor=resolveOperationSpeechAnchor(submission.speechAnchor??null,[...changes,...context],at);
   check(resolvedSpeechAnchor!==null,'Scripted speech requires a resolved anchor');
   check(finite(body.deadlineServerMs),'Invalid deadline');
   const deadline=Math.min(body.deadlineServerMs,evidence.sourceReadyAtMs+10000,resolvedSpeechAnchor.deadlineMs);
   check(now()<deadline,'Original speech deadline expired');
   const response={submission,resolvedSpeechAnchor,deadlineServerMs:deadline,modelInventory:inventory,requestId:body.planId,
    fixture:{caseId:selected.id,scripted:true,providerInvoked:false,limitation:caveat}};
   await persist('response',response);check(now()<deadline,'Original speech deadline expired');
   requests.add(body.planId);pending={stage:releasedStage,planId:body.planId,deadline,response,
    dependencies:[...changes,...context].map(({id,version})=>({id,version})),
    availableAtMs:Math.max(...[...changes,...context].map(e=>e.availableAtMs)),earliestChangeAvailableAtMs:evidence.availableAtMs};return response;
  },
  async receipt(body:Body){
   bodyCheck(body);check(body.runId===runId,'Unknown run');check(++receiptCount<=FIXTURE_LIMITS.receipts,'Fixture receipt budget exceeded');
   await persist('browser-receipt',body);
   if(body.type==='render-submitted'){
    check(pending&&body.planId===pending.planId,'Unexpected render plan');
    const p=pending,o=body.outcome;
    check(p.stage<3&&o?.status==='render-submitted'&&o.baseWorldRevision===p.stage-1&&o.worldRevision===p.stage
     &&o.timing?.status==='complete'&&o.timing.withinDeadline===true&&o.timing.allChangesWithinDeadline===true
     &&same(o.timing.dependencies,p.dependencies)
     &&finite(body.serverUpperMs)&&body.serverUpperMs<p.deadline&&o.renderSubmittedAtMs===body.serverUpperMs
     &&finite(o.committedAtMs)&&o.committedAtMs<=body.serverUpperMs&&body.hardwarePresentedAtMs===null,'Invalid render receipt');
    // One clock read defines the complete source window. Separate reads would
    // make its mapped 250 ms duration disagree with the declared host endpoint.
    const nextStart=now()+1250;
    pending=undefined;next={stage:p.stage+1,start:nextStart,end:nextStart+250};
   }
   if(body.type==='scheduler-receipt'&&pending?.stage===3&&body.planId===pending.planId){
    const t=body.timing,p=pending;
    check(t?.status==='retired'&&t.reason==='unchanged parameters: no visual change committed'&&t.planId===p.planId
     &&finite(t.finishedAtMs)&&t.finishedAtMs>=p.availableAtMs&&t.finishedAtMs<p.deadline
     &&finite(body.serverUpperMs)&&body.serverUpperMs>=t.finishedAtMs
     &&t.withinDeadline===false&&t.allChangesWithinDeadline===false&&same(t.dependencies,p.dependencies)
     &&t.lastRequiredAvailableAtMs===p.availableAtMs&&t.deadlineMs===p.availableAtMs+10000
     &&t.earliestChangeDeadlineMs===p.earliestChangeAvailableAtMs+10000,'Unexpected final no-op outcome');
    await persist('result',{status:'scripted-browser-sequence-complete',caseId:selected.id,lastObservedWorldRevision:2,noopRetiredWithoutCoverage:true,
     checks:['original epoch and motion','parameter value and ownership','same exposed entity IDs','exact rendered add and parameter journal','same-value operation retired'],
     limitation:caveat});complete=true;pending=undefined;
   }
   return {saved:true};
  },
  async stop(reason='fixture-stop'){if(stopped)return;stopped=true;next=undefined;await persist('stopped',{reason,complete});},
  async cancel(body:Body){bodyCheck(body);check(body.runId===runId,'Unknown run');await persist('cancel',body);pending=undefined;next=undefined;return {cancelled:true,cleanupComplete:true};},
 };
}

async function readBody(req:IncomingMessage):Promise<Body>{
 const chunks:Buffer[]=[];let size=0;
 for await(const chunk of req){const bytes=Buffer.from(chunk);size+=bytes.length;check(size<=FIXTURE_LIMITS.bodyBytes,'Request byte budget exceeded');chunks.push(bytes);}
 const body=JSON.parse(Buffer.concat(chunks).toString('utf8'));check(body&&typeof body==='object'&&!Array.isArray(body),'Invalid JSON body');return body;
}

/** Usage: CASE_ID NEW_OUTPUT_DIRECTORY. One explicit Start, three scripted calls. */
export async function main(args=process.argv.slice(2)){
 check(args.length===2,'Use CASE_ID NEW_OUTPUT_DIRECTORY');
 const selected=(await buildRetainedParameterCases()).find(c=>c.id===args[0]);check(selected,'Unknown retained case ID');
 const fixture=await createParameterFixture({selected,directory:args[1]}),repo=resolve(import.meta.dir,'../..');
 const origin='http://127.0.0.1:5368',clients=new Set<ServerResponse>();let delivered=0;
 let serial:Promise<unknown>=Promise.resolve();
 const enqueue=<T>(fn:()=>Promise<T>):Promise<T>=>{const task=serial.then(fn);serial=task.catch(()=>{});return task;};
 const broadcast=()=>{for(const event of fixture.events.slice(delivered)){for(const res of clients)res.write(`id: ${event.sequence}\ndata: ${JSON.stringify(event)}\n\n`);}delivered=fixture.events.length;};
 const server=await createServer({configFile:false,root:join(import.meta.dir,'realtime-lecture-view'),
  server:{host:'127.0.0.1',port:5368,strictPort:true,fs:{allow:[repo]}},
  optimizeDeps:{exclude:['quickjs-emscripten','quickjs-emscripten-core','@jitl/quickjs-wasmfile-release-sync','@jitl/quickjs-wasmfile-release-asyncify']},
  plugins:[{name:'fixture-native-build',enforce:'pre',resolveId(source){const prefix='../../../shared/animlib/src/';if(source.startsWith(prefix))return join(repo,'shared/animlib/dist',source.slice(prefix.length));}},
   {name:'offline-parameter-fixture',transformIndexHtml(html){return html.replace('<title>Live lecture · continuous world</title>',`<title>OFFLINE SCRIPTED FIXTURE · ${selected.id}</title>`)
    .replace('<h1>Live lecture · continuous world</h1>',`<h1>OFFLINE SCRIPTED FIXTURE · ${selected.id}</h1>`)
    .replace('<p id="status"',`<p style="margin:0 24px 12px;color:#ffd580">${caveat}</p><p id="status"`);},
   configureServer(vite){vite.middlewares.use((req,res,next)=>{
    const url=new URL(req.url??'/',origin),route=url.pathname;
    if(!['/clock','/lecture-assets','/start','/events','/generate','/receipt','/cancel','/stop'].includes(route))return next();
    const json=(body:unknown,status=200)=>{if(res.destroyed)return;res.statusCode=status;res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(body));};
    void enqueue(async()=>{
     if(req.method==='GET'&&route==='/clock'){json({serverTimeMs:performance.now(),clockDomain:fixture.clockDomain});return;}
     if(req.method==='GET'&&route==='/lecture-assets'){json(fixture.inventory);return;}
     if(req.method==='GET'&&route==='/events'){
      check(url.searchParams.get('runId')===fixture.runId&&!fixture.stopped,'Unknown or stopped run');check(clients.size<2,'Too many event clients');
      const cursor=Number(req.headers['last-event-id']??0);check(Number.isSafeInteger(cursor)&&cursor>=0&&cursor<=fixture.events.length,'Invalid event cursor');
      res.setHeader('Content-Type','text/event-stream');res.setHeader('Cache-Control','no-store');res.setHeader('Connection','keep-alive');res.flushHeaders();
      for(const event of fixture.events.slice(cursor))res.write(`id: ${event.sequence}\ndata: ${JSON.stringify(event)}\n\n`);
      clients.add(res);res.on('close',()=>clients.delete(res));return;
     }
     check(req.method==='POST'&&req.headers.origin===origin,'Local same-origin POST required');const body=await readBody(req);
     if(route==='/start')json(await fixture.start(body.inventoryId));
     else if(route==='/generate')json(await fixture.generate(body));
     else if(route==='/receipt')json(await fixture.receipt(body));
     else if(route==='/cancel')json(await fixture.cancel(body));
     else if(route==='/stop'){check(body.runId===fixture.runId,'Unknown run');await fixture.stop();json({stopped:true});}
     else throw Error('Invalid fixture route');
     broadcast();
    }).catch(error=>json({error:error instanceof Error?error.message:String(error)},400));
   });}}]});
 let ticking=false;
 const timer=setInterval(()=>{if(ticking)return;ticking=true;void enqueue(async()=>{await fixture.release();broadcast();})
  .catch(error=>{console.error(error);void fixture.stop('fixture-release-failed');}).finally(()=>{ticking=false;});},25);
 const close=server.close.bind(server);server.close=async()=>{clearInterval(timer);for(const res of clients)res.end();clients.clear();await serial;await fixture.stop('server-close');await close();};
 try{await server.listen();}catch(error){await server.close();throw error;}
 console.log(JSON.stringify({url:origin,status:'offline-fixture-ready',caseId:selected.id,outputDirectory:fixture.directory,clockDomain:fixture.clockDomain,limitation:caveat}));
 return server;
}
if(import.meta.main)main().then(server=>{
 let closing=false;
 const close=()=>{if(closing)return;closing=true;void server.close().catch(error=>{console.error(error);process.exitCode=1;});};
 process.once('SIGINT',close);process.once('SIGTERM',close);
}).catch(error=>{console.error(error);process.exitCode=1;});

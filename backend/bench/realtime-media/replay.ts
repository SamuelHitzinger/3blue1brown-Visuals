/** Causal media adapter, not a second scheduler or live-pipeline acceptance test.
 * References are opaque: this module reads no files, resolves no images, and
 * calls no model. Call advance/take on the host monotonic millisecond clock.
 */
import {EvidenceScheduler,type AvailableEvidence,type EvidencePlan,type PlanReceipt,type SchedulerOptions,type SourceClock} from './events.js';
import {measuredTiming,type AsrSegment} from './timing.js';

/** Exact relevant fields of local-asr.py trial-N.json; additional retained metrics are ignored. */
export interface LocalAsrTrial {
  windowStartSec:number;windowEndSec:number;sourceWindowStartSec:number;sourceWindowEndSec:number;
  availableAfterSourceSec:number;inferenceMs:number;text:string;segments:AsrSegment[];
}
export type AsrAvailability=
  |{kind:'observed';inferenceStartedAtMs:number;inferenceCompletedAtMs:number}
  |{kind:'measured-duration-replay';inferenceStartedAtMs:number};
export interface AsrInput {
  id:string;version:number;sourceId:string;trialRef:string;trial:LocalAsrTrial;
  availability:AsrAvailability;state?:'partial'|'stable';
}
export interface FrameInput {id:string;version:number;sourceId:string;sourceTimeMs:number;arrivedAtMs:number;frameRef:string}
type AsrMetadata={trialRef:string;timing:ReturnType<typeof measuredTiming>;availability:{
  kind:AsrAvailability['kind'];inferenceStartedAtMs:number;inferenceCompletedAtMs:number;inferenceMs:number;
}};
export type PacketEvidence=AvailableEvidence&{asr?:AsrMetadata};
export interface EvidencePacket {
  schemaVersion:1;planId:string;evidenceRevision:number;baseWorldRevision:number;plannedAtMs:number;
  changes:PacketEvidence[];context:PacketEvidence[];usedPartialEvidence:boolean;
  lastRequiredAvailableAtMs:number;deadlineMs:number;earliestChangeDeadlineMs:number;
  obligations:EvidencePlan['obligations'];limitation:string;
}
export type CommitMeasurement=
  |{status:'failed';atMs:number;reason:string}
  |{status:'render-submitted';atMs:number;committedAtMs:number;baseWorldRevision:number;worldRevision:number;currentWorldRevision?:number};
export interface CommitReceipt {
  status:'failed'|'render-submitted';timing:PlanReceipt;baseWorldRevision:number;
  committedAtMs:number|null;renderSubmittedAtMs:number|null;worldRevision:number|null;
  obligations:EvidencePlan['obligations'];hardwarePresentedAtMs:null;semanticCompletion:'unknown';
}
export type ReplayOptions=Omit<SchedulerOptions,'deadlineMs'>&{maxMetadataBytes?:number};
type MetadataRecord={id:string;version:number;availableAtMs:number;bytes:number;data:AsrMetadata};
const key=(id:string,version:number)=>JSON.stringify([id,version]);
const close=(a:number,b:number)=>Math.abs(a-b)<=1e-5;
function check(value:unknown,message:string):asserts value{if(!value)throw new Error(message);}
function stamp(value:unknown):asserts value is number{check(typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=1e12,'Invalid measured timestamp');}
function revision(value:unknown):asserts value is number{check(Number.isSafeInteger(value)&&Number(value)>=0,'Invalid world revision');}
function reference(value:unknown):asserts value is string{
  check(typeof value==='string'&&value.trim().length>0&&value.length<=4096&&!/[\r\n]/.test(value)&&!/^\s*(data|blob):/i.test(value),'Expected an opaque source reference, not embedded image data');
}
function plainData(value:unknown,depth=0):void{
  check(depth<=16,'Input nesting limit exceeded');
  if(value===null||['string','boolean','undefined'].includes(typeof value))return;
  if(typeof value==='number'){check(Number.isFinite(value),'Input numbers must be finite');return;}
  check(typeof value==='object'&&(Array.isArray(value)||Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null),'Expected plain input data');
  check(Object.keys(value).length<=20000,'Input item limit exceeded');
  for(const [name,descriptor] of Object.entries(Object.getOwnPropertyDescriptors(value))){
    check(!descriptor.get&&!descriptor.set&&!['__proto__','constructor','prototype'].includes(name),'Unsafe input member');plainData(descriptor.value,depth+1);
  }
}
const bytes=(value:unknown)=>new TextEncoder().encode(JSON.stringify(value)).length;

export class MediaReplay {
  private scheduler:EvidenceScheduler;
  private clocks:Record<string,SourceClock>;
  private metadata=new Map<string,MetadataRecord>();
  private metadataBytes=0;
  private maxMetadataBytes:number;
  private plans=new Map<string,{plan:EvidencePlan;baseWorldRevision:number}>();
  private disposed=false;
  constructor(options:ReplayOptions){
    plainData(options);const {maxMetadataBytes=4_000_000,...schedulerOptions}=options;
    check(Number.isSafeInteger(maxMetadataBytes)&&maxMetadataBytes>=1&&maxMetadataBytes<=64_000_000,'Invalid metadata budget');
    this.scheduler=new EvidenceScheduler({...schedulerOptions,deadlineMs:10000});
    this.clocks=structuredClone(options.sourceClocks);this.maxMetadataBytes=maxMetadataBytes;
  }
  private alive(){check(!this.disposed,'Media replay disposed');}
  private sourceTime(sourceId:string,sourceMs:number){
    const clock=Object.hasOwn(this.clocks,sourceId)?this.clocks[sourceId]:undefined;check(clock,'Unknown source clock');
    const mapped=clock.monotonicStartMs+(sourceMs-(clock.sourceStartMs??0))/(clock.rate??1);stamp(mapped);return mapped;
  }
  private prune(){
    const snapshot=this.scheduler.snapshot({includePartial:true,includeRetracted:true});
    const live=new Set(snapshot.events.map(event=>key(event.id,event.version)));
    for(const [id,record] of this.metadata)if(record.availableAtMs<=snapshot.asOfMs&&!live.has(id)){
      this.metadata.delete(id);this.metadataBytes-=record.bytes;
    }
  }
  ingestFrame(input:FrameInput){
    this.alive();plainData(input);reference(input.frameRef);
    return this.scheduler.ingest({id:input.id,version:input.version,kind:'frame',state:'stable',sourceId:input.sourceId,
      sourceStartMs:input.sourceTimeMs,sourceEndMs:input.sourceTimeMs,arrivedAtMs:input.arrivedAtMs,frameRef:input.frameRef});
  }
  ingestAsrTrial(input:AsrInput){
    this.alive();plainData(input);check(bytes(input)<=256000,'ASR trial input limit exceeded');reference(input.trialRef);
    const {trial,availability}=input;
    for(const value of [trial.windowStartSec,trial.windowEndSec,trial.sourceWindowStartSec,trial.sourceWindowEndSec,trial.availableAfterSourceSec,trial.inferenceMs])stamp(value);
    const duration=trial.windowEndSec-trial.windowStartSec;
    check(duration>0&&close(trial.sourceWindowEndSec-trial.sourceWindowStartSec,duration)&&close(trial.availableAfterSourceSec,trial.sourceWindowEndSec),'Inconsistent ASR source window');
    check(typeof trial.text==='string'&&Array.isArray(trial.segments),'Invalid ASR transcript');
    const timing=measuredTiming({id:'window',durationSec:duration,sourceOffsetSec:trial.sourceWindowStartSec,segments:trial.segments});
    check(trial.segments.map(segment=>segment.text).join('').trim()===trial.text,'ASR trial text disagrees with measured segments');
    check(input.state===undefined||input.state==='partial'||input.state==='stable','Invalid ASR state');
    check(availability.kind==='observed'||availability.kind==='measured-duration-replay','Invalid ASR availability kind');
    stamp(availability.inferenceStartedAtMs);
    const sourceReadyAtMs=this.sourceTime(input.sourceId,trial.sourceWindowEndSec*1000);
    check(availability.inferenceStartedAtMs>=sourceReadyAtMs,'ASR inference cannot start before its complete source window is available');
    const completed=availability.kind==='observed'?availability.inferenceCompletedAtMs:availability.inferenceStartedAtMs+trial.inferenceMs;
    stamp(completed);
    check(completed>=availability.inferenceStartedAtMs+trial.inferenceMs-1e-5,'ASR completion omits measured inference time');
    const data:AsrMetadata={trialRef:input.trialRef,timing,availability:{kind:availability.kind,inferenceStartedAtMs:availability.inferenceStartedAtMs,inferenceCompletedAtMs:completed,inferenceMs:trial.inferenceMs}};
    const identity=key(input.id,input.version),previous=this.metadata.get(identity),size=bytes(data);
    if(previous)check(JSON.stringify(previous.data)===JSON.stringify(data),'Conflicting ASR measurement for the same evidence version');
    else check(this.metadataBytes+size<=this.maxMetadataBytes,'ASR metadata budget reached; persist and start a bounded window');
    const result=this.scheduler.ingest({id:input.id,version:input.version,kind:'transcript',state:input.state==='partial'?'partial':trial.text?'stable':'retracted',
      sourceId:input.sourceId,sourceStartMs:trial.sourceWindowStartSec*1000,sourceEndMs:trial.sourceWindowEndSec*1000,arrivedAtMs:completed,text:trial.text});
    if(result==='queued'){
      this.metadata.set(identity,{id:input.id,version:input.version,availableAtMs:completed,bytes:size,data:structuredClone(data)});this.metadataBytes+=size;
    }
    return result;
  }
  advance(nowMs:number){this.alive();try{return this.scheduler.advance(nowMs);}finally{this.prune();}}
  take(nowMs:number,options:{worldRevision:number;contextIds?:string[]}):{packet:EvidencePacket;signal:AbortSignal}|null{
    this.alive();plainData(options);revision(options.worldRevision);
    const plan=this.scheduler.take(nowMs,{contextIds:options.contextIds});this.prune();if(!plan)return null;
    this.plans.set(plan.id,{plan,baseWorldRevision:options.worldRevision});
    plan.signal.addEventListener('abort',()=>this.plans.delete(plan.id),{once:true});
    const enrich=(event:AvailableEvidence):PacketEvidence=>{
      const record=this.metadata.get(key(event.id,event.version));
      return {...structuredClone(event),...(record?{asr:structuredClone(record.data)}:{})};
    };
    return {signal:plan.signal,packet:{schemaVersion:1,planId:plan.id,evidenceRevision:plan.evidenceRevision,baseWorldRevision:options.worldRevision,plannedAtMs:plan.plannedAtMs,
      changes:plan.changes.map(enrich),context:plan.context.map(enrich),usedPartialEvidence:plan.usedPartialEvidence,
      lastRequiredAvailableAtMs:plan.lastRequiredAvailableAtMs,deadlineMs:plan.deadlineMs,earliestChangeDeadlineMs:plan.earliestChangeDeadlineMs,obligations:structuredClone(plan.obligations),
      limitation:'Measured-duration replay is not live capture proof. Frames are references, not inspected images. ASR words are uncorrected estimates. Render submission is not hardware presentation or semantic completion.'}};
  }
  /** atMs is the measured render-submission time (or failure time), in the host clock.
   * Record immediately and monotonically; never replace it with world commit time.
   * World revision assertions supplement, never replace, LiveWorld baseRevision checks.
   */
  commit(planId:string,input:CommitMeasurement):CommitReceipt{
    this.alive();plainData(input);stamp(input.atMs);check(input.status==='failed'||input.status==='render-submitted','Invalid commit status');
    const pending=this.plans.get(planId);check(pending&&!pending.plan.signal.aborted,'Plan is not active');
    check(input.atMs>=pending.plan.plannedAtMs,'Commit measurement precedes dispatch');
    let mismatch=false;
    if(input.status==='render-submitted'){
      stamp(input.committedAtMs);revision(input.baseWorldRevision);revision(input.worldRevision);
      if(input.currentWorldRevision!==undefined)revision(input.currentWorldRevision);
      check(input.committedAtMs>=pending.plan.plannedAtMs&&input.committedAtMs<=input.atMs,'Invalid commit/render ordering');
      mismatch=input.baseWorldRevision!==pending.baseWorldRevision||input.worldRevision!==pending.baseWorldRevision+1
        ||input.currentWorldRevision!==undefined&&input.currentWorldRevision!==input.worldRevision;
    }else check(typeof input.reason==='string'&&input.reason.length>0&&input.reason.length<=256,'Invalid failure reason');
    const success=input.status==='render-submitted'&&!mismatch;
    const timing=success?this.scheduler.complete(planId,input.atMs):this.scheduler.fail(planId,input.atMs,mismatch?'world-revision-mismatch':(input as Extract<CommitMeasurement,{status:'failed'}>).reason);
    this.plans.delete(planId);this.prune();
    return {status:success?'render-submitted':'failed',timing,baseWorldRevision:pending.baseWorldRevision,
      committedAtMs:input.status==='render-submitted'?input.committedAtMs:null,renderSubmittedAtMs:input.status==='render-submitted'?input.atMs:null,
      worldRevision:input.status==='render-submitted'?input.worldRevision:null,obligations:structuredClone(pending.plan.obligations),hardwarePresentedAtMs:null,semanticCompletion:'unknown'};
  }
  drainReceipts(){return this.scheduler.drainReceipts();}
  summary(){return {...this.scheduler.summary(),metadataRecords:this.metadata.size,metadataBytes:this.metadataBytes};}
  dispose(){if(this.disposed)return;this.scheduler.dispose();this.metadata.clear();this.metadataBytes=0;this.plans.clear();this.disposed=true;}
}

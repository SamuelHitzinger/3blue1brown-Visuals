/** Connector-ready experiment only: timestamped evidence and explicit work plans.
 * No recognition, semantic grouping, model calls, timers or visual mutations.
 * Call advance/take as the monotonic clock advances. Preloaded replay events
 * become visible only after BOTH transport arrival and their source-clock time.
 */
interface EventBase { id:string; version:number; sourceId:string; sourceStartMs:number; sourceEndMs:number; arrivedAtMs:number }
export interface TranscriptEvent extends EventBase { kind:'transcript'; state:'partial'|'stable'|'retracted'; text:string }
export interface FrameEvent extends EventBase { kind:'frame'; state:'stable'|'retracted'; frameRef:string }
export type EvidenceEvent=TranscriptEvent|FrameEvent;
export type AvailableEvidence=EvidenceEvent&{sourceReadyAtMs:number;availableAtMs:number;captureDelayMs:number;evidenceRevision:number};
export interface SourceClock { sourceStartMs?:number;monotonicStartMs:number;rate?:number }
export interface SchedulerOptions {
  sourceClocks:Record<string,SourceClock>;
  quietMs?:number;maxWaitMs?:number;deadlineMs?:number;
  maxBufferedEvents?:number;maxEvidence?:number;maxActivePlans?:number;maxEventsPerPlan?:number;maxContextEvents?:number;maxReceipts?:number;
  allowPartialPlans?:boolean;
}
export interface EvidencePlan {
  id:string;evidenceRevision:number;plannedAtMs:number;
  changes:AvailableEvidence[];context:AvailableEvidence[];
  lastRequiredAvailableAtMs:number;deadlineMs:number;earliestChangeDeadlineMs:number;
  obligations:{id:string;version:number;availableAtMs:number;deadlineMs:number}[];
  usedPartialEvidence:boolean;signal:AbortSignal;
}
export interface PlanReceipt {
  planId:string;status:'complete'|'failed'|'cancelled';reason?:string;finishedAtMs:number;
  evidenceRevision:number;lastRequiredAvailableAtMs:number;deadlineMs:number;earliestChangeDeadlineMs:number;
  inputToResultMs:number;withinDeadline:boolean;allChangesWithinDeadline:boolean;usedPartialEvidence:boolean;
  dependencies:{id:string;version:number}[];
}
type Staged=EvidenceEvent&{sourceReadyAtMs:number;availableAtMs:number;captureDelayMs:number};
type Dirty={event:AvailableEvidence;firstQueuedAtMs:number};
type InternalPlan=Omit<EvidencePlan,'signal'>&{controller:AbortController;queuedAt:Map<string,number>};
function check(value:unknown,message:string):asserts value{if(!value)throw new Error(message);}
function stamp(value:unknown,label:string):asserts value is number{check(typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=1e12,`Invalid ${label}`);}
function identifier(value:unknown):asserts value is string{check(typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9_.:/-]{0,191}$/.test(value),'Invalid evidence ID');}
function plain(value:unknown):asserts value is Record<string,unknown>{
  check(value!==null&&typeof value==='object'&&!Array.isArray(value)&&(Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null),'Expected plain event data');
  for(const [key,descriptor] of Object.entries(Object.getOwnPropertyDescriptors(value)))check(!descriptor.get&&!descriptor.set&&!['__proto__','constructor','prototype'].includes(key),'Unsafe accessor or member');
}
const eventIdentity=(event:EvidenceEvent)=>JSON.stringify([event.id,event.version,event.kind,event.state,event.sourceId,event.sourceStartMs,event.sourceEndMs,event.kind==='transcript'?event.text:event.frameRef]);
const sourceOrder=(a:AvailableEvidence,b:AvailableEvidence)=>a.sourceEndMs-b.sourceEndMs||a.id.localeCompare(b.id);

export class EvidenceScheduler {
  private clocks:Record<string,Required<SourceClock>>=Object.create(null);
  private staged:Staged[]=[];
  private current=new Map<string,AvailableEvidence>();
  private dirty=new Map<string,Dirty>();
  private active=new Map<string,InternalPlan>();
  private receipts:PlanReceipt[]=[];
  private nowMs=0;
  private version=0;
  private sequence=0;
  private disposed=false;
  private settings:Required<Omit<SchedulerOptions,'sourceClocks'>>;
  constructor(options:SchedulerOptions){
    plain(options);plain(options.sourceClocks);
    for(const [key,clock] of Object.entries(options.sourceClocks)){
      identifier(key);plain(clock);const {sourceStartMs=0,monotonicStartMs,rate=1}=clock;
      stamp(sourceStartMs,'source clock origin');stamp(monotonicStartMs,'monotonic clock origin');check(typeof rate==='number'&&Number.isFinite(rate)&&rate>0&&rate<=100,'Invalid playback rate');
      this.clocks[key]={sourceStartMs,monotonicStartMs,rate};
    }
    check(Object.keys(this.clocks).length>0&&Object.keys(this.clocks).length<=32,'Source clock count limit');
    this.settings={quietMs:options.quietMs??150,maxWaitMs:options.maxWaitMs??750,deadlineMs:options.deadlineMs??10000,
      maxBufferedEvents:options.maxBufferedEvents??512,maxEvidence:options.maxEvidence??512,maxActivePlans:options.maxActivePlans??2,maxEventsPerPlan:options.maxEventsPerPlan??12,
      maxContextEvents:options.maxContextEvents??24,maxReceipts:options.maxReceipts??256,allowPartialPlans:options.allowPartialPlans??false};
    for(const [key,value] of Object.entries(this.settings)){
      if(key==='allowPartialPlans'){check(typeof value==='boolean','Invalid partial policy');continue;}
      check(typeof value==='number'&&Number.isInteger(value)&&value>=(key==='quietMs'||key==='maxWaitMs'?0:1)&&value<=100000,'Invalid scheduler limit');
    }
    check(this.settings.maxWaitMs>=this.settings.quietMs,'Maximum wait must cover quiet window');
  }
  get revision(){return this.version;}
  private alive(){check(!this.disposed,'Evidence scheduler disposed');}
  private capacity(count=1){check(this.receipts.length+count<=this.settings.maxReceipts,'Receipt limit reached; drain receipts before advancing');}
  private eligible(event:AvailableEvidence){return event.state!=='partial'||this.settings.allowPartialPlans;}
  private queue(event:AvailableEvidence,firstQueuedAtMs=event.availableAtMs){
    const previous=this.dirty.get(event.id);this.dirty.set(event.id,{event,firstQueuedAtMs:Math.min(previous?.firstQueuedAtMs??firstQueuedAtMs,firstQueuedAtMs)});
  }

  ingest(input:EvidenceEvent):'queued'|'duplicate'|'stale'{
    this.alive();plain(input);identifier(input.id);identifier(input.sourceId);
    check(Number.isSafeInteger(input.version)&&input.version>=1,'Invalid event version');
    stamp(input.sourceStartMs,'source start');stamp(input.sourceEndMs,'source end');stamp(input.arrivedAtMs,'arrival');check(input.sourceEndMs>=input.sourceStartMs,'Source interval reversed');
    check(input.state==='stable'||input.state==='partial'||input.state==='retracted','Invalid evidence state');
    if(input.kind==='transcript')check(typeof input.text==='string'&&input.text.length<=16000&&(input.state!=='stable'||input.text.trim().length>0)&&(input.state!=='retracted'||input.text===''),'Invalid transcript payload');
    else check(input.kind==='frame'&&['stable','retracted'].includes(input.state)&&typeof input.frameRef==='string'&&input.frameRef.length<=4096&&(input.state==='retracted'?input.frameRef==='':input.frameRef.trim().length>0),'Invalid frame reference');
    const allowed=['id','version','kind','state','sourceId','sourceStartMs','sourceEndMs','arrivedAtMs',input.kind==='transcript'?'text':'frameRef'];
    check(Object.keys(input).every(key=>allowed.includes(key)),'Unknown evidence member');
    const clock=this.clocks[input.sourceId];check(clock,'Unknown source clock');check(input.sourceEndMs>=clock.sourceStartMs,'Evidence precedes configured source clock');
    const prior=this.current.get(input.id);if(prior&&input.version<prior.version)return 'stale';
    const same=[prior,...this.staged.filter(event=>event.id===input.id)].find(event=>event?.version===input.version);
    if(same){
      check(eventIdentity(same)===eventIdentity(input),'Conflicting content for the same evidence version');
      // A later transport retry is harmless. An earlier claimed first arrival
      // would change capture delay and deadline evidence, possibly after dispatch.
      // Reject that inconsistent replay metadata instead of silently rebasing it.
      check(input.arrivedAtMs>=same.arrivedAtMs,'Earlier duplicate arrival conflicts with retained first arrival');
      return 'duplicate';
    }
    check(this.staged.length<this.settings.maxBufferedEvents,'Event buffer limit reached');
    const sourceReadyAtMs=clock.monotonicStartMs+(input.sourceEndMs-clock.sourceStartMs)/clock.rate;stamp(sourceReadyAtMs,'mapped source time');
    this.staged.push({...structuredClone(input),sourceReadyAtMs,availableAtMs:Math.max(input.arrivedAtMs,sourceReadyAtMs),captureDelayMs:input.arrivedAtMs-sourceReadyAtMs});
    this.staged.sort((a,b)=>a.availableAtMs-b.availableAtMs||a.arrivedAtMs-b.arrivedAtMs||a.id.localeCompare(b.id)||a.version-b.version);
    return 'queued';
  }

  advance(nowMs:number):number{
    this.alive();stamp(nowMs,'monotonic time');check(nowMs>=this.nowMs,'Monotonic time cannot move backwards');this.nowMs=nowMs;let activated=0;
    while(this.staged[0]?.availableAtMs<=nowMs){
      const next=this.staged[0],previous=this.current.get(next.id);
      if(previous&&next.version<=previous.version){this.staged.shift();continue;}
      check(previous||this.current.size<this.settings.maxEvidence,'Retained evidence limit reached; start a new bounded window after persisting coverage');
      const invalid=[...this.active.values()].filter(plan=>[...plan.changes,...plan.context].some(event=>event.id===next.id&&event.version!==next.version));
      this.capacity(invalid.length);
      const event={...next,evidenceRevision:++this.version} as AvailableEvidence;
      this.current.set(next.id,event);this.staged.shift();activated++;
      // Publish the correction before requeueing: cancelled plans can never put
      // superseded text back into pending work. Unrelated changes survive.
      for(const plan of invalid)this.finish(plan,'cancelled',nowMs,'evidence-revised',true);
      this.queue(event);
    }
    return activated;
  }
  snapshot(options:{includePartial?:boolean;includeRetracted?:boolean}={}){
    this.alive();return {revision:this.version,asOfMs:this.nowMs,events:structuredClone([...this.current.values()]
      .filter(event=>(options.includePartial||event.state!=='partial')&&(options.includeRetracted||event.state!=='retracted')).sort(sourceOrder))};
  }
  take(nowMs:number,options:{contextIds?:string[]}={}):EvidencePlan|null{
    this.advance(nowMs);if(this.active.size>=this.settings.maxActivePlans)return null;
    const queued=[...this.dirty.values()].filter(item=>this.eligible(item.event)).sort((a,b)=>a.firstQueuedAtMs-b.firstQueuedAtMs||a.event.availableAtMs-b.event.availableAtMs||a.event.id.localeCompare(b.event.id));
    if(!queued.length)return null;
    const first=Math.min(...queued.map(item=>item.firstQueuedAtMs)),last=Math.max(...queued.map(item=>item.event.availableAtMs));
    if(nowMs<Math.min(last+this.settings.quietMs,first+this.settings.maxWaitMs))return null;
    const selected=queued.slice(0,this.settings.maxEventsPerPlan),changes=selected.map(item=>item.event),changeIds=new Set(changes.map(event=>event.id));
    const requested=options.contextIds??[];check(Array.isArray(requested)&&requested.length<=this.settings.maxContextEvents,'Context count limit exceeded');
    const context:AvailableEvidence[]=[];
    for(const key of new Set(requested)){identifier(key);const event=this.current.get(key);check(event&&event.state!=='retracted'&&this.eligible(event),'Context evidence is not available');if(!changeIds.has(key))context.push(event);}
    const evidence=[...changes,...context],lastRequiredAvailableAtMs=Math.max(...evidence.map(event=>event.availableAtMs));
    const obligations=changes.map(event=>({id:event.id,version:event.version,availableAtMs:event.availableAtMs,deadlineMs:event.availableAtMs+this.settings.deadlineMs}));
    const plan:InternalPlan={id:`plan-${++this.sequence}`,evidenceRevision:this.version,plannedAtMs:nowMs,changes:structuredClone(changes),context:structuredClone(context),
      lastRequiredAvailableAtMs,deadlineMs:lastRequiredAvailableAtMs+this.settings.deadlineMs,earliestChangeDeadlineMs:Math.min(...obligations.map(item=>item.deadlineMs)),obligations,
      usedPartialEvidence:evidence.some(event=>event.state==='partial'),controller:new AbortController(),queuedAt:new Map(selected.map(item=>[item.event.id,item.firstQueuedAtMs]))};
    for(const event of changes)this.dirty.delete(event.id);this.active.set(plan.id,plan);
    const {controller,queuedAt:_queued,...data}=plan;return {...structuredClone(data),signal:controller.signal};
  }
  private finish(plan:InternalPlan,status:PlanReceipt['status'],nowMs:number,reason?:string,requeue=false):PlanReceipt{
    const receipt:PlanReceipt={planId:plan.id,status,...(reason?{reason}:{}),finishedAtMs:nowMs,evidenceRevision:plan.evidenceRevision,
      lastRequiredAvailableAtMs:plan.lastRequiredAvailableAtMs,deadlineMs:plan.deadlineMs,earliestChangeDeadlineMs:plan.earliestChangeDeadlineMs,
      inputToResultMs:nowMs-plan.lastRequiredAvailableAtMs,withinDeadline:status==='complete'&&nowMs<=plan.deadlineMs,
      allChangesWithinDeadline:status==='complete'&&plan.obligations.every(item=>nowMs<=item.deadlineMs),usedPartialEvidence:plan.usedPartialEvidence,
      dependencies:[...plan.changes,...plan.context].map(event=>({id:event.id,version:event.version}))};
    this.active.delete(plan.id);this.receipts.push(receipt);
    if(status!=='complete')plan.controller.abort(new Error(reason??status));
    if(requeue)for(const event of plan.changes){const current=this.current.get(event.id);if(current)this.queue(current,plan.queuedAt.get(event.id));}
    return structuredClone(receipt);
  }
  complete(planId:string,nowMs:number):PlanReceipt{
    this.advance(nowMs);const plan=this.active.get(planId);check(plan,'Plan is not active (completed, failed or superseded)');this.capacity();return this.finish(plan,'complete',nowMs);
  }
  fail(planId:string,nowMs:number,reason='request-failed'):PlanReceipt{
    this.advance(nowMs);const plan=this.active.get(planId);check(plan,'Plan is not active (completed, failed or superseded)');check(typeof reason==='string'&&reason.length<=256,'Invalid failure reason');
    this.capacity();return this.finish(plan,'failed',nowMs,reason,true);
  }
  drainReceipts():PlanReceipt[]{const result=structuredClone(this.receipts);this.receipts=[];return result;}
  summary(){return {revision:this.version,asOfMs:this.nowMs,bufferedEvents:this.staged.length,retainedEvidence:this.current.size,pendingChanges:this.dirty.size,activePlans:this.active.size,receipts:this.receipts.length,disposed:this.disposed};}
  dispose(){if(this.disposed)return;for(const plan of [...this.active.values()])this.finish(plan,'cancelled',this.nowMs,'disposed');
    this.disposed=true;this.staged=[];this.current.clear();this.dirty.clear();}
}

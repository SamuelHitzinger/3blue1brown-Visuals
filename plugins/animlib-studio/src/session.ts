import {LiveWorld,WORLD_LIMITS,type WorldOptions} from '../../../shared/animlib/src/live-world.js';
import {validateReactiveProperties} from '../../../shared/animlib/src/reactive.js';
import type {CompiledScene,Frame,ReactiveProperties} from '../../../shared/animlib/src/types.js';
import {assert,identifier,plain,recipeSource,sceneSource} from './scene.js';

type Change={id:string;props:ReactiveProperties;duration?:number};
type Cue={id:string;atMs:number;durationMs:number;changes:Change[]};
type RecordEntry={at:number;kind:string;params:any};
export type Checkpoint={format:'animlib-studio-1';time:number;records:RecordEntry[];queue:Cue[];sequences:[string,number][];endMs:number};
const MAX_RECORDS=512,MAX_BYTES=2_000_000;
const encoder=new TextEncoder();
const bytes=(value:unknown)=>encoder.encode(JSON.stringify(value)).length;

/** One retained world per viewer. All mutations and scheduled cues serialize. */
export class StudioSession{
  readonly world:LiveWorld;
  private clock:()=>number;private origin:number;private offset=0;private paused=false;
  private replayAt:number|undefined;private records:RecordEntry[]=[];private tail:Promise<unknown>=Promise.resolve();
  private queue:Cue[]=[];private sequences=new Map<string,number>();private endMs=0;private flowError:string|null=null;
  private counter=0;private disposed=false;
  constructor(options:WorldOptions={}){
    this.clock=options.clock??(()=>performance.now()/1000);this.origin=this.clock();
    this.world=new LiveWorld({...options,namespaceEntities:false,clock:()=>this.time()});
  }
  time(){return this.replayAt??(this.offset+(this.paused?0:this.clock()-this.origin));}
  private serial<T>(fn:()=>Promise<T>):Promise<T>{
    const result=this.tail.catch(()=>{}).then(()=>{assert(!this.disposed,'Session disposed');return fn();});
    this.tail=result;return result;
  }
  execute(kind:string,params:any={}):Promise<any>{
    plain(params);assert(bytes(params)<=1_000_000,'Command too large');
    const input=structuredClone(params);
    return this.serial(async()=>{
      if(kind==='inspect')return this.inspect();
      if(kind==='verify')return this.verify(input);
      if(kind==='pause'){this.offset=this.time();this.paused=true;return this.inspect();}
      if(kind==='resume'){if(this.paused){this.origin=this.clock();this.paused=false;}return this.inspect();}
      if(kind==='flow')return this.enqueue(input);
      if(kind==='cancel'){this.queue=[];this.endMs=this.time()*1000;return this.inspect();}
      const result=await this.mutate(kind,input);
      // A direct edit cancels queued choreography only after a successful commit.
      this.queue=[];this.endMs=this.time()*1000;
      return {...result,...this.inspect()};
    });
  }
  private async mutate(kind:string,p:any,record=true){
    const baseRevision=p.baseRevision??this.world.revision;
    assert(baseRevision===this.world.revision,'Stale world revision');
    const at=this.time();
    // Store resolved IDs and generated source for exact, recipe-version-independent replay.
    let entry:RecordEntry={at,kind,params:{...p,baseRevision}};
    if(kind==='scene'){
      assert(Number(p.scene!==undefined)+Number(p.recipe!==undefined)===1,'Provide scene or recipe');
      const id=p.programId??`scene-${++this.counter}`;identifier(id);
      entry={at,kind:'program',params:{id,source:p.recipe?recipeSource(p.recipe):sceneSource(p.scene),baseRevision}};
    }
    // Parameter callbacks are pure absolute updates. Only the latest values in
    // an uninterrupted parameter run are needed to restore the current world.
    const previous=this.records.at(-1);
    const compact=record&&entry.kind==='parameters'&&previous?.kind==='parameters'&&previous.params.programId===entry.params.programId
      &&Object.keys({...previous.params.values,...entry.params.values}).length<=WORLD_LIMITS.parameterChanges;
    const savedEntry=compact?{...entry,params:{...entry.params,values:{...previous!.params.values,...entry.params.values}}}:entry;
    if(record)this.capacity(savedEntry,compact);
    const q=entry.params;
    let commit;
    if(entry.kind==='program'){
      identifier(q.id);assert(typeof q.source==='string','Program source required');
      commit=await this.world.addProgram({id:q.id,source:q.source,baseRevision},at);
    }else if(kind==='replace'){
      commit=await this.world.replaceProgram({id:q.id,source:q.source,baseRevision},at);
    }else if(kind==='patch'){
      commit=await this.world.apply({changes:q.changes??[],...(q.remove===undefined?{}:{remove:q.remove}),baseRevision},at);
    }else if(kind==='parameters'){
      commit=await this.world.setParameters({programId:q.programId,values:q.values,baseRevision},at);
    }else if(kind==='motion'){
      commit=await this.world.setMotion({changes:q.changes,baseRevision},at);
    }else throw Error(`Unknown command: ${kind}`);
    if(record){
      // Epochs must replay at actual publication time, not before compilation.
      savedEntry.at=commit.committedAt;
      if(compact)this.records[this.records.length-1]=savedEntry;else this.records.push(savedEntry);
    }
    return {accepted:true,revision:commit.revision,committedAt:commit.committedAt};
  }
  private capacity(entry:RecordEntry,replace=false){
    assert(replace||this.records.length<MAX_RECORDS,'Session history full; create a new session');
    assert(bytes({...this.checkpoint(),records:[...(replace?this.records.slice(0,-1):this.records),entry]})<=MAX_BYTES,'Session checkpoint limit exceeded');
  }
  private inspect(){
    const summary=this.world.summary();
    return {revision:summary.revision,paused:this.paused,playheadMs:this.time()*1000,
      programs:summary.programs,objectCount:summary.entityIds.length,
      flow:{queued:this.queue.length,endMs:this.endMs,lastError:this.flowError},
      limitations:summary.limitations,semanticQuality:'not-assessed'};
  }
  private async enqueue(p:any){
    identifier(p.source);
    assert(Number.isSafeInteger(p.sequence)&&p.sequence>=0,'Invalid source sequence');
    assert(p.sequence>(this.sequences.get(p.source)??-1),'Stale flow sequence');
    assert(p.mode===undefined||['interrupt','append'].includes(p.mode),'Invalid flow mode');
    assert(Array.isArray(p.cues)&&p.cues.length>0&&p.cues.length<=128,'Flow requires 1–128 cues');
    if(p.baseRevision!==undefined)assert(p.baseRevision===this.world.revision,'Stale world revision');
    const frame=await this.world.sample(this.time()),elements=new Map(frame.elements.map(e=>[e.id,e]));
    const seen=new Set<string>();let cursor=p.mode==='append'?Math.max(this.time()*1000,this.endMs):this.time()*1000;
    const cues:Cue[]=p.cues.map((c:any)=>{
      identifier(c.id);assert(!seen.has(c.id),'Duplicate cue ID');seen.add(c.id);
      const atMs=c.atMs??cursor,durationMs=c.durationMs??350;
      assert(Number.isFinite(atMs)&&atMs>=cursor&&atMs<=this.time()*1000+3600_000,'Invalid or overlapping cue time');
      assert(Number.isFinite(durationMs)&&durationMs>=0&&durationMs<=60_000,'Invalid cue duration');
      assert(Array.isArray(c.changes)&&c.changes.length>0&&c.changes.length<=256,'Invalid cue changes');
      const ids=new Set<string>();
      for(const change of c.changes){
        assert(!ids.has(change.id),'Duplicate cue target');ids.add(change.id);
        const element=elements.get(change.id);assert(element,'Unknown cue target');
        validateReactiveProperties(change.props,element,{options:this.world.rendererOptions} as CompiledScene);
      }
      cursor=atMs+durationMs;
      return {id:c.id,atMs,durationMs,changes:c.changes.map((c:Change)=>({id:c.id,props:c.props,duration:durationMs/1000}))};
    });
    const queue=p.mode==='append'?[...this.queue,...cues]:cues;
    assert(queue.length<=128,'Flow queue full');
    assert(this.sequences.has(p.source)||this.sequences.size<128,'Flow source limit exceeded');
    assert(bytes({...this.checkpoint(),queue})<=MAX_BYTES,'Session checkpoint limit exceeded');
    // Reuse the world's complete ownership/interpolation validator. Its trusted
    // synchronous guard runs after validation and before any publication.
    // A sentinel rejection makes this a dry run without duplicating that logic.
    const validated=new Error('Studio cue validation complete');
    for(const cue of cues){
      try{
        await this.world.apply({baseRevision:this.world.revision,changes:cue.changes},this.time(),{
          beforeCommit:()=>{throw validated;},
        });
        throw Error('Cue validation unexpectedly committed');
      }catch(error){if(error!==validated)throw error;}
    }
    this.queue=queue;this.endMs=cursor;this.sequences.set(p.source,p.sequence);this.flowError=null;
    return {accepted:true,...this.inspect()};
  }
  tick():Promise<void>{return this.serial(async()=>{
    if(this.paused||!this.queue.length)return;
    const time=this.time();
    try{
      while(this.queue.length&&this.queue[0].atMs<=time*1000){
        const cue=this.queue[0];
        // Skip cues more than one second late; browser throttling is not realtime.
        if(time*1000-cue.atMs>1000){this.flowError=`Late cue skipped: ${cue.id}`;this.queue.shift();continue;}
        await this.mutate('patch',{changes:cue.changes});
        this.queue.shift();
      }
    }catch(error){this.flowError=String(error instanceof Error?error.message:error);this.offset=this.time();this.paused=true;}
  });}
  sample():Promise<Frame>{return this.serial(()=>this.world.sample(this.time()));}
  private async verify(p:any){
    assert(Array.isArray(p.checks)&&p.checks.length<=64,'verify requires up to 64 checks');
    const frame=await this.world.sample(this.time());
    const checks=p.checks.map((c:any)=>{
      identifier(c.id);assert(['position','rotation','opacity','scale','radius','fill'].includes(c.property),'Unsupported check property');
      assert(Object.hasOwn(c,'expected'),'Check expected value required');
      assert(Number.isFinite(c.tolerance??1e-6)&&(c.tolerance??1e-6)>=0,'Invalid tolerance');
      const e=frame.elements.find(e=>e.id===c.id);
      const actual=e?(c.property==='radius'?e.geometry.radius:(e as any)[c.property]):null;
      const equal=(a:any,b:any):boolean=>typeof a==='number'&&typeof b==='number'?Math.abs(a-b)<=(c.tolerance??1e-6):
        Array.isArray(a)&&Array.isArray(b)?a.length===b.length&&a.every((x,i)=>equal(x,b[i])):a===b;
      return {...c,actual:actual??null,passed:Boolean(e)&&actual!==undefined&&equal(actual,c.expected)};
    });
    return {...this.inspect(),verification:{passed:checks.every((c:any)=>c.passed),checks,scope:'requested numeric/property checks only'}};
  }
  checkpoint():Checkpoint{
    return structuredClone({format:'animlib-studio-1',time:this.time(),records:this.records,queue:this.queue,sequences:[...this.sequences],endMs:this.endMs});
  }
  async restore(state:Checkpoint){
    assert(this.world.revision===0&&this.records.length===0,'Restore requires an empty session');
    plain(state);assert(state.format==='animlib-studio-1'&&bytes(state)<=MAX_BYTES,'Invalid checkpoint');
    assert(Number.isFinite(state.time)&&state.time>=0&&Array.isArray(state.records)&&state.records.length<=MAX_RECORDS,'Invalid checkpoint history');
    assert(Array.isArray(state.queue)&&state.queue.length<=128&&Array.isArray(state.sequences)&&state.sequences.length<=128,'Invalid checkpoint flow');
    let last=0;
    try{
      for(const record of state.records){
        assert(Number.isFinite(record.at)&&record.at>=last&&record.at<=state.time,'Invalid checkpoint order');
        // Revisions belong to the live renderer. Compacted histories replay
        // fewer publications; rebase each restored record to the new world.
        this.replayAt=record.at;
        const params={...record.params,baseRevision:this.world.revision};
        await this.mutate(record.kind,params,false);
        this.records.push({...structuredClone(record),params:structuredClone(params)});last=record.at;
      }
      this.offset=state.time;this.paused=true;this.replayAt=undefined;
      this.queue=structuredClone(state.queue);this.sequences=new Map(state.sequences);this.endMs=state.endMs;
      this.counter=state.records.length;
    }catch(error){this.dispose();throw error;}
  }
  dispose(){this.disposed=true;this.world.dispose();}
}

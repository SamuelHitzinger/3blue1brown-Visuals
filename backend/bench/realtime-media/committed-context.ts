import type {WorldPatch,WorldParameterPatch,WorldMotionPatch} from '../realtime-world/world.js';

export interface OperationEvidenceRef {id:string;version:number}
export interface CommittedOperationInput {
  revision:number;runId:string;planId:string;committedAtMs:number;
  evidence:{changes:OperationEvidenceRef[];context:OperationEvidenceRef[]};
  operation:{action:'add'|'replace';programId:string;source:string}|{action:'edit';patch:WorldPatch}|{action:'parameters';patch:WorldParameterPatch}|{action:'motion';patch:WorldMotionPatch};
}
export interface CommittedOperationRecord extends CommittedOperationInput {
  semanticCompletion:'unknown';renderingStatus:'not-observed'|'render-submitted';
}
export interface CommittedContextSnapshot {
  latestRevision:number;records:CommittedOperationRecord[];
  omittedRevisionCount:number;omittedRevisionRanges:{from:number;to:number}[];
  wholeHistoryComplete:boolean;opaque:boolean;limitation:string;
}
export interface CommittedContextOptions {maxCharacters?:number;maxEntries?:number}
const limitation='Evidence IDs are contextual per run. Committed operations are history, not semantic proof or rollback; corrections do not undo committed state. Omitted history is opaque, never absent.';
function check(value:unknown,message:string):asserts value {if(!value)throw new Error(message);}
const positiveInteger=(value:unknown):value is number=>typeof value==='number'&&Number.isSafeInteger(value)&&value>0;
const identifier=(value:unknown):value is string=>typeof value==='string'&&value.length>0&&value.length<=256;
function plainJson(value:unknown,depth=0):void {
  check(depth<=24,'Operation nesting limit');
  if(value===null||typeof value==='string'||typeof value==='boolean')return;
  if(typeof value==='number'){check(Number.isFinite(value),'Operation must contain finite numbers');return;}
  check(typeof value==='object'&&value!==null,'Operation must contain JSON data');
  check(Array.isArray(value)||Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null,'Operation must contain plain data');
  for(const descriptor of Object.values(Object.getOwnPropertyDescriptors(value))){
    check(!descriptor.get&&!descriptor.set,'Operation accessors are unsupported');plainJson(descriptor.value,depth+1);
  }
}
function validate(input:CommittedOperationInput):void {
  plainJson(input);
  check(positiveInteger(input.revision),'Invalid committed revision');
  check(identifier(input.runId)&&identifier(input.planId),'Invalid operation identity');
  check(Number.isFinite(input.committedAtMs)&&input.committedAtMs>=0,'Invalid commit time');
  check(input.evidence&&typeof input.evidence==='object','Missing operation evidence');
  for(const refs of [input.evidence.changes,input.evidence.context]){
    check(Array.isArray(refs)&&refs.length<=64,'Invalid evidence references');
    for(const ref of refs)check(ref&&identifier(ref.id)&&positiveInteger(ref.version),'Invalid evidence reference');
  }
  const operation=input.operation;
  check(operation&&typeof operation==='object','Missing committed operation');
  if(operation.action==='add'||operation.action==='replace')check(identifier(operation.programId)&&typeof operation.source==='string'&&operation.source.length>0,'Invalid committed source');
  else if(operation.action==='motion'){
    const patch=operation.patch;
    check(patch&&patch.baseRevision===input.revision-1&&Array.isArray(patch.changes)&&patch.changes.length>0&&patch.changes.length<=32,'Invalid committed motion patch');
    const ids=new Set<string>();
    for(const change of patch.changes){
      check(change&&identifier(change.id)&&!ids.has(change.id)&&Array.isArray(change.velocity)&&change.velocity.length===3
        &&change.velocity.every(value=>typeof value==='number'&&Number.isFinite(value)&&Math.abs(value)<=1e6),'Invalid committed motion');
      ids.add(change.id);
    }
  }
  else if(operation.action==='parameters'){
    const patch=operation.patch;
    check(patch&&patch.baseRevision===input.revision-1&&identifier(patch.programId),'Invalid committed parameter patch');
    check(patch.values&&typeof patch.values==='object'&&!Array.isArray(patch.values),'Invalid committed parameter values');
    const entries=Object.entries(patch.values);
    check(entries.length>0&&entries.length<=32,'Invalid committed parameter count');
    for(const [key,value] of entries)check(/^[A-Za-z0-9][A-Za-z0-9_./-]{0,127}$/.test(key)&&!['constructor','prototype','__proto__'].includes(key)
      &&typeof value==='number'&&Number.isFinite(value),'Invalid committed parameter value');
  }
  else {
    check(operation.action==='edit','Unknown committed operation');
    const patch=operation.patch;
    check(patch&&patch.baseRevision===input.revision-1&&Array.isArray(patch.changes)
      &&(patch.remove===undefined||Array.isArray(patch.remove))&&patch.changes.length+(patch.remove?.length??0)>0,'Invalid committed patch');
  }
}
/** Call record only AFTER LiveWorld confirms a commit, including commits whose
 * subsequent rendering fails. This journal cannot verify external world state.
 * Keep one instance for the lifetime of the world, across source runs.
 */
export class CommittedContextJournal {
  private records:CommittedOperationRecord[]=[];
  private latestRevision=0;
  private characters=0;
  private readonly maxCharacters:number;
  private readonly maxEntries:number;
  constructor(options:CommittedContextOptions={}){
    this.maxCharacters=options.maxCharacters??256000;this.maxEntries=options.maxEntries??64;
    check(positiveInteger(this.maxCharacters)&&this.maxCharacters<=1000000,'Invalid journal character limit');
    check(positiveInteger(this.maxEntries)&&this.maxEntries<=256,'Invalid journal entry limit');
  }
  // Reserve the longer rendering status so markRendered cannot exceed storage.
  private footprint(record:CommittedOperationRecord){return JSON.stringify({...record,renderingStatus:'render-submitted'}).length;}
  record(input:CommittedOperationInput):void {
    validate(input);check(input.revision>this.latestRevision,'Committed revisions must increase');
    const record:CommittedOperationRecord={...structuredClone(input),semanticCompletion:'unknown',renderingStatus:'not-observed'};
    const size=this.footprint(record);
    this.latestRevision=record.revision;
    if(size>this.maxCharacters)return; // Whole record omitted; its revision remains explicit.
    while(this.records.length&&(this.records.length>=this.maxEntries||this.characters+size>this.maxCharacters)){
      this.characters-=this.footprint(this.records.shift()!);
    }
    this.records.push(record);this.characters+=size;
  }
  /** False means this revision's operation is no longer retained, not unrendered. */
  markRendered(revision:number):boolean {
    check(positiveInteger(revision)&&revision<=this.latestRevision,'Unknown committed revision');
    const record=this.records.find(record=>record.revision===revision);
    if(!record)return false;record.renderingStatus='render-submitted';return true;
  }
  private describe(records:CommittedOperationRecord[]):CommittedContextSnapshot {
    const ordered=[...records].sort((a,b)=>a.revision-b.revision),omittedRevisionRanges:{from:number;to:number}[]=[];
    let next=1;
    for(const record of ordered){if(record.revision>next)omittedRevisionRanges.push({from:next,to:record.revision-1});next=record.revision+1;}
    if(next<=this.latestRevision)omittedRevisionRanges.push({from:next,to:this.latestRevision});
    const omittedRevisionCount=this.latestRevision-ordered.length;
    return {latestRevision:this.latestRevision,records:ordered,omittedRevisionCount,omittedRevisionRanges,
      wholeHistoryComplete:omittedRevisionCount===0,opaque:omittedRevisionCount>0,limitation};
  }
  /** Budgets cover the complete JSON.stringify(snapshot), including omissions.
   * maxBytes optionally also bounds its UTF-8 encoding. Sources/patches are never
   * clipped. Throws if honest empty metadata cannot fit either ceiling.
   */
  snapshot(maxCharacters:number,maxBytes?:number):CommittedContextSnapshot {
    check(positiveInteger(maxCharacters),'Invalid snapshot character budget');
    check(maxBytes===undefined||positiveInteger(maxBytes),'Invalid snapshot byte budget');
    const encoder=maxBytes===undefined?undefined:new TextEncoder();
    const fits=(value:CommittedContextSnapshot)=>{
      const serialized=JSON.stringify(value);
      return serialized.length<=maxCharacters&&(maxBytes===undefined||encoder!.encode(serialized).length<=maxBytes);
    };
    let snapshot=this.describe([]);
    check(fits(snapshot),'Snapshot budget too small for omission metadata');
    for(let index=this.records.length-1;index>=0;index--){
      const candidate=this.describe([...snapshot.records,this.records[index]]);
      if(fits(candidate))snapshot=candidate;
    }
    return structuredClone(snapshot);
  }
}

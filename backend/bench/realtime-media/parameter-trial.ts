/** Offline preparation and saved-output evaluation only. Never opens a provider runtime. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import type {ToolCall} from '@earendil-works/pi-ai';
import {acceptSubmission,submissionTool,type WorldSubmission} from '../realtime-tool-probe.js';
import {LiveWorld} from '../realtime-world/world.js';
import {commitLectureSubmission} from './world-submission.js';
import {buildRetainedParameterCases,auditNativeFrame,compareNativeFrames,type RetainedCase} from './retained-parameter-proof.js';

type Action='add'|'parameters';
/** Requested settings only. Offline preparation cannot establish forwarding, tier, cache, or output-cap enforcement. */
export interface TrialConfig {model:string;thinking:string;serviceTier:'default'|'priority';maxTokens:number;timeoutMs:number}
interface Scheduled {id:string;caseId:string;repeat:number;position:number;action:Action}
interface Attempt extends Scheduled {evidenceSha256:string;files:Record<string,string>}
interface Manifest {schemaVersion:1;seed:number;repeats:number;config:TrialConfig;configSha256:string;labels:string[];attempts:Attempt[];oracleSha256:string}
/** This is a local receipt envelope, not independent proof of a provider/model's identity. */
export interface SavedTrialSubmission {attemptId:string;evidenceSha256:string;configSha256:string;baseRevision:number;
 providerComplete:boolean;completed:ToolCall[];terminal:ToolCall[]}
const digest=(value:string)=>createHash('sha256').update(value).digest('hex');
const json=(value:unknown)=>JSON.stringify(value,null,2);
const save=async(path:string,value:unknown)=>{const text=json(value);await writeFile(path,text,{flag:'wx'});return digest(text);};
const read=async(path:string)=>JSON.parse(await readFile(path,'utf8'));
const labels=['offline-only','quality-unverified','baseline-not-live-replacement','configuration-requested-not-provider-confirmed'];
const tasks:Record<RetainedCase['subject'],string>={
 slope:'Increase the slope by 0.75.',waves:'Increase the phase offset by 0.9 radians.',gaussian:'Increase the standard deviation by 0.55.',
 saddle:'Double the curvature.',caffeine:'Increase the rigid display rotation by 0.5 radians. This is a computed conformer display, not molecular dynamics.',
};
const system='Use the supplied initial source, current state, and task. Preserve all unrelated content, topology, styles, camera, controls, and original animation time. '
 +'Call submit_world exactly once using the assigned action. For add, emit complete native source for an isolated fresh reconstruction evaluated at the original epoch; this is not live replacement. '
 +'For parameters, emit only the existing program ID and changed numeric control values. Respect the tool branch contract. No repair turn follows.';
function freeze<T>(value:T):T {if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}

export function trialSchedule(caseIds:string[],seed:number,repeats=2):Scheduled[]{
 assert(Number.isInteger(seed)&&seed>=0&&seed<=0xffffffff,'Invalid seed');
 assert(Number.isInteger(repeats)&&repeats>=2&&repeats<=10&&repeats%2===0,'Repeats must be even, 2–10');
 assert(caseIds.length>0&&new Set(caseIds).size===caseIds.length&&caseIds.every(id=>/^[a-z0-9-]+$/.test(id)),'Invalid case IDs');
 let state=seed>>>0;const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/2**32;};
 const first=new Map(caseIds.map(id=>[id,random()<.5?0:1])),pairs:{caseId:string;repeat:number}[]=[];
 for(let repeat=0;repeat<repeats;repeat++)for(const caseId of caseIds)pairs.push({caseId,repeat});
 for(let i=pairs.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[pairs[i],pairs[j]]=[pairs[j],pairs[i]];}
 return pairs.flatMap(({caseId,repeat})=>{
  const actions:Action[]=(first.get(caseId)!+repeat)%2===0?['add','parameters']:['parameters','add'];
  return actions.map((action,position)=>({id:`${caseId}-r${repeat}-${action}`,caseId,repeat,position,action}));
 });
}

/** Use serially: the native compiler's local fallback is selected process-wide, as in the existing proof. */
async function locally<T>(work:()=>Promise<T>):Promise<T>{
 const worker=Object.getOwnPropertyDescriptor(globalThis,'Worker');Object.defineProperty(globalThis,'Worker',{configurable:true,writable:true,value:undefined});
 try{return await work();}finally{if(worker)Object.defineProperty(globalThis,'Worker',worker);else delete (globalThis as {Worker?:unknown}).Worker;}
}
export async function prepareParameterTrials(options:{directory:string;seed:number;repeats?:number;config:TrialConfig}):Promise<Manifest>{
 const config=structuredClone(options.config),repeats=options.repeats??2;
 assert(typeof config.model==='string'&&config.model.trim()&&['off','minimal','low','medium','high','xhigh','max'].includes(config.thinking),'Invalid model/thinking');
 assert(['default','priority'].includes(config.serviceTier)&&Number.isInteger(config.maxTokens)&&config.maxTokens>=64&&config.maxTokens<=16384,'Invalid request configuration');
 assert(Number.isInteger(config.timeoutMs)&&config.timeoutMs>=100&&config.timeoutMs<=300000,'Invalid timeout');
 const cases=await buildRetainedParameterCases(),schedule=trialSchedule(cases.map(c=>c.id),options.seed,repeats),directory=resolve(options.directory);
 await mkdir(directory); // New directory only; never overwrite or silently resume a bundle.
 const manifest:Manifest={schemaVersion:1,seed:options.seed,repeats,config,configSha256:digest(json(config)),labels:[...labels],attempts:[],oracleSha256:''};
 const evidence=new Map<string,unknown>();
 await locally(async()=>{for(const c of cases){
  const world=new LiveWorld({clock:()=>0});
  try{await world.addProgram({id:c.programId,source:c.source,baseRevision:0},0);
   auditNativeFrame(c,await world.sample(c.comparisonTimeSeconds),c.comparisonTimeSeconds,c.initialValue);
   evidence.set(c.id,{caseId:c.id,source:c.source,summary:world.summary(),task:tasks[c.subject],timeSeconds:c.comparisonTimeSeconds});
  }finally{world.dispose();}
 }});
 const tool=submissionTool('world','require',false,true);
 for(const attempt of schedule){
  const dir=join(directory,attempt.id);await mkdir(dir);const shared=evidence.get(attempt.caseId),files:Record<string,string>={};
  for(const [name,value] of Object.entries({'prompt.json':{evidence:shared,assignedAction:attempt.action},'system.json':{system},'tool.json':tool}))files[name]=await save(join(dir,name),value);
  manifest.attempts.push({...attempt,evidenceSha256:digest(json(shared)),files});
 }
 manifest.oracleSha256=await save(join(directory,'evaluator-oracle.json'),{cases,sampleTimesSeconds:[3,3.375,4,4.625,5,5.25,6],
  limitation:'Evaluator-only answers. Never include this file or expected frames in a model request.'});
 await save(join(directory,'manifest.json'),manifest);return freeze(manifest);
}

interface EvaluationRow {id:string;caseId:string;action:Action;repeat:number;status:'passed'|'failed';error?:string;
 localEvaluationMs:number;sampleTimesSeconds:number[];epoch:number|null;submissionSha256:string|null}
export async function evaluateParameterTrials(options:{bundleDirectory:string;directory:string;submissions:Record<string,string>}){
 const bundleDirectory=resolve(options.bundleDirectory),directory=resolve(options.directory),manifest=await read(join(bundleDirectory,'manifest.json')) as Manifest;
 assert.equal(manifest.schemaVersion,1);assert.equal(digest(json(manifest.config)),manifest.configSha256,'Changed configuration');
 await mkdir(directory);
 const result={schemaVersion:1,labels:[...labels],qualityStatus:'quality-unverified',providerLatency:null,rendererStatus:'not-observed',
  measurement:'localEvaluationMs includes file reads/writes, integrity checks, initial and oracle compilation, output application, sampling, and assertions; excludes final row receipt write. It is audit overhead, not operation or provider latency.',
  limitation:'Local evaluation only. No provider identity verification, live replacement, presentation, end-to-end timing, or visual/explanatory approval.',attempts:[] as EvaluationRow[]};
 const oracleText=await readFile(join(bundleDirectory,'evaluator-oracle.json'),'utf8');assert.equal(digest(oracleText),manifest.oracleSha256,'Changed evaluator oracle');
 const oracle=JSON.parse(oracleText) as {cases:RetainedCase[];sampleTimesSeconds:number[]};
 assert.deepEqual(manifest.attempts.map(({id,caseId,repeat,position,action})=>({id,caseId,repeat,position,action})),
  trialSchedule(oracle.cases.map(c=>c.id),manifest.seed,manifest.repeats),'Changed schedule');
 await locally(async()=>{for(const attempt of manifest.attempts){
  const started=performance.now(),row:EvaluationRow={id:attempt.id,caseId:attempt.caseId,action:attempt.action,repeat:attempt.repeat,status:'failed',localEvaluationMs:0,sampleTimesSeconds:[],epoch:null,submissionSha256:null};
  const worlds:LiveWorld[]=[];
  try{
   const path=options.submissions[attempt.id];assert(path,'Missing saved submission');const text=await readFile(path,'utf8');row.submissionSha256=digest(text);
   await writeFile(join(directory,`${attempt.id}-submission.json`),text,{flag:'wx'});
   assert.deepEqual(Object.keys(attempt.files).sort(),['prompt.json','system.json','tool.json']);
   for(const [name,hash] of Object.entries(attempt.files))assert.equal(digest(await readFile(join(bundleDirectory,attempt.id,name),'utf8')),hash,'Changed request file');
   const prompt=await read(join(bundleDirectory,attempt.id,'prompt.json'));assert.equal(digest(json(prompt.evidence)),attempt.evidenceSha256,'Changed evidence');
   assert.equal(prompt.assignedAction,attempt.action);
   const saved=JSON.parse(text) as SavedTrialSubmission;assert.equal(saved.attemptId,attempt.id);assert.equal(saved.evidenceSha256,attempt.evidenceSha256);
   assert.equal(saved.configSha256,manifest.configSha256);assert.equal(saved.baseRevision,1,'Stale initial revision');
   assert.equal(saved.providerComplete,true,'No successful provider terminal');
   assert(Array.isArray(saved.completed)&&Array.isArray(saved.terminal),'Tool call lists must be arrays');
   const submission=acceptSubmission('world',saved.completed,saved.terminal,saved.providerComplete,false,true) as WorldSubmission;
   assert.equal(submission.action,attempt.action,'Wrong assigned branch (including deferral)');
   const c=oracle.cases.find(c=>c.id===attempt.caseId);assert(c,'Unknown case');
   const world=new LiveWorld({clock:()=>0}),expected=new LiveWorld({clock:()=>0});worlds.push(world,expected);
   await world.addProgram({id:c.programId,source:c.source,baseRevision:0},0);
   const initialSummary=world.summary();
   assert.deepEqual(prompt.evidence,JSON.parse(json({caseId:c.id,source:c.source,summary:initialSummary,task:tasks[c.subject],timeSeconds:c.comparisonTimeSeconds})),'Request differs from initial construction/evidence');
   const before=await world.sample(c.comparisonTimeSeconds);auditNativeFrame(c,before,c.comparisonTimeSeconds,c.initialValue);
   await expected.addProgram({id:c.programId,source:c.baselineSource,baseRevision:0},0);
   let actual=world;
   if(submission.action==='parameters'){
    const committed=await commitLectureSubmission(world,submission,saved.baseRevision,c.programId,c.comparisonTimeSeconds);assert(committed.changed,'No-op parameter update');
   }else if(submission.action==='add'){
    actual=new LiveWorld({clock:()=>0});worlds.push(actual);await actual.addProgram({id:c.programId,source:submission.source,baseRevision:0},0);
   }else throw Error('Unexpected branch');
   const program=actual.summary().programs[0];row.epoch=program.epoch;assert.equal(program.epoch,0,'Original epoch changed');
   assert.equal(program.parameters.find(p=>p.id==='p')?.value,c.values.p,'Wrong parameter interpretation');
   const expectedProgram=submission.action==='add'?expected.summary().programs[0]:initialSummary.programs[0];
   if(submission.action==='parameters')for(const p of expectedProgram.parameters)if(p.id==='p')p.value=c.values.p;
   assert.deepEqual(program,expectedProgram,'Changed program controls, ownership, or duration');assert.deepEqual(actual.rendererOptions,expected.rendererOptions,'Changed renderer options');
   const frames=[];
   for(const t of oracle.sampleTimesSeconds){
    const frame=await actual.sample(t),reference=await expected.sample(t);
    auditNativeFrame(c,frame,t,c.values.p);auditNativeFrame(c,reference,t,c.values.p);compareNativeFrames(frame,reference);
    assert.deepEqual(frame.camera,before.camera);assert.deepEqual(frame.elements.map(e=>e.id),before.elements.map(e=>e.id));
    for(const e of frame.elements)assert.deepEqual(e.geometry.triangles,before.elements.find(old=>old.id===e.id)!.geometry.triangles);
    row.sampleTimesSeconds.push(t);frames.push({timeSeconds:t,frame});
   }
   await save(join(directory,`${attempt.id}-frames.json`),frames);row.status='passed';
  }catch(error){row.error=error instanceof Error?error.message:String(error);}
  finally{worlds.forEach(w=>w.dispose());row.localEvaluationMs=performance.now()-started;result.attempts.push(row);await save(join(directory,`${attempt.id}-result.json`),row);}
 }});
 await save(join(directory,'result.json'),result);return freeze(result);
}

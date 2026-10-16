/** Explicit batch execution adapter. Reads public requests only; never reads the evaluator oracle. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {runProbe,submissionTool,type ProbeRunOptions} from '../realtime-tool-probe.js';
import {trialSchedule,type TrialConfig,type SavedTrialSubmission} from './parameter-trial.js';

export type TrialProbe=typeof runProbe;
interface Attempt {id:string;caseId:string;repeat:number;position:number;action:'add'|'parameters';evidenceSha256:string;files:Record<string,string>}
interface Manifest {schemaVersion:number;seed:number;repeats:number;config:TrialConfig;configSha256:string;attempts:Attempt[]}
const digest=(text:string)=>createHash('sha256').update(text).digest('hex');
const json=(value:unknown)=>JSON.stringify(value,null,2);
const save=(path:string,value:unknown)=>writeFile(path,json(value),{flag:'wx'});
const filenames=['prompt.json','system.json','tool.json'];
const caseIds=['slope','waves','gaussian','saddle','caffeine'].flatMap(id=>[`${id}-low`,`${id}-high`]);

function validateManifest(manifest:Manifest){
 assert.equal(manifest.schemaVersion,1);assert.equal(manifest.repeats,2,'This runner is bounded to the prepared forty-request trial');
 const c=manifest.config;assert(c&&typeof c==='object');
 assert.deepEqual(Object.keys(c).sort(),['maxTokens','model','serviceTier','thinking','timeoutMs']);
 assert(typeof c.model==='string'&&c.model.trim()&&['off','minimal','low','medium','high','xhigh','max'].includes(c.thinking));
 assert(['default','priority'].includes(c.serviceTier)&&Number.isInteger(c.maxTokens)&&c.maxTokens>=64&&c.maxTokens<=16384);
 assert.equal(c.timeoutMs,10000,'Prepared batch timeout must be ten seconds');assert.equal(digest(json(c)),manifest.configSha256,'Changed config hash');
 assert(Array.isArray(manifest.attempts)&&manifest.attempts.length===40,'Expected forty prepared attempts');
 assert.deepEqual(manifest.attempts.map(({id,caseId,repeat,position,action})=>({id,caseId,repeat,position,action})),trialSchedule(caseIds,manifest.seed,2),'Changed schedule');
}
async function request(directory:string,attempt:Attempt){
 assert.deepEqual(Object.keys(attempt.files).sort(),filenames,'Unexpected request files');
 const texts:Record<string,string>={};
 for(const name of filenames){texts[name]=await readFile(join(directory,attempt.id,name),'utf8');assert.equal(digest(texts[name]),attempt.files[name],`Changed ${attempt.id}/${name}`);}
 const prompt=JSON.parse(texts['prompt.json']),system=JSON.parse(texts['system.json']),tool=JSON.parse(texts['tool.json']);
 assert.deepEqual(Object.keys(prompt).sort(),['assignedAction','evidence']);assert.equal(prompt.assignedAction,attempt.action);
 assert.deepEqual(Object.keys(prompt.evidence).sort(),['caseId','source','summary','task','timeSeconds']);
 assert.equal(prompt.evidence.caseId,attempt.caseId);assert.equal(prompt.evidence.summary.revision,1);
 assert(typeof prompt.evidence.source==='string'&&prompt.evidence.source.length>0&&typeof prompt.evidence.task==='string');
 assert.equal(digest(json(prompt.evidence)),attempt.evidenceSha256,'Changed evidence hash');
 assert.deepEqual(Object.keys(system),['system']);assert(typeof system.system==='string'&&system.system.trim());
 assert.deepEqual(tool,JSON.parse(json(submissionTool('world','require',false,true))),'Frozen tool differs from active strict world schema');
 return {texts,system:system.system as string,evidenceSha256:attempt.evidenceSha256};
}
interface Row {id:string;caseId:string;action:string;status:'recorded'|'failed';error?:string;startedAt:string;finishedAt:string|null;
 wallElapsedMs:number;dispatchInvoked:boolean;providerDirectory:string;envelopePath:string;reportPath:string|null;sourceRequestDirectory:string;
 requestHashes:Record<string,string>;providerComplete:boolean}

/** Invoking this function without an injected probe executes the approved batch. CLI additionally requires --execute. */
export async function runParameterTrials(options:{bundleDirectory:string;directory:string;probe?:TrialProbe}){
 const bundleDirectory=resolve(options.bundleDirectory),directory=resolve(options.directory),manifestPath=join(bundleDirectory,'manifest.json');
 const manifestText=await readFile(manifestPath,'utf8'),manifestSha256=digest(manifestText),manifest=JSON.parse(manifestText) as Manifest;
 validateManifest(manifest);
 // Validate the whole batch before any provider/runtime can be opened. No oracle file is accessed.
 const evidence=new Map<string,string>();let sharedSystem:string|undefined;
 for(const attempt of manifest.attempts){const r=await request(bundleDirectory,attempt);
  if(evidence.has(attempt.caseId))assert.equal(r.evidenceSha256,evidence.get(attempt.caseId),'Unequal paired evidence');else evidence.set(attempt.caseId,r.evidenceSha256);
  if(sharedSystem!==undefined)assert.equal(r.system,sharedSystem,'Unequal system instructions');else sharedSystem=r.system;
 }
 await mkdir(directory);await writeFile(join(directory,'manifest.json'),manifestText,{flag:'wx'});
 const result={schemaVersion:1,status:'running',bundleDirectory,manifestPath,manifestSha256,config:manifest.config,configSha256:manifest.configSha256,
  startedAt:new Date().toISOString(),finishedAt:null as string|null,qualityStatus:'quality-unverified',baseline:'isolated-fresh-source-reconstruction-not-live-replacement',
  measurement:'Per-attempt wallElapsedMs includes verification, staging, probe setup/stream/evidence writes and receipt loading; not model latency or input-to-presentation latency. Provider timestamps remain in their original reports.',
  configuration:'Requested settings only; tier, cache and output-token cap are not assumed enforced.',maxRetries:0,attempts:[] as Row[],submissions:{} as Record<string,string>};
 await save(join(directory,'started.json'),result);
 const probe=options.probe??runProbe;
 for(const attempt of manifest.attempts){
  const started=performance.now(),attemptDirectory=join(directory,attempt.id),providerDirectory=join(attemptDirectory,'provider');await mkdir(attemptDirectory);
  const row:Row={id:attempt.id,caseId:attempt.caseId,action:attempt.action,status:'failed',startedAt:new Date().toISOString(),finishedAt:null,wallElapsedMs:0,
   dispatchInvoked:false,providerDirectory,envelopePath:join(attemptDirectory,'submission-envelope.json'),reportPath:null,
   sourceRequestDirectory:join(bundleDirectory,attempt.id),requestHashes:{...attempt.files},providerComplete:false};
  const envelope:SavedTrialSubmission={attemptId:attempt.id,evidenceSha256:attempt.evidenceSha256,configSha256:manifest.configSha256,baseRevision:1,providerComplete:false,completed:[],terminal:[]};
  try{
   assert.equal(digest(await readFile(manifestPath,'utf8')),manifestSha256,'Manifest changed after batch preparation');
   const r=await request(bundleDirectory,attempt),requestDirectory=join(attemptDirectory,'request');await mkdir(requestDirectory);
   for(const name of filenames)await writeFile(join(requestDirectory,name),r.texts[name],{flag:'wx'});
   const systemPath=join(requestDirectory,'system.txt');await writeFile(systemPath,r.system,{flag:'wx'});
   // Recheck immediately before opening the probe, including the bytes it will read.
   assert.equal(digest(await readFile(manifestPath,'utf8')),manifestSha256,'Manifest changed before dispatch');
   await request(bundleDirectory,attempt);
   for(const name of filenames)assert.equal(digest(await readFile(join(requestDirectory,name),'utf8')),attempt.files[name],'Staged request changed');
   assert.equal(await readFile(systemPath,'utf8'),r.system,'Staged system changed');
   const c=manifest.config,args=['run','--kind=world','--case=external','--action=edit','--strict=require',`--model=${c.model}`,`--thinking=${c.thinking}`,
    `--service-tier=${c.serviceTier}`,`--max-tokens=${c.maxTokens}`,`--timeout-ms=${c.timeoutMs}`,`--out=${providerDirectory}`,
    `--prompt-file=${join(requestDirectory,'prompt.json')}`,`--system-file=${systemPath}`];
   const probeOptions:ProbeRunOptions={exactSystemPrompt:true,retainedParameters:true,speechAnchors:false};
   row.dispatchInvoked=true;const received=await probe(args,probeOptions);row.reportPath=received.resultPath;
   assert.equal(resolve(received.resultPath),join(providerDirectory,'result.json'),'Unexpected report provenance');
   const report=JSON.parse(await readFile(row.reportPath,'utf8'));assert.deepEqual(report,received.report,'Saved/returned reports disagree');
   const completed=JSON.parse(await readFile(join(providerDirectory,'completed-tool-calls.json'),'utf8'));
   const terminal=JSON.parse(await readFile(join(providerDirectory,'terminal-tool-calls.json'),'utf8'));
   assert(Array.isArray(completed)&&Array.isArray(terminal),'Missing or invalid saved tool call arrays');
   envelope.completed=completed;envelope.terminal=terminal;
   const sentPrompt=JSON.parse(await readFile(join(providerDirectory,'prompt.json'),'utf8'));
   assert.deepEqual(sentPrompt,{systemPrompt:r.system,prompt:r.texts['prompt.json']},'Provider prompt differs from frozen request');
   assert.equal(digest(await readFile(join(providerDirectory,'tool.json'),'utf8')),attempt.files['tool.json'],'Provider tool differs from frozen schema');
   envelope.providerComplete=report.providerComplete===true;
   row.providerComplete=envelope.providerComplete;
   if(report.status!=='complete'||!envelope.providerComplete)throw Error('Provider probe did not complete successfully');
   row.status='recorded';
  }catch(error){row.error=error instanceof Error?error.message:String(error);}
  row.finishedAt=new Date().toISOString();row.wallElapsedMs=performance.now()-started;
  await save(row.envelopePath,envelope);result.submissions[attempt.id]=row.envelopePath;result.attempts.push(row);await save(join(attemptDirectory,'runner-result.json'),row);
 }
 result.status=result.attempts.every(row=>row.status==='recorded')?'complete':'completed-with-failures';result.finishedAt=new Date().toISOString();
 await save(join(directory,'result.json'),result);return result;
}
export async function main(args=process.argv.slice(2)){
 assert(args.length===3&&args[0]==='--execute','Usage: parameter-trial-run.ts --execute BUNDLE_DIRECTORY NEW_OUTPUT_DIRECTORY. No implicit provider execution.');
 const result=await runParameterTrials({bundleDirectory:args[1],directory:args[2]});
 console.log(json({status:result.status,result:join(resolve(args[2]),'result.json'),attempts:result.attempts.length}));
 if(result.status!=='complete')process.exitCode=1;
}
if(import.meta.main)main().catch(error=>{console.error(error instanceof Error?error.message:String(error));process.exitCode=1;});

import {afterAll,beforeAll,expect,test} from 'bun:test';
import {cp,mkdtemp,mkdir,readFile,rm,writeFile} from 'node:fs/promises';
import {dirname,join,resolve,sep} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {runParameterTrials,type TrialProbe} from './parameter-trial-run.js';
import {prepareParameterTrials} from './parameter-trial.js';
let root:string,fixture:string;
const read=async(path:string)=>JSON.parse(await readFile(path,'utf8'));
const flag=(args:string[],name:string)=>args.find(arg=>arg.startsWith(`--${name}=`))!.slice(name.length+3);
beforeAll(async()=>{root=await mkdtemp(join(tmpdir(),'parameter-trial-run-'));fixture=join(root,'fixture');
 await prepareParameterTrials({directory:fixture,seed:20261016,config:{model:'gpt-6-luna',thinking:'off',serviceTier:'priority',maxTokens:2048,timeoutMs:10000}});});
afterAll(async()=>{if(root&&resolve(root).startsWith(resolve(tmpdir())+sep)&&root.includes('parameter-trial-run-'))await rm(root,{recursive:true,force:true});});
async function copy(name:string){const dir=join(root,name);await cp(fixture,dir,{recursive:true});return dir;}
function fake(onCall:(args:string[],options:Parameters<TrialProbe>[1],index:number)=>Promise<void>=async()=>{}){
 const calls:string[][]=[];
 const probe=(async(args,options)=>{
  const index=calls.length;calls.push(args);await onCall(args,options,index);
  const out=flag(args,'out');await mkdir(out);
  await writeFile(join(out,'prompt.json'),JSON.stringify({systemPrompt:await readFile(flag(args,'system-file'),'utf8'),prompt:await readFile(flag(args,'prompt-file'),'utf8')},null,2));
  await writeFile(join(out,'tool.json'),await readFile(join(dirname(flag(args,'prompt-file')),'tool.json'),'utf8'));
  const call={type:'toolCall',id:'fake',name:'submit_world',arguments:{action:'defer',reason:'offline fixture',source:'',changes:[],remove:[],parameterProgramId:'',parameterValues:[]}};
  await writeFile(join(out,'completed-tool-calls.json'),JSON.stringify([call]));await writeFile(join(out,'terminal-tool-calls.json'),JSON.stringify([call]));
  const report={providerComplete:true,status:'complete'};await writeFile(join(out,'result.json'),JSON.stringify(report));
  return {report,resultPath:join(out,'result.json'),submission:null,submissionPath:null};
 }) as TrialProbe;
 return {probe,calls};
}
test('preserves frozen request bytes and sequential schedule, with no evaluator oracle dependency',async()=>{
 const directory=await copy('without-oracle');await rm(join(directory,'evaluator-oracle.json'));
 const manifest=await read(join(directory,'manifest.json'));
 const {probe,calls}=fake(async(args,options,index)=>{
  expect(options).toMatchObject({exactSystemPrompt:true,retainedParameters:true,speechAnchors:false});
  const a=manifest.attempts[index];expect(await readFile(flag(args,'prompt-file'),'utf8')).toBe(await readFile(join(directory,a.id,'prompt.json'),'utf8'));
  expect(await readFile(flag(args,'system-file'),'utf8')).toBe((await read(join(directory,a.id,'system.json'))).system);
  expect(flag(args,'timeout-ms')).toBe('10000');expect(flag(args,'model')).toBe(manifest.config.model);
 });
 const result=await runParameterTrials({bundleDirectory:directory,directory:join(root,'run'),probe});
 expect(calls).toHaveLength(40);expect(result.attempts.map(a=>a.id)).toEqual(manifest.attempts.map((a:any)=>a.id));
 expect(result.attempts.every(a=>a.status==='recorded')).toBe(true);
 const envelope=await read(result.submissions[manifest.attempts[0].id]);expect(envelope.providerComplete).toBe(true);expect(envelope.baseRevision).toBe(1);
 expect(envelope.evidenceSha256).toBe(manifest.attempts[0].evidenceSha256);expect(result.qualityStatus).toBe('quality-unverified');
 await expect(runParameterTrials({bundleDirectory:directory,directory:join(root,'run'),probe})).rejects.toThrow();expect(calls).toHaveLength(40);
});
test('preflight rejects any changed hash before opening the probe',async()=>{
 const directory=await copy('changed'),manifest=await read(join(directory,'manifest.json'));
 await writeFile(join(directory,manifest.attempts[39].id,'prompt.json'),'changed');const {probe,calls}=fake();
 await expect(runParameterTrials({bundleDirectory:directory,directory:join(root,'changed-run'),probe})).rejects.toThrow();expect(calls).toHaveLength(0);
});
test('preflight rejects a changed tool even with updated local digest',async()=>{
 const directory=await copy('schema'),manifest=await read(join(directory,'manifest.json')),a=manifest.attempts[0];
 const text=JSON.stringify({name:'wrong'});await writeFile(join(directory,a.id,'tool.json'),text);a.files['tool.json']=createHash('sha256').update(text).digest('hex');
 await writeFile(join(directory,'manifest.json'),JSON.stringify(manifest));const {probe,calls}=fake();
 await expect(runParameterTrials({bundleDirectory:directory,directory:join(root,'schema-run'),probe})).rejects.toThrow();expect(calls).toHaveLength(0);
});
test('records probe failure and missing artifacts, continues once per remaining attempt',async()=>{
 const directory=await copy('failures');const base=fake();let index=0;
 const probe=(async(args,options)=>{const i=index++;if(i===0)throw Error('fixture failure');if(i===1)return {report:{providerComplete:true,status:'complete'},resultPath:join(flag(args,'out'),'result.json')};return base.probe(args,options);}) as TrialProbe;
 const result=await runParameterTrials({bundleDirectory:directory,directory:join(root,'failure-run'),probe});
 expect(index).toBe(40);expect(result.attempts).toHaveLength(40);expect(result.attempts.slice(0,2).every(a=>a.status==='failed')).toBe(true);
 for(const row of result.attempts.slice(0,2)){const envelope=await read(result.submissions[row.id]);expect(envelope.providerComplete).toBe(false);expect(envelope.completed).toEqual([]);}
});
test('rechecks frozen identity before each dispatch and does not retry',async()=>{
 const directory=await copy('midflight'),manifest=await read(join(directory,'manifest.json'));
 const {probe,calls}=fake(async(_args,_options,index)=>{if(index===0)await writeFile(join(directory,manifest.attempts[1].id,'prompt.json'),'changed after preflight');});
 const result=await runParameterTrials({bundleDirectory:directory,directory:join(root,'midflight-run'),probe});
 expect(calls).toHaveLength(39);expect(result.attempts[1].status).toBe('failed');expect(result.attempts).toHaveLength(40);
});
test('rejects provider evidence that differs from the exact staged prompt or tool',async()=>{
 const directory=await copy('provider-drift'),base=fake();let index=0;
 const probe=(async(args,options)=>{const result=await base.probe(args,options),i=index++;
  if(i===0){const path=join(flag(args,'out'),'prompt.json'),value=await read(path);value.systemPrompt+=' appended instruction';await writeFile(path,JSON.stringify(value));}
  if(i===1)await writeFile(join(flag(args,'out'),'tool.json'),'{}');return result;
 }) as TrialProbe;
 const result=await runParameterTrials({bundleDirectory:directory,directory:join(root,'provider-drift-run'),probe});
 expect(result.attempts.slice(0,2).every(row=>row.status==='failed')).toBe(true);
 for(const row of result.attempts.slice(0,2))expect((await read(result.submissions[row.id])).providerComplete).toBe(false);
 expect(result.attempts.slice(2).every(row=>row.status==='recorded')).toBe(true);
});

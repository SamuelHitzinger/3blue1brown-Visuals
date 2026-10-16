import {afterAll,beforeAll,expect,test} from 'bun:test';
import {mkdtemp,readFile,writeFile,rm,cp} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join,resolve,sep} from 'node:path';
import {tmpdir} from 'node:os';
import {prepareParameterTrials,evaluateParameterTrials,trialSchedule} from './parameter-trial.js';

let root:string,bundle:Awaited<ReturnType<typeof prepareParameterTrials>>;
const config={model:'offline-test-model',thinking:'low',serviceTier:'default',maxTokens:4096,timeoutMs:90000} as const;
const read=async(path:string)=>JSON.parse(await readFile(path,'utf8'));
beforeAll(async()=>{root=await mkdtemp(join(tmpdir(),'parameter-trial-'));bundle=await prepareParameterTrials({directory:join(root,'bundle'),seed:17,config});});
afterAll(async()=>{if(root&&resolve(root).startsWith(resolve(tmpdir())+sep)&&root.includes('parameter-trial-'))await rm(root,{recursive:true,force:true});});
test('seeded schedule is deterministic, balanced within each case, and bounded',()=>{
 const a=trialSchedule(['a','b'],17,2);expect(a).toEqual(trialSchedule(['a','b'],17,2));
 expect(a).toHaveLength(8);
 for(const id of ['a','b'])expect(a.filter(x=>x.caseId===id&&x.position===0).map(x=>x.action).sort()).toEqual(['add','parameters']);
 expect(()=>trialSchedule(['a'],17,3)).toThrow();expect(()=>trialSchedule(['a'],17,0)).toThrow();
});
test('public requests contain identical initial evidence, no answers, and are write-once',async()=>{
 expect(bundle.attempts).toHaveLength(40);
 const oracle=await read(join(root,'bundle','evaluator-oracle.json'));
 for(const c of oracle.cases){
  const attempts=bundle.attempts.filter(a=>a.caseId===c.id&&a.repeat===0);
  const prompts=await Promise.all(attempts.map(a=>read(join(root,'bundle',a.id,'prompt.json'))));
  expect(prompts[0].evidence).toEqual(prompts[1].evidence);
  const text=JSON.stringify(prompts);expect(text).not.toContain('baselineSource');expect(text).not.toContain('expectedValue');
  expect(prompts[0].evidence.source).toBe(c.source);expect(prompts[0].evidence.source).not.toBe(c.baselineSource);
  expect(Object.keys(prompts[0].evidence).sort()).toEqual(['caseId','source','summary','task','timeSeconds']);
 }
 expect(bundle.labels).toContain('baseline-not-live-replacement');
 await expect(prepareParameterTrials({directory:join(root,'bundle'),seed:17,config})).rejects.toThrow();
});
async function submission(action:'add'|'parameters'|'defer',value:number,source?:string){
 return {action,reason:action==='defer'?'insufficient evidence':'',source:action==='add'?source!:'',changes:[],remove:[],
  parameterProgramId:action==='parameters'?'construction':'',parameterValues:action==='parameters'?[{id:'p',value}]:[]};
}
async function evaluate(name:string,mutate:(a:typeof bundle.attempts[number],c:any)=>Promise<{args:any;baseRevision?:number;terminalArgs?:any;providerComplete?:unknown;nonArray?:boolean}>,allCases=false,bundleDirectory=join(root,'bundle')) {
 const oracle=await read(join(bundleDirectory,'evaluator-oracle.json')),prepared=await read(join(bundleDirectory,'manifest.json')) as typeof bundle,files:Record<string,string>={};
 for(const a of prepared.attempts.filter(a=>(allCases||a.caseId==='slope-low')&&a.repeat===0)){
  const c=oracle.cases.find((c:any)=>c.id===a.caseId),m=await mutate(a,c),call={type:'toolCall',id:'call-1',name:'submit_world',arguments:m.args};
  const path=join(root,`${name}-${a.id}.json`);await writeFile(path,JSON.stringify({attemptId:a.id,evidenceSha256:a.evidenceSha256,configSha256:bundle.configSha256,
   baseRevision:m.baseRevision??1,providerComplete:m.providerComplete??true,completed:m.nonArray?{0:call,length:1}:[call],terminal:[{...call,arguments:m.terminalArgs??m.args}]}));files[a.id]=path;
 }
 return evaluateParameterTrials({bundleDirectory,directory:join(root,name),submissions:files});
}
test('correct pair passes independent frames and oracle at interior times with epoch preserved',async()=>{
 const result=await evaluate('correct',async(a,c)=>({args:await submission(a.action,c.values.p,c.baselineSource)}));
 const rows=result.attempts.filter(a=>a.caseId==='slope-low'&&a.repeat===0);expect(rows.every(a=>a.status==='passed')).toBe(true);
 expect(rows.every(a=>a.sampleTimesSeconds.includes(3.375)&&a.epoch===0)).toBe(true);
 expect(result.attempts).toHaveLength(40);expect(result.attempts.filter(a=>a.status==='failed')).toHaveLength(38);
 expect(result.qualityStatus).toBe('quality-unverified');expect(result.providerLatency).toBeNull();
});
test('all ten existing controls pass both independent local evaluation arms',async()=>{
 const result=await evaluate('all-controls',async(a,c)=>({args:await submission(a.action,c.values.p,c.baselineSource)}),true);
 const rows=result.attempts.filter(a=>a.repeat===0);expect(rows).toHaveLength(20);
 expect(rows.filter(a=>a.status==='failed').map(a=>({id:a.id,error:a.error}))).toEqual([]);
},30_000);
test('matched wrong pair and no-op cannot pass',async()=>{
 const result=await evaluate('wrong',async(a,c)=>({args:await submission(a.action,c.initialValue,c.source)}));
 expect(result.attempts.every(a=>a.status==='failed')).toBe(true);
});
for(const mode of ['stale','defer','wrongbranch','terminal-mismatch','epoch','geometry','controls','duration','renderer'] as const)test(`rejects ${mode} and retains all failures`,async()=>{
 const result=await evaluate(mode,async(a,c)=>({args:await submission(mode==='defer'?'defer':mode==='wrongbranch'?(a.action==='add'?'parameters':'add'):a.action,c.values.p,
  mode==='epoch'?c.baselineSource.replace('t*.1','(t-3)*.1'):mode==='geometry'?c.baselineSource.replace('[x,p*x,0]','[x,p*x+0.1,0]'):mode==='controls'?c.baselineSource.replace('max:2','max:20'):
  mode==='duration'?c.baselineSource.replace('s.wait(20)','s.wait(6)'):mode==='renderer'?c.baselineSource.replace("end:'hold'","end:'advance'"):c.baselineSource),
  ...(mode==='stale'?{baseRevision:0}:{}),...(mode==='terminal-mismatch'?{terminalArgs:await submission('defer',0)}:{})}));
 const rows=result.attempts.filter(a=>a.caseId==='slope-low'&&a.repeat===0);
 expect(rows.filter(a=>a.status==='failed')).toHaveLength(['epoch','geometry','controls','duration','renderer'].includes(mode)?1:2);
});
for(const invalid of ['false',1,false,'nonArray'])test(`rejects malformed saved completion metadata ${typeof invalid} ${invalid}`,async()=>{
 const result=await evaluate(`invalid-${typeof invalid}-${invalid}`,async(a,c)=>({args:await submission(a.action,c.values.p,c.baselineSource),...(invalid==='nonArray'?{nonArray:true}:{providerComplete:invalid})}));
 expect(result.attempts.every(a=>a.status==='failed')).toBe(true);
});
test('self-consistent request hashes cannot substitute answer source for initial evidence; failed output is retained',async()=>{
 const directory=join(root,'inconsistent-bundle');await cp(join(root,'bundle'),directory,{recursive:true});
 const manifest=await read(join(directory,'manifest.json')),oracle=await read(join(directory,'evaluator-oracle.json'));
 for(const a of manifest.attempts.filter((a:any)=>a.caseId==='slope-low'&&a.repeat===0)){
  const file=join(directory,a.id,'prompt.json'),prompt=await read(file);prompt.evidence.source=oracle.cases.find((c:any)=>c.id===a.caseId).baselineSource;
  const text=JSON.stringify(prompt,null,2);await writeFile(file,text);a.files['prompt.json']=createHash('sha256').update(text).digest('hex');
  a.evidenceSha256=createHash('sha256').update(JSON.stringify(prompt.evidence,null,2)).digest('hex');
 }
 await writeFile(join(directory,'manifest.json'),JSON.stringify(manifest,null,2));
 const result=await evaluate('inconsistent',async(a,c)=>({args:await submission(a.action,c.values.p,c.baselineSource)}),false,directory);
 expect(result.attempts.every(a=>a.status==='failed')).toBe(true);
 for(const a of result.attempts.filter(a=>a.caseId==='slope-low'&&a.repeat===0))expect(await read(join(root,'inconsistent',`${a.id}-submission.json`))).toHaveProperty('completed');
});

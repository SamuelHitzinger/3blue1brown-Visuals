import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash,randomUUID} from 'node:crypto';
const [requestPath,outputPath]=process.argv.slice(2);
if(!requestPath||!outputPath)throw Error('Usage: bun scripts/visual-quality-smoke.ts REQUEST_JSON NEW_OUTPUT_DIR');
const root=resolve(outputPath),tree=process.cwd();
await mkdir(root,{recursive:false});
const snapshot={tree,createdAt:new Date().toISOString(),runtimePath:import.meta.resolve('animlib/core')};
await writeFile(join(root,'snapshot.json'),JSON.stringify(snapshot,null,2));
process.env.MOLECULAR_MODEL_CACHE_DIR=join(root,'molecular-cache');
process.env.MODEL_ASSET_DIR=join(root,'models');
const {agentConfig,agentFailure}=await import(pathToFileURL(join(tree,'backend/src/agents/config.ts')).href);
const {PiAgentRunner}=await import(pathToFileURL(join(tree,'backend/src/agents/runtime.ts')).href);
const {createPiGenerator}=await import(pathToFileURL(join(tree,'backend/src/agents/generator.ts')).href);
const request=JSON.parse(await readFile(resolve(requestPath),'utf8'));
const hash=(data:string|Uint8Array)=>createHash('sha256').update(data).digest('hex');
const config=agentConfig({...process.env,AGENT_PROVIDER:'openai-codex',AGENT_AUTH_MODE:'subscription',AGENT_MODEL:'gpt-6-astra',AGENT_THINKING:'high',AGENT_SCENE_OUTPUT_MODE:'validated-reference',AGENT_SCENE_TIMING_MODE:'host'});
const id=randomUUID(),outputRoot=join(root,'runs'),directory=join(outputRoot,id);await mkdir(directory,{recursive:true});
const result:any={status:'running',id,directory,createdAt:new Date().toISOString(),request,requestSha256:hash(JSON.stringify(request)),model:config.model,thinking:config.thinking,provider:config.provider,timing:config.sceneTimingMode,outputMode:config.sceneOutputMode,snapshotSha256:hash(JSON.stringify(snapshot)),scenes:[],tasks:[],scope:'Separate prepared-protein capability smoke through fresh production planning/editorial/authoring/native gates. Not an A/B causal comparison. No seeded plan or hand-edited generated source.',assetsDirectory:process.env.MODEL_ASSET_DIR};
const save=()=>writeFile(join(root,'result.json'),JSON.stringify(result,null,2));await save();await writeFile(join(directory,'request.json'),JSON.stringify(request,null,2));
const pi=new PiAgentRunner(config);let counter=0;
const runner={async run(task:any){const number=counter++,stage=task.logContext?.stage??'unknown',started=performance.now();let metrics:any;result.stage=stage;result.sceneIndex=task.logContext?.sceneIndex;await save();await writeFile(join(directory,`task-${number}-${stage}.prompt.md`),task.systemPrompt+'\n\n'+task.prompt);try{const output=await pi.run({...task,onMetrics(value:any){metrics=value;task.onMetrics?.(value);}});await writeFile(join(directory,`task-${number}-${stage}.output.txt`),output);return output;}finally{const entry={number,stage,sceneIndex:task.logContext?.sceneIndex,elapsedMs:performance.now()-started,metrics};result.tasks.push(entry);await writeFile(join(directory,`task-${number}-${stage}.metrics.json`),JSON.stringify(entry,null,2));await save();}}};
const generate=createPiGenerator(runner,{available:false},outputRoot,{outputMode:config.sceneOutputMode,timingMode:config.sceneTimingMode});
const started=performance.now(),signal=AbortSignal.timeout(60*60*1000);let previousFrame:any,plannedCount=1;
try{
 for(let index=0;index<plannedCount;index++){
  const output=await generate(request,index,{owner:'protein-capability-proof',videoId:id,signal,previousFrame});if(!output)throw Error('Missing planned scene');
  result.scenes.push(output.scene);await writeFile(join(directory,`scene-${index}.silent-clock.wav`),output.audio);
  previousFrame=JSON.parse(await readFile(join(directory,`scene-${index}.final-frame.json`),'utf8'));
  const lesson=JSON.parse(await readFile(join(directory,'lesson.json'),'utf8'));plannedCount=lesson.plan.scenes.length;
  if(plannedCount>3)throw Error('Smoke exceeded three scenes; evidence retained.');result.plannedSceneCount=plannedCount;result.requestedSceneCount=2;result.requestedCountViolation=plannedCount!==2;await save();
 }
 if(result.scenes.length!==plannedCount)throw Error('Incomplete planned lesson');
 result.status='complete';
}catch(error){const failure=agentFailure(error);result.status='failed';result.error={code:failure.code,message:failure.message};process.exitCode=1;}
finally{result.elapsedMs=performance.now()-started;result.totalDuration=result.scenes.reduce((sum:number,s:any)=>sum+s.duration,0);await save();console.log(JSON.stringify({event:'protein-proof.finished',status:result.status,directory,scenes:result.scenes.length,plannedCount,error:result.error}));}

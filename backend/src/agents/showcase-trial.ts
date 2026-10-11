/** Production scene-stage benchmark. Run from backend with Bun; see docs/showcase-batch-style-contract.md. */
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash,randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {agentConfig} from './config.js';
import {PiAgentRunner} from './runtime.js';
import type {AgentTask} from './runtime.js';
import {createPiGenerator} from './generator.js';
import {parsePlannedLesson} from './planning.js';
import {atomicWrite} from '../narration/service.js';
import type {NarrationService} from '../narration/service.js';
import type {NarrationScenePackage} from '../narration/types.js';
import {showcaseTopics,showcasePrompt} from './showcase-catalog.js';

const repo=fileURLToPath(new URL('../../..',import.meta.url));
const batch=process.env.SHOWCASE_BATCH ?? '20261010-batch1';
if(!/^[a-z0-9-]+$/.test(batch))throw new Error('Invalid batch name.');
const duration=20, command=process.argv[2]??'prepare';
const port=Number(process.env.SHOWCASE_PORT??5211);
if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('Invalid SHOWCASE_PORT.');
const audioUrl=`http://127.0.0.1:${port}/silence.wav`;
const root=resolve(repo,command==='serve-archive'?'docs/demos/showcases':'data/showcases',batch);
const hash=(v:string|Uint8Array)=>createHash('sha256').update(v).digest('hex');
const config=agentConfig();
const manifestPath=join(root,'manifest.json');
type Result={id:string;title:string;category:string;mode:string;prompt:string;promptSha256:string;videoId:string;status:string;stage?:string;elapsedMs?:number;error?:string;review?:unknown;evidenceAttempt?:number;scenes:any[]};
await mkdir(root,{recursive:true});
const silence=Buffer.alloc(44+24000*duration*2);
silence.write('RIFF');silence.writeUInt32LE(silence.length-8,4);silence.write('WAVEfmt ',8);silence.writeUInt32LE(16,16);silence.writeUInt16LE(1,20);silence.writeUInt16LE(1,22);silence.writeUInt32LE(24000,24);silence.writeUInt32LE(48000,28);silence.writeUInt16LE(2,32);silence.writeUInt16LE(16,34);silence.write('data',36);silence.writeUInt32LE(silence.length-44,40);
await writeFile(join(root,'silence.wav'),silence);
const readJson=async(path:string)=>JSON.parse(await readFile(path,'utf8'));

if(command==='serve'||command==='serve-archive'){
  Bun.serve({hostname:'127.0.0.1',port,async fetch(req){
    const path=new URL(req.url).pathname,headers={'Access-Control-Allow-Origin':'*','Cache-Control':'no-store'};
    if(path==='/manifest.json')return Response.json(await readJson(manifestPath),{headers});
    if(path==='/silence.wav')return new Response(Bun.file(join(root,'silence.wav')),{headers});
    const m=/^\/evidence\/([a-z0-9-]+)\/([01])\/([a-z0-9x.-]+\.png)$/.exec(path);
    if(m){const manifest=await readJson(manifestPath),run=manifest.runs.find((r:Result)=>r.id===m[1]);if(run){const file=Bun.file(join(root,run.videoId,'scene-0.visual',m[2],m[3]));if(await file.exists())return new Response(file,{headers});}}
    return new Response('Not found',{status:404,headers});
  }});
  console.log(`Showcase manifest: http://127.0.0.1:${port}/manifest.json`);
}else{
  let manifest:any;
  try{manifest=await readJson(manifestPath);}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
  if(!manifest){
    const files=['backend/prompts/scene-craft.md','backend/prompts/scene-verify.md','backend/prompts/scene-repair.md','shared/animlib/docs/reference.md'];
    const promptFiles=[];
    for(const path of files){try{promptFiles.push({path,sha256:hash(await readFile(join(repo,path)))});}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}}
    const runtimeFiles=[];
    for(const path of ['backend/src/agents/generator.ts','backend/src/agents/runtime.ts','backend/src/agents/visual-gate.ts','backend/src/agents/frame-renderer.ts','backend/src/narration/handoff.ts'])runtimeFiles.push({path,sha256:hash(await readFile(join(repo,path)))});
    manifest={batch,createdAt:new Date().toISOString(),commit:execFileSync('git',['rev-parse','HEAD'],{cwd:repo,encoding:'utf8'}).trim(),model:config.model,thinking:config.thinking,provider:config.provider,outputMode:config.sceneOutputMode,timingMode:config.sceneTimingMode,promptFiles,
      runtimeFiles,port,
      boundary:'Actual createPiGenerator scene stage and PiAgentRunner tools; fixed one-scene planning and 20-second silent timing fixtures replace editorial planning and TTS. Generated source is never manually edited. Failed scenes remain unapproved.',
      runs:showcaseTopics.map(t=>({id:t[0],title:t[1],category:t[2],mode:t[3],prompt:showcasePrompt(t),promptSha256:hash(showcasePrompt(t)),videoId:randomUUID(),status:'pending',scenes:[]}))};
  }
  // Refuse to mix a changed catalog or model into this immutable batch.
  for(const t of showcaseTopics)if(manifest.runs.find((r:Result)=>r.id===t[0])?.promptSha256!==hash(showcasePrompt(t)))throw new Error('Catalog changed. Use a new SHOWCASE_BATCH.');
  if(manifest.model!==config.model||manifest.thinking!==config.thinking)throw new Error('Model changed. Use a new SHOWCASE_BATCH.');
  if(manifest.provider!==config.provider||manifest.outputMode!==config.sceneOutputMode||manifest.timingMode!==config.sceneTimingMode||(manifest.port??5211)!==port)throw new Error('Pipeline configuration changed. Use a new SHOWCASE_BATCH or restore its configuration.');
  for(const file of [...manifest.promptFiles,...(manifest.runtimeFiles??[])])if(hash(await readFile(join(repo,file.path)))!==file.sha256)throw new Error(`${file.path} changed. Use a new SHOWCASE_BATCH.`);
  let writeChain=Promise.resolve();
  const save=()=>{const snapshot=JSON.stringify(manifest,null,2);writeChain=writeChain.then(()=>atomicWrite(manifestPath,snapshot));return writeChain;};
  await save();
  if(command==='prepare'){console.log(JSON.stringify({batch,topics:manifest.runs.length,model:config.model,root}));}
  else if(command==='run'){
    const concurrency=Number(process.env.SHOWCASE_CONCURRENCY??3);
    if(!Number.isInteger(concurrency)||concurrency<1||concurrency>3)throw new Error('SHOWCASE_CONCURRENCY must be 1, 2, or 3.');
    const selected=process.argv[3]?.split(',');
    if(selected?.some(id=>!manifest.runs.some((r:Result)=>r.id===id)))throw new Error('Unknown topic ID. Quote comma-separated IDs in PowerShell.');
    const ordered=[0,4,16,1,6,12,2,7,17,3,8,13,5,9,18,10,14,19,11,15,20,21,22,23].map(i=>manifest.runs[i] as Result);
    const queue=ordered.filter(r=>(!selected||selected.includes(r.id))&&!['complete','failed'].includes(r.status));
    manifest.executions??=[];
    manifest.executions.push({startedAt:new Date().toISOString(),concurrency,topics:queue.map(r=>r.id)});
    await save();
    const pi=new PiAgentRunner(config);
    async function execute(run:Result){
      const directory=join(root,run.videoId);await mkdir(directory,{recursive:true});
      const started=performance.now();run.status='running';run.stage='preparing';await save();
      const request={title:run.title,topic:run.prompt,documents:[],videoMode:'classic' as const};
      const description=`${run.mode==='3d'?'3D:':'2D (because the requested construction is planar):'} ${run.prompt}`;
      const lesson={schemaVersion:1,markdown:`# ${run.title}\n\n## Beat 1: ${run.title}\n\nContent needed: ${description}\n\nNarration: This is a silent visualization timing fixture.`,plan:{audience:'Curious adult',prerequisites:[],learningGoal:run.title,centralQuestion:run.title,keyInsight:run.prompt,runningExample:run.title,misconceptions:['Schematic geometry is not measured data.'],entities:[],scenes:[{id:'beat-1',purpose:run.title,whyNow:'Standalone single-scene visualization showcase.',keyPoints:[showcaseTopics.find(t=>t[0]===run.id)![4]],visualDescription:description,endsWith:'Hold the resulting detailed construction clearly for inspection.',carry:[],cleanup:[],sourceRefs:[{document:'request',location:'supplied text',supports:run.prompt}],interactions:[]}]}};
      parsePlannedLesson(JSON.stringify(lesson),request);
      const packageId=`silent-${run.id}`,audioId=`silent-${run.id}`;
      const pkg:NarrationScenePackage={id:packageId,scriptHash:hash(lesson.markdown),totalScenes:1,scenes:[{id:'beat-1',title:run.title,context:description,startSec:0,durationSec:duration,audio:{id:audioId,url:audioUrl,sha256:hash(silence),sampleCount:24000*duration},utterances:[],pauses:[]}]};
      await atomicWrite(join(directory,'lesson.json'),JSON.stringify(lesson,null,2));
      await atomicWrite(join(directory,'narration-id'),packageId);
      await atomicWrite(join(directory,'silent-fixture.json'),JSON.stringify(pkg,null,2));
      let taskNumber=0;
      const runner={async run(task:AgentTask){const n=taskNumber++;run.stage=task.logContext?.stage??'scene';await save();let metrics:unknown;try{return await pi.run({...task,onMetrics:m=>{metrics=m;task.onMetrics?.(m);}});}finally{if(metrics)await atomicWrite(join(directory,`task-${n}-${task.logContext?.stage??'scene'}.metrics.json`),JSON.stringify(metrics,null,2));}}};
      const narration={available:true,get:async()=>({id:packageId,status:'complete'}),scenePackage:async()=>pkg,audio:async()=>join(root,'silence.wav')} as unknown as NarrationService;
      const generate=createPiGenerator(runner,narration,root,{outputMode:config.sceneOutputMode,timingMode:config.sceneTimingMode});
      console.log(JSON.stringify({event:'showcase.start',id:run.id,videoId:run.videoId}));
      try{
        const output=await generate(request,0,{owner:'showcase-batch',videoId:run.videoId,signal:AbortSignal.timeout(30*60*1000)});
        if(!output)throw new Error('No scene returned.');
        run.scenes=[{...output.scene,audio:{...output.scene.audio,url:audioUrl}}];
        run.review=await readJson(join(directory,'scene-0.visual-review.json'));run.evidenceAttempt=(run.review as {attempt:number}).attempt;run.status='complete';
      }catch(error){
        run.status='failed';run.error=error instanceof Error?error.message:String(error);
        // Preserve the last real candidate for visibly UNAPPROVED inspection, never call it published.
        for(const attempt of ['1','0']){try{const source=await readFile(join(directory,'scene-0.visual',attempt,'candidate.js'),'utf8');run.scenes=[{id:'beat-1',source,duration,audio:{id:audioId,url:audioUrl}}];run.evidenceAttempt=Number(attempt);run.review=await readJson(join(directory,'scene-0.visual',attempt,'review.json')).catch(()=>undefined);break;}catch{}}
      }
      run.elapsedMs=performance.now()-started;run.stage='finished';await save();
      console.log(JSON.stringify({event:'showcase.finish',id:run.id,status:run.status,elapsedMs:run.elapsedMs,error:run.error}));
    }
    await Promise.all(Array.from({length:Math.min(concurrency,queue.length)},async()=>{while(queue.length){const next=queue.shift();if(next)await execute(next);}}));
    console.log(JSON.stringify({event:'showcase.batch-finished',counts:manifest.runs.reduce((a:Record<string,number>,r:Result)=>(a[r.status]=(a[r.status]??0)+1,a),{})}));
  }else throw new Error('Use prepare, run [comma-separated topic ids], serve, or serve-archive.');
}

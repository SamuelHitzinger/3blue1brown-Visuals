/** Local-only benchmark. Every run writes a new immutable evidence directory. */
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {LiveWorld} from './realtime-world/world.js';
const args=process.argv.slice(2),value=(key:string)=>args.find(arg=>arg.startsWith(`--${key}=`))?.split('=').slice(1).join('=');
const samples=Number(value('samples')??12);if(!Number.isInteger(samples)||samples<3||samples>200)throw Error('--samples must be 3–200');
const root=resolve('data/realtime-workshop/render-profile');await mkdir(root,{recursive:true});
const directory=resolve(value('out')??join(root,new Date().toISOString().replaceAll(':','-')+'-'+randomUUID().slice(0,8)));await mkdir(directory);
const hash=(value:string|Uint8Array)=>createHash('sha256').update(value).digest('hex');
const simple=`export default scene({mode:'3d',orbit:false,end:'hold'},s=>{const cube=s.box('cube',{fill:'BLUE'});s.bind(cube,[s.time],t=>({rotation:[0,t,0]}));s.wait(60);});`;
const cases=[{id:'simple',source:simple},{id:'labels',source:`export default scene({orbit:false,end:'hold'},s=>{for(let i=0;i<96;i++)s.text('label'+i,{text:'ω² = '+i+' x',fontSize:.22,position:[(i%12-5.5)*1.05,(Math.floor(i/12)-3.5)*.65,0]});s.wait(60);});`},
  {id:'surface',source:`export default scene({mode:'3d',orbit:false,end:'hold'},s=>{const surface=s.parametricSurface('surface',{fn:(u,v)=>[u,v,Math.sin(u)*Math.cos(v)],uRange:[-3,3],vRange:[-3,3],uSegments:40,vSegments:40,shading:'smooth',fill:'TEAL'});s.deform(surface,[s.time],(p,i,t)=>[p[0],p[1],Math.sin(p[0]+t)*Math.cos(p[1])]);s.wait(60);});`},
  {id:'glb',source:`export default scene({mode:'3d',orbit:false,end:'hold'},s=>{const model=s.model('complex',{asset:'complex',source:'glb',scale:.035});s.bind(model,[s.time],t=>({rotation:[0,t*.2,0]}));s.wait(60);});`}];
const selected=cases.filter(f=>!value('case')||value('case')!.split(',').includes(f.id));if(!selected.length)throw Error('Unknown --case');
const sources=['backend/bench/realtime-render-profile.ts','backend/bench/realtime-render-profile/worker.mjs','shared/animlib/src/compiler.ts','shared/animlib/src/timeline.ts','shared/animlib/src/render-geometry.ts','shared/animlib/src/renderer.ts','shared/animlib/src/retained-geometry.ts','shared/animlib/src/gpu-retained.ts','shared/animlib/src/composition.ts','shared/animlib/dist/renderer.js','shared/animlib/dist/render-geometry.js'];
const provenance=Object.fromEntries(await Promise.all(sources.map(async path=>[path,hash(await readFile(path))])));
await writeFile(join(directory,'started.json'),JSON.stringify({schemaVersion:1,startedAt:new Date().toISOString(),samples,provenance},null,2),{flag:'wx'});
const results=[];
for(const fixture of selected){
  let models;
  if(fixture.id==='glb'){
    const modelPath=resolve(value('model')??'backend/data/models/b395b900e5008e039b988a865814311a9d55cc5ff1bf0675b01621265236e450.glb');
    const bytes=await readFile(modelPath),metadata=JSON.parse(await readFile(modelPath.replace(/\.glb$/,'.json'),'utf8'));
    if(hash(bytes)!==metadata.asset.sha256)throw Error('Published model hash mismatch');models={assets:{complex:metadata.asset},files:{[metadata.asset.url]:bytes.toString('base64')}};
    await writeFile(join(directory,'model-provenance.json'),JSON.stringify({modelPath,sha256:hash(bytes),bytes:bytes.length,metadata:metadata.asset.metadata},null,2),{flag:'wx'});
  }
  const result=join(directory,fixture.id+'-result.json'),inputPath=join(directory,fixture.id+'-input.json');
  await writeFile(inputPath,JSON.stringify({...fixture,samples,result,models,...(args.includes('--profile')?{profile:join(directory,fixture.id+'.cpuprofile')}:{} )}),{flag:'wx'});
  const start=performance.now();const processResult=spawnSync('node',[resolve('backend/bench/realtime-render-profile/worker.mjs'),inputPath],{windowsHide:true,encoding:'utf8',timeout:120000,maxBuffer:2_000_000});
  const subprocessMs=performance.now()-start;
  let metrics;try{metrics=JSON.parse(await readFile(result,'utf8'));}catch{}
  const row={id:fixture.id,subprocessMs,exitCode:processResult.status,error:processResult.error?.message,stderr:processResult.stderr,metrics};results.push(row);
  await writeFile(join(directory,fixture.id+'-process.json'),JSON.stringify(row,null,2),{flag:'wx'});console.log(JSON.stringify({id:fixture.id,status:metrics?.status??'process-failed',subprocessMs,coldCompileMs:metrics?.coldCompileMs,renderMedianMs:metrics?.renderCPU?.medianMs,geometryMedianMs:metrics?.geometryCPU?.medianMs,error:metrics?.error??processResult.stderr}));
  if(args.includes('--export')){const exportInput=join(directory,fixture.id+'-export-input.json');await writeFile(exportInput,JSON.stringify({source:fixture.source,models,times:[0,.25,.5],directory:join(directory,fixture.id+'-export')}),{flag:'wx'});
    const start=performance.now(),out=spawnSync('node',['shared/animlib/tools/render-frames.mjs',exportInput],{windowsHide:true,encoding:'utf8',timeout:120000,maxBuffer:2_000_000});
    await writeFile(join(directory,fixture.id+'-export.json'),JSON.stringify({subprocessMs:performance.now()-start,exitCode:out.status,stdout:out.stdout,stderr:out.stderr,error:out.error?.message},null,2),{flag:'wx'});
  }
}
// Persistent-world overhead uses the real transactional wrapper and retained VM.
Object.defineProperty(globalThis,'Worker',{configurable:true,writable:true,value:undefined});
const world=new LiveWorld({clock:()=>0});try{const begin=performance.now();await world.addProgram({id:'simple',source:simple,baseRevision:0},0);const commitMs=performance.now()-begin,worldSamples=[];
for(let i=0;i<samples;i++){const start=performance.now(),frame=await world.sample(i/60);if(Math.abs(frame.elements[0].rotation[1]-i/60)>1e-9)throw Error('Persistent motion assertion failed');worldSamples.push(performance.now()-start);}
await writeFile(join(directory,'world.json'),JSON.stringify({commitMs,sampleMs:worldSamples,scope:'Bun headless LiveWorld, excluding renderer/GPU'},null,2),{flag:'wx'});
}finally{world.dispose();}
await writeFile(join(directory,'result.json'),JSON.stringify({directory,completedAt:new Date().toISOString(),cases:results.map(({metrics,...row})=>({...row,result:join(directory,row.id+'-result.json')})),provenance},null,2),{flag:'wx'});
console.log(JSON.stringify({directory}));

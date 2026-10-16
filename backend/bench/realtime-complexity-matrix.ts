/** Matched authoring screen across subjects and visual detail; no live-readiness claim. */
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {directSourceAuthorSystem,compactAuthorSystem} from './realtime-media/causal-prompts.js';
import {loadProbeSource} from './realtime-render.js';
import {SourceCompiler} from '../../shared/animlib/src/compiler-client.js';
import {renderSceneFrames} from '../src/agents/frame-renderer.js';
import {evaluateScene} from '../../shared/animlib/src/timeline.js';
import {prepareCaffeineCases} from './realtime-complexity-fixtures/prepare.js';

const cases=[
 {id:'line-basic',subject:'algebra',detail:'low',dimension:2,instruction:'Show y=x on x in [-2,2], with labeled x/y axes and one moving point. Make slope 1 visible using a rise/run triangle from x=0 to x=1; local labels show equal rise and run. Preserve graph during the operation. No extra curves.'},
 {id:'line-detailed',subject:'algebra',detail:'high',dimension:2,instruction:'Show y=x and y=2x on x in [-1.3,1.3], with labeled axes and distinct stable colors. Animate one shared x marker from .2 to1, corresponding points and projection guides on both lines. At x=1 compare two rise/run triangles sharing run1 and showing rises1 versus2. Labels stay with relevant geometry. Keep both curves and earned comparison visible.'},
 {id:'surface-basic',subject:'multivariable calculus',detail:'low',dimension:3,instruction:'Show the 3D saddle z=(x*x-y*y)/2 on x,y in [-1.6,1.6], using a shaded surface with 10x10 cells. Make the upward x-axis trace at y=0 and downward y-axis trace at x=0 visible in different colors, reveal them sequentially and retain them. Label x,y,z and associate each local formula with its trace. Genuine 3D geometry required.'},
 {id:'surface-detailed',subject:'multivariable calculus',detail:'high',dimension:3,instruction:'Show the same saddle z=(x*x-y*y)/2 on x,y in [-1.6,1.6], using a smooth-shaded 40x40-cell surface. Show an x-direction trace in plane y=c moving from c=-1 to1. Include its translucent slicing plane, attached c label or moving c marker, x/y/z axes and the fixed y-direction trace at x=0 for contrast. The moving trace must remain on the surface for every frame. At end hold c=1 and both opposite-curvature traces. Genuine3D geometry and readable depth required.'},
 {id:'probability-curves',subject:'probability',detail:'medium',dimension:2,instruction:'Compare probability densities N(0,1) and N(0,4), where second parameter is variance: f_sigma(x)=exp(-x*x/(2*sigma*sigma))/(sigma*sqrt(2*pi)); sigma=1 versus2. Show x in [-5,5] with fixed common x/y scales, both complete curves, shared center and one-standard-deviation intervals [-1,1],[-2,2]. Visibly widen the interval while comparing peak heights. Preserve unit area interpretation; do not imply same peak or use separate vertical rescaling. Local labels identify sigma and peak, no detached title.'},
 {id:'wave-superposition',subject:'wave physics',detail:'medium',dimension:2,instruction:'Show two displacement profiles a(x)=sin(x) and b(x)=sin(x+phi), x in [-pi,pi], and their sum on fixed aligned axes. Change phi from0 to pi so constructive interference becomes cancellation. At one shared x use vertical vectors showing signed addition, linked by colors to the two inputs. Retain input curves when sum disappears. Final hold must visibly justify zero sum rather than hide the diagram. No simulated future evidence; this is a supplied mathematical example.'},
];
const extraApi=`Additional verified native geometry API available equally to both arms:
s.surface(id,{fn:(x,y)=>number,xRange:[min,max],yRange:[min,max],xSegments:integer,ySegments:integer,shading:"smooth",fill:"TEAL",opacity:1}); returns ordinary handle. Coordinates are local XYZ: Z=fn(X,Y). s.parametricSurface(id,{fn:(u,v)=>[x,y,z],uRange:[min,max],vRange:[min,max],uSegments:integer,vSegments:integer,shading:"smooth",fill:"TEAL"}). s.line3D/arrow3D(id,{points:[[x,y,z],...],stroke,strokeWidth}) gives round 3D strokes. s.molecule(id,{positions:[x,y,z,...],radius:positiveNumber,detail:0|1|2|3,fill:color}) creates beads, not bonds. Use ordinary handles and loops for bonds. Colors must be quoted palette tokens such as "GREY_B"; CSS/hex colors are rejected. s.camera.to3D({yaw:.6,pitch:.45,height:8}) creates a camera action; s.play(action,{duration:0}) sets an initial view. Camera motion is unnecessary. No invented helpers or methods. Preserve real geometry in3D; do not substitute a text explanation. If a read-only DATA binding is declared in case prompt, it is supplied by a deterministic host prelude; never redeclare or echo its arrays.`;
const helpers=compactAuthorSystem.slice(compactAuthorSystem.indexOf('Prefer existing generic helpers'));
const hash=(data:string|Uint8Array)=>createHash('sha256').update(data).digest('hex');
const save=(path:string,value:unknown)=>writeFile(path,JSON.stringify(value,null,2),{flag:'wx'});
export function matrixArms(manifest:{arms?:unknown}):('baseline'|'candidate')[]{
 const arms=manifest.arms===undefined?['baseline','candidate']:manifest.arms;
 if(!Array.isArray(arms)||!arms.length||arms.length>2||new Set(arms).size!==arms.length||arms.some(arm=>arm!=='baseline'&&arm!=='candidate'))throw Error('Invalid matrix arms');
 return [...arms];
}
export function matrixSampleTimes(duration:number):number[]{
 if(!Number.isFinite(duration)||duration<=0||duration>30)throw Error('Invalid scene duration');
 return [...new Set([0,1,3,5,6,8,duration].filter(t=>t<=duration))].sort((a,b)=>a-b);
}
export async function main(args=process.argv.slice(2)){
const arg=(name:string)=>args.find(v=>v.startsWith(`--${name}=`))?.slice(name.length+3);
const stage=arg('stage'),directory=resolve(arg('out')??'data/realtime-workshop/complexity-matrix/screen-01');
if(stage==='prepare'){
 await mkdir(directory,{recursive:true});
 await writeFile(join(directory,'baseline-system.txt'),directSourceAuthorSystem+'\n'+extraApi+'\nUse ordinary native construction and s.play/s.wait. No composition/schedule helper guidance in this arm.',{flag:'wx'});
 await writeFile(join(directory,'candidate-system.txt'),directSourceAuthorSystem+'\n'+extraApi+'\n'+helpers,{flag:'wx'});
 for(const fixture of cases){await mkdir(join(directory,fixture.id));await save(join(directory,fixture.id,'case.json'),fixture);await writeFile(join(directory,fixture.id,'prompt.txt'),`Controlled source-grounded instruction screen, not live lecture ingestion. Subject:${fixture.subject}; visual detail:${fixture.detail}; required dimension:${fixture.dimension}D.\n${fixture.instruction}\nExactly8seconds; explain through geometry and movement, final2seconds reading hold.`,{flag:'wx'});}
 await save(join(directory,'manifest.json'),{schemaVersion:1,createdAt:new Date().toISOString(),cases:cases.map(c=>c.id),model:'gpt-6.1-sol',thinking:'low',serviceTierRequested:'priority',timeoutMs:30000,attemptsPerArm:1,scope:'Matched authoring screening, not live media response or p95 benchmark. Baseline and candidate share user input/model; only helper guidance differs. No silent source repairs.'});
 await prepareCaffeineCases(directory);console.log(directory);
}else if(stage==='author'){
 const manifest=JSON.parse(await readFile(join(directory,'manifest.json'),'utf8'));
 const selected=manifest.cases.filter((id:string)=>!arg('cases')||arg('cases')!.split(',').includes(id)),arms=matrixArms(manifest);
 for(let i=0;i<selected.length;i++)for(const arm of (i%2?[...arms].reverse():arms)){
  const id=selected[i],out=join(directory,id,arm),begin=performance.now();
  const exit=await new Promise<number|null>((done,fail)=>{const child=spawn(process.execPath,['--env-file=backend/.env','backend/bench/realtime-tool-probe.ts','run','--kind=scene','--case=external',`--model=${manifest.model}`,`--thinking=${manifest.thinking}`,'--service-tier=priority',`--prompt-file=${join(directory,id,'prompt.txt')}`,`--system-file=${join(directory,arm+'-system.txt')}`,`--out=${out}`,'--timeout-ms=30000','--max-tokens=4096'],{cwd:process.cwd(),windowsHide:true,stdio:'ignore',env:{...process.env,AGENT_PROVIDER:'openai-codex',PI_CODING_AGENT_DIR:'C:/Users/samue/.pi/agent'}});const timer=setTimeout(()=>child.kill(),40000);child.once('error',e=>{clearTimeout(timer);fail(e);});child.once('exit',code=>{clearTimeout(timer);done(code);});});
  let meta;try{meta=JSON.parse(await readFile(join(out,'result.json'),'utf8'));}catch{}
  console.log(JSON.stringify({id,arm,exit,processMs:performance.now()-begin,status:meta?.status,modelMs:meta?.providerTerminalMs,outputTokens:meta?.tokens?.output,tier:meta?.serviceTierActual}));
 }
}else if(stage==='render'){
 Object.defineProperty(globalThis,'Worker',{configurable:true,writable:true,value:undefined});
 const manifest=JSON.parse(await readFile(join(directory,'manifest.json'),'utf8')),reports=[],arms=matrixArms(manifest);
 const run=join(directory,'renders-'+new Date().toISOString().replaceAll(':','-'));await mkdir(run);
 for(const id of manifest.cases.filter((id:string)=>!arg('cases')||arg('cases')!.split(',').includes(id)))for(const arm of arms){
  const row:Record<string,unknown>={id,arm,limitation:'Offline exact-source render with declared host data only. No live presentation or quality approval.'},compiler=new SourceCompiler();
  try{
   const fixture=JSON.parse(await readFile(join(directory,id,'case.json'),'utf8')),{source,...provenance}=await loadProbeSource(join(directory,id,arm));Object.assign(row,provenance);
   let prelude='';if(fixture.dataFile){const bytes=await readFile(resolve(fixture.dataFile));if(hash(bytes)!==fixture.dataSha256)throw Error('Host data hash mismatch');prelude=`const DATA=${JSON.stringify(JSON.parse(bytes.toString('utf8')))};\n`;row.hostDataSha256=fixture.dataSha256;}
   const exact=prelude+source;row.compiledSourceSha256=hash(exact);const output=join(run,id+'-'+arm);await mkdir(output);await writeFile(join(output,'compiled-source.js'),exact,{flag:'wx'});
   const start=performance.now(),scene=await compiler.compile(exact);row.compileMs=performance.now()-start;row.duration=scene.duration;row.exactEightSeconds=Math.abs(scene.duration-8)<.002;
   const firstFrame=evaluateScene(scene,0);row.firstFrameElements=firstFrame.elements.length;row.firstFrameTriangles=firstFrame.elements.reduce((n,e)=>n+(e.geometry.triangles?.length??0),0);
   if(!(scene.duration>0&&scene.duration<=30))throw Error('Invalid scene duration');
   // Inspect an under-length submission without stretching/repairing it or requesting invalid frames.
   // exactEightSeconds above remains the independent duration acceptance check.
   const times=matrixSampleTimes(scene.duration);row.sampleTimes=times;
   const renderStart=performance.now();row.evidence=await renderSceneFrames({source:exact,times,directory:output,signal:AbortSignal.timeout(45000)});row.renderProcessMs=performance.now()-renderStart;row.status='rendered';
  }catch(error){row.status='failed';row.error=error instanceof Error?error.message:String(error);}finally{compiler.dispose();}
  reports.push(row);const {evidence,...summary}=row;console.log(JSON.stringify(summary));
 }
 await save(join(run,'result.json'),reports);console.log(JSON.stringify({report:join(run,'result.json')}));
}else throw Error('Use --stage=prepare|author|render --out=DIRECTORY [--cases=comma,separated]. Each author call is paid/subscription inference; render never repairs source.');
}
if(import.meta.main)await main();

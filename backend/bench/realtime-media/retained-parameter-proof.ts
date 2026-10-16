/** Deterministic local runtime evidence. No provider, network or rendering calls. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import type {Frame} from '../../../shared/animlib/src/types.js';
import {LiveWorld} from '../realtime-world/world.js';
import {buildControlledDetailPairs,type MolecularProvenance} from '../realtime-complexity-fixtures/detail-pairs.js';

type Vec3=[number,number,number];
interface MoleculeData {atoms:{id:number;element:string;position:Vec3}[];bonds:{from:number;to:number;order:number}[];center:Vec3;counts:{atoms:number;bonds:number};elementColors:Record<string,string>}
export interface RetainedCase {
 id:string;subject:'slope'|'waves'|'gaussian'|'saddle'|'caffeine';detail:'low'|'high';detailValue:number;
 source:string;baselineSource:string;programId:'construction';values:{p:number};initialValue:number;
 comparisonTimeSeconds:number;sampleTimesSeconds:number[];requestedWidth:number;dimension:2|3;displayScale:number;
 data?:MoleculeData;provenance?:MolecularProvenance;
}
const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
const save=(path:string,value:unknown)=>writeFile(path,JSON.stringify(value,null,2));
const point=(x:number,y:number,z=0):Vec3=>[x,y,z];
const element=(frame:Frame,id:string)=>{const found=frame.elements.find(e=>e.id===id);assert(found,`Missing native element ${id}`);return found;};
const near=(actual:number,expected:number,label:string)=>assert(Number.isFinite(actual)&&Math.abs(actual-expected)<=1e-9,`${label}: ${actual} != ${expected}`);
const vector=(actual:readonly number[],expected:readonly number[],label:string)=>{assert.equal(actual.length,expected.length,label);actual.forEach((v,i)=>near(v,expected[i],label));};

function sourceFor(subject:RetainedCase['subject'],detail:number,p:number,data?:MoleculeData){
 const mode=subject==='saddle'||subject==='caffeine'?'3d':'2d';
 const slider=`const p=s.slider('p',{reactive:true,label:${JSON.stringify({slope:'Slope',waves:'Phase offset',gaussian:'Standard deviation',saddle:'Curvature',caffeine:'Rigid rotation'}[subject])},default:${p},min:${subject==='gaussian'?'.2':'-2'},max:2});`;
 const axis=`s.line('x-axis',{points:[[-4,0,0],[4,0,0]],stroke:'GREY_B',strokeWidth:.018});s.line('y-axis',{points:[[0,-2.5,0],[0,2.5,0]],stroke:'GREY_B',strokeWidth:.018});`;
 let body='';
 if(subject==='slope')body=`${axis}
 const curve=s.line('curve',{points:Array.from({length:${detail}},(_,i)=>[i/${detail},0,0]),stroke:'BLUE',strokeWidth:.04});
 s.bind(curve,[p],p=>({points:Array.from({length:${detail}},(_,i)=>{const x=-2+4*i/${detail-1};return [x,p*x,0]})}));
 const ordinate=s.line('ordinate',{points:[[0,0,0],[0,1,0]],stroke:'YELLOW',strokeWidth:.04});
 s.bind(ordinate,[p,s.time],(p,t)=>{const x=Math.sin(t*.4);return {points:[[x,0,0],[x,p*x,0]]}});`;
 if(subject==='waves')body=`${axis}
 for(const [id,color] of [['wave-a','BLUE'],['wave-b','YELLOW'],['sum','TEAL']]){
  const curve=s.line(id,{points:Array.from({length:${detail}},(_,i)=>[i/${detail},0,0]),stroke:color,strokeWidth:.035});
  s.bind(curve,[p,s.time],(p,t)=>({points:Array.from({length:${detail}},(_,i)=>{const x=-Math.PI+2*Math.PI*i/${detail-1};const a=Math.sin(x-.5*t),b=Math.sin(x-.5*t+p);return [x,id==='wave-a'?a:id==='wave-b'?b:a+b,0]})}));
 }`;
 if(subject==='gaussian')body=`${axis}
 for(const [id,color] of [['reference','GREY_B'],['density','BLUE']]){
  const curve=s.line(id,{points:Array.from({length:${detail}},(_,i)=>[i/${detail},0,0]),stroke:color,strokeWidth:.04});
  s.bind(curve,[p],p=>({points:Array.from({length:${detail}},(_,i)=>{const x=-4+8*i/${detail-1},sigma=id==='reference'?1:p;return [x,Math.exp(-x*x/(2*sigma*sigma))/(sigma*Math.sqrt(2*Math.PI)),0]})}));
 }`;
 if(subject==='saddle')body=`const vertices=[],triangles=[];
 for(let j=0;j<=${detail};j++)for(let i=0;i<=${detail};i++){const x=-1.6+3.2*i/${detail},y=-1.6+3.2*j/${detail};vertices.push([x,y,0]);}
 for(let j=0;j<${detail};j++)for(let i=0;i<${detail};i++){const a=j*${detail+1}+i;triangles.push([a,a+1,a+${detail+1}],[a+1,a+${detail+2},a+${detail+1}]);}
 const surface=s.mesh('surface',{vertices,triangles,fill:'TEAL',shading:'smooth',opacity:.7});
 s.bind(surface,[p],p=>({vertices:vertices.map(([x,y])=>[x,y,p*(x*x-y*y)])}));
 for(const [id,color] of [['x-trace','YELLOW'],['y-trace','BLUE']]){
  const curve=s.line3D(id,{points:Array.from({length:129},(_,i)=>[i/128,0,0]),stroke:color,strokeWidth:.035});
  s.bind(curve,[p,s.time],(p,t)=>({points:Array.from({length:129},(_,i)=>{const a=-1.6+3.2*i/128,c=.6*Math.sin(t*.4),x=id==='x-trace'?a:0,y=id==='x-trace'?c:a;return [x,y,p*(x*x-y*y)]})}));
 }`;
 if(subject==='caffeine')body=`const DATA=${JSON.stringify(data)},children=[];
 const pos=a=>a.position.map((v,i)=>v-DATA.center[i]);
 for(const atom of DATA.atoms)children.push(s.molecule('atom-'+atom.id,{positions:pos(atom),radius:atom.element==='H'?.13:.22,detail:${detail},fill:DATA.elementColors[atom.element]}));
 DATA.bonds.forEach((bond,index)=>{const a=pos(DATA.atoms.find(a=>a.id===bond.from)),b=pos(DATA.atoms.find(a=>a.id===bond.to));
  const d=b.map((v,i)=>v-a[i]),n=Math.hypot(d[0],d[1]),offset=n>1e-9?[-d[1]/n*.06,d[0]/n*.06,0]:[.06,0,0];
  for(let k=0;k<bond.order;k++){const sign=bond.order===1?0:k===0?-1:1;
   children.push(s.line3D('bond-'+index+'-'+k,{points:[a.map((v,i)=>v+sign*offset[i]),b.map((v,i)=>v+sign*offset[i])],stroke:'GREY_B',strokeWidth:.045}));}
 });
 const molecule=s.group('molecule',children);s.play(molecule.scaleTo(.7),{duration:0});
 s.bind(molecule,[p,s.time],(p,t)=>({rotation:[0,0,p+.05*t]}));`;
 return `export default scene({mode:'${mode}',end:'hold',orbit:false},s=>{${slider}\n${body}
 const clock=s.${mode==='3d'?'box':'rectangle'}('epoch-clock',{position:[-3,-2,0],width:.2,height:.2,fill:'YELLOW'});
 s.bind(clock,[s.time],t=>({rotation:[0,0,t*.1]}));s.wait(20);
});`;
}

export async function buildRetainedParameterCases():Promise<RetainedCase[]>{
 const fixture=(await buildControlledDetailPairs()).find(p=>p.id==='caffeine-spheres')!.low.invariants;
 const spec=[['slope',17,129,.5,1.25],['waves',33,129,.2,1.1],['gaussian',33,129,.7,1.25],['saddle',10,40,.4,.8],['caffeine',0,2,.15,.65]] as const;
 return spec.flatMap(([subject,low,high,initialValue,next])=>(['low','high'] as const).map(detail=>{
  const detailValue=detail==='low'?low:high,data=subject==='caffeine'?structuredClone(fixture.data) as MoleculeData:undefined;
  return {id:`${subject}-${detail}`,subject,detail,detailValue,initialValue,values:{p:next},programId:'construction',
   source:sourceFor(subject,detailValue,initialValue,data),baselineSource:sourceFor(subject,detailValue,next,data),
   comparisonTimeSeconds:3,sampleTimesSeconds:[3,4,5,6],requestedWidth:1280,dimension:subject==='saddle'||subject==='caffeine'?3:2,displayScale:subject==='caffeine'?.7:1,
   ...(data?{data,provenance:structuredClone(fixture.provenance)}:{})};
 }));
}

/** Compare every frame field, including geometry, parent transforms, style and camera. */
export function compareNativeFrames(actual:unknown,expected:unknown,tolerance=1e-9){
 let maxAbsoluteError=0,numericValues=0;
 function compare(a:unknown,b:unknown,path:string){
  if(typeof a==='number'&&typeof b==='number'){
   assert(Number.isFinite(a)&&Number.isFinite(b),`Nonfinite number ${path}`);numericValues++;
   const error=Math.abs(a-b);maxAbsoluteError=Math.max(maxAbsoluteError,error);assert(error<=tolerance,`Native frame difference at ${path}: ${error}`);return;
  }
  if(a&&b&&typeof a==='object'&&typeof b==='object'){
   assert.equal(Array.isArray(a),Array.isArray(b),`Native frame shape ${path}`);
   const ak=Object.keys(a).sort(),bk=Object.keys(b).sort();assert.deepEqual(ak,bk,`Native frame keys ${path}`);
   for(const key of ak)compare((a as Record<string,unknown>)[key],(b as Record<string,unknown>)[key],`${path}.${key}`);return;
  }
  assert.equal(a,b,`Native frame value ${path}`);
 }
 compare(actual,expected,'frame');return {maxAbsoluteError,numericValues};
}

/** Analytic/topology oracle independent of scene source and paired frame comparison. */
export function auditNativeFrame(c:RetainedCase,frame:Frame,t:number,p:number):Record<string,number>{
 near(element(frame,'epoch-clock').rotation[2],t*.1,'original epoch');
 const checkCurve=(id:string,n:number,formula:(i:number)=>Vec3)=>{
  const points=element(frame,id).geometry.points!;assert.equal(points.length,n,`${id} sampling`);
  points.forEach((v,i)=>vector(v,formula(i),`${c.subject} ${id} point ${i}`));
 };
 if(c.subject==='slope'){
  checkCurve('curve',c.detailValue,i=>{const x=-2+4*i/(c.detailValue-1);return point(x,p*x);});
  const x=Math.sin(t*.4);checkCurve('ordinate',2,i=>point(x,i?p*x:0));return {curveSamples:c.detailValue};
 }
 if(c.subject==='waves'){
  for(const id of ['wave-a','wave-b','sum'])checkCurve(id,c.detailValue,i=>{const x=-Math.PI+2*Math.PI*i/(c.detailValue-1),a=Math.sin(x-.5*t),b=Math.sin(x-.5*t+p);return point(x,id==='wave-a'?a:id==='wave-b'?b:a+b);});
  return {curves:3,curveSamples:c.detailValue};
 }
 if(c.subject==='gaussian'){
  for(const id of ['reference','density'])checkCurve(id,c.detailValue,i=>{const x=-4+8*i/(c.detailValue-1),sigma=id==='reference'?1:p;return point(x,Math.exp(-x*x/(2*sigma*sigma))/(sigma*Math.sqrt(2*Math.PI)));});
  return {curves:2,curveSamples:c.detailValue};
 }
 if(c.subject==='saddle'){
  const n=c.detailValue,mesh=element(frame,'surface').geometry;assert.equal(mesh.vertices!.length,(n+1)**2);assert.equal(mesh.triangles!.length,2*n*n);
  mesh.vertices!.forEach((v,k)=>{const x=-1.6+3.2*(k%(n+1))/n,y=-1.6+3.2*Math.floor(k/(n+1))/n;vector(v,point(x,y,p*(x*x-y*y)),'saddle analytic vertex');});
  for(let j=0;j<n;j++)for(let i=0;i<n;i++){const a=j*(n+1)+i,k=2*(j*n+i);assert.deepEqual(mesh.triangles!.slice(k,k+2),[[a,a+1,a+n+1],[a+1,a+n+2,a+n+1]],'saddle topology');}
  for(const id of ['x-trace','y-trace'])checkCurve(id,129,i=>{const a=-1.6+3.2*i/128,x=id==='x-trace'?a:0,y=id==='x-trace'?.6*Math.sin(t*.4):a;return point(x,y,p*(x*x-y*y));});
  return {vertices:(n+1)**2,triangles:2*n*n,traceSamples:129};
 }
 const data=c.data!,molecule=element(frame,'molecule');vector(molecule.rotation,[0,0,p+.05*t],'rigid molecule rotation');near(molecule.scale,c.displayScale,'uniform molecule display scale');
 assert.equal(data.atoms.length,24);assert.equal(data.bonds.length,25);
 assert.deepEqual(Object.fromEntries(['C','H','N','O'].map(symbol=>[symbol,data.atoms.filter(a=>a.element===symbol).length])),{C:8,H:10,N:4,O:2});
 assert.equal(molecule.geometry.children!.length,53);
 for(const e of frame.elements.filter(e=>e.id.startsWith('atom-')||e.id.startsWith('bond-'))){
  vector(e.position,[0,0,0],'rigid local position');vector(e.rotation,[0,0,0],'rigid local rotation');near(e.scale,1,'rigid local scale');
 }
 const atomMeshes=frame.elements.filter(e=>/^atom-\d+\/batch-0$/.test(e.id));assert.equal(atomMeshes.length,24);
 let atomTriangles=0;
 for(const atom of data.atoms){
  const group=element(frame,`atom-${atom.id}`),mesh=element(frame,`atom-${atom.id}/batch-0`),radius=atom.element==='H'?.13:.22;
  assert(molecule.geometry.children!.includes(group.id));assert.deepEqual(group.geometry.children,[mesh.id]);
  const center=atom.position.map((v,i)=>v-data.center[i]);
  for(const vertex of mesh.geometry.vertices!)near(Math.hypot(...vertex.map((v,i)=>v-center[i])),radius,'atom radius/source coordinate');
  for(let i=0;i<3;i++)near(mesh.geometry.vertices!.reduce((sum,v)=>sum+v[i],0)/mesh.geometry.vertices!.length,center[i],'atom center');
  assert.equal(mesh.geometry.vertices!.length,c.detailValue===0?6:66,'sphere detail vertices');
  const expected=c.detailValue===0?8:128;assert.equal(mesh.geometry.triangles!.length,expected);atomTriangles+=expected;
 }
 const strokes=frame.elements.filter(e=>/^bond-\d+-\d+$/.test(e.id));assert.equal(strokes.length,29);
 data.bonds.forEach((bond,index)=>{
  const ends=[bond.from,bond.to].map(id=>data.atoms.find(a=>a.id===id)!.position.map((v,i)=>v-data.center[i]));
  const lines=Array.from({length:bond.order},(_,k)=>element(frame,`bond-${index}-${k}`));
  lines.forEach(line=>{assert(molecule.geometry.children!.includes(line.id));assert.equal(line.geometry.points!.length,2);});
  ends.forEach((end,k)=>vector(end.map((_,i)=>lines.reduce((sum,line)=>sum+line.geometry.points![k][i],0)/lines.length),end,'source bond endpoint'));
  if(bond.order===2)near(Math.hypot(...lines[0].geometry.points![0].map((v,i)=>v-lines[1].geometry.points![0][i])),.12,'double bond separation');
 });
 return {atoms:24,bonds:25,bondStrokes:29,atomTriangles};
}

export async function runRetainedParameterProof(options:{directory:string}){
 await mkdir(resolve(options.directory),{recursive:true});const runDirectory=await mkdtemp(join(resolve(options.directory),'r'));
 const cases=await buildRetainedParameterCases();
 const receipt={schemaVersion:1,status:'running',createdAt:new Date().toISOString(),runDirectory,renderStatus:'not-rendered',
  presentationRevision:'Caffeine uniformly scaled to 0.7 in both arms and detail levels after original scale-1 readback exposed clipped hydrogen17; exact local coordinates/topology retained.',
  measurement:'Local runtime only: deterministic source construction, native compilation, retained parameter update and sampling. Controlled world time is separate from performance.now elapsed work.',
  limitations:['This is not model generation, retrieval, live presentation or a ten-second end-to-end benchmark.',
   'Sequential local compile timings are descriptive, not a randomized cold/warm speed comparison; parameter update excludes later sampling and rendering.',
   'Both arms are deterministic local sources. Exact numeric native-frame parity does not establish visual or explanatory quality.',
   'Caffeine uses the tracked computed PubChem conformer with all atoms and bonds; rigid rotation is not a chemical or molecular dynamics claim.',
   'Four sampled instants do not establish full-motion behavior. Snapshot renderer inputs have not been rendered by this harness.'],
  cases:[] as {id:string;subject:string;detail:string;geometry:Record<string,number>;sourceBytes:number;baselineSourceBytes:number;updateBytes:number;
   sourceSha256:string;baselineSourceSha256:string;provenance?:MolecularProvenance;
   localElapsedMs:{initialCompile:number;freshCompile:number;retainedUpdate:number;candidateSampling:number;baselineSampling:number};
   comparisons:{timeSeconds:number;maxAbsoluteError:number;numericValues:number;candidateSha256:string;baselineSha256:string}[];
   invariants:{epochPreserved:boolean;parameterChanged:boolean;cameraPreserved:boolean;topologyPreserved:boolean};
   artifacts:{source:string;baselineSource:string;beforeFrame:string;candidateFrames:string[];baselineFrames:string[];candidateRenderInputs:string[];baselineRenderInputs:string[]}}[],error:undefined as string|undefined};
 const worker=Object.getOwnPropertyDescriptor(globalThis,'Worker');Object.defineProperty(globalThis,'Worker',{configurable:true,writable:true,value:undefined});
 try{
  for(const c of cases){
   const dir=join(runDirectory,c.id);await mkdir(dir);const world=new LiveWorld({clock:()=>0}),baseline=new LiveWorld({clock:()=>0});
   try{
    const localElapsedMs={initialCompile:0,freshCompile:0,retainedUpdate:0,candidateSampling:0,baselineSampling:0};
    let start=performance.now();await world.addProgram({id:c.programId,source:c.source,baseRevision:0},0);localElapsedMs.initialCompile=performance.now()-start;
    start=performance.now();await baseline.addProgram({id:c.programId,source:c.baselineSource,baseRevision:0},0);localElapsedMs.freshCompile=performance.now()-start;
    const before=await world.sample(c.comparisonTimeSeconds);auditNativeFrame(c,before,c.comparisonTimeSeconds,c.initialValue);
    const update={baseRevision:world.revision,programId:c.programId,values:c.values};
    start=performance.now();await world.setParameters(update,c.comparisonTimeSeconds);localElapsedMs.retainedUpdate=performance.now()-start;
    assert.equal(world.summary().programs[0].epoch,0);assert.equal(world.summary().programs[0].parameters[0].value,c.values.p);
    const artifacts={source:join(dir,'source.js'),baselineSource:join(dir,'baseline-source.js'),beforeFrame:join(dir,'before-frame.json'),candidateFrames:[] as string[],baselineFrames:[] as string[],candidateRenderInputs:[] as string[],baselineRenderInputs:[] as string[]};
    await Promise.all([writeFile(artifacts.source,c.source),writeFile(artifacts.baselineSource,c.baselineSource),save(artifacts.beforeFrame,before)]);
    const comparisons=[];let geometry:Record<string,number>={};
    for(const [index,t] of c.sampleTimesSeconds.entries()){
     start=performance.now();const candidate=await world.sample(t);localElapsedMs.candidateSampling+=performance.now()-start;
     start=performance.now();const fresh=await baseline.sample(t);localElapsedMs.baselineSampling+=performance.now()-start;
     geometry=auditNativeFrame(c,candidate,t,c.values.p);auditNativeFrame(c,fresh,t,c.values.p);
     const match=compareNativeFrames(candidate,fresh);assert.deepEqual(candidate.camera,before.camera);
     assert.deepEqual(candidate.elements.map(e=>e.id),before.elements.map(e=>e.id));
     for(const e of candidate.elements)assert.deepEqual(e.geometry.triangles,element(before,e.id).geometry.triangles);
     if(index===0)assert.notDeepEqual(candidate,before,'Parameter change must alter actual native state');
     comparisons.push({timeSeconds:t,...match,candidateSha256:hash(JSON.stringify(candidate)),baselineSha256:hash(JSON.stringify(fresh))});
     for(const [arm,frame,w] of [['candidate',candidate,world],['baseline',fresh,baseline]] as const){
      const path=join(dir,`${arm}-${index}.json`),inputPath=join(dir,`${arm}-render-${index}.json`);artifacts[`${arm}Frames`].push(path);artifacts[`${arm}RenderInputs`].push(inputPath);
      const previousFrame=structuredClone(frame);for(const e of previousFrame.elements)e.persistent=true;
      await Promise.all([save(path,frame),save(inputPath,{source:`export default scene(${JSON.stringify(w.rendererOptions)},s=>s.wait(1));`,previousFrame,times:[0],directory:join(dir,`${arm}-readback-${index}`)})]);
     }
    }
    receipt.cases.push({id:c.id,subject:c.subject,detail:c.detail,geometry,sourceBytes:Buffer.byteLength(c.source),baselineSourceBytes:Buffer.byteLength(c.baselineSource),updateBytes:Buffer.byteLength(JSON.stringify(update)),sourceSha256:hash(c.source),baselineSourceSha256:hash(c.baselineSource),...(c.provenance?{provenance:c.provenance}:{}),localElapsedMs,comparisons,
     invariants:{epochPreserved:true,parameterChanged:true,cameraPreserved:true,topologyPreserved:true},artifacts});
   }finally{world.dispose();baseline.dispose();}
  }
  const manifest={schemaVersion:1,label:'Local runtime comparison: fresh defaults / retained parameter update',renderStatus:receipt.renderStatus,
   cases:cases.map(c=>({...c,metrics:receipt.cases.find(row=>row.id===c.id)}))};
  await save(join(runDirectory,'manifest.json'),manifest);receipt.status='passed';await save(join(runDirectory,'receipt.json'),receipt);return receipt;
 }catch(error){receipt.status='failed';receipt.error=error instanceof Error?error.message:String(error);await save(join(runDirectory,'receipt.json'),receipt);throw error;
 }finally{if(worker)Object.defineProperty(globalThis,'Worker',worker);else delete (globalThis as {Worker?:unknown}).Worker;}
}

if(import.meta.main){
 const directory=process.argv[2]??fileURLToPath(new URL('../../../data/realtime-workshop/retained-parameters/',import.meta.url));
 const receipt=await runRetainedParameterProof({directory});console.log(JSON.stringify({status:receipt.status,runDirectory:receipt.runDirectory,cases:receipt.cases.length}));
}

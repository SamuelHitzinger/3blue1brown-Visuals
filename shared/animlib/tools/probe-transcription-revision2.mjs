import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
import ts from 'typescript';
import {createNucleicTranscriptionCycleBuilders} from '../dist/nucleic-transcription-cycle.js';
import {withOfflineScene} from '../dist/core.js';
import {loadAssetRegistry} from './load-assets.mjs';
const dir='data/animlib-expansion/transcription-cycle-revision2',api=createNucleicTranscriptionCycleBuilders(),props=JSON.parse(await readFile(dir+'/cycle-inputs.json','utf8'));
const baseline='ab5f34d3540269c05d695ef2d75612c37a30ff41';
const historical=execFileSync('git',['show',baseline+':shared/animlib/src/nucleic-transcription-cycle.ts'],{encoding:'utf8',windowsHide:true});
const erased=ts.transpile(historical,{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}).replace('export function','function').replace(/export \{\};?/g,'');
const old=(0,eval)('(()=>{'+erased+';return createNucleicTranscriptionCycleBuilders();})()');
const legacy={...props,window:{halfWidth:4,separation:1.1}};delete legacy.exitFrame;delete legacy.exitBend;legacy.exitDirection=[-.6,.2,1];
for(let j=0;j<=320;j++)assert.equal(JSON.stringify(api.nucleicTranscriptionCycle(legacy,j/40)),JSON.stringify(old.nucleicTranscriptionCycle(legacy,j/40)));
let seed=917,g=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296),accepted=0,rejected=0,maxLinkError=0,maxFrameError=0,samples=0;
const distance=(a,b)=>Math.hypot(...a.map((v,k)=>v-b[k]));
for(let i=0;i<160;i++){
 const p={...props,window:{...props.window,lockOrientation:i%2===0},axis:{origin:[g()*4,g()*4,g()*4],direction:[1,g()-.5,g()-.5],normal:[0,1,g()-.5]},exitBend:(g()-.5)*.42,exitDirection:[-.3-g(),(g()-.5)*.3,(g()-.5)*1.4],pitch:.65+g()*.4,twistPerBase:(g()-.5)*1.2};
 try{api.nucleicTranscriptionCycle(p,0);}catch{rejected++;continue;}accepted++;
 for(let j=0;j<=80;j++){
  const r=api.nucleicTranscriptionCycle(p,j/10),anchors=[...r.dna.anchors,...r.rna.anchors],map=new Map(anchors.map(a=>[a.id,a]));samples++;
  for(const kind of ['dna','rna'])for(const [a,b]of r[kind].bonds)maxLinkError=Math.max(maxLinkError,Math.abs(distance(map.get(a).backbone,map.get(b).backbone)-r[kind].linkLength));
  for(const a of anchors)maxFrameError=Math.max(maxFrameError,Math.abs(Math.hypot(...a.normal)-1),Math.abs(Math.hypot(...a.tangent)-1),Math.abs(a.normal.reduce((s,v,k)=>s+v*a.tangent[k],0)));
 }
}
assert(maxLinkError<1e-11&&maxFrameError<1e-11);
const manifest=JSON.parse(await readFile(dir+'/cycle-manifest.json','utf8')),registry=await loadAssetRegistry(manifest.modelAssets),source=await readFile(dir+'/cycle.js','utf8');const models=new Map(await Promise.all(manifest.modelAssets.map(async path=>{const m=JSON.parse(await readFile(path,'utf8'));return [m.id,m];})));let budgets;
await withOfflineScene(source,{palette:manifest.palette},sampler=>{
 const frame=sampler.sample(3.5);let vertices=0,triangles=0;
 for(const e of frame.elements){let g=e.geometry;if(g.asset){const model=models.get(g.asset.id);const part=model.parts.find(p=>p.id===g.asset.part);vertices+=part.vertexCount;triangles+=part.triangleCount;}else{vertices+=g.vertices?.length??0;triangles+=g.triangles?.length??0;}}
 budgets={vertices,triangles,conservativeSubmittedVerticesAt16:triangles*3*16,conservativeSubmittedVerticesAt32:triangles*3*32,sampledPixels1280x720At16:1280*720*16,focusDrawsAt16:frame.elements.length*16};
 assert(vertices<=100000&&triangles*3*32<=32000000&&frame.elements.length*16<=64000);
},{modelAssets:registry});
const report={legacyByteEqualitySamples:321,legacyBaseline:baseline,seed:917,randomSchedules:160,accepted,rejected,samples,maxLinkError,maxFrameError,budgets};
await writeFile(dir+'/adversarial-and-budget-checks.json',JSON.stringify(report,null,2));console.log(report);


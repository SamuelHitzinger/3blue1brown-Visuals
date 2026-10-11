import assert from 'node:assert/strict';
import {readFile,writeFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,join} from 'node:path';
import {withOfflineScene,createNucleicTranslationBuilders} from '../dist/core.js';

const directory=resolve('data/animlib-expansion/translation-3b1b-revision4');
const source=await readFile(join(directory,'translation.js'),'utf8'),manifest=JSON.parse(await readFile(join(directory,'translation-manifest.json'))),props=JSON.parse(source.split('const props=')[1].split(',angle=')[0]);
const api=createNucleicTranslationBuilders(),clock=t=>t<=7.8?t:t<10.3?7.8:t-2.5,sha=async p=>createHash('sha256').update(await readFile(p)).digest('hex');
const angle=-.12,world=([x,y,z])=>[x*Math.cos(angle)-y*Math.sin(angle),x*Math.sin(angle)+y*Math.cos(angle),z],add=(a,b)=>a.map((v,k)=>v+b[k]);
const evidence={checks:{},sourceSha256:await sha(join(directory,'translation.js')),films:[],motion:{rate:8,sheets:[]}};
await withOfflineScene(source,{palette:manifest.palette},sampler=>{
 let ids,maxHostVmError=0,maxBondLengthError=0;
 const equal=(a,b)=>{assert.equal(a.length,b.length);a.forEach((v,k)=>{assert(Number.isFinite(v));const error=Math.abs(v-b[k]);maxHostVmError=Math.max(maxHostVmError,error);assert(error<1e-10);});};
 for(let i=0;i<1290;i++){
  const t=i/30,r=api.nucleicTranslationCycle(props,clock(t)),f=sampler.sample(t),get=id=>f.elements.find(e=>e.id===id);
  ids??=f.elements.map(e=>e.id);assert.deepEqual(f.elements.map(e=>e.id),ids);
  r.rna.anchors.forEach((a,j)=>equal(get('rna-'+j).position,a.backbone));
  r.carriers.forEach((c,j)=>{equal(get('carrier-'+j).geometry.points[0],add(c.position,world([0,.52,0])));assert.equal(get('carrier-'+j).opacity>0,c.visible);});
  r.product.residues.forEach((p,j)=>{equal(get('residue-'+j).position,p.position);assert.equal(get('residue-'+j).opacity,p.visible?1:0);if(j){const bond=get('product-bond-'+j);assert.equal(bond.opacity,p.incorporated?1:0);equal(bond.geometry.points[0],r.product.residues[j-1].position);equal(bond.geometry.points[1],p.position);if(p.incorporated){const error=Math.abs(Math.hypot(...p.position.map((v,k)=>v-r.product.residues[j-1].position[k]))-.46);maxBondLengthError=Math.max(maxBondLengthError,error);assert(error<1e-10);}}});
  assert.equal(get('stop').opacity,r.stopRecognized?1:0);
 }
 const times=[0,1.3,4.2,7.8,9.8,11.1,12.1,12.99,14.1,21,30.8,36.8,37.4,39.5,41.5,42.9],saved=times.map(t=>sampler.sample(t));for(let i=times.length-1;i>=0;i--)assert.deepEqual(sampler.sample(times[i]),saved[i]);
 const terminal=api.nucleicTranslationCycle(props,clock(42.9));assert(terminal.complete&&terminal.product.released&&terminal.stopRecognized);assert.equal(terminal.product.residues.filter(p=>p.visible&&p.incorporated).length,7);assert.equal(terminal.product.bonds.length,6);assert.equal(terminal.carriers.filter(c=>c.visible).length,0);assert.deepEqual(terminal.product.residues.map(p=>p.aminoAcid),['Met','Gly','Ala','Phe','Glu','Lys','Pro']);
 evidence.checks={encodedPoses:1290,retainedElements:ids.length,retainedIds:'exact',maxHostVmError,maxBondLengthError,reverseSeek:'exact',terminalMappedResidues:7,terminalBonds:6,terminalVisibleCarriers:0,stopAddedResidues:0,complete:true};
});
for(const width of [1280,960]){
 const file=join(directory,`translation-${width}x720.mp4`);evidence.films.push({file,sha256:await sha(file),width,height:720,fps:30,frames:1290,duration:43,audio:false});
 const folder=join(directory,'motion',`${width}x720`),files=await readdir(folder);assert.equal(files.filter(p=>p.startsWith('frame-')).length,344);const sheets=files.filter(p=>p.startsWith('sheet-')).sort();assert.equal(sheets.length,22);evidence.motion.sheets.push(...sheets.map((p,i)=>({file:join(folder,p),sampleStart:i*16,timeStart:i*2,timeEnd:Math.min(i*2+1.875,42.875)})));
}
await writeFile(join(directory,'evidence.json'),JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence.checks,null,2));

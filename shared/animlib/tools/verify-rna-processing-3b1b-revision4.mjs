import assert from 'node:assert/strict';
import {readFile,writeFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,join} from 'node:path';
import {withOfflineScene,createNucleicProcessingBuilders} from '../dist/core.js';
const directory=resolve('data/animlib-expansion/rna-processing-3b1b-revision4'),api=createNucleicProcessingBuilders(),report={checks:{},films:[],sourceHashes:{},visualEvidence:{rate:8,sheets:[]}};
const sha=async p=>createHash('sha256').update(await readFile(p)).digest('hex'),smooth=(t,a,d)=>{const u=Math.max(0,Math.min(1,(t-a)/d));return u*u*(3-2*u);};
for(const id of ['splice','pore']){
 const source=await readFile(join(directory,id+'.js'),'utf8'),manifest=JSON.parse(await readFile(join(directory,id+'-manifest.json'))),props=JSON.parse(source.split('const props=')[1].split(';let last=')[0]),duration=id==='splice'?12:10;
 report.sourceHashes[id]=await sha(join(directory,id+'.js'));
 await withOfflineScene(source,{palette:manifest.palette},sampler=>{
  let ids,maxHostVmAnchorError=0;for(let i=0;i<duration*30;i++){
   const t=i/30,clock=t<=4.4?t:t<4.9?4.4:t-.5,r=id==='splice'?api.nucleicSplice(props,Math.min(1,t/11)):api.nucleicThread(props,smooth(clock,.6,8)),f=sampler.sample(t);
   ids??=f.elements.map(e=>e.id);assert.deepEqual(f.elements.map(e=>e.id),ids);
   r.anchors.forEach((a,j)=>f.elements.find(e=>e.id==='site-'+j).position.forEach((v,k)=>{const error=Math.abs(v-a.backbone[k]);maxHostVmAnchorError=Math.max(maxHostVmAnchorError,error);assert(error<1e-10);}));
   if(id==='splice')for(const [a,b] of [[9,10],[29,30],[9,30]])assert.equal(f.elements.find(e=>e.id==='bond-'+a+'-'+b).opacity,r.bonds.some(e=>e[0]===props.sites[a].id&&e[1]===props.sites[b].id)?1:0);
  }
  if(id==='pore'){const held=[4.4,4.649,4.65,4.9].map(t=>sampler.sample(t).elements.filter(e=>e.id.startsWith('site-')).map(e=>e.position));held.forEach(p=>assert.deepEqual(p,held[0]));}
  const times=id==='splice'?[0,1.98,3,5.39,6.16,8.03,11.9]:[0,3.5,4.4,4.649,4.65,4.9,6.5,9.9],saved=times.map(t=>sampler.sample(t));for(let i=times.length-1;i>=0;i--)assert.deepEqual(sampler.sample(times[i]),saved[i]);
  report.checks[id]={encodedPoses:duration*30,retainedIds:'exact',maxHostVmAnchorError,reverseSeek:'exact',...(id==='splice'?{cutAndReplacementGraph:'exact'}:{heldChainAcrossCut:'exact'})};
 });
 for(const width of [1280,960]){
  const name=`${id}-${width}x720`,file=join(directory,name+'.mp4');report.films.push({file,sha256:await sha(file),width,height:720,fps:30,duration,frames:duration*30,audio:false});
  const folder=join(directory,'motion',name),files=await readdir(folder),frames=files.filter(f=>f.startsWith('frame-')),sheets=files.filter(f=>f.startsWith('sheet-')).sort();assert.equal(frames.length,duration*8);
  report.visualEvidence.sheets.push(...sheets.map((p,i)=>({file:join(folder,p),sampleStart:i*16,timeStart:i*2,timeEnd:i*2+1.875})));
 }
}
await writeFile(join(directory,'evidence.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report.checks,null,2));

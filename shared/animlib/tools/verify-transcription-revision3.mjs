import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {withOfflineScene,createNucleicTranscriptionCycleBuilders} from '../dist/core.js';
// Historical exports are optional; current geometry verification uses the versioned schedule.
const checkArchives=process.argv.includes('--check-archives');
const dir=resolve('data/animlib-expansion/transcription-cycle-revision3'),p=JSON.parse(await readFile(join(dir,'cycle-inputs.json'))),api=createNucleicTranscriptionCycleBuilders();
assert.deepEqual(p,JSON.parse(await readFile(new URL('../demo/expansion/inputs/transcription-cycle.json',import.meta.url))));
const distance=(a,b)=>Math.hypot(...a.map((v,k)=>v-b[k])),source=await readFile(join(dir,'cycle.js'),'utf8'),manifest=JSON.parse(await readFile(join(dir,'cycle-manifest.json')));
const times=Array.from({length:321},(_,i)=>i/40),complement={A:'U',C:'G',G:'C',T:'A'};
let maxDnaLinkError=0,maxRnaLinkError=0,maxNativeAnchorError=0;
await withOfflineScene(source,{palette:manifest.palette},sampler=>{
 const ids=api.nucleicTranscriptionCycle(p,0).rna.anchors.map(a=>a.id),kept=[];
 for(const t of times){
  const r=api.nucleicTranscriptionCycle(p,t),frame=sampler.sample(t),byId=new Map(frame.elements.map(e=>[e.id,e]));
  assert.deepEqual(r.rna.anchors.map(a=>a.id),ids);
  for(const kind of ['dna','rna']){
   const anchors=r[kind].anchors,map=new Map(anchors.map(a=>[a.id,a]));
   for(const[a,b]of r[kind].bonds){const e=Math.abs(distance(map.get(a).backbone,map.get(b).backbone)-r[kind].linkLength);if(kind==='dna')maxDnaLinkError=Math.max(maxDnaLinkError,e);else maxRnaLinkError=Math.max(maxRnaLinkError,e);}
   for(let i=0;i<anchors.length;i++){
    const a=anchors[i],stem=byId.get(kind+'-stem-'+i),tip=byId.get(kind+'-tip-'+i),node=byId.get(kind+'-node-'+i),label=byId.get(kind+'-base-'+i);
    maxNativeAnchorError=Math.max(maxNativeAnchorError,distance(stem.geometry.points[0],a.backbone),distance(tip.geometry.points[1],a.tip),distance(node.position,a.backbone));
    assert.equal(label.geometry.text,a.base);if(kind==='rna')assert.equal(label.opacity,r.rna.visibleIds.includes(a.id)?1:0);
   }
  }
  for(let i=1;i<8;i++)assert.equal(byId.get('rna-link-'+i).opacity,r.rna.incorporated>i?1:0);
  if([0,1.55,3.5,7.5,8].includes(t))kept.push([t,frame]);
 }
 for(const[t,frame]of kept.reverse())assert.deepEqual(sampler.sample(t),frame);
 for(let i=0;i<8;i++){
  const t=p.start+(i+p.dockFraction)*p.cycleDuration,r=api.nucleicTranscriptionCycle(p,t),rna=r.rna.anchors[i],dna=r.dna.anchors[i+6],frame=sampler.sample(t);
  assert.equal(rna.base,complement[dna.base]);assert(distance(rna.tip,dna.tip)<1e-10);
  assert(frame.elements.find(e=>e.id==='paired-contact-'+i+'-0').opacity>.9999);
 }
 assert.equal(sampler.sample(7.5).elements.find(e=>e.id==='triplet-label').geometry.text,'codon');
});
assert(maxNativeAnchorError<1e-10&&maxDnaLinkError<1e-12&&maxRnaLinkError<1e-12);
const frozen=[];
if(checkArchives)for(const[aspect,expected]of [['16x9','a646a1c0ba8260404360997b3fd6fe864140da0ebf5eb5b401bc7baa421e31f9'],['4x3','b2d17aafd6b46f994cba86c9d7da56a564d95213d349660f1715b7725572b1ab']]){
 const hash=createHash('sha256').update(await readFile(resolve('data/animlib-expansion/transcription-cycle-revision2','cycle-'+aspect+'.mp4'))).digest('hex');assert.equal(hash,expected);frozen.push({aspect,sha256:hash});
}
const report={samples:times.length,inputSchedule:'exactly equal frozen revision 2',maxDnaLinkError,maxRnaLinkError,maxNativeAnchorError,letters:'all 56 identities at all 321 times match native text',rnaVisibility:'all eight labels and seven links exact',docking:'all eight complementary pairs have coincident tips and visible contact marks',reverseSeeks:'exact',finalTriplet:['rna-0:C','rna-1:A','rna-2:U'],archiveCheck:checkArchives?'passed':'not requested (use --check-archives)',frozenRevision2Films:frozen};
await writeFile(join(dir,'invariant-checks.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));

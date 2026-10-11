import assert from 'node:assert/strict';
import {readFile,writeFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join,resolve} from 'node:path';
import {createNucleicProcessingBuilders} from '../dist/core.js';
const directory=resolve('data/animlib-expansion/rna-processing-revision2'),api=createNucleicProcessingBuilders();
const sha=async p=>createHash('sha256').update(await readFile(p)).digest('hex');
const report={files:[],assets:[],checks:{},motion:[]};
for(const id of ['splice','pore']){
 const output=id==='pore'?join(directory,'pore-cut'):directory;
 const source=await readFile(join(output,id+'.js'),'utf8'),props=JSON.parse(source.split('const props=')[1].split(';let last=')[0]);
 let first,maxArcGapError=0,minRenderedBondClearance=Infinity;
 for(let i=0;i<=600;i++){
  const p=i/600,r=id==='splice'?api.nucleicSplice(props,p):api.nucleicThread(props,p);
  first??=r;assert.deepEqual(r.anchors.map(a=>a.id),first.anchors.map(a=>a.id));
  if(id==='splice'){
   const cut=props.phases.cut,joined=props.phases.closeEnd,has=(a,b)=>r.bonds.some(e=>e[0]===props.sites[a].id&&e[1]===props.sites[b].id);
   assert.equal(has(9,10),p<cut);assert.equal(has(29,30),p<cut);assert.equal(has(9,30),p>=joined);
  }else{
   for(let j=1;j<r.anchors.length;j++){
    maxArcGapError=Math.max(maxArcGapError,Math.abs((r.arcCoordinates[j-1]-r.arcCoordinates[j])-.24));
    // This proof's straight rendered links are checked separately from the
    // public helper's authored-polyline swept-tube guarantee.
    const a=r.anchors[j-1].backbone,b=r.anchors[j].backbone,slab=props.aperture.halfThickness+props.aperture.chainRadius;
    const dz=b[2]-a[2];let lo=0,hi=1;
    if(Math.abs(dz)<1e-12){if(Math.abs(a[2])>slab)continue;}else{const u=(-slab-a[2])/dz,v=(slab-a[2])/dz;lo=Math.max(0,Math.min(u,v));hi=Math.min(1,Math.max(u,v));if(lo>hi)continue;}
    for(const t of [lo,hi]){const clearance=props.aperture.radius-props.aperture.chainRadius-Math.hypot(a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1]));minRenderedBondClearance=Math.min(minRenderedBondClearance,clearance);assert(clearance>=0);}
   }
  }
 }
 report.checks[id]={poses:601,stableIdentities:true,...(id==='splice'?{orderedCutAndReplacementTopology:true}:{maxArcGapError,minRenderedBondClearance,sampledStraightLinksClear:true})};
 for(const width of [1280,960]){
  const name=`${id}-${width}x720`,file=join(output,name+'.mp4');report.files.push({file,sha256:await sha(file),width,height:720,fps:30,duration:id==='splice'?12:10,frames:id==='splice'?360:300,audio:false});
  const folder=join(output,'motion',name),names=await readdir(folder),frames=names.filter(n=>n.startsWith('frame-')),sheets=names.filter(n=>n.startsWith('sheet-')).sort();assert.equal(frames.length,id==='splice'?96:80);
  report.motion.push({folder,rate:8,count:frames.length,sheets:sheets.map((n,i)=>({file:join(folder,n),firstSample:i*16,startTime:i*2,endTime:i*2+1.875}))});
 }
 const manifest=JSON.parse(await readFile(join(output,id+'-manifest.json')));for(const path of manifest.modelAssets)if(!report.assets.some(a=>a.path===path)){const a=JSON.parse(await readFile(path));report.assets.push({path,id:a.id,packageHash:a.hash,manifestSha256:await sha(path)});}
}
await writeFile(join(directory,'evidence-final.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report.checks,null,2));

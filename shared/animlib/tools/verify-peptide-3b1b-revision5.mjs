import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {withOfflineScene,createPeptideBuilders} from '../dist/core.js';
import {createStagedPeptideSampler} from '../demo/expansion/peptide-staged-pose.mjs';
// Current geometry verification requires only regenerated proof files and versioned fixtures.
const checkArchives=process.argv.includes('--check-archives');
const dir='data/animlib-expansion/peptide-3b1b-revision5/',root='shared/animlib/fixtures/biological/';
const read=async p=>JSON.parse(await readFile(p));
const inputs=await read(dir+'peptide-inputs.json'),rig=await read(root+'illustrative-peptide/rig.json'),stage=await read(root+'peptide-staged/staging.json'),endpoint=await read(root+'illustrative-peptide/endpoint.json');
assert.deepEqual(inputs.rig,{spec:rig.spec,compact:rig.compact});
const variables=[];for(let block=1;block<4;block++){const start=block*20;variables.push(['psi',start-9]);for(let i=start-8;i<start;i++)variables.push(['phi',i],['psi',i]);variables.push(['phi',start]);}
assert.deepEqual(inputs.keyframes,stage.samples.map(s=>({progress:s.progress,values:variables.map(([key,index])=>Math.round(s.angles[key][index]*1e8)/1e8)})));
const sample=createStagedPeptideSampler(createPeptideBuilders(),inputs.rig,inputs.keyframes),distance=(a,b)=>Math.hypot(...a.map((v,k)=>v-b[k]));
let maxNativeError=0,maxEndpointError=0;const times=Array.from({length:401},(_,i)=>i/40),manifest=await read(dir+'peptide-manifest.json');
await withOfflineScene(await readFile(dir+'peptide.js','utf8'),{palette:manifest.palette},sampler=>{
 const retained=[],ids=sample(0).pose.anchors.map(a=>a.id);
 for(const t of times){const {pose}=sample(t),frame=sampler.sample(t),elements=new Map(frame.elements.map(e=>[e.id,e]));
  assert.deepEqual(pose.anchors.map(a=>a.id),ids);
  for(let i=0;i<72;i++){const p=pose.anchors[i].position.map(v=>v*.2),node=elements.get('residue-'+i),color=inputs.colors[Math.min(3,Math.floor(i/20))];maxNativeError=Math.max(maxNativeError,distance(node.position,p));assert.equal(node.fill,color);assert.equal(node.opacity,1);
   if(i<71){const edge=elements.get('link-'+i),points=edge.geometry.points;assert.equal(edge.stroke,color);assert.equal(edge.opacity,1);maxNativeError=Math.max(maxNativeError,distance(points[0],p),distance(points.at(-1),pose.anchors[i+1].position.map(v=>v*.2)));}
  }
  for(const[id,index]of [['start',0],['end',71]])maxNativeError=Math.max(maxNativeError,distance(elements.get('end-leader-'+id).geometry.points[0],pose.anchors[index].position.map(v=>v*.2)));
  if(t<=4.2){assert.equal(frame.camera.yaw,0);assert.equal(frame.camera.pitch,0);assert.equal(frame.camera.height,inputs.heights[0]);}
  if([0,1.4,3.5,4.2,7.8,10].includes(t))retained.push([t,frame]);
 }
 for(const[t,frame]of retained.reverse())assert.deepEqual(sampler.sample(t),frame);
});
const end=sample(10);endpoint.atoms.forEach((a,i)=>{assert.equal(end.pose.atoms[i].id,a.id);const p=end.basis.map(axis=>axis.reduce((sum,v,k)=>sum+v*(a.position[k]-endpoint.center[k]),0));maxEndpointError=Math.max(maxEndpointError,distance(end.pose.atoms[i].position,p));});
assert(maxNativeError<1e-9&&maxEndpointError<1e-9);
const frozen=[];if(checkArchives)for(const[aspect,expected]of [['16x9','67e93602d8eda967d3290d5e341ee7fe543adf01e27bd19c22d6ed669c125fb7'],['4x3','9c5d4c245ad4b32c65501ada12d32c88dc087a65f3b525382d7258d4f12fa083']]){const hash=createHash('sha256').update(await readFile('data/animlib-expansion/biological-motion-revision4/peptide-'+aspect+'.mp4')).digest('hex');assert.equal(hash,expected);frozen.push({aspect,sha256:hash});}
const report={samples:times.length,anchorIdentities:72,links:71,inputSchedule:'exactly equal reviewed staged keyframes and original compact rig',maxNativeError,maxEndpointError,colors:'fixed residue-index mapping',visibility:'all nodes and trace links present',reverseSeeks:'exact',archiveCheck:checkArchives?'passed':'not requested (use --check-archives)',frozenRevision4Films:frozen};
await writeFile(dir+'invariant-checks.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));

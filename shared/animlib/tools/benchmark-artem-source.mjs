/** Reproduce the scene-only binding reduction against its reconstructed original. */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve,join} from 'node:path';
import {withOfflineScene} from '../dist/core.js';
import {buildDrawItems} from '../dist/render-geometry.js';
import {paletteResolver} from '../dist/palette.js';
import {composeItems} from '../dist/composition.js';

const base=new URL('../demo/expansion/',import.meta.url);
const current=await readFile(new URL('artem-state.js',base),'utf8');
const palette=JSON.parse(await readFile(new URL('artem-state-palette.json',base),'utf8'));
const output=resolve(process.argv[2]??fileURLToPath(new URL('../../../data/animlib-expansion/performance/',import.meta.url)));
const before="p.map([s.time],([u,v],t)=>[u*(1-.8/2.325*layout(t)),v]);";
const after=`const tracePoints=Array.from({length:321},(_,i)=>{const u=4*i/320;return[u,rate(r,u)];});
    s.bind(trace,[s.time],t=>({points:tracePoints.map(([u,v])=>[-4.65+2.325*(u*(1-.8/2.325*layout(t))),y+rateScale*v])}));`;
assert(current.includes(before)||current.includes(after),'expected original or optimized trace binding');
const source=current.includes(before)?current:current.replace(after,before);
const candidate=source.replace(before,after);
const sha=s=>createHash('sha256').update(s).digest('hex');
const quantiles=values=>{const sorted=[...values].sort((a,b)=>a-b);return{median:sorted[Math.ceil(sorted.length*.5)-1],p95:sorted[Math.ceil(sorted.length*.95)-1],samples:sorted.length};};
async function timing(text){
  await withOfflineScene(text,{palette},()=>{});
  const compile=[];
  for(let i=0;i<10;i++){
    const start=performance.now();await withOfflineScene(text,{palette},()=>compile.push(performance.now()-start));
  }
  return withOfflineScene(text,{palette},sampler=>{
    const phases=[];
    for(const [name,start] of [['kernels',1],['compression',3.6],['held-state',6]]){
      const times=[];
      for(let i=0;i<45;i++){const begin=performance.now();sampler.sample(start+i/100);if(i>=5)times.push(performance.now()-begin);}
      phases.push({name,evaluationMs:quantiles(times)});
    }
    return{sourceBytes:Buffer.byteLength(text),compiledBytes:Buffer.byteLength(JSON.stringify(sampler.scene)),
      bindingCount:sampler.scene.reactiveBindings.length,compileAndLeaseMs:quantiles(compile),phases};
  });
}
function packed(sampler,time){
  const frame=sampler.sample(time);
  const items=buildDrawItems(frame,frame.camera,1280,720,paletteResolver(palette));
  const hash=createHash('sha256');
  for(const item of composeItems(items,0).items){
    hash.update(Buffer.from(item.vertices.buffer,item.vertices.byteOffset,item.vertices.byteLength));
    hash.update(JSON.stringify({depth:item.depth,transparent:item.transparent,screen:item.screen,groups:item.groups}));
  }
  return hash.digest('hex');
}
const originalMetrics=await timing(source),candidateMetrics=await timing(candidate);
const times=[...new Set([...Array.from({length:76},(_,i)=>i/10),3.399999,3.4,3.400001,3.499999,3.5,3.500001])];
await withOfflineScene(source,{palette},async original=>{
  await withOfflineScene(candidate,{palette},proposal=>{
    for(const time of times)assert.equal(packed(proposal,time),packed(original,time),`packed visible geometry at ${time}`);
    for(const sampler of [original,proposal]){
      const baseline=JSON.stringify(sampler.sample(4));sampler.sample(7);assert.equal(JSON.stringify(sampler.sample(4)),baseline);
    }
  });
});
const result={node:process.version,sourceSha256:sha(source),candidateSha256:sha(candidate),original:originalMetrics,candidate:candidateMetrics,
  verification:{packedVisibleGeometry:'exact Float32 stream/style/order equality',times,reverseSeek:'exact frame JSON within each version'},
  limits:'Unchanged production compiler default 200ms execution / 32MiB VM; no relaxed budget.',
  note:'CPU wall measurements in one sequential process, no GPU timings. Hidden element coordinates intentionally differ after3.5s; they are fully faded by3.4s. Candidate duplicates rate sampling at construction; a separate source edit could reuse those samples.'};
await mkdir(output,{recursive:true});
await writeFile(join(output,'artem-candidate.js'),candidate);
await writeFile(join(output,'artem-binding-benchmark.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));

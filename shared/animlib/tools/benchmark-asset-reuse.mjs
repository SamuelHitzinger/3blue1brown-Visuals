/** Production CPU/source benchmark. No GPU calls or FPS estimates in this tool.
 * Run after building, from any cwd. Native upload proof remains prove-image-rendering.mjs.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir, writeFile} from 'node:fs/promises';
import {cpus, platform, release, totalmem} from 'node:os';
import {resolve, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createAssetRegistry, withOfflineScene} from '../dist/core.js';
import {buildDrawItems} from '../dist/render-geometry.js';
import {RetainedGeometry} from '../dist/retained-geometry.js';
import {paletteResolver} from '../dist/palette.js';
import {composeItems} from '../dist/composition.js';

const output=resolve(process.argv[2] ?? fileURLToPath(new URL('../../../data/animlib-expansion/performance/',import.meta.url)));
const dimensions={width:1280,height:720}, samples=40, warmup=8, repeats=3;
const bytes=value=>Buffer.byteLength(typeof value==='string'?value:JSON.stringify(value));
const summarize=values=>{
  const sorted=[...values].sort((a,b)=>a-b);
  return {median:sorted[Math.ceil(sorted.length*.5)-1],p95:sorted[Math.ceil(sorted.length*.95)-1],samples:values.length};
};
const sha=value=>createHash('sha256').update(value).digest('hex');
const grid={vertices:[],triangles:[]};
for(let y=0;y<32;y++)for(let x=0;x<32;x++)grid.vertices.push([
  Math.fround((x-15.5)/16),Math.fround((y-15.5)/16),Math.fround(.15*Math.sin(x*.25)*Math.cos(y*.25)),
]);
for(let y=0;y<31;y++)for(let x=0;x<31;x++){
  const a=y*32+x; grid.triangles.push([a,a+1,a+32],[a+1,a+33,a+32]);
}
const preparationStart=performance.now();
const registry=await createAssetRegistry([{
  id:'wave',kind:'model',version:1,units:'arbitrary',parts:[{id:'surface',...grid}],
  provenance:{source:'Original deterministic 32x32 sinusoidal grid in benchmark-asset-reuse.mjs',
    sourceHash:sha(JSON.stringify(grid)),creator:'animlib benchmark',license:'CC0-1.0',
    preparedAt:'2026-10-11',converter:{name:'benchmark-grid',version:'1',options:{size:32}},
    selection:'entire grid',modifications:[],fidelity:'Original synthetic geometry; no scientific data'},
}]);
const registryPrepareMs=performance.now()-preparationStart;
const loop=constructor=>`for(let i=0;i<8;i++){
  const m=${constructor};
  s.bind(m,[s.time],t=>({rotation:[0,t*.3,0],position:[(i%4-1.5)*2.5,i<4?1.5:-1.5,0]}));
}s.wait(2);`;
const style="fill:'YELLOW',shading:'unlit'";
// Match the model constructor's group + child topology as well as its geometry.
const authored=`export default scene({mode:'3d'},s=>{const geometry=${JSON.stringify(grid)};${loop(`s.group('m'+i,[s.mesh('m'+i+'.surface',{...geometry,${style}})])`)}});`;
const reused=`export default scene({mode:'3d'},s=>{${loop(`s.model('m'+i,{asset:'wave',${style}})`)}});`;
const paths=`export default scene({},s=>{
  const points=Array.from({length:1000},(_,i)=>[i/100-5,Math.sin(i/50)]);
  const path=s.path('dense',{points,stroke:'BLUE',strokeWidth:.025,dashArray:[.15,.1]});
  s.bind(path,[s.time],t=>({strokeEnd:Math.min(1,t/2),dashOffset:t*.1}));s.wait(2);
});`;
const molecular=`export default scene({mode:'3d'},s=>{
  const spec={lengths:Array(23).fill(.3),from:Array.from({length:23},()=>[.12,.25]),
    to:Array.from({length:23},()=>[.3,.35]),start:0,duration:2};
  function geometry(t){const positions=s.articulatedChainPose(spec,t);return s.molecularBackboneGeometry({
    representation:'beads',radius:.12,beadDetail:1,
    segments:[{id:'A',chainId:'A',residues:positions.map((position,i)=>({id:'r'+i,position,value:i/23}))}],
    bonds:positions.slice(1).map((_,i)=>['r'+i,'r'+(i+1)]),
    provenance:{kind:'schematic',source:'Original benchmark kinematics',units:'arbitrary'}}).meshes[0];}
  const m=s.mesh('chain',{...geometry(0),fill:'WHITE'});
  s.bind(m,[s.time],t=>{const g=geometry(t);return{vertices:g.vertices,normals:g.normals};});s.wait(2);
});`;

function draw(sampler,time,cache){
  const frame=sampler.sample(time);
  cache?.beginFrame();
  const items=buildDrawItems(frame,frame.camera,dimensions.width,dimensions.height,paletteResolver(),undefined,false,cache,undefined,sampler.assetGeometry);
  cache?.endFrame();
  return items;
}
function streamHash(sampler,time){
  const hash=createHash('sha256');
  for(const item of composeItems(draw(sampler,time),0).items){
    hash.update(Buffer.from(item.vertices.buffer,item.vertices.byteOffset,item.vertices.byteLength));
    hash.update(JSON.stringify({depth:item.depth,transparent:item.transparent,screen:item.screen}));
  }
  return hash.digest('hex');
}
async function measure(name,source,assets){
  const limits=assets?{modelAssets:assets}:{};
  const compile=[];
  // One unmeasured compile initializes QuickJS; each measured compile owns a fresh VM.
  await withOfflineScene(source,{},()=>{},limits);
  for(let i=0;i<repeats;i++){
    const start=performance.now();
    await withOfflineScene(source,{},()=>compile.push(performance.now()-start),limits);
  }
  return withOfflineScene(source,{},sampler=>{
    const cache=new RetainedGeometry();
    const coldStart=performance.now(),first=draw(sampler,0,cache),cold=performance.now()-coldStart;
    const evaluation=[],preparation=[];
    for(let i=0;i<warmup+samples;i++){
      const time=(i%(samples+1))/samples*2;
      const start=performance.now(),frame=sampler.sample(time),middle=performance.now();
      cache.beginFrame();
      buildDrawItems(frame,frame.camera,dimensions.width,dimensions.height,paletteResolver(),undefined,false,cache,undefined,sampler.assetGeometry);
      cache.endFrame();
      if(i>=warmup){evaluation.push(middle-start);preparation.push(performance.now()-middle);}
    }
    const atOne=JSON.stringify(sampler.sample(1));
    sampler.sample(2);assert.equal(JSON.stringify(sampler.sample(1)),atOne,'reverse seek');
    sampler.sample(0);assert.equal(JSON.stringify(sampler.sample(1)),atOne,'direct seek');
    const meshes=[...new Set(first.map(item=>item.mesh).filter(Boolean))];
    return {name,sourceSha256:sha(source),bytes:{source:bytes(source),compiled:bytes(sampler.scene),frame:bytes(sampler.sample(1)),
      catalog:assets?bytes(assets.catalog):0,retainedVertices:meshes.reduce((n,m)=>n+m.vertices.byteLength,0),retainedIndices:meshes.reduce((n,m)=>n+m.indices.byteLength,0)},
      cpuMs:{compileAndLease:summarize(compile),coldEvaluationAndPreparation:cold,evaluation:summarize(evaluation),warmPreparation:summarize(preparation)},
      logicalObjects:sampler.sample(1).elements.length,uniqueRetainedMeshes:meshes.length,composedCommands:composeItems(first,0).commands.length,
      seekChecks:'exact frame JSON equality at t=1 after t=2 and t=0',streamHashes:[0,1,2].map(t=>streamHash(sampler,t))};
  },limits);
}

const results=[];
for(const [name,source,assets] of [['authored-repeated-mesh',authored],['host-model-reuse',reused,registry],['dense-dashed-path',paths],['retained-molecular-motion',molecular]]){
  results.push(await measure(name,source,assets));
}
assert.deepEqual(results[0].streamHashes,results[1].streamHashes,'same packed CPU vertices, styles and ordering for authored/reused meshes');
assert.equal(registry.stats().leases,0);
// Two independent offline consumers share CPU assets; one disposal cannot invalidate the other.
await withOfflineScene(reused,{},async first=>{
  await withOfflineScene(reused,{},second=>{
    assert.equal(registry.stats().leases,2);
    assert.equal(streamHash(first,1),streamHash(second,1));
  },{modelAssets:registry});
  assert.equal(registry.stats().leases,1); first.sample(1);
},{modelAssets:registry});
assert.equal(registry.stats().leases,0);assert.equal(registry.stats().pinnedBytes,0);
const report={environment:{node:process.version,os:platform(),release:release(),cpu:cpus()[0]?.model,logicalCpus:cpus().length,systemMemoryBytes:totalmem()},
  method:{dimensions,warmup,samples,compileRepeats:repeats,order:results.map(r=>r.name),backend:'CPU production evaluator and buildDrawItems; no GPU',
    limitations:'Warm process and caches; sequential fixtures; small compile sample count; no driver memory or GPU timestamp measurements. Packed CPU parity is not a GPU pixel-equality claim.'},
  model:{vertices:1024,triangles:1922,instances:8,logicalVertices:8192,registryPrepareMs,registryStats:registry.stats()},
  results,sharedConsumerChecks:'two independent sampler leases; exact streamed geometry match; remaining sampler usable after peer disposal; zero final pins/leases',
  gpuReproduction:'node shared/animlib/tools/prove-image-rendering.mjs <output-directory>'};
await mkdir(output,{recursive:true});
await writeFile(join(output,'asset-reuse-benchmark.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));

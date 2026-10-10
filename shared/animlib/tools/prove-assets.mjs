/** Production compiler/CPU preparation/retained upload-code measurements.
 * GPU resource calls here are instrumented stubs: these are NOT GPU frame rates.
 * Native rendered pixel proof is produced separately with render-frames/video.
 */
import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { resolve,join } from 'node:path';
import { loadAssetRegistry } from './load-assets.mjs';
import { withOfflineScene,compileSource } from '../dist/core.js';
import { buildDrawItems } from '../dist/render-geometry.js';
import { paletteResolver } from '../dist/palette.js';
import { RetainedGeometry } from '../dist/retained-geometry.js';
import { GPURetained } from '../dist/gpu-retained.js';
import { composeItems } from '../dist/composition.js';

const output=resolve(process.argv[2]??'../../data/animlib-expansion/assets-proof');
const asset=resolve('fixtures/suzanne/asset.json'); await mkdir(output,{recursive:true});
const start=performance.now(),registry=await loadAssetRegistry([asset]), preparationMs=performance.now()-start;
const descriptor=registry.catalog[0], lease=registry.acquire([{id:descriptor.id,hash:descriptor.hash,part:'body'}]);
const inlineSource=`export default scene({},s=>s.mesh('m',${JSON.stringify(lease.resolve({id:descriptor.id,hash:descriptor.hash,part:'body'}))}));`;
lease.dispose();let inlineCompileError;
try{await compileSource(inlineSource);}catch(error){inlineCompileError=error.message;}
if(!inlineCompileError?.includes('source limit'))throw new Error('Expected inline model to exceed the unchanged source limit');
const source=`export default scene({mode:'3d'},s=>{
 for(let i=0;i<8;i++) {
  const m=s.model('m'+i,{asset:'suzanne-geometry',fill:'YELLOW',position:[(i%4-1.5)*3,(i<4?1.5:-1.5),0]});
  s.bind(m,[s.time],t=>({rotation:[0,t*0.6,0]}));
  s.keep(m);
 }
 s.play(s.camera.animate({height:10,yaw:0,pitch:0}),{duration:0});s.wait(2);
});`;
await writeFile(join(output,'models.js'),source);
const pkg=JSON.parse(await readFile(asset,'utf8'));
const frames={source,times:[0,1,2],directory:join(output,'frames'),modelAssets:[asset]};
await writeFile(join(output,'frames-input.json'),JSON.stringify(frames,null,2));
await writeFile(join(output,'manifest.json'),JSON.stringify({scenes:[{id:'models',file:'models.js',duration:2}],captions:[],modelAssets:[asset]},null,2));
const compileStart=performance.now();
let metrics;
await withOfflineScene(source,{},async sampler=>{
 const compileMs=performance.now()-compileStart,cache=new RetainedGeometry(),palette=paletteResolver();
 const prepare=(time,retained)=>{const f=sampler.sample(time);retained?.beginFrame();const items=buildDrawItems(f,f.camera,1280,720,palette,undefined,false,retained,undefined,sampler.assetGeometry);retained?.endFrame();return items;};
 const coldStart=performance.now(),first=prepare(0,cache),coldRetainedMs=performance.now()-coldStart;
 const warm=[],cpu=[];
 for(let i=0;i<20;i++){let t=performance.now();prepare(i/10,cache);warm.push(performance.now()-t);}
 for(let i=0;i<5;i++){let t=performance.now();prepare(i/3);cpu.push(performance.now()-t);}
 const unique=new Set(first.map(item=>item.mesh)), meshes=[...unique];
 const commands=composeItems(first,0).commands;
 const uploads=[],allocations=[];
 globalThis.GPUBufferUsage={UNIFORM:64,COPY_DST:8,VERTEX:32,INDEX:16};
 const device={createBuffer:spec=>{allocations.push(spec);return{usage:spec.usage,destroy(){}};},createBindGroup:()=>({}),queue:{writeBuffer:(buffer,_offset,data)=>uploads.push({usage:buffer.usage,bytes:data.byteLength})}};
 const gpu=new GPURetained(device),pass={setBindGroup(){},setVertexBuffer(){},setIndexBuffer(){},drawIndexed(){},draw(){}};
 const pipeline={getBindGroupLayout:()=>({})};
 const render=items=>{gpu.beginFrame();for(const c of composeItems(items,0).commands)if('first'in c)gpu.draw(pass,pipeline,c);gpu.endFrame();};
 render(first);const initialUploads=uploads.splice(0);render(prepare(1,cache));const steadyUploads=uploads.splice(0);gpu.dispose();
 const percentile=(values,p)=>[...values].sort((a,b)=>a-b)[Math.min(values.length-1,Math.floor(values.length*p))];
 metrics={model:{vertices:11808,triangles:3936,instances:8,logicalVertices:94464,nativeBlobBytes:pkg.parts.reduce((n,p)=>n+p.positions.byteLength+p.normals.byteLength+p.indices.byteLength,0)},
   bytes:{source:Buffer.byteLength(source),inlineSource:Buffer.byteLength(inlineSource),catalog:Buffer.byteLength(JSON.stringify(registry.catalog)),compiled:Buffer.byteLength(JSON.stringify(sampler.scene)),frame:Buffer.byteLength(JSON.stringify(sampler.sample(1))),...registry.stats()},inlineCompileError,
   timingMs:{preparation:preparationMs,compile:compileMs,coldRetained:coldRetainedMs,warmRetainedMedian:percentile(warm,.5),warmRetainedP95:percentile(warm,.95),cpuMedian:percentile(cpu,.5),cpuP95:percentile(cpu,.95)},
   retention:{uniqueMeshes:unique.size,allInstancesShareMesh:first.every(i=>i.mesh===first[0].mesh),drawCommands:commands.length,retainedVertexBytes:meshes.reduce((n,m)=>n+m.vertices.byteLength,0),retainedIndexBytes:meshes.reduce((n,m)=>n+m.indices.byteLength,0),initialUploads,steadyUploads,allocations},
   limitation:'CPU wall-clock and instrumented GPURetained upload-code behavior; not native GPU timing or driver allocation measurement.'};
},{modelAssets:registry});
metrics.afterDisposal=registry.stats();
await writeFile(join(output,'measurements.json'),JSON.stringify(metrics,null,2));console.log(JSON.stringify(metrics,null,2));

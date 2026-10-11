/** Reproduce native evidence and bounded CPU costs; run after the ordinary build. */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {withOfflineScene} from '../../dist/core.js';
const output=resolve('data/animlib-expansion/neural-proof-r2');
const source=await readFile(new URL('./neural-trajectory.js',import.meta.url),'utf8');
const manifest=JSON.parse(await readFile(new URL('./neural-trajectory-manifest.json',import.meta.url),'utf8'));
const ffmpeg=resolve(process.env.FFMPEG??'data/video-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe');
await mkdir(output,{recursive:true});
const run=(command,args)=>{const r=spawnSync(command,args,{windowsHide:true,encoding:'utf8',maxBuffer:10*1024*1024});if(r.status!==0)throw Error(r.stderr||r.stdout);return r;};
const quantiles=values=>{const a=[...values].sort((a,b)=>a-b);return{median:a[Math.ceil(a.length*.5)-1],p95:a[Math.ceil(a.length*.95)-1],samples:a.length};};
await withOfflineScene(source,{palette:manifest.palette},()=>{});
const compile=[];
for(let i=0;i<5;i++){const start=performance.now();await withOfflineScene(source,{palette:manifest.palette},()=>compile.push(performance.now()-start));}
const costs=await withOfflineScene(source,{palette:manifest.palette},sampler=>{
 const durations=[];for(let i=0;i<45;i++){const start=performance.now();sampler.sample(2.4+i*6.1/44);if(i>=5)durations.push(performance.now()-start);}
 const a=JSON.stringify(sampler.sample(4));sampler.sample(9.5);sampler.sample(0);assert.equal(JSON.stringify(sampler.sample(4)),a);
 return{sourceBytes:Buffer.byteLength(source),compiledBytes:Buffer.byteLength(JSON.stringify(sampler.scene)),frameBytes:Buffer.byteLength(a),
  objects:sampler.sample(4).elements.length,bindings:sampler.scene.reactiveBindings.length,tracks:sampler.scene.tracks.length,
  compileAndLeaseMs:quantiles(compile),evaluationMs:quantiles(durations),reverseFrameExact:true};
});
const times=[0,.9,1.6,2.4,3.4,5.45,7.3,8.5,9.49,3.4],directory=resolve(output,'frames');
await writeFile(resolve(output,'frames-input.json'),JSON.stringify({source,palette:manifest.palette,times,directory}));
run(process.execPath,['shared/animlib/tools/render-frames.mjs',resolve(output,'frames-input.json')]);
for(const width of[1280,960])assert((await readFile(resolve(directory,`${width}x720-4.png`))).equals(await readFile(resolve(directory,`${width}x720-9.png`))));
run(process.execPath,['shared/animlib/tools/render-video.mjs','--manifest','shared/animlib/demo/expansion/neural-trajectory-manifest.json','--output',resolve(output,'film.mp4'),'--ffmpeg',ffmpeg,'--fps','30']);
await mkdir(resolve(output,'motion'),{recursive:true});
const inspection=run(ffmpeg,['-hide_banner','-y','-i',resolve(output,'film.mp4'),'-vf','fps=6,scale=426:240,tile=3x4',resolve(output,'motion/sheet-%02d.png')]);
assert(/1280x720.*30 fps/.test(inspection.stderr));assert(!/Audio:/.test(inspection.stderr));
await writeFile(resolve(output,'motion/ffmpeg-inspection.txt'),inspection.stderr);
run(ffmpeg,['-v','error','-i',resolve(output,'film.mp4'),'-f','null','-']);
const report={...costs,node:process.version,filmSha256:createHash('sha256').update(await readFile(resolve(output,'film.mp4'))).digest('hex'),
 nativeSeekExact:[1280,960],film:{width:1280,height:720,fps:30,duration:9.5,frames:285,audio:false},
 sampledMotion:{fps:6,columns:3,rows:4,times:Array.from({length:57},(_,i)=>i/6)},
 limits:'Unchanged production limits. CPU wall time, no GPU FPS claim.'};
await writeFile(resolve(output,'checks.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));

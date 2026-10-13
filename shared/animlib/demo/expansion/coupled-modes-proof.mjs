/** Reproduce the original coupled-mode proof using production native rendering. */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { withOfflineScene, compileSource, detectSceneOverlaps, validateRenderableScene } from '../../dist/core.js';

const here=dirname(fileURLToPath(import.meta.url));
const destination=resolve(process.argv[2]??join(here,'../../../../.tmp/interdisciplinary-proof'));
const source=await readFile(join(here,'coupled-modes.js'),'utf8');
const palette={background:'BLACK',foreground:'WHITE',colors:{BLACK:'#080D18',WHITE:'#F0F2F8',GREY_B:'#8793AA',TEAL:'#47D7C8',ORANGE:'#FFAC66'}};
await mkdir(destination,{recursive:true});
const compileTimes=[];
let compiled;
for(let i=0;i<5;i++){
  const start=performance.now(); compiled=await compileSource(source,{palette});
  compileTimes.push(performance.now()-start);
}
validateRenderableScene(compiled);
const overlaps=detectSceneOverlaps(compiled,{width:1280,height:720,sampleRate:4});
if(overlaps.some(sample=>sample.overlaps.length))throw new Error('Published proof contains settled text overlaps.');
const sampling=[];
let sceneElements=0;
await withOfflineScene(source,{palette},async sampler=>{
  sceneElements=sampler.sample(0).elements.length;
  for(let pass=0;pass<3;pass++){
    const start=performance.now();
    for(let i=0;i<241;i++)sampler.sample(pass%2?8-i/30:i/30);
    sampling.push({frames:241,elapsedMs:performance.now()-start});
  }
});
await writeFile(join(destination,'coupled-modes.js'),source);
const request=join(destination,'frames-input.json');
await writeFile(request,JSON.stringify({source,palette,times:[0,1.4,2,2.8,3.6,4.4,5.2,6,6.4,7.2,8,3.6],directory:join(destination,'frames')}));
const rendered=spawnSync(process.execPath,[resolve(here,'../../tools/render-frames.mjs'),request],{encoding:'utf8',windowsHide:true});
if(rendered.status!==0)throw new Error(rendered.stderr||'Native rendering failed');
const evidence=JSON.parse(rendered.stdout);
const report={sourceSha256:createHash('sha256').update(source).digest('hex'),duration:compiled.duration,
  sceneElements,sourceChars:source.length,compileTimesMs:compileTimes,sampling,
  backend:evidence.backend,frames:evidence.frames.length,notes:'CPU timings and frame evidence; not GPU FPS or model generation latency.'};
await writeFile(join(destination,'metrics.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({destination,...report},null,2));

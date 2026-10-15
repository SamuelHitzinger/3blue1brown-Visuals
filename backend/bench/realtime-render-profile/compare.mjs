/** Compare immutable runs; PNG byte equality also proves identical lossless pixels. */
import {readFile,readdir,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {PNG} from 'pngjs';
const [before,after]=process.argv.slice(2).map(path=>resolve(path));if(!before||!after)throw Error('Pass BEFORE AFTER directories');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex'),cases=[];
for(const id of ['simple','labels','surface','glb']){
  const a=JSON.parse(await readFile(join(before,id+'-result.json'))),b=JSON.parse(await readFile(join(after,id+'-result.json')));
  assert.equal(a.status,'complete');assert.equal(b.status,'complete');assert.equal(a.sourceSha256,b.sourceSha256);if(id==='labels')assert.deepEqual(a.pixelHashes,b.pixelHashes);
  const pngs=[];
  let excluded=false;try{const note=JSON.parse(await readFile(join(after,'evidence-correction.json')));excluded=note.excludeOriginalPairPNGComparison?.includes(id)??false;}catch(error){if(error.code!=='ENOENT')throw error;}
  for(const name of excluded?[]:(await readdir(join(before,id+'-export'))).filter(name=>name.endsWith('.png'))){
    const ab=await readFile(join(before,id+'-export',name)),bb=await readFile(join(after,id+'-export',name)),ah=hash(ab),bh=hash(bb);
    let changedChannels=0,maxChannelDelta=0;
    if(ah!==bh){const a=PNG.sync.read(ab),b=PNG.sync.read(bb);assert.equal(a.width,b.width);assert.equal(a.height,b.height);
      for(let i=0;i<a.data.length;i++){const delta=Math.abs(a.data[i]-b.data[i]);if(delta)changedChannels++;maxChannelDelta=Math.max(maxChannelDelta,delta);}}
    if(id==='labels')assert.equal(ah,bh,`${id}/${name}`);
    pngs.push({name,beforeSha256:ah,afterSha256:bh,exact:ah===bh,changedChannels,maxChannelDelta});
  }
  cases.push({id,sourceSha256:a.sourceSha256,nativePixelHashes:{before:a.pixelHashes,after:b.pixelHashes,exact:JSON.stringify(a.pixelHashes)===JSON.stringify(b.pixelHashes)},pngComparisonExcluded:excluded,pngs,
    renderMedianMs:{before:a.renderCPU.medianMs,after:b.renderCPU.medianMs},renderP95Ms:{before:a.renderCPU.p95Ms,after:b.renderCPU.p95Ms},
    drawCalls:{before:a.renderRows.at(-1).drawCalls,after:b.renderRows.at(-1).drawCalls},
    uniformAndVertexUploadBytes:{before:a.renderRows.at(-1).writeBufferBytes,after:b.renderRows.at(-1).writeBufferBytes},
    firstRenderMs:{before:a.firstFrame.renderMs,after:b.firstFrame.renderMs}});
}
const result={before,after,exactAffectedLabelPixels:true,cases};await writeFile(join(after,'comparison.json'),JSON.stringify(result,null,2),{flag:'wx'});console.log(JSON.stringify({exactAffectedLabelPixels:true,cases:cases.map(({pngs,nativePixelHashes,...row})=>({...row,nativePixelsExact:nativePixelHashes.exact,pngs:pngs.length,changedPNGs:pngs.filter(p=>!p.exact)}))}));

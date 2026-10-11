/** Geometry/data verification for the generated unified science proofs. */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {withOfflineScene} from '../dist/core.js';
const root='data/animlib-expansion/science-3b1b';
const reports=[];
for(const [name,duration] of [['logistic-residual',7],['artem-state',7.5],['neural-trajectory',9.5]]){
  const path=`${root}/${name}`,source=await readFile(`${path}/${name}.js`,'utf8');
  const manifest=JSON.parse(await readFile(`${path}/manifest.json`,'utf8'));
  const times=Array.from({length:Math.round(duration*30)+1},(_,i)=>i/30);
  let prior;
  // Preserve every retained geometry, transform and numeric slot in the two
  // reskinned proofs. Ignore only the explicit mathematical font replacement.
  const normalized=frame=>frame.elements.map(e=>{
    const copy=structuredClone(e);
    if(copy.geometry.tex)copy.geometry.tex=copy.geometry.tex.replaceAll('\\mathsf{','\\mathrm{');
    return copy;
  });
  if(name!=='logistic-residual'){
    const oldSource=await readFile(`shared/animlib/demo/expansion/${name}.js`,'utf8');
    prior=await withOfflineScene(oldSource,{palette:manifest.palette},sampler=>times.map(t=>JSON.stringify(normalized(sampler.sample(t)))));
  }
  let worst=0;
  const check=(a,b)=>{worst=Math.max(worst,Math.abs(a-b));assert(Math.abs(a-b)<1e-11);};
  await withOfflineScene(source,{palette:manifest.palette},sampler=>{
    assert(Math.abs(sampler.scene.duration-duration)<1e-10);
    const hashes=[];
    for(const [i,t]of times.entries()){
      const frame=sampler.sample(t),byId=new Map(frame.elements.map(e=>[e.id,e]));
      if(prior)assert.equal(JSON.stringify(normalized(frame)),prior[i]);
      else{
        const w=.6+.8*Math.max(0,Math.min(1,(t-2.7)/2.2));
        const probability=x=>1/(1+Math.exp(-(w*x-2)));
        check(byId.get('weight').geometry.numbers.w,w);
        check(byId.get('prediction').position[0],0);
        check(byId.get('prediction').position[1],-2.4+4.5*probability(2));
        const residual=byId.get('plot/residual').geometry.points;
        check(residual[0][0],0);check(residual[1][0],0);
        check(residual[0][1],byId.get('prediction').position[1]);check(residual[1][1],2.1);
        for(const [x,y]of byId.get('plot/sigmoid').geometry.points)check(y,-2.4+4.5*probability((x+4)/2));
        check(byId.get('observation-5').position[0],0);check(byId.get('observation-5').position[1],2.1);
        check(byId.get('error-value').geometry.numbers.e,(1-1/(1+Math.exp(-.8)))**2);
      }
      hashes.push(createHash('sha256').update(JSON.stringify(frame)).digest('hex'));
    }
    for(let i=times.length-1;i>=0;i--)assert.equal(createHash('sha256').update(JSON.stringify(sampler.sample(times[i]))).digest('hex'),hashes[i]);
  });
  const input=JSON.parse(await readFile(`${path}/frames-input.json`,'utf8'));
  const last=input.times.length-1,first=input.times.indexOf(input.times[last]);
  for(const width of[1280,960])assert((await readFile(`${path}/frames/${width}x720-${first}.png`)).equals(await readFile(`${path}/frames/${width}x720-${last}.png`)));
  reports.push({name,samples:times.length,completeReverseExact:true,nativeRepeatedFrameExact:true,oldMotionExact:!!prior,maxNumericError:worst});
}
await writeFile(`${root}/verification.json`,JSON.stringify(reports,null,2));
console.log(JSON.stringify(reports,null,2));

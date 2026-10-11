import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {withOfflineScene} from '../../dist/core.js';
import {createPeptideBuilders} from '../../dist/peptide-motion.js';
import {createStagedPeptideSampler} from './peptide-staged-pose.mjs';

const root=resolve('shared/animlib/fixtures/biological');
const rig=JSON.parse(await readFile(join(root,'illustrative-peptide/rig.json'),'utf8'));
const stage=JSON.parse(await readFile(join(root,'peptide-staged/staging.json'),'utf8'));
const variables=[];for(let block=1;block<4;block++){const start=block*20;variables.push(['psi',start-9]);for(let i=start-8;i<start;i++)variables.push(['phi',i],['psi',i]);variables.push(['phi',start]);}
const keyframes=stage.samples.map(s=>({progress:s.progress,values:variables.map(([key,index])=>Math.round(s.angles[key][index]*1e8)/1e8)}));
const palette={background:'BLACK',foreground:'WHITE',colors:{BLACK:'#080d18',WHITE:'#f0f2f8',BLUE:'#7ea8ff',TEAL:'#47d7c8',GOLD:'#ffac66',PURPLE:'#c7a0ff',GREY:'#8c96a9'}};
const directory=resolve('data/animlib-expansion/peptide-3b1b-revision5');await mkdir(directory,{recursive:true});
const api=createPeptideBuilders(),samplePose=createStagedPeptideSampler(api,rig,keyframes);
const smooth=(t,a,d)=>{const u=Math.max(0,Math.min(1,(t-a)/d));return u*u*(3-2*u);};
const fit=[];for(let j=0;j<=100;j++){
  const t=j/10,{pose}=samplePose(t),yaw=.45*smooth(t,7.8,2.2),pitch=-.18*smooth(t,7.8,2.2);let maxX=0,maxY=0;
  for(const a of pose.anchors){const [x,y,z]=a.position.map(v=>v*.2),px=x*Math.cos(yaw)-z*Math.sin(yaw),pz=x*Math.sin(yaw)+z*Math.cos(yaw),py=y*Math.cos(pitch)+pz*Math.sin(pitch);maxX=Math.max(maxX,Math.abs(px)+.7);maxY=Math.max(maxY,Math.abs(py)+.45);}
  fit.push(Math.max(7.8,2*maxY/.86,2*maxX/(4/3*.86)));
}
const formationHeight=Math.max(...fit.slice(0,43));for(let i=0;i<=42;i++)fit[i]=formationHeight;
const heights=fit.map((_,i)=>Math.max(...fit.slice(Math.max(0,i-3),Math.min(fit.length,i+4)))).map((h,i,all)=>Math.max(h,...all.slice(Math.max(0,i-2),Math.min(all.length,i+3))));
const heldHeight=Math.max(...heights.slice(0,43));for(let i=0;i<=42;i++)heights[i]=heldHeight;
const source=`export default scene({mode:'3d',background:'BLACK',end:'hold'},s=>{
 const rig=${JSON.stringify({spec:rig.spec,compact:rig.compact})},keyframes=${JSON.stringify(keyframes)};
 const samplePose=(${createStagedPeptideSampler.toString()})(s,rig,keyframes);
 const smooth=(t,a,d)=>{const u=Math.max(0,Math.min(1,(t-a)/d));return u*u*(3-2*u);};
 let previous=-1,cached;const sample=t=>{t=Math.min(t,7);if(previous!==t){previous=t;cached=samplePose(t).pose.anchors.map(a=>a.position.map(v=>v*.2));}return cached;};
 const colors=['BLUE','TEAL','GOLD','PURPLE'],color=i=>colors[Math.min(3,Math.floor(i/20))],first=sample(0);
 const link=(p,i)=>{const a=p[Math.max(0,i-1)],b=p[i],c=p[i+1],d=p[Math.min(71,i+2)];return Array.from({length:9},(_,j)=>{const u=j/8;return b.map((v,k)=>.5*((2*v)+(-a[k]+c[k])*u+(2*a[k]-5*v+4*c[k]-d[k])*u*u+(-a[k]+3*v-3*c[k]+d[k])*u*u*u));});};
 for(let i=0;i<72;i++){
  const node=s.sphere('residue-'+i,{radius:.061,fill:color(i),position:first[i]});
  s.bind(node,[s.time],t=>({position:sample(t)[i]}));
  if(i<71){const edge=s.line('link-'+i,{points:link(first,i),stroke:color(i),strokeWidth:.036});s.bind(edge,[s.time],t=>({points:link(sample(t),i)}));}
 }
 for(let block=0;block<4;block++){
  const label=s.latex('coil-label-'+block,{tex:'\\\\alpha_'+(block+1),fill:colors[block],fontSize:.28,billboard:true});
  s.bind(label,[s.time],t=>{const a=sample(t).slice(block*20,block*20+12),region=sample(t).slice(block*20,block*20+20),p=[0,1,2].map(k=>a.reduce((n,v)=>n+v[k],0)/a.length);return {position:[Math.min(...region.map(v=>v[0]))-.55,p[1],p[2]+.04],opacity:smooth(t,2.8,.3)*(1-smooth(t,4.2,.35))};});
 }
 for(const [id,index,text,dx,dy] of [['start',0,'N',-.4,-.32],['end',71,'C',.35,.4]]){
  const label=s.text('end-'+id,{text,fill:color(index),fontSize:.24,billboard:true});
  s.bind(label,[s.time],t=>({position:sample(t)[index].map((v,k)=>v+(k===0?dx:k===1?dy:0))}));
  const leader=s.line('end-leader-'+id,{points:[first[index],first[index]],stroke:color(index),strokeWidth:.012,opacity:.65});
  s.bind(leader,[s.time],t=>({points:[sample(t)[index],sample(t)[index].map((v,k)=>v+(k===0?dx*.72:k===1?dy*.72:0))]}));
 }
 const heights=${JSON.stringify(heights)};
 s.play(s.camera.to3D({height:heights[0],distance:150,yaw:0,pitch:0}),{duration:0});
 for(let i=1;i<=100;i++)s.play(s.camera.animate({height:heights[i],yaw:.45*smooth(i/10,7.8,2.2),pitch:-.18*smooth(i/10,7.8,2.2)}),{duration:.1,ease:'linear'});
});`;
await writeFile(join(directory,'peptide.js'),source);
await writeFile(join(directory,'peptide-inputs.json'),JSON.stringify({rig:{spec:rig.spec,compact:rig.compact},keyframes,colors:['BLUE','TEAL','GOLD','PURPLE'],heights},null,2));
await writeFile(join(directory,'peptide-manifest.json'),JSON.stringify({palette,scenes:[{id:'peptide',file:'peptide.js',duration:10}],captions:[]},null,2));
await writeFile(join(directory,'peptide-preview.json'),JSON.stringify({source,palette,times:[1.4,3.1,3.7,4.2,5.4,7.8],directory:join(directory,'preview')}));
await writeFile(join(directory,'peptide-frames.json'),JSON.stringify({source,palette,times:[0,.7,1.4,2.1,2.8,3.5,4.2,4.9,5.6,6.6,7.2,7.8,8.4,9.5],directory:join(directory,'frames')}));
const started=performance.now();await withOfflineScene(source,{palette},async sampler=>{
 const compileMs=performance.now()-started,first=sampler.sample(1.4),middle=sampler.sample(4.2);sampler.sample(10);
 if(JSON.stringify(sampler.sample(1.4))!==JSON.stringify(first)||JSON.stringify(sampler.sample(4.2))!==JSON.stringify(middle))throw Error('Reverse seek mismatch');
 const start=performance.now();let bytes=0;for(let i=0;i<=120;i++)bytes=Math.max(bytes,JSON.stringify(sampler.sample(i/12)).length);
 const report={sourceCharacters:source.length,compileMs,sample121IncludingSerializationMs:performance.now()-start,maxSerializedFrameBytes:bytes,elements:middle.elements.length,reverseSeeks:'exact',assets:'none'};
 await writeFile(join(directory,'measurements.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
});

/** Reproducible native proof using output from benchmark-prepared-molecules.ts. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {withOfflineScene,compileSource,validateRenderableScene} from 'animlib/core';

const directory=resolve(process.argv[2]??'.tmp/prepared-assets-proof/large');
const context=JSON.parse(await readFile(join(directory,'context.json'),'utf8'));
if(context.molecular.accession!=='1JJ2'||context.provenance.converter.options.representation!=='backbone')throw new Error('Proof requires complete 1JJ2 explicit backbone benchmark output');
const models=JSON.parse(await readFile(join(directory,'model-payload.json'),'utf8'));
const id=Object.keys(models.assets)[0];
const metadata=Object.fromEntries(Object.entries(models.assets).map(([id,asset])=>[id,(asset as {metadata:unknown}).metadata]));
const chain=context.molecular.chains.find((c:{id:string})=>c.id==='A');
const pivot=chain.landmarks.find((p:{role:string})=>p.role==='representative').position;
const pdb=await readFile(join(directory,'cache',context.provenance.sourceHash+'.txt'),'utf8');
const sites=pdb.split(/\r?\n/).filter(line=>line.startsWith('ATOM  ')&&line.slice(21,22)==='A'&&line.slice(12,16).trim()==='CA');
const point=(line:string)=>[30,38,46].map((offset,axis)=>Number(line.slice(offset,offset+8))-context.origin[axis]);
const endpoints=[point(sites[0]),point(sites.at(-1)!)];
const distance=Math.hypot(...endpoints[0].map((v:number,i:number)=>v-endpoints[1][i]));
const palette={background:'BLACK',foreground:'WHITE',colors:{BLACK:'#080D18',WHITE:'#F0F2F8',GREY:'#8993A7',TEAL:'#46DDCE'}};
const source=`export default scene({mode:'3d',end:'hold',orbit:false,background:Color.BLACK},s=>{
 s.play(s.camera.to3D({height:8,distance:16,perspective:0,yaw:0,pitch:0}),{duration:0});
 const scale=.022,origin=[-1.8,-.1,0],pivot=${JSON.stringify(pivot)},points=${JSON.stringify(endpoints)};
 const body=s.model('subunit',{asset:${JSON.stringify(id)},position:origin,scale});
 for(const name of ${JSON.stringify(context.molecular.chains.filter((c:{id:string})=>c.id!=='A').flatMap((c:{parts:string[]})=>c.parts))})s.play(body.part(name).animate({opacity:.22}),{duration:0});
 const motion=s.rigidMotion({pivot,interpolation:'smooth',provenance:{kind:'illustrative',description:'Authored rigid separation of L2 for inspection; not biological dissociation or measured dynamics'},keyframes:[
  {time:1,translation:[0,0,0],rotation:[0,0,0]},
  {time:4.5,translation:[145,-15,90],rotation:[.25,-.5,.7]}]});
 for(const name of ${JSON.stringify(chain.parts)}){
  const part=body.part(name);s.play(part.tintTo(Color.TEAL),{duration:0});s.bind(part,[s.time],t=>motion.at(t));
 }
 const world=(p,t)=>motion.transformPoint(p,t).map((v,i)=>origin[i]+scale*v);
 const segment=s.line('fixed-distance',{points:points.map(p=>world(p,0)),stroke:Color.WHITE,strokeWidth:.032});
 s.bind(segment,[s.time],t=>({points:points.map(p=>world(p,t))}));
 points.forEach((p,i)=>{const site=s.latex('site-'+i,{position:world(p,0),tex:'\\\\bullet',fontSize:.45,fill:Color.WHITE,labelOcclusion:'overlay'});s.bind(site,[s.time],t=>({position:world(p,t)}));});
 const label=s.latex('distance',{tex:'d=${distance.toFixed(1)}\\\\,\\\\mathring{\\\\mathrm{A}}',fontSize:.28,fill:Color.TEAL,labelOcclusion:'overlay'});
 s.bind(label,[s.time],t=>{const a=world(points[0],t),b=world(points[1],t);return {position:[(a[0]+b[0])/2+.85,(a[1]+b[1])/2-.32,2]};});
 const name=s.latex('l2',{tex:'\\\\mathrm{L2}',fontSize:.32,fill:Color.TEAL,labelOcclusion:'overlay'});
 s.bind(name,[s.time],t=>{const p=world(pivot,t);return {position:[p[0],p[1]+1.15,2]};});
 s.latex('source',{tex:'\\\\text{1JJ2: large ribosomal subunit}',position:[-1.8,-2.85,2],fontSize:.25,fill:Color.GREY,labelOcclusion:'overlay'});
 s.latex('representation',{tex:'\\\\text{CA/P backbone}',position:[-1.8,-3.2,2],fontSize:.23,fill:Color.GREY,labelOcclusion:'overlay'});
 s.latex('scope',{tex:'\\\\text{Illustrative rigid motion}',position:[2.65,-1.7,2],fontSize:.25,fill:Color.WHITE,labelOcclusion:'overlay'});
 s.wait(6);
});`;
await mkdir(directory,{recursive:true});
await writeFile(join(directory,'motion.js'),source);
const compileStart=performance.now();
const compiled=await compileSource(source,{palette,models:metadata as any});
validateRenderableScene(compiled);
const compileMs=performance.now()-compileStart;
let sampleMs=0;
await withOfflineScene(source,{palette,models:metadata as any},async sampler=>{
 const start=performance.now();for(let i=0;i<=180;i++)sampler.sample(i/30);sampleMs=performance.now()-start;
 const before=sampler.sample(2),after=sampler.sample(5);sampler.sample(.2);
 if(JSON.stringify(before)!==JSON.stringify(sampler.sample(2)))throw new Error('Random seek changed frame');
 if(JSON.stringify(before)===JSON.stringify(after))throw new Error('Motion did not occur');
});
const request=join(directory,'frames-input.json');
await writeFile(request,JSON.stringify({source,palette,models,times:[0,1,2,3,4,4.5,5,6],directory:join(directory,'frames')}));
await writeFile(join(directory,'manifest.json'),JSON.stringify({models,palette,scenes:[{id:'rigid-l2',file:'motion.js',duration:6}],captions:[]}));
const rendered=spawnSync(process.execPath.includes('bun')?'node':process.execPath,['shared/animlib/tools/render-frames.mjs',request],{encoding:'utf8',windowsHide:true,maxBuffer:4*1024*1024});
if(rendered.status!==0)throw new Error(rendered.stderr||'Native frame rendering failed');
const evidence=JSON.parse(rendered.stdout);
const metrics={compileMs,sampleMs,framesSampled:181,sourceChars:source.length,backend:evidence.backend,renderedFrames:evidence.frames.length,distanceAngstrom:distance};
await writeFile(join(directory,'motion-metrics.json'),JSON.stringify(metrics,null,2));
console.log(JSON.stringify(metrics,null,2));

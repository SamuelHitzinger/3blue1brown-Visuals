import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {withOfflineScene} from '../../dist/core.js';
import {createPeptideBuilders} from '../../dist/peptide-motion.js';
import {loadAssetRegistry} from '../../tools/load-assets.mjs';
import {createStagedPeptideSampler} from './peptide-staged-pose.mjs';
const root=resolve('shared/animlib/fixtures/biological'),rig=JSON.parse(await readFile(join(root,'illustrative-peptide/rig.json'),'utf8'));
const stage=JSON.parse(await readFile(join(root,'peptide-staged/staging.json'),'utf8'));
const variables=[];for(let block=1;block<4;block++){const start=block*20;variables.push(['psi',start-9]);for(let i=start-8;i<start;i++)variables.push(['phi',i],['psi',i]);variables.push(['phi',start]);}
const keyframes=stage.samples.map(s=>({progress:s.progress,values:variables.map(([key,index])=>Math.round(s.angles[key][index]*1e8)/1e8)}));
const surfaceRoot=join(root,'peptide-polished'),palette=JSON.parse(await readFile(join(surfaceRoot,'palette.json'),'utf8'));
const directory=resolve('data/animlib-expansion/biological-motion-revision3');await mkdir(directory,{recursive:true});
const api=createPeptideBuilders(),samplePose=createStagedPeptideSampler(api,rig,keyframes),smooth=(t,a,d)=>{const u=Math.max(0,Math.min(1,(t-a)/d));return u*u*(3-2*u);};
const fit=[];for(let j=0;j<=100;j++){
  const t=j/10,{pose}=samplePose(t),yaw=.45*smooth(t,7.8,2.2),pitch=-.18*smooth(t,7.8,2.2);let maxX=0,maxY=0;
  for(const a of pose.atoms){const [x,y,z]=a.position.map(v=>v*.2),px=x*Math.cos(yaw)-z*Math.sin(yaw),pz=x*Math.sin(yaw)+z*Math.cos(yaw),py=y*Math.cos(pitch)+pz*Math.sin(pitch);maxX=Math.max(maxX,Math.abs(px));maxY=Math.max(maxY,Math.abs(py));}
  fit.push(Math.max(7.8,2*maxY/.83,2*maxX/(4/3*.86)));
}
const formationHeight=Math.max(...fit.slice(0,43));for(let i=0;i<=42;i++)fit[i]=formationHeight;
const heights=fit.map((_,i)=>Math.max(...fit.slice(Math.max(0,i-3),Math.min(fit.length,i+4))))
  .map((h,i,all)=>Math.max(h,...all.slice(Math.max(0,i-2),Math.min(all.length,i+3))));
const basis=samplePose(10).basis,rotation=[Math.atan2(basis[2][1],basis[2][2]),Math.asin(-basis[2][0]),Math.atan2(basis[1][0],basis[0][0])];
const source=`export default scene({mode:'3d',background:'BLACK',lighting:{ambient:1.2,directional:{direction:[-.4,.65,1],space:'camera',intensity:1.3}},end:'hold'},s=>{
 const rig=${JSON.stringify({spec:rig.spec,compact:rig.compact})},keyframes=${JSON.stringify(keyframes)};
 const samplePose=(${createStagedPeptideSampler.toString()})(s,rig,keyframes);
 const smooth=(t,a,d)=>{const u=Math.max(0,Math.min(1,(t-a)/d));return u*u*(3-2*u);};
 let previous=-1,cached;
 const sample=t=>{if(previous===t)return cached;previous=t;const {pose}=samplePose(t);
 const geometry=s.molecularBackboneGeometry({segments:pose.atoms.map(a=>({id:a.id,chainId:'original',residues:[a]})),bonds:pose.bonds,representation:'sticks',radius:.18,radialSegments:8,origin:pose.center,initialNormal:[.321,.456,.789],colors:['PURE_BLUE','BLUE','TEAL','GREEN','YELLOW','ORANGE','RED'],provenance:{kind:'schematic',source:'Original idealized peptide with authored inverse-kinematic torsions',units:'angstrom'}});
 const base={segments:[{id:'ca',chainId:'original',residues:pose.anchors}],bonds:[],origin:pose.center,colors:['PURE_BLUE','BLUE','TEAL','GREEN','YELLOW','ORANGE','RED'],initialNormal:[.321,.456,.789],provenance:{kind:'schematic',source:'Persistent CA representation of same idealized peptide',units:'angstrom'}};
 return cached={pose,geometry,tube:s.molecularBackboneGeometry({...base,representation:'backbone',radius:.37,radialSegments:6,samplesPerLink:2})};};
 const first=sample(0);
 for(let i=0;i<first.geometry.meshes.length;i++){const h=s.mesh('atomic-'+i,{...first.geometry.meshes[i],scale:.2,material:{roughness:.42,specular:.5}});s.bind(h,[s.time],t=>{const g=sample(t).geometry.meshes[i];return {vertices:g.vertices,normals:g.normals,opacity:(1-.95*smooth(t,.1,.45)+.95*smooth(t,6.5,.6))*(1-smooth(t,7.4,.8))};});}
 for(let i=0;i<first.tube.meshes.length;i++){const h=s.mesh('tube-'+i,{...first.tube.meshes[i],scale:.2,material:{roughness:.32,specular:.8}});s.bind(h,[s.time],t=>{const g=sample(t).tube.meshes[i];return {vertices:g.vertices,normals:g.normals,opacity:(.65+.35*smooth(t,.1,.45))*(1-smooth(t,6.5,.6))};});}
 const bead=s.modelInfo('peptide-unit-bead'),colors=['PURE_BLUE','BLUE','TEAL','GREEN','YELLOW','ORANGE','RED'];
 for(let i=0;i<72;i++){const h=s.mesh('bead-'+i,{asset:{id:bead.id,hash:bead.hash,part:'sphere'},position:first.pose.anchors[i].position.map(v=>v*.2),scale:.206,fill:colors[Math.min(6,Math.floor(i/72*7))],shading:'smooth',material:{roughness:.32,specular:.8}});s.bind(h,[s.time],t=>({position:sample(t).pose.anchors[i].position.map(v=>v*.2),opacity:(.65+.35*smooth(t,.1,.45))*(1-smooth(t,6.5,.6))}));}
 const descriptor=s.modelInfo('peptide-polished-surface');
 for(const part of descriptor.parts){const h=s.mesh('surface-'+part.id,{asset:{id:descriptor.id,hash:descriptor.hash,part:part.id},imageTexture:part.imageTexture,fill:'WHITE',scale:.2,rotation:${JSON.stringify(rotation)},opacity:0,shading:'smooth',material:{roughness:.4,specular:.8}});s.bind(h,[s.time],t=>({opacity:smooth(t,7.4,.8)}));}
 const heights=${JSON.stringify(heights)};
 s.play(s.camera.to3D({height:heights[0],distance:150,yaw:0,pitch:0}),{duration:0});
 for(let i=1;i<=100;i++)s.play(s.camera.animate({height:heights[i],yaw:.45*smooth(i/10,7.8,2.2),pitch:-.18*smooth(i/10,7.8,2.2)}),{duration:.1,ease:'linear'});
});`;
const modelAssets=['peptide-sequence-colors.json','peptide-polished-surface.json','bead/peptide-unit-bead.json'].map(file=>join(surfaceRoot,file));
await writeFile(join(directory,'peptide.js'),source);
await writeFile(join(directory,'peptide-manifest.json'),JSON.stringify({modelAssets,colorPolicy:'source',palette,scenes:[{id:'peptide',file:'peptide.js',duration:10}],captions:[]},null,2));
await writeFile(join(directory,'peptide-frames.json'),JSON.stringify({source,modelAssets,colorPolicy:'source',palette,times:[0,.7,1.4,2.1,2.8,3.5,4.2,4.9,5.6,6.6,7.2,7.8,8.4,9.5],directory:join(directory,'peptide-frames')}));
const registry=await loadAssetRegistry(modelAssets,{colorPolicy:'source'}),start=performance.now();
await withOfflineScene(source,{palette},async sampler=>{
 const compiledMs=performance.now()-start,a=sampler.sample(1.6),b=sampler.sample(4.4);sampler.sample(10);
 if(JSON.stringify(sampler.sample(1.6))!==JSON.stringify(a)||JSON.stringify(sampler.sample(4.4))!==JSON.stringify(b))throw Error('Peptide reverse seek mismatch');
 const at=performance.now();let bytes=0;for(let i=0;i<=120;i++)bytes=Math.max(bytes,JSON.stringify(sampler.sample(i/12)).length);
 const report={sourceCharacters:source.length,compiledMs,sample121IncludingSerializationMs:performance.now()-at,maxSerializedFrameBytes:bytes,elements:b.elements.length,reverseSeeks:'exact',assetStats:registry.stats()};
 await writeFile(join(directory,'peptide-measurements.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
},{modelAssets:registry});

import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {withOfflineScene} from '../../dist/core.js';
import {createPeptideBuilders} from '../../dist/peptide-motion.js';
import {loadAssetRegistry} from '../../tools/load-assets.mjs';
const root=resolve('shared/animlib/fixtures/biological/illustrative-peptide'),rig=JSON.parse(await readFile(join(root,'rig.json'),'utf8')),directory=resolve('data/animlib-expansion/biological-motion-revision2');await mkdir(directory,{recursive:true});
// Original staging only: the atom dictionary and compact endpoint remain unchanged.
const extended=structuredClone(rig.extended),coil=structuredClone(rig.coil);
for(let i=0;i<72;i++)for(const [j,key]of ['phi','psi'].entries()){if(i%20<12)extended[key][i]=[-120,130][j]*Math.PI/180;else extended[key][i]=coil[key][i]=rig.extended[key][i]*.5+rig.compact[key][i]*.5;}
const smooth=(t,a,d)=>{const u=Math.max(0,Math.min(1,(t-a)/d));return u*u*(3-2*u);},api=createPeptideBuilders();
const fit=[];for(let j=0;j<=80;j++){const t=j/10,angles={phi:[],psi:[]};for(let i=0;i<72;i++)for(const key of ['phi','psi'])angles[key].push(extended[key][i]+(coil[key][i]-extended[key][i])*smooth(t,.35+Math.floor(i/20)*.22,1.8)+(rig.compact[key][i]-coil[key][i])*smooth(t,3.4,2.35));const p=api.peptidePose(rig.spec,angles.phi,angles.psi);let x=0,y=0;for(const a of p.atoms){const px=(a.position[0]-p.center[0])*.2,py=(a.position[1]-p.center[1])*.2;x=Math.max(x,Math.abs(px*Math.cos(-.605)-py*Math.sin(-.605)));y=Math.max(y,Math.abs(px*Math.sin(-.605)+py*Math.cos(-.605)));}fit.push(Math.max(9,2*y/.86,2*x/(4/3*.88))*1.06);}
const heights=fit.map((_,i)=>Math.max(...fit.slice(Math.max(0,i-2),Math.min(fit.length,i+3))));
const source=`export default scene({mode:'3d',background:'BLACK',end:'hold'},s=>{
 const spec=${JSON.stringify(rig.spec)},extended=${JSON.stringify(extended)},coil=${JSON.stringify(coil)},compact=${JSON.stringify(rig.compact)};
 const smooth=(t,a,d)=>{const u=Math.max(0,Math.min(1,(t-a)/d));return u*u*(3-2*u);};
 let previous=-1,cached;
 const sample=t=>{if(previous===t)return cached;previous=t;const phase=smooth(t,3.4,2.35),torsions={phi:[],psi:[]};
 for(let i=0;i<72;i++)for(const key of ['phi','psi']){const local=smooth(t,.35+Math.floor(i/20)*.22,1.8);torsions[key].push(extended[key][i]+(coil[key][i]-extended[key][i])*local+(compact[key][i]-coil[key][i])*phase);}
 const pose=s.peptidePose(spec,torsions.phi,torsions.psi);
 const geometry=s.molecularBackboneGeometry({segments:pose.atoms.map(a=>({id:a.id,chainId:'original',residues:[a]})),bonds:pose.bonds,representation:'sticks',radius:.18,radialSegments:8,origin:pose.center,initialNormal:[.321,.456,.789],colors:['PURE_BLUE','BLUE','TEAL','GREEN','YELLOW','ORANGE','RED'],provenance:{kind:'schematic',source:'Original idealized peptide with prescribed torsions',units:'angstrom'}});
 const base={segments:[{id:'ca',chainId:'original',residues:pose.anchors}],bonds:[],origin:pose.center,colors:['PURE_BLUE','BLUE','TEAL','GREEN','YELLOW','ORANGE','RED'],initialNormal:[.321,.456,.789],provenance:{kind:'schematic',source:'Persistent CA representation of same idealized peptide',units:'angstrom'}};
 const beads=s.molecularBackboneGeometry({...base,representation:'beads',radius:1.05,beadDetail:1});
 const tube=s.molecularBackboneGeometry({...base,representation:'backbone',radius:.38,radialSegments:6,samplesPerLink:2});
 return cached={pose,geometry,beads,tube};};
 const first=sample(0),rotation=[0,0,-.605];
 for(let i=0;i<first.geometry.meshes.length;i++){const h=s.mesh('atomic-'+i,{...first.geometry.meshes[i],scale:.2,rotation,material:{roughness:.5,specular:.3}});s.bind(h,[s.time],t=>{const g=sample(t).geometry.meshes[i];return {vertices:g.vertices,normals:g.normals,opacity:(1-.92*smooth(t,.1,.45)+.92*smooth(t,5.15,.5))*(1-smooth(t,6.25,.65))};});}
 for(const role of ['beads','tube'])for(let i=0;i<first[role].meshes.length;i++){const h=s.mesh(role+'-'+i,{...first[role].meshes[i],scale:.2,rotation,material:{roughness:.38,specular:.4}});s.bind(h,[s.time],t=>{const g=sample(t)[role].meshes[i];return {vertices:g.vertices,normals:g.normals,opacity:(.65+.35*smooth(t,.1,.45))*(1-smooth(t,5.15,.5))};});}
 const descriptor=s.modelInfo('illustrative-peptide-surface'),colors=['PURE_BLUE','BLUE','TEAL','GREEN','YELLOW','ORANGE','RED'];
 for(const part of descriptor.parts){const h=s.mesh('surface-'+part.id,{asset:{id:descriptor.id,hash:descriptor.hash,part:part.id},fill:colors[Number(part.id.split('-')[1])],scale:.2,rotation,opacity:0,shading:'smooth',material:{roughness:.55,specular:.3}});s.bind(h,[s.time],t=>({opacity:smooth(t,6.25,.65)}));}
 const heights=${JSON.stringify(heights)},height=t=>{const at=Math.min(80,Math.max(0,t*10)),i=Math.floor(at);return heights[i]+((heights[i+1]??heights[i])-heights[i])*(at-i);};
 s.play(s.camera.to3D({height:heights[0],distance:150,yaw:0,pitch:0}),{duration:0});for(let i=1;i<=80;i++)s.play(s.camera.animate({height:heights[i],yaw:.45*smooth(i/10,5.9,2.1),pitch:-.15*smooth(i/10,5.9,2.1)}),{duration:.1,ease:'linear'});
});`;
const modelAssets=[join(root,'illustrative-peptide-surface.json')];
await writeFile(join(directory,'peptide-authored-poses.json'),JSON.stringify({extended,coil,compact:rig.compact,provenance:'Original staging; unchanged compact endpoint'},null,2));
await writeFile(join(directory,'peptide.js'),source);await writeFile(join(directory,'peptide-manifest.json'),JSON.stringify({modelAssets,scenes:[{id:'peptide',file:'peptide.js',duration:8}],captions:[]},null,2));
await writeFile(join(directory,'peptide-frames.json'),JSON.stringify({source,modelAssets,times:[0,.6,1.2,1.8,2.6,3.3,4,4.7,5.3,5.9,6.5,7.5],directory:join(directory,'peptide-frames')}));
const registry=await loadAssetRegistry(modelAssets),start=performance.now();
await withOfflineScene(source,{},async sampler=>{const compiledMs=performance.now()-start,a=sampler.sample(1.6),b=sampler.sample(4.4);sampler.sample(8);if(JSON.stringify(sampler.sample(1.6))!==JSON.stringify(a)||JSON.stringify(sampler.sample(4.4))!==JSON.stringify(b))throw Error('Peptide reverse seek mismatch');const at=performance.now();let bytes=0;for(let i=0;i<=120;i++)bytes=Math.max(bytes,JSON.stringify(sampler.sample(i/15)).length);const report={sourceCharacters:source.length,compiledMs,sample121IncludingSerializationMs:performance.now()-at,maxSerializedFrameBytes:bytes,elements:b.elements.length,dynamicMeshes:b.elements.filter(e=>e.id.startsWith('atomic-')).map(e=>({vertices:e.geometry.vertices.length,triangles:e.geometry.triangles.length})),reverseSeeks:'exact',assetStats:registry.stats()};await writeFile(join(directory,'peptide-measurements.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));},{modelAssets:registry});

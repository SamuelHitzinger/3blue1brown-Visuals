/** Original lobed anatomy and cavity shell, never source-derived pixels/meshes. */
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {createMolecularEnvelope} from '../dist/molecular-envelope.js';
import {writeAssetPackages} from './write-asset-packages.mjs';
const root=resolve('shared/animlib/fixtures/biological/transcription-revision2'),sha=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const provenance=(recipe,selection)=>({source:'Original scaffold in prepare-transcription-revision2-assets.mjs',sourceHash:sha(recipe),creator:'Original animlib transcription revision 2',license:'CC0-1.0',preparedAt:'2026-10-11',converter:{name:'Lobed analytic lobed anatomy / analytic cavity surface',version:'2',options:{}},selection,modifications:['Distinct lobed silhouette and genuine open cavity; all geometry original.'],fidelity:'Illustrative molecular anatomy, not atomic coordinates or a deposited enzyme; no source pixels.'});
await mkdir(root,{recursive:true});
const recipes={};
for(const shape of ['purine','pyrimidine'])for(const context of [false,true]){
 const sugar=[[0,-.13,0],[.13,-.08,.075],[.11,.12,0],[-.07,.15,-.05],[-.14,0,.035],[.015,.025,.12]],phosphate=[[-.09,-.32,0],[-.16,-.4,.075],[-.03,-.41,-.065],[-.2,-.31,-.07]],base=[[.34,0,0],[.47,-.105,0],[.60,-.06,.06],[.60,.08,-.015],[.45,.12,-.025],[.48,.015,.14]];
 if(shape==='purine')base.push([.72,-.025,.04],[.8,.105,.025],[.68,.2,-.025]);
 const recipe={sugar,phosphate,base},resolution=context?20:40;recipes[shape]=recipe;
 const build=(id)=>{
   const lon=context?20:40,lat=context?12:24,vertices=[],normals=[],triangles=[];
   const center=id==='sugar'?[.01,0,0]:id==='phosphate'?[-.08,-.29,0]:[shape==='purine'?.51:.46,0,0];
   const size=id==='sugar'?[.225,.235,.16]:id==='phosphate'?[.125,.145,.11]:[shape==='purine'?.29:.23,.19,.135];
   const point=(u,v)=>{const a=u*2*Math.PI,b=v*Math.PI,sb=Math.sin(b),cb=Math.cos(b),dx=sb*Math.cos(a),dy=cb,dz=sb*Math.sin(a),dirs=id==='sugar'?[[1,0,0],[-.7,.7,0],[-.6,-.7,0],[0,.2,1],[0,-.4,-1]]:[[.7,.7,0],[-.7,.4,.5],[.1,-.7,.7]],lobe=1+dirs.reduce((sum,d)=>sum+(id==='sugar'?.42:.4)*Math.exp(9*((dx*d[0]+dy*d[1]+dz*d[2])/Math.hypot(...d)-1)),0);return [center[0]+size[0]*sb*Math.cos(a)*lobe,center[1]+size[1]*cb*lobe,center[2]+size[2]*sb*Math.sin(a)*lobe];};
   for(let j=0;j<=lat;j++)for(let i=0;i<lon;i++){const u=i/lon,v=Math.max(.00001,Math.min(.99999,j/lat)),p=point(u,v),a=point(u+.00001,v).map((x,k)=>x-p[k]),b=point(u,v+.00001).map((x,k)=>x-p[k]),n=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],l=Math.hypot(...n);vertices.push(p);normals.push(n.map(x=>x/l));}
   for(let j=0;j<lat;j++)for(let i=0;i<lon;i++){const a=j*lon+i,b=j*lon+(i+1)%lon,c=a+lon,d=b+lon;triangles.push([a,b,c],[b,d,c]);}
   return {id,vertices,normals,triangles};
 };
 const parts=['sugar','phosphate','base'].map(build);
 const id='transcription-r2-'+shape+(context?'-context':'');
 await writeAssetPackages({images:[],model:{id,kind:'model',version:1,units:'schematic local units; nominal base reach .675',parts,provenance:provenance(recipe,shape)},report:{recipe,resolution}},join(root,shape+(context?'-context':'')));
}
// Connected hollow tube in xy, entirely behind the catalytic frontal plane.
// Varying centerline/depth/tube radius makes one enclosing multi-lobed body.
const vertices=[],normals=[],triangles=[],around=96,tube=24;
const point=(u,v)=>{const a=u*2*Math.PI,b=v*2*Math.PI,r=.58+.28*Math.sin(3*a+.2)+.12*Math.cos(5*a),cx=(3.3+.25*Math.cos(3*a))*Math.cos(a),cy=(2.25+.2*Math.sin(2*a))*Math.sin(a),cz=-1.6+.28*Math.sin(2*a);return [cx+r*Math.cos(b)*Math.cos(a),cy+r*Math.cos(b)*Math.sin(a),cz+r*Math.sin(b)];};
for(let i=0;i<around;i++)for(let j=0;j<tube;j++){const u=i/around,v=j/tube,p=point(u,v),a=point(u+.0001,v).map((x,k)=>x-p[k]),b=point(u,v+.0001).map((x,k)=>x-p[k]),n=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],l=Math.hypot(...n);vertices.push(p);normals.push(n.map(x=>x/l));}
for(let i=0;i<around;i++)for(let j=0;j<tube;j++){const a=i*tube+j,b=((i+1)%around)*tube+j,c=i*tube+(j+1)%tube,d=((i+1)%around)*tube+(j+1)%tube;triangles.push([a,b,c],[b,d,c]);}
const recipe={around,tube,centerRadii:[3.3,2.25],depth:-1.05};
await writeAssetPackages({images:[],model:{id:'transcription-r2-cavity-polymerase',kind:'model',version:1,units:'schematic units',parts:[{id:'body',vertices,triangles,normals}],provenance:provenance(recipe,'Original connected lobed open shell')},report:{recipe}},join(root,'polymerase'));
await writeFile(join(root,'recipes.json'),JSON.stringify(recipes,null,2));
await writeFile(join(root,'README.md'),'# Original transcription revision 2 anatomy\n\nCC0 lobed nucleotide envelopes and continuous open polymerase scaffold. Reproduce with `node shared/animlib/tools/prepare-transcription-revision2-assets.mjs`. Each manifest records original recipe hash, binary hashes, bounds and explicit illustrative fidelity. Local x is baseward, local y chainward. No source pixels, extracted meshes or deposited enzyme identity.\n');
console.log(root);




/** Reusable original smooth display envelope from the unchanged compact peptide. */
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {createMolecularEnvelope} from '../dist/molecular-envelope.js';
import {hashAssetBytes} from '../dist/asset-validation.js';
import {writeAssetPackages} from './write-asset-packages.mjs';

const root=resolve('shared/animlib/fixtures/biological/illustrative-peptide');
const bytes=await readFile(join(root,'endpoint.json')),endpoint=JSON.parse(bytes),sha=createHash('sha256').update(bytes).digest('hex');
const output=resolve('shared/animlib/fixtures/biological/peptide-polished');await mkdir(output,{recursive:true});
const geometry=createMolecularEnvelope({positions:endpoint.atoms.flatMap(a=>a.position),origin:endpoint.center,sigma:1.2,isoLevel:1.05,resolution:31,smoothingIterations:6});
// One Loop subdivision step rounds the coarse contour. Shared edge vertices and
// normals are computed before splitting into bounded reusable package parts.
const {vertices,triangles}=geometry,neighbors=vertices.map(()=>new Set()),edges=new Map();
for(const [a,b,c]of triangles)for(const [u,v,w]of [[a,b,c],[b,c,a],[c,a,b]]){
  neighbors[u].add(v);neighbors[v].add(u);const key=[Math.min(u,v),Math.max(u,v)].join(',');
  const edge=edges.get(key)??{u,v,opposite:[]};edge.opposite.push(w);edges.set(key,edge);
}
if([...edges.values()].some(e=>e.opposite.length!==2))throw Error('Expected a closed two-manifold envelope');
const refined=vertices.map((p,i)=>{
  const n=neighbors[i].size,beta=(5/8-(3/8+Math.cos(2*Math.PI/n)/4)**2)/n;
  return p.map((v,k)=>v*(1-n*beta)+[...neighbors[i]].reduce((s,j)=>s+vertices[j][k]*beta,0));
});
for(const edge of edges.values()){edge.index=refined.length;refined.push([0,1,2].map(k=>3/8*(vertices[edge.u][k]+vertices[edge.v][k])+1/8*edge.opposite.reduce((s,i)=>s+vertices[i][k],0)));}
const edgeIndex=(a,b)=>edges.get([Math.min(a,b),Math.max(a,b)].join(',')).index;
const faces=triangles.flatMap(([a,b,c])=>{const ab=edgeIndex(a,b),bc=edgeIndex(b,c),ca=edgeIndex(c,a);return [[a,ab,ca],[b,bc,ab],[c,ca,bc],[ab,bc,ca]];});
const normals=refined.map(()=>[0,0,0]);
for(const [a,b,c]of faces){const u=refined[b].map((v,k)=>v-refined[a][k]),v=refined[c].map((v,k)=>v-refined[a][k]),n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];for(const i of [a,b,c])for(let k=0;k<3;k++)normals[i][k]+=n[k];}
for(let i=0;i<normals.length;i++){const length=Math.hypot(...normals[i]);if(length<1e-12)throw Error('Undefined refined normal');normals[i]=normals[i].map(v=>v/length);}
const values=refined.map(p=>{let nearest,distance=Infinity;for(const atom of endpoint.atoms){const d=atom.position.reduce((s,v,k)=>s+(v-endpoint.center[k]-p[k])**2,0);if(d<distance){distance=d;nearest=atom;}}return nearest.value;});
const colors=['#557BFF','#46BCE9','#45D8C2','#78D365','#F1E957','#FFA44B','#F7756B'];
const provenance={source:'Original idealized peptide endpoint derived from pinned wwPDB CCD components',sourceHash:sha,creator:'animlib original explanatory assets',license:'CC0-1.0',preparedAt:'2026-10-11',converter:{name:'prepare-peptide-surface',version:'1',options:{sigma:1.2,isoLevel:1.05,resolution:31,smoothingIterations:6,loopSubdivisionSteps:1,colors}},selection:'All 414 heavy atoms of unchanged original 72-residue compact endpoint',modifications:['Taubin-smoothed schematic Gaussian envelope, then one shared-edge Loop subdivision','Per-vertex nearest-residue sequence coordinate sampled through an original continuous color texture'],fidelity:'Display envelope of an illustrative idealized peptide; not a physical fold or solvent-excluded surface'};
const pixels=new Uint8Array(512*4),rgb=colors.map(c=>[1,3,5].map(i=>parseInt(c.slice(i,i+2),16)));
for(let i=0;i<512;i++){const x=i/511*6,j=Math.min(5,Math.floor(x));for(let k=0;k<3;k++)pixels[i*4+k]=Math.round(rgb[j][k]+(rgb[j+1][k]-rgb[j][k])*(x-j));pixels[i*4+3]=255;}
const image={id:'peptide-sequence-colors',kind:'image',version:1,width:512,height:1,storage:'rgba8',encoding:'srgb',origin:'top-left',alpha:'straight',colorPolicy:'source',pixels,provenance};
const texture={image:{id:image.id,hash:await hashAssetBytes(pixels)},alphaMode:'opaque',filter:'linear',wrap:'clamp'};
// The image identity is its canonical content hash, obtained from the registry.
const {createAssetRegistry}=await import('../dist/asset-registry.js');
texture.image.hash=(await createAssetRegistry([image],{colorPolicy:'source'})).catalog[0].hash;
const parts=[];
for(let start=0;start<faces.length;start+=12000){const part={id:'surface-'+parts.length,vertices:[],normals:[],uv0:[],triangles:[],imageTexture:texture},map=new Map();
  for(const face of faces.slice(start,start+12000))part.triangles.push(face.map(i=>{if(!map.has(i)){map.set(i,part.vertices.length);part.vertices.push(refined[i]);part.normals.push(normals[i]);part.uv0.push([(values[i]*511+.5)/512,.5]);}return map.get(i);}));parts.push(part);
}
await writeFile(join(output,'palette.json'),JSON.stringify({colors:{...Object.fromEntries(['PURE_BLUE','BLUE','TEAL','GREEN','YELLOW','ORANGE','RED'].map((key,i)=>[key,colors[i]])),BLACK:'#000000',WHITE:'#FFFFFF'},background:'BLACK',foreground:'WHITE'},null,2));
const report=await writeAssetPackages({images:[image],model:{id:'peptide-polished-surface',kind:'model',version:1,units:'angstrom',provenance,parts},report:{endpointHash:sha,vertices:refined.length,triangles:faces.length,parts:parts.length,sequenceCoordinates:'nearest atom at each shared vertex, continuously interpolated across triangles'}},output);
const {createMoleculeBuilders}=await import('../dist/molecules.js');
const bead=createMoleculeBuilders().molecule({positions:[0,0,0],radius:1,detail:3})[0];
await writeAssetPackages({images:[],model:{id:'peptide-unit-bead',kind:'model',version:1,units:'unit radius',provenance:{...provenance,selection:'One original subdivided octahedral unit sphere',modifications:['Three shared-edge spherical subdivisions'],fidelity:'Reusable display sphere, not an atomistic surface'},parts:[{id:'sphere',vertices:bead.vertices,triangles:bead.triangles,normals:bead.normals}]},report:{use:'Shared geometry for persistent CA beads'}},join(output,'bead'));
console.log(JSON.stringify({vertices:refined.length,triangles:faces.length,parts:parts.length,stats:report.stats}));

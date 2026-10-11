/** Original CC0 illustrative forms. Source images are review references only. */
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {createMolecularEnvelope,createMolecularEnvelopeParts} from '../dist/molecular-envelope.js';
import {writeAssetPackages} from './write-asset-packages.mjs';
const root=resolve('shared/animlib/fixtures/biological/transcription-revision3');
const hash=v=>createHash('sha256').update(v).digest('hex');
const generatorHash=hash(await readFile(new URL(import.meta.url)));
const provenance=recipe=>({source:'Original author-defined Gaussian sites; prepare-transcription-revision3-assets.mjs',sourceHash:generatorHash,creator:'Original animlib transcription revision 3',license:'CC0-1.0',preparedAt:'2026-10-11',converter:{name:'Native Gaussian envelope extraction and Taubin smoothing',version:'3',options:recipe},selection:'Original illustrative anatomy',modifications:['Author-defined fused irregular lobes; no source-derived pixels, meshes or atomic coordinates.'],fidelity:'Schematic molecular form; not a deposited enzyme or chemically measured surface.'});
await mkdir(root,{recursive:true});
const recipes={};
for(const shape of ['purine','pyrimidine'])for(const context of [false,true]){
 const sugar=[[-.13,-.13,0],[-.14,.12,-.015],[.1,.16,.01],[.14,-.085,-.045],[0,.015,-.035],[-.015,.025,.18],[.025,.11,.19],[-.12,-.04,-.16]],
 phosphate=[[-.015,-.29,0],[.075,-.31,.045],[-.09,-.34,-.045]],
 base=[[.31,.045,-.01],[.43,.12,-.02],[.54,.11,0],[.62,0,-.015],[.48,-.105,-.015],[.37,-.07,.01],[.47,.025,.15],[.53,-.025,.17]];
 if(shape==='purine')base.push([.69,.09,-.015],[.73,-.055,.01],[.61,-.12,-.04]);
 const recipe={shape,context,sugar,phosphate,base,resolution:context?9:22,sigmas:[.09,.068,.079],isoLevel:.56,smoothingIterations:4};recipes[shape+(context?'-context':'')]=recipe;
 const parts=['sugar','phosphate','base'].map((id,j)=>{const {vertices,normals,triangles}=createMolecularEnvelope({positions:recipe[id].flat(),sigma:recipe.sigmas[j],isoLevel:recipe.isoLevel,resolution:recipe.resolution,smoothingIterations:4,maxTriangles:20000});return {id,vertices,normals,triangles};});
 const id='transcription-r3-'+shape+(context?'-context':'');
 await writeAssetPackages({images:[],model:{id,kind:'model',version:1,units:'schematic local units; nominal base reach .675',parts,provenance:provenance(recipe)},report:{recipe}},join(root,shape+(context?'-context':'')));
}
// Connected volumetric saddle: rear center has real depth; front mass is displaced
// above/below the reaction corridor. It is not a perturbed torus.
const lobes=[
 [-2.55,.9,-1.8, .7,1.15,.8],[-1.9,2.15,-1.5,1.15,.65,.85],
 [.1,2.65,-1.85,1.45,.85,.95],[2.3,1.65,-1.55,.95,1,.75],
 [2.7,-.2,-2.1,.75,.95,.85],[1.7,-2.05,-1.9,1.3,.72,.9],
 [-.5,-2.5,-1.6,1.5,.75,.85],[-2.5,-1.65,-1.75,.75,.8,.7],
 [-1.2,.1,-3.2,1.3,1.65,.6],[1.05,.15,-3.4,1.4,1.55,.65],
];
const sites=[];
for(const [x,y,z,rx,ry,rz] of lobes)for(let i=0;i<34;i++){
 const v=1-2*(i+.5)/34,a=i*2.3999632297,r=.78*Math.sqrt(1-v*v);
 sites.push([x+rx*r*Math.cos(a),y+ry*v*.78,z+rz*r*Math.sin(a)]);
}
const recipe={lobes,sitePattern:'34 Fibonacci ellipsoid samples per lobe, amplitude .78',sigma:.42,isoLevel:1.2,resolution:44,smoothingIterations:6};recipes.polymerase=recipe;
const parts=createMolecularEnvelopeParts({positions:sites.flat(),sigma:recipe.sigma,isoLevel:recipe.isoLevel,resolution:recipe.resolution,smoothingIterations:6,maxTotalTriangles:100000,trianglesPerPart:18000}).map(({vertices,normals,triangles},i)=>({id:'body-'+i,vertices,normals,triangles}));
await writeAssetPackages({images:[],model:{id:'transcription-r3-enclosing-polymerase',kind:'model',version:1,units:'schematic units',parts,provenance:provenance(recipe)},report:{recipe}},join(root,'polymerase'));
await writeFile(join(root,'recipes.json'),JSON.stringify(recipes,null,2));
await writeFile(join(root,'README.md'),'# Original transcription revision 3 anatomy\n\nCC0 original fused nucleotide and enclosing machinery forms. Reproduce with `node shared/animlib/tools/prepare-transcription-revision3-assets.mjs`. Manifest sourceHash binds the complete generator; recipe parameters are recorded. No source pixels, meshes, or atomic coordinates. The native Gaussian contour is illustrative, not a solvent-excluded surface or deposited structure. Revision 2 packages are deliberately untouched.\n');
console.log(JSON.stringify({root,polymeraseParts:parts.length,triangles:parts.reduce((n,p)=>n+p.triangles.length,0)}));


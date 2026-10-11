/** Original schematic subunits, in a common anchor frame: x=baseward, y=chainward. */
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {createMolecularEnvelope} from '../dist/molecular-envelope.js';
import {writeAssetPackages} from './write-asset-packages.mjs';
const root=resolve('shared/animlib/fixtures/biological/nucleotide-anatomy'),sha=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
await mkdir(root,{recursive:true});
const ring=(n,c,r,z=0)=>Array.from({length:n},(_,i)=>[c[0]+r*Math.cos(i*2*Math.PI/n),c[1]+r*Math.sin(i*2*Math.PI/n),z]);
const sugar=ring(5,[.03,0],.16),phosphate=[[-.17,-.24,0],[-.23,-.3,.09],[-.11,-.31,-.08],[-.22,-.17,-.08]];
const mesh=g=>({vertices:g.vertices,triangles:g.triangles,normals:g.normals});
const recipes={};
for(const shape of ['purine','pyrimidine'])for(const context of [false,true]){const resolution=context?12:24,suffix=context?'-context':'';
 const base=ring(6,[.46,0],.19);if(shape==='purine')base.push(...ring(5,[.7,.035],.15));
 recipes[shape]={sugar,phosphate,base};
 const parts=Object.entries(recipes[shape]).map(([id,points])=>({id,...mesh(createMolecularEnvelope({positions:points.flat(),origin:[0,0,0],sigma:id==='base'?.105:.09,isoLevel:.65,resolution,smoothingIterations:4}))}));
 const id='schematic-nucleotide-'+shape+suffix;
 await writeAssetPackages({images:[],model:{id,kind:'model',version:1,units:'schematic local units; nominal anchor reach .675',parts,provenance:{source:'Original rounded sugar/phosphate/base scaffold in prepare-nucleotide-anatomy.mjs',sourceHash:sha(recipes[shape]),creator:'Original animlib biological proof',license:'CC0-1.0',preparedAt:'2026-10-11',converter:{name:'Gaussian schematic subunits',version:'1',options:{resolution}},selection:shape,modifications:['Rounded union of original pentagonal sugar, tetrahedral phosphate and one/two ring base scaffolds.'],fidelity:'Schematic anatomy and ring count only; no deposited coordinates, atom identity, chemical bond geometry or source pixels.'}},report:{recipe:recipes[shape]}},join(root,shape+suffix));
}
// Four original lobes surround a real visible channel; no deposited enzyme claim.
const lobes=[];for(let j=0;j<4;j++){const centerAngle=.3+j*1.45,points=[];for(let k=0;k<11;k++){const a=centerAngle+(k-5)*.07;points.push([2*Math.cos(a),1.65*Math.sin(a),-.8+.16*Math.cos(k*1.7+j)]);points.push([2.05*Math.cos(a),1.7*Math.sin(a),-.15+.12*Math.sin(k+j)]);}lobes.push(points);}
const parts=lobes.map((points,i)=>({id:'lobe-'+i,...mesh(createMolecularEnvelope({positions:points.flat(),origin:[0,0,0],sigma:.44,isoLevel:1.1,resolution:28,smoothingIterations:5}))}));
await writeAssetPackages({images:[],model:{id:'schematic-organic-machinery',kind:'model',version:1,units:'schematic local units',parts,provenance:{source:'Original four-lobe channel scaffold in prepare-nucleotide-anatomy.mjs',sourceHash:sha(lobes),creator:'Original animlib biological proof',license:'CC0-1.0',preparedAt:'2026-10-11',converter:{name:'Gaussian schematic lobes',version:'1',options:{resolution:28}},selection:'Four original subunit scaffolds',modifications:['Smooth Gaussian union within each subunit; central aperture retained.'],fidelity:'Original illustrative machinery, not deposited polymerase or recovered source geometry.'}},report:{lobes}},join(root,'machinery'));
await writeFile(join(root,'recipes.json'),JSON.stringify({recipes,lobes},null,2));
await writeFile(join(root,'README.md'),'# Original schematic nucleotide anatomy\n\nReproduce with `node shared/animlib/tools/prepare-nucleotide-anatomy.mjs`. All scaffolds are original CC0 geometry, with exact recipes and hashes in native asset manifests. Local x points from the persistent backbone anchor toward the base; y follows its returned tangent. Sugar/phosphate/base parts distinguish gross anatomy and one/two ring base classes, not exact chemistry or atomic coordinates. Four original organic machinery lobes preserve a visible aperture. No source pixels or deposited enzyme identity is used.\n');
console.log('Prepared original nucleotide and organic machinery assets');

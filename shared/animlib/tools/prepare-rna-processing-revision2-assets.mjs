import {createHash} from 'node:crypto';
import {resolve,join} from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
import {createMolecularEnvelope} from '../dist/molecular-envelope.js';
import {writeAssetPackages} from './write-asset-packages.mjs';
const root=resolve('shared/animlib/fixtures/biological/rna-processing-revision2');
const sha=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const provenance=(source,recipe)=>({source,sourceHash:sha(recipe),creator:'Original animlib RNA processing revision 2',license:'CC0-1.0',preparedAt:'2026-10-11',selection:'Complete original schematic geometry',converter:{name:'Original analytic and Gaussian geometry',version:'2',options:{}},modifications:['Original surfaces and cavities; no source pixels or recovered geometry.'],fidelity:'Illustrative cellular geometry; no deposited enzyme or exact biological dimensions claimed.'});
// Twenty-five square annular tiles meet at shared boundaries and contain actual lumens.
const parts=[],n=64,rings=8,half=.55,centers=[];
const height=(x,y)=>.12*Math.sin(x*.42)+.075*Math.cos(y*.53)+.025*Math.sin(x*.8+y*.6);
for(let cy=-2;cy<=2;cy++)for(let cx=-2;cx<=2;cx++){
 const ox=cx*12,oy=cy*12,inner=cx===0&&cy===0?1.3:.95;centers.push([ox,oy,inner]);
 const vertices=[],triangles=[],normals=[];
 for(const side of [-1,1])for(let j=0;j<=rings;j++)for(let i=0;i<n;i++){
  const a=i*2*Math.PI/n,c=Math.cos(a),s=Math.sin(a),outer=6/Math.max(Math.abs(c),Math.abs(s)),r=inner+(outer-inner)*j/rings,x=ox+r*c,y=oy+r*s;
  vertices.push([x,y,height(x,y)+side*half]);const dx=(height(x+.001,y)-height(x-.001,y))/.002,dy=(height(x,y+.001)-height(x,y-.001))/.002,l=Math.hypot(dx,dy,1);normals.push([-side*dx/l,-side*dy/l,side/l]);
 }
 const layer=(rings+1)*n;
 for(let side=0;side<2;side++)for(let j=0;j<rings;j++)for(let i=0;i<n;i++){const a=side*layer+j*n+i,b=side*layer+j*n+(i+1)%n,c=a+n,d=b+n;triangles.push(...(side?[[a,c,b],[b,c,d]]:[[a,b,c],[b,d,c]]));}
 // Duplicate wall vertices with radial normals; preserve the visible rounded rim.
 const wall=vertices.length;for(const side of [-1,1])for(let i=0;i<n;i++){const a=i*2*Math.PI/n,x=ox+inner*Math.cos(a),y=oy+inner*Math.sin(a);vertices.push([x,y,height(x,y)+side*half]);normals.push([-Math.cos(a),-Math.sin(a),0]);}
 for(let i=0;i<n;i++){const a=wall+i,b=wall+(i+1)%n,c=a+n,d=b+n;triangles.push([a,c,b],[b,c,d]);}
 parts.push({id:`tile-${cx+1}-${cy+1}`,vertices,triangles,normals});
}
await writeAssetPackages({images:[],model:{id:'schematic-cellular-membrane-r2',kind:'model',version:1,units:'schematic units',parts,provenance:provenance('Original nine-tile broad membrane in prepare-rna-processing-revision2-assets.mjs',{centers,n,rings,half})},report:{centers,extent:60,halfThickness:half}},join(root,'membrane'));
// A continuous asymmetric horseshoe with a real central cavity and bifurcated tips.
const scaffold=[];
for(let i=0;i<43;i++){const a=(-.18+i/42*1.68)*Math.PI,r=1.03+.10*Math.sin(3*a);for(const z of [-.26,.02,.28])scaffold.push([r*Math.cos(a),r*Math.sin(a),z+.09*Math.sin(4*a)]);}
for(const [x,y,z] of [[-.8,-.65,.2],[-1.25,-.15,.28],[-.7,.85,.4],[.2,1.12,.25],[.7,.82,-.2]])for(let i=0;i<7;i++)scaffold.push([x+.15*Math.cos(i),y+.17*Math.sin(i),z+.09*Math.sin(2*i)]);
const envelope=createMolecularEnvelope({positions:scaffold.flat(),origin:[0,0,0],sigma:.26,isoLevel:1.5,resolution:34,smoothingIterations:4});
await writeAssetPackages({images:[],model:{id:'schematic-splice-enzyme-r2',kind:'model',version:1,units:'schematic units',parts:[{id:'body',vertices:envelope.vertices,triangles:envelope.triangles,normals:envelope.normals}],provenance:provenance('Original asymmetric horseshoe scaffold in prepare-rna-processing-revision2-assets.mjs',scaffold)},report:{scaffold}},join(root,'enzyme'));
const context=createMolecularEnvelope({positions:scaffold.flat(),origin:[0,0,0],sigma:.26,isoLevel:1.5,resolution:12,smoothingIterations:3});
await writeAssetPackages({images:[],model:{id:'schematic-splice-enzyme-context-r2',kind:'model',version:1,units:'schematic units',parts:[{id:'body',vertices:context.vertices,triangles:context.triangles,normals:context.normals}],provenance:provenance('Original low-detail horseshoe for distant context in prepare-rna-processing-revision2-assets.mjs',{scaffold,resolution:12})},report:{scaffold}},join(root,'enzyme-context'));
const lobeScaffold=[];for(const z of [-.65,-.32,0,.32,.65])for(let i=0;i<6;i++)lobeScaffold.push([.14*Math.cos(i*Math.PI/3),.11*Math.sin(i*Math.PI/3),z+.035*Math.sin(i*2)]);
const lobe=createMolecularEnvelope({positions:lobeScaffold.flat(),origin:[0,0,0],sigma:.30,isoLevel:1.5,resolution:22,smoothingIterations:3});
await writeAssetPackages({images:[],model:{id:'schematic-pore-lobe-r2',kind:'model',version:1,units:'schematic units',parts:[{id:'body',vertices:lobe.vertices,triangles:lobe.triangles,normals:lobe.normals}],provenance:provenance('Original elongated connected pore scaffold in prepare-rna-processing-revision2-assets.mjs',lobeScaffold)},report:{lobeScaffold}},join(root,'pore-lobe'));
const distantLobe=createMolecularEnvelope({positions:lobeScaffold.flat(),origin:[0,0,0],sigma:.30,isoLevel:1.5,resolution:8,smoothingIterations:1});
await writeAssetPackages({images:[],model:{id:'schematic-pore-lobe-context-r2',kind:'model',version:1,units:'schematic units',parts:[{id:'body',vertices:distantLobe.vertices,triangles:distantLobe.triangles,normals:distantLobe.normals}],provenance:provenance('Original distant pore scaffold in prepare-rna-processing-revision2-assets.mjs',{lobeScaffold,resolution:8})},report:{lobeScaffold}},join(root,'pore-lobe-context'));
await mkdir(root,{recursive:true});await writeFile(join(root,'README.md'),'# Original RNA processing revision 2 assets\n\nReproduce with `node shared/animlib/tools/prepare-rna-processing-revision2-assets.mjs`. CC0 analytic broad 60-unit membrane with twenty-five genuine lumens, elongated connected pore lobes, and an asymmetric Gaussian horseshoe enzyme scaffold. Manifests retain recipe hashes, bounds and blob hashes. No source pixels, source meshes or deposited enzyme identity are used.\n');
console.log(root);

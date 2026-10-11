import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {writeAssetPackages} from './write-asset-packages.mjs';
// Original annular membrane: actual empty lumen, two faces and an inner wall.
const n=96,vertices=[],triangles=[],normals=[],radii=[1.15,1.8,2.6,3.6];
for(const side of [-1,1])for(const r of radii)for(let i=0;i<n;i++){const a=i*2*Math.PI/n;vertices.push([r*Math.cos(a),r*Math.sin(a),side*.2+.035*Math.sin(a*5)*(r-1.15)]);normals.push([0,0,side]);}
for(let s=0;s<2;s++)for(let r=0;r<3;r++)for(let i=0;i<n;i++){const a=s*4*n+r*n+i,b=s*4*n+r*n+(i+1)%n,c=a+n,d=b+n;triangles.push(...(s?[[a,b,c],[b,d,c]]:[[a,c,b],[b,c,d]]));}
for(const r of [0,3])for(let i=0;i<n;i++){const a=r*n+i,b=r*n+(i+1)%n,c=a+4*n,d=b+4*n;triangles.push(...(r?[[a,b,c],[b,d,c]]:[[a,c,b],[b,c,d]]));}
await writeAssetPackages({images:[],model:{id:'schematic-pore-membrane',kind:'model',version:1,units:'schematic local units',parts:[{id:'annulus',vertices,triangles,normals}],provenance:{source:'Original annulus in prepare-rna-processing-assets.mjs',sourceHash:createHash('sha256').update(JSON.stringify({vertices,triangles})).digest('hex'),creator:'Original animlib RNA processing proof',license:'CC0-1.0',preparedAt:'2026-10-11',selection:'Complete original annular patch',converter:{name:'Analytic annulus',version:'1',options:{angularSegments:n}},modifications:['Two faces, true empty central aperture and wall; slight original surface undulation.'],fidelity:'Schematic membrane patch, not recovered cell geometry or source pixels.'}},report:{innerRadius:1.15,outerRadius:3.6,halfThickness:.2}},resolve('shared/animlib/fixtures/biological/rna-processing'));

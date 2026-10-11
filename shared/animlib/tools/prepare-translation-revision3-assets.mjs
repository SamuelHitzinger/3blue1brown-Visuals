import {createHash} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createMolecularEnvelope} from '../dist/molecular-envelope.js';
import {writeAssetPackages} from './write-asset-packages.mjs';
const root=resolve('shared/animlib/fixtures/biological/translation-revision3');await mkdir(root,{recursive:true});
const shapes={};
// Original branched scaffold. Rounded side lobes and crossing depth folds replace a single bent tube.
shapes.adaptor={sigma:.1,resolution:40,isoLevel:.8,points:[]};
const paths=[[[0,.04,0],[-.12,.2,.02],[-.2,.4,.03],[-.29,.62,.01],[-.25,.83,0],[-.36,1.02,0],[-.5,1.24,0],[-.55,1.48,0],[-.3,1.61,0],[-.1,1.8,0],[0,2.1,0]],
 [[-.27,.65,.04],[.06,.79,.16],[.08,.97,.12],[-.18,1.07,.08]],
 [[-.48,1.08,0],[-.8,1.15,.1],[-.98,1.39,.02],[-.87,1.65,-.03],[-.55,1.69,.03]],
 [[-.59,1.26,.04],[-.65,1.43,.24],[-.33,1.5,.21],[-.1,1.59,.1]],
 [[-.13,.25,.04],[.08,.24,.13],[.19,.05,.09],[0,.04,0]]];
for(const path of paths)for(let i=1;i<path.length;i++)for(let k=0;k<3;k++)shapes.adaptor.points.push(path[i-1].map((v,j)=>v+(path[i][j]-v)*k/3));
shapes.back={sigma:.43,resolution:36,isoLevel:1.4,points:[]};
const lobes=[[-2.15,.25,-.6,.5],[-2.05,1.15,-.75,.65],[-1.55,2.3,-.9,.85],[-.75,3.1,-.85,.85],[.45,3.25,-.95,.9],[1.55,2.65,-.9,.8],[2.3,1.65,-.85,.62],[2.3,.2,-.45,.5],[.75,1.6,-1.3,.7],[-.55,1.6,-1.35,.7]];
for(const [x,y,z,r]of lobes)for(let j=0;j<11;j++){const a=j*2.399963;shapes.back.points.push([x+r*.55*Math.cos(a),y+r*.55*Math.sin(a),z+.3*Math.sin(a*1.7)]);}
shapes.small={sigma:.35,resolution:34,isoLevel:1,points:[]};
for(let i=0;i<=24;i++){const a=i*Math.PI/24;shapes.small.points.push([2.45*Math.cos(a),-.45-.56*Math.sin(a),-.15+.22*Math.sin(a*3)],[2.2*Math.cos(a),-.62-.4*Math.sin(a),.32]);}
// A half-annular field makes rounded inner/outer walls and rounded cut edges, with no planar U-channel.
shapes.tunnel={sigma:.105,resolution:36,isoLevel:1.05,points:[]};
for(let i=0;i<20;i++)for(let j=0;j<=14;j++){const u=i/19,a=Math.PI+Math.PI*j/14,r=.5+.035*Math.sin(u*5);shapes.tunnel.points.push([-.9+.1*u+r*Math.cos(a),2.05+1.2*u,-.05+r*Math.sin(a)]);}
const costs={};
for(const [name,p]of Object.entries(shapes)){
 const g=createMolecularEnvelope({positions:p.points.flat(),origin:[0,0,0],sigma:p.sigma,isoLevel:p.isoLevel,resolution:p.resolution,smoothingIterations:3,maxTriangles:20000});
 const id='translation-r3-'+name,report=await writeAssetPackages({images:[],model:{id,kind:'model',version:1,units:'arbitrary schematic units',parts:[{id:'surface',vertices:g.vertices,triangles:g.triangles,normals:g.normals}],provenance:{source:'Original branched/lobed scaffolds in prepare-translation-revision3-assets.mjs',sourceHash:createHash('sha256').update(JSON.stringify(p)).digest('hex'),creator:'Original animlib translation revision',license:'CC0-1.0',preparedAt:'2026-10-11',converter:{name:'Gaussian scaffold envelope',version:'3',options:{resolution:p.resolution,sigma:p.sigma,isoLevel:p.isoLevel}},selection:name,modifications:['Connected asymmetric depth lobes; original rounded half-conduit.'],fidelity:'Original explanatory sculpture, not a deposited structure or extracted reference geometry.'}},report:{...p,vertices:g.vertices.length,triangles:g.triangles.length}},join(root,name));costs[name]={...report.stats,vertices:g.vertices.length,triangles:g.triangles.length};
}
await writeFile(join(root,'README.md'),'# Translation revision 3 original assets\n\nNew IDs preserve the frozen earlier assets. Anticodon origin [0,0,0], cargo anchor [0,2.2,0]. Original branched adaptor, tall asymmetric posterior ribosome, lower subunit and rounded partial exit conduit. CC0-1.0. Reproduce with prepare-translation-revision3-assets.mjs. No reference pixels or deposited geometry.\n');console.log(costs);

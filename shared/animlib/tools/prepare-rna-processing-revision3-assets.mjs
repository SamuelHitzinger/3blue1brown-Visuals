import {createHash} from 'node:crypto';
import {resolve,join} from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
import {createAssetRegistry} from '../dist/asset-registry.js';
import {writeAssetPackages} from './write-asset-packages.mjs';
const root=resolve('shared/animlib/fixtures/biological/rna-processing-revision3');
const provenance={source:'Original analytic membrane, pore and baked illumination recipe in prepare-rna-processing-revision3-assets.mjs',sourceHash:createHash('sha256').update('rna-pore-r3-v1-42units-9lumens-contact-gradient').digest('hex'),creator:'animlib original biological assets',license:'CC0-1.0',preparedAt:'2026-10-11',selection:'Complete original illustrative geometry',converter:{name:'prepare-rna-processing-revision3-assets',version:'1',options:{}},modifications:['Original procedural color and soft contact shading; no source pixels or recovered geometry'],fidelity:'Illustrative baked contact/lumen illumination, not a physical shadow solver or deposited pore structure'};
const clamp=x=>Math.max(0,Math.min(255,Math.round(x))),size=2048,pixels=new Uint8Array(size*size*4),centers=[];
for(let y=-1;y<=1;y++)for(let x=-1;x<=1;x++)centers.push([x*14,y*14,x===0&&y===0]);
for(let j=0;j<size;j++)for(let i=0;i<size;i++){
 const x=(i/(size-1)-.5)*42,y=(j/(size-1)-.5)*42;
 const illumination=.12*Math.tanh((-x+y)*.10)+.08*Math.sin(x*.10+y*.08),noise=.0015*(Math.sin(x*8.3+y*5.7)+Math.sin(x*15.7-y*10.1));
 let contact=0,blue=0;
 for(const [cx,cy,main] of centers){const r=Math.hypot(x-cx,y-cy),s=main?1:.65;contact+=.48*Math.exp(-(((r-1.8*s)/(.63*s))**2))+.20*Math.exp(-(((x-cx-.7*s)/(2.1*s))**2+((y-cy+.45*s)/(1.7*s))**2));blue+=.10*Math.exp(-r*r/(18*s*s));}
 const value=Math.max(.20,1+illumination+noise-contact),at=(j*size+i)*4;
 pixels[at]=clamp(154*value-24*blue);pixels[at+1]=clamp(147*value-20*blue);pixels[at+2]=clamp(187*value+45*blue);pixels[at+3]=255;
}
const image={id:'rna-r3-membrane-illumination',kind:'image',version:1,width:size,height:size,storage:'rgba8',encoding:'srgb',origin:'top-left',alpha:'straight',colorPolicy:'source',pixels,provenance};
const registry=await createAssetRegistry([image],{colorPolicy:'source'}),texture={image:{id:image.id,hash:registry.catalog[0].hash},alphaMode:'opaque',filter:'linear',wrap:'clamp'};
const parts=[],n=64,rings=12,half=.35,height=(x,y)=>.10*Math.sin(x*.20)+.07*Math.cos(y*.23),uv=(x,y)=>[x/42+.5,y/42+.5];
for(const [ox,oy,main] of centers){
 const inner=main?1.3:.72,vertices=[],normals=[],triangles=[],uv0=[];
 for(const side of [-1,1])for(let j=0;j<=rings;j++)for(let i=0;i<n;i++){
  const a=i*2*Math.PI/n,c=Math.cos(a),s=Math.sin(a),outer=7/Math.max(Math.abs(c),Math.abs(s)),r=inner+(outer-inner)*j/rings,x=ox+r*c,y=oy+r*s;
  vertices.push([x,y,height(x,y)+side*half]);const dx=.020*Math.cos(x*.20),dy=-.0161*Math.sin(y*.23),l=Math.hypot(dx,dy,1);normals.push([-side*dx/l,-side*dy/l,side/l]);uv0.push(uv(x,y));
 }
 const layer=(rings+1)*n;for(let side=0;side<2;side++)for(let j=0;j<rings;j++)for(let i=0;i<n;i++){const a=side*layer+j*n+i,b=side*layer+j*n+(i+1)%n,c=a+n,d=b+n;triangles.push(...(side?[[a,c,b],[b,c,d]]:[[a,b,c],[b,d,c]]));}
 parts.push({id:`surface-${ox}-${oy}`,vertices,normals,triangles,uv0,imageTexture:texture});
 const wall={id:`lumen-${ox}-${oy}`,vertices:[],normals:[],triangles:[]};
 for(const side of [-1,1])for(let i=0;i<n;i++){const a=i*2*Math.PI/n,x=ox+inner*Math.cos(a),y=oy+inner*Math.sin(a);wall.vertices.push([x,y,height(x,y)+side*half]);wall.normals.push([-Math.cos(a),-Math.sin(a),0]);}
 for(let i=0;i<n;i++){const a=i,b=(i+1)%n,c=a+n,d=b+n;wall.triangles.push([a,c,b],[b,c,d]);}parts.push(wall);
}
await writeAssetPackages({images:[image],model:{id:'rna-r3-cellular-membrane',kind:'model',version:1,units:'schematic units',parts,provenance},report:{centers,extent:42,halfThickness:half,texture:'Original analytic color/contact field, no reference pixels'}},join(root,'membrane'));
// Smooth original lobes, slightly asymmetric; polar color field darkens inward
// faces and contact regions while leaving upper outward crowns warm.
const palettePixels=new Uint8Array(256*4);for(let i=0;i<256;i++){const u=i/255;for(let k=0;k<3;k++)palettePixels[i*4+k]=clamp([64,34,31][k]+([221,151,98][k]-[64,34,31][k])*u);palettePixels[i*4+3]=255;}
const lobeImage={...image,id:'rna-r3-pore-contact-colors',width:256,height:1,pixels:palettePixels};
const lr=await createAssetRegistry([lobeImage],{colorPolicy:'source'}),lt={...texture,image:{id:lobeImage.id,hash:lr.catalog[0].hash}};
const lobeParts=[];
for(const [id,nu,nv] of [['body',40,24],['context',20,12]]){
 const vertices=[],normals=[],uv0=[],triangles=[];
 for(let j=0;j<=nv;j++)for(let i=0;i<=nu;i++){
  const t=i/nu*2*Math.PI,p=j/nv*Math.PI,s=Math.sin(p),b=1+.035*Math.sin(3*t)*s*s;
  const x=.78*s*Math.cos(t)*b,y=.98*s*Math.sin(t)*b,z=1.04*Math.cos(p),v=[x,y,z];vertices.push(v);
  const normal=[x/(.78*.78),y/(.98*.98),z/(1.04*1.04)],l=Math.hypot(...normal);normals.push(normal.map(a=>a/l));
  const value=Math.max(.12,Math.min(1,.53+.34*Math.abs(z)/1.04+.22*x/.78));uv0.push([(value*255+.5)/256,.5]);
 }
 for(let j=0;j<nv;j++)for(let i=0;i<nu;i++){const a=j*(nu+1)+i,b=a+1,c=a+nu+1,d=c+1;if(j)triangles.push([a,c,b]);if(j<nv-1)triangles.push([b,c,d]);}
 lobeParts.push({id,vertices,normals,triangles,uv0,imageTexture:lt});
}
await writeAssetPackages({images:[lobeImage],model:{id:'rna-r3-pore-lobes',kind:'model',version:1,units:'schematic units',parts:lobeParts,provenance},report:{minimumMainLobeRadius:1.95-.81,contextScale:.58}},join(root,'pore'));
await mkdir(root,{recursive:true});await writeFile(join(root,'README.md'),'# Original pore revision 3\n\nCC0 analytic surfaces and procedural baked illumination. Nine actual membrane lumens; central clear radius1.3, half-thickness .35 with gently varying height. Main lobe inner radial extent exceeds1.14, preserving the declared1.05 aperture. Baked color fields illustrate static contact and lumen lighting; they are not real-time physical shadows. No source pixels or recovered meshes. Reproduce with the matching prepare tool.\n');
console.log(root);



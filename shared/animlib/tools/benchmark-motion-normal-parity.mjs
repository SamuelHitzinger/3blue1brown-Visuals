/** Compare current renderer against a saved pre-change dist/mesh-shading.js.
 * node tools/benchmark-motion-normal-parity.mjs <saved-module> [output.json]
 * Only this diagnostic process loads the prior implementation. */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {buildDrawItems} from '../dist/render-geometry.js';
import {paletteResolver} from '../dist/palette.js';
import {composeItems} from '../dist/composition.js';
assert(process.argv[2],'provide a saved pre-change dist/mesh-shading.js');
const dist=new URL('../dist/',import.meta.url),asModule=text=>'data:text/javascript;base64,'+Buffer.from(text).toString('base64');
const imports=(text,override)=>text.replace(/from (['"])([^'"]+)\1/g,(_,quote,path)=>`from ${quote}${override?.[path]??(path.startsWith('.')?new URL(path,dist).href:import.meta.resolve(path))}${quote}`);
const oldMesh=asModule(imports(await readFile(resolve(process.argv[2]),'utf8')));
const {buildDrawItems:before}=await import(asModule(imports(await readFile(new URL('render-geometry.js',dist),'utf8'),{'./mesh-shading.js':oldMesh})));
const base={kind:'mesh',vertices:[[0,0,0],[2,0,0],[0,2,0],[0,0,1]],triangles:[[0,1,2],[0,3,1],[2,1,0],[0,0,1]]};
const variants=[['unlit',{...base}],['flat',{...base,shading:'flat'}],['smooth-derived',{...base,shading:'smooth'}],
  ['smooth-authored',{...base,shading:'smooth',normals:[[0,3,4],[1,2,3],[0,2,1],[4,3,0]]}],
  ['smooth-fallback',{...base,shading:'smooth',normals:[[0,0,0],[0,0,0],[0,0,0]]}],
  ['smooth-invalid',{...base,shading:'smooth',normals:[[Infinity,0,0],[NaN,0,0],[0,0,0],[Number.MIN_VALUE,0,0]]}],
  ['smooth-tiny',{...base,shading:'smooth',vertices:base.vertices.map(p=>p.map(v=>v*1e-160))}],
  ['scalar',{...base,shading:'smooth',normals:[[0,3,4],[1,2,3],[0,2,1],[4,3,0]],scalarColors:{values:[0,.3,.7,1],domain:[0,1],colors:['BLUE','YELLOW']}}]];
const hash=(build,frame)=>{const sha=createHash('sha256');for(const item of composeItems(build(frame,frame.camera,1280,720,paletteResolver()),0).items){sha.update(Buffer.from(item.vertices.buffer,item.vertices.byteOffset,item.vertices.byteLength));sha.update(JSON.stringify({depth:item.depth,transparent:item.transparent,screen:item.screen,groups:item.groups}));}return sha.digest('hex');};
const checks=[];
for(const [name,geometry] of variants)for(const opacity of [1,.45])for(const yaw of [0,.6]){
  const camera={yaw,pitch:-.2,target:[0,0,0],height:8,distance:10,perspective:0};
  const element={id:'mesh',geometry,position:[.1,-.2,.3],rotation:[.3,.7,-.4],scale:.2,fill:'WHITE',stroke:'none',strokeWidth:0,opacity,persistent:false,space:'world'};
  const frame={elements:[element],camera,cameraAnimated:false},a=hash(before,frame),b=hash(buildDrawItems,frame);assert.equal(a,b,`${name}/${opacity}/${yaw}`);checks.push({name,opacity,yaw,sha256:b});
}
const result={result:'exact packed vertices, normals, colors, order and depth',checks};
if(process.argv[3])await writeFile(resolve(process.argv[3]),JSON.stringify(result,null,2));
console.log(JSON.stringify({result:result.result,cases:checks.length}));

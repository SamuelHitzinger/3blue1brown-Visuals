import {expect,it,vi} from 'vitest';
import {buildDrawItems} from '../src/render-geometry.js';
import {composeItems} from '../src/composition.js';
import {paletteResolver} from '../src/palette.js';
import type {ModelMaterial,ModelPrimitive} from '../src/models.js';
import type {ElementState,Vec3} from '../src/types.js';
const camera={yaw:0,pitch:0,target:[0,0,0] as Vec3,height:8,distance:10,perspective:1};
const material=():ModelMaterial=>({name:'chain',base:[1,1,1,1],emission:[0,0,0],metal:0,rough:.65,normalScale:1,occlusion:1,alpha:'OPAQUE',cutoff:.5,doubleSided:true,unlit:false,maps:[]});
it('batches equal imported materials without reordering transparent triangles or losing material metadata',()=>{
 const a=material(),b={...material(),name:'another chain'};
 const vertices=()=>new Float32Array(108);
 const items=[{depth:3,vertices:vertices(),transparent:true,screen:false,modelMaterial:a},{depth:2,vertices:vertices(),transparent:true,screen:false,modelMaterial:b},{depth:1,vertices:vertices(),transparent:true,screen:false,modelMaterial:a}];
 const result=composeItems(items,0);expect(result.items).toEqual(items);expect(result.commands).toHaveLength(1);expect(result.commands[0]).toMatchObject({first:0,count:9,opaque:false,modelMaterial:a});expect(b.name).toBe('another chain');
 b.rough=.5;expect(composeItems(items,0).commands).toHaveLength(3);
});
it('does not merge differing texture identities or sampler settings',()=>{
 const image={bytes:new Uint8Array([1]),width:1,height:1,mime:'image/png'};
 const texture={image,uv:0,offset:[0,0] as [number,number],scale:[1,1] as [number,number],rotation:0,wrapS:10497,wrapT:10497,nearest:false,minNearest:false};
 const a={...material(),maps:[texture]},b={...material(),maps:[{...texture}]};
 const items=[a,b].map((m,i)=>({depth:2-i,vertices:new Float32Array(108),transparent:true,screen:false,modelMaterial:m}));
 expect(composeItems(items,0).commands).toHaveLength(1);
 b.maps[0]={...texture,image:{...image}};expect(composeItems(items,0).commands).toHaveLength(2);
 b.maps[0]={...texture,uv:1};expect(composeItems(items,0).commands).toHaveLength(2);
 b.maps[0]={...texture,nearest:true};expect(composeItems(items,0).commands).toHaveLength(2);
});
it('reuses immutable imported mesh expansion during transparent camera frames',()=>{
 const vertices=[[0,0,0],[1,0,0],[0,1,0]] as Vec3[];
 const serialize=vi.fn(()=>[[0,0,0],[1,0,0],[0,1,0]]);Object.defineProperty(vertices,'toJSON',{value:serialize});
 const primitive:ModelPrimitive={geometry:{kind:'mesh',vertices,triangles:[[0,1,2]],normals:[[0,0,1],[0,0,1],[0,0,1]],shading:'smooth'},uv0:[],uv1:[],material:material(),colors:[[1,0,0,1],[0,1,0,1],[0,0,1,1]]};
 const element=():ElementState=>({id:'model',geometry:{...primitive.geometry,_model:primitive,_modelKey:'immutable/0'} as any,position:[0,0,0],rotation:[0,0,0],scale:1,fill:'WHITE',stroke:'none',strokeWidth:0,opacity:.2,persistent:false,space:'world'});
 const draw=(yaw:number)=>{const view={...camera,yaw};return buildDrawItems({elements:[element()],camera:view,cameraAnimated:false},view,800,600,paletteResolver());};
 const first=draw(0);serialize.mockClear();const next=draw(.5);
 expect(serialize).not.toHaveBeenCalled();expect(next[0].vertices).toEqual(first[0].vertices);
 expect(Array.from(next[0].vertices.slice(3,7))).toEqual([1,0,0,Math.fround(.2)]);
});

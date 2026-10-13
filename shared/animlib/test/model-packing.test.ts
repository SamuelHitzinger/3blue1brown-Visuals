import {expect,it} from 'vitest';
import {buildDrawItems} from '../src/render-geometry.js';
import {ModelPackingCache} from '../src/model-packing-cache.js';
import {RetainedGeometry} from '../src/retained-geometry.js';
import {paletteResolver} from '../src/palette.js';
import type {ModelPrimitive} from '../src/models.js';
import type {ElementState,Vec3} from '../src/types.js';
const camera={yaw:0,pitch:0,target:[0,0,0] as Vec3,height:8,distance:10,perspective:1};
function fixture() {
 const primitive:ModelPrimitive={geometry:{kind:'mesh',vertices:[[0,0,0],[1,0,0],[0,1,0],[0,0,2]],triangles:[[0,1,2],[0,2,3]],normals:[[0,0,1],[0,0,1],[0,0,1],[1,0,0]],shading:'smooth'},uv0:[],uv1:[],material:{name:'chain',base:[1,1,1,1],emission:[0,0,0],metal:0,rough:.65,normalScale:1,occlusion:1,alpha:'OPAQUE',cutoff:.5,doubleSided:true,unlit:false,maps:[]},colors:[[1,0,0,1],[0,1,0,1],[0,0,1,1],[1,1,1,1]]};
 const element:ElementState={id:'model',geometry:{...primitive.geometry,_model:primitive,_modelKey:'immutable/0'} as any,position:[0,0,0],rotation:[0,0,0],scale:1,fill:'WHITE',stroke:'none',strokeWidth:0,opacity:.2,persistent:false,space:'world'};
 const retained=new RetainedGeometry();
 const draw=(yaw=0,cache:RetainedGeometry|null=retained,elements=[element])=>{const view={...camera,yaw};cache?.beginFrame();const result=buildDrawItems({elements,camera:view,cameraAnimated:false},view,800,600,paletteResolver(),undefined,false,cache??undefined);cache?.endFrame();return result;};
 return {primitive,element,retained,draw};
}
it('reuses exact world-packed transparent model vertices while updating triangle depths for orbit',()=>{
 const {draw}=fixture();const first=draw(),orbit=draw(.7);
 expect(orbit).toHaveLength(2);expect(orbit[0].vertices.buffer).toBe(first[0].vertices.buffer);
 expect(orbit.map(i=>i.depth)).not.toEqual(first.map(i=>i.depth));
 expect(orbit.map(i=>Array.from(i.vertices))).toEqual(draw(.7,null).map(i=>Array.from(i.vertices)));
});
it('invalidates packed model vertices for live transform, opacity, tint, layer and viewport edits',()=>{
 const {element,draw,retained}=fixture();let previous=draw()[0].vertices.buffer;
 for(const edit of [()=>{element.position=[1e8+1,2,3];},()=>{element.rotation=[.2,.5,.1];},()=>{element.scale=-2;},()=>{element.opacity=.4;},()=>{element.fill='BLUE';},()=>{element.viewportOffset=[3,4];}]) {
  edit();const cached=draw(.3),fresh=buildDrawItems({elements:[element],camera,cameraAnimated:false},{...camera,yaw:.3},800,600,paletteResolver());
  expect(cached[0].vertices.buffer).not.toBe(previous);previous=cached[0].vertices.buffer;
  expect(cached).toEqual(fresh);
 }
 const other={...element,id:'other',opacity:0};const layered=draw(.3,retained,[other,element]);expect(layered[0].vertices[12]).toBe(1);
});
it('releases absent slots and cache on disposal; mutable authored meshes stay live',()=>{
 const {element,draw,retained}=fixture();const first=draw()[0].vertices.buffer;
 draw(0,retained,[]);expect(draw()[0].vertices.buffer).not.toBe(first);
 const second=draw()[0].vertices.buffer;retained.clear();expect(draw()[0].vertices.buffer).not.toBe(second);
 delete (element.geometry as any)._model;delete (element.geometry as any)._modelKey;
 const before=draw();element.geometry.vertices![0]=[4,5,6];const after=draw();expect(after[0].vertices[0]).toBe(4);expect(after[0].vertices.buffer).not.toBe(before[0].vertices.buffer);
});

it('keeps inherited transforms and isolated group opacity live without changing old samples',()=>{
 const {element,draw,retained}=fixture();
 const group:ElementState={...element,id:'group',opacity:.5,geometry:{kind:'group',children:[element.id]},position:[1,2,3],rotation:[.2,.1,0],scale:2};
 const first=draw(0,retained,[group,element]),snapshot=Array.from(first[0].vertices);
 group.position=[3,2,1];group.opacity=.7;
 const changed=draw(.4,retained,[group,element]),fresh=draw(.4,null,[group,element]);
 expect(changed).toEqual(fresh);expect(changed[0].vertices.buffer).not.toBe(first[0].vertices.buffer);
 expect(Array.from(first[0].vertices)).toEqual(snapshot);
 group.geometry.isolated=true;const isolated=draw(.4,retained,[group,element]);
 group.opacity=.3;const faded=draw(.4,retained,[group,element]);
 expect(faded[0].vertices.buffer).toBe(isolated[0].vertices.buffer);expect(faded[0].groups).toEqual([{id:'group',opacity:.3}]);
});
it('caps cached bytes and replaces one active slot instead of accumulating animated samples',()=>{
 const {primitive}=fixture(),cache=new ModelPackingCache(16);
 const value=()=>({vertices:new Float32Array(4),sumX:0,sumY:0,sumZ:0,retentionUnsafe:false});
 const first=value(),second=value();cache.beginFrame();cache.set('a',primitive,'first',first);
 cache.set('b',primitive,'first',second);expect(cache.get('b',primitive,'first')).toBeUndefined();
 expect(cache.get('a',primitive,'first')).toBe(first);
 cache.set('a',primitive,'second',second);expect(cache.get('a',primitive,'second')).toBe(second);
 expect(cache.get('a',{...primitive},'second')).toBeUndefined();
 cache.set('b',primitive,'first',first);expect(cache.get('b',primitive,'first')).toBe(first);
 cache.endFrame();cache.beginFrame();cache.endFrame();expect(cache.get('b',primitive,'first')).toBeUndefined();
});
it('refreshes resolved palette emission while unrelated fill colors stay unchanged',()=>{
 const {element,retained}=fixture();element.geometry.material={emissive:'RED',emissiveIntensity:2};
 const original=paletteResolver(),updated=paletteResolver({...original.palette,colors:{...original.palette.colors,RED:'#00ff00'}});
 const frame={elements:[element],camera,cameraAnimated:false};
 const draw=(palette:ReturnType<typeof paletteResolver>)=>{retained.beginFrame();const items=buildDrawItems(frame,camera,800,600,palette,undefined,false,retained);retained.endFrame();return items;};
 const first=draw(original),next=draw(updated),fresh=buildDrawItems(frame,camera,800,600,updated);
 expect(next).toEqual(fresh);expect(next[0].vertices.buffer).not.toBe(first[0].vertices.buffer);
});

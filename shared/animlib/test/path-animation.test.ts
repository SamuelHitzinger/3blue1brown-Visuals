import { describe, expect, it } from 'vitest';
import { compileSource, createSceneProgram } from '../src/compiler.js';
import { SourceCompiler } from '../src/compiler-client.js';
import { SceneSequence } from '../src/sequence.js';
import { withOfflineScene } from '../src/offline-sampling.js';
import { evaluateScene } from '../src/timeline.js';
import { pathContours } from '../src/path.js';
import { strokeContours } from '../src/path-stroke.js';
import { SpatialFrame } from '../src/spatial.js';
import { getWorldBounds } from '../src/bounds.js';
import { buildDrawItems } from '../src/render-geometry.js';
import { paletteResolver } from '../src/palette.js';
import { RetainedGeometry } from '../src/retained-geometry.js';
import { VERTEX_FLOATS } from '../src/texture-shader.js';

const source = `export default scene({},s=>{
 const k=s.slider('k',{reactive:true,default:1,min:0,max:3});
 const p=s.path('p',{points:[[0,0],[1,0],[1,3]],fill:'none',stroke:'WHITE'});
 s.bind(p,[k,s.time],(k,t)=>({points:[[0,0],[k,0],[k,3+t]],strokeEnd:t/4}));s.wait(4);
});`;
const contours = pathContours({kind:'path',points:[[0,0],[1,0],[1,3]]});

describe('retained path animation',()=>{
 it('clips unequal segments by length, with exact corners and coincident points',()=>{
   expect(strokeContours(contours,{strokeStart:.125,strokeEnd:.5})).toEqual([{closed:false,points:[[.5,0,0],[1,0,0],[1,1,0]]}]);
   expect(strokeContours(pathContours({kind:'path',points:[[0,0],[0,0],[4,0]]}),{strokeEnd:.5})[0].points).toEqual([[0,0,0],[2,0,0]]);
   expect(strokeContours(contours,{strokeStart:.5,strokeEnd:.5})).toEqual([]);
 });
 it('keeps dash phase continuous across corners and reveal boundaries',()=>{
   expect(strokeContours(contours,{dashArray:[2,1]})).toEqual([
    {closed:false,points:[[0,0,0],[1,0,0],[1,1,0]]}, {closed:false,points:[[1,2,0],[1,3,0]]}]);
   expect(strokeContours(contours,{dashArray:[2,1],strokeStart:.25})[0].points).toEqual([[1,0,0],[1,1,0]]);
   expect(strokeContours(contours,{dashArray:[1],dashOffset:1})[0].points).toEqual([[1,0,0],[1,1,0]]);
   expect(()=>strokeContours(contours,{dashArray:[1e-12,1e-12]})).toThrow(/limit/i);
 });
 it('joins painted dashes through the closing seam without artificial caps',()=>{
   const triangle=pathContours({kind:'path',points:[[0,0],[3,0],[3,4]],closed:true});
   expect(strokeContours(triangle,{dashArray:[100,1]})[0].closed).toBe(true);
   const fragments=strokeContours(triangle,{dashArray:[3,2],dashOffset:1});
   expect(fragments).toHaveLength(2);
   const seam=fragments.find(c=>c.points.some(p=>p.every(v=>v===0)))!;
   expect(seam.points[0]).not.toEqual([0,0,0]);expect(seam.points.at(-1)).not.toEqual([0,0,0]);
 });
 it('never draws jumps between SVG contours and preserves closed full strokes',()=>{
   const compound=pathContours({kind:'path',d:'M0 0L2 0 M10 0L12 0'});
   expect(strokeContours(compound,{strokeStart:.25,strokeEnd:.75})).toEqual([
    {closed:false,points:[[1,0,0],[2,0,0]]},{closed:false,points:[[10,0,0],[11,0,0]]}]);
   const closed=pathContours({kind:'path',d:'M0 0L2 0L2 2Z'});
   expect(strokeContours(closed,{})).toEqual(closed);
   expect(strokeContours(closed,{strokeEnd:.5})[0].closed).toBe(false);
   const smooth=pathContours({kind:'path',d:'M0 0C0 2 2 2 2 0'});
   expect(strokeContours(smooth,{strokeEnd:.5})[0].points.at(-1)![0]).toBeCloseTo(1);
   expect(strokeContours([{closed:true,points:[[0,0,0],[3,0,0],[3,4,0]]}],{strokeStart:7/12})[0].points).toEqual([[3,4,0],[0,0,0]]);
 });
 it('updates SourceCompiler and offline samples without mutating authored geometry',async()=>{
   const compiler=new SourceCompiler();
   try {
    const scene=await compiler.compile(source), initial=structuredClone(scene.lifecycle);
    const updates=await compiler.update(scene,{k:2},['k'],{},2);
    expect(JSON.parse(JSON.stringify(updates))[0].properties.points).toEqual([[0,0],[2,0],[2,5]]);
    expect(scene.lifecycle).toEqual(initial);
   } finally {compiler.dispose();}
   await withOfflineScene(source,{},s=>{
    const two=s.sample(2);expect(two.elements[0].geometry.points).toEqual([[0,0],[1,0],[1,5]]);
    expect(s.sample(4).elements[0].strokeEnd).toBe(1);
    expect(s.sample(0).elements[0].strokeEnd).toBe(0);
    expect(s.sample(2)).toEqual(two);
   });
 });
 it('seeks and changes retained controls with fresh bounds',async()=>{
   const sequence=new SceneSequence();
   try {
    expect((await sequence.submit({type:'load',scenes:[{id:'a',source}]})).ok).toBe(true);
    await sequence.setControl('a','k',2);
    const first=await sequence.evaluate(0,2);
    expect(first.elements[0].geometry.points).toEqual([[0,0],[2,0],[2,5]]);
    await sequence.evaluate(0,4);await sequence.evaluate(0,0);
    expect(await sequence.evaluate(0,2)).toEqual(first);
    const bounds=getWorldBounds(first,'p');expect(bounds).not.toBeNull();
    const larger=await sequence.evaluate(0,4);expect(getWorldBounds(larger,'p')!.max[1]).toBeGreaterThan(bounds!.max[1]);
   } finally {sequence.dispose();}
 });
 it.each([
  ["s.path('p',{d:'M0 0L1 0'})",'[[0,0],[1,1]]'],
  ["s.circle('p')",'[[0,0],[1,1]]'],
  ["s.line('p')",'[[0,0],[1,1],[2,2]]'],
  ["s.line('p')",'[[0,0],[Infinity,1]]'],
 ])('rejects unsupported point binding: %s',async(target,points)=>{
   await expect(compileSource(`export default scene({},s=>{const p=${target};s.bind(p,[s.time],()=>({points:${points}}));s.wait(1);});`)).rejects.toThrow();
 });
 it('rejects topology changes after compilation',async()=>{
   const p=await createSceneProgram(`export default scene({},s=>{const p=s.line('p');s.bind(p,[s.time],t=>({points:t?[[0,0],[1,1],[2,2]]:[[0,0],[1,1]]}));s.wait(1);});`);
   try {expect(()=>p.update({},[],1)).toThrow(/count|topology/);}finally{p.dispose();}
 });
 it('rebuilds ordinary controls and rejects connected or morph-owned points',async()=>{
   const ordinary=`export default scene({},s=>{const k=s.slider('k',{default:1,min:0,max:3});s.line('p',{points:[[0,0],[k,1]]});});`;
   const a=await compileSource(ordinary),b=await compileSource(ordinary,{controls:{k:2}});
   expect(evaluateScene(a,0).elements[0].geometry.points).toEqual([[0,0],[1,1]]);
   expect(evaluateScene(b,0).elements[0].geometry.points).toEqual([[0,0],[2,1]]);
   for(const operation of ["s.connect(p,s.circle('a'),s.circle('b',{position:[2,0]}));", "s.play(p.morphTo({kind:'line',points:[[0,0],[2,0]]}),{duration:1});"])
    await expect(compileSource(`export default scene({},s=>{const p=s.line('p');s.bind(p,[s.time],()=>({points:[[0,0],[1,1]]}));${operation}});`)).rejects.toThrow(/conflict|own/);
 });
 it('places arrowheads at the visible tip and invalidates retained stroke geometry',async()=>{
   const scene=await compileSource(`export default scene({},s=>{const p=s.arrow('p',{points:[[0,0],[4,0]],strokeEnd:.5});s.play(p.animate({strokeEnd:1}),{duration:1,ease:'linear'});});`);
   const cache=new RetainedGeometry();
   const sampled=[0,1,0,.3].map(t=>evaluateScene(scene,t));
   for(const [i,frame] of sampled.entries()) {
    const expectedEnd=[2,4,2,2.6][i];expect(getWorldBounds(frame,'p')!.max[0]).toBeCloseTo(expectedEnd);
    cache.beginFrame();const cached=buildDrawItems(frame,frame.camera,640,360,paletteResolver(),undefined,false,cache);cache.endFrame();
    const reference=buildDrawItems(frame,frame.camera,640,360,paletteResolver());
    const vertexCount=(items:typeof cached)=>items.reduce((n,item)=>n+(item.mesh?item.mesh.indices.length:item.vertices.length/VERTEX_FLOATS),0);
    expect(vertexCount(cached)).toBe(vertexCount(reference));
    const positions=cached.flatMap(item=>item.mesh?Array.from(item.mesh.vertices).filter((_,i)=>i%VERTEX_FLOATS===0):Array.from(item.vertices).filter((_,i)=>i%VERTEX_FLOATS===0));
    expect(Math.max(...positions)).toBeCloseTo(expectedEnd);
   }
 });
 it('animates range and dash phase with deterministic random seeks and preserves fill',async()=>{
   const scene=await compileSource(`export default scene({},s=>{const p=s.path('p',{points:[[0,0],[3,0],[3,3]],closed:true,fill:'BLUE',stroke:'WHITE',strokeEnd:0,dashArray:[.5,.2]});s.play(p.animate({strokeEnd:1,dashOffset:2}),{duration:4,ease:'linear'});});`);
   for(const t of [3,.1,4,0,1.2]) {
    const frame=evaluateScene(scene,t),e=frame.elements[0];expect(e.strokeEnd).toBeCloseTo(t/4);expect(e.dashOffset).toBeCloseTo(t/2);
    const items=buildDrawItems(frame,frame.camera,640,360,paletteResolver());
    expect(items.filter(x=>x.component==='fill').length).toBeGreaterThan(0);
    if(t===0)expect(items.filter(x=>x.component==='stroke')).toHaveLength(0);
   }
 });
 it.each([{strokeEnd:1.1},{strokeStart:-.1},{dashArray:[]},{dashArray:[0,1]},{dashOffset:Infinity}])('validates stroke controls %j',async(style)=>{
   // JSON cannot preserve infinity; emit its expression explicitly.
   const props=JSON.stringify(style).replace('null','Infinity');
   await expect(compileSource(`export default scene({},s=>s.line('p',${props}));`)).rejects.toThrow();
 });
 it('attaches to connected transformed midpoint in the target parent coordinates',async()=>{
   const scene=await compileSource(`export default scene({},s=>{
    const a=s.circle('a',{position:[1,2],radius:.2}),b=s.circle('b',{position:[5,2],radius:.2});
    const edge=s.line('edge',{position:[2,1],rotation:.4,scale:2});
    s.group('eg',[edge],{position:[1,-3],rotation:.5,scale:1.3});s.connect(edge,a,b,{endpoints:'surface'});
    const label=s.text('label',{text:'w'});s.group('lg',[label],{position:[-1,1],rotation:-.8,scale:2});
    s.attach(label,edge,{anchor:'midpoint',offset:[0,.18]});s.play(b.moveTo([7,4]),{duration:2,ease:'linear'});
   });`);
   for(const time of [0,1,2,.3]) {
    const f=evaluateScene(scene,time),sp=new SpatialFrame(f),edge=f.elements.find(e=>e.id==='edge')!;
    const ends=edge.geometry.points!.map(p=>sp.world('edge',[p[0],p[1],p[2]??0]));
    const p=sp.world('label');expect(p[0]).toBeCloseTo((ends[0][0]+ends[1][0])/2);expect(p[1]).toBeCloseTo((ends[0][1]+ends[1][1])/2+.18);
   }
 });
});

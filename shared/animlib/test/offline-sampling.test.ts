import { afterEach, describe, expect, it, vi } from 'vitest';
import { getQuickJS } from 'quickjs-emscripten';
import { compileSource } from '../src/compiler.js';
import { evaluateScene } from '../src/timeline.js';
import { withOfflineScene, type OfflineSceneSampler } from '../src/offline-sampling.js';

const moving = `export default scene({},s=>{
 const speed=s.slider('speed',{reactive:true,default:1,min:0,max:3});
 const p=s.circle('p',{radius:0.25});
 s.bind(p,[s.time,speed],(t,v)=>({position:[t*v,0,0]}));
 s.keep(p);s.wait(2);
});`;
afterEach(()=>vi.restoreAllMocks());

describe('offline absolute-time sampling',()=>{
 it('samples retained motion at setup, midpoint, and endpoint without recompiling',async()=>{
  const quickjs=await getQuickJS(), contexts=vi.spyOn(quickjs,'newContext');
  await withOfflineScene(moving,{},sampler=>{
   expect([0,1,2].map(t=>sampler.sample(t).elements[0].position[0])).toEqual([0,1,2]);
   expect(contexts).toHaveBeenCalledTimes(1);
  });
 });
 it('seeks backward and nonmonotonically without changing canonical or earlier samples',async()=>{
  await withOfflineScene(moving,{},sampler=>{
   const original=structuredClone(sampler.scene), middle=sampler.sample(1);
   expect([2,0,1.5,0.25,1].map(t=>sampler.sample(t).elements[0].position[0])).toEqual([2,0,1.5,0.25,1]);
   expect(sampler.sample(1)).toEqual(middle);
   expect(sampler.scene).toEqual(original);
   expect(middle.elements[0].position[0]).toBe(1);
  });
 });
 it('defaults the exported handoff to actual endpoint even after an earlier sample',async()=>{
  const previous=await withOfflineScene(moving,{},sampler=>{sampler.sample(0.5);return sampler.sample();});
  await withOfflineScene(`export default scene({},s=>{s.previous.get('p');s.wait(1);});`,{previous},sampler=>{
   expect(sampler.sample(0).elements[0].position).toEqual([2,0,0]);
  });
 });
 it('preserves static timeline and supplied retained controls, and clamps finite times',async()=>{
  const source=`export default scene({},s=>{const p=s.circle('p');s.play(p.moveTo([2,0,0]),{duration:2});s.keep(p);});`;
  const expected=await compileSource(source);
  await withOfflineScene(source,{},sampler=>{
   for(const time of [0,0.5,2]) expect(sampler.sample(time)).toEqual(evaluateScene(expected,time));
  });
  await withOfflineScene(moving,{controls:{speed:2}},sampler=>{
   expect([-1,1,9].map(t=>sampler.sample(t).elements[0].position[0])).toEqual([0,2,4]);
  });
 });
 it('samples vertex deformations using absolute time',async()=>{
  const source=`export default scene({mode:'3d'},s=>{const m=s.mesh('m',{vertices:[[0,0,0],[1,0,0],[0,1,0]],triangles:[[0,1,2]]});s.deform(m,[s.time],([x,y,z],i,t)=>[x,y,z+t*y]);s.wait(2);});`;
  await withOfflineScene(source,{},sampler=>{
   expect([0,1,2,0].map(t=>sampler.sample(t).elements[0].geometry.vertices![2][2])).toEqual([0,1,2,0]);
  });
 });
 it('releases the real QuickJS runtime on success, callback failure, and sampling failure',async()=>{
  const quickjs=await getQuickJS(), contexts=vi.spyOn(quickjs,'newContext');
  let escaped:OfflineSceneSampler|undefined;
  await withOfflineScene(moving,{},sampler=>{escaped=sampler;});
  expect(()=>escaped!.sample(1)).toThrow('disposed');
  await expect(withOfflineScene(moving,{},()=>{throw Error('render failed');})).rejects.toThrow('render failed');
  await expect(withOfflineScene(moving,{},sampler=>sampler.sample(NaN))).rejects.toThrow('finite');
  await expect(withOfflineScene(moving.replace('position:[t*v,0,0]','position:[t===1?Infinity:t*v,0,0]'),{},sampler=>sampler.sample(1))).rejects.toThrow();
  await expect(withOfflineScene('export default scene({},s=>{throw Error("build failed");});',{},()=>{})).rejects.toThrow('build failed');
  expect(contexts).toHaveBeenCalledTimes(5);
  for(const result of contexts.mock.results) {
   const context=result.value;
   expect(context.alive).toBe(false);
   expect(context.runtime.alive).toBe(false);
  }
 });
});

import {describe,it,expect} from 'vitest';
import {readFile} from 'node:fs/promises';
import {createScientificStateBuilders} from '../src/scientific-state.js';
import {withOfflineScene} from '../src/offline-sampling.js';
import {rotate} from '../src/geometry.js';
const science=createScientificStateBuilders();
const provenance={kind:'illustrative' as const,description:'Authored rigid movement'};
const base={pivot:[1,2,3] as [number,number,number],provenance,keyframes:[{time:0,translation:[0,0,0] as [number,number,number],rotation:[0,0,0] as [number,number,number]},{time:2,translation:[2,0,0] as [number,number,number],rotation:[Math.PI/2,Math.PI/2,Math.PI/2] as [number,number,number]}]};
describe('rigid motion',()=>{
 it('matches X then Y then Z rotation around an explicit pivot',()=>{
  const motion=science.rigidMotion(base);
  const point=motion.transformPoint([2,2,3],2);
  expect(point[0]).toBeCloseTo(3,12);expect(point[1]).toBeCloseTo(2,12);expect(point[2]).toBeCloseTo(2,12);
  expect(motion.transformPoint(base.pivot,2)).toEqual([3,2,3]);
  motion.at(2).position.forEach((v,i)=>expect(v).toBeCloseTo([0,0,4][i],12));
 });
 it('preserves distances, clamps, interpolates explicit Euler angles and seeks independently',()=>{
  const motion=science.rigidMotion(base),a=[-2,4,1] as const,b=[5,-1,3] as const;
  for(const t of [1.3,0,2,.1,1.7,-5,5,1.3]){
   const p=motion.transformPoint(a,t),q=motion.transformPoint(b,t);
   expect(Math.hypot(...p.map((v,i)=>v-q[i]))).toBeCloseTo(Math.hypot(...a.map((v,i)=>v-b[i])),12);
  }
  expect(motion.at(-5)).toEqual(motion.at(0));expect(motion.at(5)).toEqual(motion.at(2));
  expect(motion.at(1).rotation).toEqual([Math.PI/4,Math.PI/4,Math.PI/4]);
  const smooth=science.rigidMotion({...base,interpolation:'smooth'});
  expect(smooth.at(.5).rotation[0]).toBeCloseTo(Math.PI/2*.15625,14);
 });
 it('copies inputs and returns isolated poses',()=>{
  const options=structuredClone(base),motion=science.rigidMotion(options),expected=motion.at(.7);
  options.pivot[0]=99;options.keyframes[0].rotation[0]=99;options.keyframes[1].translation[0]=99;
  const pose=motion.at(.7);pose.position[0]=99;pose.rotation[0]=99;
  motion.at(2);expect(motion.at(.7)).toEqual(expected);
 });
 it('matches renderer rotation at seeded arbitrary seeks without accumulating state',()=>{
  const motion=science.rigidMotion(base),point:[number,number,number]=[4,-2,7];
  let seed=173;
  for(let i=0;i<100;i++){
   seed=(seed*1664525+1013904223)>>>0;
   const t=seed/4294967296*4-1,pose=motion.at(t),expected=rotate(point,pose.rotation).map((v,j)=>v+pose.position[j]);
   expect(motion.transformPoint(point,t)).toEqual(expected);
   motion.at(2-t);expect(motion.at(t)).toEqual(pose);
  }
 });
 it('rejects invalid bounded inputs and provenance',()=>{
  for(const change of [{pivot:[NaN,0,0]},{pivot:[0,0]},{pivot:[0,,0]},{keyframes:[]},{keyframes:Array(257).fill(base.keyframes[0])},{keyframes:[base.keyframes[1],base.keyframes[0]]},{keyframes:[base.keyframes[0],base.keyframes[0]]},{keyframes:[{...base.keyframes[0],translation:[1e7,0,0]}]},{interpolation:'invented'},{provenance:{kind:'supplied',description:'Measured'}},{provenance:{kind:'illustrative',description:''}}])expect(()=>science.rigidMotion({...base,...change} as never)).toThrow();
  const motion=science.rigidMotion(base);expect(()=>motion.at(Infinity)).toThrow();expect(()=>motion.transformPoint([0,NaN,0],0)).toThrow();
 });
 it('compiles and executes in the actual scene VM with repeatable seeks',async()=>{
  const source=await readFile(new URL('../catalog/recipes/rigid-motion.js',import.meta.url),'utf8');
  await withOfflineScene(source,{},sampler=>{
   const expected=sampler.sample(.7);sampler.sample(2);sampler.sample(0);
   expect(sampler.sample(.7)).toEqual(expected);expect(expected.elements.length).toBeGreaterThan(2);
  });
 });
});

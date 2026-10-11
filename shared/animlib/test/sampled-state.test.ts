import { describe,it,expect } from 'vitest';
import { createSampledState } from '../src/diagrams/sampled-state.js';

const projection=[[1,0],[0,2],[1,-1]];
describe('sampled state correspondence',()=>{
 it('rejects sparse time arrays and preserves isolated samples beside gaps',()=>{
  expect(()=>createSampledState({times:[0,,2] as number[],values:[[1,2],[2,3],[3,4]],projection})).toThrow();
  const state=createSampledState({times:[0,1,2],values:[[2,4],null,[6,8]],projection});
  expect(state.segments).toEqual([{start:0,end:0,count:2},{start:2,end:2,count:2}]);
  expect(state.prefix(0,1)).toEqual([[2,8,-2],[2,8,-2]]);
  expect(state.at(0)).toEqual({values:[2,4],position:[2,8,-2]});
  expect(state.at(2)).toEqual({values:[6,8],position:[6,16,-2]});
 });
 it('interpolates the same vector before projection, including exact endpoints',()=>{
  const state=createSampledState({times:[0,2,4],values:[[2,4],[6,8],[10,2]],projection});
  expect(state.at(1)).toEqual({values:[4,6],position:[4,12,-2]});
  expect(state.at(2)).toEqual({values:[6,8],position:[6,16,-2]});
  expect(state.at(4)).toEqual({values:[10,2],position:[10,4,8]});
  expect(state.at(-1)).toBeNull();expect(state.at(5)).toBeNull();
  expect(state.prefix(0,1)).toEqual([[2,8,-2],[4,12,-2],[4,12,-2]]);
  expect(state.prefix(0,4)).toEqual([[2,8,-2],[6,16,-2],[10,4,8]]);
 });
 it('splits missing intervals rather than drawing a false trajectory through them',()=>{
  const state=createSampledState({times:[0,1,2,3,4],values:[[2,4],[6,8],null,[10,2],[12,4]],projection});
  expect(state.segments).toEqual([{start:0,end:1,count:2},{start:3,end:4,count:2}]);
  expect(state.at(1)).toEqual({values:[6,8],position:[6,16,-2]});
  for(const t of[1.1,2,2.9])expect(state.at(t)).toBeNull();
  expect(state.prefix(0,2)).toEqual([[2,8,-2],[6,16,-2]]);
  expect(state.prefix(1,2)).toEqual([[10,4,8],[10,4,8]]);
  expect(state.prefix(1,3.5)).toEqual([[10,4,8],[11,6,8]]);
 });
 it('captures inputs and returns fresh samples and prefixes under arbitrary seeking',()=>{
  const times=[0,2],values=[[2,4],[6,8]],matrix=projection.map(r=>[...r]);
  const state=createSampledState({times,values,projection:matrix});
  times[0]=99;values[0][0]=99;matrix[0][0]=99;
  const sample=state.at(1)!;sample.values[0]=99;sample.position[0]=99;
  state.prefix(0,1)[0][0]=99;
  expect(state.at(1)).toEqual({values:[4,6],position:[4,12,-2]});
  const a=state.prefix(0,1);state.prefix(0,2);state.prefix(0,0);expect(state.prefix(0,1)).toEqual(a);
 });
 it('rejects nonfinite, malformed, unordered and overbudget input before producing geometry',()=>{
  for(const props of [
   {times:[0,0],values:[[1,2],[3,4]],projection},
   {times:[0,1],values:[[1,2],[3]],projection},
   {times:[0,1],values:[[1,2],[3,Infinity]],projection},
   {times:[0,1],values:[[1,2],[3,4]],projection:[[1,0],[0,1]]},
   {times:[0,1],values:[[1,2],[3,4]],projection:[[1,0],[0,1],[NaN,0]]},
   {times:Array.from({length:10001},(_,i)=>i),values:Array.from({length:10001},()=>[1,2]),projection},
  ])expect(()=>createSampledState(props)).toThrow();
  const state=createSampledState({times:[0,1],values:[[1,2],[3,4]],projection});
  expect(()=>state.at(NaN)).toThrow();expect(()=>state.prefix(2,1)).toThrow();
 });
});

import {describe,it,expect} from 'vitest';
import {readFile} from 'node:fs/promises';
import {createScientificStateBuilders} from '../src/scientific-state.js';
import {withOfflineScene} from '../src/offline-sampling.js';

const science=createScientificStateBuilders();

describe('bounded scientific states',()=>{
 it('derives coupled-oscillator displacements and velocities from the same exact modes',()=>{
  const coupled=science.modalState({modes:[
   {shape:[1,1],amplitude:.5,angularFrequency:1},
   {shape:[1,-1],amplitude:.5,angularFrequency:Math.sqrt(3)},
  ]});
  expect(coupled.at(0).displacement).toEqual([1,0]);
  for(const time of[0,.3,1,2.4,6,2.4]){
   const {displacement:q,velocity:v,contributions}=coupled.at(time);
   const energy=.5*(v[0]**2+v[1]**2+q[0]**2+q[1]**2+(q[0]-q[1])**2);
   expect(energy).toBeCloseTo(1,12);
   for(let i=0;i<2;i++){
    expect(q[i]).toBeCloseTo(contributions[0][i]+contributions[1][i],14);
    const derivative=(coupled.at(time+1e-5).displacement[i]-coupled.at(time-1e-5).displacement[i])/2e-5;
    expect(v[i]).toBeCloseTo(derivative,8);
   }
  }
 });
 it('captures modal inputs and returns isolated states under arbitrary seeking',()=>{
  const shape=[1,2],equilibrium=[3,4],modes=[{shape,amplitude:2,angularFrequency:1,phase:.2}];
  const state=science.modalState({modes,equilibrium}),expected=state.at(.6);
  shape[0]=99;equilibrium[0]=99;modes[0].amplitude=99;
  const changed=state.at(.6);changed.displacement[0]=99;changed.velocity[0]=99;changed.contributions[0][0]=99;
  state.at(9);state.at(-3);expect(state.at(.6)).toEqual(expected);
 });
 it('preserves the proof energy and keeps equilibrium separate from displacement',()=>{
  const state=science.modalState({equilibrium:[-2,2],modes:[
   {shape:[1,1],amplitude:.4,angularFrequency:1},
   {shape:[1,-1],amplitude:.4,angularFrequency:2},
  ]});
  for(const time of[0,.17,1,2.7,5,8]){
   const {displacement:q,velocity:v,position}=state.at(time);
   expect(.5*(v[0]**2+v[1]**2)+.5*(q[0]**2+q[1]**2)+.75*(q[1]-q[0])**2).toBeCloseTo(.8,12);
   expect(position).toEqual([q[0]-2,q[1]+2]);
  }
  expect(state.at(0).displacement).toEqual([.8,0]);
 });
 it('precomputes simultaneous conservative transfers and exposes the exact edge amounts',()=>{
  const flow=science.conservativeTransport({initial:[100,0,0],transfers:[
   {id:'ab',from:0,to:1,fraction:.2},{id:'ac',from:0,to:2,fraction:.1},
   {id:'ba',from:1,to:0,fraction:.5},
  ],steps:20});
  expect(flow.at(0).flows.map(e=>e.amount)).toEqual([20,10,0]);
  expect(flow.at(1).values).toEqual([70,20,10]);
  expect(flow.at(2).values).toEqual([59,24,17]);
  for(let step=0;step<20;step++){
   const before=flow.at(step),after=flow.at(step+1),delta=[0,0,0];
   for(const edge of before.flows){delta[edge.from]-=edge.amount;delta[edge.to]+=edge.amount;}
   expect(before.values.reduce((a,b)=>a+b)).toBeCloseTo(100,10);
   expect(before.values.every(v=>v>=0)).toBe(true);
   for(let i=0;i<3;i++)expect(after.values[i]).toBeCloseTo(before.values[i]+delta[i],12);
  }
  expect(flow.at(20).flows).toEqual([]);
  const expected=flow.at(3);flow.at(20);flow.at(0);expect(flow.at(3)).toEqual(expected);
 });
 it('protects prepared transport from mutated input and returned snapshots',()=>{
  const initial=[10,0],transfers=[{id:'a',from:0,to:1,fraction:.25}];
  const flow=science.conservativeTransport({initial,transfers,steps:2});
  initial[0]=999;transfers[0].fraction=1;
  const result=flow.at(0);result.values[0]=999;result.flows[0].amount=999;
  expect(flow.at(1).values).toEqual([7.5,2.5]);
  expect(flow.at(0).flows[0].amount).toBe(2.5);
  expect(()=>flow.at(.5)).toThrow();expect(()=>flow.at(3)).toThrow();
 });
 it('adds complex amplitudes before squaring and preserves global phase invariance',()=>{
  const pair=(phase:number)=>science.complexInterference({waves:[
   {amplitude:[1,0],phase},{amplitude:[1,0],phase},
  ]}).at(.7);
  expect(pair(0).intensity).toBe(4);
  expect(pair(.731).intensity).toBeCloseTo(4,12);
  const dark=science.complexInterference({waves:[{amplitude:[1,0]},{amplitude:[1,0],phase:Math.PI}]}).at(0);
  expect(dark.intensity).toBeLessThan(1e-28);
  const rotating=science.complexInterference({waves:[{amplitude:[1,0],angularFrequency:2,waveVector:[3,0,0]}]});
  const state=rotating.at(.5,[.2,0,0]);
  expect(state.amplitude[0]).toBeCloseTo(Math.cos(-.4),14);
  expect(state.amplitude[1]).toBeCloseTo(Math.sin(-.4),14);
  expect(state.intensity).toBeCloseTo(1,14);
 });
 it('copies wave definitions and returns fresh complex arrays',()=>{
  const amplitude:[number,number]=[1,2],waveVector:[number,number,number]=[1,0,0];
  const waves=[{amplitude,waveVector,phase:.2}],state=science.complexInterference({waves});
  const expected=state.at(.3,[1,0,0]);amplitude[0]=99;waveVector[0]=99;waves[0].phase=99;
  const result=state.at(.3,[1,0,0]);result.amplitude[0]=99;result.components[0][0]=99;
  expect(state.at(.3,[1,0,0])).toEqual(expected);
 });
 it('uses normalized Gaussian kernels and explicit sample times for event rates',()=>{
  const times=Array.from({length:1001},(_,i)=>-5+i*.01);
  const events=[[0],[-1,1]],rates=science.eventRates({times,events,bandwidth:1});
  expect(rates.values[500][0]).toBeCloseTo(1/Math.sqrt(2*Math.PI),14);
  for(let i=0;i<1001;i++)expect(rates.values[i][0]).toBeCloseTo(rates.values[1000-i][0],12);
  let mass=0;for(let i=1;i<times.length;i++)mass+=(rates.values[i-1][0]+rates.values[i][0])*.005;
  expect(mass).toBeCloseTo(1,5);
  expect(rates.values[500][1]).toBeCloseTo(2*Math.exp(-.5)/Math.sqrt(2*Math.PI),14);
  times[0]=99;events[0][0]=99;expect(rates.times[0]).toBe(-5);
 });
 it('allows silent channels without inventing events',()=>{
  expect(science.eventRates({events:[[],[0]],times:[0,1],bandwidth:.2}).values.map(v=>v[0])).toEqual([0,0]);
 });
 it('rejects invalid and over-budget inputs before expensive work',()=>{
  for(const modes of[[],[{shape:[1],amplitude:1,angularFrequency:-1}],Array(33).fill({shape:[1],amplitude:1,angularFrequency:1}),[{shape:[1,NaN],amplitude:1,angularFrequency:1}],[{shape:[1],amplitude:1e6,angularFrequency:2}]]){
   expect(()=>science.modalState({modes})).toThrow();
  }
  expect(()=>science.modalState({modes:[{shape:[1],amplitude:1,angularFrequency:1}],equilibrium:[1,2]})).toThrow();
  for(const props of[
   {initial:[-1,2],transfers:[]},
   {initial:[1,0],transfers:[{id:'x',from:0,to:1,fraction:1.01}]},
   {initial:[1,0],transfers:[{id:'x',from:0,to:1,fraction:.6},{id:'y',from:0,to:1,fraction:.5}]},
   {initial:[1,0],transfers:[{id:'x',from:0,to:1,fraction:.2},{id:'x',from:1,to:0,fraction:.2}]},
   {initial:[1,0],transfers:[],steps:257},
  ])expect(()=>science.conservativeTransport(props)).toThrow();
  for(const waves of[[],[{amplitude:[Infinity,0]}],Array(65).fill({amplitude:[1,0]}),[{amplitude:[1001,0]}]])expect(()=>science.complexInterference({waves} as never)).toThrow();
  for(const props of[
   {events:[[0]],times:[0,0],bandwidth:1},
   {events:[[0]],times:[0],bandwidth:0},
   {events:[[NaN]],times:[0],bandwidth:1},
   {events:[Array(10001).fill(0)],times:[0],bandwidth:1},
   {events:[Array(10000).fill(0)],times:Array.from({length:101},(_,i)=>i),bandwidth:1},
  ])expect(()=>science.eventRates(props)).toThrow();
  expect(()=>science.eventRates({events:[[0]],times:[0,,2] as number[],bandwidth:1})).toThrow();
 });
 it('enforces shape, sparse-array, coordinate and sampling bounds on every public path',()=>{
  const modal=science.modalState({modes:[{shape:[1],amplitude:1,angularFrequency:1}]});
  expect(()=>modal.at(Infinity)).toThrow();
  expect(()=>science.modalState({modes:[{shape:Array(65).fill(1),amplitude:1,angularFrequency:1}]})).toThrow();
  expect(()=>science.modalState({modes:[{shape:[1,,2] as number[],amplitude:1,angularFrequency:1}]})).toThrow();
  expect(()=>science.conservativeTransport({initial:Array(65).fill(1),transfers:[]})).toThrow();
  expect(()=>science.conservativeTransport({initial:[1,,2] as number[],transfers:[]})).toThrow();
  expect(()=>science.conservativeTransport({initial:[1],transfers:[{id:'self',from:0,to:0,fraction:.1}]})).toThrow();
  expect(()=>science.conservativeTransport({initial:[1,0],transfers:[{id:'off',from:0,to:2,fraction:.1}]})).toThrow();
  expect(()=>science.conservativeTransport({initial:[1,0],transfers:Array.from({length:513},(_,i)=>({id:String(i),from:0,to:1,fraction:0}))})).toThrow();
  const wave=science.complexInterference({waves:[{amplitude:[1,0]}]});
  expect(()=>wave.at(NaN)).toThrow();expect(()=>wave.at(0,[0,Infinity,0])).toThrow();
  expect(()=>science.complexInterference({waves:[{amplitude:[1,0],waveVector:[0,,0] as unknown as [number,number,number]}]})).toThrow();
  expect(()=>science.eventRates({events:Array(65).fill([]),times:[0],bandwidth:1})).toThrow();
  expect(()=>science.eventRates({events:Array(64).fill([]),times:Array.from({length:313},(_,i)=>i),bandwidth:1})).toThrow();
  expect(()=>science.eventRates({events:[[0]],times:[0],bandwidth:1e-10})).toThrow();
 });
 it('runs all four public helpers inside the actual scene VM with deterministic seeks',async()=>{
  const source=`export default scene({end:'hold'},s=>{
   const modes=s.modalState({modes:[{shape:[1,2],amplitude:1,angularFrequency:1}]});
   const transport=s.conservativeTransport({initial:[1,0],transfers:[{id:'ab',from:0,to:1,fraction:.25}],steps:2});
   const waves=s.complexInterference({waves:[{amplitude:[1,0]},{amplitude:[1,0],phase:Math.PI}]});
   const rates=s.eventRates({events:[[0],[1]],times:[0,1,2],bandwidth:1});
   const data=s.sampledState({...rates,projection:[[1,0],[0,1],[0,0]]});
   const dot=s.circle('dot',{radius:.1,fill:Color.TEAL});
   s.bind(dot,[s.time],t=>({position:[modes.at(t).displacement[0],data.at(t).values[0]+transport.at(1).values[1]+waves.at(t).intensity]}));
   s.wait(2);
  });`;
  await withOfflineScene(source,{},sampler=>{
   const get=(t:number)=>sampler.sample(t).elements.find(e=>e.id==='dot')!;
   const expected=get(.7);sampler.sample(2);sampler.sample(0);expect(get(.7)).toEqual(expected);
   expect(expected.position[0]).toBeCloseTo(Math.cos(.7),12);
  });
 });
 for(const recipe of['modal-state','conservative-transport','complex-interference','event-rates']){
  it(`compiles and seeks the runnable ${recipe} catalog source`,async()=>{
   const source=await readFile(new URL(`../catalog/recipes/${recipe}.js`,import.meta.url),'utf8');
   await withOfflineScene(source,{},sampler=>{
    expect(sampler.scene.duration).toBeGreaterThan(0);
    const time=sampler.scene.duration*.43,expected=sampler.sample(time);
    expect(expected.elements.length).toBeGreaterThan(2);
    sampler.sample(sampler.scene.duration);sampler.sample(0);expect(sampler.sample(time)).toEqual(expected);
   });
  });
 }
});

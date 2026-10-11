import {readFile} from 'node:fs/promises';
import {describe,it,expect} from 'vitest';
import {withOfflineScene} from '../src/offline-sampling.js';
import type {Frame,ColorPalette} from '../src/types.js';

const get=(f:Frame,id:string)=>{const e=f.elements.find(e=>e.id===id);if(!e)throw Error(`Missing ${id}`);return e;};
async function proof(name:string,check:Parameters<typeof withOfflineScene>[2]){
 const source=await readFile(new URL(`../demo/expansion/${name}.js`,import.meta.url),'utf8');
 const palette=JSON.parse(await readFile(new URL(`../demo/expansion/${name}-palette.json`,import.meta.url),'utf8')) as ColorPalette;
 // These fixtures check numerical invariants, not compilation speed. Allow
 // slower CI CPUs to build their dense timelines without changing VM defaults.
 return withOfflineScene(source,{palette},check,{executionLimitMs:2000});
}
describe('original science proofs: scientific invariants',()=>{
 it('derives every rate from actual event times and preserves selected state through layout',async()=>{
  await proof('artem-state',s=>{
   const initial=s.sample(0), final=s.sample(7);
   for(let r=0;r<5;r++){
    const base=2.25-r*1.15,events=initial.elements.filter(e=>e.id.startsWith(`row-${r}/event-`)).map(e=>(e.geometry.points![0][0]+4.65)/2.325);
    const expected=events.reduce((sum,event)=>sum+Math.exp(-((2-event)**2)/(2*.13**2))/(.13*Math.sqrt(2*Math.PI)),0);
    expect(get(final,`entry-${r}`).geometry.numbers!.r).toBeCloseTo(expected,11);
    for(const time of[0,3.5,3.9,4.4,4.7,7,3.9]){
     const frame=s.sample(time),trace=get(frame,`row-${r}/rate`),marker=get(frame,`sample-${r}`),points=trace.geometry.points!;
     expect(points).toHaveLength(321);
     expect(marker.position[0]).toBeCloseTo(points[160][0],11);
     expect(marker.position[1]).toBeCloseTo(base+.075*expected,11);
     expect(marker.position[1]).toBeCloseTo(points[160][1],11);
     expect(marker.fill).toBe(get(frame,`entry-${r}`).fill);
     expect(points.every((p,i)=>i===0||p[0]>points[i-1][0])).toBe(true);
    }
    // Numerical area of each displayed, truncated kernel recovers one event.
    const k=get(initial,`row-${r}/kernel-3`).geometry.points!;
    let mass=0;for(let j=1;j<k.length;j++)mass+=(k[j][0]-k[j-1][0])/2.325*((k[j][1]+k[j-1][1])/2-base)/.075;
    expect(mass).toBeCloseTo(1,3);
   }
   expect(s.scene.options.palette!.colors.BLACK).toBe('#0c1029');
   const at=s.sample(3.9);s.sample(7);s.sample(0);expect(s.sample(3.9)).toEqual(at);
  });
 });
 it('keeps data fixed while weight, sigmoid, prediction and residual agree at interior times',async()=>{
  await proof('logistic-residual',s=>{
   const initial=s.sample(0);
   for(const time of[0,1.5,2.7,3.1,3.8,4.6,4.9,7,3.1]){
    const frame=s.sample(time),w=get(frame,'weight').geometry.numbers!.w;
    const expected=1/(1+Math.exp(-(w*2-2))),pred=get(frame,'prediction'),res=get(frame,'residual'),curve=get(frame,'plot/sigmoid');
    expect(pred.position[0]).toBeCloseTo(2,12);
    expect((pred.position[1]+2.1)/3.65).toBeCloseTo(expected,11);
    expect(res.geometry.points![0]).toEqual(pred.position.slice(0,2));
    expect(res.geometry.points![1]).toEqual(get(frame,'observation-5').position.slice(0,2));
    expect(curve.geometry.points![100]).toEqual(pred.position.slice(0,2));
    expect(curve.geometry.points!.every(p=>(p[1]+2.1)/3.65>=0&&(p[1]+2.1)/3.65<=1)).toBe(true);
    for(let i=0;i<10;i++)expect(get(frame,`observation-${i}`).position).toEqual(get(initial,`observation-${i}`).position);
   }
   const final=s.sample(7),error=get(final,'error-value').geometry.numbers!.e,prediction=get(final,'prediction-value').geometry.numbers!.p;
   expect(error).toBeCloseTo((1-prediction)**2,14);
   expect(prediction).toBeCloseTo(.6899744811276125,14);
   expect(get(s.sample(5),'error-value').opacity).toBeGreaterThan(0);
   expect(get(s.sample(4.8),'error-value').opacity).toBe(0);
   const at=s.sample(3.8);s.sample(7);s.sample(0);expect(s.sample(3.8)).toEqual(at);
  });
 });
});

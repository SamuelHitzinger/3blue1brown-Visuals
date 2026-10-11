import {readFile} from 'node:fs/promises';
import {it,expect} from 'vitest';
import {withOfflineScene} from '../src/offline-sampling.js';
import type {Frame,ColorPalette} from '../src/types.js';
const get=(f:Frame,id:string)=>{const e=f.elements.find(e=>e.id===id);if(!e)throw Error(`Missing ${id}`);return e;};
it('transports the displayed trace sample into the same projected point and growing path on any seek',async()=>{
 const source=await readFile(new URL('../demo/expansion/neural-trajectory.js',import.meta.url),'utf8');
 const palette=JSON.parse(await readFile(new URL('../demo/expansion/neural-trajectory-manifest.json',import.meta.url),'utf8')).palette as ColorPalette;
 // The dense trajectory checks numerical/seek parity, not compilation speed.
 // Use a test-only budget for slower CI CPUs; production limits stay unchanged.
 await withOfflineScene(source,{palette},s=>{
  for(const t of[0,.7,1.4,2.4,2.73,4,5.87,8.5,9.5,4]){
   const f=s.sample(t),values=Array.from({length:5},(_,r)=>get(f,`entry-${r}`).geometry.numbers!.r);
   const head=get(f,'state-point');
   const sampled=.3+3.4*Math.max(0,Math.min(1,(t-2.4)/6.1));
   const active=Math.min(7,Math.floor(sampled/.5));
   const trail=get(f,`trajectory-${active}`).geometry.points!;
   for(let r=0;r<5;r++){
    const marker=get(f,`sample-${r}`),prefix=get(f,`trace-${r}`).geometry.points!;
    expect(marker.position.slice(0,2)).toEqual(prefix.at(-1));
    const u=Math.max(0,Math.min(1,(t-.5)/1.1)),layout=u*u*(3-2*u);
    const base=2.25-r*1.15+layout*(.48+r*.65),scale=.075-.04*layout;
    expect((marker.position[1]-base)/scale).toBeCloseTo(values[r],11);
   }
   [values[0]/5,values[1]/5,values[4]/5].forEach((n,i)=>expect(head.position[i]).toBeCloseTo(n,11));
   expect(trail.at(-1)).toEqual(head.position);
   expect(trail).toHaveLength(41);
   for(let i=0;i<8;i++){
    if(i<7)expect(get(f,`trajectory-${i}`).geometry.points!.at(-1)).toEqual(get(f,`trajectory-${i+1}`).geometry.points![0]);
    if(i>active)expect(get(f,`trajectory-${i}`).opacity).toBe(0);
   }
   const g0=get(f,'component-0').geometry.points!,g1=get(f,'component-1').geometry.points!,g2=get(f,'component-2').geometry.points!;
   expect(g0[1]).toEqual(g1[0]);expect(g1[1]).toEqual(g2[0]);expect(g2[1]).toEqual(head.position);
  }
  const frame=s.sample(4);s.sample(9.5);s.sample(0);expect(s.sample(4)).toEqual(frame);
  expect(get(s.sample(8.5),'trajectory-7').opacity).toBeGreaterThan(0);
  expect(s.scene.duration).toBeCloseTo(9.5,12);
 },{executionLimitMs:2000});
});

import {describe,it,expect} from 'vitest';
import {createNucleicProcessingBuilders} from '../src/nucleic-processing.js';
import type {NucleicSpliceProps,NucleicThreadProps} from '../src/nucleic-processing-types.js';
import type {Vec3} from '../src/types.js';
const api=createNucleicProcessingBuilders(),dist=(a:Vec3,b:Vec3)=>Math.hypot(...a.map((v,j)=>v-b[j]));
const splice=():NucleicSpliceProps=>({sites:Array.from({length:12},(_,i)=>({id:'r'+i,base:'A',position:[i*.5,0,0]})),intron:{start:4,end:7},initialNormal:[0,1,0],baseReach:.25,joinDistance:.5,departure:{translation:[0,3,1],axis:[0,0,1],angle:1.4}});
const thread=():NucleicThreadProps=>({sites:Array.from({length:8},(_,i)=>({id:'r'+i,base:'U',offset:i*.4})),path:Array.from({length:101},(_,i)=>{const x=(i-50)*.16;return [x,Math.max(0,Math.abs(x)-.7)**2*.035,0] as Vec3;}),initialNormal:[0,0,1],baseReach:.2,aperture:{center:[0,0,0],normal:[1,0,0],radius:1,halfThickness:.5,chainRadius:.3}});
describe('stable RNA split, remove and rejoin',()=>{
 it('cuts both boundary edges, retains every identity and joins only closed exon ends',()=>{
  const p=splice(),early=api.nucleicSplice(p,.1),cut=api.nucleicSplice(p,.2),closing=api.nucleicSplice(p,.699),joined=api.nucleicSplice(p,.7);
  expect(early.bonds).toContainEqual(['r3','r4']);expect(early.bonds).toContainEqual(['r7','r8']);
  for(const r of [cut,closing,joined]){expect(r.bonds).not.toContainEqual(['r3','r4']);expect(r.bonds).not.toContainEqual(['r7','r8']);expect(r.anchors.map(a=>a.id)).toEqual(p.sites.map(a=>a.id));}
  expect(closing.bonds).not.toContainEqual(['r3','r8']);expect(joined.bonds).toContainEqual(['r3','r8']);expect(joined.joinDistance).toBeCloseTo(.5,12);
  expect(cut.cutEnds).toEqual(['r3','r4','r7','r8']);expect(joined.cutEnds).toEqual(['r4','r7']);
 });
 it('preserves all internal fragment lengths, base reach and rigid frames in 201 interior poses and reverse seeks',()=>{
  const p=splice(),before=JSON.stringify(p),r=api.nucleicSplice(p,.46);
  for(let k=0;k<=200;k++){const r=api.nucleicSplice(p,k/200);for(let i=1;i<12;i++)if(i!==4&&i!==8)expect(dist(r.anchors[i-1].backbone,r.anchors[i].backbone)).toBeCloseTo(.5,11);for(const a of r.anchors){expect(dist(a.tip,a.backbone)).toBeCloseTo(.25,12);expect(Math.hypot(...a.tangent)).toBeCloseTo(1,12);}}
  expect(dist(api.nucleicSplice(p,1).anchors[5].backbone,p.sites[5].position)).toBeGreaterThan(2);expect(api.nucleicSplice(p,.46)).toEqual(r);expect(JSON.stringify(p)).toBe(before);
 });
 it('preflights phase order, identities, sparse arrays and degenerate frames before any progress',()=>{
  expect(()=>api.nucleicSplice({...splice(),phases:{cut:.8,closeEnd:.2,departEnd:.9}},0)).toThrow(/phase/i);
  const p=splice();p.sites[2].id='r1';expect(()=>api.nucleicSplice(p,0)).toThrow(/identity/i);
  expect(()=>api.nucleicSplice({...splice(),sites:Array(12)},0)).toThrow();
  expect(()=>api.nucleicSplice({...splice(),intron:{start:0,end:7}},0)).toThrow(/intron/i);
 });
});
describe('exact arc-length chain transport through one aperture',()=>{
 it('reserves the swept chain radius outside slab faces, including clipped segment interiors',()=>{
  const paths:Vec3[][]=[
   [[-8,1.2,0],[-.6,1.2,0],[-.5,.6,0],[.5,.6,0],[.6,1.2,0],[8,1.2,0]],
   [[-8,2,0],[-1,2,0],[-.5,.5,0],[.5,.5,0],[1,2,0],[8,2,0]],
  ];
  for(const path of paths)for(const oblique of [false,true]){
   const p=thread(),rot=(v:Vec3):Vec3=>[(v[0]-v[1])/Math.sqrt(2),(v[0]+v[1])/Math.sqrt(2),v[2]];
   p.path=oblique?path.map(rot):path;p.aperture.normal=oblique?rot([1,0,0]):[1,0,0];
   // Every centerline point inside the original slab fits, but the swept radius
   // intersects its face/rim from outside. Reject the entire schedule at t=0.
   expect(()=>api.nucleicThread(p,0)).toThrow(/aperture/i);
  }
 });
 it('retains identities and positive arc gaps throughout forward and reverse transport',()=>{
  const p=thread(),saved=api.nucleicThread(p,.31);
  for(let k=0;k<=100;k++){const r=api.nucleicThread(p,k/100);expect(r.anchors.map(a=>a.id)).toEqual(p.sites.map(a=>a.id));for(let i=1;i<8;i++)expect(r.arcCoordinates[i-1]-r.arcCoordinates[i]).toBeCloseTo(.4,11);for(const a of r.anchors){expect(Math.hypot(...a.normal)).toBeCloseTo(1,11);expect(a.normal.reduce((v,n,i)=>v+n*a.tangent[i],0)).toBeCloseTo(0,11);}}
  expect(api.nucleicThread(p,0).signedSides.every(v=>v<0)).toBe(true);expect(api.nucleicThread(p,1).signedSides.every(v=>v>0)).toBe(true);expect(api.nucleicThread(p,.31)).toEqual(saved);
 });
 it('rejects membrane collisions anywhere on the path even if the current frame is safe',()=>{
  const p=thread();p.path[50]=[0,2,0];expect(()=>api.nucleicThread(p,0)).toThrow(/aperture/i);
  const q=thread();q.sites[3].offset=q.sites[2].offset;expect(()=>api.nucleicThread(q,0)).toThrow(/offset/i);
  expect(()=>api.nucleicThread({...thread(),path:[[-8,0,0],[2,0,0],[-2,0,0],[8,0,0]]},0)).toThrow(/monotonic/i);
  expect(()=>api.nucleicThread({...thread(),path:Array(3)},0)).toThrow();
 });
 it('handles an oblique pore and vertices exactly on slab planes without aliases',()=>{
  const p=thread(),rot=(v:Vec3):Vec3=>[(v[0]-v[1])/Math.sqrt(2),(v[0]+v[1])/Math.sqrt(2),v[2]];p.path=p.path.map(rot);p.aperture.normal=rot([1,0,0]);
  const r=api.nucleicThread(p,.5);expect(r.signedSides.some(v=>v<0)).toBe(true);expect(r.signedSides.some(v=>v>0)).toBe(true);r.anchors[0].backbone[0]=999;expect(api.nucleicThread(p,.5).anchors[0].backbone[0]).not.toBe(999);
  const q=thread();q.path=[[-8,0,0],[-.5,.7,0],[.5,.7,0],[8,0,0]];expect(()=>api.nucleicThread(q,.5)).not.toThrow();q.path[1][1]=.70001;expect(()=>api.nucleicThread(q,0)).toThrow(/aperture/i);
 });
 it('preflights coordinate bounds and keeps frames continuous over curved 3D paths',()=>{
  const p=thread();p.path=p.path.map(v=>[v[0],99999.9,v[2]]);p.aperture.center=[0,99999.9,0];expect(()=>api.nucleicThread(p,0)).toThrow(/schedule coordinate/i);
  const q=thread();q.path=q.path.map(v=>[v[0],.07*Math.sin(v[0]),.07*Math.cos(v[0])]);const snapshot=JSON.stringify(q);
  let previous=api.nucleicThread(q,0);for(let i=1;i<=500;i++){const r=api.nucleicThread(q,i/500);for(let j=0;j<r.anchors.length;j++){const a=r.anchors[j],b=previous.anchors[j];expect(a.normal.reduce((v,n,k)=>v+n*b.normal[k],0)).toBeGreaterThan(.99);expect(Math.hypot(...a.normal)).toBeCloseTo(1,10);expect(a.normal.reduce((v,n,k)=>v+n*a.tangent[k],0)).toBeCloseTo(0,10);}previous=r;}expect(JSON.stringify(q)).toBe(snapshot);
 });
});

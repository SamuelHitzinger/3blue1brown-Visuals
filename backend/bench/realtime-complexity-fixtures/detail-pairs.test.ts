import {expect,test} from 'bun:test';
import {buildControlledDetailPairs,validateDetailPair,type DetailPair} from './detail-pairs.js';

test('detail overrides produce a matched pair whose instruction changes only its declared sampling clause',async()=>{
 const pairs=await buildControlledDetailPairs({'line-sampling':[12,96]});
 for(const pair of pairs){
  const evidence=validateDetailPair(pair);
  expect(pair.low.invariants).toEqual(pair.high.invariants);
  expect(pair.low.instruction.split('\n').slice(0,-1)).toEqual(pair.high.instruction.split('\n').slice(0,-1));
  expect(evidence.invariantSha256).toMatch(/^[a-f0-9]{64}$/);
  expect(evidence.reviewRequired).toContain('full-motion geometry and readability');
 }
 expect(pairs[0].low.detail).toBe(12);
 expect(pairs[0].high.detail).toBe(96);
 expect(validateDetailPair(pairs[0]).variants.low.expectedGeometry).toEqual({curveSamples:12});
});

test('invalid, equal, reversed or unsupported detail values cannot become trials',async()=>{
 for(const values of [[0,32],[2.5,32],[NaN,32],[32,32],[64,32],[2,Infinity]] as [number,number][])
  await expect(buildControlledDetailPairs({'line-sampling':values})).rejects.toThrow();
 await expect(buildControlledDetailPairs({'saddle-mesh':[0,40]})).rejects.toThrow();
 await expect(buildControlledDetailPairs({'caffeine-spheres':[0,4]})).rejects.toThrow();
});

test('surface detail cannot exceed the native 20,000 triangle geometry budget',async()=>{
 await expect(buildControlledDetailPairs({'saddle-mesh':[10,100]})).resolves.toHaveLength(3);
 await expect(buildControlledDetailPairs({'saddle-mesh':[10,101]})).rejects.toThrow();
});

test('pairs reject confounds in claims, camera, motion, duration, topology or undeclared instructions',async()=>{
 const originals=await buildControlledDetailPairs();
 const mutations:((p:DetailPair)=>void)[]=[
  p=>{p.high.invariants.claims.push('extra inference');},
  p=>{p.high.invariants.camera='different view';},
  p=>{p.high.invariants.motion='extra motion';},
  p=>{p.high.invariants.durationSeconds=9;},
  p=>{p.high.invariants.data={different:'topology'};},
  p=>{p.high.instruction+='\nAlso hide annotations.';},
 ];
 for(const original of originals)for(const mutate of mutations){
  const pair=structuredClone(original);mutate(pair);
  expect(()=>validateDetailPair(pair)).toThrow();
 }
});

test('full caffeine retains hydrogens, bond orders and exact coordinates with auditable provenance',async()=>{
 const pair=(await buildControlledDetailPairs()).find(p=>p.id==='caffeine-spheres')!;
 const data=pair.low.invariants.data as {atoms:{id:number;element:string;position:number[]}[];bonds:{from:number;to:number;order:number}[]};
 expect(data.atoms).toHaveLength(24);
 expect(data.atoms.filter(a=>a.element==='H')).toHaveLength(10);
 expect(data.bonds).toHaveLength(25);
 expect(data.bonds.filter(b=>b.order===2)).toHaveLength(4);
 expect(data.atoms.find(a=>a.id===1)?.position).toEqual([0.47,2.5688,0.0006]);
 const ids=new Set(data.atoms.map(a=>a.id));
 expect(data.bonds.every(b=>ids.has(b.from)&&ids.has(b.to))).toBe(true);
 const receipt=pair.low.invariants.provenance!;
 expect(receipt.dataSha256).toBe('c9258f019dcaad8754b4f171dd379f6b78e33bd27b8aa90b949378cd7079dce1');
 expect(receipt.source.sha256).toBe('47431d2119cac4bf9230e0f7838b2dd731ca7840958c4f2f2a44d9276944bacc');
 expect(validateDetailPair(pair).variants.high.expectedGeometry).toEqual({sphereDetail:2,atoms:24,bonds:25,bondStrokes:29});
 // A consumer editing one variant must not silently edit the other through aliases.
 data.atoms.pop();
 expect(()=>validateDetailPair(pair)).toThrow();
});

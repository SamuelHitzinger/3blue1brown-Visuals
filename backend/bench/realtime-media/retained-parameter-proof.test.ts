import {expect,test,spyOn} from 'bun:test';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {SourceCompiler} from '../../../shared/animlib/src/compiler-client.js';
import {rotate} from '../../../shared/animlib/src/geometry.js';
import type {Vec3} from '../../../shared/animlib/src/types.js';
import {buildRetainedParameterCases,compareNativeFrames,auditNativeFrame,runRetainedParameterProof} from './retained-parameter-proof.js';

test('ten retained constructions exactly match fresh defaults without rebuilding; artifacts retain real native frames',async()=>{
 const root=await mkdtemp(join(resolve('.tmp'),'retained-')),compile=spyOn(SourceCompiler.prototype,'compile');
 try{
  const receipt=await runRetainedParameterProof({directory:root});
  expect(receipt.status).toBe('passed');expect(receipt.cases).toHaveLength(10);
  expect(compile).toHaveBeenCalledTimes(20);
  for(const row of receipt.cases){
   expect(row.invariants).toEqual({epochPreserved:true,parameterChanged:true,cameraPreserved:true,topologyPreserved:true});
   expect(row.comparisons).toHaveLength(4);
   expect(row.comparisons.every(c=>c.maxAbsoluteError<=1e-9&&c.numericValues>0)).toBe(true);
   expect(row.updateBytes).toBeLessThan(row.sourceBytes);
   const frame=JSON.parse(await readFile(row.artifacts.candidateFrames[0],'utf8'));
   expect(frame.elements.length).toBeGreaterThan(1);
   const input=JSON.parse(await readFile(row.artifacts.candidateRenderInputs[0],'utf8'));
   expect(input.previousFrame.elements.every((e:{persistent:boolean})=>e.persistent)).toBe(true);
   expect(input.times).toEqual([0]);
  }
  const caffeine=receipt.cases.filter(row=>row.subject==='caffeine');
  expect(caffeine.map(c=>c.geometry)).toEqual([
   {atoms:24,bonds:25,bondStrokes:29,atomTriangles:192},
   {atoms:24,bonds:25,bondStrokes:29,atomTriangles:3072},
  ]);
  expect(receipt.renderStatus).toBe('not-rendered');
  expect(receipt.limitations.join(' ')).toMatch(/not.*generation/i);
  const manifest=JSON.parse(await readFile(join(receipt.runDirectory,'manifest.json'),'utf8'));
  expect(manifest.cases).toHaveLength(10);expect(manifest.cases[0].programId).toBe('construction');
  expect(JSON.parse(await readFile(join(receipt.runDirectory,'receipt.json'),'utf8'))).toEqual(receipt);
 }finally{compile.mockRestore();await rm(root,{recursive:true,force:true});}
},30_000);

test('independent analytic audit rejects wrong geometry even when two frames match each other',async()=>{
 const cases=await buildRetainedParameterCases();
 const {LiveWorld}=await import('../realtime-world/world.js');
 const old=Object.getOwnPropertyDescriptor(globalThis,'Worker');Object.defineProperty(globalThis,'Worker',{value:undefined,configurable:true,writable:true});
 const world=new LiveWorld({clock:()=>0});
 try{
  const c=cases.find(c=>c.id==='saddle-low')!;await world.addProgram({id:'construction',source:c.baselineSource,baseRevision:0},0);
  const frame=await world.sample(4);auditNativeFrame(c,frame,4,c.values.p);
  const corrupted=structuredClone(frame),vertex=corrupted.elements.find(e=>e.id==='surface')!.geometry.vertices![0];vertex[2]=vertex[2]!+1;
  expect(compareNativeFrames(corrupted,structuredClone(corrupted)).maxAbsoluteError).toBe(0);
  expect(()=>auditNativeFrame(c,corrupted,4,c.values.p)).toThrow(/saddle/);
  expect(()=>compareNativeFrames(frame,corrupted)).toThrow(/difference/);
  corrupted.elements.pop();expect(()=>compareNativeFrames(frame,corrupted)).toThrow();
 }finally{world.dispose();if(old)Object.defineProperty(globalThis,'Worker',old);else delete (globalThis as {Worker?:unknown}).Worker;}
});

test('molecular audit rejects lost hydrogen, changed bond endpoint and nonrigid atom transforms',async()=>{
 const cases=await buildRetainedParameterCases(),c=cases.find(c=>c.id==='caffeine-high')!;
 const {LiveWorld}=await import('../realtime-world/world.js');
 const old=Object.getOwnPropertyDescriptor(globalThis,'Worker');Object.defineProperty(globalThis,'Worker',{value:undefined,configurable:true,writable:true});
 const world=new LiveWorld({clock:()=>0});
 try{
  await world.addProgram({id:'construction',source:c.baselineSource,baseRevision:0},0);
  const frame=await world.sample(4);auditNativeFrame(c,frame,4,c.values.p);
  const missing=structuredClone(frame);missing.elements=missing.elements.filter(e=>e.id!=='atom-24/batch-0');
  expect(()=>auditNativeFrame(c,missing,4,c.values.p)).toThrow();
  const wrongBond=structuredClone(frame);wrongBond.elements.find(e=>e.id==='bond-0-0')!.geometry.points![0][0]+=.2;
  expect(()=>auditNativeFrame(c,wrongBond,4,c.values.p)).toThrow(/bond endpoint/);
  const nonrigid=structuredClone(frame);nonrigid.elements.find(e=>e.id==='atom-24')!.rotation[0]=.2;
  expect(()=>auditNativeFrame(c,nonrigid,4,c.values.p)).toThrow(/rigid local rotation/);
 }finally{world.dispose();if(old)Object.defineProperty(globalThis,'Worker',old);else delete (globalThis as {Worker?:unknown}).Worker;}
});

test('both caffeine detail levels keep every full atom radius within both viewports through t3..7',async()=>{
 const cases=(await buildRetainedParameterCases()).filter(c=>c.subject==='caffeine');
 const {LiveWorld}=await import('../realtime-world/world.js');
 const old=Object.getOwnPropertyDescriptor(globalThis,'Worker');Object.defineProperty(globalThis,'Worker',{value:undefined,configurable:true,writable:true});
 try{
  for(const c of cases)for(const arm of ['candidate','baseline']){
   const world=new LiveWorld({clock:()=>0});
   try{
    await world.addProgram({id:'construction',source:arm==='candidate'?c.source:c.baselineSource,baseRevision:0},0);
    if(arm==='candidate')await world.setParameters({baseRevision:1,programId:'construction',values:c.values},3);
    for(const t of [3,4,5,6,7]){
     const frame=await world.sample(t),root=frame.elements.find(e=>e.id==='molecule')!,camera=frame.camera;
     for(const [width,height] of [[1280,720],[960,720]])for(const atom of c.data!.atoms){
      const center=rotate(atom.position.map((v,i)=>(v-c.data!.center[i])*root.scale) as Vec3,root.rotation);
      const [x,y,cameraZ]=rotate(rotate(center.map((v,i)=>v-camera.target[i]) as Vec3,[0,-camera.yaw,0]),[-camera.pitch,0,0]);
      const depth=camera.distance-cameraZ,radius=(atom.element==='H'?.13:.22)*root.scale,focal=height/camera.height*camera.distance;
      const extrema=(v:number)=>[(v*depth-radius*Math.sqrt(v*v+depth*depth-radius*radius))/(depth*depth-radius*radius),(v*depth+radius*Math.sqrt(v*v+depth*depth-radius*radius))/(depth*depth-radius*radius)];
      const [left,right]=extrema(x),[bottom,top]=extrema(y);
      const margin=Math.min(width/2+focal*left,width/2-focal*right,height/2-focal*top,height/2+focal*bottom);
      expect(margin,`${c.id} ${arm} atom${atom.id} t${t} ${width}px full sphere framing`).toBeGreaterThan(60);
     }
    }
   }finally{world.dispose();}
  }
 }finally{if(old)Object.defineProperty(globalThis,'Worker',old);else delete (globalThis as {Worker?:unknown}).Worker;}
});

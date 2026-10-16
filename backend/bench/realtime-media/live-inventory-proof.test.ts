import {expect,test} from 'bun:test';
import {mkdir,mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createModelGLB} from 'animlib/core';
import * as proof from './live-inventory-proof.js';
const scratch=fileURLToPath(new URL('../../../data/',import.meta.url)).replace(/[\\/]$/,'');

test('late local publication reaches the same moving world through host and browser reconciliation',async()=>{
 await mkdir(scratch,{recursive:true});const root=await mkdtemp(join(scratch,'li-test-'));
 try{
  const model=join(root,'mechanical.glb');
  await writeFile(model,await createModelGLB({parts:[{name:'Mechanical test triangle',vertices:[[0,0,0],[1,0,0],[0,1,0]],triangles:[[0,1,2]]}]}));
  const result=await proof.runLiveInventoryProof({directory:join(root,'evidence'),modelPath:model,render:false});
  expect(result.status).toBe('passed');expect(result.model.triangles).toBe(1);expect(result.model.scientific).toBeNull();
  expect(result.registration).toMatchObject({initialHostAssets:0,initialWorldModelRevision:0,publishedAfterWorldCreated:true,hostRevision:1,worldModelRevision:1});
  expect(Object.values(result.invariants).every(value=>value===true)).toBe(true);
  expect(result.invariants).toMatchObject({originalEpochPreserved:true,rotationPreserved:true,deformationPreserved:true,
   hostTransitionPreserved:true,cameraPreserved:true,staleSnapshotIgnored:true,deadlinePreserved:true,cancelledCandidateUnpublished:true,sharedGeometryReused:true});
  expect(result.samples.after.rotationY).toBeCloseTo(4);expect(result.samples.after.deformationZ).toBeCloseTo(.4);
  expect(result.model.readsAfterCold).toBe(1);expect(result.model.readsAfterReuse).toBe(1);
  expect(result.timings.localPipelineMs).toBeGreaterThan(0);expect(result.timings.coldCompilePrepareResolveMs).toBeGreaterThan(0);
  expect(result.render.status).toBe('not-requested');expect(result.render.liveSubmittedAtMs).toBeNull();expect(result.render.hardwarePresentedAtMs).toBeNull();
  const persisted=JSON.parse(await readFile(join(root,'evidence','receipt.json'),'utf8'));
  expect(persisted).toEqual(result);expect(result.limitations.join(' ')).toMatch(/retrieval.*speech/i);
 }finally{expect(dirname(root)).toBe(scratch);await rm(root,{recursive:true,force:true});}
},20_000);

test('a corrupt local GLB leaves a failed receipt instead of claiming publication or rendering',async()=>{
 await mkdir(scratch,{recursive:true});const root=await mkdtemp(join(scratch,'li-test-'));
 try{
  const model=join(root,'invalid.glb');await writeFile(model,'not a GLB');
  await expect(proof.runLiveInventoryProof({directory:join(root,'evidence'),modelPath:model,render:false})).rejects.toThrow(/GLB/i);
  const receipt=JSON.parse(await readFile(join(root,'evidence','receipt.json'),'utf8'));
  expect(receipt.status).toBe('failed');expect(receipt.registration.hostRevision).toBe(0);
  expect(receipt.render.status).toBe('not-requested');expect(receipt.error).toMatch(/GLB/i);
 }finally{expect(dirname(root)).toBe(scratch);await rm(root,{recursive:true,force:true});}
});

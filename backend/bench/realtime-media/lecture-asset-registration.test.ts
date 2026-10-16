import {expect,test} from 'bun:test';
import {mkdtemp,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createModelGLB} from 'animlib/core';
import {ModelAssets} from '../../src/model-assets.js';
import {createLocalAssetIndex} from './asset-index.js';
import {createLectureAssetSession} from './lecture-assets.js';
import {registerPublishedLectureAssets,requireKnownAssetInventory} from './lecture-asset-registration.js';

async function fixture(run:(value:{store:ModelAssets;index:()=>ReturnType<typeof createLocalAssetIndex>})=>Promise<void>){
  const root=await mkdtemp(join(tmpdir(),'lecture-registration-')),fixtures=join(root,'fixtures');
  try{await mkdir(fixtures);await run({store:new ModelAssets(join(root,'models')),index:()=>createLocalAssetIndex({fixtureRoot:fixtures,modelDirectory:join(root,'models'),dataRoots:[]})});}
  finally{await rm(root,{recursive:true,force:true});}
}
const triangle=(name:string)=>createModelGLB({parts:[{name,vertices:[[0,0,0],[1,0,0],[0,1,0]],triangles:[[0,1,2]]}]});

test('registration resolves exact runtime IDs beyond the first index page and keeps old inventory identities known',()=>fixture(async f=>{
  const session=await createLectureAssetSession(await f.index(),{ids:[]}),before=session.manifest();
  for(let i=0;i<25;i++)await f.store.publish(await triangle('part-'+i),{source:'registration test'});
  const next=await f.index(),last=next.query({format:'published-glb',offset:24,limit:1}).entries[0];
  const after=await registerPublishedLectureAssets(session,next,[last.assetId]);
  expect(after.revision).toBe(1);expect(Object.keys(after.assets)).toEqual([last.assetId]);
  expect(session.file(last.assetId)).toBeDefined();
  expect(()=>requireKnownAssetInventory(before.inventoryId,session)).not.toThrow();
  expect(()=>requireKnownAssetInventory(after.inventoryId,session)).not.toThrow();
  for(const invalid of [undefined,null,{},'', '0'.repeat(64)])expect(()=>requireKnownAssetInventory(invalid,session)).toThrow(/inventory/i);
}));

test('registration rejects paths, URLs, aliases, duplicate and unknown identities without admitting any asset',()=>fixture(async f=>{
  const published=await f.store.publish(await triangle('one')),next=await f.index(),session=await createLectureAssetSession(next,{ids:[]});
  const record=next.query().entries[0],before=session.manifest();
  for(const invalid of [undefined,null,{},[],[record.id],[record.assetPath],[record.manifestPath],['https://example.test/model.glb'],[published.id,published.id],Array(5).fill(published.id),['model-'+ '0'.repeat(64)]]){
    await expect(registerPublishedLectureAssets(session,next,invalid)).rejects.toThrow();expect(session.manifest()).toEqual(before);
  }
}));

test('registration rejects ambiguous canonical publications and forwards admission cancellation',()=>fixture(async f=>{
  const published=await f.store.publish(await triangle('one')),next=await f.index(),session=await createLectureAssetSession(next,{ids:[]}),before=session.manifest();
  const page=next.query({format:'published-glb'}),record=page.entries[0];
  const ambiguous={...next,query:()=>({...page,entries:[record,{...record,id:'other-record'}],total:2,nextOffset:undefined})};
  await expect(registerPublishedLectureAssets(session,ambiguous,[published.id])).rejects.toThrow(/ambiguous/i);
  expect(session.manifest()).toEqual(before);
  const controller=new AbortController();
  await expect(registerPublishedLectureAssets(session,next,[published.id],{signal:controller.signal,beforeCommit:()=>controller.abort(Error('cancelled'))})).rejects.toThrow(/cancelled/);
  expect(session.manifest()).toEqual(before);
}));

test('registration ignores mutable base aliases and rejects non-progressing index pagination',()=>fixture(async f=>{
  const published=await f.store.publish(await triangle('one')),next=await f.index(),session=await createLectureAssetSession(next,{ids:[]}),before=session.manifest();
  const page=next.query({format:'published-glb'}),record=page.entries[0],provenanceId='1'.repeat(64),runtimeId=published.id+'-'+provenanceId;
  const alias={...next,query:()=>({...page,entries:[{...record,assetId:runtimeId}],total:1,nextOffset:undefined})};
  await expect(registerPublishedLectureAssets(session,alias,[runtimeId])).rejects.toThrow(/unknown|canonical/i);
  const stuck={...next,query:()=>({...page,nextOffset:0})};
  await expect(registerPublishedLectureAssets(session,stuck,[published.id])).rejects.toThrow(/index|pagination/i);
  expect(session.manifest()).toEqual(before);
}));

test('registration admits the canonical scientific sidecar while preserving its representation constraints',()=>fixture(async f=>{
  const scientific={fixtureId:'registration-scientific',representation:'schematic triangle',units:'illustrative',origin:[0,0,0] as [number,number,number],
    partMeaning:'One illustrative face.',colorMeaning:'Display color only.',
    provenance:{source:'local test',sourceHash:'a'.repeat(64),creator:'test',license:'CC0-1.0',preparedAt:'2026-01-01',
      converter:{name:'test',version:'1',options:{}},selection:'one face',modifications:[],fidelity:'Illustration only; no measured geometry.'}};
  const published=await f.store.publish(await triangle('scientific'),{scientific}),next=await f.index();
  // Scientific publication creates both a mutable base alias and a canonical sidecar.
  expect(next.query({format:'published-glb'}).entries).toHaveLength(2);
  const session=await createLectureAssetSession(next,{ids:[]}),after=await registerPublishedLectureAssets(session,next,[published.id]);
  expect(Object.keys(after.assets)).toEqual([published.id]);
  expect(session.candidates('registration scientific').assets[0].provenance.scientific).toEqual(scientific);
}));

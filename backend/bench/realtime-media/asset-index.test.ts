import {expect,test} from 'bun:test';
import {mkdtemp,mkdir,writeFile,rm,rmdir,symlink,unlink,truncate} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,isAbsolute} from 'node:path';
import {createLocalAssetIndex} from './asset-index.js';
import {ModelAssets} from '../../src/model-assets.js';
import {createModelGLB} from 'animlib/core';

test('actual fixture catalog returns exact paths, dimensions, provenance and cached search',async()=>{
  const index=await createLocalAssetIndex();
  const result=index.query({query:'suzanne textured',format:'native-model',limit:10});
  const found=result.entries.find(entry=>entry.assetId==='suzanne-textured');
  expect(found).toBeDefined();expect(isAbsolute(found!.assetPath)).toBe(true);
  expect(found!.assetPath.replaceAll('\\','/')).toEndWith('/fixtures/suzanne/textured/suzanne-textured.json');
  expect(found!.dimensions?.size[0]).toBeCloseTo(2.6738278866,6);
  expect(found!.provenance.license).toBe('CC0-1.0');expect(found!.animation.status).toBe('none');
  const before=index.metrics();const cached=index.query({query:'suzanne textured',format:'native-model',limit:10});
  expect(cached.metrics.cacheHit).toBe(true);expect(index.metrics().metadataReads).toBe(before.metadataReads);
  cached.entries[0].assetPath='mutated';expect(index.select(found!.id).assetPath).toBe(found!.assetPath);
  const registry=await index.loadNativeRegistry([found!.id]);
  expect(registry.catalog.find(entry=>entry.id==='suzanne-textured-image-0')?.kind).toBe('image');
  expect(registry.catalog.find(entry=>entry.id==='suzanne-textured')?.kind).toBe('model');
  expect(index.query({animated:true}).entries.every(entry=>entry.animation.status==='present')).toBe(true);
});

test('local GLB store selection reuses real publication renderer payload',async()=>{
  const root=await mkdtemp(join(tmpdir(),'asset-index-'));
  try{
    await mkdir(join(root,'fixtures'));const directory=join(root,'models');
    const store=new ModelAssets(directory),bytes=await createModelGLB({parts:[{name:'triangle',vertices:[[0,0,0],[2,0,0],[0,3,0]],triangles:[[0,1,2]]}]});
    const published=await store.publish(bytes,{source:'Original test triangle',license:'CC0-1.0',attribution:'test'});
    const index=await createLocalAssetIndex({fixtureRoot:join(root,'fixtures'),modelDirectory:directory,dataRoots:[]});
    const item=index.query({format:'published-glb'}).entries[0];expect(item.assetId).toBe(published.id);
    expect(item.dimensions?.size).toEqual([2,3,0]);expect(item.animation.status).toBe('none');
    expect(item.runtime.liveWorld).toBe(true);expect(item.runtime.route).toBe('published-models');
    const payload=await index.loadPublishedModels([item.id]);
    expect(payload.assets[published.id].sha256).toBe(published.asset.sha256);
    expect(Buffer.from(payload.files[published.asset.url],'base64')).toEqual(Buffer.from(bytes));
    await expect(index.loadNativeRegistry([item.id])).rejects.toThrow();
  }finally{await rm(root,{recursive:true,force:true});}
});

test.each([
  {maxBytes:64*1024*1024,grownBytes:32*1024*1024+1},
  {maxBytes:4096,grownBytes:8192},
])('published GLB grown after indexing is rejected by the read budget ($grownBytes bytes)',async({maxBytes,grownBytes})=>{
  const root=await mkdtemp(join(tmpdir(),'asset-model-budget-'));
  try{
    await mkdir(join(root,'fixtures'));const directory=join(root,'models');
    const bytes=await createModelGLB({parts:[{name:'triangle',vertices:[[0,0,0],[2,0,0],[0,3,0]],triangles:[[0,1,2]]}]});
    await new ModelAssets(directory).publish(bytes);
    const index=await createLocalAssetIndex({fixtureRoot:join(root,'fixtures'),modelDirectory:directory,dataRoots:[],maxBytes});
    const item=index.query({format:'published-glb'}).entries[0];expect(item).toBeDefined();
    await truncate(item.assetPath,grownBytes);
    await expect(index.loadPublishedModels([item.id])).rejects.toThrow(/exceeds.*limit/i);
    expect(index.metrics().publishedLoads).toBe(0);
  }finally{await rm(root,{recursive:true,force:true});}
});

test('published GLB changed without growing cannot return a renderer payload',async()=>{
  const root=await mkdtemp(join(tmpdir(),'asset-model-tamper-'));
  try{
    await mkdir(join(root,'fixtures'));const directory=join(root,'models');
    const bytes=await createModelGLB({parts:[{name:'triangle',vertices:[[0,0,0],[2,0,0],[0,3,0]],triangles:[[0,1,2]]}]});
    const published=await new ModelAssets(directory).publish(bytes);
    const index=await createLocalAssetIndex({fixtureRoot:join(root,'fixtures'),modelDirectory:directory,dataRoots:[]});
    const item=index.query({format:'published-glb'}).entries[0],tampered=Buffer.from(bytes);tampered[tampered.length-1]^=1;
    await writeFile(item.assetPath,tampered);
    await expect(index.loadPublishedModels([item.id])).rejects.toThrow(/changed|hash mismatch/i);
    expect(index.metrics().publishedLoads).toBe(0);
    await writeFile(item.assetPath,bytes);
    const restored=await index.loadPublishedModels([item.id]);
    expect(Buffer.from(restored.files[published.asset.url],'base64')).toEqual(Buffer.from(bytes));
  }finally{await rm(root,{recursive:true,force:true});}
});

test('clip names and JSON pointers come from local glTF, unnamed clips stay unnamed',async()=>{
  const root=await mkdtemp(join(tmpdir(),'asset-clips-'));
  try{
    await writeFile(join(root,'motion.gltf'),JSON.stringify({asset:{version:'2.0'},accessors:[{min:[2],max:[5]}],animations:[{name:'Open lid',samplers:[{input:0}],channels:[]},{samplers:[],channels:[]}]}));
    await writeFile(join(root,'uninspectable.glb'),new Uint8Array([1,2,3]));
    const index=await createLocalAssetIndex({fixtureRoot:root,modelDirectory:null,dataRoots:[]});
    const animated=index.query({animated:true}).entries[0];expect(animated.animation.clips).toMatchObject([
      {name:'Open lid',index:0,jsonPointer:'/animations/0',durationSeconds:3},
      {name:null,index:1,jsonPointer:'/animations/1',durationSeconds:null},
    ]);
    expect(animated.animation.clips[0].path).toBe(join(root,'motion.gltf'));expect(animated.runtime.liveWorld).toBe(false);
    const unknown=index.query({format:'source-glb'}).entries[0];expect(unknown.animation.status).toBe('unknown');
    expect(index.query({animated:false}).entries.some(entry=>entry.id===unknown.id)).toBe(false);
    await expect(index.loadPublishedModels([animated.id])).rejects.toThrow();
  }finally{await rm(root,{recursive:true,force:true});}
});

test('lookup is bounded and cannot select arbitrary paths or stale changed data',async()=>{
  const root=await mkdtemp(join(tmpdir(),'asset-data-'));
  try{
    const file=join(root,'samples.json');await writeFile(file,JSON.stringify({times:[0,1],values:[2,3]}));
    const index=await createLocalAssetIndex({fixtureRoot:root,modelDirectory:null,dataRoots:[root]});
    const data=index.query({kind:'data'}).entries[0];expect(data.data?.keys).toEqual(['times','values']);
    expect(data.provenance.source).toBeNull();expect(data.animation.status).toBe('unknown');
    expect(()=>index.select('../outside')).toThrow();expect(()=>index.query({limit:21})).toThrow();
    expect(()=>index.query({query:'x'.repeat(241)})).toThrow();
    const page=await index.readData(data.id);expect(JSON.parse(page.content).values).toEqual([2,3]);
    await writeFile(file,JSON.stringify({times:[0,1],values:[4,5]}));
    await expect(index.readData(data.id)).rejects.toThrow('changed');
    await expect(createLocalAssetIndex({fixtureRoot:root,modelDirectory:null,dataRoots:[root],maxFiles:0})).rejects.toThrow();
  }finally{await rm(root,{recursive:true,force:true});}
});

test('selection rejects a directory replaced with a junction outside configured roots',async()=>{
  const root=await mkdtemp(join(tmpdir(),'asset-containment-'));
  try{
    const inside=join(root,'inside'),outside=join(root,'outside');await mkdir(inside);await mkdir(outside);
    const content=JSON.stringify({values:[1,2]});await writeFile(join(inside,'data.json'),content);await writeFile(join(outside,'data.json'),content);
    const index=await createLocalAssetIndex({fixtureRoot:inside,modelDirectory:null,dataRoots:[inside]});const data=index.query({kind:'data'}).entries[0];
    await unlink(join(inside,'data.json'));await rmdir(inside);await symlink(outside,inside,'junction');
    await expect(index.readData(data.id)).rejects.toThrow('escapes');
  }finally{await rm(root,{recursive:true,force:true});}
});

test('byte-bounded results resume after the last delivered record',async()=>{
  const root=await mkdtemp(join(tmpdir(),'asset-pages-'));
  try{
    for(const name of ['a','b','c'])await writeFile(join(root,name+'.json'),JSON.stringify({values:[1],provenance:{source:'a'.repeat(8000),creator:'b'.repeat(8000),fidelity:'c'.repeat(5000)}}));
    const index=await createLocalAssetIndex({fixtureRoot:root,modelDirectory:null,dataRoots:[root]});
    const first=index.query({kind:'data',limit:3});expect(first.entries.length).toBeLessThan(3);expect(first.entries.length).toBeGreaterThan(0);
    expect(first.nextOffset).toBe(first.entries.length);const next=index.query({kind:'data',offset:first.nextOffset,limit:3});
    expect([...first.entries,...next.entries].map(entry=>entry.assetId).sort()).toEqual(['a.json','b.json','c.json']);
  }finally{await rm(root,{recursive:true,force:true});}
});

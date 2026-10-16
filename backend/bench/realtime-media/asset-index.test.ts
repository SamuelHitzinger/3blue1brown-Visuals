import {expect,test} from 'bun:test';
import {mkdtemp,mkdir,writeFile,rm,rmdir,symlink,unlink,truncate} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,isAbsolute} from 'node:path';
import {createLocalAssetIndex} from './asset-index.js';
import {ModelAssets} from '../../src/model-assets.js';
import {createModelGLB} from 'animlib/core';
import {createHash} from 'node:crypto';
import {canonicalAssetJSON} from '../../../shared/animlib/src/asset-validation.js';

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
    await writeFile(join(root,'motion.gltf'),JSON.stringify({asset:{version:'2.0'},accessors:[{min:[2],max:[5]}],animations:[{name:'Open lid',samplers:[{input:0}],channels:[]},{samplers:[],channels:[]},{name:'',samplers:[],channels:[]}]}));
    await writeFile(join(root,'uninspectable.glb'),new Uint8Array([1,2,3]));
    const index=await createLocalAssetIndex({fixtureRoot:root,modelDirectory:null,dataRoots:[]});
    const animated=index.query({animated:true}).entries[0];expect(animated.animation.clips).toMatchObject([
      {name:'Open lid',index:0,jsonPointer:'/animations/0',durationSeconds:3},
      {name:null,index:1,jsonPointer:'/animations/1',durationSeconds:null},
      {name:'',index:2,jsonPointer:'/animations/2',durationSeconds:null},
    ]);
    expect(index.query({query:'   ',animated:true}).entries[0].animation.clips.map(clip=>clip.index)).toEqual([0,1,2]);
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

test('published part IDs and a unique late name are searchable without reading geometry again',async()=>{
  const root=await mkdtemp(join(tmpdir(),'asset-part-search-'));
  try{
    const fixtures=join(root,'fixtures');await mkdir(fixtures);
    const bytes=await createModelGLB({parts:Array.from({length:40},(_,i)=>({name:i===39?'ZephyrRotorArm':'long-component-description-'.repeat(8)+i,
      vertices:[[0,0,0],[1,0,0],[0,1,0]] as [number,number,number][],triangles:[[0,1,2]] as [number,number,number][]}))});
    const published=await new ModelAssets(join(root,'models')).publish(bytes,{source:'Generic assembly fixture',license:'CC0-1.0'});
    const index=await createLocalAssetIndex({fixtureRoot:fixtures,modelDirectory:join(root,'models'),dataRoots:[]}),reads=index.metrics().metadataReads;
    for(const query of ['ZephyrRotorArm','node-39']){
      const result=index.query({query,format:'published-glb',animated:false});expect(result.total).toBe(1);
      expect(result.entries[0].assetId).toBe(published.id);expect(result.entries[0].parts).toBe(40);
      const cached=index.query({query,format:'published-glb',animated:false});expect(cached.metrics.cacheHit).toBe(true);
      cached.entries[0].title='mutated';expect(index.select(result.entries[0].id).title).not.toBe('mutated');
    }
    expect(index.query({query:'ZephyrRotorArm',format:'native-model'}).total).toBe(0);
    expect(index.query({query:'ZephyrRotorArm',animated:true}).total).toBe(0);
    expect(index.metrics().metadataReads).toBe(reads);
    const loaded=await index.loadPublishedModels([index.query({query:'ZephyrRotorArm'}).entries[0].id]);
    expect(loaded.assets[published.id].metadata.parts[39]).toMatchObject({id:'node-39',name:'ZephyrRotorArm'});
  }finally{await rm(root,{recursive:true,force:true});}
});

test('native package named part IDs beyond the first 24 resolve the actual validated package',async()=>{
  const root=await mkdtemp(join(tmpdir(),'native-part-search-'));
  try{
    const hash=(value:string|Uint8Array)=>createHash('sha256').update(value).digest('hex');
    const positions=new Uint8Array(new Float32Array([0,0,0,1,0,0,0,1,0]).buffer),indices=new Uint8Array(new Uint32Array([0,1,2]).buffer);
    await writeFile(join(root,'positions.bin'),positions);await writeFile(join(root,'indices.bin'),indices);
    const content={kind:'model',version:1,id:'assembly',units:'illustrative',provenance:{source:'Original test fixture',sourceHash:'a'.repeat(64),creator:'test',license:'CC0-1.0',preparedAt:'2026-01-01',converter:{name:'test',version:'1',options:{}},selection:'all',modifications:[],fidelity:'Mechanical fixture, not a scientific representation.'},
      parts:Array.from({length:40},(_,i)=>({id:i===39?'ZephyrNativeRotor':'piece-'+i,vertexCount:3,triangleCount:1,
        positions:{path:'positions.bin',hash:hash(positions),byteLength:positions.byteLength},indices:{path:'indices.bin',hash:hash(indices),byteLength:indices.byteLength}}))};
    await writeFile(join(root,'assembly.json'),JSON.stringify({...content,hash:hash(canonicalAssetJSON(content))}));
    const index=await createLocalAssetIndex({fixtureRoot:root,modelDirectory:null,dataRoots:[]}),before=index.metrics();
    const result=index.query({query:'ZephyrNativeRotor',format:'native-model'});expect(result.total).toBe(1);
    expect(result.entries[0].assetId).toBe('assembly');expect(index.metrics().metadataReads).toBe(before.metadataReads);
    const registry=await index.loadNativeRegistry([result.entries[0].id]);
    const descriptor=registry.catalog.find(asset=>asset.kind==='model');expect(descriptor?.kind==='model'&&descriptor.parts.some(part=>part.id==='ZephyrNativeRotor')).toBe(true);
  }finally{await rm(root,{recursive:true,force:true});}
});

test('all 128 clip names and data keys beyond the preview are searchable without implying playback',async()=>{
  const root=await mkdtemp(join(tmpdir(),'clip-name-search-'));
  try{
    const names=Array.from({length:128},(_,i)=>'long descriptive motion prefix '.repeat(5)+'QuasarLatch'+i);
    await writeFile(join(root,'mechanical.gltf'),JSON.stringify({asset:{version:'2.0'},accessors:[{min:[0],max:[2]}],animations:names.map(name=>({name,samplers:[{input:0}],channels:[]}))}));
    const keys=Object.fromEntries(Array.from({length:80},(_,i)=>[i===79?'FluxInvariantSeries':'priorKey'+i,[i]]));
    await writeFile(join(root,'samples.json'),JSON.stringify(keys));
    const index=await createLocalAssetIndex({fixtureRoot:root,modelDirectory:null,dataRoots:[root]}),before=index.metrics();
    for(let i=0;i<128;i++){
      const result=index.query({query:'QuasarLatch'+i,animated:true});expect(result.total).toBe(1);
      expect(result.entries[0].animation.clips.find(clip=>clip.index===i)).toMatchObject({name:names[i],index:i,jsonPointer:'/animations/'+i,durationSeconds:2});
      expect(result.entries[0].animation.clips.find(clip=>clip.index===i)?.path).toBe(join(root,'mechanical.gltf'));
      expect(result.entries[0].animation.omittedClips).toBe(128-result.entries[0].animation.clips.length);
      expect(Buffer.byteLength(JSON.stringify(result))).toBeLessThan(64_000);
      expect(result.entries[0].runtime).toMatchObject({liveWorld:false,clipPlayback:false,route:'needs-import-validation'});
    }
    const exact=index.query({query:names[127]}).entries[0];expect(exact.animation.clips[0].index).toBe(127);
    exact.animation.clips[0].name='caller mutation';expect(index.query({query:names[127]}).entries[0].animation.clips[0].name).toBe(names[127]);
    const selected=index.select(exact.id);expect(Buffer.byteLength(JSON.stringify(selected))).toBeLessThanOrEqual(28_000);
    expect(selected.animation.omittedClips).toBe(128-selected.animation.clips.length);
    expect(index.query({query:'QuasarLatch127',animated:false}).total).toBe(0);
    const result=index.query({query:'FluxInvariantSeries',kind:'data'});expect(result.total).toBe(1);
    expect(result.entries[0].data?.keys).toHaveLength(64);expect(result.entries[0].data?.keys).not.toContain('FluxInvariantSeries');
    expect(index.metrics().metadataReads).toBe(before.metadataReads);expect(index.metrics().bytesRead).toBe(before.bytesRead);
    expect(JSON.parse((await index.readData(result.entries[0].id)).content).FluxInvariantSeries).toEqual([79]);
    await expect(index.loadPublishedModels([index.query({animated:true}).entries[0].id])).rejects.toThrow(/supported/i);
  }finally{await rm(root,{recursive:true,force:true});}
});

test('literal short and punctuation-sensitive metadata names precede token matches with filters intact',async()=>{
  const root=await mkdtemp(join(tmpdir(),'literal-name-search-'));
  try{
    for(const [file,key] of [['a','C alpha'],['b','C-alpha'],['c','A'],['d','In'],['e','A']])await writeFile(join(root,file+'.json'),JSON.stringify({[key]:1,...(file==='a'?{'b.json':2}:{})}));
    const index=await createLocalAssetIndex({fixtureRoot:root,modelDirectory:null,dataRoots:[root]}),before=index.metrics();
    expect(index.query({query:'C-alpha'}).entries[0].assetId).toBe('b.json');
    const first=index.query({query:' A ',limit:1});expect(first.total).toBe(2);expect(first.nextOffset).toBe(1);
    expect(index.query({query:' A ',offset:1,limit:1}).entries[0].id).not.toBe(first.entries[0].id);
    expect(index.query({query:'In'}).total).toBe(1);expect(index.query({query:'A',kind:'model'}).total).toBe(0);
    expect(index.query({query:'A',animated:false}).total).toBe(0);
    expect(index.query({query:'In'}).metrics.cacheHit).toBe(true);expect(index.metrics().metadataReads).toBe(before.metadataReads);
    expect(index.query({query:'b.json'}).entries[0].assetId).toBe('b.json');
    const exactId=index.query({query:'C-alpha'}).entries[0].id;
    await writeFile(join(root,'a.json'),JSON.stringify({[exactId]:1}));
    const rebuilt=await createLocalAssetIndex({fixtureRoot:root,modelDirectory:null,dataRoots:[root]});
    expect(rebuilt.query({query:exactId}).entries[0].id).toBe(exactId);
  }finally{await rm(root,{recursive:true,force:true});}
});

test('search metadata overflow is explicit and bounded independently of metadata reads',async()=>{
  const root=await mkdtemp(join(tmpdir(),'search-name-limit-'));
  try{
    await writeFile(join(root,'wide.json'),JSON.stringify(Object.fromEntries(Array.from({length:1050},(_,i)=>['uniqueKey'+i,i]))));
    const index=await createLocalAssetIndex({fixtureRoot:root,modelDirectory:null,dataRoots:[root],maxBytes:1000000});
    const record=index.query({kind:'data'}).entries[0];
    expect(record.limitations.some(value=>/search.*omitted.*26/i.test(value))).toBe(true);
    expect(index.metrics().omittedSearchNames).toBe(26);expect(index.metrics().searchMetadataBytes).toBeLessThanOrEqual(1000000);
    expect(index.query({query:'uniqueKey1023'}).total).toBe(1);expect(index.query({query:'uniqueKey1049'}).total).toBe(0);
    const constrained=await createLocalAssetIndex({fixtureRoot:root,modelDirectory:null,dataRoots:[root],maxBytes:30000});
    expect(constrained.query({kind:'data'}).entries[0].limitations.some(value=>/search.*omitted/i.test(value))).toBe(true);
    expect(constrained.metrics().searchMetadataBytes).toBeLessThanOrEqual(30000);expect(constrained.metrics().omittedSearchNames).toBeGreaterThan(26);
  }finally{await rm(root,{recursive:true,force:true});}
});

test('compact clip detail retention obeys its aggregate budget and reports missing detail honestly',async()=>{
  const root=await mkdtemp(join(tmpdir(),'clip-budget-'));
  try{
    await writeFile(join(root,'m.gltf'),JSON.stringify({asset:{version:'2.0'},animations:Array.from({length:128},(_,i)=>({name:'Move'+i,samplers:[],channels:[]}))}));
    const index=await createLocalAssetIndex({fixtureRoot:root,modelDirectory:null,dataRoots:[],maxBytes:16000}),record=index.query({animated:true}).entries[0];
    expect(record).toBeDefined();expect(index.metrics().clipMetadataBytes).toBeLessThanOrEqual(16000);
    expect(index.metrics().omittedClipDetails).toBeGreaterThan(0);
    expect(record.animation.omittedClips).toBe(128-record.animation.clips.length);
    expect(record.limitations.some(value=>/clip detail memory budget omitted/i.test(value))).toBe(true);
    expect(record.runtime.clipPlayback).toBe(false);
  }finally{await rm(root,{recursive:true,force:true});}
});

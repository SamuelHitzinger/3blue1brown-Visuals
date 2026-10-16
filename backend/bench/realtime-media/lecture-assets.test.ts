import {expect,test} from 'bun:test';
import {createHash} from 'node:crypto';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {basename,join} from 'node:path';
import {createModelGLB} from 'animlib/core';
import {ModelAssets} from '../../src/model-assets.js';
import type {BundledModelContext} from '../../src/bundled-models.js';
import {createLocalAssetIndex} from './asset-index.js';
import {createLectureAssetSession} from './lecture-assets.js';

async function fixture(run:(value:{root:string;fixtures:string;store:ModelAssets;index:()=>ReturnType<typeof createLocalAssetIndex>})=>Promise<void>){
  const root=await mkdtemp(join(tmpdir(),'lecture-assets-')),fixtures=join(root,'fixtures');
  try{await mkdir(fixtures);await run({root,fixtures,store:new ModelAssets(join(root,'models')),index:()=>createLocalAssetIndex({fixtureRoot:fixtures,modelDirectory:join(root,'models'),dataRoots:[]})});}
  finally{await rm(root,{recursive:true,force:true});}
}
function triangle(name='triangle',count=1){
  return createModelGLB({parts:Array.from({length:count},(_,i)=>({name:count===1?name:`${name}-${i}`,vertices:[[0,0,0],[2,0,0],[0,3,0]] as [number,number,number][],triangles:[[0,1,2]] as [number,number,number][]}))});
}
function scientific(fidelity='Schematic residues, not atoms or folding dynamics.'):BundledModelContext{
  return {fixtureId:'test-protein',representation:'schematic beads',units:'angstrom',origin:[0,0,0],partMeaning:'One bead per residue; no atom resolution.',colorMeaning:'Neutral schematic color; not element identity.',provenance:{source:'test protein',sourceHash:'a'.repeat(64),creator:'test',license:'CC0-1.0',preparedAt:'2026-01-01',converter:{name:'fixture',version:'1',options:{}},selection:'single chain',modifications:['Hydrogens omitted.'],fidelity}};
}
function publicationRecord(index:Awaited<ReturnType<typeof createLocalAssetIndex>>,published:{id:string;asset:{sha256?:string;provenanceSha256?:string}}){
  const filename=`${published.asset.sha256}${published.asset.provenanceSha256?'.'+published.asset.provenanceSha256:''}.json`;
  return index.query({format:'published-glb'}).entries.find(record=>record.assetId===published.id&&basename(record.manifestPath!)===filename)!;
}

test('manifest addresses exact frozen GLB bytes without host paths or base64',()=>fixture(async f=>{
  const bytes=await triangle(),published=await f.store.publish(bytes,{source:'triangle',license:'CC0-1.0'}),index=await f.index();
  const session=await createLectureAssetSession(index),manifest=session.manifest(),asset=manifest.assets[published.id];
  expect(Object.keys(manifest.assets)).toEqual([published.id]);
  expect(asset.url).toBe('/lecture-assets/file?assetId='+encodeURIComponent(published.id));
  expect(asset.metadata).toEqual(published.asset.metadata);
  expect(createHash('sha256').update(session.file(published.id)!).digest('hex')).toBe(asset.sha256!);
  expect(session.file(published.id)).toEqual(Buffer.from(bytes));
  expect(JSON.stringify(manifest)).not.toContain(f.root);
  expect(JSON.stringify(manifest)).not.toContain(Buffer.from(bytes).toString('base64'));
  expect(session.file(index.query().entries[0].id)).toBeUndefined();
  expect(session.file('../unknown')).toBeUndefined();
  manifest.assets[published.id].metadata.parts[0].name='corrupted';session.file(published.id)!.fill(0);
  expect(session.manifest().assets[published.id].metadata.parts[0].name).toBe('triangle');
  await writeFile(index.query().entries[0].assetPath,'changed after startup');
  expect(session.file(published.id)).toEqual(Buffer.from(bytes));
}));

test('candidate search returns only frozen inventory matches and retains scientific meaning',()=>fixture(async f=>{
  const context=scientific(),published=await f.store.publish(await triangle(),{scientific:context});
  const other=await f.store.publish(await triangle('other'),{source:'excluded needle'}),index=await f.index();
  const chosen=publicationRecord(index,published);
  const session=await createLectureAssetSession(index,{ids:[chosen.id]}),result=session.candidates('protein');
  expect(result.assets).toHaveLength(1);
  expect(result.assets[0]).toMatchObject({assetId:published.id,dimensions:{units:'angstrom',size:[2,3,0]},counts:{parts:1,triangles:1},namedParts:[{id:published.asset.metadata.parts[0].id,name:'triangle'}],omittedParts:0,provenance:{scientific:context},clipPlayback:false});
  expect(result.assets[0].limitations).toContain(context.provenance.fidelity);
  expect(JSON.stringify(result)).not.toContain(f.root);
  result.assets[0].limitations.length=0;
  expect(session.candidates('protein').assets[0].limitations).toContain(context.provenance.fidelity);
  expect(session.candidates('excluded needle').assets).toEqual([]);
  expect(session.file(other.id)).toBeUndefined();
  for(const query of ['','   ','zzzzunmatched'])expect(session.candidates(query).assets).toEqual([]);
  expect(()=>session.candidates('x'.repeat(241))).toThrow();
}));

test('explicit selection rejects unknown, duplicate, too many and unsupported source IDs',()=>fixture(async f=>{
  await f.store.publish(await triangle());
  await writeFile(join(f.fixtures,'source.gltf'),JSON.stringify({asset:{version:'2.0'}}));
  const index=await f.index(),source=index.query({format:'source-gltf'}).entries[0],model=index.query({format:'published-glb'}).entries[0];
  await expect(createLectureAssetSession(index,{ids:['missing']})).rejects.toThrow();
  await expect(createLectureAssetSession(index,{ids:[source.id]})).rejects.toThrow(/supported|static|published/i);
  await expect(createLectureAssetSession(index,{ids:[model.id,model.id]})).rejects.toThrow();
  await expect(createLectureAssetSession(index,{ids:Array.from({length:5},(_,i)=>String(i))})).rejects.toThrow();
  expect((await createLectureAssetSession(index,{ids:[]})).manifest().assets).toEqual({});
}));

test('default inventory contains at most four unique published static models',()=>fixture(async f=>{
  for(let i=0;i<6;i++)await f.store.publish(await triangle('triangle-'+i));
  const session=await createLectureAssetSession(await f.index());
  expect(Object.keys(session.manifest().assets)).toHaveLength(4);
}));

test('stale bytes or provenance cannot build an inventory',()=>fixture(async f=>{
  const bytes=await triangle(),published=await f.store.publish(bytes,{scientific:scientific()}),index=await f.index();
  const selected=publicationRecord(index,published);
  const changed=Buffer.from(bytes);changed[changed.length-1]^=1;await writeFile(selected.assetPath,changed);
  await expect(createLectureAssetSession(index,{ids:[selected.id]})).rejects.toThrow(/changed|hash|identity/i);
  await writeFile(selected.assetPath,bytes);await writeFile(selected.manifestPath!,'{}');
  await expect(createLectureAssetSession(index,{ids:[selected.id]})).rejects.toThrow(/changed|hash|identity/i);
}));

test('combined UTF-8 candidate budget omits entire descriptors without shortening limitations',()=>fixture(async f=>{
  const fidelity='Molecular caveat: μ is schematic. '.repeat(130);
  for(let i=0;i<4;i++)await f.store.publish(await triangle('protein-'+i),{scientific:scientific(fidelity)});
  const session=await createLectureAssetSession(await f.index()),result=session.candidates('protein');
  expect(result.assets.length).toBeGreaterThan(0);expect(result.assets.length).toBeLessThan(4);
  expect(result.omittedAssets).toBe(4-result.assets.length);
  expect(Buffer.byteLength(JSON.stringify(result),'utf8')).toBeLessThanOrEqual(16000);
  for(const asset of result.assets){expect(asset.provenance.scientific!.provenance.fidelity).toBe(fidelity);expect(asset.limitations).toContain(fidelity);}
}));

test('inventory identity changes when scientific provenance changes for identical geometry',()=>fixture(async f=>{
  const bytes=await triangle(),first=await f.store.publish(bytes,{scientific:scientific()}),index=await f.index();
  const selected=publicationRecord(index,first);
  const a=await createLectureAssetSession(index,{ids:[selected.id]}),repeat=await createLectureAssetSession(index,{ids:[selected.id]});
  expect(repeat.manifest().inventoryId).toBe(a.manifest().inventoryId);
  const second=await f.store.publish(bytes,{scientific:scientific('Different validated limitations.')}),next=await f.index();
  const b=await createLectureAssetSession(next,{ids:[publicationRecord(next,second).id]});
  expect(b.manifest().inventoryId).not.toBe(a.manifest().inventoryId);
}));

test('repeated scientific publication excludes mutable base aliases and keeps each canonical context consistent',()=>fixture(async f=>{
  const bytes=await triangle(),contextA=scientific('Protein A is a schematic in angstroms.'),contextB=scientific('Protein B is a schematic in nanometres.');
  contextA.fixtureId='protein-a';contextB.fixtureId='protein-b';contextB.units='nanometre';
  const first=await f.store.publish(bytes,{scientific:contextA}),second=await f.store.publish(bytes,{scientific:contextB}),index=await f.index();
  const alias=index.query({format:'published-glb'}).entries.find(record=>basename(record.manifestPath!)===`${first.asset.sha256}.json`)!;
  expect(alias).toBeDefined();
  await expect(createLectureAssetSession(index,{ids:[alias.id]})).rejects.toThrow(/canonical|publication|sidecar/i);
  const session=await createLectureAssetSession(index),candidates=session.candidates('protein');
  expect(Object.keys(session.manifest().assets).sort()).toEqual([first.id,second.id].sort());
  expect(candidates.assets).toHaveLength(2);
  for(const [published,context] of [[first,contextA],[second,contextB]] as const){
    const descriptor=candidates.assets.find(asset=>asset.assetId===published.id)!;
    expect(descriptor.title).toContain(context.fixtureId);
    expect(descriptor.dimensions!.units).toBe(context.units);
    expect(descriptor.limitations).toContain(context.provenance.fidelity);
    expect(descriptor.provenance.scientific).toEqual(context);
    expect(session.candidates(context.fixtureId).assets.map(asset=>asset.assetId)).toContain(published.id);
  }
}));

test('large converter internals have an explicit omission receipt while complete scientific caveats survive',()=>fixture(async f=>{
  const context=scientific(),options={meshMapping:Array.from({length:12000},(_,i)=>i),validationWarnings:['Additional uninspected constraint.']};
  context.provenance.converter.options=options;
  const bytes=await triangle(),published=await f.store.publish(bytes,{scientific:context}),index=await f.index();
  const session=await createLectureAssetSession(index,{ids:[publicationRecord(index,published).id]}),result=session.candidates('protein');
  expect(result.assets).toHaveLength(1);expect(result.omittedAssets).toBe(0);
  const descriptor=result.assets[0],expected=structuredClone(context);
  delete (expected.provenance.converter as {options?:unknown}).options;
  expect(descriptor.provenance.scientific).toEqual(expected);
  expect(descriptor.limitations).toContain(context.provenance.fidelity);
  expect(descriptor.omittedDetails).toEqual([{path:'provenance.scientific.provenance.converter.options',bytes:Buffer.byteLength(JSON.stringify(options),'utf8'),sha256:createHash('sha256').update(JSON.stringify(options)).digest('hex'),notice:'Uninspected converter details were omitted and may contain additional constraints.'}]);
  expect(Buffer.byteLength(JSON.stringify(result),'utf8')).toBeLessThanOrEqual(16000);
  const changed=structuredClone(context);changed.provenance.converter.options.validationWarnings=['A changed hidden constraint.'];
  const next=await f.store.publish(bytes,{scientific:changed}),nextIndex=await f.index();
  const nextSession=await createLectureAssetSession(nextIndex,{ids:[publicationRecord(nextIndex,next).id]});
  expect(nextSession.manifest().inventoryId).not.toBe(session.manifest().inventoryId);
}));

test('named-part cap reports omitted parts and oversized scientific context is omitted whole',()=>fixture(async f=>{
  const published=await f.store.publish(await triangle('piece',40),{source:'many-parts'}),index=await f.index();
  const session=await createLectureAssetSession(index),result=session.candidates('many parts'),descriptor=result.assets[0];
  expect(descriptor.counts.parts).toBe(40);
  expect(descriptor.namedParts.length).toBeGreaterThan(0);
  expect(descriptor.namedParts.length).toBeLessThan(40);
  expect(descriptor.omittedParts).toBe(40-descriptor.namedParts.length);
  expect(descriptor.namedParts).toEqual(published.asset.metadata.parts.slice(0,descriptor.namedParts.length).map(({id,name})=>({id,name})));
  const large=scientific();large.partMeaning='Scientific limitation '.repeat(1500);
  const huge=await f.store.publish(await triangle('huge'),{scientific:large}),next=await f.index();
  const selected=publicationRecord(next,huge);
  const limited=await createLectureAssetSession(next,{ids:[selected.id]}),omitted=limited.candidates('protein');
  expect(omitted.assets).toEqual([]);expect(omitted.omittedAssets).toBe(1);
  expect(Buffer.byteLength(JSON.stringify(omitted),'utf8')).toBeLessThanOrEqual(16000);
}));

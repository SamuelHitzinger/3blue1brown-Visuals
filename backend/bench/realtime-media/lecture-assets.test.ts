import {expect,test} from 'bun:test';
import {createHash} from 'node:crypto';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {basename,join} from 'node:path';
import {createModelGLB} from 'animlib/core';
import {WebIO} from '@gltf-transform/core';
import {KHRMaterialsUnlit} from '@gltf-transform/extensions';
import {ModelAssets} from '../../src/model-assets.js';
import type {BundledModelContext} from '../../src/bundled-models.js';
import {createLocalAssetIndex} from './asset-index.js';
import {createLectureAssetSession} from './lecture-assets.js';
import {validateLectureModelInventory} from './inventory-sync.js';

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

test('frozen part lookup pages every exact ID and prioritizes late matches without changing identity',()=>fixture(async f=>{
  const published=await f.store.publish(await triangle('component',40),{source:'complex assembly'}),index=await f.index();
  const session=await createLectureAssetSession(index),before=session.manifest(),reads=index.metrics().metadataReads;
  const collected=[];
  for(let offset=0;;){
    const page=session.parts({assetId:published.id,offset,limit:13});
    expect(page.inventoryId).toBe(before.inventoryId);expect(page.total).toBe(40);
    collected.push(...page.parts);if(page.nextOffset===null)break;offset=page.nextOffset;
  }
  expect(collected).toEqual(published.asset.metadata.parts.map(({id,name})=>({id,name})));
  const result=session.parts({assetId:published.id,query:'component-39',limit:1});
  expect(result.parts).toEqual([collected[39]]);
  const candidates=session.candidates('component-39');
  expect(candidates.assets[0].namedParts[0]).toEqual(collected[39]);
  expect(candidates.assets[0].namedParts).toHaveLength(24);expect(candidates.assets[0].omittedParts).toBe(16);
  result.parts[0].name='corrupt';expect(session.parts({assetId:published.id,query:collected[39].id,limit:1}).parts[0]).toEqual(collected[39]);
  await writeFile(publicationRecord(index,published).assetPath,'changed after freeze');
  expect(session.parts({assetId:published.id,offset:39}).parts).toEqual([collected[39]]);
  expect(session.manifest()).toEqual(before);expect(index.metrics().metadataReads).toBe(reads);
  expect(session.parts({assetId:published.id,query:'zzunmatched'}).parts).toEqual([]);
  expect(session.parts({assetId:published.id,offset:256}).nextOffset).toBeNull();
  for(const request of [{assetId:'../unknown'},{assetId:published.id,query:'x'.repeat(241)},
    {assetId:published.id,offset:-1},{assetId:published.id,offset:257},{assetId:published.id,limit:0},
    {assetId:published.id,limit:21},{assetId:published.id,offset:0.5}])expect(()=>session.parts(request)).toThrow();
}));

test('part pages preserve duplicate names, bound encoded bytes, and continue without losing IDs',()=>fixture(async f=>{
  const io=new WebIO().registerExtensions([KHRMaterialsUnlit]),doc=await io.readBinary(await triangle('part',40));
  for(const node of doc.getRoot().listNodes())node.setName('\u0001'.repeat(250));
  const published=await f.store.publish(new Uint8Array(await io.writeBinary(doc))),session=await createLectureAssetSession(await f.index());
  const ids:string[]=[];
  for(let offset=0;;){
    const page=session.parts({assetId:published.id,offset,limit:20});
    expect(Buffer.byteLength(JSON.stringify(page),'utf8')).toBeLessThanOrEqual(16000);
    expect(page.parts.length).toBeGreaterThan(0);expect(page.parts.length).toBeLessThan(20);
    ids.push(...page.parts.map(part=>part.id));
    for(const part of page.parts)expect(part.name).toBe('\u0001'.repeat(250));
    if(page.nextOffset===null)break;expect(page.nextOffset).toBeGreaterThan(offset);offset=page.nextOffset;
  }
  expect(ids).toEqual(published.asset.metadata.parts.map(part=>part.id));
  expect(new Set(ids).size).toBe(40);
}));

test('literal short and punctuation-bearing part names outrank token matches without merging duplicates',()=>fixture(async f=>{
  const io=new WebIO().registerExtensions([KHRMaterialsUnlit]),doc=await io.readBinary(await triangle('part',40));
  const names=Array.from({length:40},(_,i)=>i===38?'A':i===39?'In':i===37?'C-alpha':i===36?'A':'C alpha');
  doc.getRoot().listNodes().forEach((node,i)=>node.setName(names[i]));
  const published=await f.store.publish(new Uint8Array(await io.writeBinary(doc))),session=await createLectureAssetSession(await f.index());
  for(const query of ['A','In','C-alpha']){
    const expected=published.asset.metadata.parts.filter(part=>part.name===query).map(({id,name})=>({id,name}));
    expect(session.parts({assetId:published.id,query}).parts.slice(0,expected.length)).toEqual(expected);
    expect(session.candidates(query).assets[0].namedParts.slice(0,expected.length)).toEqual(expected);
  }
}));

test('exact part IDs take precedence over another part named with the same ID',()=>fixture(async f=>{
  const io=new WebIO().registerExtensions([KHRMaterialsUnlit]),doc=await io.readBinary(await triangle('part',40));
  doc.getRoot().listNodes()[0].setName('node-39');
  const published=await f.store.publish(new Uint8Array(await io.writeBinary(doc))),session=await createLectureAssetSession(await f.index());
  const result=session.parts({assetId:published.id,query:'node-39'});
  expect(result.parts[0].id).toBe('node-39');expect(result.parts[1]).toEqual({id:'node-0',name:'node-39'});
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

test('append admits later publications while preserving snapshots, old bytes and inventory ancestry',()=>fixture(async f=>{
  const firstBytes=await triangle('first'),first=await f.store.publish(firstBytes,{source:'first model'});
  const session=await createLectureAssetSession(await f.index()),before=session.manifest();
  expect(before.revision).toBe(0);
  const context=scientific(),bytes=await triangle('later'),later=await f.store.publish(bytes,{scientific:context}),next=await f.index();
  const after=await session.append(next,[publicationRecord(next,later).id]);
  expect(after.revision).toBe(1);expect(after.inventoryId).not.toBe(before.inventoryId);
  expect(session.knowsInventory(before.inventoryId)).toBe(true);expect(session.knowsInventory(after.inventoryId)).toBe(true);
  expect(session.knowsInventory('0'.repeat(64))).toBe(false);
  expect(Object.keys(before.assets)).toEqual([first.id]);expect(Object.keys(after.assets).sort()).toEqual([first.id,later.id].sort());
  expect(session.file(first.id)).toEqual(Buffer.from(firstBytes));expect(session.file(later.id)).toEqual(Buffer.from(bytes));
  expect(session.file('unknown')).toBeUndefined();
  expect(session.candidates('protein')).toMatchObject({inventoryId:after.inventoryId,assets:[{assetId:later.id,provenance:{scientific:context}}]});
  expect(session.candidates('first model').assets.map(asset=>asset.assetId)).toContain(first.id);
  expect(await session.append(next,[publicationRecord(next,later).id])).toEqual(after);
  after.assets[later.id].metadata.parts[0].name='corrupt';expect(session.manifest().assets[later.id].metadata.parts[0].name).toBe('later');
}));

test('append rejects stale batches and cancellation before publishing any member',()=>fixture(async f=>{
  const session=await createLectureAssetSession(await f.index(),{ids:[]}),before=session.manifest();
  const good=await f.store.publish(await triangle('good')),bad=await f.store.publish(await triangle('bad')),next=await f.index();
  const ids=[publicationRecord(next,good).id,publicationRecord(next,bad).id];
  await writeFile(publicationRecord(next,bad).assetPath,'changed');
  await expect(session.append(next,ids)).rejects.toThrow(/changed|hash/i);
  expect(session.manifest()).toEqual(before);expect(session.file(good.id)).toBeUndefined();
  const controller=new AbortController();
  await expect(session.append(next,[ids[0]],{signal:controller.signal,beforeCommit:()=>controller.abort(Error('deadline'))})).rejects.toThrow(/deadline/);
  expect(session.manifest()).toEqual(before);expect(session.candidates('good').assets).toEqual([]);
  await expect(session.append(next,[ids[0]],{beforeCommit:()=>{throw Error('expired');}})).rejects.toThrow(/expired/);
  expect(session.manifest()).toEqual(before);
}));

test('append rejects changed provenance under an existing runtime identity',()=>fixture(async f=>{
  const bytes=await triangle(),first=await f.store.publish(bytes,{source:'original',license:'CC0-1.0'});
  const session=await createLectureAssetSession(await f.index()),before=session.manifest();
  const changed=await f.store.publish(bytes,{source:'changed'}),good=await f.store.publish(await triangle('good')),next=await f.index();
  expect(changed.id).toBe(first.id);
  await expect(session.append(next,[publicationRecord(next,good).id,publicationRecord(next,changed).id])).rejects.toThrow(/immutable|conflict/i);
  expect(session.manifest()).toEqual(before);expect(session.file(good.id)).toBeUndefined();
  expect(session.candidates('original').assets[0].provenance.source).toBe('original');
}));

test('concurrent appends merge against the latest inventory without losing either publication',()=>fixture(async f=>{
  const session=await createLectureAssetSession(await f.index(),{ids:[]});
  const a=await f.store.publish(await triangle('a'),{source:'alpha'}),b=await f.store.publish(await triangle('b'),{source:'beta'}),next=await f.index();
  let release!:()=>void,entered!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;}),started=new Promise<void>(resolve=>{entered=resolve;});
  // Real file validation/loading still runs; only one I/O completion is held to force the race.
  const slow={...next,loadPublishedModels:async(ids:string[])=>{const result=await next.loadPublishedModels(ids);entered();await gate;return result;}};
  const pending=session.append(slow,[publicationRecord(next,a).id]);await started;
  const middle=await session.append(next,[publicationRecord(next,b).id]);release();const after=await pending;
  expect(middle.revision).toBe(1);expect(after.revision).toBe(2);expect(session.knowsInventory(middle.inventoryId)).toBe(true);
  expect(Object.keys(after.assets).sort()).toEqual([a.id,b.id].sort());
  expect(session.candidates('alpha').assets[0].assetId).toBe(a.id);expect(session.candidates('beta').assets[0].assetId).toBe(b.id);
}));

test('append separates the four-item batch limit from the 64-asset lifetime limit',()=>fixture(async f=>{
  const publications=[];for(let i=0;i<65;i++)publications.push(await f.store.publish(await triangle('asset-'+i),{source:'limit test'}));
  const next=await f.index(),records=[];
  for(let offset=0;offset<65;offset+=20)records.push(...next.query({format:'published-glb',offset,limit:20}).entries);
  const session=await createLectureAssetSession(next,{ids:[]});
  await expect(session.append(next,records.slice(0,5).map(record=>record.id))).rejects.toThrow(/four|4/i);
  for(let offset=0;offset<64;offset+=4)await session.append(next,records.slice(offset,offset+4).map(record=>record.id));
  const before=session.manifest();expect(Object.keys(before.assets)).toHaveLength(64);
  await expect(session.append(next,[records[64].id])).rejects.toThrow(/64|limit/i);
  expect(session.manifest()).toEqual(before);expect(session.file(records[64].assetId)).toBeUndefined();
  expect(await session.append(next,[records[0].id])).toEqual(before);
}));

for(const budget of ['bytes','nodes'] as const)test(`append rejects cumulative browser ${budget} overflow before publishing its inventory`,()=>fixture(async f=>{
  // Real static publications have individually valid, maximal part inventories.
  // Long UTF-8 names hit the wire budget first; short names hit the node budget.
  const count=budget==='bytes'?12:40;
  for(let i=0;i<count;i++){
    const io=new WebIO().registerExtensions([KHRMaterialsUnlit]);
    const doc=await io.readBinary(await triangle((budget==='bytes'?'界'.repeat(245):'part')+i,128)),scene=doc.getRoot().getDefaultScene()!;
    // Imported models support 256 nodes; the convenience generator is capped at 128.
    for(const node of scene.listChildren())scene.addChild(doc.createNode(node.getName()).setMesh(node.getMesh()));
    await f.store.publish(new Uint8Array(await io.writeBinary(doc)));
  }
  const next=await f.index(),records=[];
  for(let offset=0;offset<count;offset+=20)records.push(...next.query({format:'published-glb',offset,limit:20}).entries);
  const session=await createLectureAssetSession(next,{ids:[]});let failed=false;
  for(const record of records){
    const before=session.manifest();
    expect(()=>validateLectureModelInventory(before)).not.toThrow();
    const candidate=await createLectureAssetSession(next,{ids:[record.id]});
    const combined={...before,revision:before.revision+1,assets:{...before.assets,...candidate.manifest().assets}};
    let browserRejects=false;try{validateLectureModelInventory(combined);}catch{browserRejects=true;}
    if(!browserRejects){await session.append(next,[record.id]);continue;}
    // Independently identify which envelope limit the constructed real metadata hits.
    const bytes=Buffer.byteLength(JSON.stringify(combined),'utf8');
    expect(bytes>2*1024*1024).toBe(budget==='bytes');
    let guardCalled=false;
    await expect(session.append(next,[record.id],{beforeCommit:()=>{guardCalled=true;}})).rejects.toThrow(/inventory/i);
    expect(guardCalled).toBe(false);
    expect(session.manifest()).toEqual(before);expect(()=>validateLectureModelInventory(session.manifest())).not.toThrow();
    expect(session.file(record.assetId)).toBeUndefined();failed=true;break;
  }
  expect(failed).toBe(true);
}));

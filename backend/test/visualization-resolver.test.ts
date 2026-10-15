import {expect,test} from 'bun:test';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {createVisualizationResolver} from '../src/visualization-resolver.js';
import {loadAuthoringContext} from '../src/agents/authoring-reference.js';
import {createReferenceTools} from '../src/agents/reference-tools.js';
import {prepareBundledModel} from '../src/bundled-models.js';
import {ModelAssets} from '../src/model-assets.js';
const signal=()=>new AbortController().signal;

test('selected construction code resolves to the exact immutable reference bytes',async()=>{
  const referenceTools=createReferenceTools((await loadAuthoringContext()).sections);
  const tools=createVisualizationResolver({referenceTools});
  const result=await tools.resolve({catalogId:'mechanical-modes',requiredCapabilities:['s.modalState']},signal());
  expect(result.status).toBe('ready');expect(result.compatibility.compatible).toBe(true);
  const ref=result.packageRefs[0];expect(ref.kind).toBe('code');expect(ref.id).toBe('scientific-modal-state');
  const page=await referenceTools.read({id:ref.id},signal());
  expect(ref.sha256).toBe(createHash('sha256').update(page.content).digest('hex'));
  expect(result.limitations.length).toBeGreaterThan(0);expect(Buffer.byteLength(JSON.stringify(result))).toBeLessThanOrEqual(28000);
});

test('local schematic data is validated, hash pinned, and available only after selection',async()=>{
  const tools=createVisualizationResolver();
  await expect(tools.read({id:'transcription-cycle',sha256:'0'.repeat(64)},signal())).rejects.toThrow();
  const result=await tools.resolve({catalogId:'nucleic-example-inputs',selection:{dataId:'transcription-cycle'}},signal());
  expect(result.status).toBe('ready');const ref=result.packageRefs[0];expect(ref.kind).toBe('data');
  let content='',offset=0;
  do {const page=await tools.read({id:ref.id,sha256:ref.sha256!,offset,limit:1000},signal());content+=page.content;if(page.nextOffset===undefined)break;offset=page.nextOffset;}while(true);
  expect(JSON.parse(content).template[0]).toEqual({id:'template-0',base:'A'});
  expect(createHash('sha256').update(content).digest('hex')).toBe(ref.sha256!);
  expect(content).toBe(await readFile(new URL('../../shared/animlib/demo/expansion/inputs/transcription-cycle.json',import.meta.url),'utf8'));
  await expect(tools.read({id:ref.id,sha256:'0'.repeat(64)},signal())).rejects.toThrow();
  const splice=await tools.resolve({catalogId:'nucleic-example-inputs',selection:{dataId:'rna-processing-splice'}},signal());
  expect(splice.status).toBe('ready');expect(splice.packageRefs[0].usage).toContain('.props');
  const wrong=await tools.resolve({catalogId:'nucleic-example-inputs',selection:{dataId:'rna-processing-splice'},requiredCapabilities:['s.nucleicTranscriptionCycle']},signal());
  expect(wrong.status).toBe('unsupported');expect(wrong.compatibility.compatible).toBe(false);
  expect((await tools.resolve({catalogId:'nucleic-example-inputs',requiredCapabilities:['s.nucleicSplice']},signal())).status).toBe('needs-input');
});

test('missing input and unavailable animation/data routes do not publish or claim readiness',async()=>{
  let calls=0;const tools=createVisualizationResolver({publishModel:async()=>{calls++;throw Error('Must not publish');}});
  expect((await tools.resolve({catalogId:'pdb-structures',prepare:true},signal())).status).toBe('needs-input');
  expect((await tools.resolve({catalogId:'crambin-1crn',selection:{fixtureId:'1crn-beads'}},signal())).status).toBe('preparation-required');
  for(const capability of ['gltf.animation','gltf.skin','gltf.morph','s.notReal']){
    const result=await tools.resolve({catalogId:'crambin-1crn',requiredCapabilities:[capability],prepare:true,selection:{fixtureId:'1crn-beads'}},signal());
    expect(result.status).toBe('unsupported');expect(result.compatibility.missing).toEqual([capability]);expect(result.packageRefs).toEqual([]);
  }
  for(const catalogId of ['horizons-ephemerides','usgs-elevation-data','native-model-packages','peptide-motion-data']){
    const result=await tools.resolve({catalogId},signal());expect(result.status).toBe('unsupported');expect(result.compatibility.compatible).toBe(false);expect(result.packageRefs).toEqual([]);
  }
  expect(calls).toBe(0);
});

test('owning job cancellation reaches active publication and prevents later resource reads',async()=>{
  const job=new AbortController(),started=Promise.withResolvers<void>();
  const tools=createVisualizationResolver({signal:job.signal,publishModel:async(_input,workSignal)=>{
    started.resolve();return new Promise((_resolve,reject)=>workSignal.addEventListener('abort',()=>reject(workSignal.reason),{once:true}));
  }});
  const active=tools.resolve({catalogId:'crambin-1crn',selection:{fixtureId:'1crn-beads'},prepare:true},signal());void active.catch(()=>{});
  await started.promise;job.abort(new Error('job stopped'));await expect(active).rejects.toThrow('job stopped');
  await expect(tools.resolve({catalogId:'nucleic-example-inputs'},signal())).rejects.toThrow('job stopped');
});

test('model publication is real, concurrent reuse is job scoped, and aborting one waiter is isolated',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'resolve-model-'));
  try {
    const store=new ModelAssets(directory);let calls=0;
    const publishModel=async(input:{fixtureId?:string})=>{calls++;const p=await prepareBundledModel(input.fixtureId!);const published=await store.publish(p.bytes,{scientific:p.context});return {id:published.id,...published.asset.metadata};};
    const tools=createVisualizationResolver({publishModel});
    const input={catalogId:'crambin-1crn',selection:{fixtureId:'1crn-beads'},prepare:true};
    const controller=new AbortController();const cancelled=tools.resolve(input,controller.signal);void cancelled.catch(()=>{});
    const active=tools.resolve(input,signal());controller.abort(new Error('cancelled'));
    await expect(cancelled).rejects.toThrow('cancelled');
    const result=await active;expect(result.status).toBe('ready');expect(result.packageRefs[0].id).toMatch(/^model-[a-f0-9]{64}/);
    expect(result.packageRefs[0].model).toHaveProperty('parts');
    result.packageRefs[0].id='mutated';expect((await tools.resolve(input,signal())).packageRefs[0].id).not.toBe('mutated');expect(calls).toBe(1);
    await createVisualizationResolver({publishModel}).resolve(input,signal());expect(calls).toBe(2);
  } finally {await rm(directory,{recursive:true,force:true});}
});

test('resolver rejects mismatched selections and failed publications can retry',async()=>{
  let calls=0;const tools=createVisualizationResolver({publishModel:async()=>{if(++calls===1)throw Error('transient');return {id:'model-valid'};}});
  for(const selection of [{fixtureId:'1crn-beads',pdbId:'1CRN'},{fixtureId:'../../outside'},{pdbId:'fake-accession'}])
    await expect(tools.resolve({catalogId:'crambin-1crn',selection,prepare:true},signal())).rejects.toThrow();
  const input={catalogId:'crambin-1crn',selection:{fixtureId:'1crn-beads'},prepare:true};
  await expect(tools.resolve(input,signal())).rejects.toThrow('transient');
  expect((await tools.resolve(input,signal())).status).toBe('ready');expect(calls).toBe(2);
});

test('PDB selections normalize identity without changing representation or exposing private references',async()=>{
  const requested:unknown[]=[];
  const tools=createVisualizationResolver({publishModel:async input=>{requested.push(input);return {id:'model-selected'};}});
  await tools.resolve({catalogId:'pdb-structures',selection:{pdbId:'1crn',pdbChains:['B','A','A'],pdbRepresentation:'backbone'},prepare:true},signal());
  await tools.resolve({catalogId:'pdb-structures',selection:{pdbId:'1CRN',pdbChains:['A','B'],pdbRepresentation:'backbone'},prepare:true},signal());
  expect(requested).toEqual([{pdbId:'1CRN',pdbChains:['A','B'],pdbRepresentation:'backbone'}]);
  await tools.resolve({catalogId:'pdb-structures',selection:{pdbId:'1CRN',pdbChains:['A','B']},prepare:true},signal());
  expect(requested[1]).toEqual({pdbId:'1CRN',pdbChains:['A','B'],pdbRepresentation:'mixed'});
  for(const id of ['lecture-evidence','../../private','mechanical-modes'])await expect(tools.read({id,sha256:'0'.repeat(64)},signal())).rejects.toThrow();
  await expect(tools.resolve({catalogId:'lecture-evidence'},signal())).rejects.toThrow();
});

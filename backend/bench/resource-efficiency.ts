/** Actual local resource retrieval/preparation. No remote data, LLM, or rendering speed claims. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {searchCatalog} from '../src/visualization-catalog.js';
import {createVisualizationResolver} from '../src/visualization-resolver.js';
import {createBundledModelPreparer,BUNDLED_PUBLICATION_VERSION,describeBundledModel} from '../src/bundled-models.js';
import {ModelAssets} from '../src/model-assets.js';
import {createReferenceTools} from '../src/agents/reference-tools.js';
import {loadAuthoringContext} from '../src/agents/authoring-reference.js';
import type {ResourceResolveInput} from '../src/visualization-resolver.js';
const hash=(value:string|Uint8Array)=>createHash('sha256').update(value).digest('hex');
const signal=()=>new AbortController().signal;
const summarize=(values:number[])=>{
  const sorted=[...values].sort((a,b)=>a-b);
  return {samples:values.length,p50Ms:+sorted[Math.ceil(sorted.length*.5)-1].toFixed(4),p95Ms:+sorted[Math.ceil(sorted.length*.95)-1].toFixed(4)};
};
export const RESOURCE_RETRIEVAL_CASES=[
  {intent:'move a fixed shape without stretching it',expected:'rigid-molecular-motion',capabilities:['s.rigidMotion']},
  {intent:'show two waves cancel each other',expected:'waves-interference',capabilities:['s.complexInterference']},
  {intent:'keep track of material moving between containers',expected:'reaction-transport',capabilities:['s.conservativeTransport']},
  {intent:'show a spring ringing after a push',expected:'mechanical-modes',capabilities:['s.modalState']},
  {intent:'turn spike times into a firing rate',expected:'neural-event-rates',capabilities:['s.eventRates']},
  {intent:'use deposited protein coordinates',expected:'pdb-structures',capabilities:['s.model']},
  {intent:'illustrate nucleotide transcription',expected:'nucleic-example-inputs',capabilities:['s.nucleicTranscriptionCycle']},
  // Held-out wordings exercise vocabulary combinations rather than a repeated exact query.
  {intent:'combine waves with a different phase',expected:'waves-interference',capabilities:['s.complexInterference']},
  {intent:'material flow between stocks',expected:'reaction-transport',capabilities:['s.conservativeTransport']},
  {intent:'oscillating spring resonance',expected:'mechanical-modes',capabilities:['s.modalState']},
] as const;

async function persistentCheck(directory:string){
  const preparer=createBundledModelPreparer({directory}),start=performance.now(),value=await preparer.prepare('1crn-beads');
  return {preparationMs:performance.now()-start,conversions:preparer.stats().conversions,sha256:hash(value.bytes),bytes:value.bytes.length};
}
export async function runResourceEfficiencyBenchmark(){
  const workspace=await mkdtemp(join(tmpdir(),'resource-efficiency-'));
  try{
    const sourceFiles=['src/visualization-catalog.ts','src/visualization-resolver.ts','src/bundled-models.ts','src/prepared-artifacts.ts',
      '../shared/animlib/catalog/types.ts','../shared/animlib/catalog/index.json','../shared/animlib/catalog/navigation.md',
      ...['resource','technique','foundation','science','data-sources'].map(id=>`../shared/animlib/catalog/indexes/${id}.json`),'bench/resource-efficiency.ts'];
    const sources=Object.fromEntries(await Promise.all(sourceFiles.map(async file=>[file,hash(await readFile(new URL('../'+file,import.meta.url)))])));
    const queries=[];let falselyCompatible=0;
    for(const fixture of RESOURCE_RETRIEVAL_CASES){
      const samples:number[]=[];let result:Awaited<ReturnType<typeof searchCatalog>>|undefined;
      for(let i=0;i<30;i++){const start=performance.now();result=await searchCatalog({intent:fixture.intent,capabilities:[...fixture.capabilities],limit:3});samples.push(performance.now()-start);}
      const top3=result!.entries.map(entry=>entry.id);
      falselyCompatible+=result!.entries.filter(entry=>fixture.capabilities.some(capability=>!entry.capabilities?.includes(capability))).length;
      assert(top3.includes(fixture.expected),`Missing supported intent: ${fixture.intent}`);
      queries.push({...fixture,top3,top1Correct:top3[0]===fixture.expected,bytes:Buffer.byteLength(JSON.stringify(result)),latency:summarize(samples)});
    }
    for(const capability of ['gltf.animation','gltf.skin','gltf.morph','s.modal','s.notInstalled']){
      assert.equal((await searchCatalog({intent:'molecular structure or motion',capabilities:[capability]})).total,0);
    }
    assert.equal(falselyCompatible,0);
    const referenceTools=createReferenceTools((await loadAuthoringContext()).sections),resolver=createVisualizationResolver({referenceTools});
    const cases:{input:ResourceResolveInput;status:string}[]=[
      ...['mechanical-modes','reaction-transport','ecological-flows','waves-interference','signals-fourier','neural-event-rates','rigid-molecular-motion'].map(catalogId=>({input:{catalogId},status:'ready'})),
      ...['transcription-cycle','rna-processing-splice'].map(dataId=>({input:{catalogId:'nucleic-example-inputs',selection:{dataId}},status:'ready'})),
      {input:{catalogId:'pdb-structures',prepare:true},status:'needs-input'},
      ...['horizons-ephemerides','usgs-elevation-data','native-model-packages','peptide-motion-data'].map(catalogId=>({input:{catalogId},status:'unsupported'})),
      {input:{catalogId:'crambin-1crn',requiredCapabilities:['gltf.animation'],selection:{fixtureId:'1crn-beads'},prepare:true},status:'unsupported'},
    ];
    const resolutions=[];
    for(const fixture of cases){
      const start=performance.now(),packet=await resolver.resolve(fixture.input,signal()),coldMs=performance.now()-start;
      assert.equal(packet.status,fixture.status);
      const samples:number[]=[];
      for(let i=0;i<10;i++){const start=performance.now();await resolver.resolve(fixture.input,signal());samples.push(performance.now()-start);}
      for(const ref of packet.packageRefs){
        let content='',offset=0;
        do{
          const page=ref.kind==='code'?await referenceTools.read({id:ref.id,offset},signal()):await resolver.read({id:ref.id,sha256:ref.sha256!,offset},signal());
          content+=page.content;if(page.nextOffset===undefined)break;offset=page.nextOffset;
        }while(true);
        assert.equal(hash(content),ref.sha256,'Package ref resolves exact hashed bytes');
      }
      resolutions.push({catalogId:fixture.input.catalogId,selection:fixture.input.selection,status:packet.status,
        refs:packet.packageRefs.map(({kind,id,sha256})=>({kind,id,sha256})),bytes:Buffer.byteLength(JSON.stringify(packet)),coldMs:+coldMs.toFixed(4),warm:summarize(samples)});
    }
    const cold:number[]=[],warm:number[]=[],disk:number[]=[],conversions:number[]=[],hashes:string[]=[];
    let cacheDirectory='';
    for(let i=0;i<5;i++){
      cacheDirectory=join(workspace,'prepared-'+i);const preparer=createBundledModelPreparer({directory:cacheDirectory});
      let start=performance.now();const values=await Promise.all(Array.from({length:4},()=>preparer.prepare('1crn-beads')));cold.push(performance.now()-start);
      assert(values.every(value=>hash(value.bytes)===hash(values[0].bytes)));hashes.push(hash(values[0].bytes));conversions.push(preparer.stats().conversions);assert.equal(preparer.stats().conversions,1);
      for(let j=0;j<10;j++){start=performance.now();await preparer.prepare('1crn-beads');warm.push(performance.now()-start);}
      const fresh=createBundledModelPreparer({directory:cacheDirectory});start=performance.now();const fromDisk=await fresh.prepare('1crn-beads');disk.push(performance.now()-start);
      assert.equal(fresh.stats().conversions,0);assert.equal(hash(fromDisk.bytes),hash(values[0].bytes));
    }
    assert.equal(new Set(hashes).size,1);
    const childStart=performance.now();
    const restarted=JSON.parse(execFileSync(process.execPath,[fileURLToPath(import.meta.url),'--persistent-check',cacheDirectory],{encoding:'utf8',timeout:30_000}));
    const childWallMs=performance.now()-childStart;
    assert.equal(restarted.conversions,0);assert.equal(restarted.sha256,hashes[0]);
    const preparer=createBundledModelPreparer({directory:cacheDirectory}),models=new ModelAssets(join(workspace,'models'));let publications=0;
    const publishModel=async(input:{fixtureId?:string})=>{
      publications++;const prepared=await preparer.prepare(input.fixtureId!),published=await models.publish(prepared.bytes,{scientific:prepared.context});
      return {id:published.id,...published.asset.metadata,context:describeBundledModel(prepared.context)};
    };
    const job=createVisualizationResolver({publishModel}),input={catalogId:'crambin-1crn',selection:{fixtureId:'1crn-beads'},prepare:true};
    const published=await Promise.all(Array.from({length:4},()=>job.resolve(input,signal())));await job.resolve(input,signal());
    assert.equal(publications,1);assert(published.every(packet=>packet.packageRefs[0].id===published[0].packageRefs[0].id));
    await createVisualizationResolver({publishModel}).resolve(input,signal());assert.equal(publications,2);
    return {kind:'local-resource-efficiency',runtime:process.version,publicationVersion:BUNDLED_PUBLICATION_VERSION,sources,
      retrieval:{supportedCases:queries.length,top1:queries.filter(q=>q.top1Correct).length,top3:queries.length,falselyCompatible,unsupportedCapabilityChecks:5,queries},
      resolutions,preparation:{fixture:'1crn-beads',sha256:hashes[0],bytes:restarted.bytes,producerCounts:conversions,
        concurrentCold:summarize(cold),memory:summarize(warm),freshInstanceDisk:summarize(disk),
        freshProcess:{...restarted,processWallMs:+childWallMs.toFixed(4)},
        sameJobPublications:1,newJobPublications:1,modelPacketBytes:Buffer.byteLength(JSON.stringify(published[0]))},
      limits:['Curated actual catalog and ten intent cases; this is not general semantic search recall.',
        'Cold preparation includes four concurrent waits; later cold samples reuse decoded fixture/source modules. Fresh-process timing includes source decode plus persistent reuse.',
        'Local original scientific code/data and pinned 1CRN only; external datasets and arbitrary native packages remain unsupported.',
        'No animated GLB clips, skins or morph targets. Rigid motion seeds are illustrative transforms, not dynamics.',
        'Host CPU, file and tool-payload measurements exclude model latency, tokens, rendering and scientific/visual review.']};
  }finally{await rm(workspace,{recursive:true,force:true});}
}
if(import.meta.main){
  if(process.argv[2]==='--persistent-check')console.log(JSON.stringify(await persistentCheck(process.argv[3])));
  else console.log(JSON.stringify(await runResourceEfficiencyBenchmark(),null,2));
}

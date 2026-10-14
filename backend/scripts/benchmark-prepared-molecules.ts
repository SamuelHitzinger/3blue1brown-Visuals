/** Host preparation benchmark; run in separate processes against the same directory. */
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {prepareMolecularModel} from '../src/molecular-models.js';
import {ModelAssets} from '../src/model-assets.js';

const directory=resolve(process.argv[2]??'.tmp/prepared-assets-proof');
const accession=process.argv[3]??'1JJ2';
const representation=process.argv[4]??'backbone';
if(representation!=='mixed'&&representation!=='backbone')throw new Error('Expected mixed or backbone');
process.env.MOLECULAR_MODEL_CACHE_DIR=join(directory,'cache');
await mkdir(directory,{recursive:true});
const times:number[]=[];
let result:Awaited<ReturnType<typeof prepareMolecularModel>>;
for(let i=0;i<3;i++){
  const start=performance.now();
  result=await prepareMolecularModel({accession,representation});
  times.push(performance.now()-start);
}
const store=new ModelAssets(join(directory,'models'));
const start=performance.now();
const published=await store.publish(result!.bytes,{scientific:result!.context});
const publicationMs=performance.now()-start;
await writeFile(join(directory,'model-payload.json'),JSON.stringify(await store.forRendering({[published.id]:published.asset})));
await writeFile(join(directory,'context.json'),JSON.stringify(result!.context,null,2));
const report={accession,representation,preparationMs:times,publicationMs,
  sha256:createHash('sha256').update(result!.bytes).digest('hex'),bytes:result!.bytes.length,
  chains:result!.context.molecular?.chains.length,metadata:published.asset.metadata,
  note:'First call includes source/cache reads. Subsequent calls include input verification plus prepared-memory reuse. Restart this process to measure persistent reuse. These timings exclude LLM authoring and video rendering.'};
await writeFile(join(directory,'last-benchmark.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({...report,metadata:{parts:report.metadata.parts.length,triangles:report.metadata.triangles}},null,2));

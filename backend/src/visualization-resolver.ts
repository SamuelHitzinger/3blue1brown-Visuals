import {createHash} from 'node:crypto';
import {open} from 'node:fs/promises';
import {createNucleicProcessingBuilders,createNucleicTranscriptionCycleBuilders} from 'animlib/core';
import {readCatalog} from './visualization-catalog.js';
import type {ReferenceTools} from './agents/reference-tools.js';

export interface ResourcePublishInput {
  fixtureId?: string; pdbId?: string; pdbChains?: string[]; pdbRepresentation?: 'mixed'|'backbone';
}
export interface ResourceResolveInput {
  catalogId: string; requiredCapabilities?: string[]; prepare?: boolean;
  selection?: ResourcePublishInput & {dataId?: string};
}
export interface ResourcePackageRef {
  kind: 'model'|'code'|'data'; id: string; sha256?: string; usage: string;
  read?: {tool:'read_animlib_reference'|'read_visualization_resource';id:string;sha256?:string};
  /** Existing publication response: named parts, bounds, and scientific context. No binary geometry. */
  model?: Record<string,unknown>;
}
export interface ResourceResolution {
  catalogId: string; status:'ready'|'needs-input'|'preparation-required'|'unsupported';
  packageRefs:ResourcePackageRef[];
  compatibility:{compatible:boolean;requested:string[];available:string[];missing:string[]};
  provenance:{source:string;sha256?:string}[]; limitations:string[]; requiredInputs:string[]; reason?:string;
}
export interface ResourceReadInput {id:string;sha256:string;offset?:number;limit?:number}
export interface ResourcePage {id:string;sha256:string;content:string;totalChars:number;offset:number;nextOffset?:number}
export interface VisualizationResourceTools {
  resolve(input:ResourceResolveInput,signal:AbortSignal):Promise<ResourceResolution>;
  read(input:ResourceReadInput,signal:AbortSignal):Promise<ResourcePage>;
}
export const RESOURCE_RESPONSE_BYTES=28_000;
const sha=(value:string)=>createHash('sha256').update(value).digest('hex');
const byteLimit=<T>(value:T):T=>{if(Buffer.byteLength(JSON.stringify(value))>RESOURCE_RESPONSE_BYTES)throw Error('Resource response exceeds its byte budget; use a smaller selection.');return value;};
const sourceRoot=new URL('../../shared/animlib/',import.meta.url);
const codeRoutes:Record<string,{id:string;capabilities:string[]}>={
  'mechanical-modes':{id:'scientific-modal-state',capabilities:['s.modalState','s.bind','s.line','s.circle','s.arrow','s.latex']},
  'reaction-transport':{id:'scientific-conservative-transport',capabilities:['s.conservativeTransport','s.bind','s.line','s.text','s.arrow']},
  'ecological-flows':{id:'scientific-conservative-transport',capabilities:['s.conservativeTransport','s.bind','s.line','s.text','s.arrow']},
  'waves-interference':{id:'scientific-complex-interference',capabilities:['s.complexInterference','s.bind','s.line','s.arrow','s.latex']},
  'signals-fourier':{id:'scientific-complex-interference',capabilities:['s.complexInterference','s.bind','s.line','s.arrow','s.latex']},
  'neural-event-rates':{id:'scientific-event-rates',capabilities:['s.eventRates','s.sampledState','s.path','s.bind','s.line','s.circle','s.latex']},
  'rigid-molecular-motion':{id:'scientific-rigid-motion',capabilities:['s.rigidMotion','s.bind','s.circle','s.line']},
};
const dataRoutes={
  'transcription-cycle':{file:'demo/expansion/inputs/transcription-cycle.json',capability:'s.nucleicTranscriptionCycle',
    usage:'Read all JSON pages, then pass the parsed object to s.nucleicTranscriptionCycle(input, absoluteTime). Authored schematic inputs, not measured kinetics.'},
  'rna-processing-splice':{file:'demo/expansion/inputs/rna-processing-splice.json',capability:'s.nucleicSplice',
    usage:'Read all JSON pages, then pass parsed.props to s.nucleicSplice(input.props, progress). Preserve the supplied provenance; motion is illustrative.'},
} as const;
type DataId=keyof typeof dataRoutes;
type Snapshot={content:string;sha256:string};

/** Cancellation belongs to a waiter; another caller can continue the same host preparation. */
async function waitFor<T>(work:Promise<T>,signal:AbortSignal):Promise<T>{
  signal.throwIfAborted();
  return new Promise<T>((resolve,reject)=>{
    const abort=()=>reject(signal.reason);signal.addEventListener('abort',abort,{once:true});
    work.then(value=>{signal.removeEventListener('abort',abort);if(signal.aborted)reject(signal.reason);else resolve(value);},error=>{signal.removeEventListener('abort',abort);reject(error);});
  });
}
async function loadData(id:DataId):Promise<Snapshot>{
  const file=await open(new URL(dataRoutes[id].file,sourceRoot),'r');let content:string;
  try{
    const info=await file.stat();if(!info.isFile()||info.size>32_000)throw Error('Resource data exceeds its byte limit.');
    const bytes=Buffer.alloc(info.size+1);let length=0;
    while(length<bytes.length){const result=await file.read(bytes,length,bytes.length-length,length);if(!result.bytesRead)break;length+=result.bytesRead;}
    if(length!==info.size)throw Error('Resource changed during bounded read.');content=bytes.subarray(0,length).toString('utf8');
  }finally{await file.close();}
  const value=JSON.parse(content);
  // Exercise the actual installed input validators and representative states. This is not scientific/visual approval.
  if(id==='transcription-cycle'){
    const builder=createNucleicTranscriptionCycleBuilders();
    for(const time of [0,value.start,value.start+value.cycleDuration/2,value.start+value.cycleDuration*value.transcript.length])builder.nucleicTranscriptionCycle(value,time);
  }else{
    const builder=createNucleicProcessingBuilders();for(const p of [0,.5,1])builder.nucleicSplice(value.props,p);
  }
  return {content,sha256:sha(content)};
}
function validate(input:ResourceResolveInput){
  if(!input||typeof input.catalogId!=='string'||! /^[a-z][a-z0-9-]{0,79}$/.test(input.catalogId))throw Error('Use an exact catalog ID.');
  if(input.prepare!==undefined&&typeof input.prepare!=='boolean')throw Error('prepare must be a boolean.');
  const requested=input.requiredCapabilities??[];
  if(!Array.isArray(requested)||requested.length>16||requested.some(c=>typeof c!=='string'||!c.trim()||c.length>100))throw Error('Invalid required capabilities.');
  const selection=input.selection??{};
  if(!selection||typeof selection!=='object'||Array.isArray(selection)||Object.keys(selection).some(k=>!['fixtureId','pdbId','pdbChains','pdbRepresentation','dataId'].includes(k)))throw Error('Invalid resource selection.');
  for(const key of ['fixtureId','pdbId','dataId'] as const)if(selection[key]!==undefined&&(typeof selection[key]!=='string'||!selection[key]||selection[key]!.length>64))throw Error('Invalid resource selection.');
  if(selection.pdbId!==undefined&&! /^[1-9][a-z0-9]{3}$/i.test(selection.pdbId))throw Error('Invalid PDB accession.');
  if(selection.pdbChains!==undefined&&(!Array.isArray(selection.pdbChains)||!selection.pdbChains.length||selection.pdbChains.length>32||selection.pdbChains.some(c=>typeof c!=='string'||! /^[a-z0-9]?$/i.test(c))))throw Error('Invalid PDB chains.');
  if(selection.pdbRepresentation!==undefined&&!['mixed','backbone'].includes(selection.pdbRepresentation))throw Error('Invalid PDB representation.');
  if((selection.pdbChains!==undefined||selection.pdbRepresentation!==undefined)&&selection.pdbId===undefined)throw Error('PDB options require pdbId.');
  const allowed=input.catalogId==='crambin-1crn'?['fixtureId']:input.catalogId==='pdb-structures'?['pdbId','pdbChains','pdbRepresentation']:input.catalogId==='nucleic-example-inputs'?['dataId']:[];
  if(Object.keys(selection).some(key=>!allowed.includes(key)))throw Error('Selection does not belong to this catalog route.');
  if(selection.fixtureId!==undefined&&!['1crn-sticks','1crn-beads','1crn-surface'].includes(selection.fixtureId))throw Error('Unknown bundled fixture.');
  if(selection.dataId!==undefined&&!Object.hasOwn(dataRoutes,selection.dataId))throw Error('Unknown resource data ID.');
  return {requested:[...new Set(requested)],selection};
}

/** Job-scoped resolver. Never share this instance between jobs with different publication registries. */
export function createVisualizationResolver(options:{
  publishModel?:(input:ResourcePublishInput,signal:AbortSignal)=>Promise<unknown>;
  referenceTools?:ReferenceTools;
  /** Owning job cancellation; individual resolve calls only cancel their own wait. */
  signal?:AbortSignal;
}={}):VisualizationResourceTools{
  const published=new Map<string,Promise<Record<string,unknown>>>();
  const snapshots=new Map<string,Promise<Snapshot>>();
  const selected=new Map<string,Snapshot>();
  const snapshot=(id:string,load:()=>Promise<Snapshot>)=>{
    let work=snapshots.get(id);if(!work){work=load();snapshots.set(id,work);void work.catch(()=>snapshots.delete(id));}return work;
  };
  return {
    async resolve(input,signal){
      options.signal?.throwIfAborted();signal.throwIfAborted();const {requested,selection}=validate(input),entry=await readCatalog(input.catalogId);signal.throwIfAborted();
      const route=codeRoutes[entry.id],dataId=selection.dataId as DataId|undefined;
      const modelRoute=['crambin-1crn','pdb-structures'].includes(entry.id);
      const available=modelRoute?['s.model','model.static','model.named-parts']:route?.capabilities??(dataId?[dataRoutes[dataId].capability]:entry.id==='nucleic-example-inputs'?Object.values(dataRoutes).map(value=>value.capability):[]);
      const missing=requested.filter(value=>!available.includes(value));
      const result:ResourceResolution={catalogId:entry.id,status:'unsupported',packageRefs:[],
        compatibility:{compatible:missing.length===0,requested,available:[...available],missing},
        provenance:[{source:entry.provenance}],limitations:[...entry.limitations,...(entry.reuseContract?.motionLimitations??[])],
        requiredInputs:[...(entry.reuseContract?.requiredInputs??[])]};
      const finish=(status:ResourceResolution['status'],reason?:string)=>{options.signal?.throwIfAborted();signal.throwIfAborted();return byteLimit(structuredClone({...result,status,
        compatibility:{...result.compatibility,compatible:status!=='unsupported'&&result.compatibility.compatible},...(reason?{reason}:{})}));};
      if(missing.length)return finish('unsupported','Requested capabilities are unavailable in this package. GLB publication supports static named parts; clips, skins and morph targets are unsupported.');
      if(modelRoute){
        if(!selection.fixtureId&&!selection.pdbId){result.requiredInputs.unshift(entry.id==='crambin-1crn'?'Choose fixtureId: 1crn-sticks, 1crn-beads or 1crn-surface.':'Provide a researched four-character pdbId; choose chains and representation for the claim.');return finish('needs-input');}
        if(!options.publishModel)return finish('unsupported','This task has no model publication capability.');
        if(!input.prepare)return finish('preparation-required','Resolve again with prepare:true to publish this exact selection into the current job.');
        const normalized:ResourcePublishInput=selection.fixtureId?{fixtureId:selection.fixtureId}:{pdbId:selection.pdbId!.toUpperCase(),pdbRepresentation:selection.pdbRepresentation??'mixed',...(selection.pdbChains?{pdbChains:[...new Set(selection.pdbChains)].sort()}:{})};
        const key=JSON.stringify(normalized);let work=published.get(key);
        if(!work){
          // Publication is shared within this job; a caller's cancellation cannot invalidate another waiter.
          work=Promise.resolve().then(()=>options.publishModel!(normalized,options.signal??new AbortController().signal)).then(value=>{
            if(!value||typeof value!=='object'||Array.isArray(value)||typeof (value as {id?:unknown}).id!=='string'||!(value as {id:string}).id.startsWith('model-'))throw Error('Publication returned no usable model ID.');
            return structuredClone(value) as Record<string,unknown>;
          });published.set(key,work);void work.catch(()=>published.delete(key));
        }
        const model=await waitFor(work,signal),id=model.id as string;
        result.packageRefs.push({kind:'model',id,usage:'Use this published ID with s.model; preserve returned named parts and scientific representation limits.',model});
        const context=model.context as {provenance?:{source?:string;sourceHash?:string}}|undefined;
        if(context?.provenance?.source)result.provenance.push({source:context.provenance.source,...(context.provenance.sourceHash?{sha256:context.provenance.sourceHash}:{})});
        return finish('ready');
      }
      if(route){
        if(!options.referenceTools)return finish('unsupported','This task has no immutable authoring reference reader.');
        const value=await waitFor(snapshot(route.id,async()=>{
          let content='',offset=0;while(true){const page=await options.referenceTools!.read({id:route.id,offset,limit:16_000},new AbortController().signal);content+=page.content;
            if(content.length>64_000)throw Error('Construction source exceeds its byte limit.');if(page.nextOffset===undefined)break;
            if(page.nextOffset<=offset)throw Error('Construction reference pagination made no progress.');offset=page.nextOffset;}
          return {content,sha256:sha(content)};
        }),signal);
        result.packageRefs.push({kind:'code',id:route.id,sha256:value.sha256,read:{tool:'read_animlib_reference',id:route.id},usage:'Read and adapt this exact construction seed. Supply the teaching sequence and source-supported inputs; retain rendered review.'});
        result.provenance.push({source:`Immutable authoring reference ${route.id}`,sha256:value.sha256});
        result.limitations.push('Construction seed with illustrative inputs; neither measured simulation data nor a complete approved explanation.');return finish('ready');
      }
      if(entry.id==='nucleic-example-inputs'){
        if(!dataId){result.requiredInputs.unshift('Choose dataId: transcription-cycle or rna-processing-splice.');return finish('needs-input');}
        const value=await waitFor(snapshot(dataId,()=>loadData(dataId)),signal);selected.set(dataId,value);
        result.packageRefs.push({kind:'data',id:dataId,sha256:value.sha256,read:{tool:'read_visualization_resource',id:dataId,sha256:value.sha256},usage:dataRoutes[dataId].usage});
        result.provenance.push({source:`animlib/${dataRoutes[dataId].file}`,sha256:value.sha256});
        result.limitations.push('Original schematic input data. Input validation does not certify scientific meaning or the adapted visualization.');return finish('ready');
      }
      return finish('unsupported','Catalog guidance is available, but no bounded production package ingestion route is installed for this resource. External data and historical fixtures are not automatically prepared.');
    },
    async read({id,sha256,offset=0,limit=8000},signal){
      options.signal?.throwIfAborted();signal.throwIfAborted();const value=selected.get(id);
      if(!value||value.sha256!==sha256)throw Error('Resolve this exact package first and use its returned SHA-256.');
      if(!Number.isSafeInteger(offset)||offset<0||offset>value.content.length||!Number.isSafeInteger(limit)||limit<1000||limit>8000)throw Error('Invalid resource page; limit must be 1000–8000 characters.');
      const end=Math.min(value.content.length,offset+limit);
      return byteLimit({id,sha256,content:value.content.slice(offset,end),totalChars:value.content.length,offset,...(end<value.content.length?{nextOffset:end}:{})});
    },
  };
}

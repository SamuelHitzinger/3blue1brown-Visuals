/** Append-only host bridge: the browser gets metadata and capability URLs, never local paths. */
import {createHash} from 'node:crypto';
import {basename,dirname} from 'node:path';
import type {ModelAsset} from 'animlib/core';
import {ModelAssets} from '../../src/model-assets.js';
import type {ModelProvenance} from '../../src/model-assets.js';
import type {BundledModelContext} from '../../src/bundled-models.js';
import type {createLocalAssetIndex,LocalAssetRecord} from './asset-index.js';
import {validateLectureModelInventory} from './inventory-sync.js';
import {createCatalogSearchIndex,type CatalogSearchIndex} from '../../src/visualization-catalog.js';

type LocalAssetIndex=Awaited<ReturnType<typeof createLocalAssetIndex>>;
type ScientificProvenance=BundledModelContext['provenance'];
type LectureProvenance=Omit<ModelProvenance,'scientific'>&{scientific?:Omit<BundledModelContext,'provenance'>&{
  provenance:Omit<ScientificProvenance,'converter'>&{converter:Omit<ScientificProvenance['converter'],'options'>&{options?:Record<string,unknown>}};
}};
export interface LectureAssetDescriptor {
  assetId:string;title:string;sha256:string;
  dimensions:LocalAssetRecord['dimensions'];counts:{parts:number;triangles:number};
  namedParts:{id:string;name:string}[];omittedParts:number;
  provenance:LectureProvenance;omittedDetails:{path:string;bytes:number;sha256:string;notice:string}[];limitations:string[];clipPlayback:false;
}
export interface LectureAssetManifest {inventoryId:string;revision:number;assets:Record<string,ModelAsset>}
export interface LectureAssetCandidates {inventoryId:string;assets:LectureAssetDescriptor[];omittedAssets:number}
export interface LecturePartQuery {assetId:string;query?:string;offset?:number;limit?:number}
export interface LecturePartPage {inventoryId:string;assetId:string;parts:{id:string;name:string}[];total:number;offset:number;limit:number;nextOffset:number|null}
const maximumAssets=4,maximumSessionAssets=64,maximumParts=24,maximumContextBytes=16000;
const hash=(value:string|Uint8Array)=>createHash('sha256').update(value).digest('hex');
const supported=(entry:LocalAssetRecord)=>entry.format==='published-glb'&&entry.animation.status==='none'&&entry.runtime.liveWorld;
function canonicalPublication(entry:LocalAssetRecord):boolean{
  const identity=/^model-([a-f0-9]{64})(?:-([a-f0-9]{64}))?$/.exec(entry.assetId);
  // A mutable base sidecar can retain older scientific context while pointing at a
  // newer provenance identity. Only the identity's own sidecar is authoritative.
  return !!identity&&!!entry.manifestPath&&basename(entry.manifestPath)===`${identity[1]}${identity[2]?'.'+identity[2]:''}.json`;
}
function describeProvenance(value:ModelProvenance):Pick<LectureAssetDescriptor,'provenance'|'omittedDetails'>{
  const provenance:LectureProvenance=structuredClone(value),omittedDetails:LectureAssetDescriptor['omittedDetails']=[];
  const converter=provenance.scientific?.provenance.converter;
  if(converter?.options){
    const encoded=JSON.stringify(converter.options),bytes=Buffer.byteLength(encoded,'utf8');
    if(bytes>4096){
      omittedDetails.push({path:'provenance.scientific.provenance.converter.options',bytes,sha256:hash(encoded),notice:'Uninspected converter details were omitted and may contain additional constraints.'});
      delete converter.options;
    }
  }
  return {provenance,omittedDetails};
}

type FrozenAsset={asset:ModelAsset;bytes:Buffer;descriptor:LectureAssetDescriptor;provenance:ModelProvenance;
  index:LocalAssetIndex;recordId:string;identity:string;partSearch:CatalogSearchIndex};
export interface LectureAssetAppendOptions {signal?:AbortSignal;beforeCommit?:()=>void}

function matchingParts(entry:FrozenAsset,query:string):{id:string;name:string}[]{
  if(!query.trim())return entry.asset.metadata.parts.map(({id,name})=>({id,name}));
  // A chain can be named "A" or "In". Catalog stopwords and punctuation
  // normalization must not erase literal identities or merge equal names.
  const literal=query.trim(),parts=entry.asset.metadata.parts;
  const matches=[...parts.filter(part=>part.id===literal),...parts.filter(part=>part.name===literal&&part.id!==literal)].map(({id,name})=>({id,name}));
  const seen=new Set(matches.map(part=>part.id));
  for(let offset=0,total=1;offset<total;offset+=20){
    const page=entry.partSearch.search({query,offset,limit:20});total=page.total;
    for(const {id,title} of page.entries)if(!seen.has(id)){seen.add(id);matches.push({id,name:title});}
  }
  return matches;
}
function candidateDescriptor(entry:FrozenAsset,query:string):LectureAssetDescriptor{
  const matched=matchingParts(entry,query),seen=new Set(matched.map(part=>part.id));
  const namedParts=[...matched,...entry.asset.metadata.parts.filter(part=>!seen.has(part.id)).map(({id,name})=>({id,name}))].slice(0,maximumParts);
  return {...entry.descriptor,namedParts,omittedParts:entry.asset.metadata.parts.length-namedParts.length};
}

async function stageAssets(index:LocalAssetIndex,ids?:string[],signal?:AbortSignal){
  signal?.throwIfAborted();
  if(ids!==undefined&&(!Array.isArray(ids)||ids.length>maximumAssets||ids.some(id=>typeof id!=='string')||new Set(ids).size!==ids.length))throw Error('Select at most four unique indexed asset IDs');
  const records:LocalAssetRecord[]=ids?.map(id=>index.select(id))??[];
  if(ids===undefined){
    for(let offset=0,total=1;offset<total&&records.length<maximumAssets;){
      const page=index.query({format:'published-glb',animated:false,offset,limit:20});total=page.total;offset=page.nextOffset??total;
      for(const entry of page.entries){
        if(supported(entry)&&canonicalPublication(entry)&&!records.some(record=>record.assetId===entry.assetId))records.push(entry);
        if(records.length===maximumAssets)break;
      }
    }
  }
  if(records.some(record=>!supported(record)))throw Error('Lecture assets must be supported static published models');
  if(records.some(record=>!canonicalPublication(record)))throw Error('Select the canonical publication sidecar, not a mutable base alias');
  if(new Set(records.map(record=>record.assetId)).size!==records.length)throw Error('Selection contains duplicate runtime asset IDs');

  // Read complete scientific context first. The indexed loader then rechecks the original
  // manifest and binary hashes, so a changed publication cannot create a mixed snapshot.
  const provenance=new Map<string,ModelProvenance>();
  for(const record of records){
    const asset:ModelAsset={kind:'model',url:`/api/models/${record.sha256}.glb`,sha256:record.sha256,
      // Provenance only inspects identity; the authoritative metadata comes from the loader.
      metadata:undefined as unknown as ModelAsset['metadata']};
    const suffix=record.assetId.slice(`model-${record.sha256}`.length);
    if(suffix)asset.provenanceSha256=suffix.slice(1);
    provenance.set(record.assetId,(await new ModelAssets(dirname(record.manifestPath!)).provenance({[record.assetId]:asset}))[record.assetId]??{});
    signal?.throwIfAborted();
  }
  const loaded=records.length?await index.loadPublishedModels(records.map(record=>record.id)):{assets:{},files:{}};
  signal?.throwIfAborted();
  const staged=new Map<string,FrozenAsset>();
  for(const record of records){
    const original=loaded.assets[record.assetId],encoded=loaded.files[original.url];
    if(encoded===undefined)throw Error('Published model payload is missing');
    const bytes=Buffer.from(encoded,'base64');if(hash(bytes)!==original.sha256)throw Error('Published model payload hash mismatch');
    const asset={...structuredClone(original),url:'/lecture-assets/file?assetId='+encodeURIComponent(record.assetId)};
    const namedParts=original.metadata.parts.slice(0,maximumParts).map(({id,name})=>({id,name}));
    const descriptor:LectureAssetDescriptor={assetId:record.assetId,title:record.title,sha256:record.sha256,dimensions:structuredClone(record.dimensions),
      counts:{parts:original.metadata.parts.length,triangles:original.metadata.triangles},namedParts,omittedParts:original.metadata.parts.length-namedParts.length,
      ...describeProvenance(provenance.get(record.assetId)!),limitations:[...record.limitations],clipPlayback:false};
    const completeProvenance=provenance.get(record.assetId)!;
    // Full validated metadata is host-owned. The generic search index ranks exact
    // IDs and names without adding the complete inventory to model prompts.
    const partSearch=createCatalogSearchIndex(original.metadata.parts.map(({id,name})=>({id,title:name,description:'',
      tier:'resource',domains:[],tags:[],aliases:[],capabilities:[],relatedIds:[],readiness:'ready',document:'',provenance:'',limitations:[]})));
    staged.set(record.assetId,{asset,bytes,descriptor,provenance:completeProvenance,index,recordId:record.id,
      identity:hash(JSON.stringify({asset,descriptor,provenance:completeProvenance})),partSearch});
  }
  return staged;
}

function snapshot(entries:Map<string,FrozenAsset>,revision:number):LectureAssetManifest{
  const ordered=[...entries].sort(([a],[b])=>a.localeCompare(b));
  const manifest={revision,inventoryId:hash(JSON.stringify(ordered.map(([id,entry])=>[id,entry.identity]))),
    assets:Object.fromEntries(ordered.map(([id,entry])=>[id,structuredClone(entry.asset)]))};
  // Startup and every append must fit the browser's complete wire/node envelope
  // before publishing host state. Keep the ordinary cloned object return shape.
  validateLectureModelInventory(manifest);
  return manifest;
}

export async function createLectureAssetSession(index:LocalAssetIndex,options:{ids?:string[]}={}){
  const started=performance.now();
  let entries=await stageAssets(index,options.ids),manifest=snapshot(entries,0);
  // At most one identity per successful nonempty append: the lifetime cap bounds ancestry too.
  const inventories=new Set([manifest.inventoryId]),buildMs=performance.now()-started;
  let queries=0,queryMs=0;
  return {
    manifest:():LectureAssetManifest=>structuredClone(manifest),
    knowsInventory:(inventoryId:string):boolean=>inventories.has(inventoryId),
    async append(nextIndex:LocalAssetIndex,ids:string[],options:LectureAssetAppendOptions={}):Promise<LectureAssetManifest>{
      // All filesystem reads and validation finish before touching live inventory state.
      if(!Array.isArray(ids))throw Error('Select at most four unique indexed asset IDs');
      const staged=await stageAssets(nextIndex,ids,options.signal);
      options.signal?.throwIfAborted();
      // Read the latest state after staging; concurrent successful appends cannot be lost.
      const merged=new Map(entries);
      for(const [id,entry] of staged){
        const previous=merged.get(id);
        if(previous&&previous.identity!==entry.identity)throw Error(`Lecture asset is immutable: ${id}`);
        if(!previous)merged.set(id,entry);
      }
      if(merged.size>maximumSessionAssets)throw Error('Lecture asset inventory exceeds 64 assets');
      const next=merged.size===entries.size?manifest:snapshot(merged,manifest.revision+1);
      // Snapshot validation can be substantial. Check the original deadline only
      // after that work, immediately before the synchronous publication below.
      const guard:unknown=options.beforeCommit?.();
      if(guard!==null&&(typeof guard==='object'||typeof guard==='function')&&typeof (guard as {then?:unknown}).then==='function'){
        void Promise.resolve(guard).catch(()=>{});throw Error('beforeCommit must be synchronous');
      }
      options.signal?.throwIfAborted();
      if(next===manifest)return structuredClone(manifest);
      entries=merged;manifest=next;inventories.add(next.inventoryId);
      return structuredClone(manifest);
    },
    file(assetId:string):Buffer|undefined{const bytes=entries.get(assetId)?.bytes;return bytes?Buffer.from(bytes):undefined;},
    parts(input:LecturePartQuery):LecturePartPage{
      if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Invalid lecture part query');
      const {assetId,query='',offset=0,limit=20}=input;
      const entry=entries.get(assetId);
      if(typeof assetId!=='string'||!entry)throw Error('Unknown registered model');
      if(typeof query!=='string'||query.length>240||!Number.isInteger(offset)||offset<0||offset>256||!Number.isInteger(limit)||limit<1||limit>20)throw Error('Invalid lecture part query');
      const all=matchingParts(entry,query);
      const page:LecturePartPage={inventoryId:manifest.inventoryId,assetId,parts:all.slice(offset,offset+limit),total:all.length,offset,limit,nextOffset:null};
      for(;;){
        page.nextOffset=offset+page.parts.length<all.length?offset+page.parts.length:null;
        if(Buffer.byteLength(JSON.stringify(page),'utf8')<=maximumContextBytes)return page;
        page.parts.pop();if(!page.parts.length)throw Error('Lecture part exceeds response byte limit');
      }
    },
    candidates(query:string):LectureAssetCandidates{
      if(typeof query!=='string'||query.length>240)throw Error('Invalid lecture asset query');
      const start=performance.now();queries++;
      const result:LectureAssetCandidates={inventoryId:manifest.inventoryId,assets:[],omittedAssets:0};
      if(query.trim()){
        const matches:LectureAssetDescriptor[]=[];
        const sources=new Map<LocalAssetIndex,Map<string,FrozenAsset>>();
        for(const entry of entries.values()){
          let descriptors=sources.get(entry.index);if(!descriptors){descriptors=new Map();sources.set(entry.index,descriptors);}
          descriptors.set(entry.recordId,entry);
        }
        for(const [source,descriptors] of sources)for(let offset=0,total=1;offset<total;){
          const page=source.query({query,format:'published-glb',animated:false,offset,limit:20});total=page.total;offset=page.nextOffset??total;
          for(const record of page.entries){const entry=descriptors.get(record.id);if(entry)matches.push(candidateDescriptor(entry,query));}
        }
        result.omittedAssets=matches.length;
        for(const descriptor of matches){
          result.assets.push(descriptor);result.omittedAssets--;
          // Never cut scientific meaning or provenance to make a descriptor fit.
          if(Buffer.byteLength(JSON.stringify(result),'utf8')>maximumContextBytes){result.assets.pop();result.omittedAssets++;}
        }
      }
      queryMs+=performance.now()-start;
      return structuredClone(result);
    },
    // Complete provenance and verified bytes remain host-owned for the session lifetime.
    metrics:()=>({buildMs,assets:entries.size,bytes:[...entries.values()].reduce((sum,entry)=>sum+entry.bytes.length,0),queries,queryMs}),
  };
}

/** Startup-only host bridge: the browser gets metadata and capability URLs, never local paths. */
import {createHash} from 'node:crypto';
import {basename,dirname} from 'node:path';
import type {ModelAsset} from 'animlib/core';
import {ModelAssets} from '../../src/model-assets.js';
import type {ModelProvenance} from '../../src/model-assets.js';
import type {BundledModelContext} from '../../src/bundled-models.js';
import type {createLocalAssetIndex,LocalAssetRecord} from './asset-index.js';

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
export interface LectureAssetManifest {inventoryId:string;assets:Record<string,ModelAsset>}
export interface LectureAssetCandidates {inventoryId:string;assets:LectureAssetDescriptor[];omittedAssets:number}
const maximumAssets=4,maximumParts=24,maximumContextBytes=16000;
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

export async function createLectureAssetSession(index:LocalAssetIndex,options:{ids?:string[]}={}){
  const started=performance.now();
  if(options.ids!==undefined&&(!Array.isArray(options.ids)||options.ids.length>maximumAssets||options.ids.some(id=>typeof id!=='string')||new Set(options.ids).size!==options.ids.length))throw Error('Select at most four unique indexed asset IDs');
  const records:LocalAssetRecord[]=options.ids?.map(id=>index.select(id))??[];
  if(options.ids===undefined){
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
  }
  const loaded=records.length?await index.loadPublishedModels(records.map(record=>record.id)):{assets:{},files:{}};
  const assets:Record<string,ModelAsset>={},files=new Map<string,Buffer>(),descriptors=new Map<string,LectureAssetDescriptor>();
  for(const record of records){
    const original=loaded.assets[record.assetId],encoded=loaded.files[original.url];
    if(encoded===undefined)throw Error('Published model payload is missing');
    const bytes=Buffer.from(encoded,'base64');if(hash(bytes)!==original.sha256)throw Error('Published model payload hash mismatch');
    files.set(record.assetId,bytes);
    assets[record.assetId]={...structuredClone(original),url:'/lecture-assets/file?assetId='+encodeURIComponent(record.assetId)};
    const namedParts=original.metadata.parts.slice(0,maximumParts).map(({id,name})=>({id,name}));
    descriptors.set(record.id,{assetId:record.assetId,title:record.title,sha256:record.sha256,dimensions:structuredClone(record.dimensions),
      counts:{parts:original.metadata.parts.length,triangles:original.metadata.triangles},namedParts,omittedParts:original.metadata.parts.length-namedParts.length,
      ...describeProvenance(provenance.get(record.assetId)!),limitations:[...record.limitations],clipPlayback:false});
  }
  const inventoryId=hash(JSON.stringify({assets,descriptors:[...descriptors.values()],provenance:[...provenance.values()]}));
  const manifest:LectureAssetManifest={inventoryId,assets};
  const buildMs=performance.now()-started,bytes=[...files.values()].reduce((sum,file)=>sum+file.length,0);
  let queries=0,queryMs=0;
  return {
    manifest:():LectureAssetManifest=>structuredClone(manifest),
    file(assetId:string):Buffer|undefined{const bytes=files.get(assetId);return bytes?Buffer.from(bytes):undefined;},
    candidates(query:string):LectureAssetCandidates{
      if(typeof query!=='string'||query.length>240)throw Error('Invalid lecture asset query');
      const start=performance.now();queries++;
      const result:LectureAssetCandidates={inventoryId,assets:[],omittedAssets:0};
      if(query.trim()){
        const matches:LectureAssetDescriptor[]=[];
        for(let offset=0,total=1;offset<total;){
          const page=index.query({query,format:'published-glb',animated:false,offset,limit:20});total=page.total;offset=page.nextOffset??total;
          for(const record of page.entries){const descriptor=descriptors.get(record.id);if(descriptor)matches.push(descriptor);}
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
    // Keep the complete startup provenance host-owned alongside the immutable bytes.
    metrics:()=>({buildMs,assets:provenance.size,bytes,queries,queryMs}),
  };
}

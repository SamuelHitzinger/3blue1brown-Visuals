/** Host-only local media inventory. No downloads, model calls, scene mutation or clip playback. */
import {createHash} from 'node:crypto';
import {open,readdir,realpath} from 'node:fs/promises';
import {basename,dirname,extname,isAbsolute,join,relative,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createCatalogSearchIndex} from '../../src/visualization-catalog.js';
import {ModelAssets} from '../../src/model-assets.js';
import {loadAssetRegistry} from '../../../shared/animlib/tools/load-assets.mjs';
import {canonicalAssetJSON} from '../../../shared/animlib/src/asset-validation.js';
import {validateModelMetadata} from '../../../shared/animlib/src/model-metadata.js';
import type {AssetRegistry} from '../../../shared/animlib/src/asset-types.js';
import type {ModelAsset,Bounds3D} from 'animlib/core';
import type {CatalogEntry} from '../../../shared/animlib/catalog/types.js';
import type {RenderModelAssets} from '../../src/model-assets.js';

export type LocalAssetFormat='native-model'|'native-image'|'published-glb'|'source-gltf'|'source-glb'|'json-data';
export interface LocalAnimationClip {name:string|null;index:number;path:string;jsonPointer:string;durationSeconds:number|null}
export interface LocalAssetRecord {
  id:string;assetId:string;kind:'model'|'image'|'data';format:LocalAssetFormat;title:string;
  assetPath:string;manifestPath:string|null;sha256:string;packageHash:string|null;descriptorHash:string|null;bytes:number;
  dimensions:{size:number[];bounds?:Bounds3D;units:string|null;source:'package-descriptor'|'published-metadata'|'gltf-mesh-local'|'image-manifest'}|null;
  parts:number|null;triangles:number|null;
  provenance:{source:string|null;sourceHash:string|null;creator:string|null;license:string|null;fidelity:string|null};
  animation:{status:'none'|'present'|'unknown';clips:LocalAnimationClip[];inspection:'native-static-format'|'gltf-json'|'unavailable';reason?:string};
  runtime:{liveWorld:boolean;route:'native-registry'|'published-models'|'needs-import-validation'|'data-only';clipPlayback:false};
  data?:{keys:string[]};limitations:string[];
}
export interface LocalAssetQuery {query?:string;kind?:LocalAssetRecord['kind'];format?:LocalAssetFormat;animated?:boolean;limit?:number;offset?:number}
export interface LocalAssetIndexOptions {fixtureRoot?:string;modelDirectory?:string|null;dataRoots?:string[];maxFiles?:number;maxBytes?:number}
type Internal={record:LocalAssetRecord;manifestDigest?:string;model?:ModelAsset;modelDirectory?:string;dependencies:{id:string;hash:string}[]};
const root=fileURLToPath(new URL('../../../shared/animlib/',import.meta.url));
const hash=(bytes:string|Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
const text=(value:unknown):string|null=>typeof value==='string'&&value.length<=8192?value:null;
const vector=(value:unknown):value is number[]=>Array.isArray(value)&&value.length===3&&value.every(v=>typeof v==='number'&&Number.isFinite(v));
const validBounds=(value:any):value is Bounds3D=>value&&vector(value.min)&&vector(value.max)&&value.min.every((v:number,i:number)=>v<=value.max[i]);
const shape=(bounds:Bounds3D,units:string|null,source:'package-descriptor'|'published-metadata'|'gltf-mesh-local'):NonNullable<LocalAssetRecord['dimensions']>=>({bounds:structuredClone(bounds),size:bounds.min.map((v,i)=>bounds.max[i]-v),units,source});
function within(directory:string,path:string){const rel=relative(directory,path);if(isAbsolute(rel)||rel==='..'||rel.startsWith('..'+sep))throw Error('Asset path escapes its configured root');}
function provenance(value:any):LocalAssetRecord['provenance']{
  return {source:text(value?.source),sourceHash:text(value?.sourceHash),creator:text(value?.creator??value?.attribution),license:text(value?.license),fidelity:text(value?.fidelity)};
}
function inspectGLTF(json:any,path:string):LocalAssetRecord['animation']{
  if(json?.asset?.version!=='2.0'||json.animations!==undefined&&!Array.isArray(json.animations))throw Error('Invalid glTF metadata');
  const animations=json.animations??[];if(animations.length>128)throw Error('Animation inventory exceeds 128 clips');
  const clips=animations.map((clip:any,index:number)=>{
    if(!clip||clip.name!==undefined&&(typeof clip.name!=='string'||clip.name.length>256)||!Array.isArray(clip.samplers)||clip.samplers.length>1024)throw Error('Invalid animation clip metadata');
    const intervals=clip.samplers.map((sampler:any)=>json.accessors?.[sampler.input]).filter((a:any)=>Array.isArray(a?.min)&&a.min.length===1&&Number.isFinite(a.min[0])&&Array.isArray(a.max)&&a.max.length===1&&Number.isFinite(a.max[0])&&a.max[0]>=a.min[0]);
    const durationSeconds=intervals.length===clip.samplers.length&&intervals.length?Math.max(...intervals.map((a:any)=>a.max[0]))-Math.min(...intervals.map((a:any)=>a.min[0])):null;
    return {name:clip.name??null,index,path,jsonPointer:`/animations/${index}`,durationSeconds};
  });
  return {status:clips.length?'present':'none',clips,inspection:'gltf-json'};
}
function glbJSON(bytes:Uint8Array){
  if(bytes.length<20)throw Error('Incomplete GLB header');const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),length=view.getUint32(12,true);
  if(view.getUint32(0,true)!==0x46546c67||view.getUint32(4,true)!==2||view.getUint32(8,true)!==bytes.length||view.getUint32(16,true)!==0x4e4f534a||length>2*1024*1024||length+20>bytes.length)throw Error('Invalid or oversized GLB JSON');
  return JSON.parse(new TextDecoder('utf8',{fatal:true}).decode(bytes.subarray(20,20+length)));
}
function meshBounds(json:any):Bounds3D|null{
  const bounds:Bounds3D[]=[];
  for(const mesh of (Array.isArray(json.meshes)?json.meshes:[]).slice(0,1024))for(const primitive of (Array.isArray(mesh.primitives)?mesh.primitives:[]).slice(0,1024)){
    const value=json.accessors?.[primitive.attributes?.POSITION];if(validBounds(value))bounds.push(value);
  }
  return bounds.length?{min:[0,1,2].map(i=>Math.min(...bounds.map(b=>b.min[i]))) as Bounds3D['min'],max:[0,1,2].map(i=>Math.max(...bounds.map(b=>b.max[i]))) as Bounds3D['max']}:null;
}
/** Create once per host session; query is memory-only. Rebuild explicitly to discover changed files. */
export async function createLocalAssetIndex(options:LocalAssetIndexOptions={}){
  const started=performance.now(),maxFiles=options.maxFiles??512,maxBytes=options.maxBytes??64*1024*1024;
  if(!Number.isSafeInteger(maxFiles)||maxFiles<1||maxFiles>2000||!Number.isSafeInteger(maxBytes)||maxBytes<1||maxBytes>128*1024*1024)throw Error('Invalid asset index limits');
  const counters={metadataReads:0,bytesRead:0,queries:0,cacheHits:0,nativeLoads:0,publishedLoads:0};
  const issues:{path:string;reason:string}[]=[],files=new Map<string,{bytes:Buffer;json?:any}>(),entries=new Map<string,Internal>();
  const fixtureRoot=await realpath(resolve(options.fixtureRoot??join(root,'fixtures')));
  const modelDirectory=options.modelDirectory===null?null:resolve(options.modelDirectory??fileURLToPath(new URL('../../data/models/',import.meta.url)));
  const dataRoots=options.dataRoots??[join(root,'demo','expansion','inputs')];
  const roots=new Set([fixtureRoot]);
  const read=async(path:string,limit=1024*1024)=>{
    const resolved=await realpath(path);const allowed=[...roots].find(base=>{const rel=relative(base,resolved);return !isAbsolute(rel)&&rel!=='..'&&!rel.startsWith('..'+sep);});
    if(!allowed)throw Error('Asset path escapes configured roots');
    const existing=files.get(resolved);if(existing)return existing;
    const file=await open(resolved,'r');try{
      const stat=await file.stat();if(!stat.isFile()||stat.size>limit||counters.bytesRead+stat.size>maxBytes)throw Error('Asset metadata byte limit exceeded');
      const bytes=Buffer.alloc(stat.size+1);let position=0;while(position<bytes.length){const value=await file.read(bytes,position,bytes.length-position,position);if(!value.bytesRead)break;position+=value.bytesRead;}
      if(position!==stat.size)throw Error('Asset file changed during read');
      const result:{bytes:Buffer;json?:any}={bytes:bytes.subarray(0,position)};counters.metadataReads++;counters.bytesRead+=position;files.set(resolved,result);return result;
    }finally{await file.close();}
  };
  const json=async(path:string,limit?:number)=>{const value=await read(path,limit);if(value.json===undefined)value.json=JSON.parse(value.bytes.toString('utf8'));return value.json;};
  const candidates=new Map<string,{data:boolean;published:boolean}>();let directories=0;
  async function scan(directory:string,data=false,published=false,depth=0){
    if(depth>8||++directories>512)throw Error('Asset directory traversal limit exceeded');
    let canonical:string;try{canonical=await realpath(directory);}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return;throw error;}roots.add(canonical);
    for(const entry of (await readdir(canonical,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){
      const path=join(canonical,entry.name);
      if(entry.isSymbolicLink()){issues.push({path,reason:'Symbolic links are not indexed'});continue;}
      if(entry.isDirectory()&&!published){await scan(path,data,false,depth+1);continue;}
      if(!entry.isFile()||!(published?/^[a-f0-9]{64}(?:\.[a-f0-9]{64})?\.json$/.test(entry.name):['.json','.gltf','.glb'].includes(extname(entry.name))))continue;
      const old=candidates.get(path);candidates.set(path,{data:data||!!old?.data,published:published||!!old?.published});if(candidates.size>maxFiles)throw Error('Asset file count limit exceeded');
    }
  }
  await scan(fixtureRoot);for(const dataRoot of dataRoots)await scan(resolve(dataRoot),true);if(modelDirectory)await scan(modelDirectory,false,true);
  const base=(path:string,bytes:Buffer):LocalAssetRecord=>({id:`asset-${hash(path).slice(0,24)}`,assetId:basename(path),kind:'data',format:'json-data',title:basename(path),assetPath:path,manifestPath:path,
    sha256:hash(bytes),packageHash:null,descriptorHash:null,bytes:bytes.length,dimensions:null,parts:null,triangles:null,provenance:provenance(null),
    animation:{status:'unknown',clips:[],inspection:'unavailable'},runtime:{liveWorld:false,route:'data-only',clipPlayback:false},limitations:[]});
  for(const [path,mode] of candidates){
    try{
      const payload=await read(path,mode.published||extname(path)==='.glb'?32*1024*1024:1024*1024),record=base(path,payload.bytes),internal:Internal={record,dependencies:[]};
      if(extname(path)==='.gltf'||extname(path)==='.glb'){
        record.kind='model';record.format=extname(path)==='.glb'?'source-glb':'source-gltf';record.manifestPath=null;record.runtime={liveWorld:false,route:'needs-import-validation',clipPlayback:false};
        try{const document=extname(path)==='.glb'?glbJSON(payload.bytes):JSON.parse(payload.bytes.toString('utf8'));record.animation=inspectGLTF(document,path);const bounds=meshBounds(document);if(bounds)record.dimensions=shape(bounds,null,'gltf-mesh-local');}
        catch(error){record.animation.reason=(error as Error).message;}
        record.limitations.push('Source metadata only: import validation and licensing are required before rendering. Mesh-local dimensions exclude node transforms.','Clip metadata does not enable clip, skin or morph-target playback.');
      }else{
        const value=await json(path,mode.published?32*1024*1024:undefined);
        if(mode.published){
          const asset=value.asset as ModelAsset;
          if(!asset?.sha256||! /^[a-f0-9]{64}$/.test(asset.sha256)||asset.url!==`/api/models/${asset.sha256}.glb`)throw Error('Invalid published model identity');
          validateModelMetadata(asset.metadata);const modelPath=join(dirname(path),asset.sha256+'.glb');within(dirname(path),await realpath(modelPath));
          const binary=await read(modelPath,32*1024*1024);if(hash(binary.bytes)!==asset.sha256)throw Error('Published GLB hash mismatch');
          const scientific=value.provenance?.scientific;
          record.assetId=`model-${asset.sha256}${asset.provenanceSha256?'-'+asset.provenanceSha256:''}`;record.title=text(scientific?.molecular?.title)??text(scientific?.fixtureId)??record.assetId;
          record.assetPath=modelPath;record.sha256=asset.sha256;record.bytes=binary.bytes.length;record.kind='model';record.format='published-glb';record.dimensions=shape(asset.metadata.bounds,text(scientific?.units),'published-metadata');
          record.parts=asset.metadata.parts.length;record.triangles=asset.metadata.triangles;record.provenance=provenance(scientific?.provenance??value.provenance);
          try{record.animation=inspectGLTF(glbJSON(binary.bytes),modelPath);}catch(error){record.animation.reason=(error as Error).message;}
          record.runtime={liveWorld:record.animation.status==='none',route:'published-models',clipPlayback:false};record.limitations.push('LiveWorld requires host-supplied ModelStore.metadata, a model preparation hook and the renderer ModelStore. Clip, skin and morph-target playback are not supported.');
          internal.model=asset;internal.modelDirectory=dirname(path);internal.manifestDigest=hash(payload.bytes);
          if(scientific?.fixtureId)record.title=scientific.fixtureId+': '+record.title;
        }else if(value.version===1&&['model','image'].includes(value.kind)&&typeof value.id==='string'){
          const {hash:declared,...content}=value;if(! /^[a-f0-9]{64}$/.test(declared)||hash(canonicalAssetJSON(content))!==declared)throw Error('Native manifest content hash mismatch');
          record.assetId=value.id;record.title=value.id;record.kind=value.kind;record.format=value.kind==='model'?'native-model':'native-image';record.packageHash=declared;record.provenance=provenance(value.provenance);
          record.animation={status:'none',clips:[],inspection:'native-static-format'};record.runtime={liveWorld:true,route:'native-registry',clipPlayback:false};internal.manifestDigest=record.sha256;
          let descriptor:any;
          try{const report=await json(join(dirname(path),'conversion-report.json'));if(report.packages?.includes(basename(path)))descriptor=report.catalog?.find((item:any)=>item.id===value.id);}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')issues.push({path,reason:'Conversion descriptor unavailable: '+(error as Error).message});}
          record.descriptorHash=text(descriptor?.hash);
          if(value.kind==='image')record.dimensions={size:[value.width,value.height],units:'pixels',source:'image-manifest'};
          else{
            if(!Array.isArray(value.parts)||value.parts.length>128)throw Error('Invalid native part inventory');record.parts=value.parts.length;record.triangles=value.parts.reduce((sum:number,part:any)=>sum+part.triangleCount,0);
            if(validBounds(descriptor?.bounds))record.dimensions=shape(descriptor.bounds,text(value.units),'package-descriptor');
            for(const part of value.parts)if(part.imageTexture?.image)internal.dependencies.push(part.imageTexture.image);
          }
          record.limitations.push('Bounds come from existing preparation metadata; selected registry loading revalidates binary hashes and descriptor identity. Static geometry does not supply a motion clip.');
        }else if(mode.data){record.provenance=provenance(value?.provenance);record.data={keys:value&&typeof value==='object'&&!Array.isArray(value)?Object.keys(value).slice(0,64):[]};record.limitations.push('Local JSON data, not an executable animation. No scientific or license claims are inferred when provenance is missing.');}
        else continue;
      }
      if(record.provenance.fidelity)record.limitations.push(record.provenance.fidelity);
      if(Buffer.byteLength(JSON.stringify(record))>28_000)throw Error('Asset descriptor response too large');entries.set(record.id,internal);
    }catch(error){issues.push({path,reason:(error as Error).message});}
  }
  const search=createCatalogSearchIndex([...entries.values()].map(({record:r}):CatalogEntry=>({id:r.id,title:r.title.slice(0,120),description:[r.assetId,r.provenance.source,r.provenance.fidelity].filter(Boolean).join(' ').slice(0,500),tier:'resource',domains:[r.kind,r.format],tags:[r.assetId,basename(dirname(r.assetPath))],aliases:[r.assetId],capabilities:[r.format,r.kind,...(r.animation.status==='present'?['animated']:[])],relatedIds:[],readiness:r.runtime.liveWorld?'ready':'reference',document:'resources/native-model-packages.md',provenance:r.provenance.source??'Local source; provenance not supplied',limitations:r.limitations})));
  type QueryPage={entries:LocalAssetRecord[];total:number;offset:number;limit:number;nextOffset?:number};
  const cache=new Map<string,QueryPage>();const buildMs=performance.now()-started;
  const selected=(ids:string[])=>{
    if(!Array.isArray(ids)||!ids.length||ids.length>16||new Set(ids).size!==ids.length)throw Error('Select 1–16 unique asset IDs');
    return ids.map(id=>{const found=entries.get(id);if(!found)throw Error('Unknown asset ID; paths are not selection IDs');return found;});
  };
  async function readSnapshot(source:string,digest:string,limit:number,directory?:string){
    const path=await realpath(source);if(directory)within(directory,path);
    if(![...roots].some(base=>{const rel=relative(base,path);return !isAbsolute(rel)&&rel!=='..'&&!rel.startsWith('..'+sep);}))throw Error('Selected asset escapes configured roots');
    const file=await open(path,'r');try{
      const stat=await file.stat(),size=stat.size;if(!stat.isFile()||size>limit)throw Error('Selected file exceeds byte limit');const bytes=Buffer.alloc(size+1);let length=0;
      while(length<bytes.length){const value=await file.read(bytes,length,bytes.length-length,length);if(!value.bytesRead)break;length+=value.bytesRead;}
      if(length!==size||hash(bytes.subarray(0,length))!==digest)throw Error('Selected asset changed; rebuild the local index');return bytes.subarray(0,length);
    }finally{await file.close();}
  }
  const unchanged=(item:Internal)=>readSnapshot(item.record.manifestPath??item.record.assetPath,item.manifestDigest??item.record.sha256,Math.min(32*1024*1024,maxBytes));
  return {
    metrics:()=>({...counters,records:entries.size,buildMs,queryCacheEntries:cache.size,issues:structuredClone(issues)}),
    query(input:LocalAssetQuery={}){
      const start=performance.now(),{query='',kind,format,animated,offset=0,limit=8}=input;
      if(typeof query!=='string'||query.length>240||kind!==undefined&&!['model','image','data'].includes(kind)||format!==undefined&&!['native-model','native-image','published-glb','source-gltf','source-glb','json-data'].includes(format)||animated!==undefined&&typeof animated!=='boolean'||!Number.isSafeInteger(offset)||offset<0||offset>2000||!Number.isSafeInteger(limit)||limit<1||limit>20)throw Error('Invalid local asset query');
      counters.queries++;const key=JSON.stringify({query,kind,format,animated,offset,limit}),prior=cache.get(key);
      if(prior){counters.cacheHits++;cache.delete(key);cache.set(key,prior);return {...structuredClone(prior),metrics:{cacheHit:true,lookupMs:performance.now()-start}};}
      const capabilities=[kind,format,animated===true?'animated':undefined].filter((v):v is string=>!!v);const found:LocalAssetRecord[]=[];
      for(let page=0,total=1;page<total;page+=20){const result=search.search({query,...(capabilities.length?{capabilities}:{}),offset:page,limit:20});total=result.total;for(const entry of result.entries){const item=entries.get(entry.id)!.record;if(animated!==false||item.animation.status==='none')found.push(item);}}
      const response:QueryPage={entries:structuredClone(found.slice(offset,offset+limit)),total:found.length,offset,limit};
      while(Buffer.byteLength(JSON.stringify(response))>63_500&&response.entries.length>1)response.entries.pop();
      if(offset+response.entries.length<response.total)response.nextOffset=offset+response.entries.length;
      if(cache.size>=64)cache.delete(cache.keys().next().value!);cache.set(key,response);return {...structuredClone(response),metrics:{cacheHit:false,lookupMs:performance.now()-start}};
    },
    select(id:string){return structuredClone(selected([id])[0].record);},
    async readData(id:string,offset=0,limit=8000){const item=selected([id])[0];if(item.record.format!=='json-data')throw Error('Selection is not JSON data');const bytes=await unchanged(item),content=bytes.toString('utf8');if(!Number.isSafeInteger(offset)||offset<0||offset>content.length||!Number.isSafeInteger(limit)||limit<1||limit>8000)throw Error('Invalid data page');const end=Math.min(content.length,offset+limit);return {id,sha256:item.record.sha256,content:content.slice(offset,end),totalChars:content.length,...(end<content.length?{nextOffset:end}:{})};},
    async loadNativeRegistry(ids:string[]):Promise<AssetRegistry>{
      const all=new Map(selected(ids).map(item=>[item.record.id,item]));
      for(const item of all.values()){
        if(item.record.runtime.route!=='native-registry')throw Error('Selection does not have a native registry route');
        for(const dependency of item.dependencies){const matches=[...entries.values()].filter(value=>value.record.assetId===dependency.id&&value.record.format==='native-image'&&value.record.descriptorHash===dependency.hash);if(matches.length!==1)throw Error('Missing or ambiguous native image dependency');all.set(matches[0].record.id,matches[0]);}
      }
      for(const item of all.values())await unchanged(item);counters.nativeLoads++;
      const registry=await loadAssetRegistry([...all.values()].map(item=>item.record.assetPath),{colorPolicy:'source'});
      for(const item of all.values())if(item.record.descriptorHash&&registry.catalog.find(asset=>asset.id===item.record.assetId)?.hash!==item.record.descriptorHash)throw Error('Prepared descriptor changed; rebuild index');
      for(const item of all.values())await unchanged(item);
      return registry;
    },
    async loadPublishedModels(ids:string[]):Promise<RenderModelAssets>{
      const result:RenderModelAssets={assets:{},files:{}};let loadedBytes=0;
      for(const item of selected(ids)){
        if(!item.model||!item.modelDirectory||item.record.animation.status!=='none')throw Error('Selection does not have a supported published-model route');
        await unchanged(item);const store=new ModelAssets(item.modelDirectory);await store.provenance({[item.record.assetId]:item.model});
        if(result.files[item.model.url]===undefined){
          // Keep the existing renderer payload, but never pass mutable files to an unbounded readFile.
          const bytes=await readSnapshot(item.record.assetPath,item.model.sha256!,Math.min(32*1024*1024,maxBytes-loadedBytes),item.modelDirectory);
          loadedBytes+=bytes.length;result.files[item.model.url]=bytes.toString('base64');
        }
        result.assets[item.record.assetId]=structuredClone(item.model);
      }
      counters.publishedLoads++;return result;
    },
  };
}

if(import.meta.main){
  const index=await createLocalAssetIndex(),query=process.argv.slice(2).join(' ')||'suzanne';
  const first=index.query({query,limit:5}),cached=index.query({query,limit:5});
  console.log(JSON.stringify({query,first,cached,metrics:index.metrics()},null,2));
}

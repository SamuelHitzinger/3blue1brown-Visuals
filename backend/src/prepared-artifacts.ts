import {createHash} from 'node:crypto';
import {mkdir,open} from 'node:fs/promises';
import {join} from 'node:path';
import {atomicWrite} from './narration/service.js';
const hash=(data:string|Uint8Array)=>createHash('sha256').update(data).digest('hex');
function canonical(value:unknown):string {if(value===null||typeof value!=='object')return JSON.stringify(value);if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';return '{'+Object.keys(value as object).sort().map(k=>JSON.stringify(k)+':'+canonical((value as Record<string,unknown>)[k])).join(',')+'}';}
export class PreparedArtifactStore {
 private pending=new Map<string,Promise<{bytes:Uint8Array;context:unknown}>>();
 private memory=new Map<string,{bytes:Uint8Array;context:unknown;size:number}>();private memorySize=0;
 constructor(private options:{directory:string;maxArtifactBytes:number;maxContextBytes:number;maxMemoryBytes:number}){}
 async prepare<T>(namespace:string,version:string,identity:unknown,producer:()=>Promise<{bytes:Uint8Array;context:T}>,signal?:AbortSignal):Promise<{bytes:Uint8Array;context:T}>{
  signal?.throwIfAborted();const key=hash(canonical({namespace,version,identity}));
  let work=this.pending.get(key);if(!work){work=this.loadOrBuild(key,producer);this.pending.set(key,work);void work.finally(()=>this.pending.delete(key)).catch(()=>{});}
  const value=await new Promise<{bytes:Uint8Array;context:unknown}>((resolve,reject)=>{const abort=()=>reject(signal!.reason);signal?.addEventListener('abort',abort,{once:true});work!.then(value=>{signal?.removeEventListener('abort',abort);resolve(value);},error=>{signal?.removeEventListener('abort',abort);reject(error);});});
  signal?.throwIfAborted();return {bytes:value.bytes.slice(),context:structuredClone(value.context) as T};
 }
 private async bounded(path:string,limit:number){
  const file=await open(path,'r');try{const size=(await file.stat()).size;if(size>limit)throw new Error('Prepared artifact byte limit');const buffer=Buffer.alloc(size+1);let length=0;while(length<buffer.length){const read=await file.read(buffer,length,buffer.length-length,length);if(!read.bytesRead)break;length+=read.bytesRead;}if(length!==size)throw new Error('Prepared artifact changed during read');return buffer.subarray(0,length);}finally{await file.close();}
 }
 private async atomic(path:string,data:string|Uint8Array){await atomicWrite(path,data);}
 private async loadOrBuild<T>(key:string,producer:()=>Promise<{bytes:Uint8Array;context:T}>){
  const cached=this.memory.get(key);if(cached)return cached;
  const root=this.options.directory;await mkdir(root,{recursive:true});let result:{bytes:Uint8Array;context:unknown};
  try{const manifest=JSON.parse((await this.bounded(join(root,key+'.json'),1024)).toString());
   if(manifest.key!==key||! /^[a-f0-9]{64}$/.test(manifest.artifact)||! /^[a-f0-9]{64}$/.test(manifest.context))throw new Error('Invalid prepared manifest');
   const bytes=await this.bounded(join(root,manifest.artifact+'.glb'),this.options.maxArtifactBytes),context=await this.bounded(join(root,manifest.context+'.context.json'),this.options.maxContextBytes);
   if(hash(bytes)!==manifest.artifact||hash(context)!==manifest.context)throw new Error('Prepared hash mismatch');const envelope=JSON.parse(context.toString());if(envelope.key!==key||envelope.artifact!==manifest.artifact)throw new Error('Prepared identity mismatch');result={bytes,context:envelope.context};
  }catch{const built=await producer(),artifact=hash(built.bytes),context=JSON.stringify({key,artifact,context:built.context});if(built.bytes.length>this.options.maxArtifactBytes||Buffer.byteLength(context)>this.options.maxContextBytes)throw new Error('Prepared artifact byte limit');
   const contextHash=hash(context);await this.atomic(join(root,artifact+'.glb'),built.bytes);await this.atomic(join(root,contextHash+'.context.json'),context);await this.atomic(join(root,key+'.json'),JSON.stringify({key,artifact,context:contextHash}));result={bytes:built.bytes.slice(),context:structuredClone(built.context)};
  }
  const size=result.bytes.length+Buffer.byteLength(JSON.stringify(result.context));if(size<=this.options.maxMemoryBytes){while(this.memorySize+size>this.options.maxMemoryBytes&&this.memory.size){const old=this.memory.keys().next().value!;this.memorySize-=this.memory.get(old)!.size;this.memory.delete(old);}this.memory.set(key,{...result,size});this.memorySize+=size;}return result;
 }
}

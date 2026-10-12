import { loadImage } from '@napi-rs/canvas';
import { createHash } from 'node:crypto';
import { mkdir, readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { lookup } from 'node:dns/promises';
import { request as httpsRequest } from 'node:https';
import { parseModelGLB, MODEL_LIMITS } from 'animlib/core';
import type { ModelAsset } from 'animlib/core';
import { atomicWrite } from './narration/service.js';

export interface ModelProvenance { source?: string; license?: string; attribution?: string }
/** Trusted host payload for isolated renderers; no network/filesystem URLs are followed there. */
export interface RenderModelAssets { assets:Record<string,ModelAsset>; files:Record<string,string> }
export class ModelAssets {
  constructor(readonly directory=resolve(process.env.MODEL_ASSET_DIR??'data/models')){}
  async publish(bytes:Uint8Array,provenance:ModelProvenance={}):Promise<{id:string;asset:ModelAsset}> {
    const {metadata,images}=await parseModelGLB(bytes);
    for (const image of images) {
      const decoded = await loadImage(Buffer.from(image.bytes));
      if (decoded.width !== image.width || decoded.height !== image.height) throw new Error('Model image dimensions mismatch');
    }
    const sha256=createHash('sha256').update(bytes).digest('hex');
    await mkdir(this.directory,{recursive:true,mode:0o700});
    await atomicWrite(join(this.directory,`${sha256}.glb`),bytes);
    const asset:ModelAsset={kind:'model',url:`/api/models/${sha256}.glb`,sha256,metadata};
    const metadataPath=join(this.directory,`${sha256}.json`);
    let previous:ModelProvenance={};
    try { previous=JSON.parse(await readFile(metadataPath,'utf8')).provenance??{}; }
    catch(error) { if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error; }
    const supplied=Object.fromEntries(Object.entries(provenance).filter(([,value])=>value!==undefined));
    await atomicWrite(metadataPath,JSON.stringify({asset,provenance:{...previous,...supplied}}));
    return {id:`model-${sha256}`,asset};
  }
  async forRendering(assets:Record<string,ModelAsset>):Promise<RenderModelAssets> {
    const files:Record<string,string>={};
    for(const asset of Object.values(assets)) {
      if(!asset.sha256||!/^[a-f0-9]{64}$/.test(asset.sha256)||asset.url!==`/api/models/${asset.sha256}.glb`)throw new Error('Invalid published model identity');
      if(files[asset.url])continue;
      const bytes=await readFile(join(this.directory,`${asset.sha256}.glb`));
      if(createHash('sha256').update(bytes).digest('hex')!==asset.sha256)throw new Error('Published model hash mismatch');
      files[asset.url]=bytes.toString('base64');
    }
    return {assets:structuredClone(assets),files};
  }
  async importURL(url:string,provenance:ModelProvenance={},signal?:AbortSignal){return this.publish(await downloadModel(url,signal),{...provenance,source:url});}
  async handle(request:Request):Promise<Response> {
    const url=new URL(request.url),path=url.pathname;
    if(path==='/api/models' && request.method==='POST') {
      const origin=request.headers.get('origin');
      // Match the video/narration routes: TLS terminates at the trusted proxy.
      const publicOrigin=process.env.NARRATION_PUBLIC_ORIGIN??`${request.headers.get('x-forwarded-proto')??url.protocol.slice(0,-1)}://${url.host}`;
      if(request.headers.get('sec-fetch-site')==='cross-site'||(origin && origin!==publicOrigin))return Response.json({detail:'Cross-origin model uploads are not allowed'},{status:403});
      try {const bytes=await limitedBody(request);return Response.json(await this.publish(bytes),{status:201});}
      catch(error){return Response.json({detail:(error as Error).message},{status:400});}
    }
    const match=/^\/api\/models\/([a-f0-9]{64})\.glb$/.exec(path);
    if(!match)return Response.json({detail:'Not Found'},{status:404});
    if(!['GET','HEAD'].includes(request.method))return new Response(null,{status:405,headers:{Allow:'GET, HEAD'}});
    try {
      const bytes=await readFile(join(this.directory,`${match[1]}.glb`));
      const headers={'Content-Type':'model/gltf-binary','Content-Length':String(bytes.length),'Cache-Control':'private, max-age=31536000, immutable','ETag':`"${match[1]}"`,'X-Content-Type-Options':'nosniff'};
      if(request.headers.get('if-none-match')===headers.ETag)return new Response(null,{status:304,headers});
      return new Response(request.method==='HEAD'?null:bytes,{headers});
    }catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return new Response(null,{status:404});throw error;}
  }
}
export async function limitedBody(request:Request):Promise<Uint8Array> {
  if(Number(request.headers.get('content-length'))>MODEL_LIMITS.bytes)throw new Error('Model exceeds 32 MB');
  const reader=request.body?.getReader();if(!reader)throw new Error('Missing model body');
  const chunks:Uint8Array[]=[];let size=0;
  try {while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>MODEL_LIMITS.bytes)throw new Error('Model exceeds 32 MB');chunks.push(value);}}
  catch(error){await reader.cancel().catch(()=>{});throw error;}finally{reader.releaseLock();}
  const result=new Uint8Array(size);let offset=0;for(const c of chunks){result.set(c,offset);offset+=c.length;}return result;
}
/** Public IPv4 only; pin the validated address so DNS rebinding cannot reach the host network. */
export function publicModelAddress(address:string):boolean {
  const p=address.split('.').map(Number);
  if(p.length!==4||p.some(n=>!Number.isInteger(n)||n<0||n>255))return false;
  return !(p[0]===0||p[0]===10||p[0]===127||p[0]>=224||p[0]===169&&p[1]===254||p[0]===172&&p[1]>=16&&p[1]<=31||p[0]===192&&(p[1]===168||p[1]===0||p[1]===2)||p[0]===100&&p[1]>=64&&p[1]<=127||p[0]===198&&(p[1]===18||p[1]===19||p[1]===51)||p[0]===203&&p[1]===0&&p[2]===113);
}
async function downloadModel(input:string,signal?:AbortSignal):Promise<Uint8Array> {
  let url=new URL(input);
  for(let redirects=0;redirects<5;redirects++) {
    if(url.protocol!=='https:'||url.username||url.password||url.port&&url.port!=='443')throw new Error('Model URLs must use public HTTPS on port 443');
    const addresses=await lookup(url.hostname,{all:true,family:4});
    if(!addresses.length||addresses.some(a=>!publicModelAddress(a.address)))throw new Error('Model URL resolves to a nonpublic address');
    const result=await new Promise<Uint8Array|URL>((resolve,reject)=>{
      const req=httpsRequest(url,{signal,family:4,lookup:(_hostname,_options,callback)=>callback(null,addresses[0].address,4)},res=>{
        if(res.statusCode && [301,302,303,307,308].includes(res.statusCode)&&res.headers.location){res.resume();resolve(new URL(res.headers.location,url));return;}
        if(res.statusCode!==200){res.resume();reject(new Error(`Model download failed (${res.statusCode})`));return;}
        const chunks:Buffer[]=[];let size=0;
        res.on('data',(chunk:Buffer)=>{size+=chunk.length;if(size>MODEL_LIMITS.bytes)req.destroy(new Error('Model exceeds 32 MB'));else chunks.push(chunk);});
        res.on('end',()=>resolve(new Uint8Array(Buffer.concat(chunks))));res.on('error',reject);
      });
      req.setTimeout(30000,()=>req.destroy(new Error('Model download timed out')));req.on('error',reject);req.end();
    });
    if(result instanceof Uint8Array)return result;url=result;
  }
  throw new Error('Too many model URL redirects');
}

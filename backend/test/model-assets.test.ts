import { test,expect } from 'bun:test';
import { mkdtemp,readFile,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ModelAssets,publicModelAddress } from '../src/model-assets.js';
import { createHandler } from '../src/server.js';
import { createModelGLB } from 'animlib/core';
const generated=()=>createModelGLB({parts:[{name:'Wing',vertices:[[0,0,0],[1,0,0],[0,1,0]],triangles:[[0,1,2]],baseColor:[1,0,0,1]}]});
test('publishes immutable GLBs, metadata, provenance and serves cacheable bytes',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'animlib-models-'));try{const store=new ModelAssets(dir),bytes=await generated(),a=await store.publish(bytes,{license:'CC0',source:'generated'}),b=await store.publish(bytes);
 expect(a).toEqual(b);expect(a.asset.metadata.parts[0].name).toBe('Wing');expect(a.asset.sha256).toHaveLength(64);
 const handler=createHandler(undefined,undefined,undefined,store),response=await handler(new Request(`http://localhost${a.asset.url}`));
 expect(response.status).toBe(200);expect(response.headers.get('content-type')).toBe('model/gltf-binary');expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes);
 const head=await handler(new Request(`http://localhost${a.asset.url}`,{method:'HEAD'}));expect(head.headers.get('content-length')).toBe(String(bytes.length));expect(await head.text()).toBe('');
 expect((await handler(new Request(`http://localhost${a.asset.url}`,{headers:{'If-None-Match':response.headers.get('etag')!}}))).status).toBe(304);
 expect(JSON.parse(await readFile(join(dir,`${a.asset.sha256}.json`),'utf8')).asset).toEqual(a.asset);
 expect(JSON.parse(await readFile(join(dir,`${a.asset.sha256}.json`),'utf8')).provenance).toEqual({license:'CC0',source:'generated'});
 const render=await store.forRendering({wing:a.asset});
 expect(render.assets.wing).toEqual(a.asset);
 expect(new Uint8Array(Buffer.from(render.files[a.asset.url],'base64'))).toEqual(bytes);
 await expect(store.forRendering({wing:{...a.asset,url:'https://other.test/model.glb'}})).rejects.toThrow('identity');
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('uploads generated models through HTTP and rejects malformed, oversized and cross-origin uploads',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'animlib-models-'));try{const store=new ModelAssets(dir),handler=createHandler(undefined,undefined,undefined,store),bytes=await generated();
 expect((await handler(new Request('http://localhost/api/models',{method:'POST',body:bytes}))).status).toBe(201);
 expect((await handler(new Request('http://localhost/api/models',{method:'POST',body:'bad'}))).status).toBe(400);
 expect((await handler(new Request('http://localhost/api/models',{method:'POST',body:bytes,headers:{'content-length':'999999999'}}))).status).toBe(400);
 expect((await handler(new Request('http://localhost/api/models',{method:'POST',body:bytes,headers:{origin:'https://other.test'}}))).status).toBe(403);
 expect((await handler(new Request('http://localhost/api/models/not-a-hash.glb'))).status).toBe(404);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('model downloads exclude private, loopback, link-local and reserved networks',()=>{
 for(const address of ['127.0.0.1','10.1.2.3','172.16.0.1','192.168.1.1','169.254.169.254','100.64.0.1','0.0.0.0','224.0.0.1','::1','::ffff:127.0.0.1'])expect(publicModelAddress(address)).toBe(false);
 expect(publicModelAddress('8.8.8.8')).toBe(true);
});

test('model uploads honor the public proxy origin while rejecting cross-site requests',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'animlib-model-origin-'));
 const previousOrigin=process.env.NARRATION_PUBLIC_ORIGIN;
 try {
  const handler=createHandler(undefined,undefined,undefined,new ModelAssets(dir)),bytes=await generated();
  const cases: {url:string;publicOrigin?:string;headers:Record<string,string>;status:number}[]=[
   {url:'http://localhost/api/models',headers:{origin:'http://localhost'},status:201},
   {url:'http://lesson.test/api/models',headers:{origin:'https://lesson.test','x-forwarded-proto':'https','sec-fetch-site':'same-origin'},status:201},
   {url:'http://internal:8080/api/models',publicOrigin:'https://lesson.test',headers:{origin:'https://lesson.test','sec-fetch-site':'same-origin'},status:201},
   {url:'http://lesson.test/api/models',headers:{origin:'http://lesson.test','x-forwarded-proto':'https'},status:403},
   {url:'http://internal:8080/api/models',publicOrigin:'https://lesson.test',headers:{origin:'https://other.test','x-forwarded-proto':'https'},status:403},
   {url:'http://localhost/api/models',headers:{'sec-fetch-site':'cross-site'},status:403},
   {url:'http://lesson.test/api/models',headers:{origin:'https://lesson.test','x-forwarded-proto':'https','sec-fetch-site':'cross-site'},status:403},
  ];
  for(const c of cases){
   if(c.publicOrigin===undefined)delete process.env.NARRATION_PUBLIC_ORIGIN;else process.env.NARRATION_PUBLIC_ORIGIN=c.publicOrigin;
   const response=await handler(new Request(c.url,{method:'POST',headers:c.headers,body:bytes}));
   expect(response.status).toBe(c.status);
   if(c.status===201){const result=await response.json() as {asset:{url:string}};expect((await handler(new Request(`http://localhost${result.asset.url}`))).status).toBe(200);}
  }
 }finally{
  if(previousOrigin===undefined)delete process.env.NARRATION_PUBLIC_ORIGIN;else process.env.NARRATION_PUBLIC_ORIGIN=previousOrigin;
  await rm(dir,{recursive:true,force:true});
 }
});

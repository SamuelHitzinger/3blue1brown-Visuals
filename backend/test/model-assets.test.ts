import { test,expect } from 'bun:test';
import { mkdtemp,readFile,rm,writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ModelAssets,publicModelAddress } from '../src/model-assets.js';
import { createHandler } from '../src/server.js';
import { createModelGLB, MODEL_LIMITS } from 'animlib/core';
import { prepareBundledModel } from '../src/bundled-models.js';
const generated=()=>createModelGLB({parts:[{name:'Wing',vertices:[[0,0,0],[1,0,0],[0,1,0]],triangles:[[0,1,2]],baseColor:[1,0,0,1]}]});
test('scientific publications preserve distinct context for identical geometry and renamed saved assets',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'animlib-scientific-'));
 try{
  const store=new ModelAssets(dir),prepared=await prepareBundledModel('1crn-beads');
  const original=await store.publish(prepared.bytes,{scientific:prepared.context,attribution:'Original source'});
  const changed={...prepared.context,representation:'mixed'};
  const later=await store.publish(prepared.bytes,{scientific:changed,attribution:'Later source'});
  expect(original.id).not.toBe(later.id);
  expect(original.asset.sha256).toBe(later.asset.sha256);
  expect(original.asset.url).toBe(later.asset.url);
  const cloned=JSON.parse(JSON.stringify(original.asset));
  expect((await new ModelAssets(dir).provenance({customKey:cloned})).customKey.scientific).toEqual(prepared.context);
  const timestamp={...prepared.context,provenance:{...prepared.context.provenance,preparedAt:'2099-01-01'}};
  expect((await store.publish(prepared.bytes,{scientific:timestamp,attribution:'Original source'})).id).toBe(original.id);
  expect((await store.provenance({customKey:cloned})).customKey.scientific).toEqual(prepared.context);
  const legacy={...original.asset};delete legacy.provenanceSha256;
  expect((await store.provenance({oldLesson:legacy})).oldLesson.scientific).toEqual(prepared.context);
  expect((await store.provenance({oldLesson:legacy})).oldLesson.attribution).toBe('Original source');
  const largeContext={...prepared.context,partMeaning:'x'.repeat(1024*1024+1)};
  const large=await store.publish(prepared.bytes,{scientific:largeContext});
  expect((await store.provenance({large:large.asset})).large.scientific).toEqual(largeContext);
  expect((await store.provenance({oldLesson:legacy})).oldLesson.scientific).toEqual(prepared.context);
  const unrelated=await store.publish(await generated());
  await expect(store.provenance({bad:{...unrelated.asset,provenanceSha256:original.asset.provenanceSha256}})).rejects.toThrow();
  const ref=(original.asset as typeof original.asset & {provenanceSha256:string}).provenanceSha256;
  expect(ref).toHaveLength(64);
  await expect(store.provenance({bad:{...original.asset,provenanceSha256:'../bad'} as typeof original.asset})).rejects.toThrow('identity');
  const path=join(dir,`${original.asset.sha256}.${ref}.json`),saved=JSON.parse(await readFile(path,'utf8'));
  saved.provenance.scientific.representation='tampered';await writeFile(path,JSON.stringify(saved));
  await expect(store.provenance({bad:original.asset})).rejects.toThrow('identity');
  await writeFile(path,' '.repeat(MODEL_LIMITS.bytes+1));
  await expect(store.provenance({bad:original.asset})).rejects.toThrow('limit');
 }finally{await rm(dir,{recursive:true,force:true});}
});
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
test('concurrent publication from separate stores retains the scientific identity of identical model bytes',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'animlib-model-provenance-'));
 try{
  const prepared=await prepareBundledModel('1crn-beads'),first=new ModelAssets(dir),second=new ModelAssets(dir);
  const [published]=await Promise.all([first.publish(prepared.bytes,{scientific:prepared.context}),second.publish(prepared.bytes)]);
  const restored=await new ModelAssets(dir).provenance({protein:published.asset});
  expect(restored.protein.scientific?.fixtureId).toBe('1crn-beads');
  expect(restored.protein.scientific?.provenance.sourceHash).toBe('42199a30a0701864a2a5cc76cd7f35cc544cd0e65fbcf63e03c166543249b811');
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

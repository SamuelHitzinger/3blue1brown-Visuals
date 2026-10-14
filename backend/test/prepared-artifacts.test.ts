import {expect,test} from 'bun:test';
import {mkdtemp,rm,writeFile,readdir,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {PreparedArtifactStore} from '../src/prepared-artifacts.js';
test('persistent identity, defensive copies and corruption recovery',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'prepared-'));let calls=0;
 const producer=async()=>{calls++;return {bytes:new Uint8Array([1,2]),context:{claim:'static'}}};
 try {const options={directory,maxArtifactBytes:100,maxContextBytes:1000,maxMemoryBytes:1000};
 const first=await new PreparedArtifactStore(options).prepare('molecule','v1',{source:'a'},producer);first.bytes[0]=9;
 const store=new PreparedArtifactStore(options);expect((await store.prepare('molecule','v1',{source:'a'},producer)).bytes[0]).toBe(1);expect(calls).toBe(1);
 await store.prepare('molecule','v2',{source:'a'},producer);expect(calls).toBe(2);
 const glb=(await readdir(directory)).find(name=>name.endsWith('.glb'))!;await writeFile(join(directory,glb),new Uint8Array([9]));
 expect((await new PreparedArtifactStore(options).prepare('molecule','v1',{source:'a'},producer)).bytes[0]).toBe(1);expect(calls).toBe(3);
 for(const identity of [{source:'b'},{source:'a',ccd:'changed'},{source:'a',chains:['A']},{source:'a',representation:'backbone'}])await store.prepare('molecule','v1',identity,producer);expect(calls).toBe(7);
 }finally{await rm(directory,{recursive:true,force:true});}
});
test('deduplicated conversion isolates cancellation and enforces limits',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'prepared-'));const done=Promise.withResolvers<void>();let calls=0;
 try{const store=new PreparedArtifactStore({directory,maxArtifactBytes:2,maxContextBytes:1000,maxMemoryBytes:100});const abort=new AbortController();
 const producer=async()=>{calls++;await done.promise;return {bytes:new Uint8Array([1]),context:{}}};
 const a=store.prepare('x','1',{},producer,abort.signal);void a.catch(()=>{});const b=store.prepare('x','1',{},producer);abort.abort();await expect(a).rejects.toThrow();done.resolve();expect((await b).bytes[0]).toBe(1);expect(calls).toBe(1);
 await expect(store.prepare('x','1',{large:true},async()=>({bytes:new Uint8Array(3),context:{}}))).rejects.toThrow('byte limit');
 }finally{done.resolve();await rm(directory,{recursive:true,force:true});}
});

test('manifest substitution cannot reuse another scientific identity',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'prepared-'));let calls=0;
 const producer=async()=>{calls++;return {bytes:new Uint8Array([calls]),context:{claim:calls}}};
 const options={directory,maxArtifactBytes:100,maxContextBytes:1000,maxMemoryBytes:0};
 try{const store=new PreparedArtifactStore(options);await store.prepare('x','1',{source:'a'},producer);const first=(await readdir(directory)).find(name=>name.endsWith('.json')&&!name.endsWith('.context.json'))!;
 const original=JSON.parse(await readFile(join(directory,first),'utf8'));await store.prepare('x','1',{source:'b'},producer);const second=(await readdir(directory)).find(name=>name.endsWith('.json')&&!name.endsWith('.context.json')&&name!==first)!;
 const wrong=JSON.parse(await readFile(join(directory,second),'utf8'));await writeFile(join(directory,first),JSON.stringify({...wrong,key:original.key}));
 expect((await store.prepare('x','1',{source:'a'},producer)).bytes[0]).toBe(3);
 await writeFile(join(directory,first),'{');expect((await store.prepare('x','1',{source:'a'},producer)).bytes[0]).toBe(4);
 }finally{await rm(directory,{recursive:true,force:true});}
});

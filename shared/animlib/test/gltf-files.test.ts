import {mkdtemp,mkdir,writeFile,symlink,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {it,expect} from 'vitest';
import {readGLTFFile,readBounded} from '../tools/gltf-files.mjs';
it('bounds local reads and rejects lexical and junction escapes from a source package',async()=>{
 const root=await mkdtemp(join(tmpdir(),'animlib-gltf-'));
 try{
  const source=join(root,'source'),outside=join(root,'outside');await mkdir(source);await mkdir(outside);
  await writeFile(join(source,'model.gltf'),JSON.stringify({asset:{version:'2.0'}}));await writeFile(join(outside,'hidden.bin'),new Uint8Array([1,2,3]));await writeFile(join(source,'mesh.bin'),new Uint8Array([4,5,6]));
  const reader=await readGLTFFile(join(source,'model.gltf'));expect(reader.sourceHash).toMatch(/^[a-f0-9]{64}$/);expect([...await reader.read('mesh.bin',3)]).toEqual([4,5,6]);
  await expect(readBounded(join(source,'mesh.bin'),2)).rejects.toThrow(/size limit/);
  for(const path of ['../outside/hidden.bin','/outside.bin','https://example.org/a','data:base64,a','..\\outside\\hidden.bin','%2e%2e/outside/hidden.bin'])await expect(reader.read(path,3)).rejects.toThrow(/URI|path/);
  await symlink(outside,join(source,'link'),'junction');await expect(reader.read('link/hidden.bin',3)).rejects.toThrow(/real path escapes/);
 }finally{await rm(root,{recursive:true,force:true});}
});

/** Node-only package I/O. The browser registry has no filesystem or network capability. */
import { open, realpath } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { decodeModelPackage } from '../dist/asset-package.js';
import { createAssetRegistry } from '../dist/asset-registry.js';

function contained(root, path) {
  const rel=relative(root,path);
  if(!rel || isAbsolute(rel) || rel==='..' || rel.startsWith('..'+sep)) throw new Error('Asset package path escapes root');
}
async function boundedRead(path, limit, exact) {
  const file=await open(path,'r');
  try {
    const info=await file.stat();
    if(!info.isFile() || info.size>limit || exact!==undefined&&info.size!==exact) throw new Error('Asset exact byte length or size limit mismatch');
    const bytes=Buffer.alloc(info.size); let read=0;
    while(read<bytes.length) {const result=await file.read(bytes,read,bytes.length-read,read);if(!result.bytesRead)throw new Error('Asset short read');read+=result.bytesRead;}
    const extra=await file.read(Buffer.alloc(1),0,1,bytes.length);
    if(extra.bytesRead)throw new Error('Asset grew during bounded read');
    return bytes;
  } finally {await file.close();}
}
export async function loadModelPackage(manifestPath) {
  const file=await realpath(resolve(manifestPath)), root=await realpath(dirname(file));
  const manifest=JSON.parse((await boundedRead(file,1024*1024)).toString('utf8'));
  return decodeModelPackage(manifest,async(path,byteLength)=> {
    const candidate=resolve(root,path); contained(root,candidate);
    const resolved=await realpath(candidate); contained(root,resolved);
    return new Uint8Array(await boundedRead(resolved,byteLength,byteLength));
  });
}
export async function loadAssetRegistry(manifestPaths) {
  if(!Array.isArray(manifestPaths)||manifestPaths.length>128) throw new Error('Asset package count limit exceeded');
  const models=[]; let bytes=0;
  // Sequential loading bounds transient allocations; registry validates the aggregate.
  for(const path of manifestPaths) {
    const model=await loadModelPackage(path);
    bytes+=model.parts.reduce((n,p)=>n+(p.vertices.length+p.triangles.length+(p.normals?.length??0))*128,0);
    if(bytes>256*1024*1024)throw new Error('Asset aggregate decoded memory limit exceeded');
    models.push(model);
  }
  return createAssetRegistry(models);
}

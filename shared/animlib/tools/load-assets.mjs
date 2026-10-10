/** Node-only package I/O. The browser registry has no filesystem or network capability. */
import { open, realpath } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { decodeModelPackage,decodeImagePackage,assetPackageDecodedBytes } from '../dist/asset-package.js';
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
async function packageInput(manifestPath) {
  const file=await realpath(resolve(manifestPath)), root=await realpath(dirname(file));
  const manifest=JSON.parse((await boundedRead(file,1024*1024)).toString('utf8'));
  return {manifest,read:async(path,byteLength)=> {
    const candidate=resolve(root,path); contained(root,candidate);
    const resolved=await realpath(candidate); contained(root,resolved);
    return new Uint8Array(await boundedRead(resolved,byteLength,byteLength));
  }};
}
export async function loadModelPackage(manifestPath) {
  const {manifest,read}=await packageInput(manifestPath);
  return (manifest.kind==='image'?decodeImagePackage:decodeModelPackage)(manifest,read);
}
export async function loadAssetRegistry(manifestPaths,options={}) {
  if(!Array.isArray(manifestPaths)||manifestPaths.length>128) throw new Error('Asset package count limit exceeded');
  const packages=[];let bytes=0;
  // Read bounded manifests first; reject aggregate decoded memory before any blob.
  for(const path of manifestPaths){const pkg=await packageInput(path);if(pkg.manifest.kind==='image'&&options.colorPolicy!=='source')throw new Error('Source image colors require host colorPolicy source');bytes+=assetPackageDecodedBytes(pkg.manifest);if(bytes>256*1024*1024)throw new Error('Asset aggregate decoded memory limit exceeded');packages.push(pkg);}
  const models=[];
  for(const {manifest,read} of packages)models.push(await (manifest.kind==='image'?decodeImagePackage:decodeModelPackage)(manifest,read));
  return createAssetRegistry(models,options);
}

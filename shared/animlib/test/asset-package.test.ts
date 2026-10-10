import { expect, it } from 'vitest';
import { decodeModelPackage } from '../src/asset-package.js';
import { hashAssetBytes, hashAssetContent } from '../src/asset-validation.js';
import { model } from './asset-fixture.js';

async function fixture() {
  const m = model(), blobs = new Map<string,Uint8Array<ArrayBuffer>>();
  const blob = async (name:string, data:Uint8Array<ArrayBuffer>)=> {
    blobs.set(name,data); return {path:name,hash:await hashAssetBytes(data),byteLength:data.byteLength};
  };
  const positions = await blob('positions.bin',new Uint8Array(new Float32Array(m.parts[0].vertices.flat()).buffer));
  const indices = await blob('indices.bin',new Uint8Array(new Uint32Array([0,1,2]).buffer));
  const manifest = {...m,parts:[{id:'body',vertexCount:3,triangleCount:1,positions,indices}],hash:''};
  const sign = async ()=> { const {hash:_hash,...content}=manifest; manifest.hash=await hashAssetContent(content); };
  await sign();
  return { manifest, blobs, sign, read:async(path:string)=>blobs.get(path)! };
}
it('decodes exact checked native bytes and recomputes geometry from them', async()=> {
  const f=await fixture(), decoded=await decodeModelPackage(f.manifest,f.read);
  expect(decoded.parts[0].vertices).toEqual(model().parts[0].vertices);
  expect(decoded.parts[0].triangles).toEqual([[0,1,2]]);
});
it.each(['manifest hash','blob hash','short read','declared length','escape','absolute','backslash','overflow','duplicate'])('rejects corrupt package %s before returning a model',async kind=>{
  const f=await fixture();
  if(kind==='manifest hash') f.manifest.units='mm';
  else {
    if(kind==='blob hash') f.blobs.get('positions.bin')![0]=1;
    if(kind==='short read') f.blobs.set('indices.bin',new Uint8Array(8));
    if(kind==='declared length') f.manifest.parts[0].positions.byteLength=8;
    if(kind==='escape') f.manifest.parts[0].positions.path='../secret';
    if(kind==='absolute') f.manifest.parts[0].positions.path='/secret';
    if(kind==='backslash') f.manifest.parts[0].positions.path='..\\secret';
    if(kind==='overflow') f.manifest.parts[0].vertexCount=Number.MAX_SAFE_INTEGER;
    if(kind==='duplicate') f.manifest.parts.push(f.manifest.parts[0]);
    await f.sign();
  }
  await expect(decodeModelPackage(f.manifest,f.read)).rejects.toThrow();
});

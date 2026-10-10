import {it,expect} from 'vitest';
import {model} from './asset-fixture.js';
import {createAssetRegistry} from '../src/asset-registry.js';
import {decodeModelPackage} from '../src/asset-package.js';
import {hashAssetContent} from '../src/asset-validation.js';
it('rejects holes in coordinates, faces and UV tuples',async()=>{
  for(const kind of ['vertices','triangles','uv0'] as const){
    const input=model();if(kind==='uv0')input.parts[0].uv0=[[0,0],[1,0],[0,1]];
    Reflect.deleteProperty(input.parts[0][kind]![0],0);
    await expect(createAssetRegistry([input])).rejects.toThrow();
  }
});
it('rejects the full decoded model budget before reading any package blobs',async()=>{
  const input=model(),ref={path:'blob.bin',hash:'a'.repeat(64),byteLength:240000};
  const content={kind:'model' as const,version:1 as const,id:'oversized',units:input.units,provenance:input.provenance,
    parts:Array.from({length:7},(_,i)=>({id:'p'+i,vertexCount:20000,triangleCount:20000,positions:ref,indices:ref}))};
  const manifest={...content,hash:await hashAssetContent(content)};let reads=0;
  await expect(decodeModelPackage(manifest,async()=>{reads++;throw new Error('read reached');})).rejects.toThrow(/decoded.*limit/);
  expect(reads).toBe(0);
});

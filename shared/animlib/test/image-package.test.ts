import {it,expect} from 'vitest';
import * as packages from '../src/asset-package.js';
import {hashAssetBytes,hashAssetContent} from '../src/asset-validation.js';
import {imageInput} from './image-fixture.js';
it('decodes a bounded image package with verified manifest and exact pixel hash',async()=>{
  const {pixels,...data}=imageInput(),blob={path:'pixels.rgba',hash:await hashAssetBytes(pixels),byteLength:pixels.byteLength};
  const content={...data,pixels:blob},manifest={...content,hash:await hashAssetContent(content)};
  expect(typeof (packages as any).decodeImagePackage).toBe('function');
  const result=await (packages as any).decodeImagePackage(manifest,async()=>pixels);
  expect([...result.pixels]).toEqual([...pixels]);
  await expect((packages as any).decodeImagePackage({...manifest,width:4097},async()=>{throw new Error('reader must not run');})).rejects.toThrow(/dimension/);
  await expect((packages as any).decodeImagePackage(manifest,async()=>new Uint8Array(16))).rejects.toThrow(/hash/);
  const unsupported={...content,encoding:'linear'},bad={...unsupported,hash:await hashAssetContent(unsupported)};let reads=0;
  await expect((packages as any).decodeImagePackage(bad,async()=>{reads++;return pixels;})).rejects.toThrow(/unsupported image/);
  expect(reads).toBe(0);
});

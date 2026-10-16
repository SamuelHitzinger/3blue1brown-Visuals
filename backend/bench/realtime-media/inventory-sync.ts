import {validateModelMetadata} from '../../../shared/animlib/src/model-metadata.js';
import type {ModelAsset} from '../../../shared/animlib/src/model-types.js';

export interface LectureModelInventory {inventoryId:string;revision:number;assets:Record<string,ModelAsset>}
const digest=/^[a-f0-9]{64}$/;
const fail=():never=>{throw Error('Invalid or conflicting lecture model inventory');};
/** Descriptor inspection precedes reads, so validation cannot execute supplied accessors. */
function plainSnapshot(value:unknown){
 let nodes=0;
 const visit=(item:unknown,depth:number):unknown=>{
  if(++nodes>200000||depth>16)fail();
  if(item===null||typeof item==='boolean'||typeof item==='string')return item;
  if(typeof item==='number'&&Number.isFinite(item))return item;
  if(!item||typeof item!=='object')return fail();
  const array=Array.isArray(item),proto=Object.getPrototypeOf(item);
  if(array?proto!==Array.prototype:proto!==Object.prototype&&proto!==null)fail();
  const out:any=array?[]:Object.create(null);
  for(const key of Reflect.ownKeys(item)){
   if(array&&key==='length')continue;
   if(typeof key!=='string')return fail();
   if(['__proto__','prototype','constructor'].includes(key))fail();
   const field=Object.getOwnPropertyDescriptor(item,key)!;
   if(!('value'in field)||!field.enumerable||array&&!/^(0|[1-9][0-9]*)$/.test(key))fail();
   out[key]=visit(field.value,depth+1);
  }
  if(array&&Object.keys(out).length!==(item as unknown[]).length)fail();
  return out;
 };
 const result=visit(value,0);
 if(new TextEncoder().encode(JSON.stringify(result)).length>2*1024*1024)fail();
 return result;
}
export function validateLectureModelInventory(value:unknown):LectureModelInventory{
 const result=plainSnapshot(value) as LectureModelInventory;
 if(!result||typeof result.inventoryId!=='string'||!digest.test(result.inventoryId)||!Number.isSafeInteger(result.revision)
  ||result.revision<0||result.revision>64||!result.assets||typeof result.assets!=='object'||Array.isArray(result.assets)||Object.keys(result.assets).length>64)fail();
 for(const [id,asset] of Object.entries(result.assets)){
  if(!asset||asset.kind!=='model'||typeof asset.sha256!=='string'||!digest.test(asset.sha256)
   ||asset.provenanceSha256!==undefined&&(typeof asset.provenanceSha256!=='string'||!digest.test(asset.provenanceSha256))
   ||id!==`model-${asset.sha256}${asset.provenanceSha256?'-'+asset.provenanceSha256:''}`
   ||asset.url!==`/lecture-assets/file?assetId=${encodeURIComponent(id)}`)fail();
  validateModelMetadata(asset.metadata);
 }
 return result;
}
function canonical(value:unknown):string{
 if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
 if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonical((value as Record<string,unknown>)[key])).join(',')+'}';
 return JSON.stringify(value);
}
/** Register synchronously before returning a new identity. Older pinned responses cannot downgrade it. */
export function reconcileLectureModelInventory(current:LectureModelInventory,value:unknown,
 register:(assets:Record<string,ModelAsset>)=>void,beforeCommit:()=>void=()=>{}):LectureModelInventory{
 const incoming=validateLectureModelInventory(value);
 const older=incoming.revision<current.revision;
 const subset=older?incoming:current,superset=older?current:incoming;
 for(const [id,asset] of Object.entries(subset.assets))if(!superset.assets[id]||canonical(asset)!==canonical(superset.assets[id]))fail();
 if(incoming.revision===current.revision){
  if(incoming.inventoryId!==current.inventoryId||Object.keys(incoming.assets).length!==Object.keys(current.assets).length)fail();
  return current;
 }
 if(older)return current;
 const additions=Object.fromEntries(Object.entries(incoming.assets).filter(([id])=>!current.assets[id]));
 if(incoming.inventoryId===current.inventoryId||Object.keys(additions).length===0)fail();
 beforeCommit();register(additions);
 return incoming;
}

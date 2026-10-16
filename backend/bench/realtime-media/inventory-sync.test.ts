import {expect,test} from 'bun:test';
import {validateLectureModelInventory,reconcileLectureModelInventory} from './inventory-sync.js';
import type {ModelAsset} from '../../../shared/animlib/src/model-types.js';

const a='model-'+'a'.repeat(64),b='model-'+'b'.repeat(64);
function asset(id:string):ModelAsset{return {kind:'model',url:'/lecture-assets/file?assetId='+encodeURIComponent(id),sha256:id.slice(6),metadata:{version:1,
 parts:[{id:'node-0',name:'triangle',position:[0,0,0],primitives:[0]}],primitives:[{bounds:{min:[0,0,0],max:[1,1,0]},triangles:1}],
 bounds:{min:[0,0,0],max:[1,1,0]},triangles:1,materials:[]}};}
const snapshot=(revision:number,ids:string[])=>({revision,inventoryId:String(revision).repeat(64),assets:Object.fromEntries(ids.map(id=>[id,asset(id)]))});

test('append sends only new assets to existing world and stale response cannot downgrade',()=>{
 const initial=validateLectureModelInventory(snapshot(0,[a])),incoming=snapshot(1,[a,b]);
 let registered:Record<string,ModelAsset>|undefined;
 const next=reconcileLectureModelInventory(initial,incoming,assets=>{registered=assets;});
 expect(Object.keys(registered!)).toEqual([b]);expect(next.revision).toBe(1);
 incoming.assets[b].metadata.parts[0].name='caller mutation';expect(next.assets[b].metadata.parts[0].name).toBe('triangle');
 expect(reconcileLectureModelInventory(next,initial,()=>{throw Error('must not register');})).toBe(next);
});
test('conflicts, removed models and same-revision identity changes fail before registration',()=>{
 const current=validateLectureModelInventory(snapshot(1,[a,b]));let calls=0;
 const candidates=[snapshot(2,[a]),{...snapshot(1,[a,b]),inventoryId:'f'.repeat(64)},snapshot(0,[a,b])];
 candidates[2].assets[a].metadata.parts[0].name='changed';
 for(const value of candidates)expect(()=>reconcileLectureModelInventory(current,value,()=>{calls++;})).toThrow();
 expect(calls).toBe(0);
});
test('failed registration or original deadline guard leaves current snapshot untouched',()=>{
 const current=validateLectureModelInventory(snapshot(0,[a]));let calls=0;
 expect(()=>reconcileLectureModelInventory(current,snapshot(1,[a,b]),()=>{throw Error('store rejected');})).toThrow('store rejected');
 expect(()=>reconcileLectureModelInventory(current,snapshot(1,[a,b]),()=>{calls++;},()=>{throw Error('original deadline');})).toThrow('original deadline');
 expect(current.revision).toBe(0);expect(Object.keys(current.assets)).toEqual([a]);expect(calls).toBe(0);
});
test('rejects external routes, inconsistent identity, invalid metadata and accessors without invoking them',()=>{
 for(const change of [(v:any)=>v.assets[a].url='https://example.com/model.glb',(v:any)=>v.assets[a].sha256='b'.repeat(64),
  (v:any)=>v.assets[a].metadata.triangles=0,(v:any)=>v.revision=65]){
  const value=snapshot(0,[a]);change(value);expect(()=>validateLectureModelInventory(value)).toThrow();
 }
 let called=false;const value=snapshot(0,[a]);Object.defineProperty(value.assets[a],'metadata',{get(){called=true;throw Error('getter');},enumerable:true});
 expect(()=>validateLectureModelInventory(value)).toThrow();expect(called).toBe(false);
});
test('inventory key order has no semantic effect',()=>{
 const current=validateLectureModelInventory(snapshot(1,[a,b]));
 expect(reconcileLectureModelInventory(current,snapshot(1,[b,a]),()=>{throw Error('no change');})).toBe(current);
});

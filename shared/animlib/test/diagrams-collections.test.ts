import {describe,expect,it} from 'vitest';
import {createCollectionBuilders} from '../src/diagrams/collections.js';
import {buildScene} from '../src/runtime.js';
describe('identity-preserving collection swaps',()=>{
  it('retains duplicate values and follows opposing arcs with exact endpoints under arbitrary seeks',()=>{
    const callbacks=new Map<string,(t:number)=>any>();
    buildScene({},s=>{
      const c=createCollectionBuilders({...s,bind(h,_d,fn){callbacks.set(h.id,fn);}}).collection('c',[{id:'first',value:'7'},{id:'second',value:'7'}],{height:1,gap:.2});
      const first=c.items.get('first');
      c.swap('first','second',{start:1,duration:2,clearance:.3});
      expect(c.items.get('first')).toBe(first);expect(c.slots.get('first')).toBe(1);
    });
    const a=callbacks.get('c/item/first')!,b=callbacks.get('c/item/second')!;
    expect(a(0).position).toEqual([0,0]);expect(a(3).position).toEqual([1.2,0]);
    expect(b(3).position).toEqual([0,0]);expect(a(2).position[1]-b(2).position[1]).toBeGreaterThanOrEqual(1.3);
    const mid=a(2);a(3);a(1);expect(a(2)).toEqual(mid);
  });
  it('supports sequential swaps from committed slots and rejects duplicate IDs/overlapping schedules',()=>{
    buildScene({},s=>{
      const c=createCollectionBuilders(s).collection('c',[{id:'a',value:'x'},{id:'b',value:'y'},{id:'c',value:'z'}]);
      c.swap('a','b',{start:0,duration:1});c.swap('a','c',{start:1,duration:1});
      expect([...c.slots]).toEqual([['a',2],['b',0],['c',1]]);
      expect(()=>c.swap('a','b',{start:1,duration:1})).toThrow(/overlap/);
    });
    expect(()=>buildScene({},s=>createCollectionBuilders(s).collection('c',[{id:'a',value:1},{id:'a',value:2}]))).toThrow(/ID/);
  });
});

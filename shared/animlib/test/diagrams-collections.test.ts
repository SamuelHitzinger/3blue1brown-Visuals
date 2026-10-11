import {describe,expect,it} from 'vitest';
import {createCollectionBuilders} from '../src/diagrams/collections.js';
import {buildScene} from '../src/runtime.js';
import {evaluateScene} from '../src/timeline.js';
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

describe('identity-preserving collection permutations',()=>{
  it('moves complete custom records on separated lanes, preserving duplicate values and arbitrary seeks',()=>{
    const callbacks=new Map<string,(t:number)=>any>();
    buildScene({},s=>{
      const records=['old-C','B','new-C'].map(id=>({id,value:'C',handle:s.group('record/'+id,[s.text('route/'+id,{text:id})])}));
      const c=createCollectionBuilders({...s,bind(h,_d,fn){callbacks.set(h.id,fn);}}).collection('q',records,{orientation:'vertical',origin:[-2,2],width:1.6,height:.6,gap:.2});
      c.reorder(['new-C','B','old-C'],{start:1,duration:2,clearance:.2});
      expect([...c.slots]).toEqual([['old-C',2],['B',1],['new-C',0]]);
      expect(c.data.map(d=>d.id)).toEqual(['old-C','B','new-C']);
    });
    const at=(id:string,t:number)=>callbacks.get('q/item/'+id)!(t).position;
    expect(at('old-C',0)).toEqual([-2,2]);expect(at('old-C',3)[0]).toBe(-2);expect(at('old-C',3)[1]).toBeCloseTo(.4);
    expect(at('new-C',3)).toEqual([-2,2]);
    for(let i=0;i<=80;i++) {
      const positions=['old-C','B','new-C'].map(id=>at(id,1+i/40));
      for(let a=0;a<3;a++)for(let b=a+1;b<3;b++)expect(Math.abs(positions[a][0]-positions[b][0])>=1.6-1e-9||Math.abs(positions[a][1]-positions[b][1])>=.6-1e-9).toBe(true);
    }
    const mid=at('new-C',2);at('new-C',4);at('new-C',0);expect(at('new-C',2)).toEqual(mid);
  });
  it('rejects invalid or overlapping orders atomically, and composes with swaps',()=>{
    buildScene({},s=>{
      const c=createCollectionBuilders(s).collection('q',[{id:'a',value:1},{id:'b',value:1},{id:'c',value:2}]);
      const initial=[...c.slots];
      for(const order of [['a','b'],['a','a','c'],['a','b','missing']]) {
        expect(()=>c.reorder(order,{start:0,duration:1})).toThrow(/order|ID/i);expect([...c.slots]).toEqual(initial);
      }
      c.swap('a','b',{start:1,duration:1});const afterSwap=[...c.slots];
      expect(()=>c.reorder(['c','a','b'],{start:1.5,duration:1})).toThrow(/overlap/);expect([...c.slots]).toEqual(afterSwap);
      c.reorder(['c','a','b'],{start:2,duration:2});
      expect(()=>c.swap('a','b',{start:3,duration:1})).toThrow(/overlap/);
      c.swap('a','b',{start:4,duration:1});expect([...c.slots]).toEqual([['a',2],['b',1],['c',0]]);
    });
  });
  it('rejects a sparse permutation before changing any slot or future schedule',()=>{
    buildScene({},s=>{
      const c=createCollectionBuilders(s).collection('q',[{id:'a',value:1},{id:'b',value:2},{id:'c',value:3}]);
      const sparse=['c',,'a'] as string[],before=[...c.slots];
      expect(()=>c.reorder(sparse,{start:0,duration:2})).toThrow();
      expect([...c.slots]).toEqual(before);
      expect(()=>c.reorder(['b','c','a'],{start:0,duration:1})).not.toThrow();
    });
  });
  it('keeps bounded rectangles separated through every three-item permutation in either orientation',()=>{
    for(const orientation of ['horizontal','vertical'] as const)for(const order of [['a','b','c'],['a','c','b'],['b','a','c'],['b','c','a'],['c','a','b'],['c','b','a']]) {
      const callbacks=new Map<string,(t:number)=>any>();
      buildScene({},s=>{
        const c=createCollectionBuilders({...s,bind(h,_d,fn){callbacks.set(h.id,fn);}}).collection('q',[{id:'a',value:1},{id:'b',value:1},{id:'c',value:1}],{orientation,width:1.7,height:1.15,gap:.26});
        c.reorder(order,{start:0,duration:2,clearance:.15});
      });
      for(let step=0;step<=100;step++) {
        const positions=['a','b','c'].map(id=>callbacks.get('q/item/'+id)!(step/50).position);
        for(let a=0;a<3;a++)for(let b=a+1;b<3;b++)expect(Math.abs(positions[a][0]-positions[b][0])>=1.7-1e-9||Math.abs(positions[a][1]-positions[b][1])>=1.15-1e-9).toBe(true);
      }
    }
  });
  it('wraps a custom handle exactly once and obeys normal group ownership',()=>{
    const result=buildScene({},s=>{
      const route=s.text('route',{text:'A-C'}),record=s.group('record',[route]);
      createCollectionBuilders(s).collection('q',[{id:'candidate',value:'C',handle:record}],{orientation:'vertical'});
    });
    const elements=evaluateScene(result,0).elements;
    expect(elements.find(e=>e.id==='q/item/candidate')!.geometry.children).toEqual(['record']);
    expect(elements.some(e=>e.id==='q/cell/candidate')).toBe(false);
    expect(()=>buildScene({},s=>{const h=s.circle('one');createCollectionBuilders(s).collection('q',[{id:'a',value:1,handle:h},{id:'b',value:2,handle:h}]);})).toThrow(/handle|parent/i);
    expect(()=>buildScene({},s=>{const h=s.circle('one');s.group('parent',[h]);createCollectionBuilders(s).collection('q',[{id:'a',value:1,handle:h}]);})).toThrow(/parent/i);
  });
});

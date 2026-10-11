import {expect,it} from 'vitest';
import {buildScene} from '../src/runtime.js';
import {withOfflineScene} from '../src/offline-sampling.js';
import * as core from '../src/core.js';

it('preserves duplicate-value records through compact insertions and extraction',()=>{
  const callbacks=new Map<string,(time:number)=>any>();
  buildScene({},s=>{
    const q=core.createCompactQueueBuilders({...s,bind(h:any,_d:any,fn:any){callbacks.set(h.id,fn);}})
      .compactQueue('q',[{id:'old-C',value:7},{id:'D',value:5},{id:'new-C',value:3}],{initialOrder:['D','old-C'],height:1,gap:.25});
    const old=q.items.get('old-C');q.insert('new-C',0,{start:1,duration:1});q.remove('new-C',{start:3,duration:1});
    expect(q.items.get('old-C')).toBe(old);expect(q.order).toEqual(['D','old-C']);
    const copy=q.order as string[];copy.reverse();expect(q.order).toEqual(['D','old-C']);
  });
  const at=(id:string,t:number)=>callbacks.get('q/item/'+id)!(t);
  expect(at('new-C',0).opacity).toBe(0);expect(at('D',0).position).toEqual([0,0]);
  expect(at('new-C',2)).toEqual({position:[0,0],opacity:1});expect(at('old-C',2).position).toEqual([0,-2.5]);
  expect(at('new-C',4).opacity).toBe(0);expect(at('old-C',4).position).toEqual([0,-1.25]);
  for(let i=0;i<=100;i++)expect(at('D',1+i/100).position[1]-at('old-C',1+i/100).position[1]).toBeCloseTo(1.25,12);
  const mid=at('D',1.37);at('D',8);at('D',0);expect(at('D',1.37)).toEqual(mid);
});

it('rejects invalid schedules atomically and validates ownership before creating wrappers',()=>{
  buildScene({},s=>{
    const q=s.compactQueue('q',[{id:'a',value:'same'},{id:'b',value:'same'},{id:'c',value:3}],{initialOrder:['a','b']});
    for(const order of [['b','a'],['a','a'],['missing'],new Array(2)])expect(()=>q.transition(order,{start:0,duration:1})).toThrow();
    expect(()=>q.transition(['c','a','b'],{start:0,duration:1,entryOffset:[NaN,0]})).toThrow();expect(q.order).toEqual(['a','b']);
    expect(()=>q.transition(['c','a','b'],{start:80000,duration:1e-15})).toThrow();expect(q.order).toEqual(['a','b']);
    q.insert('c',1,{start:1,duration:1});expect(q.order).toEqual(['a','c','b']);
    expect(()=>q.remove('a',{start:1.5,duration:1})).toThrow(/overlap|order/i);expect(q.order).toEqual(['a','c','b']);
    expect(()=>q.insert('c',0,{start:2,duration:1})).toThrow();expect(()=>q.remove('missing',{start:2,duration:1})).toThrow();
    const child=s.text('unparented',{text:'x'});s.group('owner',[child]);
    expect(()=>s.compactQueue('bad',[{id:'child',value:'x',handle:child}])).toThrow();
    // Reusing the planned wrapper ID proves the rejected construction created none.
    s.rectangle('bad/item/child',{width:1,height:1});
  });
});

it('exposes the same queue transport in retained VM callbacks and arbitrary seeks',async()=>{
  const source=`export default scene({},s=>{
    const q=s.compactQueue('q',[{id:'a',value:1},{id:'b',value:2},{id:'c',value:3}],{initialOrder:['a','b'],height:1,gap:.25});
    q.insert('c',0,{start:1,duration:1});q.remove('c',{start:3,duration:1});s.wait(5);
  });`;
  await withOfflineScene(source,{},async sampler=>{
    const find=(t:number,id:string)=>sampler.sample(t).elements.find(e=>e.id===id)!;
    expect(find(0,'q/item/c').opacity).toBe(0);expect(find(2,'q/item/a').position).toEqual([0,-1.25,0]);
    expect(find(4,'q/item/c').opacity).toBe(0);const mid=sampler.sample(1.375);sampler.sample(5);sampler.sample(0);expect(sampler.sample(1.375)).toEqual(mid);
  });
});

it('supports empty subsets, simultaneous arrivals and later reinsertion in horizontal slots',()=>{
  const callbacks=new Map<string,(time:number)=>any>();
  buildScene({},s=>{
    const q=core.createCompactQueueBuilders({...s,bind(h:any,_d:any,fn:any){callbacks.set(h.id,fn);}})
      .compactQueue('h',[{id:'a',value:1},{id:'b',value:2}],{initialOrder:[],orientation:'horizontal',origin:[2,3],width:1,gap:.5});
    q.transition(['a','b'],{start:0,duration:1});q.transition([],{start:1,duration:1});q.insert('b',0,{start:2,duration:1});
  });
  expect(callbacks.get('h/item/a')!(0).opacity).toBe(0);
  expect(callbacks.get('h/item/b')!(1)).toEqual({position:[3.5,3],opacity:1});
  expect(callbacks.get('h/item/a')!(2).opacity).toBe(0);
  expect(callbacks.get('h/item/b')!(3)).toEqual({position:[2,3],opacity:1});
});

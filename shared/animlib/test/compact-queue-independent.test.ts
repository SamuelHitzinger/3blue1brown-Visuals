import {expect,it} from 'vitest';
import {buildScene} from '../src/runtime.js';
import {withOfflineScene} from '../src/offline-sampling.js';
import {createCompactQueueBuilders} from '../src/core.js';
import type {ElementHandle,SceneContext} from '../src/types.js';

it('independently rejects foreign, repeated and colliding handles before any queue creation',()=>{
  let foreign:ElementHandle;
  buildScene({},s=>{foreign=s.text('foreign',{text:'x'});});
  buildScene({},s=>{
    expect(()=>s.compactQueue('foreign-q',[{id:'a',value:1,handle:foreign!}])).toThrow();
    s.rectangle('foreign-q/item/a',{width:1,height:1});
    const own=s.text('own',{text:'x'});
    expect(()=>s.compactQueue('repeat-q',[{id:'a',value:1,handle:own},{id:'b',value:1,handle:own}])).toThrow();
    s.rectangle('repeat-q/item/a',{width:1,height:1});
    // A conflict late in the planned IDs must not leave the first record behind.
    s.text('collision/label/b',{text:'taken'});
    expect(()=>s.compactQueue('collision',[{id:'a',value:1},{id:'b',value:2}])).toThrow();
    for(const id of ['collision/item/a','collision/cell/a','collision/label/a','collision/item/b','collision/cell/b'])s.rectangle(id,{width:1,height:1});
    // Repeated-handle rejection must also leave the original handle unparented.
    s.compactQueue('accepted',[{id:'a',value:1,handle:own}]);
  });
});

it('independently enforces exact transition budget and one-day endpoint without consuming rejected slots',()=>{
  buildScene({},s=>{
    const q=s.compactQueue('budget',[{id:'a',value:1},{id:'b',value:2}]);
    for(let i=0;i<256;i++){
      expect(()=>q.transition(['b','a'],{start:i,duration:1})).toThrow();
      q.transition(['a','b'],{start:i,duration:1});
    }
    expect(()=>q.remove('a',{start:256,duration:1})).toThrow(/budget/);
    expect(q.order).toEqual(['a','b']);
    const end=s.compactQueue('endpoint',[{id:'a',value:1}],{initialOrder:[]});
    expect(()=>end.insert('a',0,{start:86399,duration:1.0001})).toThrow();
    expect(()=>end.insert('a',0,{start:86399,duration:1})).not.toThrow();
  });
});

it('independently snapshots caller data, order, origin and offsets and preserves survivor separation',()=>{
  const callbacks=new Map<string,(t:number)=>any>();
  buildScene({},s=>{
    const origin:[number,number]=[2,3],entry:[number,number]=[-2,0],exit:[number,number]=[3,0];
    const data=['a','b','c','d','e'].map(id=>({id,value:id}));
    const initial=['a','b','c','d'],next=['a','e','b','d'];
    const q=createCompactQueueBuilders({...s,bind(h:any,_d:any,fn:any){callbacks.set(h.id,fn);}} as SceneContext)
      .compactQueue('copy',data,{initialOrder:initial,origin,height:1,gap:.2});
    q.transition(next,{start:1,duration:2,entryOffset:entry,exitOffset:exit});
    data[0].id='changed';data[0].value='changed';initial.reverse();next.reverse();origin[1]=90;entry[0]=99;exit[0]=99;
    expect(q.data[0]).toMatchObject({id:'a',value:'a'});expect(Object.isFrozen(q.data)).toBe(true);expect(Object.isFrozen(q.data[0])).toBe(true);
    expect(q.order).toEqual(['a','e','b','d']);
  });
  const at=(id:string,t:number)=>callbacks.get('copy/item/'+id)!(t);
  expect(at('a',0).position).toEqual([2,3]);
  expect(at('e',1)).toEqual({position:[0,1.8],opacity:0});
  expect(at('c',2.6).position[0]).toBeCloseTo(5,12);
  for(let n=0;n<=200;n++){
    const t=1+n/100;
    expect(at('a',t).position[1]-at('b',t).position[1]).toBeGreaterThanOrEqual(1.2-1e-12);
    expect(at('b',t).position[1]-at('d',t).position[1]).toBeGreaterThanOrEqual(1.2-1e-12);
  }
});

it('independently matches host and retained compiled transport at phase boundaries in reverse order',async()=>{
  const callbacks=new Map<string,(t:number)=>any>();
  const setup=(s:SceneContext)=>{
    const q=s.compactQueue('parity',['a','b','c','d'].map(id=>({id,value:'same'})),{initialOrder:['a','c'],orientation:'horizontal',origin:[-2,1],width:1,gap:.25});
    q.transition(['a','b','c'],{start:.5,duration:1,entryOffset:[0,2]});
    q.transition(['b','d'],{start:1.5,duration:1,exitOffset:[0,-2]});
    q.transition([],{start:3,duration:.5});q.insert('a',0,{start:4,duration:.5});s.wait(5);
  };
  buildScene({},s=>setup({...s,...createCompactQueueBuilders({...s,bind(h:any,_d:any,fn:any){callbacks.set(h.id,fn);}} as SceneContext)}));
  const source=`export default scene({},${setup.toString()});`;
  await withOfflineScene(source,{},async sampler=>{
    const times=[0,.5,.7,1,1.3,1.5,1.7,2,2.3,2.5,3,3.1,3.25,3.4,3.5,4,4.1,4.25,4.4,4.5,5];
    for(const t of [...times,...[...times].reverse(),1.137,4.371,.137]){
      const frame=sampler.sample(t);
      for(const id of ['a','b','c','d']){
        const expected=callbacks.get('parity/item/'+id)!(t);
        const actual=frame.elements.find(e=>e.id==='parity/item/'+id)!;
        expect(actual.position).toEqual([...expected.position,0]);expect(actual.opacity).toBeCloseTo(expected.opacity,12);
      }
    }
  });
});

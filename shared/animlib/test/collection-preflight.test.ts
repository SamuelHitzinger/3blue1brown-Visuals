import {describe,expect,it} from 'vitest';
import {createCollectionBuilders} from '../src/diagrams/collections.js';
import {buildScene} from '../src/runtime.js';
import {evaluateScene} from '../src/timeline.js';
import {withOfflineScene} from '../src/offline-sampling.js';
import type {ElementHandle,SceneContext} from '../src/types.js';

describe('collection preflight before wrapping caller-owned handles',()=>{
  for(const entry of ['method','factory'] as const)for(const failure of ['parent','foreign','view','wrapper-id','cell-id','label-id'] as const)
    it(`leaves earlier content unparented after later ${failure} failure through ${entry}`,()=>{
      let foreign!:ElementHandle;
      buildScene({},s=>{foreign=s.circle('b');});
      const compiled=buildScene({},s=>{
        const a=s.circle('a');let b:ElementHandle|undefined;
        if(failure==='parent'){b=s.circle('b');s.group('existing',[b]);}
        if(failure==='foreign'){s.circle('b');b=foreign;}
        if(failure==='view')s.view('v',{rect:[0,0,1,1]},v=>{b=v.circle('b');});
        if(failure.endsWith('-id'))s.circle(`q/${failure==='wrapper-id'?'item':failure==='cell-id'?'cell':'label'}/b`);
        const factory=entry==='method'?s:createCollectionBuilders(s);
        expect(()=>factory.collection('q',[{id:'a',value:1,handle:a},{id:'b',value:2,...(b?{handle:b}:{})}])).toThrow();
        s.group('recovery',[a]);
      });
      const elements=evaluateScene(compiled,0).elements;
      expect(elements.find(e=>e.id==='recovery')?.geometry.children).toEqual(['a']);
      expect(elements.some(e=>e.id==='q/item/a')).toBe(false);
    });

  it('rejects the full planned element budget before wrapping the first handle',()=>{
    buildScene({},s=>{
      const a=s.circle('a');for(let i=0;i<1997;i++)s.circle('existing/'+i);
      expect(()=>s.collection('q',[{id:'a',value:1,handle:a},{id:'b',value:2}])).toThrow(/limit/);
      s.group('recovery',[a]);
    });
  });
  for(const entry of ['method','factory'] as const)
    it(`rejects a later sparse item before wrapping earlier content through ${entry}`,()=>{
      const compiled=buildScene({},s=>{
        const a=s.circle('a'),input=[{id:'a',value:1,handle:a}];input.length=2;
        const factory=entry==='method'?s:createCollectionBuilders(s);
        expect(()=>factory.collection('q',input)).toThrow();
        s.group('recovery',[a]);s.circle('q/item/a');
      });
      expect(evaluateScene(compiled,0).elements.find(e=>e.id==='recovery')?.geometry.children).toEqual(['a']);
    });
  it('preflights dense children and complete ID lists without reserving IDs or membership',()=>{
    buildScene({},s=>{
      const a=s.circle('a');
      for(const ids of [['later','a'],['later','later'],['later','@invalid'],['later','x'.repeat(257)],['later',,'end'] as string[]])
        expect(()=>s.validateGroup([a],ids)).toThrow();
      expect(()=>s.validateGroup([a,a],['later'])).toThrow(/duplicate/i);
      expect(()=>s.validateGroup([a,,] as ElementHandle[],['later'])).toThrow(/handle/i);
      s.validateGroup([a],['later']);s.validateGroup([a],['later']);
      s.group('later',[a]);
    });
  });
});

it('preserves public QuickJS recovery after rejecting a later sparse collection item',async()=>{
  await withOfflineScene(`export default scene({},s=>{
    const a=s.circle('a'),input=[{id:'a',value:1,handle:a}];input.length=2;
    let caught=false;try{s.collection('q',input);}catch{caught=true;}
    if(!caught)throw Error('Missing sparse-item rejection');
    const group=s.group('recovery',[a]);s.circle('q/item/a');
    s.bind(group,[s.time],t=>({position:[t,0]}));s.wait(2);
  });`,{},sampler=>{
    const before=sampler.sample(.25);sampler.sample(1.75);expect(sampler.sample(.25)).toEqual(before);
    expect(before.elements.find(e=>e.id==='recovery')?.geometry.children).toEqual(['a']);
    expect(before.elements.find(e=>e.id==='q/item/a')?.geometry.kind).toBe('circle');
  });
});

const recover=(s:SceneContext)=>{
  const a=s.circle('a'),b=s.circle('b');s.group('existing',[b]);
  let caught=false;try{s.collection('q',[{id:'a',value:1,handle:a},{id:'b',value:2,handle:b}]);}catch{caught=true;}
  if(!caught)throw Error('Missing parent rejection');
  s.circle('q/item/b');caught=false;
  try{s.collection('q',[{id:'a',value:1,handle:a},{id:'b',value:2}]);}catch{caught=true;}
  if(!caught)throw Error('Missing generated-ID rejection');
  const group=s.group('recovery',[a]);s.bind(group,[s.time],t=>({position:[t,0]}));s.wait(2);
};
it('preserves host and public QuickJS caught-failure recovery and reverse seeks',async()=>{
  const host=buildScene({},recover);
  expect(evaluateScene(host,0).elements.find(e=>e.id==='recovery')?.geometry.children).toEqual(['a']);
  await withOfflineScene(`export default scene({},${recover.toString()});`,{},sampler=>{
    const before=sampler.sample(.25);sampler.sample(1.75);expect(sampler.sample(.25)).toEqual(before);
    expect(before.elements.find(e=>e.id==='recovery')?.geometry.children).toEqual(['a']);
    expect(before.elements.some(e=>e.id==='q/item/a')).toBe(false);
  });
});

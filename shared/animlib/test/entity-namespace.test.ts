import {describe,it,expect} from 'vitest';
import {compileSource,validateCompiledScene} from '../src/compiler.js';
import {SourceCompiler} from '../src/compiler-client.js';
import {evaluateScene} from '../src/timeline.js';
import {mergeReactiveUpdates} from '../src/reactive.js';
import type {CompileInput} from '../src/types.js';

const input=(entityNamespace:string):CompileInput=>({entityNamespace} as CompileInput);
const source=`export default scene({end:'hold'},s=>{
  const a=s.circle('AD',{position:[-1,0,0],radius:.1});
  const b=s.circle('B',{position:[1,0,0],radius:.1});
  const label=s.latex('label',{tex:'AD',anchor:undefined});
  const edge=s.line('edge',{points:[[-1,0,0],[1,0,0]]});
  s.attach(label,a,{offset:[0,.7,0]});s.connect(edge,a,b);
  const group=s.group('diagram',[a,b,label,edge]);
  s.play(group.moveTo([0,1,0]),{duration:1,ease:'linear'});
  s.keep(group);s.wait(1);s.remove(group);
});`;

describe('opt-in host entity namespaces',()=>{
  it('qualifies identical local IDs independently without rewriting source, tracks, or bindings',async()=>{
    const raw=await compileSource(source),one=await compileSource(source,input('p1')),two=await compileSource(source,input('p2'));
    const ids=(scene:typeof raw)=>scene.lifecycle.flatMap(e=>e.type==='add'?e.ids:[]);
    expect(ids(one)).toEqual(ids(raw).map(id=>`p1/${id}`));
    expect(ids(two)).toEqual(ids(raw).map(id=>`p2/${id}`));
    expect(new Set([...ids(one),...ids(two)]).size).toBe(ids(one).length+ids(two).length);
    expect(one.bindings).toEqual([{type:'attach',target:'p1/label',source:'p1/AD',offset:[0,.7,0]},
      {type:'connect',target:'p1/edge',from:'p1/AD',to:'p1/B'}]);
    expect(one.tracks[0].action.ids).toEqual(['p1/diagram']);
    expect(Object.keys(one.tracks[0].from)).toEqual(['p1/diagram']);
    expect(one.tracks[0].from['p1/diagram'].geometry.children).toEqual(['p1/AD','p1/B','p1/label','p1/edge']);
    expect(one.lifecycle.filter(e=>e.type!=='add').flatMap(e=>e.ids).every(id=>id.startsWith('p1/'))).toBe(true);
    expect(()=>validateCompiledScene(one)).not.toThrow();
    for(const time of [0,.5,1,2]){
      const actual=evaluateScene(one,time).elements.map(e=>({...e,id:e.id.slice(3),geometry:{...e.geometry,...(e.geometry.children?{children:e.geometry.children.map(id=>id.slice(3))}:{})}}));
      expect(actual).toEqual(evaluateScene(raw,time).elements);
    }
  });

  it('keeps component-builder local handle contracts and literal labels/TeX names intact',async()=>{
    const scene=await compileSource(String.raw`export default scene({},s=>{
      s.compose('part',{label:{kind:'text',props:{text:'part/label'}}});
      s.latex('formula',{tex:'\\animpart{term}{AD}',anchor:'term'});s.wait(1);
    });`,input('p1'));
    const elements=evaluateScene(scene,0).elements;
    expect(elements.find(e=>e.id==='p1/part/label')!.geometry.text).toBe('part/label');
    expect(elements.find(e=>e.id==='p1/formula')!.geometry).toMatchObject({tex:String.raw`\animpart{term}{AD}`,anchor:'term'});
  });

  it('retains local slider keys while qualifying every reactive output and compiler session',async()=>{
    const compiler=new SourceCompiler();
    try{
      const scene=await compiler.compile(`export default scene({},s=>{
        const k=s.slider('gain',{reactive:true,default:1,min:0,max:3});
        const a=s.circle('AD');s.bind(a,[k,s.time],(v,t)=>({position:[v+t,0,0]}));s.wait(3);
      });`,input('p1'));
      expect(compiler.canUpdate(scene)).toBe(true);
      expect(scene.controls[0].id).toBe('gain');expect(scene.reactiveBindings![0]).toMatchObject({target:'p1/AD',controls:['gain']});
      const updates=await compiler.update(scene,{gain:2},['gain'],{},1);
      expect(updates).toEqual([{target:'p1/AD',properties:{position:[3,0,0]}}]);
      const snapshot={...scene,reactiveBindings:mergeReactiveUpdates(scene,updates,['gain'],1),reactiveTime:1};
      expect(evaluateScene(snapshot,1).elements[0]).toMatchObject({id:'p1/AD',position:[3,0,0]});
      compiler.retain([]);expect(compiler.canUpdate(scene)).toBe(false);
    }finally{compiler.dispose();}
  });

  it('rejects invalid namespaces, overlong qualified IDs, and ambiguous previous-frame handoffs',async()=>{
    for(const prefix of ['', 'p/1', '@p', '1p', 'p'.repeat(33)])await expect(compileSource(source,input(prefix))).rejects.toThrow(/namespace/i);
    await expect(compileSource(`export default scene({},s=>s.circle('${'a'.repeat(126)}'));`,input('p1'))).rejects.toThrow(/128/);
    const raw=await compileSource(source);
    await expect(compileSource(source,{...input('p1'),previous:evaluateScene(raw,0)})).rejects.toThrow(/previous/i);
  });
});

import {it,expect} from 'vitest';
import {buildScene} from '../src/runtime.js';
import {compileSource} from '../src/compiler.js';
import {withOfflineScene} from '../src/offline-sampling.js';
import type {SceneContext} from '../src/types.js';
const builder=(s:SceneContext)=>{
  const props={axis:Array.from({length:6},(_,i)=>[i*.8,0,0]),template:'ACGTAC'.split('').map((base,i)=>({id:`t${i}`,base})),coding:'TGCATG'.split('').map((base,i)=>({id:`c${i}`,base})),pairs:Array.from({length:6},(_,i)=>[`t${i}`,`c${i}`]),templateDirection:'3to5',codingDirection:'5to3',initialNormal:[0,1,0],radius:.85,backboneRadius:.08,twistPerBase:.5,window:{start:0,end:5,separation:1}};
  const initial=s.nucleicDuplex(props as never,0),open=s.nucleicDuplex(props as never,1);
  const tx={id:'rna',bases:[{id:'r1',base:'G',templateId:'t1'},{id:'r2',base:'C',templateId:'t2'}],duplex:open,start:1,secondsPerBase:.5,approachFraction:.7,radius:.08};
  const mesh=s.mesh('dna',initial.parts[0].geometry);
  s.bind(mesh,[s.time],t=>({vertices:s.nucleicDuplex(props as never,Math.min(t,1)).parts[0].geometry.vertices}));
  const rna=s.mesh('rna',s.nucleicTranscript(tx as never,0).parts[0].geometry);
  s.bind(rna,[s.time],t=>({vertices:s.nucleicTranscript(tx as never,t).parts[0].geometry.vertices}));s.wait(3);
};
it('installs identical bounded host and QuickJS nucleic methods and retains absolute-time reverse seeks',async()=>{
  const source=`export default scene({},${builder.toString()});`,host=buildScene({},builder),vm=await compileSource(source);
  // Host V8 and QuickJS transcendental results differ at floating-point epsilon.
  const rounded=(x:unknown)=>JSON.parse(JSON.stringify(x,(_,v)=>typeof v==='number'?Math.round(v*1e10)/1e10:v));
  expect(rounded(vm.lifecycle)).toEqual(rounded(host.lifecycle));
  await withOfflineScene(source,{},sampler=>{const a=sampler.sample(.25),b=sampler.sample(1.2);expect(a.elements[0].geometry.vertices).not.toEqual(b.elements[0].geometry.vertices);sampler.sample(3);expect(sampler.sample(.25)).toEqual(a);expect(sampler.sample(1.2)).toEqual(b);});
});

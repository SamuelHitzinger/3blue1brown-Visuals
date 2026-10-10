import { describe, expect, it } from 'vitest';
import { buildScene } from '../src/runtime.js';
import { compileSource } from '../src/compiler.js';
import { withOfflineScene } from '../src/offline-sampling.js';
import { evaluateScene } from '../src/timeline.js';
import type { SceneContext } from '../src/types.js';

const builder=(s:SceneContext)=>{
 const spec={lengths:[1,1],from:[[0,0],[0,0]],to:[[.7,0],[.7,0]],start:0,duration:2};
 const props=(time:number)=>({representation:'backbone',radius:.08,segments:[{id:'seg',chainId:'A',residues:s.articulatedChainPose(spec as never,time).map((position,i)=>({id:String(i),position,value:i/2}))}],bonds:[],provenance:{kind:'schematic',source:'test',units:'local'}} as const);
 const initial=s.molecularBackboneGeometry(props(0) as never);
 const mesh=s.mesh('live',initial.meshes[0]);
 s.bind(mesh,[s.time],t=>({vertices:s.molecularBackboneGeometry(props(t) as never).meshes[0].vertices}));
 s.molecularBackbone('static',props(0) as never);
 s.plane('plane',{xRange:[-1,1],yRange:[-1,1],grid:false,ticks:false});
 s.collection('items',[{id:'a',value:1},{id:'b',value:2}]);
 const data={nodes:[{id:'a',position:[0,0]},{id:'b',position:[2,0]}],edges:[{id:'ab',from:'a',to:'b',weight:2}]};
 const trace=s.dijkstra(data as never,'a');if(trace.distances.b!==2)throw Error('trace mismatch');
 s.graph('g',data as never);s.wait(2);
};
describe('shared scene domain integration',()=>{
 it('uses identical host and QuickJS factories under default compilation limits',async()=>{
  const source=`export default scene({},${builder.toString()});`;
  const host=buildScene({},builder),vm=await compileSource(source);
  expect(vm.lifecycle).toEqual(host.lifecycle);expect(vm.reactiveBindings).toEqual(host.reactiveBindings);
 });
 it('allows pure molecular helpers during retained callbacks and preserves topology across seeks',async()=>{
  await withOfflineScene(`export default scene({},${builder.toString()});`,{},sampler=>{
   const a=sampler.sample(0).elements.find(e=>e.id==='live')!,b=sampler.sample(1).elements.find(e=>e.id==='live')!;
   expect(b.geometry.vertices).not.toEqual(a.geometry.vertices);expect(b.geometry.vertices).toHaveLength(a.geometry.vertices!.length);
   expect(b.geometry.triangles).toEqual(a.geometry.triangles);sampler.sample(2);expect(sampler.sample(0)).toEqual(evaluateScene(sampler.scene,0));
   expect(sampler.sample(1).elements.find(e=>e.id==='live')).toEqual(b);
  });
 });
});

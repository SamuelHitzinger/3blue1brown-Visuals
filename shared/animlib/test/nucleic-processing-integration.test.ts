import {expect,it} from 'vitest';
import {buildScene} from '../src/runtime.js';
import {compileSource} from '../src/compiler.js';
import {withOfflineScene} from '../src/offline-sampling.js';
import * as core from '../src/core.js';
import type {SceneContext,Vec3} from '../src/types.js';

const builder=(s:SceneContext)=>{
  const splice={sites:Array.from({length:12},(_,i)=>({id:`r${i}`,base:'A' as const,position:[i*.5,0,0] as Vec3})),
    intron:{start:4,end:7},initialNormal:[0,1,0] as Vec3,baseReach:.25,joinDistance:.5,
    departure:{translation:[0,3,1] as Vec3,axis:[0,0,1] as Vec3,angle:1.4}};
  const thread={sites:Array.from({length:8},(_,i)=>({id:`p${i}`,base:'U' as const,offset:i*.4})),
    path:[[-8,1,0],[-.5,0,0],[.5,0,0],[8,1,0]] as Vec3[],initialNormal:[0,0,1] as Vec3,baseReach:.2,
    aperture:{center:[0,0,0] as Vec3,normal:[1,0,0] as Vec3,radius:1,halfThickness:.5,chainRadius:.3}};
  const spliceVertices=(t:number)=>{
    const r=s.nucleicSplice(splice,t);
    return [r.anchors[3].backbone,r.anchors[3].tip,r.anchors[8].backbone];
  };
  const threadVertices=(t:number)=>{
    const r=s.nucleicThread(thread,t);
    return [r.anchors[0].backbone,r.anchors[0].tip,r.anchors[7].backbone];
  };
  const cut=s.mesh('splice',{vertices:spliceVertices(0),triangles:[[0,1,2]]});
  const pore=s.mesh('thread',{vertices:threadVertices(0),triangles:[[0,1,2]]});
  s.bind(cut,[s.time],t=>({vertices:spliceVertices(t)}));
  s.bind(pore,[s.time],t=>({vertices:threadVertices(t)}));
  s.wait(1);
};
const source=`export default scene({},${builder.toString()});`;
const rounded=(v:unknown)=>JSON.parse(JSON.stringify(v,(_,x)=>typeof x==='number'?Math.round(x*1e10)/1e10:x));

it('exports the same pure processing factory through core',()=>{
  expect(typeof core.createNucleicProcessingBuilders).toBe('function');
  expect(Object.keys(core.createNucleicProcessingBuilders()).sort()).toEqual(['nucleicSplice','nucleicThread']);
});

it('installs processing methods in both host and public QuickJS scenes',async()=>{
  const host=buildScene({},builder),vm=await compileSource(source);
  expect(rounded(vm.lifecycle)).toEqual(rounded(host.lifecycle));
});

it('retains pure processing callbacks across cut, join, pore crossing and reverse seeks',async()=>{
  await withOfflineScene(source,{},sampler=>{
    const times=[0,.199999,.2,.200001,.5,.699999,.7,.700001,.95,1];
    const frames=times.map(t=>sampler.sample(t));
    expect(frames[0].elements.map(e=>e.geometry.vertices)).not.toEqual(frames.at(-1)!.elements.map(e=>e.geometry.vertices));
    for(let i=times.length-1;i>=0;i--)expect(sampler.sample(times[i])).toEqual(frames[i]);
    for(const i of [4,1,8,0,7,3])expect(sampler.sample(times[i])).toEqual(frames[i]);
  });
});

it('matches host and retained VM loop formation through bends, holds, cuts and reverse seeks',async()=>{
  const props={sites:Array.from({length:16},(_,i)=>({id:`loop${i}`,base:'A' as const,position:[i*.4,0,0] as Vec3})),intron:{start:4,end:11},initialNormal:[0,1,0] as Vec3,baseReach:.2,joinDistance:.3,formation:{start:.03,end:.17,angle:Math.PI*1.6,bendDirection:[0,1,0] as Vec3},departure:{translation:[0,2,1] as Vec3,axis:[0,0,1] as Vec3,angle:.6}};
  const src=`export default scene({},s=>{const p=${JSON.stringify(props)};const verts=t=>{const r=s.nucleicSplice(p,t);return [r.anchors[3].backbone,r.anchors[7].backbone,r.anchors[12].backbone];};const h=s.mesh('loop',{vertices:verts(0),triangles:[[0,1,2]]});s.bind(h,[s.time],t=>({vertices:verts(t)}));s.wait(1);});`;
  const api=core.createNucleicProcessingBuilders();
  await withOfflineScene(src,{},sampler=>{
    const times=[0,.029999,.03,.030001,.07,.13,.169999,.17,.170001,.199999,.2,.200001,.4,.7,1];
    const frames=times.map(t=>sampler.sample(t));
    for(let i=times.length-1;i>=0;i--){const r=api.nucleicSplice(props,times[i]),frame=sampler.sample(times[i]);expect(frame).toEqual(frames[i]);expect(rounded(frame.elements[0].geometry.vertices)).toEqual(rounded([r.anchors[3].backbone,r.anchors[7].backbone,r.anchors[12].backbone]));}
  });
});

import {expect,it} from 'vitest';
import {buildScene} from '../src/runtime.js';
import {compileSource} from '../src/compiler.js';
import {withOfflineScene} from '../src/offline-sampling.js';
import * as core from '../src/core.js';
import type {SceneContext,NucleicTranscriptionCycleProps} from '../src/types.js';

const builder=(s:SceneContext)=>{
  const props:NucleicTranscriptionCycleProps={
    template:Array.from({length:24},(_,i)=>({id:'t'+i,base:'ACGT'[i%4] as 'A'})),
    coding:Array.from({length:24},(_,i)=>({id:'c'+i,base:'TGCA'[i%4] as 'T'})),
    pairs:Array.from({length:24},(_,i)=>['t'+i,'c'+i]),
    transcript:Array.from({length:8},(_,i)=>({id:'r'+i,base:'CAUG'[i%4] as 'C',templateId:'t'+(i+6)})),
    templateDirection:'3to5',codingDirection:'5to3',
    axis:{origin:[1,-2,3],direction:[1,.2,.1],normal:[0,1,.2]},
    radius:.75,pitch:.8,twistPerBase:.58,baseReach:.675,window:{halfWidth:4,separation:1.1,lockOrientation:true},
    start:1,cycleDuration:.7,dockFraction:.6,opening:{start:0,duration:.8},
    exitDirection:[-1,0,0],exitFrame:'axis',exitBend:.13,rnaLinkLength:.65,incomingAngle:2.1,
  };
  const vertices=(time:number)=>{
    const pose=s.nucleicTranscriptionCycle(props,time);
    return [pose.dna.anchors[6].backbone,pose.dna.anchors[6].tip,pose.activeSite.position,
      pose.rna.anchors[0].backbone,pose.rna.anchors[0].tip,pose.rna.anchors[7].backbone];
  };
  const mesh=s.mesh('cycle',{vertices:vertices(0),triangles:[[0,1,2],[3,4,5]]});
  s.bind(mesh,[s.time],time=>({vertices:vertices(time)}));
  s.wait(7);
};
const source=`export default scene({},${builder.toString()});`;
const rounded=(v:unknown)=>JSON.parse(JSON.stringify(v,(_,x)=>typeof x==='number'?Math.round(x*1e10)/1e10:x));

it('exports the moving cycle factory through core',()=>{
  expect(typeof core.createNucleicTranscriptionCycleBuilders).toBe('function');
  expect(Object.keys(core.createNucleicTranscriptionCycleBuilders())).toEqual(['nucleicTranscriptionCycle']);
});

it('compiles the same moving cycle in host and QuickJS',async()=>{
  const host=buildScene({},builder),vm=await compileSource(source);
  expect(rounded(vm.lifecycle)).toEqual(rounded(host.lifecycle));
});

it('retains cycle callbacks across opening, each docking boundary, completion and reverse seeks',async()=>{
  await withOfflineScene(source,{},sampler=>{
    const times=[0,.8,1];
    for(let i=0;i<8;i++)for(const f of [0,.599999,.6,.600001,1])times.push(1+(i+f)*.7);
    times.push(7);
    const frames=times.map(time=>sampler.sample(time));
    expect(frames[0].elements[0].geometry.vertices).not.toEqual(frames.at(-1)!.elements[0].geometry.vertices);
    for(let i=times.length-1;i>=0;i--)expect(sampler.sample(times[i])).toEqual(frames[i]);
    for(const i of [12,1,31,0,7,40])expect(sampler.sample(times[i])).toEqual(frames[i]);
  });
});

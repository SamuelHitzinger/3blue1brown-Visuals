import {describe,expect,it} from 'vitest';
import {createNucleicBuilders} from '../src/nucleic-structures.js';
import {createMolecularBackboneBuilders} from '../src/molecular-backbone.js';
import {createMoleculeBuilders} from '../src/molecules.js';
import type {NucleicTranscriptProps} from '../src/nucleic-types.js';
import {buildScene} from '../src/runtime.js';
import {withOfflineScene} from '../src/offline-sampling.js';
import type {SceneContext} from '../src/types.js';
const api=createNucleicBuilders(createMolecularBackboneBuilders(createMoleculeBuilders()));
const fixture=():NucleicTranscriptProps=>({
  id:'rna',duplex:api.nucleicDuplex({axis:Array.from({length:4},(_,i)=>[i,0,0]),template:[...'AAAA'].map((base,i)=>({id:'t'+i,base:base as 'A'})),coding:[...'TTTT'].map((base,i)=>({id:'c'+i,base:base as 'T'})),pairs:Array.from({length:4},(_,i)=>['t'+i,'c'+i]),templateDirection:'3to5',codingDirection:'5to3',initialNormal:[0,1,0],radius:.85,backboneRadius:.08,twistPerBase:0,window:{start:0,end:3,separation:1}},1),
  bases:[0,1,2,3].map(i=>({id:'r'+i,base:'U',templateId:'t'+i})),start:0,secondsPerBase:1,approachFraction:.75,radius:.07,
  emergence:{direction:[1,0,0],distance:3,delay:0,duration:1},
});
describe('whole-schedule RNA emergence preflight',()=>{
  it('preserves the fixed-anchor default snapshot and exact backward seeks',()=>{
    const p={...fixture(),emergence:undefined},r=api.nucleicTranscript(p,8);
    // Straight four-site fixture: opening preserves unit links with .8/.6 end slopes.
    expect(r.anchors.map(a=>a.backbone.map(v=>Number(v.toFixed(9))))).toEqual([[.2,.605,0],[1,.005,0],[2,.005,0],[2.8,.605,0]]);
    expect(r.anchors.map(a=>a.tip.map(v=>Number(v.toFixed(9))))).toEqual([[.2,-.16,0],[1,-.76,0],[2,-.76,0],[2.8,-.16,0]]);
    expect(r.anchors.map(a=>[a.normal.map(v=>v||0),a.tangent.map(v=>v||0)])).toEqual(Array.from({length:4},()=>[[0,-1,0],[1,0,0]]));
    for(const length of r.linkLengths)expect(length).toBeCloseTo(1,12);
    const before=api.nucleicTranscript(p,2);api.nucleicTranscript(p,8);api.nucleicTranscript(p,0);expect(api.nucleicTranscript(p,2)).toEqual(before);
  });
  it('rejects the reproduced collinear fold at initialization, collapse, and every seek time',()=>{
    const p=fixture();
    const times=[-1,0,2.1369631431053957,2.136964143105396,8,...Array.from({length:101},(_,k)=>k/20),...Array.from({length:101},(_,k)=>2.1369631431053957+(k-50)*1e-8)];
    for(const time of [...times,...times.reverse()])expect(()=>api.nucleicTranscript(p,time)).toThrow(/Unsupported RNA emergence schedule/);
  });
  it('rejects near-antipodal frame schedules upfront even if their desired link never reaches zero',()=>{
    const p=fixture();p.emergence!.direction=[1,0,1e-5];
    for(const time of [0,2.1369631431053957,2.75,8])expect(()=>api.nucleicTranscript(p,time)).toThrow(/Unsupported RNA emergence schedule/);
  });
  it('accepts safe tangent motion and a slower schedule with the same large exit distance',()=>{
    for(const [distance,duration] of [[.999,1],[3,5]]){
      const p=fixture();Object.assign(p.emergence!,{distance,duration});
      const baseline=api.nucleicTranscript({...p,emergence:undefined},10),times=Array.from({length:201},(_,i)=>i/20);
      for(const t of times){
        const r=api.nucleicTranscript(p,t),plain=api.nucleicTranscript({...p,emergence:undefined},t);
        for(let i=0;i<r.anchors.length;i++){
          const a=r.anchors[i];expect([...a.backbone,...a.tip,...a.normal,...a.tangent].every(Number.isFinite)).toBe(true);
          if(i>=r.incorporated)expect(a).toEqual(plain.anchors[i]);
          if(i>0&&i<r.incorporated)expect(Math.hypot(...a.backbone.map((v,j)=>v-r.anchors[i-1].backbone[j]))).toBeCloseTo(baseline.linkLengths[i-1],10);
        }
      }
      const middle=api.nucleicTranscript(p,2.1369631431053957);api.nucleicTranscript(p,10);api.nucleicTranscript(p,0);expect(api.nucleicTranscript(p,2.1369631431053957)).toEqual(middle);
    }
  });
  it('retains finite continuous frames and formed links near the old critical time for an oblique exit',()=>{
    const p=fixture();p.emergence!.direction=[1,0,.2];
    const rest=api.nucleicTranscript({...p,emergence:undefined},8);
    const times=[...Array.from({length:201},(_,i)=>i/40),...Array.from({length:201},(_,i)=>2.1369631431053957+(i-100)*1e-7)].sort((a,b)=>a-b);
    for(const t of times){
      const r=api.nucleicTranscript(p,t),later=api.nucleicTranscript(p,t+1e-7),plain=api.nucleicTranscript({...p,emergence:undefined},t);
      for(let i=0;i<r.anchors.length;i++){
        const a=r.anchors[i],b=later.anchors[i];
        expect(Math.hypot(...a.backbone.map((v,j)=>v-b.backbone[j]))).toBeLessThan(1e-4);
        expect(Math.hypot(...a.normal.map((v,j)=>v-b.normal[j])),`normal continuity at t=${t}, site=${i}`).toBeLessThan(1e-4);
        expect(Math.hypot(...a.tangent.map((v,j)=>v-b.tangent[j]))).toBeLessThan(1e-4);
        expect(Math.hypot(...a.normal)).toBeCloseTo(1,10);expect(Math.hypot(...a.tangent)).toBeCloseTo(1,10);
        if(i>=r.incorporated)expect(a).toEqual(plain.anchors[i]);
        if(i>0&&i<r.incorporated)expect(Math.hypot(...a.backbone.map((v,j)=>v-r.anchors[i-1].backbone[j]))).toBeCloseTo(rest.linkLengths[i-1],10);
      }
    }
    const critical=api.nucleicTranscript(p,2.1369631431053957);api.nucleicTranscript(p,8);api.nucleicTranscript(p,0);expect(api.nucleicTranscript(p,2.1369631431053957)).toEqual(critical);
  });
  it('retains terminal docking orientation across its own emergence onset and throughout exit translation',()=>{
    const p=fixture();p.emergence!.direction=[1,0,.2];
    const rest=api.nucleicTranscript({...p,emergence:undefined},8).anchors[3];
    for(const time of [3.75-1e-8,3.75,3.75+1e-8,...Array.from({length:151},(_,k)=>3.75+k/100)]){
      const last=api.nucleicTranscript(p,time).anchors[3];
      expect(last.normal).toEqual(rest.normal);expect(last.tangent).toEqual(rest.tangent);
      expect(Math.hypot(...last.tip.map((v,j)=>v-last.backbone[j]))).toBeCloseTo(.765,12);
    }
    const last=api.nucleicTranscript(p,5).anchors[3];
    expect(Math.hypot(...last.backbone.map((v,j)=>v-rest.backbone[j]))).toBeCloseTo(3,12);
  });
});

const vmBuilder=(s:SceneContext)=>{
  const duplex=s.nucleicDuplex({axis:Array.from({length:4},(_,i)=>[i,0,0]),template:[...'AAAA'].map((_,i)=>({id:'t'+i,base:'A'})),coding:[...'TTTT'].map((_,i)=>({id:'c'+i,base:'T'})),pairs:Array.from({length:4},(_,i)=>['t'+i,'c'+i]),templateDirection:'3to5',codingDirection:'5to3',initialNormal:[0,1,0],radius:.85,backboneRadius:.08,twistPerBase:0,window:{start:0,end:3,separation:1}},1);
  const p:NucleicTranscriptProps={id:'rna',duplex,bases:[0,1,2,3].map(i=>({id:'r'+i,base:'U',templateId:'t'+i})),start:0,secondsPerBase:1,approachFraction:.75,radius:.07,emergence:{direction:[1,0,0],distance:3,delay:0,duration:1}};
  for(const time of [0,2.1369631431053957,2.136964143105396,8]){
    let message='';try{s.nucleicTranscript(p,time);}catch(error){message=(error as Error).message;}
    if(!message.includes('Unsupported RNA emergence schedule'))throw Error('RNA fold was not rejected consistently');
  }
  p.emergence!.direction=[1,0,.2];
  for(const index of [1,5]){
    const base=s.mesh('rna-base/'+index,s.nucleicTranscript(p,0).parts[index].geometry);
    s.bind(base,[s.time],t=>({vertices:s.nucleicTranscript(p,t).parts[index].geometry.vertices}));
  }
  s.wait(8);
};
it('preflights folds in the public QuickJS API and continuously samples an accepted oblique alternative',async()=>{
  expect(()=>buildScene({},vmBuilder)).not.toThrow();
  await withOfflineScene(`export default scene({},${vmBuilder.toString()});`,{},sampler=>{
    const critical=sampler.sample(2.1369631431053957);
    for(let i=0;i<=50;i++)sampler.sample(2.1369631431053957+(i-25)*1e-7);
    const onset=sampler.sample(3.75);for(let i=0;i<=50;i++)sampler.sample(3.75+(i-25)*1e-7);
    sampler.sample(8);sampler.sample(0);expect(sampler.sample(2.1369631431053957)).toEqual(critical);
    expect(sampler.sample(3.75)).toEqual(onset);
  });
});

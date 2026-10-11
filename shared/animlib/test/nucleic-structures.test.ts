import {describe,it,expect} from 'vitest';
import {createNucleicBuilders} from '../src/nucleic-structures.js';
import {createMolecularBackboneBuilders} from '../src/molecular-backbone.js';
import {createMoleculeBuilders} from '../src/molecules.js';
import type {NucleicDuplexProps} from '../src/nucleic-types.js';
import type {Vec3} from '../src/types.js';
const molecular=createMolecularBackboneBuilders(createMoleculeBuilders()),api=createNucleicBuilders(molecular);
const props=():NucleicDuplexProps=>({axis:Array.from({length:12},(_,i)=>[i*.65,Math.sin(i/8)*.5,0] as Vec3),template:'ACGTACGTACGT'.split('').map((base,i)=>({id:`t${i}`,base:base as 'A'})),coding:'TGCATGCATGCA'.split('').map((base,i)=>({id:`c${i}`,base:base as 'A'})),pairs:Array.from({length:12},(_,i)=>[`t${i}`,`c${i}`]),templateDirection:'3to5',codingDirection:'5to3',initialNormal:[0,1,0],radius:.85,backboneRadius:.08,twistPerBase:.6,window:{start:2,end:9,separation:1.2}});
const distance=(a:Vec3,b:Vec3)=>Math.hypot(...a.map((v,j)=>v-b[j]));
describe('curved paired nucleic geometry',()=>{
  it('retains explicit antiparallel pairing, meaningful ends and two shaped base classes',()=>{
    const r=api.nucleicDuplex(props(),0);
    expect(r.anchors).toHaveLength(24);expect(r.pairs).toHaveLength(12);
    expect(r.ends).toEqual({template:{fivePrime:'t11',threePrime:'t0'},coding:{fivePrime:'c0',threePrime:'c11'}});
    expect(r.parts.map(p=>p.role)).toEqual(['template-backbone','coding-backbone','template-bases','coding-bases']);
    expect(r.anchors[0].shape).toBe('purine');expect(r.anchors[1].shape).toBe('pyrimidine');
    expect(r.parts.every(p=>p.geometry.vertices!.length<20000&&p.geometry.triangles!.length<20000)).toBe(true);
  });
  it('preserves every backbone length during interior opening and keeps finite frames/topology on curved paths',()=>{
    const rest=api.nucleicDuplex(props(),0);
    for(let j=0;j<=100;j++){
      const r=api.nucleicDuplex(props(),j/100);
      for(const strand of ['template','coding'] as const){const a=r.anchors.filter(a=>a.strand===strand);for(let i=1;i<a.length;i++)expect(Math.abs(distance(a[i-1].backbone,a[i].backbone)/rest.linkLengths[strand][i-1]-1)).toBeLessThan(1e-11);}
      expect(r.parts.map(p=>p.geometry.triangles)).toEqual(rest.parts.map(p=>p.geometry.triangles));
      expect(r.anchors.every(a=>[...a.backbone,...a.tip,...a.tangent,...a.normal].every(Number.isFinite))).toBe(true);
    }
    const open=api.nucleicDuplex(props(),1);expect(distance(open.anchors[6].backbone,open.anchors[18].backbone)).toBeGreaterThan(distance(rest.anchors[6].backbone,rest.anchors[18].backbone)+.5);
    expect(api.nucleicDuplex(props(),0)).toEqual(rest);
  });
  it('rejects sparse inputs, mismatched/complement-invalid pairings, duplicate IDs, reversals and excessive geometry',()=>{
    const bad=props();bad.template[0].base='G';expect(()=>api.nucleicDuplex(bad,0)).toThrow(/complement/i);
    const sparse=props();sparse.axis[0]=Array(3) as Vec3;expect(()=>api.nucleicDuplex(sparse,0)).toThrow(/coordinate/i);
    const dup=props();dup.coding[0].id='t0';expect(()=>api.nucleicDuplex(dup,0)).toThrow(/identity/i);
    expect(()=>api.nucleicDuplex({...props(),templateDirection:'5to3' as never},0)).toThrow(/direction/i);
    expect(()=>api.nucleicDuplex({...props(),pairs:Array(12)},0)).toThrow(/pair/i);
    expect(()=>api.nucleicDuplex({...props(),axis:Array(129).fill([0,0,0])},0)).toThrow(/budget|128/i);
    expect(()=>api.nucleicDuplex(props(),NaN)).toThrow(/opening/i);
  });
});
describe('explicit transcript incorporation',()=>{
  const tx=()=>({id:'rna',bases:[{id:'r0',base:'U' as const,templateId:'t4'},{id:'r1',base:'G' as const,templateId:'t5'},{id:'r2',base:'C' as const,templateId:'t6'}],duplex:api.nucleicDuplex(props(),1),start:2,secondsPerBase:1,approachFraction:.75,radius:.07});
  it('shows incoming nucleotides before docking and forms bonds only between incorporated sites',()=>{
    const before=api.nucleicTranscript(tx(),1),incoming=api.nucleicTranscript(tx(),2.3),first=api.nucleicTranscript(tx(),2.8),second=api.nucleicTranscript(tx(),3.8),end=api.nucleicTranscript(tx(),8);
    expect(before.incorporated).toBe(0);expect(incoming.incorporated).toBe(0);expect(incoming.incomingId).toBe('r0');expect(incoming.bonds).toEqual([]);
    expect(first.incorporated).toBe(1);expect(first.bonds).toEqual([]);expect(second.bonds).toEqual([['r0','r1']]);expect(end.bonds).toEqual([['r0','r1'],['r1','r2']]);
    expect(end.ends).toEqual({fivePrime:'r0',threePrime:'r2'});expect(end.triplets).toEqual([['r0','r1','r2']]);
    expect(end.parts.length).toBe(incoming.parts.length);expect(end.parts.map(p=>p.geometry.triangles)).toEqual(incoming.parts.map(p=>p.geometry.triangles));
  });
  it('keeps docked positions and link lengths unchanged as subsequent bases arrive, including backward seeks',()=>{
    const p=tx(),end=api.nucleicTranscript(p,8),first=api.nucleicTranscript(p,2.8);
    expect(first.anchors[0].backbone).toEqual(end.anchors[0].backbone);
    for(let k=0;k<=120;k++){const r=api.nucleicTranscript(p,k/20);for(let i=1;i<r.incorporated;i++)expect(distance(r.anchors[i-1].backbone,r.anchors[i].backbone)).toBeCloseTo(end.linkLengths[i-1],12);}
    expect(api.nucleicTranscript(p,2.8)).toEqual(first);
  });
  it('rotates a free nucleotide into its final frame without changing base reach or any formed anchor',()=>{
    const plain=tx(),p={...plain,incomingRotation:{axis:[0,0,1] as Vec3,angle:1.8}};
    const start=api.nucleicTranscript(p,2),unrotated=api.nucleicTranscript(plain,2),end=api.nucleicTranscript(plain,8);
    expect(distance(start.anchors[0].tip,unrotated.anchors[0].tip)).toBeGreaterThan(.2);
    for(let j=0;j<=30;j++){
      const r=api.nucleicTranscript(p,2+j/40),a=r.anchors[0];
      expect(distance(a.tip,a.backbone)).toBeCloseTo(distance(end.anchors[0].tip,end.anchors[0].backbone),12);
      expect(Math.hypot(...a.tangent)).toBeCloseTo(1,12);expect(Math.hypot(...a.normal)).toBeCloseTo(1,12);
    }
    expect(api.nucleicTranscript(p,2.75).anchors[0]).toEqual(end.anchors[0]);
    expect(api.nucleicTranscript(p,3.4).anchors[0]).toEqual(end.anchors[0]);
    expect(api.nucleicTranscript(p,2)).toEqual(start);
    expect(()=>api.nucleicTranscript({...plain,incomingRotation:{axis:[0,0,0],angle:1}},2)).toThrow(/rotation/i);
    expect(()=>api.nucleicTranscript({...plain,incomingRotation:{axis:[1,0,0],angle:NaN}},2)).toThrow(/rotation/i);
  });
  it('rejects skipped templates, RNA alphabet errors and references not complementary to the template',()=>{
    const p=tx();p.bases[1].templateId='t7';expect(()=>api.nucleicTranscript(p,3)).toThrow(/consecutive|complement/i);
    const wrong=tx();wrong.bases[0].base='T' as never;expect(()=>api.nucleicTranscript(wrong,3)).toThrow(/RNA/i);
    expect(()=>api.nucleicTranscript({...tx(),secondsPerBase:0},3)).toThrow(/duration|seconds/i);
    const sparse=tx();sparse.duplex.anchors=Array(2);expect(()=>api.nucleicTranscript(sparse,3)).toThrow(/snapshot/i);
    const zero=tx();zero.duplex.anchors[4].tip=[...zero.duplex.anchors[4].backbone];expect(()=>api.nucleicTranscript(zero,3)).toThrow(/reach/i);
  });
  it('emerges formed RNA continuously while preserving every formed link and leaving future targets fixed',()=>{
    const plain=tx(),p={...plain,emergence:{direction:[-.4,1,1] as Vec3,distance:3,delay:.1,duration:1.2}},rest=api.nucleicTranscript(plain,8);
    expect(distance(api.nucleicTranscript(p,6).anchors[0].backbone,rest.anchors[0].backbone)).toBeGreaterThan(1);
    const first=api.nucleicTranscript(p,3.5);expect(first.anchors[2]).toEqual(api.nucleicTranscript(plain,3.5).anchors[2]);
    for(let k=0;k<=140;k++){const r=api.nucleicTranscript(p,k/20);for(let i=1;i<r.incorporated;i++)expect(distance(r.anchors[i-1].backbone,r.anchors[i].backbone)).toBeCloseTo(rest.linkLengths[i-1],11);}
    for(const time of [2.75,3.75,4.75]){const a=api.nucleicTranscript(p,time-1e-6),b=api.nucleicTranscript(p,time+1e-6);for(let i=0;i<a.incorporated;i++)expect(distance(a.anchors[i].backbone,b.anchors[i].backbone)).toBeLessThan(1e-4);}
    api.nucleicTranscript(p,8);expect(api.nucleicTranscript(p,3.5)).toEqual(first);
    expect(()=>api.nucleicTranscript({...p,emergence:{...p.emergence,duration:0}},3)).toThrow(/duration/i);
    expect(()=>api.nucleicTranscript({...p,emergence:{...p.emergence,delay:-1}},3)).toThrow(/delay/i);
  });
  it('supports straight templates and scales base reach with helix radius',()=>{
    const p=props();p.axis=p.axis.map((_,i)=>[i*.65,0,0]);p.twistPerBase=0;p.radius=1.7;
    const duplex=api.nucleicDuplex(p,1);expect(distance(duplex.anchors[0].backbone,duplex.anchors[0].tip)).toBeCloseTo(1.53);
    expect(()=>api.nucleicTranscript({...tx(),duplex},5)).not.toThrow();
  });
  it('installs with only the injected existing molecular factory',()=>{
    const isolated=new Function('molecular',`return (${createNucleicBuilders.toString()})(molecular)`)(molecular) as typeof api;
    expect(isolated.nucleicDuplex(props(),.3)).toEqual(api.nucleicDuplex(props(),.3));
  });
});

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
  it('rejects skipped templates, RNA alphabet errors and references not complementary to the template',()=>{
    const p=tx();p.bases[1].templateId='t7';expect(()=>api.nucleicTranscript(p,3)).toThrow(/consecutive|complement/i);
    const wrong=tx();wrong.bases[0].base='T' as never;expect(()=>api.nucleicTranscript(wrong,3)).toThrow(/RNA/i);
    expect(()=>api.nucleicTranscript({...tx(),secondsPerBase:0},3)).toThrow(/duration|seconds/i);
    const sparse=tx();sparse.duplex.anchors=Array(2);expect(()=>api.nucleicTranscript(sparse,3)).toThrow(/snapshot/i);
    const zero=tx();zero.duplex.anchors[4].tip=[...zero.duplex.anchors[4].backbone];expect(()=>api.nucleicTranscript(zero,3)).toThrow(/reach/i);
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

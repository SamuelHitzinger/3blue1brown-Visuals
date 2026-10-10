import { describe, expect, it } from 'vitest';
import { createMolecularBackboneBuilders } from '../src/molecular-backbone.js';
import { createMoleculeBuilders } from '../src/molecules.js';
import type { ArticulatedChainSpec, MolecularBackboneProps } from '../src/molecular-backbone-types.js';
import type { Vec3 } from '../src/types.js';
const api = createMolecularBackboneBuilders(createMoleculeBuilders());
const provenance = {kind:'schematic' as const, source:'original test fixture', units:'arbitrary'};
const model = (): MolecularBackboneProps => ({
  segments:[{id:'part-1',chainId:'A',residues:[{id:'A:1',position:[0,0,0],value:0},{id:'A:2',position:[1,0,0],value:0.5},{id:'A:3',position:[1,1,0],value:1}]}],
  bonds:[['A:1','A:2'],['A:2','A:3']], representation:'backbone', radius:0.1, provenance,
});
const motion = (): ArticulatedChainSpec => ({lengths:[1,2,0.7],from:[[0,0],[0,0],[0,0]],to:[[0,0],[Math.PI/2,0],[Math.PI/2,Math.PI/2]],start:1,duration:2});
const distance=(a:Vec3,b:Vec3)=>Math.hypot(...a.map((v,i)=>v-b[i]));
describe('explicit molecular identity and connectivity',()=>{
  it('retains sequence identity, shared origin, and palette values across representations',()=>{
    for(const representation of ['sticks','beads','backbone'] as const){
      const result=api.molecularBackbone({...model(),representation,origin:[1,0,0]});
      expect(result.anchors.map(a=>[a.id,a.segmentId,a.chainId,a.position,a.value])).toEqual([
        ['A:1','part-1','A',[-1,0,0],0],['A:2','part-1','A',[0,0,0],0.5],['A:3','part-1','A',[0,1,0],1]]);
      expect(result.provenance).toEqual(provenance);
      expect(result.meshes.length).toBeGreaterThan(0);
      expect(result.vertexResidueIds.flat().every(id=>['A:1','A:2','A:3'].includes(id))).toBe(true);
      for(const [i,m] of result.meshes.entries())expect(result.vertexResidueIds[i]).toHaveLength(m.vertices!.length);
    }
  });
  it('never creates sticks without explicit edges or connects across explicit segment breaks',()=>{
    const props=model();props.bonds=[];props.segments=[
      {id:'before-gap',chainId:'A',residues:props.segments[0].residues.slice(0,2)},
      {id:'after-gap',chainId:'A',residues:[{id:'A:9',position:[30,0,0],value:1}]}];
    expect(api.molecularBackbone({...props,representation:'sticks'}).meshes).toEqual([]);
    const result=api.molecularBackbone(props);
    expect(result.meshes.flatMap(m=>m.vertices!).every(p=>p[0]<1.2)).toBe(true);
    expect(result.segments.map(s=>s.residueIds)).toEqual([['A:1','A:2'],['A:9']]);
    expect(api.molecularBackbone({...props,representation:'sticks',bonds:[['A:2','A:9']]}).meshes.length).toBeGreaterThan(0);
  });
  it('rejects duplicate identities, invalid bond graphs, and nonfinite positions',()=>{
    const duplicate=model(); duplicate.segments[0].residues[1].id='A:1';
    expect(()=>api.molecularBackbone(duplicate)).toThrow(/duplicate.*residue/i);
    for(const bonds of [[['A:1','missing']],[['A:1','A:1']],[['A:1','A:2'],['A:2','A:1']]])expect(()=>api.molecularBackbone({...model(),bonds:bonds as [string,string][]})).toThrow(/bond/i);
    const bad=model();bad.segments[0].residues[0].position[0]=NaN;
    expect(()=>api.molecularBackbone(bad)).toThrow(/coordinate/i);
  });
  it('rejects repeated connected anchors, reversals and parallel frame seeds explicitly',()=>{
    const p=model();p.segments[0].residues[1].position=[0,0,0];
    expect(()=>api.molecularBackbone(p)).toThrow(/repeated|length/i);
    const r=model();r.segments[0].residues[2].position=[0,0,0];
    expect(()=>api.molecularBackbone(r)).toThrow(/reversal/i);
    expect(()=>api.molecularBackbone({...model(),initialNormal:[1,0,0]})).toThrow(/normal|parallel/i);
  });
});
describe('smooth transported backbone',()=>{
  it('has known straight-chain orientation and outward triangle winding',()=>{
    const p=model();p.segments[0].residues=p.segments[0].residues.slice(0,2);p.bonds=[['A:1','A:2']];
    const m=api.molecularBackbone(p).meshes[0];
    expect(m.vertices![0]).toEqual([0,0,0.1]);
    expect(m.normals![0]).toEqual([0,0,1]);
    for(const [a,b,c] of m.triangles!){
      const u=m.vertices![b].map((v,i)=>v-m.vertices![a][i]),v=m.vertices![c].map((v,i)=>v-m.vertices![a][i]);
      const cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
      expect(cross.reduce((sum,n,i)=>sum+n*m.normals![a][i],0)).toBeGreaterThan(0);
    }
  });
  it('keeps topology and finite nonflipping normals through bends and nearly straight configurations',()=>{
    let previous:ReturnType<typeof api.molecularBackbone>|undefined;
    for(let j=0;j<=60;j++){
      const p=model();p.segments[0].residues[2].position=[1+Math.cos(j/60*2.3),Math.sin(j/60*2.3),0];
      const result=api.molecularBackbone(p),m=result.meshes[0];
      expect(m.vertices!.flat().every(Number.isFinite)).toBe(true);
      expect(m.normals!.every(n=>Math.abs(Math.hypot(...n)-1)<1e-10)).toBe(true);
      if(previous){expect(m.triangles).toEqual(previous.meshes[0].triangles);expect(result.vertexResidueIds).toEqual(previous.vertexResidueIds);
        for(let i=0;i<m.normals!.length;i++)expect(m.normals![i].reduce((sum,v,k)=>sum+v*previous!.meshes[0].normals![i][k],0)).toBeGreaterThan(0.98);}
      previous=result;
    }
  });
  it('chunks long connected tubes deterministically under native budgets without losing ring continuity',()=>{
    const p=model();p.segments[0].residues=Array.from({length:900},(_,i)=>({id:`r${i}`,position:[i,Math.sin(i/30),0] as Vec3,value:i/899}));p.bonds=[];
    const result=api.molecularBackbone(p);
    expect(result.meshes.length).toBeGreaterThan(1);
    expect(result.meshes.every(m=>m.vertices!.length<=20000&&m.triangles!.length<=20000)).toBe(true);
    expect(result.meshes.reduce((n,m)=>n+m.triangles!.length,0)).toBe(899*4*8*2);
    expect(()=>api.molecularBackbone({...p,maxMeshes:1})).toThrow(/mesh.*budget/i);
    expect(()=>api.molecularBackbone({...p,samplesPerLink:10000})).toThrow(/samples/i);
  });
});
describe('absolute-time articulated chain kinematics',()=>{
  it('matches a hand-calculated orthogonal pose and clamps endpoint holds',()=>{
    const spec=motion();const points=api.articulatedChainPose(spec,3);
    const expected=[[0,0,0],[1,0,0],[1,2,0],[1,2,0.7]];
    points.forEach((p,i)=>p.forEach((v,j)=>expect(v).toBeCloseTo(expected[i][j],12)));
    expect(api.articulatedChainPose(spec,-20)).toEqual([[0,0,0],[1,0,0],[3,0,0],[3.7,0,0]]);
    expect(api.articulatedChainPose(spec,30)).toEqual(points);
  });
  it('preserves every link length through dense interior samples and arbitrary backward seeks',()=>{
    const spec=motion();
    for(let sample=0;sample<=400;sample++){
      const positions=api.articulatedChainPose(spec,sample/100);
      for(let i=0;i<spec.lengths.length;i++)expect(Math.abs(distance(positions[i],positions[i+1])/spec.lengths[i]-1)).toBeLessThan(1e-12);
    }
    const first=api.articulatedChainPose(spec,1.37);api.articulatedChainPose(spec,3);api.articulatedChainPose(spec,0);
    expect(api.articulatedChainPose(spec,1.37)).toEqual(first);
  });
  it('validates topology, finite angles, numeric lengths, time and frame orientation',()=>{
    for(const spec of [{...motion(),lengths:[0,2,1]},{...motion(),to:[[0,0]]},{...motion(),duration:0},{...motion(),normal:[1,0,0]}])expect(()=>api.articulatedChainPose(spec as ArticulatedChainSpec,0)).toThrow();
    expect(()=>api.articulatedChainPose(motion(),NaN)).toThrow(/time/i);
  });
  it('is installable verbatim with only the existing molecule factory as a dependency',()=>{
    const isolated=new Function(`return (${createMolecularBackboneBuilders.toString()})((${createMoleculeBuilders.toString()})())`)() as typeof api;
    expect(isolated.articulatedChainPose(motion(),2)).toEqual(api.articulatedChainPose(motion(),2));
    expect(isolated.molecularBackbone(model())).toEqual(api.molecularBackbone(model()));
  });
});

describe('molecular bounds and precision',()=>{
  it('retains exact bead identity and scalar mapping for every detail and enforces aggregate budgets',()=>{
    for(const [beadDetail,perSite] of [[0,6],[1,18],[2,66],[3,258]] as const){
      const result=api.molecularBackbone({...model(),representation:'beads',beadDetail});
      expect(result.meshes[0].vertices).toHaveLength(3*perSite);
      expect(result.vertexResidueIds[0]).toEqual([...Array(perSite).fill('A:1'),...Array(perSite).fill('A:2'),...Array(perSite).fill('A:3')]);
      expect(result.meshes[0].scalarColors!.values).toEqual([...Array(perSite).fill(0),...Array(perSite).fill(.5),...Array(perSite).fill(1)]);
    }
    const p=model();p.representation='beads';p.bonds=[];p.segments[0].residues=Array.from({length:977},(_,i)=>({id:`r${i}`,position:[i,0,0] as Vec3,value:i/976}));
    expect(()=>api.molecularBackbone({...p,beadDetail:3})).toThrow(/geometry budget/i);
    expect(()=>api.molecularBackbone({...model(),representation:'beads',beadDetail:4 as never})).toThrow(/detail/i);
    p.segments[0].residues=p.segments[0].residues.slice(0,40);
    const chunked=api.molecularBackbone({...p,beadDetail:3});
    expect(chunked.meshes).toHaveLength(2);
    expect(chunked.vertexResidueIds.flat()).toEqual(p.segments[0].residues.flatMap(r=>Array(258).fill(r.id)));
    expect(chunked.meshes.flatMap(m=>m.scalarColors!.values)).toEqual(p.segments[0].residues.flatMap(r=>Array(258).fill(r.value)));
  });
  it('rejects geometry budgets before allocating excessive rings and validates explicit provenance',()=>{
    const p=model();p.segments[0].residues=Array.from({length:1000},(_,i)=>({id:`r${i}`,position:[i,0,0] as Vec3,value:i/999}));p.bonds=[];
    expect(()=>api.molecularBackbone({...p,samplesPerLink:32,radialSegments:64})).toThrow(/geometry budget/i);
    expect(()=>api.molecularBackbone({...model(),provenance:{...provenance,source:''}})).toThrow(/provenance/i);
    expect(()=>api.molecularBackbone({...model(),representation:undefined as never})).toThrow(/representation/i);
    const duplicateSegment=model();duplicateSegment.segments.push({...duplicateSegment.segments[0]});
    expect(()=>api.molecularBackbone(duplicateSegment)).toThrow(/duplicate segment/i);
  });
  it('does not silently lose link length to floating-point precision at large origins',()=>{
    const spec={lengths:[1e-9],from:[[0.3,0]] as [number,number][],to:[[0.7,0]] as [number,number][],start:0,duration:1,origin:[900000,0,0] as Vec3};
    expect(()=>api.articulatedChainPose(spec,0.5)).toThrow(/precision/i);
  });
});

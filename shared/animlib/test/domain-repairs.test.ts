import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildScene } from '../src/runtime.js';
import { evaluateScene } from '../src/timeline.js';
import { withOfflineScene } from '../src/offline-sampling.js';
import { layoutLatex, layoutLatexGeometry } from '../src/latex.js';
import { createGraphAlgorithms, createGraphBuilders } from '../src/diagrams/graphs.js';
import { createCollectionBuilders } from '../src/diagrams/collections.js';
import { createCoordinateBuilders } from '../src/diagrams/coordinates.js';
import { createMolecularBackboneBuilders } from '../src/molecular-backbone.js';
import { createMoleculeBuilders } from '../src/molecules.js';
import type { MolecularBackboneProps } from '../src/molecular-backbone-types.js';
import type { Vec3 } from '../src/types.js';

const graph={nodes:[{id:'a',position:[0,0] as [number,number]},{id:'b',position:[1,0] as [number,number]}],edges:[{id:'ab',from:'a',to:'b',weight:.25}]};
const api=createMolecularBackboneBuilders(createMoleculeBuilders());
const stick=(x:number):MolecularBackboneProps=>({segments:[{id:'s',chainId:'A',residues:[{id:'a',position:[0,0,0],value:0},{id:'b',position:[x,0,1],value:1}]}],bonds:[['a','b']],representation:'sticks',radius:.1,radialSegments:3,provenance:{kind:'schematic',source:'regression',units:'arbitrary'}});

describe('independent domain review regressions',()=>{
  it('displays a supported fractional shortest distance without integer rounding',()=>{
    const scene=buildScene({},s=>{
      const algorithms=createGraphAlgorithms(),g=createGraphBuilders(s,algorithms).graph('g',graph);
      s.play(g.costs.get('b')!.countTo({cost:algorithms.dijkstra(graph,'a').distances.b}),{duration:1});
    });
    const geometry=evaluateScene(scene,1).elements.find(e=>e.id==='g/cost/b')!.geometry;
    expect(geometry.numbers?.cost).toBe(.25);
    expect(geometry.numbers!.cost.toFixed(geometry.numberFormat!.decimals)).toBe('0.25');
    const glyphShape=(paths:ReturnType<typeof layoutLatex>['paths'])=>{const points=paths.flatMap(p=>p.contours.flat()),x=Math.min(...points.map(p=>p[0])),y=Math.min(...points.map(p=>p[1]));return paths.flatMap(p=>p.contours.flat()).flatMap(p=>[Number((p[0]-x).toFixed(8)),Number((p[1]-y).toFixed(8))]);};
    const actual=glyphShape(layoutLatexGeometry(geometry).paths),expected=glyphShape(layoutLatex('0.25').paths);
    expect(actual).toHaveLength(expected.length);actual.forEach((v,i)=>expect(v).toBeCloseTo(expected[i],7));
  });
  it('supports bounded caller cost precision and rejects unsupported numeric formats',()=>{
    const scene=buildScene({},s=>{const g=createGraphBuilders(s,createGraphAlgorithms()).graph('g',graph,{costFormat:{decimals:3,digits:2}});s.play(g.costs.get('b')!.countTo({cost:.25}),{duration:1});});
    const geometry=evaluateScene(scene,1).elements.find(e=>e.id==='g/cost/b')!.geometry;
    expect(geometry.numbers!.cost.toFixed(geometry.numberFormat!.decimals)).toBe('0.250');
    for(const costFormat of [{decimals:-1},{decimals:5},{decimals:NaN},{digits:0},{digits:7},{digits:1.5}])expect(()=>buildScene({},s=>createGraphBuilders(s,createGraphAlgorithms()).graph('g',graph,{costFormat}))).toThrow(/cost format/i);
  });
  it('rejects both sides of the old stick fallback threshold consistently',()=>{
    for(const x of [0,.999e-8,1.001e-8,-.999e-8,-1.001e-8])expect(()=>api.molecularBackbone(stick(x))).toThrow(/normal|parallel/i);
  });
  it('supports a Z-axis bond with an X seed and continuous odd-sided frames away from the poles',()=>{
    expect(api.molecularBackbone({...stick(0),initialNormal:[1,0,0]}).meshes[0].vertices![0]).toEqual([.1,0,0]);
    let prior:ReturnType<typeof api.molecularBackbone>|undefined;
    for(let i=0;i<=100;i++){
      const result=api.molecularBackbone(stick(2e-7+i*1e-9)),mesh=result.meshes[0];
      if(prior){expect(mesh.triangles).toEqual(prior.meshes[0].triangles);expect(result.vertexResidueIds).toEqual(prior.vertexResidueIds);for(let j=0;j<mesh.normals!.length;j++)expect(mesh.normals![j].reduce((n,v,k)=>n+v*prior!.meshes[0].normals![j][k],0)).toBeGreaterThan(.999999);}
      prior=result;
    }
  });
  it('rejects sparse single-anchor coordinates even when no tube or bond is emitted',()=>{
    for(const representation of ['backbone','sticks'] as const){
      const p=stick(1);p.representation=representation;p.bonds=[];p.segments[0].residues=[{id:'a',position:Array(3) as Vec3,value:0}];
      expect(()=>api.molecularBackbone(p)).toThrow(/coordinate/i);
    }
  });
  it('snapshots collection origin for repeated and backward callback samples',()=>{
    const origin:[number,number]=[0,0],callbacks=new Map<string,(t:number)=>any>();
    buildScene({},s=>{const c=createCollectionBuilders({...s,bind(h,_deps,fn){callbacks.set(h.id,fn);}}).collection('c',[{id:'a',value:7},{id:'b',value:7}],{origin});c.swap('a','b',{start:0,duration:2});});
    const sample=callbacks.get('c/item/a')!;
    expect(sample(1).position).toEqual([.6,.6]);origin[0]=100;origin[1]=NaN;
    expect(sample(2).position).toEqual([1.2,0]);expect(sample(0).position).toEqual([0,0]);expect(sample(1).position).toEqual([.6,.6]);
  });
  it('rejects overflowed grid counts before accepting an empty over-budget grid',()=>{
    expect(()=>buildScene({},s=>createCoordinateBuilders(s).plane('p',{xRange:[1,2],yRange:[1,2],step:Number.MIN_VALUE}))).toThrow(/budget|count/i);
  });
  it('emits a TeX spacing command in the actual compiled frontier record',async()=>{
    const source=readFileSync(new URL('../demo/expansion/graph-relaxation.js',import.meta.url),'utf8');
    await withOfflineScene(source,{},sampler=>{
      const record=sampler.sample(7).elements.find(e=>e.id==='frontier-C')!;
      expect(record.geometry.tex).toBe(String.raw`\mathsf{C}\quad\animnum{cost}`);
    });
  });
});

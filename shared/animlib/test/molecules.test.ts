import { describe, expect, it } from 'vitest';
import { createMoleculeBuilders } from '../src/molecules.js';
import { importPDB } from '../src/molecular-data.js';
import { compileSource } from '../src/compiler.js';
import { evaluateScene } from '../src/timeline.js';
import proteinData from '../demo/assets/molecules/1crn.json';
import ribosomeData from '../demo/assets/molecules/1jj2.json';
import { molecularSources } from '../demo/molecular-scenes.js';

function atom(serial: number, name: string, residue: string, chain: string, seq: number, x: number, alt = '', occupancy = 1, record = 'ATOM', element = 'C') {
  return `${record.padEnd(6)}${String(serial).padStart(5)} ${name.padStart(4)}${alt || ' '}${residue.padStart(3)} ${chain}${String(seq).padStart(4)}    ${x.toFixed(3).padStart(8)}${'0.000'.padStart(8)}${'0.000'.padStart(8)}${occupancy.toFixed(2).padStart(6)}${'10.00'.padStart(6)}          ${element.padStart(2)}`;
}

describe('offline PDB import', () => {
  it('retains deposited Å coordinates, selects CA/P anchors, and excludes waters, zero occupancy and later models', () => {
    const pdb = ['MODEL        1', atom(1,'CA','ALA','A',1,10), atom(2,'N','ALA','A',1,11), atom(3,'P','A','B',1,20,'',1,'ATOM','P'), atom(4,'O','HOH','C',1,30,'',1,'HETATM','O'), atom(5,'CA','GLY','A',2,40,'',0), 'ENDMDL', 'MODEL        2', atom(6,'CA','ALA','A',1,100)].join('\n');
    const result = importPDB(pdb, { source: 'fixture' });
    expect(result.units).toBe('angstrom');
    expect(result.chains.map(c => [c.id,c.kind,c.positions])).toEqual([['A','protein',[10,0,0]],['B','nucleic',[20,0,0]]]);
    expect(result.provenance.source).toBe('fixture');
    expect(result.selection).toBe('residues');
  });
  it('chooses one alternate conformer for an entire residue, including shared atoms', () => {
    const pdb = [atom(1,'CA','ALA','A',1,1,'A',0.4),atom(2,'CA','ALA','A',1,2,'B',0.6),atom(3,'CB','ALA','A',1,3,'A',0.4),atom(4,'CB','ALA','A',1,4,'B',0.6),atom(5,'N','ALA','A',1,5)].join('\n');
    expect(importPDB(pdb,{source:'fixture',selection:'heavy-atoms'}).chains[0].positions).toEqual([2,0,0,4,0,0,5,0,0]);
  });
  it('filters chains, hydrogens and malformed data without inventing coordinates', () => {
    const pdb = [atom(1,'CA','ALA','A',1,1),atom(2,'H','ALA','B',1,2,'',1,'ATOM','H'),atom(3,'N','ALA','B',1,3)].join('\n');
    expect(importPDB(pdb,{source:'fixture',chains:['B'],selection:'heavy-atoms'}).chains[0].positions).toEqual([3,0,0]);
    expect(() => importPDB('data_test\nloop_\n_atom_site.id',{source:'fixture'})).toThrow('PDB');
    expect(() => importPDB(atom(1,'CA','ALA','A',1,NaN),{source:'fixture'})).toThrow('coordinate');
  });
});

describe('batched molecular geometry', () => {
  const builders = () => createMoleculeBuilders();
  it('preserves centers and radius, gives outward faces and radial normals', () => {
    const [mesh] = builders().molecule({positions:[2,3,4],radius:0.5,detail:0});
    expect(mesh.vertices).toHaveLength(6); expect(mesh.triangles).toHaveLength(8);
    for (const [i,v] of mesh.vertices!.entries()) {
      expect(Math.hypot(v[0]-2,v[1]-3,(v[2] ?? 0)-4)).toBeCloseTo(0.5);
      expect(mesh.normals![i]).toEqual(v.map((x,j)=>(x-[2,3,4][j])/0.5));
    }
    for(const [a,b,c] of mesh.triangles!) {
      const p=mesh.vertices![a],q=mesh.vertices![b],r=mesh.vertices![c];
      const u=q.map((x,i)=>x-p[i]),v=r.map((x,i)=>x-p[i]);
      const n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
      expect(n.reduce((sum,x,i)=>sum+x*(p[i]-[2,3,4][i]),0)).toBeGreaterThan(0);
    }
  });
  it('chunks thousands of sites below mesh limits without dropping sites', () => {
    const meshes=builders().molecule({positions:Array.from({length:3001},(_,i)=>[i,0,0]).flat(),radius:1,detail:0});
    expect(meshes.length).toBeGreaterThan(1);
    expect(meshes.reduce((n,m)=>n+m.vertices!.length,0)).toBe(3001*6);
    expect(meshes.every(m=>m.triangles!.length<=20000 && m.vertices!.length<=20000)).toBe(true);
    expect(builders().molecule({positions:[0,0,0],radius:1,detail:1})[0].triangles).toHaveLength(32);
  });
  it('subtracts one shared origin and retains independent detail topology', () => {
    const meshes=builders().molecule({positions:[10,20,30,11,20,30],origin:[10,20,30],radius:1,detail:1});
    expect(meshes[0].vertices![0]).toEqual([1,0,0]);
    expect(meshes[0].vertices![18]).toEqual([2,0,0]);
    expect(meshes[0].normals).toHaveLength(36);
  });
  it('rejects sparse/nonfinite data, invalid detail/radii, coordinate overflow and excessive sites', () => {
    for(const positions of [[0,0],[0,NaN,0],[0,,0],Array(30003).fill(0)]) expect(()=>builders().molecule({positions:positions as number[],radius:1})).toThrow();
    for(const radius of [0,-1,NaN]) expect(()=>builders().molecule({positions:[0,0,0],radius})).toThrow();
    expect(()=>builders().molecule({positions:[1e6,0,0],radius:1})).toThrow();
    expect(()=>builders().molecule({positions:[0,0,0],radius:1,detail:4 as 0})).toThrow('detail');
  });
  it('offers bounded smooth bead detail with owned outputs and unchanged mesh budgets',()=>{
    const api=builders();
    for(const [detail,vertices,triangles] of [[2,66,128],[3,258,512]] as const){
      const first=api.molecule({positions:[2,3,4],radius:.5,detail})[0];
      expect(first.vertices).toHaveLength(vertices);expect(first.triangles).toHaveLength(triangles);
      for(const v of first.vertices!)expect(Math.hypot(v[0]-2,v[1]-3,(v[2]??0)-4)).toBeCloseTo(.5,12);
      const original=structuredClone(first);first.vertices![0][0]=100;first.normals![0][0]=100;first.triangles![0][0]=100;
      expect(api.molecule({positions:[2,3,4],radius:.5,detail})[0]).toEqual(original);
      const batches=api.molecule({positions:Array.from({length:160},(_,i)=>[i,0,0]).flat(),radius:.5,detail});
      expect(batches.length).toBeGreaterThan(1);expect(batches.every(m=>m.vertices!.length<=20000&&m.triangles!.length<=20000)).toBe(true);
      expect(batches.reduce((n,m)=>n+m.triangles!.length,0)).toBe(160*triangles);
    }
    expect(()=>api.molecule({positions:Array.from({length:977},(_,i)=>[i,0,0]).flat(),radius:.5,detail:3})).toThrow(/total.*budget/i);
  });
  it('compiles in the production VM and moves all batches together', async () => {
    const scene=await compileSource(`export default scene({mode:'3d'},s=>{const m=s.molecule('protein',{positions:[0,0,0,1,0,0],radius:0.2,fill:'BLUE',position:[2,0,0]});s.play(m.moveTo([4,0,0]),{duration:1});});`);
    const frame=evaluateScene(scene,1);
    expect(frame.elements.find(e=>e.id==='protein')?.position).toEqual([4,0,0]);
    expect(frame.elements.filter(e=>e.geometry.kind==='mesh')).toHaveLength(1);
    expect(frame.elements.find(e=>e.geometry.kind==='mesh')?.fill).toBe('BLUE');
  });
  it.each([[2,132,256],[3,516,1024]])('compiles optional detail %s in the production VM',async(detail,vertices,triangles)=>{
    const scene=await compileSource(`export default scene({mode:'3d'},s=>{s.molecule('m',{positions:[0,0,0,1,0,0],radius:.2,detail:${detail}});});`);
    const mesh=evaluateScene(scene,0).elements.find(e=>e.geometry.kind==='mesh')!.geometry;
    expect(mesh.vertices).toHaveLength(vertices);expect(mesh.triangles).toHaveLength(triangles);
  });
});

describe('deposited coordinate examples',()=>{
  it('preserves recognizable source coordinates, units, provenance and full selected-site counts',()=>{
    expect(proteinData.chains[0].positions.slice(0,3)).toEqual([17.047,14.099,3.625]);
    expect(proteinData.chains[0].positions).toHaveLength(327*3);
    expect(ribosomeData.chains.reduce((n,c)=>n+c.positions.length/3,0)).toBe(6567);
    expect(ribosomeData.chains).toHaveLength(30);
    for(const data of [proteinData,ribosomeData]) {
      expect(data.units).toBe('angstrom');
      expect(data.provenance.sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(data.chains.every(c=>c.positions.length===c.sites.length*3)).toBe(true);
    }
  });
  it.each(molecularSources)('compiles $id under the unchanged production limits',async source=>{
    expect(source.source.length).toBeLessThan(256000);
    const scene=await compileSource(source.source);
    const meshes=evaluateScene(scene,0).elements.filter(e=>e.geometry.kind==='mesh');
    expect(meshes.length).toBeGreaterThan(0);
    expect(meshes.length).toBeLessThan(40);
    expect(meshes.every(e=>e.geometry.triangles!.length<=20000)).toBe(true);
  });
});

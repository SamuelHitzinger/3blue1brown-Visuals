import {expect,test} from 'bun:test';
import {readFile} from 'node:fs/promises';
import {parseModelGLB} from 'animlib/core';
import {bundledModelCatalog,prepareBundledModel} from '../src/bundled-models.js';

test.each([
  ['1crn-surface',45,8676],
  ['1crn-sticks',46,10784],
  ['1crn-beads',46,7328],
] as const)('%s retains checked geometry, residue parts and shared coordinate origin',async(id,parts,triangles)=>{
  const prepared=await prepareBundledModel(id),model=await parseModelGLB(prepared.bytes);
  const root=new URL(`../../shared/animlib/fixtures/biological/1crn/${id}/`,import.meta.url);
  const manifest=JSON.parse(await readFile(new URL(`${id}.json`,root),'utf8'));
  expect(model.metadata.parts).toHaveLength(parts);
  expect(model.metadata.triangles).toBe(triangles);
  expect(prepared.context.origin[0]).toBeCloseTo(10.5935,6);
  expect(prepared.context.origin[1]).toBeCloseTo(10.2105,6);
  expect(prepared.context.origin[2]).toBeCloseTo(6.079,6);
  expect(prepared.context.units).toBe('angstrom');
  expect(prepared.context.provenance.license).toBe('CC0-1.0');
  expect(prepared.context.provenance.converter.options).toMatchObject({sourceHashes:{'1CRN.pdb':'42199a30a0701864a2a5cc76cd7f35cc544cd0e65fbcf63e03c166543249b811'}});
  for(let index=0;index<parts;index++){
    const original=manifest.parts[index],primitive=model.primitives[index];
    expect(model.metadata.parts[index].name).toBe(original.id);
    expect(model.metadata.parts[index].position).toEqual([0,0,0]);
    expect(primitive.geometry.vertices).toHaveLength(original.vertexCount);
    expect(primitive.geometry.triangles).toHaveLength(original.triangleCount);
    expect(primitive.geometry.shading).toBe('smooth');
    // Independent raw fixture bytes catch translation, reflection and normal loss in conversion.
    const positions=await readFile(new URL(original.positions.path,root));
    const normals=await readFile(new URL(original.normals.path,root));
    expect(primitive.geometry.vertices![0]).toEqual([positions.readFloatLE(0),positions.readFloatLE(4),positions.readFloatLE(8)]);
    for(let axis=0;axis<3;axis++)expect(primitive.geometry.normals![0][axis]).toBeCloseTo(normals.readFloatLE(axis*4),5);
  }
});

test('catalog distinguishes atomic sticks, residue anchors and schematic envelopes without mesh payloads',async()=>{
  const catalog=await bundledModelCatalog();
  expect(catalog).toHaveLength(3);
  expect(catalog.find(x=>x.fixtureId==='1crn-beads')?.representation).toContain('not individual atoms');
  expect(catalog.find(x=>x.fixtureId==='1crn-surface')?.provenance.fidelity).toContain('not a solvent-excluded or electron-density surface');
  for(const entry of catalog){
    expect(entry.partMeaning).toContain('do not describe folding dynamics or enzyme binding');
    expect(entry).not.toHaveProperty('parts');
    expect(entry).not.toHaveProperty('vertices');
  }
});

test('atomic bond halves retain endpoint element colors and the deposited heavy-atom graph',async()=>{
  const prepared=await prepareBundledModel('1crn-sticks'),model=await parseModelGLB(prepared.bytes);
  const root=new URL('../../shared/animlib/fixtures/biological/1crn/',import.meta.url);
  const pdb=await readFile(new URL('source/1CRN.pdb',root),'utf8');
  const atoms=pdb.split(/\r?\n/).filter(line=>line.startsWith('ATOM  ')).map(line=>({serial:Number(line.slice(6,11)),element:line.slice(76,78).trim(),position:[Number(line.slice(30,38)),Number(line.slice(38,46)),Number(line.slice(46,54))]}));
  const coordinateKey=(p:number[])=>p.map(n=>n.toFixed(3)).join(',');
  const at=new Map(atoms.map(atom=>[coordinateKey(atom.position),atom]));
  const colors:Record<string,[number,number,number,number]>={C:[0.5,0.5,0.5,1],N:[0,0,1,1],O:[1,0,0,1],S:[1,1,0,1]};
  const seen=new Set<number>(),edges=new Map<string,number>();
  for(const primitive of model.primitives){
    expect(primitive.colors).toHaveLength(primitive.geometry.vertices!.length);
    const vertices=primitive.geometry.vertices!;
    for(let start=0;start<vertices.length;start+=16){
      const center=(offset:number)=>[0,1,2].map(axis=>vertices.slice(offset,offset+8).reduce((sum,v)=>sum+v[axis],0)/8+prepared.context.origin[axis]);
      const from=center(start),mid=center(start+8),a=at.get(coordinateKey(from)),b=at.get(coordinateKey(mid.map((v,i)=>2*v-from[i])));
      expect(a).toBeDefined();expect(b).toBeDefined();seen.add(a!.serial);
      const key=[a!.serial,b!.serial].sort((a,b)=>a-b).join(':');edges.set(key,(edges.get(key)??0)+1);
      for(const color of primitive.colors!.slice(start,start+16))expect(color).toEqual(colors[a!.element]);
    }
  }
  expect(seen.size).toBe(327);
  expect(edges.size).toBe(337);
  expect([...edges.values()].every(count=>count===2)).toBe(true);
  const structure=JSON.parse(await readFile(new URL('structure.json',root),'utf8'));
  const serial=new Map<string,number>(structure.atoms.map((a:{id:string;serial:number})=>[a.id,a.serial]));
  const expectedEdges=structure.bonds.map((b:{a:string;b:string})=>[serial.get(b.a),serial.get(b.b)].sort((a,b)=>a!-b!).join(':')).sort();
  expect([...edges.keys()].sort()).toEqual(expectedEdges);
  expect(prepared.context).toHaveProperty('colorMeaning');
  expect(prepared.context.provenance.modifications).not.toContain('Color by persistent residue identity, not element.');
});

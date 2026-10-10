import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {importPDBStructure,structureBackboneProps} from '../src/molecular-structure-data.js';
import type {MolecularStructure,ResidueBondTemplate} from '../src/molecular-structure-types.js';
const root=new URL('../fixtures/biological/1crn/',import.meta.url);
const json=(path:string)=>JSON.parse(readFileSync(new URL(path,root),'utf8'));
describe('pinned biological assets',()=>{
  it('reproduces the deposited graph, including branched side chains and disulfides, from hash-locked sources',()=>{
    for(const [name,hash] of Object.entries(json('source-lock.json')))expect(createHash('sha256').update(readFileSync(new URL('source/'+name,root))).digest('hex')).toBe(hash);
    const templates=json('residue-templates.json') as Record<string,ResidueBondTemplate>;
    const structure=importPDBStructure(readFileSync(new URL('source/1CRN.pdb',root),'utf8'),{source:'https://files.rcsb.org/download/1CRN.pdb',accession:'1CRN',chains:['A'],residueTemplates:templates,polymerLinks:'standard-peptide'});
    expect({...structure,sourceHashes:json('source-lock.json')}).toEqual(json('structure.json'));expect(structure.bonds).toHaveLength(337);
    const atoms=new Map(structure.atoms.map(a=>[a.id,a]));
    const disulfides=structure.bonds.filter(b=>b.sources.some(p=>p.kind==='CONECT'));
    expect(disulfides).toHaveLength(3);
    for(const bond of disulfides){expect(atoms.get(bond.a)?.name).toBe('SG');expect(atoms.get(bond.b)?.name).toBe('SG');}
    const cys=structure.residues.find(r=>r.name==='CYS')!;
    const edges=structure.bonds.filter(b=>atoms.get(b.a)?.residueId===cys.id&&atoms.get(b.b)?.residueId===cys.id).map(b=>[atoms.get(b.a)!.name,atoms.get(b.b)!.name].sort().join('-'));
    expect(edges).toContain('CA-CB');expect(edges).toContain('CB-SG');
    expect(structure.bonds.filter(b=>b.sources.some(p=>p.kind==='peptide-rule'))).toHaveLength(45);
    const residueProps=structureBackboneProps(structure,'residues',.65);
    expect(residueProps.origin).toEqual(structure.center);
    expect(residueProps.segments[0].residues.map(r=>r.position)).toEqual(structure.residues.map(r=>atoms.get(r.anchorId!)!.position));
  });
  it('keeps one common conformer, origin, and residue mapping in all packed representations',()=>{
    const structure=json('structure.json') as MolecularStructure;
    const mapping=json('surface-residue-ids.json') as string[];
    for(const name of ['sticks','beads','surface']){
      const model=json(`1crn-${name}/1crn-${name}.json`);
      expect(model.provenance.converter.options.origin).toEqual(structure.center);
      expect(model.provenance.sourceHash).toBe(json('source-lock.json')['1CRN.pdb']);
      expect(model.parts).toHaveLength(name==='surface'?45:46);
      for(const part of model.parts){
        const residue=structure.residues[Number(part.id.split('-')[1])];expect(residue).toBeDefined();
        if(name==='surface')expect(part.triangleCount).toBe(mapping.filter(id=>id===residue.id).length);
        for(const key of ['positions','indices','normals']){
          const ref=part[key],bytes=readFileSync(new URL(`1crn-${name}/`+ref.path,root));
          expect(bytes.byteLength).toBe(ref.byteLength);expect(createHash('sha256').update(bytes).digest('hex')).toBe(ref.hash);
        }
      }
    }
    expect(mapping).toHaveLength(8676);expect(new Set(mapping).size).toBe(45);
    expect(mapping.every(id=>structure.residues.some(r=>r.id===id))).toBe(true);
  });
});

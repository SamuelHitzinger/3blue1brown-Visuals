import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {importPDBStructure,structureBackboneProps} from '../src/molecular-structure-data.js';
const atom=(serial:number,name:string,residue:string,seq:number,x:number,alt='',occupancy=1,chain='A',insertion='')=>`ATOM  ${String(serial).padStart(5)} ${name.padStart(4)}${alt||' '}${residue.padStart(3)} ${chain}${String(seq).padStart(4)}${insertion||' '}   ${x.toFixed(3).padStart(8)}${'0.000'.padStart(8)}${'0.000'.padStart(8)}${occupancy.toFixed(2).padStart(6)}${'10.00'.padStart(6)}          ${name==='N'?'N':'C'} `;
const templates={ALA:{source:'explicit fixture template',version:'1',bonds:[{a:'N',b:'CA',order:'single' as const},{a:'CA',b:'C',order:'single' as const}]}};
const options={source:'fixture.pdb',residueTemplates:templates,polymerLinks:'standard-peptide' as const};
describe('identified deposited structures',()=>{
  it('preserves deposited atom/residue identity, author insertion and explicit/template edge provenance',()=>{
    const pdb=[atom(1,'N','ALA',1,0),atom(2,'CA','ALA',1,1),atom(3,'C','ALA',1,2),atom(4,'N','ALA',2,3.3),atom(5,'CA','ALA',2,4),atom(6,'C','ALA',2,5),'CONECT    2    5'].join('\n');
    const s=importPDBStructure(pdb,options);
    expect(s.atoms).toHaveLength(6);expect(s.residues).toHaveLength(2);expect(s.units).toBe('angstrom');
    expect(s.atoms.map(a=>a.position[0])).toEqual([0,1,2,3.3,4,5]);
    expect(s.bonds.filter(b=>b.sources.some(p=>p.kind==='template'))).toHaveLength(4);
    expect(s.bonds.filter(b=>b.sources.some(p=>p.kind==='peptide-rule'))).toHaveLength(1);
    expect(s.bonds.filter(b=>b.sources.some(p=>p.kind==='CONECT'))).toHaveLength(1);
    const beads=structureBackboneProps(s,'residues',0.3),sticks=structureBackboneProps(s,'atoms',0.1);
    expect(beads.segments[0].residues.map(a=>a.position[0])).toEqual([1,4]);
    expect(sticks.bonds).toHaveLength(6);expect(sticks.segments).toHaveLength(6);
    expect(s.residues.map(r=>r.atomIds.length)).toEqual([3,3]);
  });
  it('never invents peptide bridges across TER, residue gaps, chain changes, missing atoms or long distances',()=>{
    for(const lines of [
      [atom(1,'CA','ALA',1,0),atom(2,'C','ALA',1,1),'TER',atom(3,'N','ALA',2,2.3),atom(4,'CA','ALA',2,3)],
      [atom(1,'CA','ALA',1,0),atom(2,'C','ALA',1,1),atom(3,'N','ALA',4,2.3),atom(4,'CA','ALA',4,3)],
      [atom(1,'CA','ALA',1,0),atom(2,'C','ALA',1,1),atom(3,'N','ALA',2,2.3,'',1,'B'),atom(4,'CA','ALA',2,3,'',1,'B')],
      [atom(1,'CA','ALA',1,0),atom(2,'CA','ALA',2,3)],
      [atom(1,'CA','ALA',1,0),atom(2,'C','ALA',1,1),atom(3,'N','ALA',2,9),atom(4,'CA','ALA',2,10)],
    ]){const s=importPDBStructure(lines.join('\n'),options);expect(s.bonds.some(b=>b.sources.some(p=>p.kind==='peptide-rule'))).toBe(false);expect(s.segments).toHaveLength(2);}
  });
  it('selects one residue conformer, retains shared atoms, and reads CONECT after ENDMDL',()=>{
    const pdb=['MODEL        1',atom(1,'N','ALA',1,0),atom(2,'CA','ALA',1,1,'A',0.8),atom(3,'C','ALA',1,2,'A',0.2),atom(4,'CA','ALA',1,3,'B',0.2),atom(5,'C','ALA',1,4,'B',0.9),'ENDMDL','MODEL        2',atom(1,'N','ALA',1,100),'ENDMDL','CONECT    1    4','CONECT    1    2'].join('\n');
    const s=importPDBStructure(pdb,options);
    expect(s.residues[0].selectedAlt).toBe('B');expect(s.atoms.map(a=>a.serial)).toEqual([1,4,5]);expect(s.atoms.map(a=>a.position[0])).toEqual([0,3,4]);
    expect(s.bonds.some(b=>b.sources.some(p=>p.kind==='CONECT'))).toBe(true);
    expect(s.diagnostics.some(d=>d.includes('unselected'))).toBe(true);
  });
  it('rejects duplicate atom serials, duplicate same-conformer names, malformed coordinates and unsupported sources',()=>{
    expect(()=>importPDBStructure([atom(1,'CA','ALA',1,1),atom(1,'C','ALA',1,2)].join('\n'),options)).toThrow(/serial/i);
    expect(()=>importPDBStructure([atom(1,'CA','ALA',1,1),atom(2,'CA','ALA',1,2)].join('\n'),options)).toThrow(/duplicate.*atom/i);
    expect(()=>importPDBStructure(atom(1,'CA','ALA',1,NaN),options)).toThrow(/coordinate/i);
    expect(()=>importPDBStructure('data_1CRN\nloop_',options)).toThrow(/PDB/i);
    expect(()=>importPDBStructure(atom(1,'CA','ALA',1,1),{...options,residueTemplates:{ALA:{...templates.ALA,bonds:Array(1)}}})).toThrow(/template/i);
  });
  it('rejects unsupported residue microheterogeneity and ignores connectivity inside later models',()=>{
    expect(()=>importPDBStructure([atom(1,'CA','ALA',1,1,'A',.5),atom(2,'CA','SER',1,2,'B',.5)].join('\n'),options)).toThrow(/microheterogeneity/i);
    const s=importPDBStructure(['MODEL        1',atom(1,'CA','ALA',1,1),atom(2,'CA','ALA',2,4),'ENDMDL','MODEL        2','CONECT    1    2','ENDMDL'].join('\n'),options);
    expect(s.bonds).toEqual([]);
  });
  it('reuses the actual 1CRN conformer and keeps all327 atoms,46 residues and deposited disulfides',()=>{
    const pdb=readFileSync(new URL('../fixtures/biological/1crn/source/1CRN.pdb',import.meta.url),'utf8');
    const s=importPDBStructure(pdb,{source:'https://files.rcsb.org/download/1CRN.pdb'});
    expect(s.accession).toBe('1CRN');expect(s.atoms).toHaveLength(327);expect(s.residues).toHaveLength(46);expect(s.atoms[0].position).toEqual([17.047,14.099,3.625]);
    expect(s.bonds).toHaveLength(3);expect(s.bonds.every(b=>b.sources[0].kind==='CONECT')).toBe(true);
  });
});

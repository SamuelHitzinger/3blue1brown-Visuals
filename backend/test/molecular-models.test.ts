import {afterEach,expect,spyOn,test} from 'bun:test';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {parseModelGLB} from 'animlib/core';
import {prepareMolecularModel} from '../src/molecular-models.js';
import {describeBundledModel} from '../src/bundled-models.js';

const originalCache=process.env.MOLECULAR_MODEL_CACHE_DIR;
let fetchSpy:ReturnType<typeof spyOn>|undefined;
let directory:string|undefined;
afterEach(async()=>{fetchSpy?.mockRestore();fetchSpy=undefined;if(directory)await rm(directory,{recursive:true,force:true});directory=undefined;if(originalCache===undefined)delete process.env.MOLECULAR_MODEL_CACHE_DIR;else process.env.MOLECULAR_MODEL_CACHE_DIR=originalCache;});
function atom(serial:number,name:string,residue:string,chain:string,seq:number,x:number,y=0,record='ATOM  '){
  return `${record}${String(serial).padStart(5)} ${name.padStart(4)} ${residue.padStart(3)} ${chain}${String(seq).padStart(4)}    ${x.toFixed(3).padStart(8)}${y.toFixed(3).padStart(8)}${'0.000'.padStart(8)}  1.00 20.00          ${name[0].padStart(2)}  `;
}
const pdb=[
  'HEADER                                                        1ABC',
  'TITLE     TEST DEPOSITED COORDINATES',
  'COMPND    MOL_ID: 1; MOLECULE: TEST PROTEIN; CHAIN: A;',
  'COMPND    MOL_ID: 2; MOLECULE: TEST DNA; CHAIN: 1;',
  'REMARK   2 RESOLUTION.    5.50 ANGSTROMS.',
  'CAVEAT     1ABC    ENTRY CONTAINS IMPROPER NUCLEOTIDE LINKAGES.',
  atom(1,'N','ALA','A',1,0),atom(2,'CA','ALA','A',1,1),atom(3,'C','ALA','A',1,2),
  atom(4,'N','GLY','A',2,3.3),atom(5,'CA','GLY','A',2,4.5),atom(6,'C','GLY','A',2,5.5),
  'TER',atom(7,'P','DA','1',1,0,4),atom(8,"O5'",'DA','1',1,1.5,4),atom(9,"O3'",'DA','1',1,3,4),
  atom(10,'P','DA','1',2,4.6,4),atom(11,"O5'",'DA','1',2,6.1,4),
  'END',
].join('\n');
const ccd=`data_DA\nloop_\n_chem_comp_bond.comp_id\n_chem_comp_bond.atom_id_1\n_chem_comp_bond.atom_id_2\n_chem_comp_bond.value_order\nDA P "O5'" SING\n#\n`;
async function mockSource(source=pdb){
  directory=await mkdtemp(join(tmpdir(),'aha-molecular-test-'));process.env.MOLECULAR_MODEL_CACHE_DIR=directory;
  fetchSpy=spyOn(globalThis,'fetch').mockImplementation((async (input:URL|RequestInfo)=>new Response(String(input).endsWith('.pdb')?source:ccd)) as typeof fetch) as typeof fetchSpy;
}
test('publishes deposited chain geometry, CCD nucleotide bonds, common origin and explicit fidelity',async()=>{
  await mockSource();
  const prepared=await prepareMolecularModel({accession:'1abc',chains:['A','1']}),decoded=await parseModelGLB(prepared.bytes);
  expect(decoded.metadata.parts.some(p=>p.name.startsWith('chain-A-protein'))).toBe(true);
  expect(decoded.metadata.parts.some(p=>p.name.startsWith('chain-1-nucleic'))).toBe(true);
  expect(prepared.context.units).toBe('angstrom');
  expect(prepared.context.origin).toEqual([3.05,2,0]);
  expect(prepared.context.provenance.source).toBe('https://files.rcsb.org/download/1ABC.pdb');
  expect(prepared.context.provenance.sourceHash).toMatch(/^[a-f0-9]{64}$/);
  expect(prepared.context.provenance.fidelity).toContain('5.50');
  expect(prepared.context.provenance.fidelity).toContain('IMPROPER NUCLEOTIDE LINKAGES');
  expect(prepared.context.provenance.converter.options).toHaveProperty('mapping');
  expect(prepared.context.provenance.converter.options).toHaveProperty('componentHashes.DA');
  expect(decoded.metadata.triangles).toBeGreaterThan(0);
  expect(decoded.metadata.bounds.min.every(Number.isFinite)).toBe(true);
  const again=await prepareMolecularModel({accession:'1ABC',chains:['1','A']});
  expect(again.bytes).toEqual(prepared.bytes);
  expect(fetchSpy).toHaveBeenCalledTimes(2);
  expect(fetchSpy!.mock.calls[0][1]).toMatchObject({redirect:'error'});
});
test('publishes compact chain landmarks at independently known deposited sites and rendered mesh centers',async()=>{
  await mockSource();
  const prepared=await prepareMolecularModel({accession:'1ABC',chains:['A','1']}),decoded=await parseModelGLB(prepared.bytes);
  const molecular=describeBundledModel(prepared.context).molecular!;
  expect(molecular.landmarkFrame).toContain('origin already subtracted');
  const chainA=molecular.chains.find(chain=>chain.id==='A')!,chainDNA=molecular.chains.find(chain=>chain.id==='1')!;
  const representative=chainA.landmarks!.find(point=>point.role==='representative')!;
  expect(representative).toMatchObject({atomId:'1/A/0/1//ALA/CA',residueId:'1/A/0/1//ALA',serial:2,atomName:'CA',residueName:'ALA',authorSequence:1,insertionCode:'',parts:['chain-A-protein-trace-0']});
  // Raw fixture CA is [1,0,0], common origin [3.05,2,0]; no chain-center substitution.
  expect(representative.position[0]).toBeCloseTo(-2.05,12);expect(representative.position.slice(1)).toEqual([-2,0]);
  const last=chainDNA.landmarks!.find(point=>point.role==='last-residue')!;
  expect(last).toMatchObject({atomId:'1/1/1/2//DA/P',serial:10,atomName:'P',authorSequence:2});
  expect(last.position[0]).toBeCloseTo(1.55,12);expect(last.position.slice(1)).toEqual([2,0]);
  expect(chainDNA.landmarks!.some(point=>point.role==='base'||point.role==='sugar')).toBe(false);
  const atomsBySerial=new Map([[2,[1,0,0]],[5,[4.5,0,0]],[7,[0,4,0]],[8,[1.5,4,0]],[9,[3,4,0]],[10,[4.6,4,0]],[11,[6.1,4,0]]]);
  for(const chain of molecular.chains){
    expect(chain.landmarks!.length).toBeLessThanOrEqual(7);
    for(const point of chain.landmarks!){
      expect(point.atomId.split('/')[1]).toBe(chain.id);
      const expected=atomsBySerial.get(point.serial)!;expect(expected).toBeDefined();
      for(let axis=0;axis<3;axis++)expect(point.position[axis]+prepared.context.origin[axis]).toBeCloseTo(expected[axis],10);
      for(const name of point.parts){
        const part=decoded.metadata.parts.find(part=>part.name===name)!,geometry=decoded.primitives[part.primitives[0]].geometry;
        const spans=(prepared.context.provenance.converter.options.mapping as Record<string,{id:string;first:number;count:number}[]>)[name];
        const span=spans.find(span=>span.id===point.atomId)!;expect(span).toBeDefined();
        for(let axis=0;axis<3;axis++)expect(geometry.vertices!.slice(span.first,span.first+6).reduce((sum,vertex)=>sum+vertex[axis],0)/6).toBeCloseTo(point.position[axis],5);
      }
    }
  }
  expect(JSON.stringify(molecular).length).toBeLessThan(6000);
  expect(describeBundledModel(prepared.context).provenance).not.toHaveProperty('converter');
});
test('nucleotide anatomy landmarks use deposited atoms in one representative residue without inventing missing sites',async()=>{
  const source=pdb.replace('\nEND',`\n${atom(12,"C1'",'DA','1',2,5.1,5)}\n${atom(13,'C6','DA','1',2,5.6,6)}\n${atom(14,'P','DA','1',3,8,4)}\nEND`);
  await mockSource(source);
  const {context}=await prepareMolecularModel({accession:'1ABC',chains:['A','1']});
  const points=context.molecular!.chains.find(chain=>chain.id==='1')!.landmarks!;
  expect(context.origin).toEqual([4,3,0]);
  expect(points).toHaveLength(6);
  expect(points.find(point=>point.role==='representative')).toMatchObject({serial:10,atomName:'P',authorSequence:2});
  expect(points.find(point=>point.role==='first-residue')).toMatchObject({serial:7,authorSequence:1});
  expect(points.find(point=>point.role==='last-residue')).toMatchObject({serial:14,authorSequence:3});
  const base=points.find(point=>point.role==='base')!,sugar=points.find(point=>point.role==='sugar')!,phosphate=points.find(point=>point.role==='phosphate')!;
  expect(base).toMatchObject({serial:13,atomName:'C6',residueId:'1/1/1/2//DA'});expect(base.position[0]).toBeCloseTo(1.6,12);expect(base.position.slice(1)).toEqual([3,0]);
  expect(sugar).toMatchObject({serial:12,atomName:"C1'",residueId:base.residueId});expect(sugar.position[0]).toBeCloseTo(1.1,12);expect(sugar.position.slice(1)).toEqual([2,0]);
  expect(phosphate).toMatchObject({serial:10,atomName:'P',residueId:base.residueId});expect(phosphate.position[0]).toBeCloseTo(.6,12);expect(phosphate.position.slice(1)).toEqual([1,0]);
});
test('rejects unknown chains instead of silently dropping requested geometry',async()=>{
  await mockSource();await expect(prepareMolecularModel({accession:'1ABC',chains:['Z']})).rejects.toThrow('Requested PDB chain Z has no selected atoms');
});
test('rejects arbitrary URLs and traversal before fetching',async()=>{
  await mockSource();for(const accession of ['../x','https://localhost','4YLN?x','AAAA'])await expect(prepareMolecularModel({accession})).rejects.toThrow('PDB accession');
  expect(fetchSpy).not.toHaveBeenCalled();
});
test('rejects oversized downloads and cancelled requests',async()=>{
  await mockSource();fetchSpy!.mockImplementation(async()=>new Response('oversized',{headers:{'Content-Length':'16000001'}}));
  await expect(prepareMolecularModel({accession:'2ABC'})).rejects.toThrow('byte limit');
  const controller=new AbortController();controller.abort();await expect(prepareMolecularModel({accession:'3ABC'},controller.signal)).rejects.toThrow();
});
test('one preparation cancellation cannot cancel another caller for the same structure',async()=>{
  await mockSource();let components=0;const entered=Promise.withResolvers<void>(),first=new AbortController();
  fetchSpy!.mockImplementation((async(input:URL|RequestInfo,init?:RequestInit)=>{
    if(String(input).endsWith('.pdb'))return new Response(pdb);
    if(++components===1){entered.resolve();return await new Promise<Response>((_resolve,reject)=>init!.signal!.addEventListener('abort',()=>reject(init!.signal!.reason),{once:true}));}
    return new Response(ccd);
  }) as typeof fetch);
  const cancelled=prepareMolecularModel({accession:'1ABC',chains:['A','1']},first.signal);
  void cancelled.catch(()=>{});await entered.promise;
  const second=prepareMolecularModel({accession:'1ABC',chains:['A','1']});
  let timer:ReturnType<typeof setTimeout>|undefined;
  try {
    const prepared=await Promise.race([second,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('Concurrent caller reused cancelled work')),1000);})]);
    expect(prepared.bytes.length).toBeGreaterThan(0);first.abort();await expect(cancelled).rejects.toThrow();expect(components).toBe(2);
  }finally{first.abort();clearTimeout(timer);}
});
test('retains only SEQRES nucleotide HETATM sites explicitly LINK-connected to polymer',async()=>{
  const linkColumns=Array<string>(80).fill(' ');
  for(const [offset,value] of [[0,'LINK'],[12," O3'"],[17,'GTP'],[21,'3'],[22,'  13'],[42,'   P'],[47,'  A'],[51,'3'],[52,'  14']] as [number,string][])for(let i=0;i<value.length;i++)linkColumns[offset+i]=value[i];
  const link=linkColumns.join('');
  const source=[pdb,'SEQRES   1 3    2  GTP   A',link,
    atom(12,'P','GTP','3',13,10,5,'HETATM'),atom(13,"O3'",'GTP','3',13,11,5,'HETATM'),
    atom(14,'P','A','3',14,12.6,5),atom(15,"O5'",'A','3',14,14.1,5),
    atom(16,'P','GTP','3',99,90,50,'HETATM')].join('\n');
  await mockSource(source);
  fetchSpy!.mockImplementation((async(input:URL|RequestInfo)=>{
    if(String(input).endsWith('.pdb'))return new Response(source);
    const name=/\/([A-Z]+)\.cif$/.exec(String(input))![1];return new Response(ccd.replaceAll('DA',name));
  }) as typeof fetch);
  const prepared=await prepareMolecularModel({accession:'1ABC',chains:['3']});
  expect(prepared.context.molecular!.chains[0].residues).toBe(2);
  expect(prepared.context.molecular!.chains[0].authorRanges).toEqual(['13–14']);
  expect(prepared.context.provenance.selection).toContain('2 nucleotide HETATM');
  expect(prepared.context.origin[0]).toBeLessThan(20);
});

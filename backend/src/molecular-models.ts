import {createHash} from 'node:crypto';
import {mkdir,readFile,stat} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createMoleculeBuilders,createMolecularBackboneBuilders,createModelGLB,importPDBStructure} from 'animlib/core';
import type {GeneratedModel,MolecularBackboneResult,ResidueBondTemplate,StructureAtom,Vec3} from 'animlib/core';
import type {BundledModelContext,MolecularLandmark} from './bundled-models.js';
import {atomicWrite} from './atomic-write.js';

import {PreparedArtifactStore} from './prepared-artifacts.js';
export type PdbRepresentation='mixed'|'backbone';
const VERSION='rcsb-deposited-v4';
const LIMIT=16_000_000;
const protein=new Set('ALA ARG ASN ASP CYS GLN GLU GLY HIS ILE LEU LYS MET PHE PRO SER THR TRP TYR VAL'.split(' '));
const nucleic=new Set('A C G U I DA DC DG DT DI ATP CTP GTP UTP'.split(' '));
const elementColors:Record<string,[number,number,number,number]>={C:[.5,.5,.5,1],N:[0,0,1,1],O:[1,0,0,1],P:[1,.35,0,1],S:[1,1,0,1]};
const builders=createMolecularBackboneBuilders(createMoleculeBuilders());
let store:PreparedArtifactStore|undefined;let storeRoot='';
const digest=(bytes:Uint8Array|string)=>createHash('sha256').update(bytes).digest('hex');
const directory=()=>resolve(process.env.MOLECULAR_MODEL_CACHE_DIR??'data/molecular-model-cache');

/** Only fixed RCSB paths are reachable. Cached snapshots are content-addressed and hash checked. */
async function download(name:string,url:string,limit:number,signal?:AbortSignal):Promise<{text:string;hash:string}> {
  signal?.throwIfAborted();const root=directory();await mkdir(root,{recursive:true});
  try {
    const index=JSON.parse(await readFile(join(root,`${name}.json`),'utf8')) as {hash:string};
    if(!/^[a-f0-9]{64}$/.test(index.hash))throw new Error('Invalid molecular cache hash');
    const file=join(root,`${index.hash}.txt`);if((await stat(file)).size>limit)throw new Error('Molecular cache exceeds byte limit');
    const bytes=await readFile(file);if(digest(bytes)!==index.hash)throw new Error('Molecular cache hash mismatch');
    return {text:bytes.toString('utf8'),hash:index.hash};
  }catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
  const timeout=AbortSignal.timeout(30_000),requestSignal=signal?AbortSignal.any([signal,timeout]):timeout;
  const response=await fetch(url,{redirect:'error',signal:requestSignal});
  if(!response.ok)throw new Error(`RCSB download failed (${response.status})`);
  if(Number(response.headers.get('content-length'))>limit){await response.body?.cancel();throw new Error('RCSB download exceeds byte limit');}
  const reader=response.body?.getReader();if(!reader)throw new Error('Empty RCSB download');
  const chunks:Uint8Array[]=[];let size=0;
  try {while(true){requestSignal.throwIfAborted();const next=await reader.read();if(next.done)break;size+=next.value.length;if(size>limit)throw new Error('RCSB download exceeds byte limit');chunks.push(next.value);}}
  catch(error){await reader.cancel().catch(()=>{});throw error;}finally{reader.releaseLock();}
  const bytes=Buffer.concat(chunks),hash=digest(bytes);await atomicWrite(join(root,`${hash}.txt`),bytes);await atomicWrite(join(root,`${name}.json`),JSON.stringify({hash,url}));
  return {text:bytes.toString('utf8'),hash};
}

// CCD bond loops use one row per line. Reject unsupported encodings rather than guess chemistry.
function componentTemplate(text:string,name:string,hash:string):ResidueBondTemplate {
  const lines=text.split(/\r?\n/),start=lines.findIndex(line=>line.trim()==='_chem_comp_bond.comp_id');
  if(start<0)throw new Error(`CCD ${name} has no bond table`);
  const headers:string[]=[];let i=start;
  while(lines[i]?.trim().startsWith('_chem_comp_bond.'))headers.push(lines[i++].trim());
  const column=(label:string)=>{const index=headers.indexOf(`_chem_comp_bond.${label}`);if(index<0)throw new Error(`CCD ${name} missing ${label}`);return index;};
  const a=column('atom_id_1'),b=column('atom_id_2'),order=column('value_order'),component=column('comp_id');
  const bonds:ResidueBondTemplate['bonds']=[],orders:Record<string,ResidueBondTemplate['bonds'][number]['order']>={SING:'single',DOUB:'double',TRIP:'triple',AROM:'aromatic'};
  for(;i<lines.length;i++){
    const line=lines[i].trim();if(!line||line.startsWith('#')||line==='loop_'||line.startsWith('_'))break;
    const row=(line.match(/"[^"\r\n]*"|'[^'\r\n]*'|\S+/g)??[]).map(token=>(token.startsWith('"')||token.startsWith("'"))?token.slice(1,-1):token);
    if(row.length!==headers.length||row[component]!==name||!orders[row[order]])throw new Error(`Unsupported CCD ${name} bond row`);
    bonds.push({a:row[a],b:row[b],order:orders[row[order]]});
  }
  if(!bonds.length)throw new Error(`CCD ${name} has empty bond table`);
  return {source:`https://files.rcsb.org/ligands/download/${name}.cif`,version:`sha256:${hash}`,bonds};
}

function polymerInput(text:string,chains?:string[]):{text:string;promoted:number;names:string[]} {
  const lines=text.split(/\r?\n/),seqres=new Map<string,Set<string>>();
  for(const line of lines)if(line.startsWith('SEQRES')){const chain=line.slice(11,12).trim(),names=seqres.get(chain)??new Set<string>();for(const name of line.slice(19,70).trim().split(/\s+/))names.add(name);seqres.set(chain,names);}
  const site=(line:string,offset=0)=>line.slice(17+offset,27+offset),polymerSites=new Set(lines.filter(l=>l.startsWith('ATOM  ')).map(l=>site(l))),linkedSites=new Set<string>();
  for(const line of lines)if(line.startsWith('LINK  ')){
    const a=site(line),b=site(line,30);
    if(line.slice(21,22)!==line.slice(51,52))continue;
    if(polymerSites.has(a))linkedSites.add(b);if(polymerSites.has(b))linkedSites.add(a);
  }
  const names=new Set<string>();let promoted=0;
  const output=lines.map(line=>{
    const chain=line.slice(21,22).trim(),name=line.slice(17,20).trim();
    if(chains&&!chains.includes(chain))return line;
    if(line.startsWith('HETATM')&&nucleic.has(name)&&seqres.get(chain)?.has(name)&&linkedSites.has(site(line))){promoted++;names.add(name);return `ATOM  ${line.slice(6)}`;}
    if(line.startsWith('ATOM  ')&&nucleic.has(name))names.add(name);
    return line;
  });
  return {text:output.join('\n'),promoted,names:[...names].sort()};
}
function molecules(text:string):Map<string,string> {
  const fields=text.split(/\r?\n/).filter(l=>l.startsWith('COMPND')).map(l=>l.slice(10).trim()).join(' ').split(';');
  const result=new Map<string,string>();let name='Deposited polymer';
  for(const field of fields){const value=field.trim();if(value.startsWith('MOLECULE:'))name=value.slice(9).trim();if(value.startsWith('CHAIN:'))for(const chain of value.slice(6).split(','))result.set(chain.trim(),name);}
  return result;
}

async function inputs(chains:string[]|undefined,source:{text:string;hash:string},signal?:AbortSignal){
  const selected=polymerInput(source.text,chains),componentHashes:Record<string,string>={},residueTemplates:Record<string,ResidueBondTemplate>={};
  for(const chain of chains??[])if(!selected.text.split(/\r?\n/).some(line=>line.startsWith('ATOM  ')&&line.slice(21,22).trim()===chain))throw new Error(`Requested PDB chain ${chain} has no selected atoms`);
  await Promise.all(selected.names.map(async name=>{const data=await download(`ccd-${name}`,`https://files.rcsb.org/ligands/download/${name}.cif`,1_000_000,signal);componentHashes[name]=data.hash;residueTemplates[name]=componentTemplate(data.text,name,data.hash);}));
  signal?.throwIfAborted();
  return {selected,componentHashes,residueTemplates};
}
async function build(accession:string,chains:string[]|undefined,source:{text:string;hash:string},prepared:Awaited<ReturnType<typeof inputs>>,representation:PdbRepresentation){
  const {selected,componentHashes,residueTemplates}=prepared;
  const url=`https://files.rcsb.org/download/${accession}.pdb`;
  const structure=importPDBStructure(selected.text,{source:url,accession,chains,residueTemplates});
  for(const chain of chains??[])if(!structure.residues.some(r=>r.chainId===chain))throw new Error(`Requested PDB chain ${chain} has no selected atoms`);
  const atoms=new Map(structure.atoms.map(a=>[a.id,a])),residues=new Map(structure.residues.map(r=>[r.id,r]));
  const moleculeNames=molecules(source.text);
  const parts:GeneratedModel['parts']=[],mapping:Record<string,unknown>={},chainDescriptions:NonNullable<BundledModelContext['molecular']>['chains']=[];
  const representedParts=new Map<string,string[]>();
  const provenance={kind:'scientific' as const,source:url,units:'angstrom'};
  function append(result:MolecularBackboneResult,prefix:string,atomic:boolean){
    for(let i=0;i<result.meshes.length;i++){
      const mesh=result.meshes[i],name=`${prefix}-${i}`,ids=result.vertexResidueIds[i];
      const spans:{id:string;first:number;count:number}[]=[];
      for(let v=0;v<ids.length;v++){const last=spans.at(-1);if(last?.id===ids[v])last.count++;else spans.push({id:ids[v],first:v,count:1});}
      mapping[name]=spans;
      for(const id of new Set(ids))representedParts.set(id,[...(representedParts.get(id)??[]),name]);
      parts.push({name,vertices:mesh.vertices! as Vec3[],triangles:mesh.triangles!,normals:mesh.normals,roughness:.65,
        ...(atomic?{vertexColors:ids.map(id=>elementColors[atoms.get(id)!.element]??[.6,.6,.6,1])}:{baseColor:[.38,.44,.52,1]})});
    }
  }
  const dist=(a:StructureAtom,b:StructureAtom)=>Math.hypot(...a.position.map((v,j)=>v-b.position[j]));
  const representative=(sites:StructureAtom[])=>{
    const center=sites.reduce((sum,site)=>sum.map((v,axis)=>v+site.position[axis]/sites.length) as Vec3,[0,0,0] as Vec3);
    const distance=(site:StructureAtom)=>site.position.reduce((sum,v,axis)=>sum+(v-center[axis])**2,0);
    // Select an actual retained site; the centroid itself need not belong to the molecule.
    return sites.reduce((best,site)=>distance(site)<distance(best)?site:best);
  };
  const backboneLinks:{a:string;b:string;source:string}[]=[];
  for(const chain of [...new Set(structure.residues.map(r=>r.chainId))]){
    const before=parts.length,selectedResidues=structure.residues.filter(r=>r.chainId===chain),proteinResidues=selectedResidues.filter(r=>protein.has(r.name)&&r.anchorId),nucleicResidues=selectedResidues.filter(r=>nucleic.has(r.name));
    const gaps:{before:string;reason:string}[]=structure.breaks.filter(b=>residues.get(b.before)?.chainId===chain&&!['TER','chain-change','unsupported-polymer'].includes(b.reason));
    if(proteinResidues.length){
      const proteinIds=new Set(proteinResidues.map(r=>r.id)),segments=structure.segments.filter(s=>s.chainId===chain).map(s=>({...s,residueIds:s.residueIds.filter(id=>proteinIds.has(id))})).filter(s=>s.residueIds.length);
      const anchors=proteinResidues.map(r=>({id:r.anchorId!,position:atoms.get(r.anchorId!)!.position,value:0}));
      const bonds:[string,string][]=segments.flatMap(s=>s.residueIds.slice(1).map((id,i)=>[residues.get(s.residueIds[i])!.anchorId!,residues.get(id)!.anchorId!] as [string,string]));
      const props={segments:anchors.map(a=>({id:a.id,chainId:chain,residues:[a]})),bonds,origin:structure.center,provenance,initialNormal:[.213,.417,.884] as Vec3};
      if(bonds.length)append(builders.molecularBackbone({...props,representation:'sticks',radius:.65,radialSegments:6}),`chain-${chain||'blank'}-protein-trace`,false);
      const linked=new Set(bonds.flat());const isolated=anchors.filter(a=>!linked.has(a.id));
      if(isolated.length)append(builders.molecularBackbone({...props,segments:isolated.map(a=>({id:a.id,chainId:chain,residues:[a]})),bonds:[],representation:'beads',radius:.65,beadDetail:1}),`chain-${chain||'blank'}-protein-isolated`,false);
    }
    if(nucleicResidues.length&&representation==='backbone'){
      const anchors=nucleicResidues.map(r=>({r,a:r.atomIds.map(id=>atoms.get(id)!).find(a=>a.name==='P')}));
      const sites=anchors.filter(site=>site.a),bonds:[string,string][]=[];
      for(let i=0;i<anchors.length;i++){const b=anchors[i],a=anchors[i-1];if(!b.a)gaps.push({before:b.r.id,reason:'Missing deposited P anchor'});if(!a)continue;
        if(!a.a||!b.a||a.r.id.split('/')[2]!==b.r.id.split('/')[2]||b.r.authorSequence!==a.r.authorSequence+1||a.r.insertionCode||b.r.insertionCode||dist(a.a,b.a)>10){gaps.push({before:b.r.id,reason:'Missing anchor, author gap, insertion code, TER or P distance above 10 angstrom; no trace bridge'});continue;}bonds.push([a.a.id,b.a.id]);}
      const props={segments:sites.map(({a})=>({id:a!.id,chainId:chain,residues:[{id:a!.id,position:a!.position,value:0}]})),bonds,origin:structure.center,provenance,initialNormal:[.213,.417,.884] as Vec3};
      if(bonds.length)append(builders.molecularBackbone({...props,representation:'sticks',radius:.65,radialSegments:6}),`chain-${chain||'blank'}-nucleic-trace`,false);
      const linked=new Set(bonds.flat()),isolated=sites.filter(site=>!linked.has(site.a!.id));
      if(isolated.length)append(builders.molecularBackbone({...props,segments:isolated.map(({a})=>({id:a!.id,chainId:chain,residues:[{id:a!.id,position:a!.position,value:0}]})),bonds:[],representation:'beads',radius:.65,beadDetail:1}),`chain-${chain||'blank'}-nucleic-isolated`,false);
    }
    if(nucleicResidues.length&&representation==='mixed'){
      const selectedAtoms=nucleicResidues.flatMap(r=>r.atomIds.map(id=>atoms.get(id)!)),ids=new Set(selectedAtoms.map(a=>a.id));
      const bonds:[string,string][]=structure.bonds.filter(b=>ids.has(b.a)&&ids.has(b.b)).map(b=>[b.a,b.b]);
      const seen=new Set(bonds.map(b=>[...b].sort().join('\0')));
      for(let i=1;i<nucleicResidues.length;i++){
        const prev=nucleicResidues[i-1],next=nucleicResidues[i];
        // Same TER block and consecutive author residues only; never bridge deposited gaps.
        if(prev.id.split('/')[2]!==next.id.split('/')[2]||next.authorSequence!==prev.authorSequence+1||next.insertionCode){gaps.push({before:next.id,reason:'author-gap, insertion-code or TER boundary; no inferred phosphodiester link'});continue;}
        const a=prev.atomIds.map(id=>atoms.get(id)!).find(a=>a.name==="O3'"),b=next.atomIds.map(id=>atoms.get(id)!).find(a=>a.name==='P');
        if(!a||!b||dist(a,b)<1||dist(a,b)>2.1){gaps.push({before:next.id,reason:'missing O3′/P or deposited link distance outside 1–2.1Å; no inferred link'});continue;}
        const key=[a.id,b.id].sort().join('\0');if(seen.has(key))continue;seen.add(key);bonds.push([a.id,b.id]);backboneLinks.push({a:a.id,b:b.id,source:'Standard O3′–P phosphodiester template, contiguous author sequence, same TER block, deposited distance 1–2.1Å'});
      }
      const props={segments:selectedAtoms.map(a=>({id:a.id,chainId:chain,residues:[{id:a.id,position:a.position,value:0}]})),bonds,origin:structure.center,provenance,initialNormal:[.213,.417,.884] as Vec3};
      append(builders.molecularBackbone({...props,representation:'beads',radius:.27,beadDetail:0}),`chain-${chain||'blank'}-nucleic-atoms`,true);
      if(bonds.length)append(builders.molecularBackbone({...props,representation:'sticks',radius:.16,radialSegments:6}),`chain-${chain||'blank'}-nucleic-bonds`,true);
    }
    const ranges:{first:string;last:string;sequence:number}[]=[];
    for(const residue of selectedResidues){const label=`${residue.authorSequence}${residue.insertionCode}`,last=ranges.at(-1);if(last&&residue.authorSequence===last.sequence+1&&!residue.insertionCode){last.last=label;last.sequence=residue.authorSequence;}else ranges.push({first:label,last:label,sequence:residue.authorSequence});}
    const landmarks:MolecularLandmark[]=[];
    const addLandmark=(role:MolecularLandmark['role'],atom:StructureAtom|undefined)=>{
      if(!atom||!representedParts.has(atom.id))return;
      const residue=residues.get(atom.residueId)!;
      landmarks.push({role,atomId:atom.id,residueId:residue.id,serial:atom.serial,atomName:atom.name,residueName:residue.name,authorSequence:residue.authorSequence,insertionCode:residue.insertionCode,
        position:atom.position.map((v,axis)=>v-structure.center[axis]) as Vec3,parts:[...representedParts.get(atom.id)!]});
    };
    const proteinSites=proteinResidues.map(r=>atoms.get(r.anchorId!)!).filter(atom=>representedParts.has(atom.id));
    if(proteinSites.length)addLandmark('representative',representative(proteinSites));
    const nucleicSites=nucleicResidues.map(residue=>{
      const sites=residue.atomIds.map(id=>atoms.get(id)!).filter(atom=>representedParts.has(atom.id));
      return ['P',"C4'","C1'"].map(name=>sites.find(atom=>atom.name===name)).find(Boolean)??sites[0];
    }).filter((atom):atom is StructureAtom=>!!atom);
    if(nucleicSites.length){
      const middle=representative(nucleicSites),residue=residues.get(middle.residueId)!,sites=residue.atomIds.map(id=>atoms.get(id)!);
      addLandmark(proteinSites.length?'central-residue':'representative',middle);
      addLandmark('first-residue',nucleicSites[0]);addLandmark('last-residue',nucleicSites.at(-1));
      // C6 belongs to both purine and pyrimidine base rings; no missing atom is replaced.
      addLandmark('base',sites.find(atom=>atom.name==='C6'));
      addLandmark('sugar',sites.find(atom=>atom.name==="C1'"));
      addLandmark('phosphate',sites.find(atom=>atom.name==='P'));
    }
    if(parts.length>before)chainDescriptions.push({id:chain,molecule:moleculeNames.get(chain)??'Deposited polymer',residues:selectedResidues.length,atoms:selectedResidues.reduce((n,r)=>n+r.atomIds.length,0),parts:parts.slice(before).map(p=>p.name),authorRanges:ranges.map(r=>r.first===r.last?r.first:`${r.first}–${r.last}`),gapCount:gaps.length,gaps:gaps.slice(0,16),landmarks});
  }
  if(!parts.length)throw new Error('No supported protein or nucleic-acid geometry in selected PDB chains');
  const resolution=/^REMARK   2 RESOLUTION\.\s+([\d.]+) ANGSTROMS/m.exec(source.text)?.[1];
  const caveats=source.text.split(/\r?\n/).filter(l=>l.startsWith('CAVEAT')).map(l=>l.slice(18).trim()).join(' ');
  const context:BundledModelContext={fixtureId:`pdb-${accession.toLowerCase()}-${chains?.join('')||'all'}`,units:'angstrom',origin:[...structure.center],
    representation:'Deposited protein CA trace and nucleotide heavy-atom geometry with CCD connectivity; no invented surface or molecular dynamics.',
    partMeaning:'Named chain parts use PDB author chain IDs. Protein traces connect deposited CA anchors only inside validated contiguous peptide segments. Nucleotide parts preserve deposited atom sites and CCD atom-name mapping. Individual residues are recorded in host provenance; model parts are chain-level.',
    colorMeaning:'Protein neutral grey is a residue trace, not atoms. Nucleotide atoms use C grey, N blue, O red, P orange, S yellow; bond endpoint colors interpolate. Use WHITE model tint to retain element identity. Single cylinders encode connectivity, not bond order.',
    molecular:{accession,title:structure.title,landmarkFrame:'Model-local angstrom coordinates; common origin already subtracted. Apply the model scale/rotation/translation once, without subtracting origin again. Every landmark is a retained deposited atom site at a bead or trace-ring center in the named parts. Representative sites are nearest their chain anchor centroid, not inferred active sites. First/last mean retained source residue order, not biological termini; labels still need camera and occlusion checks.',chains:chainDescriptions},
    provenance:{source:url,sourceHash:source.hash,creator:source.text.split(/\r?\n/).filter(l=>l.startsWith('AUTHOR')).map(l=>l.slice(10).trim()).join(' ')||'wwPDB depositors',license:'CC0-1.0',preparedAt:new Date().toISOString(),
      selection:`First deposited model; author chains ${chains?.join(', ')??'all'}; highest-occupancy residue conformer; heavy atoms only. ${selected.promoted} nucleotide HETATM records declared in chain SEQRES and LINK-connected to a deposited polymer retained as polymer atoms. Other HETATM, waters, ions and unsupported residues omitted.`,
      modifications:['Subtract one common bounding-box center; no rotation, rescaling or coordinate replacement.','Protein side chains omitted; fixed-radius CA trace is schematic. Nucleic atom radii are display radii, not van der Waals radii.','Nucleotide intramolecular bonds come from wwPDB CCD by deposited atom name; contiguous O3′–P links use explicit template and distance sanity gate. Missing atoms and gaps remain missing.'],
      converter:{name:VERSION,version:'4',options:{origin:structure.center,componentHashes,mapping,atoms:structure.atoms.map(({id,residueId,serial,name,element,alt})=>({id,residueId,serial,name,element,alt})),residues:structure.residues.map(({id,chainId,authorSequence,insertionCode,name})=>({id,chainId,authorSequence,insertionCode,name})),backboneLinks,breaks:structure.breaks,diagnostics:structure.diagnostics}},
      fidelity:`Static deposited experimental model${resolution?` at ${resolution} Å resolution`:''}; does not establish atomic precision, catalytic chemistry, dynamic trajectories or processive motion. Protein is a CA trace, not a molecular surface; nucleic coordinates are unchanged. No symmetry mates or biological-assembly transforms applied. ${caveats?`Depositor caveat: ${caveats}`:''}`}};
  if(representation==='backbone'){context.representation='Deposited protein CA and nucleotide P backbone anchors only; schematic whole-complex geometry, not atomic chemistry, surfaces or dynamics.';context.colorMeaning='Neutral grey schematic backbone; color does not encode atom identity.';context.partMeaning='Named chain parts retain deposited CA/P anchors. Missing anchors and author/TER gaps stay disconnected. Individual residues are recorded in host provenance; parts are chain-level.';context.provenance.modifications=['Subtract one common bounding-box center; no rotation, rescaling or coordinate replacement.','Explicit backbone: protein CA and nucleotide P anchors only. Fixed-radius traces are schematic, not atomic surfaces or van der Waals radii.','Nucleotide P trace links require consecutive author residues, no insertion code, same TER block and deposited P distance at most 10 angstrom. Missing anchors and gaps stay disconnected. No CCD bond geometry is rendered.'];context.provenance.fidelity+=' Backbone cannot support atomic contacts, binding-site chemistry or molecular dynamics claims.';}
  context.provenance.converter.options.representation=representation;
  const bytes=await createModelGLB({parts});return {bytes,context};
}

/** Generic bounded RCSB import. Coordinate arrays stay in host cache and GLB, outside agent context. */
export async function prepareMolecularModel(input:{accession:string;chains?:string[];representation?:PdbRepresentation},signal?:AbortSignal):Promise<{bytes:Uint8Array;context:BundledModelContext}> {
  signal?.throwIfAborted();
  if(!input||typeof input.accession!=='string'||! /^[1-9][A-Za-z0-9]{3}$/.test(input.accession))throw new Error('PDB accession must be a four-character legacy PDB identifier');
  if(input.chains!==undefined&&(!Array.isArray(input.chains)||!input.chains.length||input.chains.length>32||input.chains.some(c=>typeof c!=='string'||! /^[A-Za-z0-9]?$/.test(c))))throw new Error('PDB chains must be 1–32 single-character author chain IDs');
  const accession=input.accession.toUpperCase(),chains=input.chains?[...new Set(input.chains)].sort():undefined;
  const representation=input.representation??'mixed';if(!['mixed','backbone'].includes(representation))throw new Error('PDB representation must be mixed or backbone');
  const source=await download(`pdb-${accession}`,`https://files.rcsb.org/download/${accession}.pdb`,LIMIT,signal),prepared=await inputs(chains,source,signal);signal?.throwIfAborted();
  const root=join(directory(),'prepared');if(!store||storeRoot!==root){storeRoot=root;store=new PreparedArtifactStore({directory:root,maxArtifactBytes:64_000_000,maxContextBytes:16_000_000,maxMemoryBytes:64_000_000});}
  return store.prepare('rcsb-pdb',VERSION,{accession,sourceHash:source.hash,componentHashes:prepared.componentHashes,chains:chains??null,representation},()=>build(accession,chains,source,prepared,representation),signal);
}

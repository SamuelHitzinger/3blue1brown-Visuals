/** Offline, pinned scientific preparation; no parser or coordinate arrays enter the scene VM. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {importPDBStructure,structureBackboneProps} from '../dist/molecular-structure-data.js';
import {createMolecularEnvelope} from '../dist/molecular-envelope.js';
import {createMolecularBackboneBuilders} from '../dist/molecular-backbone.js';
import {createMoleculeBuilders} from '../dist/molecules.js';
import {writeAssetPackages} from './write-asset-packages.mjs';
const root=resolve('shared/animlib/fixtures/biological'),crn=join(root,'1crn');
const sha=x=>createHash('sha256').update(x).digest('hex');
const lock=JSON.parse(await readFile(join(crn,'source-lock.json'),'utf8')),sources={};
for(const [name,hash] of Object.entries(lock)){const bytes=await readFile(join(crn,'source',name));if(sha(bytes)!==hash)throw Error(`Pinned source changed: ${name}`);sources[name]=bytes.toString('utf8');}
const templates={};
for(const [file,text] of Object.entries(sources))if(file.endsWith('.cif')){
  // Deliberately restricted to the pinned, unquoted seven-column CCD bond loops.
  // Reject unfamiliar syntax rather than pretending this is a general mmCIF parser.
  const name=file.slice(0,-4),lines=text.split(/\r?\n/),at=lines.findIndex(x=>x.trim()==='_chem_comp_bond.comp_id');
  const columns=['comp_id','atom_id_1','atom_id_2','value_order','pdbx_aromatic_flag','pdbx_stereo_config','pdbx_ordinal'];
  if(at<0||columns.some((c,i)=>lines[at+i].trim()!==`_chem_comp_bond.${c}`))throw Error(`Unsupported CCD loop ${name}`);
  const bonds=[];for(let i=at+7;i<lines.length&&!lines[i].trim().startsWith('#');i++){
    const row=lines[i].trim().split(/\s+/);if(row.length!==7||row[0]!==name||row.some(x=>/['";]/.test(x)))throw Error(`Unsupported CCD bond row ${name}`);
    const order={SING:'single',DOUB:'double',TRIP:'triple',AROM:'aromatic'}[row[3]];if(!order)throw Error('Unsupported CCD bond order');
    bonds.push({a:row[1],b:row[2],order:row[4]==='Y'?'aromatic':order});
  }
  if(!bonds.length||bonds.length>256)throw Error('CCD bond budget');
  templates[name]={source:`https://files.rcsb.org/ligands/download/${file}`,version:`sha256:${lock[file]}`,bonds};
}
const structure=importPDBStructure(sources['1CRN.pdb'],{source:'https://files.rcsb.org/download/1CRN.pdb',accession:'1CRN',chains:['A'],residueTemplates:templates,polymerLinks:'standard-peptide'});
if(structure.atoms.length!==327||structure.residues.length!==46||structure.segments.length!==1||structure.bonds.filter(b=>b.sources.some(p=>p.kind==='CONECT')).length!==3)throw Error('1CRN verification failed');
const molecular=createMolecularBackboneBuilders(createMoleculeBuilders()),atomMap=new Map(structure.atoms.map(a=>[a.id,a])),residueMap=new Map(structure.residues.map(r=>[r.id,r]));
const provenance={source:'https://www.rcsb.org/structure/1CRN',sourceHash:lock['1CRN.pdb'],creator:'W. A. Hendrickson and M. M. Teeter; wwPDB Chemical Component Dictionary',license:'CC0-1.0',preparedAt:'2026-10-11',converter:{name:'animlib prepare-biological-assets',version:'1',options:{sourceHashes:lock,model:structure.model,origin:structure.center,connectivity:'deposited CONECT + pinned CCD intra-residue templates + explicitly enabled standard peptide rule'}},selection:structure.provenance.selection+'; chain A',modifications:['Subtract one common bounding-box center from every representation.','Atomic bond orders retained in structure metadata; display uses one cylinder per edge, including aromatic and multiple bonds.','Color by persistent residue identity, not element.'],fidelity:'Deposited heavy-atom coordinates and atom/residue identities retained. Beads are CA anchors. Surface is a schematic Gaussian envelope, not a solvent-excluded or electron-density surface.'};
const part=(id,g)=>({id,vertices:g.vertices,triangles:g.triangles,...(g.normals?{normals:g.normals}:{})});
const models=[];
const stickParts=[];
for(let index=0;index<structure.residues.length;index++){
  const residue=structure.residues[index],sites=[],bonds=[];
  for(const edge of structure.bonds)for(const end of [edge.a,edge.b]){
    const a=atomMap.get(end),b=atomMap.get(end===edge.a?edge.b:edge.a);if(a.residueId!==residue.id)continue;
    const first=`edge-${sites.length}`,second=`edge-${sites.length+1}`;
    sites.push({id:first,position:a.position,value:residue.value},{id:second,position:a.position.map((v,j)=>(v+b.position[j])/2),value:residue.value});bonds.push([first,second]);
  }
  const g=molecular.molecularBackbone({segments:[{id:residue.id,chainId:'A',residues:sites}],bonds,representation:'sticks',radius:.16,origin:structure.center,radialSegments:8,initialNormal:[.321,.456,.789],provenance:{kind:'scientific',source:provenance.source,units:'angstrom'}}).meshes[0];
  stickParts.push(part(`residue-${index}`,g));
}
models.push({id:'1crn-sticks',parts:stickParts});
const beads=molecular.molecularBackbone({...structureBackboneProps(structure,'residues',.65),beadDetail:2});
const split=(geometry,triangleKeys)=>{
  const groups=new Map();geometry.triangles.forEach((t,i)=>{const key=triangleKeys[i],group=groups.get(key)??{id:`residue-${key}`,vertices:[],triangles:[],normals:[],map:new Map()};
    const indices=t.map(v=>{if(!group.map.has(v)){group.map.set(v,group.vertices.length);group.vertices.push(geometry.vertices[v]);group.normals.push(geometry.normals[v]);}return group.map.get(v);});group.triangles.push(indices);groups.set(key,group);});
  return [...groups.values()].map(({map,...p})=>p);
};
const beadParts=[];beads.meshes.forEach((g,i)=>beadParts.push(...split(g,g.triangles.map(t=>structure.residues.findIndex(r=>r.id===beads.vertexResidueIds[i][t[0]])))));
// CA adjacency is a residue-level guide, never added to the atomic bond graph.
for(const segment of structure.segments)for(let i=1;i<segment.residueIds.length;i++){
  const a=residueMap.get(segment.residueIds[i-1]),b=residueMap.get(segment.residueIds[i]),p=atomMap.get(a.anchorId).position,q=atomMap.get(b.anchorId).position,mid=p.map((v,j)=>(v+q[j])/2);
  for(const [r,start] of [[a,p],[b,q]]){
    const index=structure.residues.indexOf(r),target=beadParts.find(p=>p.id===`residue-${index}`),g=molecular.molecularBackbone({segments:[{id:'guide',chainId:'A',residues:[{id:'a',position:start,value:r.value},{id:'b',position:mid,value:r.value}]}],bonds:[['a','b']],representation:'sticks',radius:.14,origin:structure.center,initialNormal:[.321,.456,.789],radialSegments:8,provenance:{kind:'schematic',source:'CA residue-adjacency guide, not an atomic covalent bond',units:'angstrom'}}).meshes[0],offset=target.vertices.length;
    target.vertices.push(...g.vertices);target.normals.push(...g.normals);target.triangles.push(...g.triangles.map(t=>t.map(v=>v+offset)));
  }
}
models.push({id:'1crn-beads',parts:beadParts});
const envelopeOptions={positions:structure.atoms.flatMap(a=>a.position),origin:structure.center,sigma:1.35,isoLevel:1.05,resolution:27,smoothingIterations:3};
const surface=createMolecularEnvelope(envelopeOptions),surfaceResidues=[];
const surfaceKeys=surface.triangles.map(t=>{const p=[0,1,2].map(j=>t.reduce((n,i)=>n+surface.vertices[i][j],0)/3+structure.center[j]);let best,distance=Infinity;for(const a of structure.atoms){const d=a.position.reduce((n,x,j)=>n+(x-p[j])**2,0);if(d<distance){distance=d;best=a;}}const index=structure.residues.findIndex(r=>r.id===best.residueId);surfaceResidues.push(best.residueId);return index;});
models.push({id:'1crn-surface',parts:split(surface,surfaceKeys)});
const measurements=[];
for(const model of models){const result=await writeAssetPackages({images:[],model:{...model,kind:'model',version:1,units:'angstrom',provenance},report:{structure:'../structure.json',surfaceParameters:{...envelopeOptions,positions:undefined},colorMapping:'part residue-N maps directly to structure.residues[N]'}},join(crn,model.id));measurements.push({id:model.id,parts:model.parts.length,vertices:model.parts.reduce((n,p)=>n+p.vertices.length,0),triangles:model.parts.reduce((n,p)=>n+p.triangles.length,0),stats:result.stats});}
await writeFile(join(crn,'structure.json'),JSON.stringify({...structure,sourceHashes:lock},null,2)+'\n');
await writeFile(join(crn,'surface-residue-ids.json'),JSON.stringify(surfaceResidues)+'\n');
await writeFile(join(crn,'residue-templates.json'),JSON.stringify(templates,null,2)+'\n');
// Original irregular C-shaped catalytic channel, never labeled as a deposited polymerase.
const channelSites=[];for(let i=0;i<32;i++){const a=.85+i/31*4.6;for(let j=0;j<3;j++){const radius=2.2+.35*Math.sin(i*.7),z=(j-1)*.35+.25*Math.sin(i*.4)-.7;channelSites.push([Math.cos(a)*radius*1.35,Math.sin(a)*radius*.95,z]);}}
const shell=createMolecularEnvelope({positions:channelSites.flat(),sigma:.65,isoLevel:.95,resolution:31,smoothingIterations:3});
const shellModel={id:'illustrative-polymerase-channel',kind:'model',version:1,units:'schematic local units',parts:[part('channel',shell)],provenance:{source:'Original procedural C-shaped channel in prepare-biological-assets.mjs',sourceHash:sha(JSON.stringify(channelSites)),creator:'Original animlib biological proof',license:'CC0-1.0',preparedAt:'2026-10-11',converter:{name:'animlib Gaussian envelope',version:'1',options:{sigma:.65,isoLevel:.95,resolution:31,smoothingIterations:3}},selection:'All96 original scaffold sites',modifications:['Gaussian union of three irregular arcs; open side and central channel retained.'],fidelity:'Illustrative catalytic machinery, not a molecular structure of RNA polymerase. No atomic or source-image fidelity claimed.'}};
await mkdir(join(root,'polymerase-channel'),{recursive:true});await writeAssetPackages({images:[],model:shellModel,report:{sites:channelSites}},join(root,'polymerase-channel'));
await writeFile(join(crn,'preparation-report.json'),JSON.stringify({atoms:structure.atoms.length,residues:structure.residues.length,bonds:structure.bonds.length,bondProvenance:Object.fromEntries(['CONECT','template','peptide-rule'].map(k=>[k,structure.bonds.filter(b=>b.sources.some(s=>s.kind===k)).length])),segments:structure.segments.length,models:measurements,shell:{vertices:shell.vertices.length,triangles:shell.triangles.length}},null,2)+'\n');
console.log(JSON.stringify({atoms:structure.atoms.length,residues:structure.residues.length,bonds:structure.bonds.length,models:measurements}));

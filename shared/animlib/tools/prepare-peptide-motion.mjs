/** Original illustrative peptide; pinned CCD components, deterministic authored torsion search. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {createPeptideBuilders} from '../dist/peptide-motion.js';
import {createMolecularEnvelope} from '../dist/molecular-envelope.js';
import {writeAssetPackages} from './write-asset-packages.mjs';
const root=resolve('shared/animlib/fixtures/biological'),sourceRoot=join(root,'1crn'),output=join(root,'illustrative-peptide');
await mkdir(output,{recursive:true});
const lock=JSON.parse(await readFile(join(sourceRoot,'source-lock.json'),'utf8')),edges=JSON.parse(await readFile(join(sourceRoot,'residue-templates.json'),'utf8')),sha=v=>createHash('sha256').update(v).digest('hex'),components={},sourceHashes={};
for(const name of ['ALA','SER','VAL']){
  const file=name+'.cif',bytes=await readFile(join(sourceRoot,'source',file));if(sha(bytes)!==lock[file])throw Error('Pinned CCD changed');sourceHashes[file]=lock[file];
  const lines=bytes.toString('utf8').split(/\r?\n/),start=lines.findIndex(l=>l.trim()==='_chem_comp_atom.comp_id'),columns=[];let i=start;
  if(i<0)throw Error('Missing CCD atom loop');while(lines[i]?.trim().startsWith('_chem_comp_atom.'))columns.push(lines[i++].trim().slice('_chem_comp_atom.'.length));
  const atoms=[];while(lines[i]&&!lines[i].trim().startsWith('#')){
    const row=lines[i++].trim().split(/\s+/);if(row.length!==columns.length||row.some(v=>/['";]/.test(v)))throw Error('Unsupported pinned CCD atom syntax');
    const get=k=>row[columns.indexOf(k)];if(get('type_symbol')==='H'||get('pdbx_leaving_atom_flag')==='Y')continue;
    const position=['x','y','z'].map(k=>Number(get('pdbx_model_Cartn_'+k+'_ideal')));if(position.some(n=>!Number.isFinite(n)))throw Error('Missing ideal atom coordinates');atoms.push({name:get('atom_id'),position});
  }
  const names=new Set(atoms.map(a=>a.name));components[name]={atoms,bonds:edges[name].bonds.filter(b=>names.has(b.a)&&names.has(b.b)).map(b=>[b.a,b.b])};
}
const n=72,rad=x=>x*Math.PI/180,spec={residues:Array.from({length:n},(_,i)=>({id:'illustrative-'+i,component:i%4===0?'VAL':i%4===2?'SER':'ALA'})),components,peptideLength:1.33,angleCA_C_N:rad(116),angleC_N_CA:rad(121)};
const api=createPeptideBuilders(),helical=i=>i%20<12,coil={phi:Array(n).fill(rad(-60)),psi:Array(n).fill(rad(-45))};
for(let i=0;i<n;i++)if(!helical(i)){coil.phi[i]=rad(-135);coil.psi[i]=rad(135);}
const extended={phi:Array(n).fill(rad(-135)),psi:Array(n).fill(rad(135))},variables=Array.from({length:n},(_,i)=>i).filter(i=>!helical(i)).flatMap(i=>[['phi',i],['psi',i]]);
const geometry=angles=>api.peptidePose(spec,angles.phi,angles.psi);
const score=angles=>{const p=geometry(angles),a=p.anchors.map(a=>a.position);let radius=0,clashes=0;for(const x of a)radius+=x.reduce((s,v,k)=>s+(v-p.center[k])**2,0)/n;for(let i=0;i<n;i++)for(let j=i+4;j<n;j++){const d=Math.hypot(...a[i].map((v,k)=>v-a[j][k]));if(d<4)clashes+=(4-d)**2;}return radius+clashes*15;};
let state=741103,nextRandom=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;},current=structuredClone(coil),cost=score(current),best=structuredClone(current),bestCost=cost;
const iterations=6000;
for(let step=0;step<iterations;step++){
  const proposal=structuredClone(current),[key,index]=variables[Math.floor(nextRandom()*variables.length)],temperature=4*(1-step/iterations)+.05;
  proposal[key][index]+= (nextRandom()-.5)*(.9*(1-step/iterations)+.08);proposal[key][index]=Math.atan2(Math.sin(proposal[key][index]),Math.cos(proposal[key][index]));
  const value=score(proposal);if(value<cost||nextRandom()<Math.exp((cost-value)/temperature)){current=proposal;cost=value;}
  if(value<bestCost){best=proposal;bestCost=value;}
}
const final=geometry(best),start=geometry(extended),middle=geometry(coil),rg=p=>Math.sqrt(p.anchors.reduce((s,a)=>s+a.position.reduce((v,x,k)=>v+(x-p.center[k])**2,0),0)/n);
const source={spec,extended,coil,compact:best,sourceHashes,provenance:'Original idealized 72-residue ALA/SER/VAL peptide with prescribed torsions. Pinned CCD ideal component coordinates; carbonyl oxygen follows peptide plane. No deposited fold or physical folding trajectory.'};
await writeFile(join(output,'rig.json'),JSON.stringify(source,null,2)+'\n');await writeFile(join(output,'endpoint.json'),JSON.stringify(final,null,2)+'\n');
const envelope=createMolecularEnvelope({positions:final.atoms.flatMap(a=>a.position),origin:final.center,sigma:1.2,isoLevel:1.05,resolution:31,smoothingIterations:2}),groups=new Map(),surfaceResidues=[];
for(const triangle of envelope.triangles){const center=[0,1,2].map(k=>triangle.reduce((s,v)=>s+envelope.vertices[v][k],0)/3+final.center[k]);let nearest=final.atoms[0],distance=Infinity;for(const a of final.atoms){const d=a.position.reduce((s,v,k)=>s+(v-center[k])**2,0);if(d<distance){distance=d;nearest=a;}}surfaceResidues.push(nearest.residueId);const band=Math.min(6,Math.floor(nearest.value*7)),part=groups.get(band)??{id:'band-'+band,vertices:[],triangles:[],normals:[],map:new Map()};
  part.triangles.push(triangle.map(v=>{if(!part.map.has(v)){part.map.set(v,part.vertices.length);part.vertices.push(envelope.vertices[v]);part.normals.push(envelope.normals[v]);}return part.map.get(v);}));groups.set(band,part);
}
await writeFile(join(output,'surface-residue-ids.json'),JSON.stringify(surfaceResidues));
const report={residues:n,atoms:final.atoms.length,bonds:final.bonds.length,templateBytes:JSON.stringify(spec).length,poseBytes:JSON.stringify(final).length,radiusOfGyration:{extended:rg(start),localCoils:rg(middle),compact:rg(final)},search:{seed:741103,iterations,score:bestCost},sourceHashes};
await writeAssetPackages({images:[],model:{id:'illustrative-peptide-surface',kind:'model',version:1,units:'angstrom',parts:[...groups.values()].map(({map,...p})=>p),provenance:{source:'Original idealized peptide with pinned wwPDB CCD ALA/SER/VAL ideal components',sourceHash:sha(JSON.stringify(source)),creator:'Original animlib motion proof; wwPDB Chemical Component Dictionary',license:'CC0-1.0',preparedAt:'2026-10-11',converter:{name:'prepare-peptide-motion',version:'1',options:{sourceHashes,origin:final.center,sigma:1.2,isoLevel:1.05,resolution:31,smoothingIterations:2}},selection:'All original peptide heavy atoms; no deposited protein structure',modifications:['Prescribed internal-coordinate torsions and deterministic compact-loop search','Surface Gaussian envelope from exact final peptidePose coordinates'],fidelity:'Illustrative folding and surface; not a physical trajectory, deposited conformation or solvent-excluded surface'}},report},output);
console.log(JSON.stringify(report,null,2));

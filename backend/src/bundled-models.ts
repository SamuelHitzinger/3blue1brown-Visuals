import { fileURLToPath } from 'node:url';
import { open } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import {resolve} from 'node:path';
import {PreparedArtifactStore} from './prepared-artifacts.js';
import { createModelGLB } from 'animlib/core';
import type { AssetProvenance, MolecularStructure, PreparedModelInput, Vec3 } from 'animlib/core';
import { loadModelPackage } from '../../shared/animlib/tools/load-assets.mjs';

// These IDs are capabilities, never caller-supplied filesystem paths.
const fixtures = {
  '1crn-surface': 'Crambin: schematic envelope around deposited heavy-atom coordinates',
  '1crn-sticks': 'Crambin: deposited heavy-atom bond geometry colored by endpoint element; single cylinders do not encode bond order',
  '1crn-beads': 'Crambin: one bead per residue CA anchor, with residue adjacency guides; not individual atoms',
} as const;
type FixtureId = keyof typeof fixtures;
export interface MolecularLandmark {
  role: 'representative' | 'central-residue' | 'first-residue' | 'last-residue' | 'base' | 'sugar' | 'phosphate';
  atomId: string;
  residueId: string;
  serial: number;
  atomName: string;
  residueName: string;
  authorSequence: number;
  insertionCode: string;
  /** Model-local angstrom coordinates, with BundledModelContext.origin already subtracted. */
  position: Vec3;
  parts: string[];
}
export interface BundledModelContext {
  fixtureId: string;
  representation: string;
  units: string;
  /** The same translation was subtracted from all three coordinate representations. */
  origin: Vec3;
  partMeaning: string;
  colorMeaning: string;
  provenance: AssetProvenance;
  molecular?: {accession:string;title:string;landmarkFrame?:string;chains:{id:string;molecule:string;residues:number;atoms:number;parts:string[];authorRanges:string[];gapCount:number;gaps:{before:string;reason:string}[];landmarks?:MolecularLandmark[]}[]};
}
type CompactProvenance = Pick<AssetProvenance, 'source'|'sourceHash'|'creator'|'license'|'selection'|'fidelity'>;
export type BundledModelDescription = Omit<BundledModelContext, 'provenance'> & { provenance: CompactProvenance };

export function describeBundledModel(context: BundledModelContext): BundledModelDescription {
  const {source,sourceHash,creator,license,selection,fidelity}=context.provenance;
  return {...context,provenance:{source,sourceHash,creator,license,selection,fidelity}};
}

const models = new Map<FixtureId, Promise<PreparedModelInput>>();
function load(fixtureId: string): Promise<PreparedModelInput> {
  if (!Object.hasOwn(fixtures,fixtureId)) throw new Error('Unknown bundled model fixtureId');
  const id=fixtureId as FixtureId;
  let pending=models.get(id);
  if(!pending){
    const manifest=fileURLToPath(new URL(`../../shared/animlib/fixtures/biological/1crn/${id}/${id}.json`,import.meta.url));
    pending=loadModelPackage(manifest).then(model=>{
      if(model.kind!=='model'||model.id!==id)throw new Error('Bundled model identity mismatch');
      return model;
    });
    models.set(id,pending);
    void pending.catch(()=>models.delete(id));
  }
  return pending;
}
function context(model: PreparedModelInput): BundledModelContext {
  const origin=model.provenance.converter.options.origin;
  if(!Array.isArray(origin)||origin.length!==3||!origin.every(Number.isFinite))throw new Error('Bundled model has no common coordinate origin');
  const atomic=model.id==='1crn-sticks',provenance=structuredClone(model.provenance);
  provenance.modifications=provenance.modifications.filter(item=>item!=='Color by persistent residue identity, not element.');
  provenance.modifications.push(atomic
    ? 'Published half-bonds are colored by recorded endpoint element: C grey, N blue, O red, S yellow. Coordinates, topology and normals are unchanged.'
    : 'Published GLB uses neutral representation color; residue highlighting does not indicate atom elements.');
  if(atomic)provenance.converter.options.publicationColoring={convention:'CPK element colors',source:'https://www.rcsb.org/docs/general-help/glossary',structureHash:structureHash,encoding:'linear RGBA vertex COLOR_0',mapping:'recorded atom ID for each prepared half-bond; ring centers and topology checked'};
  return {fixtureId:model.id as FixtureId,representation:fixtures[model.id as FixtureId],units:model.units,origin:[...origin] as Vec3,
    partMeaning:'residue-N is index N in the deposited chain A residue sequence; surface has 45 exposed residue parts, other views have 46. All views share one coordinate origin. Static representations do not describe folding dynamics or enzyme binding.',
    colorMeaning:atomic?'CPK element identity: C grey, N blue, O red, S yellow. Default to omitted/WHITE tint; a subtle molecule tint must preserve these element identities. Role colors must not replace element colors. Hydrogens are excluded.':'Neutral schematic representation color, not atom-element colors. CA beads represent residues; the surface is an envelope.',
    provenance};
}

// Canonical JSON digest permits checkout newline differences without trusting edited atom data.
const structureHash='a5ccb3b7356bdcac54bc9ad69d38dc6f0c2d0716d18142a99dd60f74c6c8a607';
let atomicStructure:Promise<MolecularStructure>|undefined;
function structure():Promise<MolecularStructure> {
  return atomicStructure??=(async()=>{
    const file=await open(new URL('../../shared/animlib/fixtures/biological/1crn/structure.json',import.meta.url),'r');
    try{
      const info=await file.stat();
      if(!info.isFile()||info.size>1024*1024)throw new Error('Bundled atom structure exceeds its byte limit');
      const bytes=Buffer.alloc(info.size);let position=0;
      while(position<bytes.length){const read=await file.read(bytes,position,bytes.length-position,position);if(!read.bytesRead)throw new Error('Bundled atom structure short read');position+=read.bytesRead;}
      if((await file.read(Buffer.alloc(1),0,1,bytes.length)).bytesRead)throw new Error('Bundled atom structure grew during read');
      const result=JSON.parse(bytes.toString('utf8')) as MolecularStructure;
      if(createHash('sha256').update(JSON.stringify(result)).digest('hex')!==structureHash)throw new Error('Bundled atom structure hash mismatch');
      return result;
    }finally{await file.close();}
  })();
}
// Linear RGBA. Carbon is neutral grey; the other retained elements use conventional hues.
const elementColors:Record<string,[number,number,number,number]>={C:[0.5,0.5,0.5,1],N:[0,0,1,1],O:[1,0,0,1],S:[1,1,0,1]};
async function stickColors(model:PreparedModelInput):Promise<[number,number,number,number][][]> {
  const data=await structure(),atoms=new Map(data.atoms.map(atom=>[atom.id,atom]));
  return model.parts.map((part,index)=>{
    const residue=data.residues[index],colors:[number,number,number,number][]=[];
    if(part.id!==`residue-${index}`||!residue)throw new Error('Bundled stick residue mapping changed');
    // The pinned preparation writes each atom-to-midpoint half-bond as two eight-vertex rings.
    for(const edge of data.bonds)for(const endpoint of [edge.a,edge.b]){
      const atom=atoms.get(endpoint)!,other=atoms.get(endpoint===edge.a?edge.b:edge.a)!;
      if(atom.residueId!==residue.id)continue;
      const color=elementColors[atom.element];if(!color)throw new Error('Unsupported bundled atom element');
      const offset=colors.length,midpoint=atom.position.map((v,axis)=>(v+other.position[axis])/2);
      for(const [ring,target] of [[offset,atom.position],[offset+8,midpoint]] as [number,number[]][]){
        const vertices=part.vertices.slice(ring,ring+8);
        if(vertices.length!==8||[0,1,2].some(axis=>Math.abs(vertices.reduce((sum,v)=>sum+v[axis],0)/8-(target[axis]-data.center[axis]))>2e-5))throw new Error('Bundled stick endpoint geometry changed');
      }
      const faces=part.triangles.slice(offset,offset+16);
      if(faces.length!==16||faces.some(face=>face.some(v=>v<offset||v>=offset+16)))throw new Error('Bundled stick half-bond topology changed');
      for(let vertex=0;vertex<16;vertex++)colors.push([...color]);
    }
    if(colors.length!==part.vertices.length||part.triangles.length!==colors.length)throw new Error('Bundled stick atom mapping incomplete');
    return colors;
  });
}

/** Small descriptive inventory only: no mesh arrays are put in agent context. */
export async function bundledModelCatalog(): Promise<BundledModelDescription[]> {
  return Promise.all(Object.keys(fixtures).map(async id=>describeBundledModel(context(await load(id)))));
}

const contentIdentities=new WeakMap<PreparedModelInput,string>();
export const BUNDLED_PUBLICATION_VERSION='bundled-glb-v1-element-colors';
/** The canonical prepared store verifies bytes/context on disk; job publication remains separate. */
export function createBundledModelPreparer({directory}:{directory:string}) {
  const store=new PreparedArtifactStore({directory,maxArtifactBytes:32*1024*1024,maxContextBytes:2*1024*1024,maxMemoryBytes:64*1024*1024});
  let conversions=0;
  return {
    stats:()=>({conversions}),
    async prepare(fixtureId:string,signal?:AbortSignal):Promise<{bytes:Uint8Array;context:BundledModelContext}>{
      signal?.throwIfAborted();const model=await load(fixtureId);signal?.throwIfAborted();
      let contentHash=contentIdentities.get(model);
      if(!contentHash){contentHash=createHash('sha256').update(JSON.stringify(model)).digest('hex');contentIdentities.set(model,contentHash);}
      return store.prepare('bundled-model',BUNDLED_PUBLICATION_VERSION,{fixtureId,contentHash,structureHash,elementColors},async()=>{
        conversions++;
        const colors=fixtureId==='1crn-sticks'?await stickColors(model):undefined;
        const bytes=await createModelGLB({parts:model.parts.map((part,index)=>({name:part.id,vertices:part.vertices,triangles:part.triangles,normals:part.normals,vertexColors:colors?.[index],roughness:0.65}))});
        return {bytes,context:context(model)};
      },signal);
    },
  };
}
let preparer:ReturnType<typeof createBundledModelPreparer>|undefined;
let preparationRoot='';
/** Preserve prepared geometry and named parts through the existing GLB delivery path. */
export async function prepareBundledModel(fixtureId:string,signal?:AbortSignal):Promise<{bytes:Uint8Array;context:BundledModelContext}>{
  const directory=resolve(process.env.BUNDLED_MODEL_CACHE_DIR??'data/prepared-bundled');
  if(!preparer||preparationRoot!==directory){preparationRoot=directory;preparer=createBundledModelPreparer({directory});}
  return preparer.prepare(fixtureId,signal);
}

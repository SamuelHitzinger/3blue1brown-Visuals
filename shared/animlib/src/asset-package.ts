import type { AssetBlobRef, ModelPackage, PreparedModelInput } from './asset-types.js';
import type { Vec3 } from './types.js';
import { ASSET_LIMITS, assetCheck, assetHash, assetId, assetKeys, hashAssetBytes, hashAssetContent, validateAssetProvenance, validatePreparedModel } from './asset-validation.js';

/** A host reader must enforce real-path containment and byteLength before reading. */
export type AssetBlobReader = (relativePath: string, byteLength: number) => Promise<Uint8Array<ArrayBuffer>>;
export function validateAssetPath(path: string): void {
  assetCheck(typeof path === 'string' && path.length <= 256 && /^[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*$/.test(path)
    && path.split('/').every(p=>p!=='.'&&p!=='..'), 'package path escapes root or is unsupported');
}
/** Decode only native v1 float32 XYZ/uint32 triangles; no source-format guessing. */
export async function decodeModelPackage(input: ModelPackage, read: AssetBlobReader): Promise<PreparedModelInput> {
  assetCheck(input && input.kind==='model' && input.version===1, 'unsupported package kind/version');
  assetKeys(input,['kind','version','id','hash','units','provenance','parts']);
  assetId(input.id); assetHash(input.hash); validateAssetProvenance(input);
  assetCheck(Array.isArray(input.parts)&&input.parts.length>0&&input.parts.length<=ASSET_LIMITS.parts,'package part limit exceeded');
  let bytes=0; const ids=new Set<string>();
  const blob=(ref:AssetBlobRef,expected:number)=> {
    assetCheck(ref && typeof ref==='object','missing blob'); assetKeys(ref,['path','hash','byteLength']);
    validateAssetPath(ref.path); assetHash(ref.hash);
    assetCheck(Number.isSafeInteger(ref.byteLength)&&ref.byteLength===expected,'blob declared byte length mismatch');
    bytes+=expected; assetCheck(bytes<=ASSET_LIMITS.modelBytes,'package memory limit exceeded');
  };
  for(const part of input.parts) {
    assetKeys(part,['id','vertexCount','triangleCount','positions','indices','normals']);
    assetId(part.id); assetCheck(!ids.has(part.id),'duplicate package part ID'); ids.add(part.id);
    assetCheck(Number.isInteger(part.vertexCount)&&part.vertexCount>0&&part.vertexCount<=ASSET_LIMITS.vertices,'package vertex count limit exceeded');
    assetCheck(Number.isInteger(part.triangleCount)&&part.triangleCount>0&&part.triangleCount<=ASSET_LIMITS.triangles,'package triangle count limit exceeded');
    blob(part.positions,part.vertexCount*12); blob(part.indices,part.triangleCount*12);
    if(part.normals) blob(part.normals,part.vertexCount*12);
  }
  // Snapshot before the first await: caller cannot swap hashes or paths mid-load.
  const manifest=structuredClone(input), {hash,...content}=manifest;
  assetCheck(await hashAssetContent(content)===hash,'manifest content hash mismatch');
  const decode=async(ref:AssetBlobRef,float:boolean):Promise<Vec3[]>=> {
    const bytes=await read(ref.path,ref.byteLength);
    assetCheck(bytes instanceof Uint8Array && bytes.byteLength===ref.byteLength,'blob exact byte length mismatch');
    const owned=new Uint8Array(bytes); assetCheck(await hashAssetBytes(owned)===ref.hash,'blob content hash mismatch');
    const view=new DataView(owned.buffer), result:Vec3[]=[];
    for(let i=0;i<owned.length;i+=12) result.push([0,4,8].map(offset=>float?view.getFloat32(i+offset,true):view.getUint32(i+offset,true)) as Vec3);
    return result;
  };
  const parts:PreparedModelInput['parts']=[];
  for(const part of manifest.parts) parts.push({id:part.id, vertices:await decode(part.positions,true),triangles:await decode(part.indices,false),
    ...(part.normals?{normals:await decode(part.normals,true)}:{})});
  const model:PreparedModelInput={id:manifest.id,kind:'model',version:1,units:manifest.units,provenance:manifest.provenance,parts};
  return validatePreparedModel(model).model;
}

/** Reproducible, explicit geometry-only derivative of one pinned CC0 model.
 * This is not a general glTF converter. The source's texture/PBR appearance is
 * deliberately omitted for the first static-model registry proof.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { hashAssetContent } from '../dist/asset-validation.js';
import { loadModelPackage } from './load-assets.mjs';

const root=resolve(process.argv[2]??'fixtures/suzanne');
const source=await readFile(join(root,'source/Suzanne.gltf')), binary=await readFile(join(root,'source/Suzanne.bin'));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
if(sha(source)!=='7e8ae013010aff530162ef2795cec74c2646019e224af17bcfb691664f0f0aec' || sha(binary)!=='b85c2727aa41318e00673d8892f5879d46fb6e476e280f28ee1febd07602b6b8') throw new Error('Pinned source hash mismatch');
const gltf=JSON.parse(source), primitive=gltf.meshes[0].primitives[0];
if(gltf.nodes.length!==1 || Object.keys(gltf.nodes[0]).some(k=>!['mesh','name'].includes(k)) || primitive.mode!==4) throw new Error('Unexpected source hierarchy');
const packed=(index,type,count)=> {
  const a=gltf.accessors[index], view=gltf.bufferViews[a.bufferView];
  if(a.type!==type||a.count!==count||view.byteStride||a.sparse) throw new Error('Unexpected pinned accessor');
  return binary.subarray((view.byteOffset??0)+(a.byteOffset??0),(view.byteOffset??0)+(a.byteOffset??0)+view.byteLength);
};
const positions=packed(primitive.attributes.POSITION,'VEC3',11808), normals=packed(primitive.attributes.NORMAL,'VEC3',11808);
const sourceIndices=packed(primitive.indices,'SCALAR',11808), indices=Buffer.alloc(11808*4);
for(let i=0;i<11808;i++) indices.writeUInt32LE(sourceIndices.readUInt16LE(i*2),i*4);
await mkdir(join(root,'blobs'),{recursive:true});
const blob=async bytes=> {const hash=sha(bytes),path=`blobs/${hash}.bin`;await writeFile(join(root,path),bytes);return {path,hash,byteLength:bytes.length};};
const manifest={id:'suzanne-geometry',kind:'model',version:1,units:'metre (glTF 2.0 coordinate convention)',
  provenance:{source:'https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/Suzanne',sourceHash:sha(Buffer.concat([source,binary])),
    creator:'UX3D / Norbert Nopper (2017); Blender Suzanne source model',license:'CC0-1.0',preparedAt:'2026-10-11',
    converter:{name:'animlib prepare-suzanne-geometry',version:'1',options:{sourceJSONHash:sha(source),sourceBinaryHash:sha(binary),geometryOnly:true,axisConversion:'identity',scale:1,recenter:[0,0,0]}},
    selection:'scene 0 / node Suzanne / mesh Suzanne / primitive 0',
    modifications:['Explicit geometry-only derivative: UV0 and tangents omitted.','Source base-color and metallic-roughness textures/material omitted; scene-authored palette fill and stylized lighting replace appearance.','Uint16 source indices widened losslessly to Uint32; positions and normals copied byte-for-byte.'],
    fidelity:'All 11808 source vertex tuples and 3936 triangles retained. No coordinate transform, welding, decimation or smoothing. Source appearance fidelity is not claimed.'},
  parts:[{id:'body',vertexCount:11808,triangleCount:3936,positions:await blob(positions),normals:await blob(normals),indices:await blob(indices)}]};
manifest.hash=await hashAssetContent(manifest);
await writeFile(join(root,'asset.json'),JSON.stringify(manifest,null,2)+'\n');
const model=await loadModelPackage(join(root,'asset.json'));
console.log(JSON.stringify({manifest:join(root,'asset.json'),vertices:model.parts[0].vertices.length,triangles:model.parts[0].triangles.length,hash:manifest.hash}));

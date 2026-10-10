import {expect,it} from 'vitest';
import {importStaticGLTF,parseGLB} from '../tools/gltf-import.mjs';

const provenance={source:'https://example.org/triangle.gltf',sourceHash:'a'.repeat(64),creator:'fixture',license:'CC0-1.0',preparedAt:'2026-10-11',converter:{name:'fixture',version:'1',options:{}},selection:'scene 0',modifications:[],fidelity:'test'};
function fixture():any {
 const bytes=Buffer.alloc(78);new Float32Array(bytes.buffer,bytes.byteOffset,18).set([0,0,0,1,0,0,0,1,0,0,0,1,0,0,1,0,0,1]);bytes.writeUInt16LE(0,72);bytes.writeUInt16LE(1,74);bytes.writeUInt16LE(2,76);
 const json:any={asset:{version:'2.0'},scene:0,scenes:[{nodes:[0]}],nodes:[{mesh:0}],meshes:[{primitives:[{attributes:{POSITION:0,NORMAL:1},indices:2,mode:4}]}],buffers:[{uri:'mesh.bin',byteLength:78}],bufferViews:[{buffer:0,byteOffset:0,byteLength:36},{buffer:0,byteOffset:36,byteLength:36},{buffer:0,byteOffset:72,byteLength:6}],accessors:[{bufferView:0,componentType:5126,count:3,type:'VEC3'},{bufferView:1,componentType:5126,count:3,type:'VEC3'},{bufferView:2,componentType:5123,count:3,type:'SCALAR'}]};
 return {json,bytes,options:{id:'triangle',provenance,read:async (uri:string)=>{if(uri!=='mesh.bin')throw Error('missing');return bytes;}}};
}
it('imports static triangles and inverse-transpose normals with reflected winding',async()=>{
 const f=fixture();f.json.nodes[0].scale=[-2,3,1];f.json.nodes[0].translation=[1,0,0];
 const result=await importStaticGLTF(f.json,f.options);
 expect(result.model.parts[0].vertices).toEqual([[1,0,0],[-1,0,0],[1,3,0]]);
 expect(result.model.parts[0].triangles).toEqual([[0,2,1]]);
 expect(result.model.parts[0].normals).toEqual([[0,0,1],[0,0,1],[0,0,1]]);
});
it.each(['offset','stride','sparse','index','nonfinite','skin','animation','morph','mode','extension','cycle','units'])('rejects unsupported/malformed %s',async kind=>{
 const f=fixture();
 if(kind==='offset')f.json.accessors[0].byteOffset=65536;
 if(kind==='stride')f.json.bufferViews[0].byteStride=8;
 if(kind==='sparse')f.json.accessors[0].sparse={count:1};
 if(kind==='index')f.bytes.writeUInt16LE(99,76);
 if(kind==='nonfinite')f.bytes.writeFloatLE(NaN,0);
 if(kind==='skin')f.json.nodes[0].skin=0;
 if(kind==='animation')f.json.animations=[{}];
 if(kind==='morph')f.json.meshes[0].primitives[0].targets=[{}];
 if(kind==='mode')f.json.meshes[0].primitives[0].mode=1;
 if(kind==='extension')f.json.extensionsRequired=['UNKNOWN'];
 if(kind==='cycle')f.json.nodes[0].children=[0];
 if(kind==='units')f.options.provenance={...provenance,license:''};
 await expect(importStaticGLTF(f.json,f.options)).rejects.toThrow();
});
it('rejects external URI escapes before requesting dependency bytes',async()=>{
 const f=fixture();f.json.buffers[0].uri='../mesh.bin';let reads=0;f.options.read=async()=>{reads++;return f.bytes;};
 await expect(importStaticGLTF(f.json,f.options)).rejects.toThrow(/path|URI/i);expect(reads).toBe(0);
});
it('validates GLB lengths/chunks and exposes its single binary chunk',()=>{
 const json:any=Buffer.from('{"asset":{"version":"2.0"}}   '),padded=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]),b=Buffer.alloc(12+8+padded.length+8+4);
 b.writeUInt32LE(0x46546c67,0);b.writeUInt32LE(2,4);b.writeUInt32LE(b.length,8);b.writeUInt32LE(padded.length,12);b.writeUInt32LE(0x4e4f534a,16);padded.copy(b,20);b.writeUInt32LE(4,20+padded.length);b.writeUInt32LE(0x004e4942,24+padded.length);
 expect(parseGLB(b).binary!.length).toBe(4);expect(parseGLB(b).json.asset.version).toBe('2.0');
 b.writeUInt32LE(b.length+4,8);expect(()=>parseGLB(b)).toThrow(/length/i);
});


function texturedFixture():any {
 const f=fixture(),uv=Buffer.from([0,0,255,0,0,255]);f.bytes=Buffer.concat([f.bytes,uv]);f.json.buffers[0].byteLength=f.bytes.length;
 f.json.bufferViews.push({buffer:0,byteOffset:78,byteLength:6});f.json.accessors.push({bufferView:3,componentType:5121,count:3,type:'VEC2',normalized:true});
 f.json.meshes[0].primitives[0].attributes.TEXCOORD_0=3;f.json.meshes[0].primitives[0].material=0;
 f.json.materials=[{doubleSided:true,extensions:{KHR_materials_unlit:{}},pbrMetallicRoughness:{baseColorTexture:{index:0}}}];
 f.json.textures=[{source:0}];f.json.images=[{uri:'color.png',mimeType:'image/png'}];
 f.options.read=async(uri:string)=>uri==='mesh.bin'?f.bytes:new Uint8Array([1,2,3]);
 f.options.decodeImage=async()=>({width:2,height:1,pixels:new Uint8Array([17,91,203,255,231,41,127,0])});
 f.options.imageIdentity=async()=> 'b'.repeat(64);return f;
}
it('keeps paired source UVs, RGB including transparent RGB, and top-left image rows',async()=>{
 const f=texturedFixture();const out=await importStaticGLTF(f.json,f.options);
 expect(out.model.parts[0].uv0).toEqual([[0,0],[1,0],[0,1]]);
 expect([...out.images[0].pixels]).toEqual([17,91,203,255,231,41,127,0]);
 expect(out.images[0].origin).toBe('top-left');expect(out.model.parts[0].imageTexture).toEqual({image:{id:'triangle-image-0',hash:'b'.repeat(64)},alphaMode:'opaque',filter:'linear',wrap:'repeat'});
 expect(out.report.dependencies).toHaveLength(2);expect(out.report.omitted).toEqual([]);
});
it.each(['culling','pbr','factor','mask','mipmap','wrap','texcoord','dimensions','decoded-length','missing-uv'])('rejects unsupported image/material %s',async kind=>{
 const f=texturedFixture(),m=f.json.materials[0];
 if(kind==='culling')m.doubleSided=false;
 if(kind==='pbr')delete m.extensions;
 if(kind==='factor')m.pbrMetallicRoughness.baseColorFactor=[1,.5,1,1];
 if(kind==='mask')m.alphaMode='MASK';
 if(kind==='mipmap'){f.json.textures[0].sampler=0;f.json.samplers=[{minFilter:9987}];}
 if(kind==='wrap'){f.json.textures[0].sampler=0;f.json.samplers=[{wrapS:33071,wrapT:10497}];}
 if(kind==='texcoord')m.pbrMetallicRoughness.baseColorTexture.texCoord=1;
 if(kind==='dimensions')f.options.decodeImage=async()=>({width:4097,height:1,pixels:new Uint8Array(4097*4)});
 if(kind==='decoded-length')f.options.decodeImage=async()=>({width:2,height:1,pixels:new Uint8Array(4)});
 if(kind==='missing-uv')delete f.json.meshes[0].primitives[0].attributes.TEXCOORD_0;
 await expect(importStaticGLTF(f.json,f.options)).rejects.toThrow();
});
it('records explicit derivative omissions instead of silently accepting PBR or culling',async()=>{
 const f=texturedFixture();delete f.json.materials[0].extensions;delete f.json.materials[0].doubleSided;f.options.materialPolicy='base-color-only';
 const out=await importStaticGLTF(f.json,f.options);expect(out.report.omitted).toEqual(['back-face culling','metallic-roughness and PBR lighting']);expect(out.model.provenance.fidelity).toContain('prevent PBR equivalence');
});
it('supports checked interleaved positions and normals',async()=>{
 const f=fixture(),bytes=Buffer.alloc(78);
 for(let i=0;i<3;i++){f.bytes.copy(bytes,i*24,i*12,i*12+12);f.bytes.copy(bytes,i*24+12,36+i*12,48+i*12);}f.bytes.copy(bytes,72,72);
 f.bytes=bytes;f.options.read=async()=>bytes;f.json.bufferViews[0]={buffer:0,byteLength:72,byteStride:24};f.json.accessors[1]={...f.json.accessors[1],bufferView:0,byteOffset:12};
 const out=await importStaticGLTF(f.json,f.options);expect(out.model.parts[0].vertices).toEqual([[0,0,0],[1,0,0],[0,1,0]]);expect(out.model.parts[0].normals).toEqual([[0,0,1],[0,0,1],[0,0,1]]);
});
it('snapshots provenance before asynchronous reads and stores native Float32 transforms',async()=>{
 const f=fixture();f.options.provenance=structuredClone(provenance);f.json.nodes[0].translation=[.1,0,0];f.options.read=async()=>{f.options.provenance.license='changed';return f.bytes;};
 const out=await importStaticGLTF(f.json,f.options);expect(out.model.provenance.license).toBe('CC0-1.0');expect(out.model.parts[0].vertices[0][0]).toBe(Math.fround(.1));
});
it.each(['singular','projective','quaternion','count','buffer-budget'])('rejects unsupported transform/budget %s',async kind=>{
 const f=fixture();if(kind==='singular')f.json.nodes[0].scale=[0,1,1];if(kind==='projective')f.json.nodes[0].matrix=[1,0,0,.1,0,1,0,0,0,0,1,0,0,0,0,1];if(kind==='quaternion')f.json.nodes[0].rotation=[1,1,1,1];if(kind==='count')f.json.accessors[0].count=20001;if(kind==='buffer-budget')f.json.buffers[0].byteLength=64*1024*1024+1;
 await expect(importStaticGLTF(f.json,f.options)).rejects.toThrow();
});
it('imports GLB embedded geometry and checks the padding bytes',async()=>{
 const f=fixture();delete f.json.buffers[0].uri;const json=Buffer.from(JSON.stringify(f.json)),padded=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]),bin=Buffer.concat([f.bytes,Buffer.alloc(2)]),b=Buffer.alloc(28+padded.length+bin.length);
 b.writeUInt32LE(0x46546c67,0);b.writeUInt32LE(2,4);b.writeUInt32LE(b.length,8);b.writeUInt32LE(padded.length,12);b.writeUInt32LE(0x4e4f534a,16);padded.copy(b,20);b.writeUInt32LE(bin.length,20+padded.length);b.writeUInt32LE(0x004e4942,24+padded.length);bin.copy(b,28+padded.length);
 const parsed=parseGLB(b),out=await importStaticGLTF(parsed.json,{...f.options,binary:parsed.binary,read:async()=>{throw Error('no external read expected');}});expect(out.model.parts[0].triangles).toEqual([[0,1,2]]);
 b[b.length-1]=1;const invalid=parseGLB(b);await expect(importStaticGLTF(invalid.json,{...f.options,binary:invalid.binary})).rejects.toThrow(/padding/);
});
it('does not weld equal position tuples carrying distinct UV seam coordinates',async()=>{
 const f=texturedFixture();f.bytes.writeFloatLE(0,12);const out=await importStaticGLTF(f.json,f.options);expect(out.model.parts[0].vertices).toHaveLength(3);expect(out.model.parts[0].vertices[0]).toEqual(out.model.parts[0].vertices[1]);expect(out.model.parts[0].uv0![0]).not.toEqual(out.model.parts[0].uv0![1]);
});

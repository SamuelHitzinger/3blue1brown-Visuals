import { describe,it,expect,vi,afterEach } from 'vitest';
import { WebIO } from '@gltf-transform/core';
import { KHRMaterialsUnlit } from '@gltf-transform/extensions';
import { parseModelGLB, modelImageSize } from '../src/models.js';
import { validateModelMetadata } from '../src/model-metadata.js';
import { compileSource } from '../src/compiler.js';
import { evaluateScene } from '../src/timeline.js';
import { SceneSequence } from '../src/sequence.js';
import { getWorldBounds } from '../src/bounds.js';
import { ModelStore } from '../src/model-store.js';
import { buildDrawItems } from '../src/render-geometry.js';
import { paletteResolver } from '../src/palette.js';
import { RetainedGeometry } from '../src/retained-geometry.js';
import { composeItems } from '../src/composition.js';
import { modelFixture, modelSource, textureBytes } from './model-fixture.js';
import type { ModelAsset } from '../src/types.js';

function rewrite(bytes:Uint8Array,edit:(json:any)=>void):Uint8Array {
  const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),length=v.getUint32(12,true);
  const json=JSON.parse(new TextDecoder().decode(bytes.subarray(20,20+length)));edit(json);
  const text=new TextEncoder().encode(JSON.stringify(json)),padded=Math.ceil(text.length/4)*4;
  const result=new Uint8Array(20+padded+bytes.length-20-length);result.set(bytes.subarray(0,20));result.fill(32,20,20+padded);result.set(text,20);result.set(bytes.subarray(20+length),20+padded);
  const out=new DataView(result.buffer);out.setUint32(8,result.length,true);out.setUint32(12,padded,true);return result;
}
async function asset(textured=false){const bytes=await modelFixture({textured}),data=await parseModelGLB(bytes);return {bytes,data,asset:{kind:'model',url:'https://example.test/model.glb',metadata:data.metadata} as ModelAsset};}
afterEach(()=>vi.unstubAllGlobals());
describe('static GLB import',()=>{
 it('preserves embedded images, UVs, material color and named parts',async()=>{const data=await parseModelGLB(await modelFixture());expect(data.metadata.triangles).toBe(2);expect(data.metadata.parts[0].name).toBe('Panel');expect(data.primitives[0].uv0).toEqual([[0,1],[1,1],[1,0],[0,0]]);expect(data.images[0].bytes).toEqual(textureBytes);expect(data.primitives[0].material.unlit).toBe(true);validateModelMetadata(data.metadata);});
 it('preserves UV1, texture transforms and every supported PBR map',async()=>{const d=await parseModelGLB(await modelFixture({uv1:true,transform:true,normal:true,metallic:true,emission:true,occlusion:true,unlit:false}));expect(d.primitives[0].material.maps.filter(Boolean)).toHaveLength(5);expect(d.primitives[0].material.maps[0]).toMatchObject({uv:1,offset:[0.5,0],scale:[0.5,1]});});
 it('bakes nonuniform negative scale and corrects winding',async()=>{const d=await parseModelGLB(await modelFixture({mirrored:true}));expect(d.metadata.bounds).toEqual({min:[-1,-2,0],max:[1,2,0]});expect(d.primitives[0].geometry.triangles![0]).toEqual([0,2,1]);});
 it('preserves nested node pivots and world bounds',async()=>{const d=await parseModelGLB(await modelFixture({nested:true}));expect(d.metadata.parts.map(p=>p.name)).toEqual(['Assembly','Panel']);expect(d.metadata.bounds).toEqual({min:[1,0,0],max:[3,2,0]});const c=await compileSource(modelSource,{models:{fixture:d.metadata}});expect(getWorldBounds(evaluateScene(c,1),'panel')).toEqual(d.metadata.bounds);});
 it.each([
  ['external image',(j:any)=>{j.images[0].uri='https://evil.test/a.png';delete j.images[0].bufferView;}],
  ['external buffer',(j:any)=>{j.buffers[0].uri='https://evil.test/a.bin';}],
  ['skin',(j:any)=>{j.skins=[{}];}],
  ['animation',(j:any)=>{j.animations=[{}];}],
  ['unsupported extension',(j:any)=>{j.extensionsUsed.push('KHR_draco_mesh_compression');}],
  ['excessive accessor',(j:any)=>{j.accessors[0].count=999999999;}],
  ['missing UV',(j:any)=>{delete j.meshes[0].primitives[0].attributes.TEXCOORD_0;}],
  ['nontriangle',(j:any)=>{j.meshes[0].primitives[0].mode=1;}],
 ])('rejects %s before playback',async(_name,edit)=>{await expect(parseModelGLB(rewrite(await modelFixture(),edit))).rejects.toThrow();});
 it('rejects corrupt headers and unreasonable decoded image dimensions',async()=>{const bytes=await modelFixture();bytes[0]=0;await expect(parseModelGLB(bytes)).rejects.toThrow('header');expect(modelImageSize(textureBytes,'image/png')).toEqual([2,2]);expect(()=>modelImageSize(new Uint8Array(32),'image/jpeg')).toThrow();});
 it('decodes normalized color attributes',async()=>{const io=new WebIO().registerExtensions([KHRMaterialsUnlit]),doc=await io.readBinary(await modelFixture());doc.getRoot().listMeshes()[0].listPrimitives()[0].setAttribute('COLOR_0',doc.createAccessor().setType('VEC3').setNormalized(true).setArray(new Uint8Array([255,0,0,0,255,0,0,0,255,255,255,255])).setBuffer(doc.getRoot().listBuffers()[0]));const d=await parseModelGLB(await io.writeBinary(doc));expect(d.primitives[0].colors?.[0]).toEqual([1,0,0,1]);});
});
describe('model scenes and host resources',()=>{
 it('keeps compiled/handoff JSON free of mesh and image data and seeks deterministically',async()=>{const {data}=await asset();const sequence=new SceneSequence({models:{fixture:data.metadata}});try{expect((await sequence.submit({type:'load',scenes:[{id:'a',source:modelSource},{id:'b',source:`export default scene({},s=>{s.play(s.previous.get('panel').moveTo([2,0,0]),{duration:1});});`}]})).ok).toBe(true);const frame=sequence.frame(0,1.5);sequence.frame(1,1);sequence.frame(0,0);expect(sequence.frame(0,1.5)).toEqual(frame);expect(JSON.stringify(sequence.compiled)).not.toContain('vertices');expect(sequence.frame(1,0).elements.some(e=>e.geometry.model?.asset==='fixture')).toBe(true);}finally{sequence.dispose();}});
 it('rejects unknown model IDs and ambiguous part names transactionally',async()=>{const {data}=await asset();const sequence=new SceneSequence({models:{fixture:data.metadata}});try{expect((await sequence.submit({type:'load',scenes:[{id:'a',source:modelSource}]})).ok).toBe(true);expect((await sequence.submit({type:'replace',scene:'a',source:modelSource.replace('fixture','missing')})).ok).toBe(false);expect(sequence.sources[0].source).toBe(modelSource);await expect(compileSource(modelSource.replace("part('Panel')","part('missing')"),{models:{fixture:data.metadata}})).rejects.toThrow('part');}finally{sequence.dispose();}});
 it('deduplicates concurrent downloads and hydrates shared immutable resources',async()=>{const f=await asset();const fetcher=vi.fn(async()=>new Response(f.bytes));vi.stubGlobal('fetch',fetcher);const store=new ModelStore({fixture:f.asset});const c=await compileSource(modelSource,{models:store.metadata});try{await Promise.all([store.prepare([c]),store.prepare([c])]);expect(fetcher).toHaveBeenCalledOnce();const frame=evaluateScene(c,1),a=store.resolve(frame),b=store.resolve(frame);expect(a.elements.find(e=>e.geometry.kind==='mesh')!.geometry.vertices).toBe(b.elements.find(e=>e.geometry.kind==='mesh')!.geometry.vertices);expect(frame.elements.some(e=>e.geometry.kind==='model')).toBe(true);}finally{store.dispose();}});
 it('retries failed fetches, checks metadata and rejects immutable asset changes',async()=>{const f=await asset();vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(new Response('oops',{status:500})).mockResolvedValue(new Response(f.bytes)));const store=new ModelStore({fixture:f.asset}),c=await compileSource(modelSource,{models:store.metadata});try{await expect(store.prepare([c])).rejects.toThrow('500');await store.prepare([c]);expect(()=>store.register({fixture:{...f.asset,url:'other'}})).toThrow('immutable');}finally{store.dispose();}});
 it('rejects metadata mismatches and checksum mismatches',async()=>{const f=await asset();for(const a of [{...f.asset,metadata:{...f.asset.metadata,materials:['different']}},{...f.asset,sha256:'0'.repeat(64)}]){vi.stubGlobal('fetch',vi.fn(async()=>new Response(f.bytes)));const store=new ModelStore({fixture:a}),c=await compileSource(modelSource,{models:store.metadata});await expect(store.prepare([c])).rejects.toThrow(/mismatch/);store.dispose();}});
 it('retains model geometry across transforms and does not merge different materials',async()=>{const f=await asset();vi.stubGlobal('fetch',vi.fn(async()=>new Response(f.bytes)));const store=new ModelStore({fixture:f.asset}),c=await compileSource(modelSource,{models:store.metadata});await store.prepare([c]);const cache=new RetainedGeometry();const draw=(time:number)=>{cache.beginFrame();const frame=store.resolve(evaluateScene(c,time));const items=buildDrawItems(frame,frame.camera,640,480,paletteResolver(),undefined,false,cache);cache.endFrame();return items;};const a=draw(1),b=draw(1.5);expect(a[0].mesh).toBe(b[0].mesh);expect(a[0].modelMaterial).toBeDefined();const items=[{...a[0],mesh:undefined,modelMaterial:f.data.primitives[0].material},{...a[0],mesh:undefined,modelMaterial:{...f.data.primitives[0].material}}];expect(composeItems(items,0).commands).toHaveLength(2);store.dispose();});
});

describe('model integration edge cases',()=>{
 it('checks metadata for aliases even when the shared bytes are already cached',async()=>{const f=await asset();vi.stubGlobal('fetch',vi.fn(async()=>new Response(f.bytes)));const store=new ModelStore({fixture:f.asset});try{await store.prepare([await compileSource(modelSource,{models:store.metadata})]);store.register({alias:{...f.asset,metadata:{...f.asset.metadata,materials:['forged']}}});const c=await compileSource(modelSource.replace('fixture','alias'),{models:store.metadata});await expect(store.prepare([c])).rejects.toThrow('metadata mismatch');}finally{store.dispose();}});
 it('picks model groups using conservative metadata bounds',async()=>{const {cameraRay,pick}=await import('../src/spatial.js');const f=await asset(),c=await compileSource(modelSource,{models:{fixture:f.data.metadata}}),frame=evaluateScene(c,1);expect(pick(frame,cameraRay(320,240,frame.camera,640,480),new Set(['panel']),frame.camera,640,480)?.id).toBe('panel');expect(pick(frame,cameraRay(0,0,frame.camera,640,480),new Set(['panel']),frame.camera,640,480)).toBeUndefined();});
 it('tints all primitives of named parts and persists the tint through handoffs',async()=>{const f=await asset(),c=await compileSource(`export default scene({},s=>{const m=s.model('panel',{asset:'fixture'});s.play(m.part('Panel').tintTo(Color.PURE_RED),{duration:1});s.keep(m);});`,{models:{fixture:f.data.metadata}}),frame=evaluateScene(c,1);expect(frame.elements.find(e=>e.geometry.model)?.fill).toBe('PURE_RED');const next=await compileSource('export default scene({},s=>s.wait(1));',{models:{fixture:f.data.metadata},previous:frame});expect(evaluateScene(next,0).elements.find(e=>e.geometry.model)?.fill).toBe('PURE_RED');});
 it('rejects malicious model metadata and forged internal renderer fields',async()=>{const f=await asset();const bad=structuredClone(f.data.metadata);bad.parts[0].parent=bad.parts[0].id;expect(()=>validateModelMetadata(bad)).toThrow();await expect(compileSource(`export default scene({},s=>s.mesh('m',{vertices:[[0,0],[1,0],[0,1]],triangles:[[0,1,2]],_model:{}}));`)).rejects.toThrow('host-owned');});
 it('rejects graph cycles, multiple parents and required unsupported extensions',async()=>{for(const edit of [(j:any)=>{j.nodes[0].children=[0];},(j:any)=>{j.nodes.push({children:[0]},{children:[0]});},(j:any)=>{j.extensionsRequired=['KHR_draco_mesh_compression'];}])await expect(parseModelGLB(rewrite(await modelFixture(),edit))).rejects.toThrow();});
 it('supports refreshing signed URLs without changing asset identity',async()=>{const f=await asset();const a={...f.asset,sha256:'a'.repeat(64)},store=new ModelStore({fixture:a});expect(()=>store.register({fixture:{...a,url:'https://example.test/new-signature'}})).not.toThrow();expect(()=>store.register({fixture:{...a,sha256:'b'.repeat(64)}})).toThrow('immutable');store.dispose();});
 it('aborts in-flight model loads on disposal',async()=>{const f=await asset();vi.stubGlobal('fetch',(_url:string,options:RequestInit)=>new Promise((_resolve,reject)=>options.signal?.addEventListener('abort',()=>reject(new Error('aborted')))));const store=new ModelStore({fixture:f.asset}),c=await compileSource(modelSource,{models:store.metadata});const pending=store.prepare([c]);store.dispose();await expect(pending).rejects.toThrow('aborted');});
});

import {describe,it,expect} from 'vitest';
import {createAssetRegistry} from '../src/asset-registry.js';
import {compileSource} from '../src/compiler.js';
import {SceneAssets} from '../src/scene-assets.js';
import {evaluateScene} from '../src/timeline.js';
import {buildDrawItems} from '../src/render-geometry.js';
import {paletteResolver} from '../src/palette.js';
import {VERTEX_FLOATS} from '../src/texture-shader.js';
import {model} from './asset-fixture.js';
import {SceneSequence} from '../src/sequence.js';
import {composeItems} from '../src/composition.js';
import {RetainedGeometry} from '../src/retained-geometry.js';

import {imageInput} from './image-fixture.js';
describe('host-owned source image assets',()=>{
  it('requires host source-color authorization before accepting image bytes',async()=>{
    await expect(createAssetRegistry([imageInput()] as any)).rejects.toThrow(/source.*color|color.*source/i);
  });
  it('snapshots exact pixels before hashing and returns copies under leases',async()=>{
    const input=imageInput(),pending=createAssetRegistry([input] as any,{colorPolicy:'source'} as any);
    input.pixels.fill(0);const registry=await pending,descriptor=registry.catalog[0];
    const lease=registry.acquire([{id:descriptor.id,hash:descriptor.hash}] as any) as any;
    const image=lease.resolveImage({id:descriptor.id,hash:descriptor.hash});
    expect([...image.copyPixels()].slice(0,4)).toEqual([203,71,19,255]);
    image.copyPixels().fill(0);expect(image.copyPixels()[0]).toBe(203);
    expect(registry.stats().pinnedBytes).toBe(16);lease.dispose();
    expect(registry.stats().pinnedBytes).toBe(0);expect(()=>lease.resolveImage(descriptor)).toThrow(/disposed/);
  });
  it('compiles an aspect-correct image without pixels in scene payload and packs top-left UVs',async()=>{
    const registry=await createAssetRegistry([imageInput()] as any,{colorPolicy:'source'} as any);
    const compiled=await compileSource("export default scene({},s=>{s.image('card',{asset:'corners',width:4});s.wait(1);});",{assetCatalog:registry.catalog});
    expect(JSON.stringify(compiled)).not.toContain('203,71');
    const host=new SceneAssets(registry);host.prepare(compiled);
    const frame=evaluateScene(compiled,0),g=frame.elements[0].geometry as any;
    expect(g.vertices).toEqual([[-2,2,0],[-2,-2,0],[2,-2,0],[2,2,0]]);
    const items=buildDrawItems(frame,frame.camera,400,400,paletteResolver(),undefined,false,undefined,undefined,host);
    expect([...items[0].vertices.slice(3,7)]).toEqual([1,1,1,1]);
    expect([...items[0].vertices.slice(31,36)]).toEqual([0,0,0,0,2]);
    expect(VERTEX_FLOATS).toBe(36);host.dispose();expect(registry.stats().pinnedBytes).toBe(0);
  });
  it('rejects oversized, byte-mismatched images and unsupported descriptors before hashing',async()=>{
    for(const change of [{width:4097},{pixels:new Uint8Array(15)},{encoding:'linear'},{storage:'rgba16'}])
      await expect(createAssetRegistry([{...imageInput(),...change}] as any,{colorPolicy:'source'} as any)).rejects.toThrow();
  });
  it('pins model image dependencies and rejects missing UVs, stale images, and unsupported combinations',async()=>{
    const image=imageInput(),images=await createAssetRegistry([image],{colorPolicy:'source'}),ref={id:image.id,hash:images.catalog[0].hash};
    const input=model();input.parts[0].uv0=[[0,0],[1,0],[0,1]];
    input.parts[0].imageTexture={image:ref,alphaMode:'opaque',filter:'nearest',wrap:'clamp'};
    const registry=await createAssetRegistry([image,input],{colorPolicy:'source'});
    const source="export default scene({},s=>{s.model('m',{asset:'test'});s.wait(1);});";
    const scene=await compileSource(source,{assetCatalog:registry.catalog}),host=new SceneAssets(registry);host.prepare(scene);
    expect(host.resolveImage(ref).copyPixels()[0]).toBe(203);expect(registry.stats().pinnedBytes).toBe(registry.stats().decodedBytes);
    await expect(compileSource(source.replace("asset:'test'","asset:'test',texture:{pattern:'checker',color:'BLUE'}"),{assetCatalog:registry.catalog})).rejects.toThrow(/image texture/);
    host.dispose();expect(registry.stats().pinnedBytes).toBe(0);
    await expect(createAssetRegistry([input],{colorPolicy:'source'})).rejects.toThrow(/missing or stale image/);
    delete input.parts[0].uv0;await expect(createAssetRegistry([image,input],{colorPolicy:'source'})).rejects.toThrow(/UV0/);
  });
  it('keeps images separate in draw batching while sharing repeated retained instances',async()=>{
    const a=imageInput('a'),b=imageInput('b');b.pixels.fill(171);
    const registry=await createAssetRegistry([a,b],{colorPolicy:'source'});
    const scene=await compileSource("export default scene({},s=>{for(let i=0;i<3;i++)s.image('c'+i,{asset:i===2?'b':'a',alphaMode:'opaque'});s.wait(1);});",{assetCatalog:registry.catalog});
    const host=new SceneAssets(registry);host.prepare(scene);const frame=evaluateScene(scene,0),cache=new RetainedGeometry();cache.beginFrame();
    const items=buildDrawItems(frame,frame.camera,400,400,paletteResolver(),undefined,false,cache,undefined,host);cache.endFrame();
    expect(items[0].mesh).toBe(items[1].mesh);expect(items[2].mesh).not.toBe(items[0].mesh);
    expect(composeItems(items,0).commands).toHaveLength(2);
    const streamed=buildDrawItems(frame,frame.camera,400,400,paletteResolver(),undefined,false,undefined,undefined,host);
    expect(composeItems(streamed,0).commands).toHaveLength(2);host.dispose();
  });
  it('releases failed image candidates while preserving the committed scene and other consumers',async()=>{
    const registry=await createAssetRegistry([imageInput()],{colorPolicy:'source'});let fail=false;
    const a=new SceneSequence({modelAssets:registry,prepare:async()=>{if(fail)throw new Error('candidate failed');}}),b=new SceneSequence({modelAssets:registry});
    const source="export default scene({},s=>{s.image('i',{asset:'corners'});s.wait(1);});";
    try{
      expect((await a.submit({type:'load',scenes:[{id:'a',source}]})).ok).toBe(true);
      expect((await b.submit({type:'load',scenes:[{id:'b',source}]})).ok).toBe(true);fail=true;
      expect((await a.submit({type:'replace',scene:'a',source})).ok).toBe(false);expect(registry.stats().leases).toBe(2);
      a.dispose();expect(registry.stats().leases).toBe(1);expect(b.frame(0,0).elements[0].geometry.imageTexture).toBeTruthy();
    }finally{a.dispose();b.dispose();}expect(registry.stats().pinnedBytes).toBe(0);
  });
});

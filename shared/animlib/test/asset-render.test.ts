import {VERTEX_FLOATS} from '../src/texture-shader.js';
import { expect, it } from 'vitest';
import { createAssetRegistry } from '../src/asset-registry.js';
import { model } from './asset-fixture.js';
import { withOfflineScene } from '../src/offline-sampling.js';
import { buildDrawItems } from '../src/render-geometry.js';
import { paletteResolver } from '../src/palette.js';
import { getWorldBounds } from '../src/bounds.js';
import { RetainedGeometry } from '../src/retained-geometry.js';
import { composeItems } from '../src/composition.js';
import { pick } from '../src/spatial.js';
import { detectOverlaps } from '../src/overlap.js';

it('renders repeated refs through one retained mesh and streams the same geometry with bounds and picking',async()=>{
  const registry=await createAssetRegistry([model()]);
  await withOfflineScene(`export default scene({},s=>{s.model('a',{asset:'test',fill:'YELLOW',position:[-1,0,0]});s.model('b',{asset:'test',fill:'YELLOW',position:[1,0,0]});s.wait(1);});`,{},sampler=>{
    const frame=sampler.sample(0), before=JSON.stringify(frame), cache=new RetainedGeometry();
    const draw=(retained?:RetainedGeometry)=>buildDrawItems(frame,frame.camera,800,450,paletteResolver(),undefined,false,retained,undefined,sampler.assetGeometry);
    cache.beginFrame(); const first=draw(cache);cache.endFrame();
    expect(first).toHaveLength(2); expect(first[0].mesh).toBeDefined(); expect(first[1].mesh).toBe(first[0].mesh);
    expect(composeItems(first,0).commands).toHaveLength(1);
    cache.beginFrame();const second=draw(cache);cache.endFrame();expect(second[0].mesh).toBe(first[0].mesh);
    const cpu=draw();expect(cpu[0].vertices.length).toBe(3*VERTEX_FLOATS);expect(cpu.every(item=>!item.mesh)).toBe(true);
    expect(getWorldBounds(frame,'b',{assetGeometry:sampler.assetGeometry})).toEqual({min:[1,0,0],max:[2,1,0]});
    expect(pick(frame,{origin:[1.2,0.2,3],direction:[0,0,-1]},new Set(['b']),frame.camera,800,450,undefined,undefined,sampler.assetGeometry)?.id).toBe('b');
    expect(JSON.stringify(frame)).toBe(before);
    expect(()=>draw.call(null)).not.toThrow();
  },{modelAssets:registry});
});
it('text-only inspection skips unused model geometry, while occluding labels can resolve it explicitly',async()=>{
  const registry=await createAssetRegistry([model()]);
  await withOfflineScene(`export default scene({},s=>{s.model('m',{asset:'test'});s.text('label',{text:'model'});s.wait(1);});`,{},sampler=>{
    const frame=sampler.sample();
    expect(()=>detectOverlaps(frame,{width:800,height:450})).not.toThrow();
    frame.elements.find(e=>e.id==='label')!.geometry.labelOcclusion='fade';
    expect(()=>detectOverlaps(frame,{width:800,height:450,assetGeometry:sampler.assetGeometry})).not.toThrow();
  },{modelAssets:registry});
});
it('uses referenced meshes in clipping and translucent CPU sorting',async()=>{
  const registry=await createAssetRegistry([model()]);
  await withOfflineScene(`export default scene({},s=>{s.model('m',{asset:'test',fill:'YELLOW',opacity:0.5,clipPlanes:[{normal:[1,0,0],offset:0.25}]});s.wait(1);});`,{},sampler=>{
    const frame=sampler.sample(), items=buildDrawItems(frame,frame.camera,800,450,paletteResolver(),undefined,false,new RetainedGeometry(),undefined,sampler.assetGeometry);
    expect(items.length).toBeGreaterThan(0);expect(items.every(item=>item.transparent&&!item.mesh)).toBe(true);
    expect(items.flatMap(item=>Array.from(item.vertices)).every(Number.isFinite)).toBe(true);
  },{modelAssets:registry});
});

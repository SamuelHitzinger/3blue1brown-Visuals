import { describe, expect, it } from 'vitest';
import { compileSource } from '../src/compiler.js';
import { createAssetRegistry } from '../src/asset-registry.js';
import { model } from './asset-fixture.js';
import { SceneSequence } from '../src/sequence.js';
import { withOfflineScene } from '../src/offline-sampling.js';
import { evaluateScene } from '../src/timeline.js';
import { SceneAssets } from '../src/scene-assets.js';

const source=`export default scene({mode:'3d'},s=>{const m=s.model('m',{asset:'test',fill:'YELLOW'});s.play(m.moveTo([2,0,0]),{duration:2});s.keep(m);});`;
describe('prepared assets across compilation and scene ownership',()=>{
  it('rechecks live registry counts before host preparation accepts a forged catalog',async()=>{
    const large=model();large.parts[0].vertices=Array.from({length:20000},()=>[0,0,0]);
    const registry=await createAssetRegistry([large]), catalog=structuredClone(registry.catalog);
    catalog[0].parts[0].vertexCount=3;
    const scene=await compileSource(`export default scene({},s=>{for(let i=0;i<6;i++)s.model('m'+i,{asset:'test'});});`,{assetCatalog:catalog});
    const assets=new SceneAssets(registry);
    expect(()=>assets.prepare(scene)).toThrow(/budget/i);
    expect(registry.stats().leases).toBe(0);assets.dispose();
  });
  it('keeps vertex arrays out of compilation, frames and handoff',async()=>{
    const registry=await createAssetRegistry([model()]);
    const scene=await compileSource(source,{assetCatalog:registry.catalog});
    const frame=evaluateScene(scene,1), part=frame.elements.find(e=>e.id==='m.body')!;
    expect(part.geometry.asset).toEqual({id:'test',hash:registry.catalog[0].hash,part:'body'});
    expect(JSON.stringify(scene)).not.toContain('vertices');
    const next=await compileSource(`export default scene({},s=>{s.keep(s.previous.get('m'));s.wait(1);});`,{assetCatalog:registry.catalog,previous:evaluateScene(scene,2)});
    expect(next.initial.find(e=>e.id==='m.body')!.geometry.asset).toEqual(part.geometry.asset);
  });
  it('checks repeated-instance work budgets and rejects static asset deformation',async()=>{
    const large=model(); large.parts[0].vertices=Array.from({length:20000},()=>[0,0,0]);
    const registry=await createAssetRegistry([large]);
    await expect(compileSource(`export default scene({},s=>{for(let i=0;i<6;i++)s.model('m'+i,{asset:'test'});});`,{assetCatalog:registry.catalog})).rejects.toThrow(/budget/i);
    const first=await compileSource(source,{assetCatalog:registry.catalog});
    await expect(compileSource(`export default scene({},s=>{s.deform(s.previous.get('m.body'),[s.time],p=>p);});`,{assetCatalog:registry.catalog,previous:evaluateScene(first,2)})).rejects.toThrow(/asset|referenced/i);
  });
  it('keeps active leases on failed replacement, drops candidate leases, and isolates players',async()=>{
    const registry=await createAssetRegistry([model()]);
    let fail=false;
    const a=new SceneSequence({modelAssets:registry,prepare:async()=>{if(fail)throw new Error('prepare failed');}}), b=new SceneSequence({modelAssets:registry});
    try {
      expect((await a.submit({type:'load',scenes:[{id:'a',source}]})).ok).toBe(true);
      expect((await b.submit({type:'load',scenes:[{id:'b',source}]})).ok).toBe(true);
      expect(registry.stats().leases).toBe(2); fail=true;
      expect((await a.submit({type:'replace',scene:'a',source})).ok).toBe(false);
      expect(registry.stats().leases).toBe(2); a.dispose();
      expect(registry.stats().leases).toBe(1);
      const frame=await b.evaluate(0,1);
      expect(b.assetGeometry.resolve(frame.elements.find(e=>e.id==='m.body')!.geometry.asset!).vertices).toHaveLength(3);
    } finally {a.dispose();b.dispose();}
    expect(registry.stats().leases).toBe(0);
  });
  it('offline samples reverse time with one lease and releases on rejected export',async()=>{
    const registry=await createAssetRegistry([model()]);
    await expect(withOfflineScene(source,{},async sampler=>{
      expect(registry.stats().leases).toBe(1);
      const one=sampler.sample(1), two=sampler.sample(2), zero=sampler.sample(0);
      expect(one.elements.find(e=>e.id==='m')!.position[0]).toBe(1);
      expect(two.elements.find(e=>e.id==='m')!.position[0]).toBe(2);
      expect(zero.elements.find(e=>e.id==='m')!.position[0]).toBe(0);
      expect(JSON.stringify(one)).not.toContain('vertices');
      throw new Error('cancel export');
    },{modelAssets:registry})).rejects.toThrow('cancel export');
    expect(registry.stats().leases).toBe(0);
  });
});

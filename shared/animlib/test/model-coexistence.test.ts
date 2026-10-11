import { describe, expect, it } from 'vitest';
import { createAssetRegistry } from '../src/asset-registry.js';
import { compileSource, createSceneProgram } from '../src/compiler.js';
import { evaluateScene } from '../src/timeline.js';
import { SceneSequence } from '../src/sequence.js';
import { withOfflineScene } from '../src/offline-sampling.js';
import type { ModelMetadata } from '../src/types.js';
import { model } from './asset-fixture.js';
import { imageInput } from './image-fixture.js';

function metadata(triangles = 1): ModelMetadata {
  const bounds = { min: [0, 0, 0] as [number, number, number], max: [1, 1, 0] as [number, number, number] };
  return { version: 1, bounds, triangles, materials: ['original'], primitives: [{ bounds, triangles }], parts: [
    { id: 'node-0', name: 'Assembly', position: [1, 0, 0], primitives: [] },
    { id: 'node-1', name: 'Panel', parent: 'node-0', position: [0, 1, 0], primitives: [0] },
  ] };
}
const mixed = `export default scene({mode:'3d'},s=>{
  const p=s.model('prepared',{asset:'test',fill:'YELLOW',shading:'flat'});
  const g=s.model('imported',{asset:'glb',tint:'BLUE'});
  s.image('image',{asset:'corners'});
  s.validateGroup([p,g]);
  const both=s.group('both',[p,g]);
  s.play([p.part('body').tintTo('RED'),g.part('Panel').tintTo('GREEN')],{duration:1});
  s.keep(both);
});`;

describe('prepared and GLB model coexistence', () => {
  it('preserves both child schemes, GLB pivots, image references and owned model handles', async () => {
    const registry = await createAssetRegistry([model(), imageInput()], { colorPolicy: 'source' });
    const scene = await compileSource(mixed, { assetCatalog: registry.catalog, models: { glb: metadata() } });
    const frame = evaluateScene(scene, 1), byId = new Map(frame.elements.map(e => [e.id, e]));
    expect(byId.get('prepared.body')).toMatchObject({ fill: 'RED', geometry: { kind: 'mesh', shading: 'flat', asset: { id: 'test', part: 'body' } } });
    expect(byId.get('imported/primitive-0')).toMatchObject({ fill: 'GREEN', geometry: { kind: 'model', model: { asset: 'glb', primitive: 0 } } });
    expect(byId.get('imported/node-0')?.position).toEqual([1, 0, 0]);
    expect(byId.get('imported/node-1')?.position).toEqual([0, 1, 0]);
    expect(byId.get('image')?.geometry.imageTexture?.image.id).toBe('corners');
    expect(byId.get('prepared.body')?.geometry.vertices).toBeUndefined();
    expect(byId.get('imported/primitive-0')?.geometry.vertices).toBeUndefined();
  });

  it('rejects ambiguous inventory IDs and resolves either explicit source', async () => {
    const registry = await createAssetRegistry([model('same')]);
    const input = { assetCatalog: registry.catalog, models: { same: metadata() } };
    await expect(compileSource(`export default scene({},s=>s.model('m',{asset:'same'}));`, input)).rejects.toThrow('Ambiguous model asset');
    const scene = await compileSource(`export default scene({},s=>{
      s.model('p',{asset:'same',source:'prepared'});s.model('g',{asset:'same',source:'glb'});
    });`, input);
    expect(evaluateScene(scene, 0).elements.map(e => e.id)).toEqual(expect.arrayContaining(['p.body', 'g/primitive-0']));
    await expect(compileSource(`export default scene({},s=>s.model('m',{asset:'same',source:'other'}));`, input)).rejects.toThrow('Invalid model source');
  });

  it('does not fall back to the other inventory for an explicit source and retains format style validation', async () => {
    const registry = await createAssetRegistry([model()]);
    const input = { assetCatalog: registry.catalog, models: { glb: metadata() } };
    for (const props of ["{asset:'test',source:'glb'}", "{asset:'glb',source:'prepared'}"]) {
      await expect(compileSource(`export default scene({},s=>s.model('m',${props}));`, input)).rejects.toThrow(/model asset/);
    }
    await expect(compileSource(`export default scene({},s=>s.model('m',{asset:'glb',fill:'RED'}));`, input)).rejects.toThrow('Unsupported model property');
    await expect(compileSource(`export default scene({},s=>s.model('m',{asset:'test',tint:'RED'}));`, input)).rejects.toThrow('Prepared models use fill');
    await expect(compileSource(`export default scene({},s=>s.model('m',{asset:'test'}).part('absent'));`, input)).rejects.toThrow('Unknown model part');
  });

  it('forwards both inventories through sequence handoffs and releases prepared leases', async () => {
    const registry = await createAssetRegistry([model(), imageInput()], { colorPolicy: 'source' });
    const sequence = new SceneSequence({ modelAssets: registry, models: { glb: metadata() } });
    try {
      const result = await sequence.submit({ type: 'load', scenes: [
        { id: 'first', source: mixed },
        { id: 'next', handoffFrom: 'first', audioId: 'narration', source: `export default scene({},s=>s.wait(1));` },
      ] });
      expect(result.diagnostics).toEqual([]);
      expect(result.ok).toBe(true);
      expect(sequence.compiled[1].options.audio).toBe('narration');
      expect(sequence.frame(1, 0).elements.map(e => e.id)).toEqual(expect.arrayContaining(['prepared.body', 'imported/primitive-0']));
      expect(registry.stats().leases).toBeGreaterThan(0);
    } finally { sequence.dispose(); }
    expect(registry.stats().leases).toBe(0);
  });

  it('preserves retained offline motion and real root tint methods for both formats', async () => {
    const registry = await createAssetRegistry([model()]);
    await withOfflineScene(`export default scene({},s=>{
      const p=s.model('p',{asset:'test'}),g=s.model('g',{asset:'glb'});
      s.bind(p,[s.time],t=>({position:[t,0,0]}));
      s.play([p.tintTo('RED'),g.tintTo('BLUE')],{duration:2});
    });`, { models: { glb: metadata() } }, sampler => {
      expect(sampler.sample(2).elements.find(e => e.id === 'p')?.position).toEqual([2, 0, 0]);
      expect(sampler.sample(0).elements.find(e => e.id === 'p')?.position).toEqual([0, 0, 0]);
      expect(sampler.sample(2).elements.find(e => e.id === 'p.body')?.fill).toBe('RED');
      expect(sampler.sample(2).elements.find(e => e.id === 'g/primitive-0')?.fill).toBe('BLUE');
    }, { modelAssets: registry });
    expect(registry.stats().leases).toBe(0);
  });

  it('retains metadata, missing-reference, internal-field and imported-instance budget checks with prepared assets present', async () => {
    const registry = await createAssetRegistry([model()]);
    const source = `export default scene({},s=>{s.model('p',{asset:'test'});s.model('g',{asset:'glb'});});`;
    const input = { assetCatalog: registry.catalog, models: { glb: metadata() } };
    const bad = metadata(); bad.parts[0].parent = 'node-0';
    await expect(compileSource(source, { ...input, models: { glb: bad } })).rejects.toThrow('Model metadata');
    await expect(compileSource(`export default scene({},s=>s.mesh('m',{vertices:[[0,0],[1,0],[0,1]],triangles:[[0,1,2]],_model:{}}));`, input)).rejects.toThrow('host-owned');
    const first = await compileSource(`export default scene({},s=>{
      s.model('p',{asset:'test'});s.keep(s.model('g',{asset:'glb'}));
    });`, input);
    const previous = evaluateScene(first, 0);
    await expect(compileSource(`export default scene({},s=>{
      s.play(s.previous.get('g/primitive-0').morphTo({kind:'mesh',vertices:[[0,0,0],[1,0,0],[0,1,0]],triangles:[[0,1,2]]}),{duration:1});
    });`, { ...input, previous })).rejects.toThrow('Model geometry cannot be morphed');
    previous.elements.find(e => e.geometry.model)!.geometry.model!.bounds.max[0] = 42;
    await expect(compileSource(`export default scene({},s=>s.wait(1));`, { ...input, previous })).rejects.toThrow('registered metadata');
    await expect(compileSource(`export default scene({},s=>{s.model('p',{asset:'test'});for(let i=0;i<3;i++)s.model('g'+i,{asset:'glb'});});`, { ...input, models: { glb: metadata(200000) } })).rejects.toThrow('imported model budget');
  });

  it('rejects retained callback attempts to smuggle host fields or deform either referenced format', async () => {
    const registry = await createAssetRegistry([model()]);
    const input = { assetCatalog: registry.catalog, models: { glb: metadata() } };
    for (const asset of ['test', 'glb']) {
      const program = await createSceneProgram(`export default scene({},s=>{
        const m=s.model('m',{asset:'${asset}'});
        s.bind(m,[s.time],t=>({position:t===0?[0,0,0]:[Infinity,0,0]}));s.wait(1);
      });`, input);
      try { expect(() => program.update({}, [], 1)).toThrow(/position/); }
      finally { program.dispose(); }
    }
    await expect(compileSource(`export default scene({},s=>{
      const p=s.model('p',{asset:'test'});s.bind(p.part('body'),[s.time],t=>({_model:{}}));s.wait(1);
    });`, input)).rejects.toThrow(/reactive|Unsupported/);
    for (const [asset, part] of [['test', 'body'], ['glb', 'Panel']]) {
      await expect(compileSource(`export default scene({},s=>{
        const p=s.model('p',{asset:'${asset}'});s.deform(p.part('${part}'),[s.time],p=>p);s.wait(1);
      });`, input)).rejects.toThrow(/asset|mesh|deform/i);
    }
  });
});

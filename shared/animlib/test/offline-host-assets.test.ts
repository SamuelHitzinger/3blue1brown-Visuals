import { describe, expect, it } from 'vitest';
import { createAssetRegistry } from '../src/asset-registry.js';
import { withOfflineScene } from '../src/offline-sampling.js';
import { ModelStore } from '../src/model-store.js';
import { parseModelGLB } from '../src/models.js';
import { model } from './asset-fixture.js';
import { imageInput } from './image-fixture.js';
import { modelFixture } from './model-fixture.js';

const source = `export default scene({mode:'3d'},s=>{
  const scientific=s.model('scientific',{asset:'prepared'});
  s.image('image',{asset:'corners',width:1});
  const imported=s.model('imported',{asset:'glb'});
  const trace=s.path('trace',{points:[[0,0,0],[1,0,0]]});
  s.bind(scientific,[s.time],t=>({position:[t,0,0]}));
  s.bind(imported,[s.time],t=>({position:[0,t,0]}));
  s.bind(trace,[s.time],t=>({points:[[0,0,0],[1,t,0]]}));
  s.keep(scientific);s.keep(imported);s.keep(trace);s.wait(2);
});`;

async function fixtures() {
  const registry = await createAssetRegistry([model('prepared'), imageInput()], { colorPolicy: 'source' });
  const bytes = await modelFixture({ textured: false }), data = await parseModelGLB(bytes);
  const store = new ModelStore({ glb: { kind: 'model', url: 'embedded.glb', metadata: data.metadata } }, { read: async () => bytes });
  return { registry, store };
}

describe('offline hosts with prepared and imported assets', () => {
  it('resolves both asset forms while retaining scientific motion at absolute sample times', async () => {
    const { registry, store } = await fixtures();
    try {
      await withOfflineScene(source, { models: store.metadata }, async sampler => {
        await store.prepare([sampler.scene]);
        expect(registry.stats().leases).toBe(1);
        for (const element of sampler.scene.lifecycle.flatMap(event => event.elements ?? [])) {
          if (element.geometry.asset || element.geometry.model) expect(element.geometry.vertices).toBeUndefined();
        }
        expect(JSON.stringify(sampler.scene)).not.toContain('pixels');
        const sample = (time: number) => {
          const frame = sampler.sample(time);
          const prepared = frame.elements.find(e => e.id === 'scientific.body')!;
          expect(sampler.assetGeometry.resolve(prepared.geometry.asset!).vertices).toHaveLength(3);
          expect(sampler.assetGeometry.resolveImage!(frame.elements.find(e => e.id === 'image')!.geometry.imageTexture!.image).copyPixels()).toHaveLength(16);
          expect(store.resolve(frame).elements.find(e => e.id.startsWith('imported/') && e.geometry.kind === 'mesh')!.geometry.vertices).toHaveLength(4);
          return frame;
        };
        const first = sample(0), second = sample(2);
        expect(first.elements.find(e => e.id === 'scientific')!.position).toEqual([0, 0, 0]);
        expect(second.elements.find(e => e.id === 'scientific')!.position).toEqual([2, 0, 0]);
        expect(second.elements.find(e => e.id === 'imported')!.position).toEqual([0, 2, 0]);
        expect(second.elements.find(e => e.id === 'trace')!.geometry.points).not.toEqual(first.elements.find(e => e.id === 'trace')!.geometry.points);
        expect(sample(0)).toEqual(first);
      }, { modelAssets: registry });
    } finally { store.dispose(); }
    expect(registry.stats().leases).toBe(0);
  });

  it('releases prepared leases when GLB preparation or a consuming exporter fails', async () => {
    for (const failPreparation of [true, false]) {
      const { registry, store } = await fixtures();
      try {
        await expect(withOfflineScene(source, { models: store.metadata }, async sampler => {
          if (failPreparation) store.dispose();
          await store.prepare([sampler.scene]);
          sampler.sample(1);
          throw new Error('export failed');
        }, { modelAssets: registry })).rejects.toThrow(failPreparation ? /model/i : 'export failed');
      } finally { store.dispose(); }
      expect(registry.stats().leases).toBe(0);
      expect(store.images.size).toBe(0);
    }
  });
});

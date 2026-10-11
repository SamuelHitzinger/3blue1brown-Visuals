import { afterEach, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import { createAssetRegistry } from '../src/asset-registry.js';
import { SceneAssets } from '../src/scene-assets.js';
import { ModelStore } from '../src/model-store.js';
import { parseModelGLB } from '../src/models.js';
import { compileSource } from '../src/compiler.js';
import { evaluateScene } from '../src/timeline.js';
import { buildDrawItems } from '../src/render-geometry.js';
import { composeItems } from '../src/composition.js';
import { paletteResolver } from '../src/palette.js';
import { RetainedGeometry } from '../src/retained-geometry.js';
import { VERTEX_FLOATS } from '../src/texture-shader.js';
import { imageInput } from './image-fixture.js';
import { modelFixture } from './model-fixture.js';
const { PNG } = createRequire(import.meta.url)('pngjs');

afterEach(() => vi.unstubAllGlobals());

it('preserves separate image alpha and GLB UV1 through streamed and retained mixed draws', async () => {
  const bytes = await modelFixture({ uv1: true }), parsed = await parseModelGLB(bytes);
  vi.stubGlobal('fetch', vi.fn(async () => new Response(bytes)));
  const models = new ModelStore({ glb: { kind: 'model', url: 'https://example.test/fixture.glb', metadata: parsed.metadata } }, {
    decode: async image => {
      const decoded = PNG.sync.read(Buffer.from(image.bytes));
      return { width: decoded.width, height: decoded.height, pixels: new Uint8Array(decoded.data) };
    },
  });
  const registry = await createAssetRegistry([imageInput()], { colorPolicy: 'source' });
  const assets = new SceneAssets(registry);
  try {
    const scene = await compileSource(`export default scene({},s=>{
      s.image('image',{asset:'corners',alphaMode:'opaque'});
      s.model('imported',{asset:'glb'});
      s.wait(1);
    });`, { assetCatalog: registry.catalog, models: models.metadata });
    assets.prepare(scene); await models.prepare([scene]);
    const frame = models.resolve(evaluateScene(scene, 0)), cache = new RetainedGeometry();
    for (const retained of [undefined, cache]) {
      cache.beginFrame();
      const items = buildDrawItems(frame, frame.camera, 640, 480, paletteResolver(), undefined, false, retained, undefined, assets);
      cache.endFrame();
      const image = items.find(item => item.imageBinding)!;
      const glb = items.find(item => item.modelMaterial)!;
      expect(image).toBeDefined(); expect(glb).toBeDefined();
      const imageVertices = image.mesh?.vertices ?? image.vertices;
      const modelVertices = glb.mesh?.vertices ?? glb.vertices;
      expect([...imageVertices.slice(31, 36)]).toEqual([0, 0, 0, 0, 1]);
      expect([...modelVertices.slice(31, 36)]).toEqual([0, 0, 0, 1, 0]);
      expect(imageVertices.length % VERTEX_FLOATS).toBe(0);
      expect(modelVertices.length % VERTEX_FLOATS).toBe(0);
      const commands = composeItems(items, 0).commands;
      expect(commands).toHaveLength(2);
      expect(commands.filter(c => 'first' in c && c.imageBinding)).toHaveLength(1);
      expect(commands.filter(c => 'first' in c && c.modelMaterial)).toHaveLength(1);
    }
  } finally { assets.dispose(); models.dispose(); }
  expect(registry.stats().pinnedBytes).toBe(0);
});

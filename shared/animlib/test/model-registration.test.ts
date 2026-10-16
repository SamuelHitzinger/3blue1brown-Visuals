import { describe, expect, it } from 'vitest';
import { ModelStore } from '../src/model-store.js';
import { compileSource } from '../src/compiler.js';
import { evaluateScene } from '../src/timeline.js';
import { parseModelGLB } from '../src/models.js';
import type { Asset, ModelAsset } from '../src/types.js';
import { modelFixture, modelSource } from './model-fixture.js';

function model(): ModelAsset {
  return {
    kind: 'model', url: '/model.glb', sha256: 'a'.repeat(64), provenanceSha256: 'b'.repeat(64),
    metadata: {
      version: 1, triangles: 1, materials: [],
      bounds: { min: [0, 0, 0], max: [1, 1, 0] },
      primitives: [{ bounds: { min: [0, 0, 0], max: [1, 1, 0] }, triangles: 1 }],
      parts: [{ id: 'node-0', name: 'Panel', position: [0, 0, 0], primitives: [0] }],
    },
  };
}

describe('atomic model registration', () => {
  it('publishes none of a batch when a later model cannot be cloned', () => {
    const store = new ModelStore();
    const bad = Object.assign(model(), { extra: () => undefined });
    expect(() => store.register({ first: model(), bad })).toThrow();
    expect(Object.keys(store.metadata)).toEqual([]);
    expect(() => store.register({ first: { ...model(), sha256: 'c'.repeat(64) } })).not.toThrow();
    store.dispose();
  });

  it.each(['asset', 'kind', 'metadata', 'nested'] as const)('rejects %s accessors without executing them', location => {
    const asset = model();
    const batch: Record<string, Asset> = { first: model(), bad: asset };
    let reads = 0;
    const target = location === 'asset' ? batch : location === 'nested' ? asset.metadata.parts[0] : asset;
    const key = location === 'asset' ? 'bad' : location === 'nested' ? 'name' : location;
    Object.defineProperty(target, key, { enumerable: true, get() { reads++; return location === 'asset' ? asset : location === 'kind' ? 'model' : location === 'metadata' ? model().metadata : 'Panel'; } });
    const store = new ModelStore();
    expect(() => store.register(batch)).toThrow();
    expect(reads).toBe(0);
    expect(Object.keys(store.metadata)).toEqual([]);
    store.dispose();
  });

  it.each(['__proto__', 'constructor', 'prototype'])('rejects unsafe key %s before publication', key => {
    const bad = model();
    Object.defineProperty(bad.metadata.parts[0], key, { enumerable: true, value: {} });
    const store = new ModelStore();
    expect(() => store.register({ first: model(), bad })).toThrow();
    expect(Object.keys(store.metadata)).toEqual([]);
    store.dispose();
  });

  it('rejects model objects with custom prototypes', () => {
    const bad = Object.assign(Object.create({ inherited: true }), model());
    const store = new ModelStore();
    expect(() => store.register({ first: model(), bad })).toThrow();
    expect(Object.keys(store.metadata)).toEqual([]);
    store.dispose();
  });

  it.each(['c'.repeat(64), undefined])('rejects changing or removing provenance under an existing ID', provenanceSha256 => {
    const original = model();
    const store = new ModelStore({ existing: original });
    expect(() => store.register({ first: model(), existing: { ...original, provenanceSha256 } })).toThrow('immutable');
    expect(Object.keys(store.metadata)).toEqual(['existing']);
    expect(() => store.register({ existing: original })).not.toThrow();
    store.dispose();
  });

  it('rejects adding provenance under an existing ID', () => {
    const original = { ...model(), provenanceSha256: undefined };
    const store = new ModelStore({ existing: original });
    expect(() => store.register({ existing: model() })).toThrow('immutable');
    store.dispose();
  });

  it('rejects malformed provenance digests', () => {
    expect(() => new ModelStore({ bad: { ...model(), provenanceSha256: 'invalid' } })).toThrow();
  });

  it('accepts undefined optional fields and ignores ordinary audio assets', () => {
    const asset = { ...model(), sha256: undefined, provenanceSha256: undefined };
    asset.metadata.parts[0].parent = undefined;
    const store = new ModelStore({ audio: { kind: 'audio', url: '/audio.wav' }, model: asset });
    expect(Object.keys(store.metadata)).toEqual(['model']);
    asset.metadata.parts[0].name = 'Changed';
    expect(store.metadata.model.parts[0].name).toBe('Panel');
    store.dispose();
  });

  it('retains the previous URL when a later entry fails, then refreshes and shares one decode across aliases', async () => {
    const bytes = await modelFixture({ textured: true });
    const parsed = await parseModelGLB(bytes);
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), v => v.toString(16).padStart(2, '0')).join('');
    const original = { ...model(), sha256: hash, metadata: parsed.metadata };
    const reads: string[] = [];
    let decodes = 0;
    const store = new ModelStore({ fixture: original }, {
      read: async asset => { reads.push(asset.url); return bytes; },
      decode: async image => { decodes++; return { width: image.width, height: image.height, pixels: new Uint8Array(image.width * image.height * 4) }; },
    });
    try {
      expect(() => store.register({ fixture: { ...original, url: '/failed-refresh' }, bad: Object.assign(model(), { extra: () => undefined }) })).toThrow();
      const scene = await compileSource(modelSource, { models: store.metadata });
      await store.prepare([scene]);
      expect(reads).toEqual(['/model.glb']);
      store.register({ fixture: { ...original, url: '/new-signature' }, alias: { ...original, url: '/alias', provenanceSha256: 'c'.repeat(64) } });
      const aliasScene = await compileSource(modelSource.replace('fixture', 'alias'), { models: store.metadata });
      await Promise.all([store.prepare([scene]), store.prepare([aliasScene])]);
      expect(reads).toEqual(['/model.glb']);
      expect(decodes).toBe(1);
      const geometry = store.resolve(evaluateScene(scene, 1)).elements.find(e => e.geometry.kind === 'mesh')!.geometry;
      const aliasGeometry = store.resolve(evaluateScene(aliasScene, 1)).elements.find(e => e.geometry.kind === 'mesh')!.geometry;
      expect(aliasGeometry.vertices).toBe(geometry.vertices);
    } finally { store.dispose(); }
  });
});

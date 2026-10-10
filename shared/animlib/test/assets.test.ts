import { describe, expect, it } from 'vitest';
import { createAssetRegistry } from '../src/asset-registry.js';
import { model } from './asset-fixture.js';

describe('immutable prepared assets', () => {
  it('owns immutable geometry and content identity independently of caller mutations', async () => {
    const input = model(), registry = await createAssetRegistry([input]);
    const descriptor = registry.catalog[0], ref = { id: descriptor.id, hash: descriptor.hash, part: 'body' };
    input.parts[0].vertices[0][0] = 99;
    const lease = registry.acquire([ref]), mesh = lease.resolve(ref);
    expect(mesh.vertices![0][0]).toBe(0);
    expect(() => { mesh.vertices![0][0] = 7; }).toThrow();
    expect(() => { descriptor.parts[0].vertexCount = 999; }).toThrow();
    const same = await createAssetRegistry([model()]);
    expect(same.catalog[0].hash).toBe(descriptor.hash);
    expect(registry.stats().leases).toBe(1);
    lease.dispose(); expect(registry.stats().leases).toBe(0);
    expect(() => lease.resolve(ref)).toThrow(/disposed/);
  });
  it('shares storage across repeated refs and independent leases', async () => {
    const registry = await createAssetRegistry([model()]), d = registry.catalog[0];
    const ref = { id: d.id, hash: d.hash, part: 'body' }, a = registry.acquire(Array(100).fill(ref)), b = registry.acquire([ref]);
    expect(a.resolve(ref)).toBe(b.resolve(ref));
    expect(registry.stats().pinnedBytes).toBe(registry.stats().decodedBytes);
    a.dispose(); a.dispose(); expect(b.resolve(ref).vertices).toHaveLength(3);
    b.dispose(); expect(registry.stats().pinnedBytes).toBe(0);
  });
  it('acquires transactionally and rejects missing or stale references', async () => {
    const registry = await createAssetRegistry([model()]), d = registry.catalog[0];
    const ref = { id: d.id, hash: d.hash, part: 'body' };
    for (const bad of [{...ref, hash:'b'.repeat(64)}, {...ref,id:'absent'}, {...ref,part:'absent'}]) {
      expect(() => registry.acquire([ref,bad])).toThrow();
      expect(registry.stats().leases).toBe(0);
    }
  });
  it.each(['coordinates','indices','normals','duplicate parts','license','units','overflow'])('rejects invalid %s', async kind => {
    const m = model();
    if (kind === 'coordinates') m.parts[0].vertices[0][0] = NaN;
    if (kind === 'indices') m.parts[0].triangles[0][0] = 99;
    if (kind === 'normals') m.parts[0].normals = [[0,0,0],[0,0,1],[0,0,1]];
    if (kind === 'duplicate parts') m.parts.push(structuredClone(m.parts[0]));
    if (kind === 'license') m.provenance.license = '';
    if (kind === 'units') m.units = '';
    if (kind === 'overflow') m.parts[0].vertices = Array(20001).fill([0,0,0]);
    await expect(createAssetRegistry([m])).rejects.toThrow();
  });
  it('bounds the entire registry and rejects duplicate asset IDs', async () => {
    await expect(createAssetRegistry([model(),model()])).rejects.toThrow(/duplicate/i);
    await expect(createAssetRegistry([model()], { maxBytes: 1 })).rejects.toThrow(/limit/i);
  });
});

import { describe, expect, it } from 'vitest';
import { createMolecularEnvelope, createMolecularEnvelopeParts } from '../src/molecular-envelope.js';

describe('bounded offline molecular envelope parts', () => {
  const options = { positions: [-.6, 0, 0, .6, 0, 0], sigma: 1, isoLevel: .4, resolution: 14 };

  it('preserves the single-mesh output exactly when no split is needed', () => {
    expect(createMolecularEnvelopeParts(options)).toEqual([createMolecularEnvelope(options)]);
  });

  it('partitions complete faces without changing shared coordinates or shading', () => {
    const whole = createMolecularEnvelope(options);
    const parts = createMolecularEnvelopeParts({ ...options, trianglesPerPart: 64 });
    const expanded = parts.flatMap(p => p.triangles!.map(t => t.map(i => p.vertices![i])));
    expect(expanded).toEqual(whole.triangles!.map(t => t.map(i => whole.vertices![i])));
    expect(parts.length).toBeGreaterThan(1);
    const normals = new Map(whole.vertices!.map((v, i) => [JSON.stringify(v), whole.normals![i]]));
    for (const part of parts) {
      expect(part.triangles!.length).toBeLessThanOrEqual(64);
      expect(part.vertices!.length).toBeLessThanOrEqual(20000);
      expect(part.shading).toBe('smooth');
      part.vertices!.forEach((v, i) => expect(part.normals![i]).toEqual(normals.get(JSON.stringify(v))));
    }
    expect(createMolecularEnvelopeParts({ ...options, trianglesPerPart: 64 })).toEqual(parts);
  });

  it('supports finer surfaces while preserving old ceilings and rejecting invalid budgets', () => {
    const dense = { ...options, isoLevel: .2, resolution: 64 };
    expect(() => createMolecularEnvelope(dense)).toThrow(/budget/);
    const parts = createMolecularEnvelopeParts(dense);
    expect(parts.reduce((n, p) => n + p.triangles!.length, 0)).toBeGreaterThan(20000);
    expect(parts.every(p => p.triangles!.length <= 12000 && p.vertices!.length <= 20000)).toBe(true);
    for (const trianglesPerPart of [0, 63, 20001, 64.5, NaN, Infinity]) {
      expect(() => createMolecularEnvelopeParts({ ...options, trianglesPerPart })).toThrow(/part/i);
    }
    for (const maxTotalTriangles of [0, 160001, 100.5, NaN, Infinity]) {
      expect(() => createMolecularEnvelopeParts({ ...options, maxTotalTriangles })).toThrow(/triangle/i);
    }
    expect(() => createMolecularEnvelopeParts({ ...options, maxTotalTriangles: 10 })).toThrow(/triangle/i);
    expect(() => createMolecularEnvelopeParts({ ...dense, trianglesPerPart: 64 })).toThrow(/part/i);
    expect(() => createMolecularEnvelopeParts({ ...options, positions: Array(30000).fill(0), resolution: 64 })).toThrow(/work/i);
  });
});

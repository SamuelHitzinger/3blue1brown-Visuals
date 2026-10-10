import type { PreparedModelInput } from '../src/asset-types.js';

export function model(id = 'test'): PreparedModelInput {
  return { id, kind: 'model', version: 1, units: 'metre', provenance: {
    source: 'https://example.org/test.obj', sourceHash: 'a'.repeat(64), creator: 'Test fixture', license: 'CC0-1.0',
    preparedAt: '2026-10-11', converter: { name: 'test', version: '1', options: {} }, selection: 'all', modifications: [], fidelity: 'Synthetic test triangle',
  }, parts: [{ id: 'body', vertices: [[0,0,0],[1,0,0],[0,1,0]], triangles: [[0,1,2]] }] };
}

import { describe, expect, it } from 'vitest';
import { createModelGLB } from '../src/model-export.js';
import type { GeneratedModel } from '../src/model-export.js';
import { parseModelGLB } from '../src/models.js';
import type { Vec3 } from '../src/types.js';

const triangle = {
  name: 'Curved patch',
  vertices: [[0, 0, 0], [1, 0, 0], [0, 1, 0]] as Vec3[],
  triangles: [[0, 1, 2]] as [number, number, number][],
};

describe('generated model normals', () => {
  it('retains supplied per-vertex normals and smooth shading through GLB publication', async () => {
    const part = { ...triangle, normals: [[0, 0, 1], [0, 0.6, 0.8], [1, 0, 0]] as Vec3[] };
    const parsed = await parseModelGLB(await createModelGLB({ parts: [part] }));
    const geometry = parsed.primitives[0].geometry;

    expect(geometry.shading).toBe('smooth');
    expect(geometry.normals).toHaveLength(3);
    expect(geometry.normals![0]).toEqual([0, 0, 1]);
    expect(geometry.normals![1][0]).toBe(0);
    expect(geometry.normals![1][1]).toBeCloseTo(0.6, 6);
    expect(geometry.normals![1][2]).toBeCloseTo(0.8, 6);
    expect(geometry.normals![2]).toEqual([1, 0, 0]);
  });

  it('keeps flat shading for existing models without supplied normals', async () => {
    const parsed = await parseModelGLB(await createModelGLB({ parts: [triangle] }));

    expect(parsed.primitives[0].geometry.shading).toBe('flat');
    expect(parsed.primitives[0].geometry.normals).toBeUndefined();
  });

  it.each([
    ['wrong count', [[0, 0, 1]]],
    ['NaN component', [[NaN, 0, 1], [0, 0, 1], [0, 0, 1]]],
    ['infinite component', [[0, Infinity, 1], [0, 0, 1], [0, 0, 1]]],
    ['zero vector', [[0, 0, 0], [0, 0, 1], [0, 0, 1]]],
    ['out-of-bounds component', [[1e7, 0, 0], [0, 0, 1], [0, 0, 1]]],
    ['malformed vector', [[0, 1], [0, 0, 1], [0, 0, 1]]],
    ['null normals', null],
  ])('rejects %s rather than silently publishing flat geometry', async (_name, normals) => {
    const model = { parts: [{ ...triangle, normals }] } as unknown as GeneratedModel;

    await expect(createModelGLB(model)).rejects.toThrow(/normal/i);
  });
});

describe('generated model vertex colors', () => {
  it('retains red and blue atom colors with alpha through GLB publication', async () => {
    const part = {
      ...triangle,
      normals: [[0, 0, 1], [0, 0, 1], [0, 0, 1]] as Vec3[],
      vertexColors: [[1, 0, 0, 1], [0, 0, 1, 1], [0.25, 0.5, 0.75, 0.5]] as [number, number, number, number][],
    };
    const parsed = await parseModelGLB(await createModelGLB({ parts: [part] }));

    expect(parsed.primitives[0].colors).toEqual([[1, 0, 0, 1], [0, 0, 1, 1], [0.25, 0.5, 0.75, 0.5]]);
    expect(parsed.primitives[0].material.alpha).toBe('BLEND');
    expect(parsed.primitives[0].geometry.normals).toEqual([[0, 0, 1], [0, 0, 1], [0, 0, 1]]);
  });

  it('keeps existing models without vertex colors valid', async () => {
    const parsed = await parseModelGLB(await createModelGLB({ parts: [triangle] }));

    expect(parsed.primitives[0].colors).toBeUndefined();
    expect(parsed.primitives[0].geometry.vertices).toEqual([[0, 0, 0], [1, 0, 0], [0, 1, 0]]);
  });

  it.each([
    ['wrong count', [[1, 0, 0, 1]]],
    ['NaN component', [[NaN, 0, 0, 1], [0, 0, 1, 1], [1, 1, 1, 1]]],
    ['infinite component', [[1, Infinity, 0, 1], [0, 0, 1, 1], [1, 1, 1, 1]]],
    ['negative component', [[-0.01, 0, 0, 1], [0, 0, 1, 1], [1, 1, 1, 1]]],
    ['component above one', [[1.01, 0, 0, 1], [0, 0, 1, 1], [1, 1, 1, 1]]],
    ['alpha above one', [[1, 0, 0, 1.01], [0, 0, 1, 1], [1, 1, 1, 1]]],
    ['RGB without alpha', [[1, 0, 0], [0, 0, 1, 1], [1, 1, 1, 1]]],
    ['extra component', [[1, 0, 0, 1, 0], [0, 0, 1, 1], [1, 1, 1, 1]]],
    ['sparse color', [[1, , 0, 1], [0, 0, 1, 1], [1, 1, 1, 1]]],
    ['sparse color list', [[1, 0, 0, 1], , [1, 1, 1, 1]]],
    ['null colors', null],
  ])('rejects %s rather than publishing invalid vertex colors', async (_name, vertexColors) => {
    const model = { parts: [{ ...triangle, vertexColors }] } as unknown as GeneratedModel;

    await expect(createModelGLB(model)).rejects.toThrow(/color/i);
  });
});

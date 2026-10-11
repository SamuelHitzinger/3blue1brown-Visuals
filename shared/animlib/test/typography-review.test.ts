import { captureDraws } from './gpu-capture.js';
import { describe, expect, it, vi } from 'vitest';
import { compileSource } from '../src/compiler.js';
import { flattenSvgPath, layoutLatex, layoutLatexGeometry } from '../src/latex.js';
import { SceneSequence } from '../src/sequence.js';
import { evaluateScene } from '../src/timeline.js';
import { CanvasRenderer } from '../src/renderer.js';
import { initialSources } from '../demo/scenes.js';
import type { ElementState, Geometry, Vec3 } from '../src/types.js';

const numeric = (body: string, props = '') => String.raw`export default scene({}, s => {
  const label = s.latex('label', { tex: '\\animpart{lhs}{v}=\\animnum{x}+\\animnum{y}',
    anchor: 'lhs', numbers: { x: -2, y: 1 }, numberFormat: { digits: 2, decimals: 2 }, ${props} });
  ${body}
});`;

describe('typography review: numeric timelines', () => {
  it('counts independent slots through zero and reconstructs a prior midpoint after seeking forward', async () => {
    const scene = await compileSource(numeric(`s.play([label.countTo({x: 4, y: -3}), label.moveTo([2, 0])], {duration: 2, ease: 'linear'});
      s.play(label.countTo({x: 8}), {duration: 2, ease: 'linear'});`));
    const midpoint = evaluateScene(scene, 1);
    expect(midpoint.elements[0].geometry.numbers).toEqual({ x: 1, y: -1 });
    expect(midpoint.elements[0].position).toEqual([1, 0, 0]);
    expect(evaluateScene(scene, 3).elements[0].geometry.numbers).toEqual({ x: 6, y: -3 });
    expect(evaluateScene(scene, 4).elements[0].geometry.numbers).toEqual({ x: 8, y: -3 });
    expect(evaluateScene(scene, 1)).toEqual(midpoint);
    expect(evaluateScene(scene, 0).elements[0].geometry.numbers).toEqual({ x: -2, y: 1 });
  });

  it('rejects simultaneous morph/count actions in either order', async () => {
    const morph = String.raw`label.morphTo({kind: 'latex', tex: '\\animpart{lhs}{Av}=\\animnum{x}+\\animnum{y}',
      anchor: 'lhs', numbers: {x: 4, y: 1}, numberFormat: {digits: 2, decimals: 2}}, {map: {lhs: 'lhs'}})`;
    for (const actions of [`${morph}, label.countTo({x: 4})`, `label.countTo({x: 4}), ${morph}`]) {
      await expect(compileSource(numeric(`s.play([${actions}], {duration: 1});`))).rejects.toThrow('Conflicting');
    }
  });

  it('rejects unknown slots and formatted digit overflow at initial and target values', async () => {
    await expect(compileSource(numeric(`s.play(label.countTo({missing: 1}), {duration: 1});`))).rejects.toThrow(/slot/i);
    await expect(compileSource(numeric(`s.play(label.countTo({x: 99.999}), {duration: 1});`))).rejects.toThrow(/digit width/i);
    await expect(compileSource(numeric('', 'numbers: {x: -99.999, y: 0}'))).rejects.toThrow(/digit width/i);
  });

  it('rejects malformed format containers and invalid format ranges', async () => {
    for (const format of ['[]', 'null', 'true', '"2"', '{decimals: -1}', '{decimals: 5}', '{decimals: 1.5}', '{decimals: "2"}', '{digits: 0}', '{digits: 7}', '{digits: 1.5}']) {
      await expect(compileSource(numeric('', `numberFormat: ${format}`)), format).rejects.toThrow(/format/i);
    }
  });

  it.each(['{decimals: NaN}', '{decimals: Infinity}', '{digits: NaN}', '{digits: Infinity}'])('rejects nonfinite format fields before VM serialization: %s', async format => {
    await expect(compileSource(numeric('', `numberFormat: ${format}`))).rejects.toThrow(/format/i);
  });

  it('rebuilds downstream numeric counts from current upstream control values', async () => {
    const sequence = new SceneSequence();
    try {
      const loaded = await sequence.submit({type: 'load', scenes: [
        {id: 'a', source: String.raw`export default scene({}, s => {
          const start = s.slider('start', {default: 1, min: -5, max: 5});
          const label = s.latex('label', {tex: '\\animnum{x}', numbers: {x: start}, numberFormat: {digits: 2, decimals: 2}});
          s.play(label.countTo({x: start + 2}), {duration: 2, ease: 'linear'}); s.keep(label);
        });`},
        {id: 'b', source: `export default scene({}, s => {
          s.play(s.previous.get('label').countTo({x: 10}), {duration: 2, ease: 'linear'});
        });`},
      ]});
      expect(loaded.ok).toBe(true);
      expect(sequence.frame(1, 1).elements[0].geometry.numbers).toEqual({x: 6.5});
      await sequence.setControl('a', 'start', 4);
      expect(sequence.frame(0, 1).elements[0].geometry.numbers).toEqual({x: 5});
      expect(sequence.frame(1, 0).elements[0].geometry.numbers).toEqual({x: 6});
      expect(sequence.frame(1, 1).elements[0].geometry.numbers).toEqual({x: 8});
    } finally { sequence.dispose(); }
  });
});

describe('typography review: SVG contour fidelity', () => {
  it('preserves relative subpath origins, horizontal/vertical endpoints, and closure', () => {
    expect(flattenSvgPath('M10 10h20v30h-20z m50 0h10v10h-10z')).toEqual([
      [[10,10,0], [30,10,0], [30,40,0], [10,40,0], [10,10,0]],
      [[60,10,0], [70,10,0], [70,20,0], [60,20,0], [60,10,0]],
    ]);
  });

  it('keeps sharp serif corners in the n glyph used by ascending', () => {
    const points = layoutLatex(String.raw`\text{n}`).paths.flatMap(path => path.contours.flat());
    // MathJax's bundled upright n has a 556x442 viewBox and an H542,V0 serif corner.
    // Exact command endpoints must survive flattening so a straight edge cannot cut it off.
    for (const [x, y] of [[542, 46], [542, 0], [25, 46], [25, 408]]) {
      const distance = Math.min(...points.map(p => Math.hypot(p[0] - (x - 278) / 1000, p[1] - (y - 221) / 1000)));
      expect(distance, `glyph endpoint ${x},${y}`).toBeLessThan(1e-8);
    }
  });
});

describe('typography review: numeric layout and anchors', () => {
  const bounds = (layout: ReturnType<typeof layoutLatexGeometry>, part: string) => {
    const points = layout.paths.filter(path => path.part === part).flatMap(path => path.contours.flat());
    return [Math.min(...points.map(p => p[0])), Math.max(...points.map(p => p[0])), Math.min(...points.map(p => p[1])), Math.max(...points.map(p => p[1]))];
  };

  it('keeps surrounding parts fixed through signs, decimals, and changing integer widths', () => {
    const geometry = {kind: 'latex' as const, tex: String.raw`\animpart{lhs}{v}\animpart{equals}{=}\animpart{rhs}{\begin{bmatrix}\animnum{x}\\\animnum{y}\end{bmatrix}}`, anchor: 'lhs', numberFormat: {digits: 2, decimals: 2}};
    const base = layoutLatexGeometry({...geometry, numbers: {x: 1.25, y: -2.5}});
    for (const numbers of [{x: -12.5, y: 0}, {x: 99.99, y: -0}, {x: -0.001, y: 10}]) {
      const layout = layoutLatexGeometry({...geometry, numbers});
      for (const part of ['lhs', 'equals']) expect(bounds(layout, part)).toEqual(bounds(base, part));
      expect(layout.width).toBe(base.width);
      expect(layout.height).toBe(base.height);
      expect(layout.paths.flatMap(path => path.contours.flat()).every(point => point.every(Number.isFinite))).toBe(true);
    }
    const [left, right, bottom, top] = bounds(base, 'lhs');
    expect(left + right).toBeCloseTo(0, 10);
    expect(bottom + top).toBeCloseTo(0, 10);
  });

  it('renders numeric slots at the TeX scale inside subscripts', () => {
    for (const template of [String.raw`x_{VALUE}`, String.raw`x^{VALUE}`, String.raw`x_{y_{VALUE}}`, String.raw`\frac{1}{VALUE}`]) {
      const numeric = layoutLatexGeometry({kind: 'latex', tex: template.replace('VALUE', String.raw`\animpart{num}{\animnum{n}}`), numbers: {n: 12}, numberFormat: {digits: 2, decimals: 0}});
      const literal = layoutLatexGeometry({kind: 'latex', tex: template.replace('VALUE', String.raw`\animpart{num}{12}`)});
      const a = bounds(numeric, 'num'), b = bounds(literal, 'num');
      expect(a[3] - a[2], template).toBeCloseTo(b[3] - b[2], 8);
      expect(a[1] - a[0], template).toBeCloseTo(b[1] - b[0], 8);
    }
  });

  it('draws the rounded sign and digits without a minus on rounded zero', () => {
    const cases: [number, number, string][] = [
      [-0, 2, '0.00'], [-0.004, 2, '0.00'], [0.004, 2, '0.00'],
      [-0.006, 2, '-0.01'], [0.006, 2, '0.01'], [-9.996, 2, '-10.00'],
      [9.996, 2, '10.00'], [-0.49, 0, '0'], [-0.51, 0, '-1'],
      [0.00006, 4, '0.0001'], [-0.00004, 4, '0.0000'],
    ];
    const normalized = (layout: ReturnType<typeof layoutLatexGeometry>) => {
      const points = layout.paths.flatMap(path => path.contours.flat());
      const right = Math.max(...points.map(point => point[0]));
      return layout.paths.map(path => path.contours.map(contour => contour.map(point =>
        [point[0] - right, point[1] - layout.baseline, point[2]])));
    };
    for (const [value, decimals, formatted] of cases) {
      const actual = layoutLatexGeometry({kind: 'latex', tex: String.raw`\animnum{n}`, numbers: {n: value}, numberFormat: {digits: 2, decimals}});
      const expected = layoutLatexGeometry({kind: 'latex', tex: formatted});
      const a = normalized(actual), b = normalized(expected);
      expect(a.length, `${value} → ${formatted}`).toBe(b.length);
      a.forEach((contours, i) => {
        expect(contours.length).toBe(b[i].length);
        contours.forEach((contour, j) => {
          expect(contour.length).toBe(b[i][j].length);
          contour.forEach((point, k) => point.forEach((coordinate, axis) =>
            expect(coordinate, `${value} → ${formatted}`).toBeCloseTo(b[i][j][k][axis], 10)));
        });
      });
    }
  });

  it('validates rounded integer carry against reserved width for both signs', async () => {
    for (const sign of [-1, 1]) {
      expect(() => layoutLatexGeometry({kind: 'latex', tex: String.raw`\animnum{n}`, numbers: {n: sign * 99.996}, numberFormat: {digits: 2, decimals: 2}})).toThrow(/digit width/i);
      await expect(compileSource(numeric(`s.play(label.countTo({x: ${sign * 99.996}}), {duration: 1});`))).rejects.toThrow(/digit width/i);
      expect(() => layoutLatexGeometry({kind: 'latex', tex: String.raw`\animnum{n}`, numbers: {n: sign * 99.994}, numberFormat: {digits: 2, decimals: 2}})).not.toThrow();
    }
  });

  it('preserves the restored demo Av anchors and slot placement across the entire stretch range', async () => {
    const partPaths = (geometry: Geometry, part: string) => layoutLatexGeometry(geometry).paths
      .filter(path => path.part === part)
      .map(path => path.contours.map(contour => contour.map(point => point.map(value => Number(value.toFixed(10))))));
    const slotContours = (geometry: Geometry) => layoutLatexGeometry(geometry).numericSlots
      .map(slot => slot.contours.map(contour => contour.map(point => point.map(value => Number(value.toFixed(10))))));
    for (const stretch of [0.4, 1.5, 2]) {
      const scene = await compileSource(initialSources[0].source, {controls: {stretch}});
      const prefix = scene.tracks.find(track => track.action.type === 'morph' && track.action.ids.includes('equation'))!;
      const count = scene.tracks.find(track => track.action.type === 'numbers' && track.action.ids.includes('equation'))!;
      const original = prefix.from.equation.geometry;
      const prefixed = prefix.action.geometry!;
      expect(prefixed.tex).toContain(String.raw`\animpart{A}{A}`);
      expect(prefix.action.map).toEqual({v: 'v', equals: 'equals', rhs: 'rhs'});
      for (const part of ['v', 'equals', 'rhs']) expect(partPaths(prefixed, part)).toEqual(partPaths(original, part));
      for (const fraction of [0, 0.000001, 0.5, 0.999999, 1]) {
        const equation = evaluateScene(scene, count.start + count.duration * fraction).elements.find(element => element.id === 'equation')!;
        expect(equation.position).toEqual(prefix.from.equation.position);
        expect(equation.geometry.anchor).toBe('v');
        for (const part of ['A', 'v', 'equals']) expect(partPaths(equation.geometry, part)).toEqual(partPaths(prefixed, part));
        expect(slotContours(equation.geometry)).toEqual(slotContours(original));
        expect(equation.geometry.numbers!.x).toBeGreaterThanOrEqual(Math.min(1.5, 1.5 * stretch));
        expect(equation.geometry.numbers!.x).toBeLessThanOrEqual(Math.max(1.5, 1.5 * stretch));
      }
      expect(evaluateScene(scene, scene.duration).elements.find(element => element.id === 'equation')!.geometry.numbers).toEqual({x: 1.5 * stretch});
    }
  });

  it('rejects missing/unused numeric values, unknown anchors, and nested named parts', () => {
    expect(() => layoutLatexGeometry({kind: 'latex', tex: String.raw`\animnum{n}`})).toThrow(/missing/i);
    expect(() => layoutLatexGeometry({kind: 'latex', tex: 'x', numbers: {n: 1}})).toThrow(/correspond/i);
    expect(() => layoutLatexGeometry({kind: 'latex', tex: String.raw`\animpart{v}{v}`, anchor: 'missing'})).toThrow(/anchor/i);
    expect(() => layoutLatexGeometry({kind: 'latex', tex: String.raw`\animpart{outer}{\animpart{inner}{v}}`})).toThrow(/nested/i);
  });
});

it('keeps mapped glyphs visually identical throughout a self-morph and the restored Av prefix morph', async () => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  vi.stubGlobal('GPUBufferUsage', {UNIFORM: 1, COPY_DST: 2, VERTEX: 4});
  vi.stubGlobal('GPUTextureUsage', {RENDER_ATTACHMENT: 1});
  const writes: Float32Array[] = [];
  const capture = captureDraws(writes);
  let stride = 0;
  const device = {
    limits: {maxTextureDimension2D: 8192}, lost: new Promise(() => {}), addEventListener() {}, destroy() {},
    createShaderModule: () => ({getCompilationInfo: async () => ({messages: []})}),
    createRenderPipelineAsync: async (descriptor: {vertex: {buffers: {arrayStride: number}[]}}) => {
      stride = descriptor.vertex.buffers[0].arrayStride / 4; return {getBindGroupLayout: () => ({})};
    },
    createSampler: () => ({}), createBuffer: capture.createBuffer, createBindGroup: capture.createBindGroup,
    createTexture: ({size}: {size: number[]}) => ({width: size[0], height: size[1], createView: () => ({}), destroy() {}}),
    queue: capture.queue,
    createCommandEncoder: () => ({beginRenderPass: () => capture.pass, finish: () => ({})}),
  };
  vi.stubGlobal('navigator', {gpu: {requestAdapter: async () => ({requestDevice: async () => device}), getPreferredCanvasFormat: () => 'bgra8unorm'}});
  const canvas = {width: 800, height: 450, style: {}, getBoundingClientRect: () => ({width: 800, height: 450}),
    getContext: () => ({configure() {}, unconfigure() {}, getCurrentTexture: () => ({createView: () => ({})})}),
    addEventListener() {}, removeEventListener() {}} as unknown as HTMLCanvasElement;
  const renderer = new CanvasRenderer(canvas);
  try {
    await renderer.prepare([]);
    const geometry: Geometry = {kind: 'latex', tex: String.raw`\animpart{glyph}{\text{n}}`, fontSize: 1};
    const element: ElementState = {id: 'label', geometry, position: [0,0,0], rotation: [0,0,0], scale: 1,
      opacity: 1, fill: "WHITE", stroke: 'none', strokeWidth: 0, space: 'world', persistent: false};
    const area = (progress?: number) => {
      writes.length = 0;
      renderer.render({elements: [{...element, ...(progress === undefined ? {} : {morph: {from: geometry, to: geometry, progress, map: {glyph: 'glyph'}}})}],
        camera: {yaw: 0, pitch: 0, target: [0,0,0], height: 8, distance: 10, perspective: 0}, cameraAnimated: false},
      {mode: '2d', end: 'hold', orbit: false, background: "BLACK"});
      const data = writes[0], points = Array.from({length: data.length / stride}, (_, i) => Array.from(data.subarray(i * stride, i * stride + 3)) as Vec3);
      let total = 0;
      for (let i = 0; i < points.length; i += 3) {
        const [a,b,c] = points.slice(i, i + 3);
        total += Math.abs((b[0]-a[0])*(c[1]-a[1]) - (b[1]-a[1])*(c[0]-a[0])) / 2;
      }
      return total;
    };
    const original = area();
    for (const progress of [0, 0.000001, 0.5, 0.999999]) expect(area(progress), `morph progress ${progress}`).toBeCloseTo(original, 6);
    const scene = await compileSource(initialSources[0].source);
    const prefix = scene.tracks.find(track => track.action.type === 'morph' && track.action.ids.includes('equation'))!;
    const originalPoints = layoutLatexGeometry(prefix.from.equation.geometry).paths.flatMap(path => path.contours.flat());
    const sourceLeft = Math.min(...originalPoints.map(point => point[0]));
    const aPoints = layoutLatexGeometry(prefix.action.geometry!).paths.filter(path => path.part === 'A').flatMap(path => path.contours.flat());
    expect(Math.max(...aPoints.map(point => point[0]))).toBeLessThan(sourceLeft);
    const mappedLeft = prefix.from.equation.position[0] + sourceLeft * prefix.from.equation.geometry.fontSize!;
    const stationaryVertices = (time: number) => {
      writes.length = 0;
      const frame = evaluateScene(scene, time);
      renderer.render({...frame, elements: frame.elements.filter(element => element.id === 'equation')}, scene.options);
      const data = writes[0], vertices: string[] = [];
      for (let i = 0; i < data.length; i += stride) {
        // A is wholly left of the mapped glyphs. Smooth easing can round its alpha
        // to 1 in Float32 near completion, so alpha alone cannot exclude it.
        if (data[i + 6] !== 1 || data[i] < mappedLeft - 1e-6) continue;
        vertices.push(Array.from(data.subarray(i, i + 3), coordinate => Number(coordinate.toFixed(7))).join(','));
      }
      return vertices.sort();
    };
    const beforePrefix = stationaryVertices(prefix.start);
    expect(beforePrefix.length).toBeGreaterThan(0);
    for (const progress of [0.000001, 0.5, 0.999999]) {
      expect(stationaryVertices(prefix.start + prefix.duration * progress), `Av prefix progress ${progress}`).toEqual(beforePrefix);
    }
  } finally { renderer.dispose(); vi.unstubAllGlobals(); }
});

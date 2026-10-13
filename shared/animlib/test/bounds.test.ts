import { describe, expect, it } from 'vitest';
import { compileSource, evaluateScene, getCameraBounds, getLocalBounds, getScreenBounds, getWorldBounds, detectOverlaps } from '../src/core.js';
import type { Bounds3D, CameraState, ElementState, Frame, Geometry } from '../src/types.js';

const camera: CameraState = { yaw: 0, pitch: 0, target: [0, 0, 0], height: 8, distance: 10, perspective: 0 };
const viewport = { width: 800, height: 400 };
const element = (id: string, geometry: Geometry, extra: Partial<ElementState> = {}): ElementState => ({
  id, geometry, position: [0, 0, 0], rotation: [0, 0, 0], scale: 1, opacity: 1,
  fill: 'WHITE', stroke: 'none', strokeWidth: 0.1, space: 'world', persistent: false, ...extra,
});
const rect = (id = 'r', extra: Partial<ElementState> = {}) => element(id, { kind: 'rectangle', width: 2, height: 1 }, extra);
const frame = (...elements: ElementState[]): Frame => ({ elements, camera, cameraAnimated: false });
const close3D = (actual: Bounds3D | undefined, min: number[], max: number[]) => {
  expect(actual).toBeDefined();
  for (let i = 0; i < 3; i++) {
    expect(actual!.min[i]).toBeCloseTo(min[i], 5);
    expect(actual!.max[i]).toBeCloseTo(max[i], 5);
  }
};

describe('public bounds queries', () => {
  it('distinguishes local, world, camera-depth, and canvas-pixel coordinates', () => {
    const state = frame(rect('r', { position: [2, 1, 3], rotation: [0, 0, Math.PI/2], scale: 2 }));
    close3D(getLocalBounds(state, 'r'), [-1, -0.5, 0], [1, 0.5, 0]);
    close3D(getWorldBounds(state, 'r'), [1, -1, 3], [3, 3, 3]);
    close3D(getCameraBounds(state, 'r'), [1, -1, 7], [3, 3, 7]);
    expect(getScreenBounds(state, 'r', viewport)).toEqual({ left: 450, top: 50, right: 550, bottom: 250 });
  });

  it('uses target, yaw and pitch in camera coordinates, before perspective division', () => {
    const state = frame(rect('r', { position: [2, 1, 3] }));
    const turn = { ...camera, target: [1, 1, 1] as [number, number, number], yaw: Math.PI/2, pitch: Math.PI/2 };
    close3D(getCameraBounds(state, 'r', { camera: turn }), [-2, 0, 9.5], [-2, 2, 10.5]);
  });

  it('unions nested group descendants, retaining ancestors for child world bounds', () => {
    const child = rect('child', { position: [2, 0, 0] });
    const other = rect('other', { position: [-2, 0, 0] });
    const inner = element('inner', { kind: 'group', children: ['child'] }, { rotation: [0, 0, Math.PI/2] });
    const outer = element('outer', { kind: 'group', children: ['inner', 'other'], isolated: true }, { position: [5, 1, 0], scale: 2 });
    const state = frame(child, other, inner, outer), before = structuredClone(state);
    close3D(getLocalBounds(state, 'outer'), [-3, -0.5, 0], [0.5, 3, 0]);
    close3D(getWorldBounds(state, 'outer'), [-1, 0, 0], [6, 7, 0]);
    close3D(getWorldBounds(state, 'child'), [4, 3, 0], [6, 7, 0]);
    close3D(getLocalBounds(state, 'inner'), [1, -0.5, 0], [3, 0.5, 0]);
    expect(state).toEqual(before);
  });

  it('includes actual painted stroke geometry and arrowheads optionally', () => {
    const state = frame(rect('r', { stroke: 'BLUE', strokeWidth: 0.2 }));
    close3D(getLocalBounds(state, 'r'), [-1.1, -0.6, 0], [1.1, 0.6, 0]);
    close3D(getLocalBounds(state, 'r', { includeStroke: false }), [-1, -0.5, 0], [1, 0.5, 0]);
    const arrow = element('arrow', { kind: 'arrow', points: [[0, 0, 0], [2, 0, 0]] }, { fill: 'none', stroke: 'WHITE', strokeWidth: 0.2 });
    const box = getWorldBounds(frame(arrow), 'arrow')!;
    expect(box.max[0]).toBe(2); expect(box.max[1]).toBeCloseTo(0.28);
    expect(getWorldBounds(frame(arrow), 'arrow', { includeStroke: false })).toBeUndefined();
  });

  it.each(['circle', 'sphere'] as const)('measures tessellated %s geometry', kind => {
    close3D(getWorldBounds(frame(element('s', { kind, radius: 2 })), 's'), [-2, -2, kind === 'sphere' ? -2 : 0], [2, 2, kind === 'sphere' ? 2 : 0]);
  });

  it('ignores unreferenced mesh vertices and uses current compatible morph geometry', () => {
    const from: Geometry = { kind: 'mesh', vertices: [[0, 0, 0], [2, 0, 0], [0, 2, 1], [999, 999, 999]], triangles: [[0, 1, 2]] };
    const to: Geometry = { ...from, vertices: [[2, 0, 0], [4, 0, 0], [2, 4, 3], [999, 999, 999]] };
    const state = frame(element('m', from, { morph: { from, to, progress: 0.5 } }));
    close3D(getWorldBounds(state, 'm'), [1, 0, 0], [3, 3, 2]);
  });

  it('measures seeked curved geometry and crossfades without mutating a compiled frame', async () => {
    const compiled = await compileSource(`export default scene({}, s => {
      const p = s.path('p', { d: 'M 0 0 Q 1 2 2 0', fill: Color.NONE, stroke: Color.WHITE });
      s.play(p.morphTo({kind:'path', d:'M 0 0 Q 1 4 4 0'}), {duration:2, ease:'linear'});
    });`);
    const state = evaluateScene(compiled, 1), before = structuredClone(state);
    const box = getLocalBounds(state, 'p')!;
    expect(box.max[0]).toBeGreaterThanOrEqual(3);
    expect(box.max[1]).toBeGreaterThan(1.4); expect(box.max[1]).toBeLessThan(1.6);
    expect(state).toEqual(before);
    const from: Geometry = { kind: 'rectangle', width: 2, height: 1 }, to: Geometry = { kind: 'sphere', radius: 2 };
    close3D(getWorldBounds(frame(element('cross', from, { morph: { from, to, progress: 0.5 } })), 'cross'), [-2, -2, -2], [2, 2, 2]);
  });

  it('exposes standalone text and anchored LaTeX bounds using the overlap glyph geometry', () => {
    const text = element('a', { kind: 'text', text: 'Hello', fontSize: 2 });
    const state = frame(text), standalone = getScreenBounds(state, 'a', viewport)!;
    expect(standalone.right).toBeGreaterThan(standalone.left);
    expect(standalone.bottom).toBeGreaterThan(standalone.top);
    state.elements.push({ ...text, id: 'b' });
    expect(detectOverlaps(state, viewport)[0].elementBounds[0]).toEqual(standalone);
    const latex = element('formula', { kind: 'latex', tex: String.raw`x+\animpart{rhs}{y}`, anchor: 'rhs', fontSize: 2 });
    const box = getLocalBounds(frame(latex), 'formula')!;
    expect(box.min[0]).toBeLessThan(-1); expect(box.max[0]).toBeGreaterThan(0);
  });

  it('follows camera-facing billboard geometry while local bounds retain authored axes', () => {
    const state = frame(rect('r', { billboard: true, billboardOffset: [0, 0, 1], rotation: [Math.PI/2, 0, 0] }));
    const turn = { ...camera, yaw: Math.PI/2 };
    close3D(getLocalBounds(state, 'r', { camera: turn }), [-1, -0.5, 0], [1, 0.5, 0]);
    close3D(getWorldBounds(state, 'r', { camera: turn }), [1, -0.5, -1], [1, 0.5, 1]);
    close3D(getCameraBounds(state, 'r', { camera: turn }), [-1, -0.5, 9], [1, 0.5, 9]);
  });

  it('retains external occluders when measuring a selected label', () => {
    const label = element('label', { kind: 'text', text: 'Hello', fontSize: 1, labelOcclusion: 'hide' }, { position: [0, 0, -2] });
    const state = frame(rect('occluder', { position: [0, 0, 1] }), label);
    expect(getScreenBounds(state, 'label', viewport)).toBeUndefined();
    state.elements[0].position[0] = 5;
    const visible = getScreenBounds(state, 'label', viewport)!;
    expect(visible).toBeDefined();
    expect(visible.right).toBeLessThan(500);
    label.geometry.labelOcclusion = 'overlay';
    state.elements[0].position[0] = 0;
    expect(getScreenBounds(state, 'label', viewport)).toEqual(visible);
  });

  it.each(['overlay', 'hide', 'fade'] as const)('measures %s billboard labels in an inset perspective view without projecting twice', mode => {
    const label = element('label', { kind: 'text', text: 'Other DNA', fontSize: 0.27, labelOcclusion: mode }, {
      view: 'molecule', position: [-0.1012275, 0.58059, -1.1126025], billboard: true,
      billboardOffset: [1.25, 0.25, 0.1], viewportOffset: [0.04, -0.03],
    });
    const state: Frame = { ...frame(label), views: [{ id: 'molecule', rect: [0.04, 0.22, 0.92, 0.59],
      camera: { yaw: 0.55, pitch: 0.1, height: 5.9, distance: 24, perspective: 1, target: [0.35, -0.85, -0.8] },
      orbit: true, cameraAnimated: false }] };
    // Occlusion policy changes visibility/depth, not the glyph's projected footprint.
    const depth = { ...state, elements: [{ ...label, geometry: { ...label.geometry, labelOcclusion: 'depth' as const } }] };
    const options = { width: 960, height: 540, clip: false };
    const expected = getScreenBounds(depth, 'label', options)!;
    const actual = getScreenBounds(state, 'label', options)!;
    expect(actual).toBeDefined();
    for (const edge of ['left', 'top', 'right', 'bottom'] as const) expect(actual[edge]).toBeCloseTo(expected[edge], 3);
    expect(actual.left).toBeGreaterThan(500); expect(actual.right).toBeLessThan(700);
    expect(actual.top).toBeGreaterThan(118); expect(actual.bottom).toBeLessThan(300);
    const copy = { ...label, id: 'copy' };
    const overlap = detectOverlaps({ ...state, elements: [label, copy] }, options);
    expect(overlap).toHaveLength(1);
    expect(overlap[0].elementBounds[0]).toEqual(actual);
  });

  it('clips projected geometry at view/canvas edges, with optional offscreen extents', () => {
    const state = frame(rect('r', { position: [8, 0, 0] }));
    expect(getScreenBounds(state, 'r', viewport)).toEqual({ left: 750, top: 175, right: 800, bottom: 225 });
    expect(getScreenBounds(state, 'r', { ...viewport, clip: false })).toEqual({ left: 750, top: 175, right: 850, bottom: 225 });
    state.elements[0].position[0] = 10;
    expect(getScreenBounds(state, 'r', viewport)).toBeUndefined();
    expect(getWorldBounds(state, 'r')).toBeDefined();
  });

  it('clips crossing triangles before perspective division and excludes near/far geometry', () => {
    const crossing = element('m', { kind: 'mesh', vertices: [[-1, -1, 9], [1, -1, 11], [0, 1, 9]], triangles: [[0, 1, 2]] });
    const state = { ...frame(crossing), camera: { ...camera, perspective: 1 } };
    const box = getScreenBounds(state, 'm', viewport)!;
    expect(box).toBeDefined();
    expect(box.left).toBeGreaterThanOrEqual(0); expect(box.right).toBeLessThanOrEqual(800);
    expect(box.top).toBeGreaterThanOrEqual(0); expect(box.bottom).toBeLessThanOrEqual(400);
    const outside = frame(rect('near', { position: [0, 0, 10] }), rect('far', { position: [0, 0, -1000] }));
    expect(getScreenBounds(outside, 'near', { ...viewport, clip: false })).toBeUndefined();
    expect(getScreenBounds(outside, 'far', viewport)).toBeUndefined();
  });

  it('combines screen labels and world geometry in a view, including nested viewport offsets', () => {
    const world = rect('world', { view: 'right' });
    const screen = rect('screen', { view: 'right', space: 'screen', geometry: { kind: 'rectangle', width: 100, height: 20 }, viewportOffset: [0.1, 0] });
    const group = element('g', { kind: 'group', children: ['world', 'screen'] }, { view: 'right', viewportOffset: [0.1, 0] });
    const state: Frame = { ...frame(world, screen, group), views: [{ id: 'right', rect: [0.5, 0, 0.5, 1], camera, orbit: true, cameraAnimated: false }] };
    const box = getScreenBounds(state, 'g', viewport)!;
    expect(box.left).toBeCloseTo(590); expect(box.right).toBeCloseTo(730);
    expect(box.top).toBe(175); expect(box.bottom).toBe(225);
    expect(getWorldBounds(state, 'screen')).toBeUndefined();
    expect(getCameraBounds(state, 'screen')).toBeUndefined();
    close3D(getLocalBounds(state, 'screen'), [-50, -10, 0], [50, 10, 0]);
    expect(() => getLocalBounds(state, 'g')).toThrow('Mixed world/screen');
    expect(() => getWorldBounds(state, 'g')).toThrow('Mixed world/screen');
  });

  it('omits invisible, missing, empty, and collapsed objects, with a layout visibility override', () => {
    const hidden = rect('hidden', { fill: { color: 'WHITE', opacity: 0 } });
    const child = rect('child');
    const parent = element('parent', { kind: 'group', children: ['child'], isolated: true }, { opacity: 0 });
    const state = frame(hidden, child, parent, element('empty', { kind: 'group', children: [] }), rect('collapsed', { scale: 0 }));
    for (const id of ['hidden', 'child', 'missing', 'empty', 'collapsed']) expect(getWorldBounds(state, id)).toBeUndefined();
    expect(getLocalBounds(state, 'child')).toBeUndefined();
    expect(getWorldBounds(state, 'hidden', { includeInvisible: true })).toBeDefined();
    expect(getWorldBounds(state, 'child', { includeInvisible: true })).toBeDefined();
    expect(getLocalBounds(state, 'collapsed')).toBeDefined();
    state.elements.push(element('nopaint', { kind: 'rectangle' }, { fill: 'none' }));
    expect(getWorldBounds(state, 'nopaint', { includeInvisible: true })).toBeUndefined();
  });

  it('validates projection inputs and returns detached bounds', () => {
    const state = frame(rect());
    for (const width of [0, -1, Infinity, NaN]) expect(() => getScreenBounds(state, 'r', { ...viewport, width })).toThrow('positive finite');
    expect(() => getScreenBounds(state, 'r', undefined!)).toThrow('width and height');
    expect(() => getCameraBounds(state, 'r', { camera: { ...camera, distance: 0 } })).toThrow('positive height and distance');
    const first = getWorldBounds(state, 'r')!; first.min[0] = -100;
    expect(getWorldBounds(state, 'r')!.min[0]).toBe(-1);
  });
});

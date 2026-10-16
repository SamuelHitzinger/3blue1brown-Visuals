import { describe, expect, it } from 'vitest';
import { compileSource, detectLabelStrokeOverlaps, detectOverlaps, evaluateScene } from '../src/core.js';
import type { CameraState, ElementState, Frame, Geometry } from '../src/types.js';

const camera: CameraState = { yaw: 0, pitch: 0, target: [0, 0, 0], height: 8, distance: 10, perspective: 0 };
const options = { width: 800, height: 400 };
const element = (id: string, geometry: Geometry, extra: Partial<ElementState> = {}): ElementState => ({
  id, geometry, position: [0, 0, 0], rotation: [0, 0, 0], scale: 1, opacity: 1,
  fill: 'WHITE', stroke: 'none', strokeWidth: 0.1, space: 'world', persistent: false, ...extra,
});
const label = (id = 'label', extra: Partial<ElementState> = {}) => element(id, { kind: 'text', text: 'H', fontSize: 2 }, extra);
const line = (id = 'leader', extra: Partial<ElementState> = {}) => element(id, { kind: 'line', points: [[-2, 0], [2, 0]] }, { fill: 'none', stroke: 'WHITE', ...extra });
const frame = (...elements: ElementState[]): Frame => ({ elements, camera, cameraAnimated: false });
const detect = (...elements: ElementState[]) => detectLabelStrokeOverlaps(frame(...elements), options);

describe('advisory label/stroke intersections', () => {
  it('reports painted line/arrow/path strikes with stable pairs, bounds and witnesses', () => {
    for (const kind of ['line', 'arrow', 'path'] as const) {
      const stroke = line('a', { geometry: { kind, points: [[-2, 0], [2, 0]] } });
      for (const text of [label('z'), label('z', { geometry: { kind: 'latex', tex: 'H', fontSize: 2 } })]) {
        const found = detect(text, stroke);
        expect(found).toHaveLength(1);
        expect(found[0]).toMatchObject({ elements: ['a', 'z'], severity: 'warning', kind: 'text-stroke-overlap' });
        expect(detect(stroke, text)).toEqual(found);
        const { bounds, witness: [x, y], elementBounds } = found[0];
        for (const box of [bounds, ...elementBounds]) {
          expect(x).toBeGreaterThan(box.left); expect(x).toBeLessThan(box.right);
          expect(y).toBeGreaterThan(box.top); expect(y).toBeLessThan(box.bottom);
        }
        expect(detectOverlaps(frame(text, stroke), options)).toEqual([]);
      }
    }
  });

  it('distinguishes a raw connector strike from automatically bounds-trimmed label leaders', async () => {
    const scene = await compileSource(`export default scene({}, s => {
      const a=s.text('a',{text:'H',fontSize:2,position:[-3,0]});
      const b=s.text('b',{text:'H',fontSize:2,position:[3,0]});
      const raw=s.line('raw',{points:[[-3,0],[3,0]],strokeWidth:0.03});
      const trimmed=s.line('trimmed',{strokeWidth:0.03}); s.connect(trimmed,a,b); s.wait(1);
    });`);
    expect(detectLabelStrokeOverlaps(evaluateScene(scene, 0.5), options).map(d => d.elements)).toEqual([['a', 'raw'], ['b', 'raw']]);
  });

  it('does not confuse glyph holes, bounding box crossings, filled paths, or unrelated shapes with stroke paint', () => {
    const ring = label('ring', { geometry: { kind: 'text', text: 'O', fontSize: 2 } });
    expect(detect(ring, line('inside', { geometry: { kind: 'line', points: [[-0.15, 0], [0.15, 0]] }, strokeWidth: 0.02 }))).toEqual([]);
    expect(detect(label(), line('away', { position: [0, 3, 0] }))).toEqual([]);
    expect(detect(label(), line('path', { geometry: { kind: 'path', points: [[-3,-3],[3,-3],[3,3],[-3,3]], closed: true }, fill: 'WHITE' }))).toEqual([]);
    expect(detect(label(), element('mesh', { kind: 'mesh', vertices: [[-2,-2],[2,-2],[0,2]], triangles: [[0,1,2]] }, { stroke: 'WHITE', strokeWidth: 1 }), label('other'))).toEqual([]);
    expect(detect(line('first'), line('second'))).toEqual([]);
  });

  it('honors inherited transforms, alpha and ancestor ignore pairs without mutating input', () => {
    const stroke = line('stroke'), text = label('text');
    const group = element('group', { kind: 'group', children: ['stroke', 'text'], isolated: true }, { position: [1,1,0], rotation: [0,0,0.4], scale: 0.7, opacity: 0.5 });
    const state = frame(stroke, text, group), before = structuredClone(state);
    expect(detectLabelStrokeOverlaps(state, options)).toHaveLength(1);
    expect(state).toEqual(before);
    expect(detectLabelStrokeOverlaps(state, { ...options, ignorePairs: [['group', 'text']] })).toEqual([]);
    group.opacity = 0.005;
    expect(detectLabelStrokeOverlaps(state, options)).toEqual([]);
    expect(detectLabelStrokeOverlaps(state, { ...options, minOpacity: 0 })).toHaveLength(1);
    stroke.opacity = 0;
    expect(detectLabelStrokeOverlaps(state, { ...options, minOpacity: 0 })).toEqual([]);
  });

  it('projects round 3D strokes, rejects geometry behind camera, and clips canvas edges', () => {
    const state = frame(label(), line('tube', { strokeProfile: 'round' }));
    state.camera = { ...camera, perspective: 1, yaw: 0.3, pitch: 0.2 };
    expect(detectLabelStrokeOverlaps(state, options)).toHaveLength(1);
    state.camera = { ...camera, perspective: 1 };
    for (const e of state.elements) e.position = [0,0,11];
    expect(detectLabelStrokeOverlaps(state, options)).toEqual([]);
    for (const e of state.elements) e.position = [8,0,0];
    const found = detectLabelStrokeOverlaps(state, options);
    expect(found).toHaveLength(1);
    expect(found[0].bounds.right).toBeLessThanOrEqual(800);
    expect(found[0].bounds.left).toBeLessThan(800);
  });

  it.each(['line3D', 'arrow3D'])('inspects %s builder stroke paint without treating depth as occlusion proof', async kind => {
    const scene = await compileSource(`export default scene({mode:'3d'}, s => {
      s.text('label',{text:'H',fontSize:2});
      s.${kind}('stroke',{points:[[-2,0,-1],[2,0,-1]],strokeWidth:0.1}); s.wait(1);
    });`);
    const state = evaluateScene(scene, 0.5);
    state.camera = camera;
    expect(state.elements.find(e => e.id === 'stroke')!.strokeProfile).toBe('round');
    expect(detectLabelStrokeOverlaps(state, options)).toMatchObject([{ elements: ['label', 'stroke'], severity: 'warning' }]);
  });

  it('uses common canvas coordinates for matching view offsets and cross-view overlays', () => {
    const state: Frame = { ...frame(label('label', { view: 'left' }), line('stroke', { view: 'right' })), views: [
      { id: 'left', rect: [0,0,0.5,1], camera, orbit: false, cameraAnimated: false },
      { id: 'right', rect: [0.5,0,0.5,1], camera, orbit: false, cameraAnimated: false },
    ] };
    expect(detectLabelStrokeOverlaps(state, options)).toEqual([]);
    state.elements[1].view = 'left';
    expect(detectLabelStrokeOverlaps(state, options)).toHaveLength(1);
    state.elements[1].view = undefined;
    state.elements[1].space = 'screen';
    state.elements[1].position = [-200,0,0];
    state.elements[1].geometry.points = [[-100,0],[100,0]];
    state.elements[1].strokeWidth = 3;
    expect(detectLabelStrokeOverlaps(state, options)).toHaveLength(1);
    state.elements[0].position = [6,0,0];
    expect(detectLabelStrokeOverlaps(state, options)).toEqual([]);
  });

  it('uses current morph paint and excludes faded glyphs', () => {
    const stroke = line('stroke', { morph: { from: { kind: 'line', points: [[-2,-2],[2,-2]] }, to: { kind: 'line', points: [[-2,2],[2,2]] }, progress: 0.5 } });
    const text = label();
    expect(detect(text, stroke)).toHaveLength(1);
    stroke.morph!.progress = 0;
    expect(detect(text, stroke)).toEqual([]);
    stroke.morph!.progress = 0.5;
    text.morph = { from: text.geometry, to: { kind: 'text', text: ' ' }, progress: 0.999 };
    expect(detect(text, stroke)).toEqual([]);
  });

  it('merges both directions of label/stroke crossfades into one stable element pair', () => {
    const from: Geometry = { kind: 'text', text: 'H', fontSize: 2 };
    const to: Geometry = { kind: 'line', points: [[-2,0],[2,0]] };
    const a = label('a', { stroke: 'WHITE', morph: { from, to, progress: 0.5 } });
    const b = label('b', { stroke: 'WHITE', morph: { from, to, progress: 0.5 } });
    expect(detect(a, b)).toHaveLength(1);
    expect(detect(a, b)[0].elements).toEqual(['a', 'b']);
    expect(detect(b, a)).toEqual(detect(a, b));
    expect(detect(a)).toEqual([]);
  });

  it('excludes mesh wire paint from mixed morphs while retaining the stroke branch and its fade alpha', () => {
    const mesh: Geometry = { kind: 'mesh', vertices: [[-2,0],[2,0],[0,2]], triangles: [[0,1,2]] };
    const away: Geometry = { kind: 'line', points: [[-2,3],[2,3]] };
    const mixed = line('mixed', { morph: { from: away, to: mesh, progress: 0.5 } });
    expect(detect(label(), mixed)).toEqual([]);
    mixed.morph!.from = { kind: 'line', points: [[-2,0],[2,0]] };
    expect(detect(label(), mixed)).toHaveLength(1);
    mixed.morph!.progress = 0.999;
    expect(detect(label(), mixed)).toEqual([]);
  });

  it('retains authoritative label occlusion even when unrelated meshes are normally skipped', () => {
    const hidden = label('hidden', { position: [0,0,-2], geometry: { kind: 'text', text: 'H', fontSize: 2, labelOcclusion: 'hide' } });
    const blocker = element('blocker', { kind: 'rectangle', width: 5, height: 5 });
    expect(detect(hidden, line(), blocker)).toEqual([]);
    hidden.geometry.labelOcclusion = 'overlay';
    expect(detect(hidden, line(), blocker)).toHaveLength(1);
  });

  it('validates dimensions and opacity before traversing a frame', () => {
    for (const width of [0, -1, Infinity, NaN]) expect(() => detectLabelStrokeOverlaps(frame(), { ...options, width })).toThrow('width and height');
    for (const minOpacity of [-1, 2, NaN]) expect(() => detectLabelStrokeOverlaps(frame(), { ...options, minOpacity })).toThrow('minOpacity');
  });
});

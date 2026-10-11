import { describe, expect, it } from 'vitest';
import { compileSource } from '../src/compiler.js';
import { evaluateScene } from '../src/timeline.js';
import { applyBindings } from '../src/bindings.js';
import { BehaviorRuntime } from '../src/behaviors.js';
import { getCameraBounds, getLocalBounds, getWorldBounds } from '../src/bounds.js';
import { cameraPoint } from '../src/projection.js';
import { add, cross, mul, SpatialFrame, sub } from '../src/spatial.js';
import type { Frame, Vec3 } from '../src/types.js';

const compile = (body: string) => compileSource(`export default scene({},s=>{${body}});`);
const at = (frame: Frame, id: string) => frame.elements.find(e => e.id === id)!;
const center = (frame: Frame, id: string): Vec3 => {
  const b = getLocalBounds(frame, id, { includeInvisible: true })!;
  return new SpatialFrame(frame).world(id, mul(add(b.min, b.max), 0.5));
};
const endpoints = (frame: Frame, id = 'line'): Vec3[] =>
  at(frame, id).geometry.points!.map(p => new SpatialFrame(frame).world(id, [p[0], p[1], p[2] ?? 0]));
const length = (points: Vec3[]) => Math.hypot(...sub(points[1], points[0]));

function expectConnection(frame: Frame): void {
  const [a, b] = endpoints(frame), ca = center(frame, 'a'), cb = center(frame, 'b');
  expect(at(frame, 'line').opacity).toBeGreaterThan(0);
  for (const p of [a, b]) expect(Math.hypot(...cross(sub(p, ca), sub(cb, ca)))).toBeLessThan(1e-6);
  expect(length([a, b])).toBeLessThan(length([ca, cb]));
  for (const [id, p] of [['a', a], ['b', b]] as const) {
    const box = getLocalBounds(frame, id)!, local = new SpatialFrame(frame).local(id, p);
    expect(local[0] < box.min[0] || local[0] > box.max[0] || local[1] < box.min[1] || local[1] > box.max[1]).toBe(true);
  }
}

describe('label connector bounds', () => {
  it.each([[4, 0], [0, 4], [4, 3], [-4, -3]])('clips the visual centerline toward %j', async (x, y) => {
    const scene = await compile(String.raw`
      const a=s.latex('a',{tex:'\\animpart{x}{x}+123',anchor:'x'});
      const b=s.latex('b',{tex:'\\frac{y}{2}',position:[${x},${y}]});
      const line=s.line('line');s.connect(line,a,b);s.wait(1);`);
    const frame = evaluateScene(scene, 0);
    expect(Math.hypot(...sub(center(frame, 'a'), at(frame, 'a').position))).toBeGreaterThan(0.3);
    expectConnection(frame);
  });

  it('preserves an explicit origin-to-origin connection and unbound line geometry', async () => {
    const scene = await compile(String.raw`
      const a=s.latex('a',{tex:'\\animpart{x}{x}+123',anchor:'x'}),b=s.latex('b',{tex:'y',position:[4,2]});
      const line=s.line('line');s.connect(line,a,b,{endpoints:'center'});
      s.line('unbound',{points:[[0,0],[4,2]]});s.wait(1);`);
    const frame = evaluateScene(scene, 0);
    expect(endpoints(frame)).toEqual([[0, 0, 0], [4, 2, 0]]);
    expect(endpoints(frame, 'unbound')).toEqual(endpoints(frame));
  });

  it('supports text and explicit bounds while retaining point endpoints for other shapes', async () => {
    const scene = await compile(`const a=s.text('a',{text:'Start'}),b=s.circle('b',{position:[4,0]});
      const line=s.line('line');s.connect(line,a,b,{endpoints:'bounds'});s.wait(1);`);
    const frame = evaluateScene(scene, 0), [a, b] = endpoints(frame);
    expect(a[0]).toBeGreaterThan(getWorldBounds(frame, 'a')!.max[0]);
    expect(b).toEqual([4, 0, 0]);
  });

  it('resolves transformed parents, connector transforms, movement and scale every frame', async () => {
    const scene = await compile(`const a=s.latex('a',{tex:'x'}),b=s.latex('b',{tex:'y',position:[4,2]});
      const labels=s.group('labels',[a,b]);const line=s.line('line');
      const edges=s.group('edges',[line]);s.connect(line,a,b);
      s.play([labels.rotateTo(0.7),labels.scaleTo(1.5),labels.moveTo([1,-2]),edges.rotateTo(-0.3),edges.scaleTo(2)],{duration:0});
      s.play([b.moveTo([6,3]),a.scaleTo(2)],{duration:2,ease:'linear'});`);
    for (const time of [0, 0.5, 1, 2]) expectConnection(evaluateScene(scene, time));
  });

  it('measures the visible geometry throughout named-part morphs and crossfades', async () => {
    const scene = await compile(String.raw`
      const a=s.latex('a',{tex:'\\animpart{x}{x}',fontSize:0.6});
      const b=s.latex('b',{tex:'y',position:[7,3]});const line=s.arrow('line');s.connect(line,a,b);
      s.play(a.morphTo({kind:'latex',tex:'\\animpart{x}{x+1}',fontSize:1.2},{map:{x:'x'}}),{duration:2,ease:'linear'});
      s.play(a.morphTo({kind:'latex',tex:'\\frac{1}{2}',fontSize:0.6},{map:{}}),{duration:2,ease:'linear'});`);
    for (const time of [0, 0.5, 1, 1.9, 2, 2.5, 3, 4]) expectConnection(evaluateScene(scene, time));
  });

  it('reduces padding to retain a readable shaft, then hides overlapping or tiny gaps', async () => {
    const scene = await compile(`const a=s.latex('a',{tex:'x'}),b=s.latex('b',{tex:'x',position:[3,0]});
      const line=s.arrow('line',{strokeWidth:0.02});s.connect(line,a,b);s.wait(1);`);
    const raw = evaluateScene(scene, 0, { bindings: false });
    const bounds = getLocalBounds(raw, 'a')!, w = bounds.max[0] - bounds.min[0];
    for (const gap of [0, 0.1, 0.36, 1]) {
      const frame = structuredClone(raw);at(frame, 'b').position[0] = w + gap;
      applyBindings(frame, scene.bindings);
      if (gap < 0.34) expect(at(frame, 'line').opacity).toBe(0);
      else {
        expectConnection(frame);
        expect(length(endpoints(frame))).toBeGreaterThanOrEqual(0.32 - 1e-8);
        if (gap === 0.36) expect(length(endpoints(frame))).toBeCloseTo(0.32, 5);
      }
    }
  });

  it('updates cached bounds when numeric glyphs change, independently of label opacity', async () => {
    const scene = await compile(String.raw`
      const a=s.latex('a',{tex:'\\animnum{n}',numbers:{n:1},numberFormat:{digits:2,decimals:0},opacity:0});
      const b=s.latex('b',{tex:'y',position:[4,2]});const line=s.line('line');s.connect(line,a,b);s.wait(1);`);
    const raw = evaluateScene(scene, 0, { bindings: false });
    const points: Vec3[][] = [];
    for (const value of [1, -19, 1]) {
      const frame = structuredClone(raw);at(frame, 'a').geometry.numbers = { n: value };
      applyBindings(frame, scene.bindings);
      // Opacity must not move the endpoint while a label fades in or out.
      at(frame, 'a').opacity = 1;
      expectConnection(frame);points.push(endpoints(frame));
    }
    expect(points[0]).not.toEqual(points[1]);
    expect(points[0]).toEqual(points[2]);
  });

  it('restores a hidden connection after live source motion', async () => {
    const scene = await compile(`const a=s.latex('a',{tex:'x'}),b=s.latex('b',{tex:'y'});
      const line=s.line('line');s.connect(line,a,b);s.behavior(b,{type:'custom',name:'move'});s.wait(1);`);
    let x = 0;
    const runtime = new BehaviorRuntime({ move: () => ({ update: c => { c.setWorldPosition([x, 0, 0]); } }) });
    const raw = () => evaluateScene(scene, 0, { bindings: false });
    expect(at(runtime.evaluate(scene, raw(), 0, 0), 'line').opacity).toBe(0);
    x = 4;expectConnection(runtime.evaluate(scene, raw(), 0, 0));
    x = 0;expect(at(runtime.evaluate(scene, raw(), 0, 0), 'line').opacity).toBe(0);
  });

  it('uses pixel-sized gaps and arrowheads for screen labels', async () => {
    const scene = await compile(`const a=s.latex('a',{tex:'x',space:'screen'}),b=s.latex('b',{tex:'y',space:'screen',position:[150,75]});
      const line=s.arrow('line',{space:'screen'});s.connect(line,a,b);s.wait(1);`);
    const frame = evaluateScene(scene, 0);
    expectConnection(frame);
    expect(length(endpoints(frame))).toBeGreaterThan(12);
  });

  it('accounts for camera-facing label offsets in a rotated camera', async () => {
    const scene = await compile(`const a=s.latex('a',{tex:'x',billboard:true,billboardOffset:[0,1,0]}),
      b=s.latex('b',{tex:'y',billboard:true,billboardOffset:[0,1,0],position:[4,0,0]});
      const line=s.line('line');s.connect(line,a,b);s.wait(1);`);
    const frame = evaluateScene(scene, 0, { bindings: false });
    frame.camera.pitch = 0.3;frame.camera.yaw = 0.5;
    applyBindings(frame, scene.bindings);
    const ca = getCameraBounds(frame, 'a')!, cb = getCameraBounds(frame, 'b')!;
    const a = mul(add(ca.min, ca.max), 0.5), b = mul(add(cb.min, cb.max), 0.5);
    for (const p of endpoints(frame)) expect(Math.hypot(...cross(sub(cameraPoint(p, frame.camera), a), sub(b, a)))).toBeLessThan(1e-5);
    expect(at(frame, 'line').opacity).toBe(1);
  });
});

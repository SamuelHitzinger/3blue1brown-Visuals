import { expect, test } from 'bun:test';
import { compileSource, evaluateScene } from '../../shared/animlib/src/core.js';
import { worldCompatibleSource, scalingSource } from './realtime-terminal-sampling-probe.js';

test('world adaptation removes only initial camera authoring and preserves duration and element motion', async () => {
  const source = `export default scene({mode:'3d'},s=>{
s.play(s.camera.to3D({yaw:.65,pitch:.48,height:6.1}),{duration:0});
const x=s.box('x');s.play(x.moveTo([2,0,0]),{duration:2});s.wait(6);
});`;
  const adapted = worldCompatibleSource(source);
  expect(adapted.removedCameraCommands).toBe(1);
  const [a, b] = await Promise.all([compileSource(source), compileSource(adapted.source)]);
  expect(a.duration).toBe(b.duration);
  for (const t of [0, 1, 2, 8]) expect(evaluateScene(a, t).elements).toEqual(evaluateScene(b, t).elements);
});

test('scaling fixtures keep full surface detail and explicit distinct IDs', async () => {
  const [a, b] = await Promise.all([compileSource(scalingSource(0)), compileSource(scalingSource(1))]);
  const fa = evaluateScene(a, 0), fb = evaluateScene(b, 0);
  expect(fa.elements[0].geometry.vertices).toHaveLength(1681);
  expect(fa.elements[0].geometry.triangles).toHaveLength(3200);
  expect(fa.elements[0].id).not.toBe(fb.elements[0].id);
  expect(fa.elements[0].geometry).toEqual(fb.elements[0].geometry);
  expect(a.reactiveBindings).toHaveLength(1);
});

test('unsupported camera authoring is rejected rather than silently rewritten', () => {
  const source = `export default scene({},s=>{s.play(s.camera.to3D({yaw:1}),{duration:2});});`;
  expect(() => worldCompatibleSource(source)).toThrow('camera');
});

import { describe, expect, it } from 'vitest';
import { compileSource } from '../src/compiler.js';
import { evaluateScene } from '../src/timeline.js';
import { SpatialFrame } from '../src/spatial.js';

describe('automatic fade-in entrances', () => {
  it('still rejects invalid authored opacity on an entering element', async () => {
    await expect(compileSource(`export default scene({}, s => {
      const dot = s.circle('dot', {opacity:2});
      s.wait(1);
      s.play(dot.fadeIn(), {duration:1});
    });`)).rejects.toThrow('Invalid element style range');
  });

  it('keeps staggered entrances hidden through waits and other animations, including after seeking', async () => {
    const scene = await compileSource(`export default scene({}, s => {
      s.circle('background');
      const first = s.circle('first');
      const second = s.circle('second');
      s.wait(1);
      s.play(first.fadeIn(), {duration:1,ease:'linear'});
      s.play(second.moveTo([2,0]), {duration:1,ease:'linear'});
      s.play(second.fadeIn(), {duration:1,ease:'linear'});
    });`);
    for (const [time, first, second] of [
      [0,0,0], [0.99,0,0], [1,0,0], [1.5,0.5,0], [2.5,1,0],
      [3,1,0], [3.5,1,0.5], [4,1,1], [0,0,0], [3.5,1,0.5],
    ]) {
      const frame = evaluateScene(scene, time);
      expect(frame.elements.map(e => e.opacity)).toEqual([1, first, second]);
    }
    expect(evaluateScene(scene, 2.5).elements[2].position).toEqual([1,0,0]);
  });

  it('hides nested group contents without changing their own opacity', async () => {
    const scene = await compileSource(`export default scene({}, s => {
      const child = s.circle('child', {opacity:0.6});
      const inner = s.group('inner', [child]);
      const outer = s.group('outer', [inner], {isolated:true});
      s.wait(1);
      s.play(outer.fadeIn(), {duration:1,ease:'linear'});
    });`);
    for (const [time, expected] of [[0,0], [1,0], [1.5,0.3], [2,0.6]]) {
      const space = new SpatialFrame(evaluateScene(scene, time));
      expect(space.elements.get('child')!.opacity).toBe(0.6);
      expect(space.chain('child').reduce((opacity, e) => opacity * e.opacity, 1)).toBeCloseTo(expected);
    }
  });

  it('reveals a late-created element at its zero-duration entrance', async () => {
    const scene = await compileSource(`export default scene({}, s => {
      s.wait(1);
      const dot = s.circle('dot');
      s.wait(1);
      s.play(dot.fadeIn(), {duration:0});
      s.wait(1);
    });`);
    expect(evaluateScene(scene, 0.5).elements).toEqual([]);
    for (const [time, opacity] of [[1,0], [1.99,0], [2,1], [3,1]]) {
      expect(evaluateScene(scene, time).elements[0].opacity).toBe(opacity);
    }
  });

  it.each(['dot.fadeOut()', 'dot.animate({opacity:0})'])(
    'preserves initial visibility when %s precedes the fade-in', async action => {
      const scene = await compileSource(`export default scene({}, s => {
        const dot = s.circle('dot', {opacity:0.6});
        s.wait(1);
        s.play(${action}, {duration:1,ease:'linear'});
        s.wait(1);
        s.play(dot.fadeIn(), {duration:1,ease:'linear'});
      });`);
      for (const [time, opacity] of [[0,0.6], [1,0.6], [1.5,0.3], [2.5,0], [3.5,0.5], [4,1]]) {
        expect(evaluateScene(scene, time).elements[0].opacity).toBeCloseTo(opacity);
      }
    },
  );

  it('does not treat unused actions or ordinary movement as entrances', async () => {
    const scene = await compileSource(`export default scene({}, s => {
      const dot = s.circle('dot', {opacity:0.6});
      dot.fadeIn();
      s.wait(1);
      s.play([dot.moveTo([2,0]), dot.scaleTo(2)], {duration:1});
    });`);
    for (const time of [0, 1, 1.5, 2]) {
      expect(evaluateScene(scene, time).elements[0].opacity).toBe(0.6);
    }
  });

  it('preserves carried-over and exiting elements before a fade-in', async () => {
    const previous = await compileSource(`export default scene({}, s => {
      const kept = s.circle('kept');
      s.keep(kept);
      s.circle('departing');
      s.wait(1);
    });`);
    const scene = await compileSource(`export default scene({}, s => {
      const kept = s.previous.get('kept');
      const exiting = s.previous.exiting();
      s.wait(1);
      s.play([kept.fadeIn(), exiting.fadeIn()], {duration:1,ease:'linear'});
    });`, {previous:evaluateScene(previous, 1)});
    for (const [time, opacity] of [[0,1], [0.5,1], [1,0], [1.5,0.5], [2,1]]) {
      const space = new SpatialFrame(evaluateScene(scene, time));
      for (const id of ['kept', '@exit:departing']) {
        expect(space.chain(id).reduce((value, e) => value * e.opacity, 1)).toBe(opacity);
      }
    }
  });
});

import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { withOfflineScene } from '../src/offline-sampling.js';

const source = () => readFileSync(new URL('../demo/expansion/coupled-modes.js', import.meta.url), 'utf8');

describe('published coupled-mode construction', () => {
  test('actual scene keeps component addition, spring endpoints and reverse seeks coherent', async () => {
    await withOfflineScene(source(), {}, async sampler => {
      expect(sampler.scene.duration).toBe(8);
      const snapshot = (time: number) => sampler.sample(time);
      const end = snapshot(8);
      for (const time of [0, 2, 3.7, 5.9, 8, 3.7, 0]) {
        const frame = snapshot(time);
        const phase = Math.PI * Math.max(0, Math.min(1, (time - 1.4) / 5));
        const a = .4 * Math.cos(phase), b = .4 * Math.cos(2 * phase);
        for (const [i, equilibrium] of [-2, 2].entries()) {
          const body = frame.elements.find(element => element.id === `sum-mass-${i}`)!;
          const contribution = frame.elements.find(element => element.id === `addition-b-${i}`)!;
          const x = equilibrium + a + (i ? -b : b);
          expect(body.position[0]).toBeCloseTo(x, 8);
          expect(contribution.geometry.points!.at(-1)![0]).toBeCloseTo(x, 8);
          const spring = frame.elements.find(element => element.id === 'sum-spring-1')!;
          expect(spring.geometry.points![i ? spring.geometry.points!.length - 1 : 0][0]).toBeCloseTo(x + (i ? -.22 : .22), 8);
        }
      }
      expect(snapshot(8)).toEqual(end);
    });
  });
});

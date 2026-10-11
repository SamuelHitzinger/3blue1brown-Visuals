import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { withOfflineScene } from '../src/offline-sampling.js';

// Only these explicitly marked examples promise standalone scene execution.
// Host preparation examples have separate inputs and must not enter the sandbox.
const reference = readFileSync(new URL('../docs/reference.md', import.meta.url), 'utf8');
const recipes = [...reference.matchAll(/^```js scene\r?\n([\s\S]*?)^```\s*$/gm)].map((match, index) => {
  const headings = [...reference.slice(0, match.index).matchAll(/^#### (.+)$/gm)];
  return { name: `${index + 1}: ${headings.at(-1)?.[1].trim() ?? 'scene recipe'}`, source: match[1] };
});

function expectFiniteNumbers(value: unknown): void {
  if (typeof value === 'number') expect(Number.isFinite(value)).toBe(true);
  else if (Array.isArray(value)) value.forEach(expectFiniteNumbers);
  else if (value && typeof value === 'object') Object.values(value).forEach(expectFiniteNumbers);
}

describe('standalone reference recipes', () => {
  it('discovers runnable recipes in the published authoring reference', () => {
    expect(recipes.length).toBeGreaterThan(0);
  });

  it.each(recipes)('$name compiles and samples deterministically in both directions', async ({ source }) => {
    await withOfflineScene(source, {}, sampler => {
      expect(sampler.scene.duration).toBeGreaterThan(0);
      const times = [0, 0.25, 0.5, 0.75, 1].map(fraction => sampler.scene.duration * fraction);
      const frames = times.map(time => structuredClone(sampler.sample(time)));
      expect(frames.some(frame => frame.elements.length > 0)).toBe(true);
      for (const frame of frames) {
        expectFiniteNumbers(frame);
        const ids = frame.elements.map(element => element.id);
        expect(new Set(ids).size).toBe(ids.length);
      }
      for (let index = times.length - 1; index >= 0; index--) {
        expect(sampler.sample(times[index])).toEqual(frames[index]);
      }
    });
  }, 20_000);
});

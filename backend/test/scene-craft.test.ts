import { expect, test } from 'bun:test';
import { compileSource, evaluateScene } from 'animlib/core';
import { readFileSync } from 'node:fs';
import { buildAuthoringReference } from '../src/agents/authoring-reference.js';

test('the injected procedural finish reference example compiles with the installed scene API', async () => {
  const reference = buildAuthoringReference(readFileSync(new URL('../../shared/animlib/docs/reference.md', import.meta.url), 'utf8'));
  const section = reference.slice(reference.indexOf('### Procedural textures and materials'), reference.indexOf('### Function and parametric surfaces'));
  const examples = [...section.matchAll(/```js\r?\n([\s\S]*?)\r?\n```/g)];
  expect(examples).toHaveLength(1);
  const compiled = await compileSource(examples[0][1]);
  const marble = evaluateScene(compiled, 0).elements.find(element => element.id === 'marble');
  expect(marble?.geometry.texture).toMatchObject({ pattern: 'marble', scale: [2, 3, 2], bumpStrength: 0.08 });
  expect(marble?.geometry.material).toMatchObject({ roughness: 0.25, specular: 0.6 });
});

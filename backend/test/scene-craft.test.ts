import { expect, test } from 'bun:test';
import { compileSource, evaluateScene } from 'animlib/core';
import { loadPrompt } from '../src/agents/prompts.js';

test('the procedural finish example compiles with the installed scene API', async () => {
  const guidance = await loadPrompt('scene-craft');
  const examples = [...guidance.matchAll(/```js\r?\n([\s\S]*?)\r?\n```/g)];
  expect(examples).toHaveLength(1);
  const compiled = await compileSource(`export default scene({mode:'3d',orbit:false},s=>{
    const v = s;
    ${examples[0][1]}
    s.wait(1);
  });`);
  const timber = evaluateScene(compiled, 0).elements.find(element => element.id === 'timber');
  expect(timber?.geometry.texture).toMatchObject({ pattern: 'wood', scale: [3, 0.5, 3], bumpStrength: 0.003 });
  expect(timber?.geometry.material).toMatchObject({ roughness: 0.85, specular: 0.15 });
});

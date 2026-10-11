import assert from "node:assert/strict";
import { createHandler } from "../backend/src/server.js";
import { compileSource, evaluateScene } from "animlib/core";
import { buildStorylineMessages } from "../backend/src/storyline-prompt.js";
import { parseStoryline } from "../backend/src/narration/markdown.js";
import { createModelRuntime } from "../backend/src/agents/auth.js";
import { agentConfig } from "../backend/src/agents/config.js";

// Import the actual Pi SDK under the shipped Bun runtime without making paid calls.
const agentSettings = agentConfig({ AGENT_AUTH_MODE: "api-key", OPENAI_API_KEY: "container-fixture" });
const agentRuntime = await createModelRuntime(agentSettings);
assert(agentRuntime.getModel(agentSettings.provider, agentSettings.model), "Pinned agent model is missing");
assert((await Bun.file(new URL("../shared/animlib/docs/reference.md", import.meta.url)).text()).includes("s.wait"));

const revision = (await Bun.file(new URL("../REVISION", import.meta.url)).text()).trim();
assert.equal(process.env.APP_REVISION, revision);
const guidance = (await buildStorylineMessages("Release verification"))[0].content;
const example = /```md\s*\n([\s\S]*?)```/.exec(guidance)?.[1];
assert(example, 'Storyline guidance must ship a parseable script example');
const exampleStory = parseStoryline(example);
assert(exampleStory.beats.length > 0 && exampleStory.beats.every(beat => beat.context.trim() && beat.blocks.some(block => block.kind === 'speech')),
  'Shipped guidance example must contain scene context and spoken narration');
for (const prompt of ['scene-craft.md', 'scene-verify.md', 'scene-repair.md', 'story-review.md', 'topics-system.md', 'topics-format.md']) {
  assert((await Bun.file(new URL(`../backend/prompts/${prompt}`, import.meta.url)).text()).trim().length > 100, `${prompt} is missing from the release`);
}
assert.equal(parseStoryline("Narration: A working release.").beats.length, 1);
assert.equal(parseStoryline("| Voiceover | Pause (s) |\n| --- | --- |\n| A working release. | 1 |").beats[0].blocks.length, 2);
const scene = await compileSource(`export default scene({}, s => {
  const dot = s.circle('dot', { position: [2, 0] });
  s.keep(dot); s.wait(1);
});`);
assert.deepEqual(evaluateScene(scene, 1).elements[0].position, [2, 0, 0]);
const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: createHandler() });
try {
  const response = await fetch(new URL("/healthz", server.url));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, revision });
  for (const route of ["/", "/library", "/plan", "/plan/analysis", "/settings", "/watch/demo"]) {
    const page = await fetch(new URL(route, server.url));
    assert.equal(page.status, 200, route);
    const html = await page.text();
    const assets = [...html.matchAll(/(?:src|href)="(\/static\/[^\"]+)"/g)];
    assert(assets.length > 0, `${route}: missing built assets`);
    for (const [, path] of assets) {
      const asset = await fetch(new URL(path, server.url));
      assert.equal(asset.status, 200, path);
      await asset.arrayBuffer();
    }
  }
  console.log(`Release smoke check passed: ${revision}`);
} finally {
  server.stop(true);
}

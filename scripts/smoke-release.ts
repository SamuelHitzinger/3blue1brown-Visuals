import assert from "node:assert/strict";
import { createHandler } from "../backend/src/server.js";
import { compileSource, evaluateScene } from "animlib/core";
import { buildStorylineMessages } from "../backend/src/storyline-prompt.js";
import { parseStoryline } from "../backend/src/narration/markdown.js";
import { createModelRuntime } from "../backend/src/agents/auth.js";
import { agentConfig } from "../backend/src/agents/config.js";
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { bundledModelCatalog, prepareBundledModel } from '../backend/src/bundled-models.js';
import { prepareMolecularModel } from '../backend/src/molecular-models.js';
import { ModelAssets } from '../backend/src/model-assets.js';

// Exercise shipped scientific fixtures, core exports and writable storage without network access.
// Unique child directories keep this check separate from any existing cached or published models.
const modelRoot = resolve(process.env.MODEL_ASSET_DIR ?? 'data/models');
const cacheRoot = resolve(process.env.MOLECULAR_MODEL_CACHE_DIR ?? 'data/molecular-model-cache');
await Promise.all([mkdir(modelRoot, { recursive: true }), mkdir(cacheRoot, { recursive: true })]);
const modelDirectory = await mkdtemp(join(modelRoot, 'release-smoke-'));
const cacheDirectory = await mkdtemp(join(cacheRoot, 'release-smoke-'));
const previousCache = process.env.MOLECULAR_MODEL_CACHE_DIR;
const originalFetch = globalThis.fetch;
try {
  process.env.MOLECULAR_MODEL_CACHE_DIR = cacheDirectory;
  const catalog = await bundledModelCatalog();
  assert(catalog.some(model => model.fixtureId === '1crn-sticks'));
  const bundled = await prepareBundledModel('1crn-sticks');
  const pdb = await readFile(new URL('../shared/animlib/fixtures/biological/1crn/source/1CRN.pdb', import.meta.url));
  let downloads = 0;
  globalThis.fetch = (async input => {
    assert.equal(input instanceof Request ? input.url : String(input), 'https://files.rcsb.org/download/1CRN.pdb');
    downloads++;
    return new Response(pdb);
  }) as typeof fetch;
  const molecular = await prepareMolecularModel({ accession: '1CRN', chains: ['A'] });
  assert.equal(downloads, 1);
  const cached = await prepareMolecularModel({ accession: '1CRN', chains: ['A'] });
  assert.equal(downloads, 1, 'Prepared coordinates must survive a second import without another download');
  assert.deepEqual(cached.bytes, molecular.bytes);
  assert.equal(molecular.context.provenance.sourceHash, createHash('sha256').update(pdb).digest('hex'));
  assert(molecular.context.molecular!.chains.some(chain => chain.id === 'A' && chain.residues === 46));
  globalThis.fetch = originalFetch;
  const store = new ModelAssets(modelDirectory);
  for (const prepared of [bundled, molecular]) {
    const published = await store.publish(prepared.bytes, { scientific: prepared.context });
    const assets = { [published.id]: published.asset };
    assert(published.asset.metadata.triangles > 0);
    assert.deepEqual((await new ModelAssets(modelDirectory).provenance(assets))[published.id].scientific, prepared.context);
    const response = await store.handle(new Request(`http://localhost${published.asset.url}`));
    assert.equal(response.status, 200);
    assert.equal(createHash('sha256').update(new Uint8Array(await response.arrayBuffer())).digest('hex'), published.asset.sha256);
    const compiled = await compileSource(`export default scene({}, s => { s.model('protein', {asset:${JSON.stringify(published.id)}}); s.wait(1); });`,
      { models: { [published.id]: published.asset.metadata } });
    assert.equal(evaluateScene(compiled, 1).elements[0].geometry.kind, 'model');
    assert(Object.keys((await store.forRendering(assets)).files).includes(published.asset.url));
  }
  console.log('Scientific model preparation, publication, cache, delivery and scene compilation passed');
} finally {
  globalThis.fetch = originalFetch;
  if (previousCache === undefined) delete process.env.MOLECULAR_MODEL_CACHE_DIR;
  else process.env.MOLECULAR_MODEL_CACHE_DIR = previousCache;
  await Promise.all([rm(modelDirectory, { recursive: true, force: true }), rm(cacheDirectory, { recursive: true, force: true })]);
}

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

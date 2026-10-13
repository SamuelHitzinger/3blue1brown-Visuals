import { expect, test } from 'bun:test';
import { readFile, stat } from 'node:fs/promises';
import { catalogRoutes, searchCatalog, readCatalog, catalogEntryExists, relatedCatalogEntries } from '../src/visualization-catalog.js';
import { catalogTools, CATALOG_GUIDANCE } from '../src/agents/catalog.js';

test('the root catalog is a small routing manifest with independently bounded tier/domain indexes', async () => {
  const manifest = JSON.parse(await readFile(new URL('../../shared/animlib/catalog/index.json', import.meta.url), 'utf8'));
  expect(manifest.schemaVersion).toBe(1);
  expect(manifest.shards.length).toBeGreaterThanOrEqual(3);
  expect(manifest.entries).toBeUndefined();
  expect(CATALOG_GUIDANCE).toBe(await readFile(new URL('../../shared/animlib/catalog/navigation.md', import.meta.url), 'utf8'));
  expect(CATALOG_GUIDANCE.length).toBeLessThan(4000);
});

test('catalog covers three tiers and every record resolves to bounded content with valid relationships', async () => {
  const first = await searchCatalog({ limit: 20 });
  expect(new Set(first.entries.map(entry => entry.tier))).toEqual(new Set(['resource', 'technique', 'foundation']));
  expect(first.total).toBeGreaterThan(8);
  const all = [...first.entries];
  for (let offset = 20; offset < first.total; offset += 20) all.push(...(await searchCatalog({ offset, limit: 20 })).entries);
  expect(new Set(all.map(entry => entry.id)).size).toBe(all.length);
  for (const entry of all) {
    const detail = await readCatalog(entry.id);
    expect(detail.content.length).toBeGreaterThan(150);
    expect(detail.content.length).toBeLessThanOrEqual(16_000);
    expect(detail.provenance.length).toBeGreaterThan(15);
    expect(detail.limitations.length).toBeGreaterThan(0);
    for (const id of entry.relatedIds) expect(await catalogEntryExists(id)).toBe(true);
    const file = new URL(`../../shared/animlib/catalog/${entry.document}`, import.meta.url);
    expect((await stat(file)).isFile()).toBe(true);
    expect(await readFile(file, 'utf8')).toBe(detail.content);
    for (const [, target] of detail.content.matchAll(/\]\(([^)#]+)(?:#[^)]*)?\)/g)) {
      if (/^https:\/\//.test(target)) continue;
      expect((await stat(new URL(target, file))).isFile()).toBe(true);
    }
  }
});

test('search ranks real mechanisms and paginates without growing prompt-sized results', async () => {
  expect((await searchCatalog({ query: '3D linear algebra' })).entries[0].id).toBe('linear-algebra-3d');
  expect((await searchCatalog({ query: 'crambin', tier: 'resource' })).entries.some(entry => entry.id === 'crambin-1crn')).toBe(true);
  const first = await searchCatalog({ limit: 2 }), second = await searchCatalog({ offset: 2, limit: 2 });
  expect(first.entries).toHaveLength(2); expect(second.entries).toHaveLength(2);
  expect(first.total).toBe(second.total);
  expect(first.entries.some(entry => second.entries.some(other => other.id === entry.id))).toBe(false);
  expect((await searchCatalog({ query: 'unfindable-xqz' })).entries).toEqual([]);
  for (const args of [{limit: 21}, {offset: -1}, {query: 'a'.repeat(241)}, {tier: 'anything'}, {limit: NaN}]) {
    await expect(searchCatalog(args as never)).rejects.toThrow();
  }
});

test('ID-only lookup rejects paths and related traversal is bounded and cycle-safe', async () => {
  for (const id of ['../README', 'techniques/linear-algebra-3d.md', 'missing', '__proto__']) {
    await expect(readCatalog(id)).rejects.toThrow();
    expect(await catalogEntryExists(id)).toBe(false);
  }
  const related = await relatedCatalogEntries('linear-algebra-3d', 3);
  expect(related.length).toBeLessThanOrEqual(3);
  expect(new Set(related.map(entry => entry.id)).size).toBe(related.length);
  expect(related.some(entry => entry.id === 'linear-algebra-3d')).toBe(false);
  const controller = new AbortController(); controller.abort(new Error('stopped'));
  await expect(catalogTools.read('linear-algebra-3d', controller.signal)).rejects.toThrow('stopped');
});

test('catalog HTTP API returns public metadata, rejects invalid requests and never exposes arbitrary files', async () => {
  const route = catalogRoutes(), get = (suffix = '') => route(new Request(`http://localhost/api/visualization-catalog${suffix}`));
  const list = await (await get('?tier=technique&limit=2')).json();
  expect(list).toMatchObject({ offset: 0, limit: 2 });
  expect(list.entries.every((entry: {tier: string}) => entry.tier === 'technique')).toBe(true);
  const detail = await (await get('/crambin-1crn')).json();
  expect(detail.id).toBe('crambin-1crn'); expect(detail.content).toContain('publish_model');
  expect((await get('/missing')).status).toBe(404);
  for (const suffix of ['?limit=500', '?offset=1.5', '?tier=unknown', '/..%2fpackage.json']) expect((await get(suffix)).status).toBe(400);
  expect((await route(new Request('http://localhost/api/visualization-catalog', { method: 'POST' }))).status).toBe(405);
});

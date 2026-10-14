import { expect, test } from 'bun:test';
import { readFile, stat } from 'node:fs/promises';
import { catalogRoutes, searchCatalog, readCatalog, catalogEntryExists, relatedCatalogEntries } from '../src/visualization-catalog.js';
import { catalogTools, CATALOG_GUIDANCE, summarizeCatalogSearch } from '../src/agents/catalog.js';
import * as catalog from '../src/visualization-catalog.js';
import type { CatalogEntry } from '../../shared/animlib/catalog/types.js';
test('illustrative molecule reuse contracts require their actual builder inputs',async()=>{
 for(const id of ['peptide-motion-data','nucleic-example-inputs','nucleic-mechanisms']){
  const detail=await readCatalog(id);
  const contract=detail.reuseContract!;
  expect(contract.requiredInputs.join(' ')).toContain('sequence');
  expect(contract.requiredInputs.join(' ')).not.toContain('PDB accession');
  expect(contract.motionLimitations.join(' ')).not.toContain('s.rigidMotion');
  expect(contract.requiredInputs.join(' ')).toContain(id==='peptide-motion-data'?'torsion':'pairing');
 }
});

test('catalog filters discovery by domain and readiness and recognizes disciplinary aliases', async () => {
  const biological = await searchCatalog({domain: 'biology', readiness: 'host-preparation', limit: 20});
  expect(biological.entries.length).toBeGreaterThan(0);
  expect(biological.entries.every(entry => entry.domains.includes('biology') && entry.readiness === 'host-preparation')).toBe(true);
  expect((await searchCatalog({query: 'volume-preserving matrix'})).entries[0]?.id).toBe('linear-algebra-3d');
  for (const [query, id] of [
    ['electromagnetic fields', 'vector-scalar-fields'], ['wave interference', 'waves-interference'],
    ['bayesian probability', 'probability-inference'], ['chemical reactions', 'reaction-transport'],
    ['engineering vibration', 'mechanical-modes'], ['neural firing rates', 'neural-event-rates'],
  ]) expect((await searchCatalog({query})).entries[0]?.id).toBe(id);
  for (const input of [{domain: 'x'.repeat(61)}, {readiness: 'fiction'}]) await expect(searchCatalog(input as never)).rejects.toThrow();
});

test('model catalog responses omit long metadata and obey byte budgets without losing pagination', async () => {
  const signal = new AbortController().signal;
  const result = await catalogTools.search({limit: 20}, signal);
  expect(result.entries.length).toBeGreaterThan(0);
  expect(result.entries[0]).not.toHaveProperty('limitations');
  expect(result.entries[0]).not.toHaveProperty('provenance');
  expect(Buffer.byteLength(JSON.stringify(result))).toBeLessThanOrEqual(12_000);
  expect(result.nextOffset).toBe(result.offset + result.entries.length);
  const next = await catalogTools.search({offset: result.nextOffset, limit: 20}, signal);
  expect(result.entries.some(entry => next.entries.some(other => other.id === entry.id))).toBe(false);
  const detail = await catalogTools.read('linear-algebra-3d', signal);
  expect(detail.content).toContain('three-dimensional');
  expect(detail.relatedEntries[0]).not.toHaveProperty('limitations');
  expect(Buffer.byteLength(JSON.stringify(detail))).toBeLessThanOrEqual(28_000);
});

test('indexed ranking favors coverage and exact aliases without substring false positives', () => {
  expect(typeof catalog.createCatalogSearchIndex).toBe('function');
  const entry = (id: string, title: string, description: string, aliases: string[] = []): CatalogEntry => ({
    id, title, description, aliases, tier: 'technique', domains: ['physics'], tags: [], relatedIds: [],
    readiness: 'ready', document: `techniques/${id}.md`, provenance: 'Original mathematical guidance.', limitations: ['No unprovided measurements.'],
  });
  const index = catalog.createCatalogSearchIndex([
    entry('waves', 'Waves', 'A general introduction.'),
    entry('phase-wave', 'Phase transport', 'Show waves and interference from the same state.', ['phasors']),
    entry('probability', 'Conditional probability', 'Distribution and inference.'),
  ]);
  expect(index.search({query: 'the waves and interference'}).entries[0]?.id).toBe('phase-wave');
  expect(index.search({query: 'phasor'}).entries[0]?.id).toBe('phase-wave');
  expect(index.search({query: 'prob'}).entries).toEqual([]);
  expect(index.search({query: 'phase-wave'}).entries[0]?.id).toBe('phase-wave');
  expect(index.has('phase-wave')).toBe(true);
  const result = index.search({query: 'phasor'}); result.entries[0].title = 'mutated';
  expect(index.search({query: 'phasor'}).entries[0].title).toBe('Phase transport');
});

test('model byte limits count UTF-8 and resume exactly after the last delivered record', async () => {
  const base = (await searchCatalog({limit: 1})).entries[0];
  const entries = Array.from({length: 20}, (_,i) => ({...base, id: `entry-${i}`, title: '数'.repeat(120),
    description: '数'.repeat(500), domains: Array.from({length: 8}, () => '数'.repeat(60))}));
  const result = summarizeCatalogSearch({entries, total: 100, offset: 40, limit: 20});
  expect(result.entries.length).toBeGreaterThan(0);
  expect(result.entries.length).toBeLessThan(20);
  expect(Buffer.byteLength(JSON.stringify(result))).toBeLessThanOrEqual(12_000);
  expect(result.nextOffset).toBe(40 + result.entries.length);
  expect(result.entries.map(entry => entry.id)).toEqual(entries.slice(0, result.entries.length).map(entry => entry.id));
  expect(summarizeCatalogSearch({entries: [], total: 0, offset: 0, limit: 8}).nextOffset).toBeUndefined();
});

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

test('pagination permits the full manifest capacity and rejects offsets beyond it', async () => {
  expect(await searchCatalog({offset: 256_000, limit: 1})).toMatchObject({entries: [], offset: 256_000, limit: 1});
  await expect(searchCatalog({offset: 256_001})).rejects.toThrow();
  const route = catalogRoutes();
  expect((await route(new Request('http://localhost/api/visualization-catalog?offset=256000'))).status).toBe(200);
  expect((await route(new Request('http://localhost/api/visualization-catalog?offset=256001'))).status).toBe(400);
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
import {mkdtemp, writeFile, mkdir, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';

test('molecular reuse contracts survive detail retrieval but stay out of model discovery', async () => {
  const detail = await catalogTools.read('pdb-structures', new AbortController().signal);
  expect(detail.reuseContract?.excludedClaims).toContain('Measured molecular dynamics or folding trajectories.');
  expect(detail.reuseContract?.requiredInputs.length).toBeGreaterThan(0);
  expect(detail.reuseContract?.fallbackComposition.length).toBeGreaterThan(0);
  detail.reuseContract!.requiredInputs.push('mutated');
  expect((await readCatalog('pdb-structures')).reuseContract?.requiredInputs).not.toContain('mutated');
  expect((await catalogTools.search({query: 'pdb-structures'}, new AbortController().signal)).entries[0]).not.toHaveProperty('reuseContract');
  expect(Buffer.byteLength(JSON.stringify(detail))).toBeLessThanOrEqual(28_000);
  expect((await searchCatalog({query: 'rigid subunit motion'})).entries.some(e => e.id === 'rigid-molecular-motion')).toBe(true);
});

test('document cache bounds resident bytes, detects edits and rejects paths', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'catalog-cache-'));
  try {
    await mkdir(join(dir, 'resources'));
    await writeFile(join(dir, 'resources/a.md'), 'first');
    await writeFile(join(dir, 'resources/b.md'), 'second');
    const cache = catalog.createCatalogDocumentCache(pathToFileURL(dir + '/'), {maxEntries: 1, maxBytes: 20});
    expect(await cache.read('resources/a.md')).toBe('first');
    expect(await cache.read('resources/a.md')).toBe('first');
    expect(cache.size).toEqual({entries: 1, bytes: 5});
    await writeFile(join(dir, 'resources/a.md'), 'edited');
    expect(await cache.read('resources/a.md')).toBe('edited');
    expect(await cache.read('resources/b.md')).toBe('second');
    expect(cache.size.entries).toBe(1);
    for (const path of ['../outside.md', '/resources/a.md', 'resources/../a.md']) await expect(cache.read(path)).rejects.toThrow();
    await writeFile(join(dir, 'resources/a.md'), 'x'.repeat(16_001));
    await expect(cache.read('resources/a.md')).rejects.toThrow();
  } finally { await rm(dir, {recursive: true, force: true}); }
});

test('reuse contracts reject malformed, empty, oversized and unknown fields', async () => {
  const contract = (await readCatalog('pdb-structures')).reuseContract!;
  expect(catalog.validReuseContract(contract)).toBe(true);
  for (const invalid of [null, {}, {...contract, applicableClaims: []}, {...contract, preparationRoute: 'x'.repeat(601)},
    {...contract, requiredInputs: Array(9).fill('input')}, {...contract, motionLimitations: ['x'.repeat(501)]},
    {...contract, geometry: [1, 2, 3]}]) expect(catalog.validReuseContract(invalid)).toBe(false);
});

test('document cache byte ceiling and concurrent reads retain correct accounting', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'catalog-bytes-'));
  try {
    await mkdir(join(dir, 'resources'));
    await writeFile(join(dir, 'resources/a.md'), '123456');
    await writeFile(join(dir, 'resources/b.md'), 'abcdef');
    const cache = catalog.createCatalogDocumentCache(pathToFileURL(dir + '/'), {maxEntries: 10, maxBytes: 10});
    expect(await Promise.all(Array.from({length: 10}, () => cache.read('resources/a.md')))).toEqual(Array(10).fill('123456'));
    expect(cache.size).toEqual({entries: 1, bytes: 6});
    expect(await cache.read('resources/b.md')).toBe('abcdef');
    expect(cache.size).toEqual({entries: 1, bytes: 6});
    await writeFile(join(dir, 'resources/a.md'), 'x'.repeat(11));
    expect(await cache.read('resources/a.md')).toBe('x'.repeat(11));
    expect(cache.size).toEqual({entries: 1, bytes: 6});
  } finally { await rm(dir, {recursive: true, force: true}); }
});

test('document cache rejects a symlink escaping catalog containment', async () => {
  const {symlink} = await import('node:fs/promises');
  const parent = await mkdtemp(join(tmpdir(), 'catalog-containment-'));
  try {
    const dir = join(parent, 'catalog'), outside = join(parent, 'outside');
    await mkdir(dir); await mkdir(outside);
    await writeFile(join(outside, 'secret.md'), 'outside root');
    await symlink(outside, join(dir, 'resources'), 'junction');
    const cache = catalog.createCatalogDocumentCache(pathToFileURL(dir + '/'));
    await expect(cache.read('resources/secret.md')).rejects.toThrow('escapes its root');
    expect(cache.size).toEqual({entries: 0, bytes: 0});
  } finally { await rm(parent, {recursive: true, force: true}); }
});

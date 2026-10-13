import { open, realpath } from 'node:fs/promises';
import { isAbsolute, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CatalogEntry, CatalogIndex, CatalogShard, CatalogSearchInput, CatalogSearchResult, CatalogDetail } from '../../shared/animlib/catalog/types.js';

const root = new URL('../../shared/animlib/catalog/', import.meta.url);
const idPattern = /^[a-z][a-z0-9-]{0,79}$/;
const tiers = ['resource', 'technique', 'foundation'];
export class CatalogError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}
async function boundedText(url: URL, limit: number): Promise<string> {
  const file = await open(url, 'r');
  try {
    const info = await file.stat();
    if (!info.isFile() || info.size > limit) throw new Error('Catalog file exceeds its size limit.');
    const bytes = Buffer.alloc(info.size);
    let position = 0;
    while (position < bytes.length) {
      const result = await file.read(bytes, position, bytes.length - position, position);
      if (!result.bytesRead) throw new Error('Catalog file changed during read.');
      position += result.bytesRead;
    }
    if ((await file.read(Buffer.alloc(1), 0, 1, position)).bytesRead) throw new Error('Catalog file changed during read.');
    return bytes.toString('utf8');
  } finally { await file.close(); }
}
const shortText = (value: unknown, max: number): value is string => typeof value === 'string' && !!value.trim() && value.length <= max;
let pendingIndex: Promise<CatalogShard> | undefined;
async function index(): Promise<CatalogShard> {
  if (!pendingIndex) {
    pendingIndex = (async () => {
      const manifest = JSON.parse(await boundedText(new URL('index.json', root), 16_000)) as CatalogIndex;
      if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.shards) || !manifest.shards.length || manifest.shards.length > 128
        || new Set(manifest.shards).size !== manifest.shards.length
        || !manifest.shards.every(path => typeof path === 'string' && /^indexes\/[a-z0-9-]+\.json$/.test(path))) throw new Error('Invalid catalog index.');
      const value: CatalogShard = {schemaVersion: 1, entries: []};
      // Index shards are host metadata, never prompt contents. Bound each read and
      // load sequentially so adding a domain cannot trigger unbounded parallel I/O.
      for (const path of manifest.shards) {
        const shard = JSON.parse(await boundedText(new URL(path, root), 262_144)) as CatalogShard;
        if (shard.schemaVersion !== 1 || !Array.isArray(shard.entries) || shard.entries.length > 2000) throw new Error('Invalid catalog shard.');
        value.entries.push(...shard.entries);
      }
      const ids = new Set<string>();
      for (const entry of value.entries) {
        const strings = (v: unknown, max: number, width: number): v is string[] =>
          Array.isArray(v) && v.length <= max && v.every(item => shortText(item, width));
        if (!entry || !idPattern.test(entry.id) || ids.has(entry.id) || !tiers.includes(entry.tier)
          || !shortText(entry.title, 120) || !shortText(entry.description, 500)
          || !shortText(entry.provenance, 600) || !strings(entry.domains, 8, 60)
          || !strings(entry.tags, 16, 60) || !strings(entry.relatedIds, 12, 80)
          || !strings(entry.limitations, 8, 500) || !entry.limitations.length
          || !['ready', 'host-preparation', 'reference'].includes(entry.readiness)
          || !/^(resources|techniques|foundations)\/[a-z0-9-]+\.md$/.test(entry.document)) throw new Error('Invalid catalog entry.');
        ids.add(entry.id);
      }
      for (const entry of value.entries) for (const id of entry.relatedIds) {
        if (!ids.has(id) || id === entry.id) throw new Error('Invalid catalog relationship.');
      }
      return value;
    })();
    void pendingIndex.catch(() => { pendingIndex = undefined; });
  }
  return pendingIndex;
}
function validateId(id: string) {
  if (typeof id !== 'string' || !idPattern.test(id)) throw new CatalogError('Use a catalog ID, not a path.');
}
async function find(id: string): Promise<CatalogEntry> {
  validateId(id);
  const entry = (await index()).entries.find(entry => entry.id === id);
  if (!entry) throw new CatalogError('Catalog entry not found.', 404);
  return entry;
}
export async function catalogEntryExists(id: string): Promise<boolean> {
  if (typeof id !== 'string' || !idPattern.test(id)) return false;
  return (await index()).entries.some(entry => entry.id === id);
}
export async function searchCatalog(input: CatalogSearchInput = {}): Promise<CatalogSearchResult> {
  const {query = '', tier, offset = 0, limit = 8} = input;
  if (typeof query !== 'string' || query.length > 240 || (tier !== undefined && !tiers.includes(tier))
    || !Number.isInteger(offset) || offset < 0 || offset > 100_000
    || !Number.isInteger(limit) || limit < 1 || limit > 20) throw new CatalogError('Invalid catalog query, tier, offset or limit (1–20).');
  const normalized = query.trim().toLowerCase();
  const terms = normalized.split(/\s+/).filter(Boolean);
  const matches = (await index()).entries.filter(entry => !tier || entry.tier === tier).map(entry => {
    const title = entry.title.toLowerCase(), tags = [entry.id, ...entry.tags, ...entry.domains].join(' ').toLowerCase();
    const description = entry.description.toLowerCase();
    const score = terms.reduce((sum, term) => sum + (title.includes(term) ? 8 : 0) + (tags.includes(term) ? 5 : 0) + (description.includes(term) ? 2 : 0), 0)
      + (normalized && title.includes(normalized) ? 100 : 0);
    return {entry, score};
  }).filter(hit => !terms.length || hit.score > 0).sort((a, b) => b.score - a.score || a.entry.id.localeCompare(b.entry.id));
  return {entries: structuredClone(matches.slice(offset, offset + limit).map(hit => hit.entry)), total: matches.length, offset, limit};
}
export async function readCatalog(id: string): Promise<CatalogDetail> {
  const entry = await find(id);
  const [directory, file] = await Promise.all([realpath(fileURLToPath(root)), realpath(fileURLToPath(new URL(entry.document, root)))]);
  const path = relative(directory, file);
  if (isAbsolute(path) || path === '..' || path.startsWith('..' + sep)) throw new Error('Catalog document escapes its root.');
  const content = await boundedText(new URL(entry.document, root), 16_000);
  return {...structuredClone(entry), content};
}
/** Bounded breadth-first navigation; relationships can point back to earlier entries. */
export async function relatedCatalogEntries(id: string, limit = 8): Promise<CatalogEntry[]> {
  if (!Number.isInteger(limit) || limit < 1 || limit > 12) throw new CatalogError('Related-entry limit must be 1–12.');
  const entry = await find(id), entries = new Map((await index()).entries.map(entry => [entry.id, entry]));
  const queue = [...entry.relatedIds], seen = new Set([id]), result: CatalogEntry[] = [];
  for (let cursor = 0; cursor < queue.length && result.length < limit; cursor++) {
    const nextId = queue[cursor];
    if (seen.has(nextId)) continue;
    seen.add(nextId);
    const next = entries.get(nextId)!;
    result.push(next);
    for (const related of next.relatedIds) if (!seen.has(related)) queue.push(related);
  }
  return structuredClone(result);
}
export function catalogRoutes() {
  return async (request: Request): Promise<Response> => {
    if (request.method !== 'GET' && request.method !== 'HEAD') return Response.json({detail: 'Method Not Allowed'}, {status: 405, headers: {Allow: 'GET, HEAD'}});
    let response: Response;
    try {
      const url = new URL(request.url), path = decodeURIComponent(url.pathname), prefix = '/api/visualization-catalog';
      let result: CatalogDetail | CatalogSearchResult;
      if (path === prefix) {
        const number = (name: string) => url.searchParams.has(name) ? Number(url.searchParams.get(name)) : undefined;
        result = await searchCatalog({query: url.searchParams.get('query') ?? undefined, tier: url.searchParams.get('tier') as CatalogSearchInput['tier'] ?? undefined,
          offset: number('offset'), limit: number('limit')});
      } else if (path.startsWith(prefix + '/')) result = await readCatalog(path.slice(prefix.length + 1));
      else throw new CatalogError('Not Found', 404);
      response = Response.json(result, {headers: {'Cache-Control': 'no-cache'}});
    } catch (error) {
      const status = error instanceof CatalogError ? error.status : error instanceof URIError ? 400 : 500;
      response = Response.json({detail: error instanceof CatalogError ? error.message : status === 400 ? 'Invalid URL' : 'Catalog unavailable.'}, {status});
    }
    return request.method === 'HEAD' ? new Response(null, {status: response.status, headers: response.headers}) : response;
  };
}

import { open, realpath } from 'node:fs/promises';
import { isAbsolute, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CatalogEntry, CatalogIndex, CatalogShard, CatalogSearchInput, CatalogSearchResult, CatalogDetail } from '../../shared/animlib/catalog/types.js';

const root = new URL('../../shared/animlib/catalog/', import.meta.url);
const idPattern = /^[a-z][a-z0-9-]{0,79}$/;
const tiers = ['resource', 'technique', 'foundation'];
const readinessValues = ['ready', 'host-preparation', 'reference'];
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
let pendingIndex: Promise<CatalogSearchIndex> | undefined;
async function index(): Promise<CatalogSearchIndex> {
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
          || (entry.aliases !== undefined && !strings(entry.aliases, 24, 100))
          || (entry.capabilities !== undefined && !strings(entry.capabilities, 16, 100))
          || !strings(entry.limitations, 8, 500) || !entry.limitations.length
          || !readinessValues.includes(entry.readiness)
          || !/^(resources|techniques|foundations)\/[a-z0-9-]+\.md$/.test(entry.document)) throw new Error('Invalid catalog entry.');
        ids.add(entry.id);
      }
      for (const entry of value.entries) for (const id of entry.relatedIds) {
        if (!ids.has(id) || id === entry.id) throw new Error('Invalid catalog relationship.');
      }
      return createCatalogSearchIndex(value.entries);
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
  const entry = (await index()).get(id);
  if (!entry) throw new CatalogError('Catalog entry not found.', 404);
  return entry;
}
export async function catalogEntryExists(id: string): Promise<boolean> {
  if (typeof id !== 'string' || !idPattern.test(id)) return false;
  return (await index()).has(id);
}
function validateSearch(input: CatalogSearchInput) {
  const {query = '', tier, domain, readiness, offset = 0, limit = 8} = input;
  if (typeof query !== 'string' || query.length > 240 || (tier !== undefined && !tiers.includes(tier))
    || (domain !== undefined && !shortText(domain, 60)) || (readiness !== undefined && !readinessValues.includes(readiness))
    || !Number.isInteger(offset) || offset < 0 || offset > 256_000
    || !Number.isInteger(limit) || limit < 1 || limit > 20) throw new CatalogError('Invalid catalog query, tier, domain, readiness, offset or limit (1–20).');
  return {query, tier, domain: domain?.trim().toLowerCase(), readiness, offset, limit};
}
const stopwords = new Set('a an and are as at be by for from how in into is it of on or show that the their to using with'.split(' '));
function tokens(text: string): string[] {
  return (text.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/\b([23])-d\b/g, '$1d').match(/[\p{L}\p{N}]+/gu) ?? [])
    .filter(token => !stopwords.has(token)).map(token => {
      // Conservative English plurals, not fuzzy substring matching. Scientific
      // singulars (basis, analysis, physics) retain their distinct identities.
      if (token.length > 4 && token.endsWith('ies')) return token.slice(0, -3) + 'y';
      if (token.length > 4 && /(?:ches|shes|xes|zes|sses)$/.test(token)) return token.slice(0, -2);
      if (token.length > 3 && token.endsWith('s') && !/(?:ss|us|is|ics)$/.test(token)) return token.slice(0, -1);
      return token;
    });
}
export interface CatalogSearchIndex {
  search(input?: CatalogSearchInput): CatalogSearchResult;
  get(id: string): CatalogEntry | undefined;
  has(id: string): boolean;
}
/** Build once per versioned deployment. Exposed for deterministic scale benchmarks. */
export function createCatalogSearchIndex(input: readonly CatalogEntry[]): CatalogSearchIndex {
  const entries = structuredClone([...input]).sort((a, b) => a.id.localeCompare(b.id));
  const byId = new Map<string, number>();
  const postings = new Map<string, Map<number, number>>();
  const facets = new Map<string, number[]>();
  const phrases: string[][] = [];
  for (const [ordinal, entry] of entries.entries()) {
    if (byId.has(entry.id)) throw new Error('Duplicate catalog ID.');
    byId.set(entry.id, ordinal);
    phrases.push([entry.title, ...(entry.aliases ?? [])].map(text => tokens(text).join(' ')));
    const fields: [string, number][] = [[entry.id, 12], [entry.title, 8], [entry.description, 2],
      ...entry.tags.map(text => [text, 5] as [string, number]), ...entry.domains.map(text => [text, 5] as [string, number]),
      ...(entry.aliases ?? []).map(text => [text, 10] as [string, number]),
      ...(entry.capabilities ?? []).map(text => [text, 4] as [string, number])];
    for (const [text, weight] of fields) for (const term of new Set(tokens(text))) {
      let posting = postings.get(term);
      if (!posting) postings.set(term, posting = new Map());
      posting.set(ordinal, Math.max(posting.get(ordinal) ?? 0, weight));
    }
    for (const facet of new Set([`tier:${entry.tier}`, `readiness:${entry.readiness}`, ...entry.domains.map(domain => `domain:${domain.toLowerCase()}`)])) {
      const members = facets.get(facet) ?? [];
      members.push(ordinal); facets.set(facet, members);
    }
  }
  return {
    get(id) { const ordinal = byId.get(id); return ordinal === undefined ? undefined : structuredClone(entries[ordinal]); },
    has(id) { return byId.has(id); },
    search(input = {}) {
      const {query, tier, domain, readiness, offset, limit} = validateSearch(input);
      const termList = [...new Set(tokens(query))], phrase = tokens(query).join(' ');
      const filterLists = [tier && `tier:${tier}`, domain && `domain:${domain}`, readiness && `readiness:${readiness}`]
        .filter((facet): facet is string => !!facet).map(facet => facets.get(facet) ?? []).sort((a,b) => a.length - b.length);
      const allowed = (ordinal: number) => (!tier || entries[ordinal].tier === tier)
        && (!domain || entries[ordinal].domains.some(value => value.toLowerCase() === domain))
        && (!readiness || entries[ordinal].readiness === readiness);
      let ordinals: number[];
      if (!query.trim()) ordinals = (filterLists[0] ?? entries.map((_, i) => i)).filter(allowed);
      else {
        const matches = new Map<number, {coverage: number; score: number}>();
        for (const term of termList) for (const [ordinal, weight] of postings.get(term) ?? []) {
          if (!allowed(ordinal)) continue;
          const hit = matches.get(ordinal) ?? {coverage: 0, score: 0};
          hit.coverage++; hit.score += weight; matches.set(ordinal, hit);
        }
        const exactId = byId.get(query.trim().toLowerCase());
        if (exactId !== undefined && allowed(exactId) && !matches.has(exactId)) matches.set(exactId, {coverage: termList.length, score: 0});
        for (const [ordinal, hit] of matches) {
          if (entries[ordinal].id === query.trim().toLowerCase()) hit.score += 1000;
          if (phrases[ordinal].includes(phrase)) hit.score += 100;
        }
        ordinals = [...matches].sort(([ai, a], [bi, b]) => b.coverage - a.coverage || b.score - a.score || ai - bi).map(([ordinal]) => ordinal);
      }
      return {entries: structuredClone(ordinals.slice(offset, offset + limit).map(i => entries[i])), total: ordinals.length, offset, limit};
    },
  };
}
export async function searchCatalog(input: CatalogSearchInput = {}): Promise<CatalogSearchResult> {
  validateSearch(input);
  return (await index()).search(input);
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
  const entry = await find(id), entries = await index();
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
          domain: url.searchParams.get('domain') ?? undefined, readiness: url.searchParams.get('readiness') as CatalogSearchInput['readiness'] ?? undefined,
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

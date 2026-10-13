/** Run: bun backend/scripts/benchmark-catalog.ts [record-count=10000]
 * Synthetic retrieval benchmark, not an LLM-generation speed claim.
 */
import {createCatalogSearchIndex, searchCatalog} from '../src/visualization-catalog.js';
import type {CatalogEntry} from '../../shared/animlib/catalog/types.js';

const count = Number(process.argv[2] ?? 10_000);
if (!Number.isInteger(count) || count < 100 || count > 100_000) throw new Error('Record count must be 100–100000.');
const source: CatalogEntry[] = [];
let total = 1;
for (let offset = 0; offset < total; offset += 20) {
  const page = await searchCatalog({offset, limit: 20}); source.push(...page.entries); total = page.total;
}
// Repeat actual metadata across unique IDs and selective synthetic topic tags.
// This exercises search size; it does not claim real retrieval coverage at 10K.
const entries = Array.from({length: count}, (_, i) => ({...source[i % source.length],
  id: `synthetic-${String(i).padStart(6, '0')}`,
  tags: [...source[i % source.length].tags, `topic${String(i).padStart(6, '0')}`],
}));
function previousScan(query: string) {
  const normalized = query.trim().toLowerCase(), terms = normalized.split(/\s+/).filter(Boolean);
  return entries.map(entry => {
    const title = entry.title.toLowerCase(), tags = [entry.id, ...entry.tags, ...entry.domains].join(' ').toLowerCase();
    const description = entry.description.toLowerCase();
    const score = terms.reduce((sum, term) => sum + (title.includes(term) ? 8 : 0)
      + (tags.includes(term) ? 5 : 0) + (description.includes(term) ? 2 : 0), 0)
      + (normalized && title.includes(normalized) ? 100 : 0);
    return {entry, score};
  }).filter(hit => hit.score > 0).sort((a,b) => b.score-a.score || a.entry.id.localeCompare(b.entry.id)).slice(0,8);
}
function measure(fn: () => unknown, rounds: number) {
  for (let i=0; i<10; i++) fn();
  const samples: number[] = [];
  for (let i=0; i<rounds; i++) { const start = performance.now(); fn(); samples.push(performance.now()-start); }
  samples.sort((a,b) => a-b);
  return {medianMs: +samples[Math.floor(samples.length*.5)].toFixed(4), p95Ms: +samples[Math.floor(samples.length*.95)].toFixed(4)};
}
Bun.gc(true);
const before = process.memoryUsage(), started = performance.now();
const index = createCatalogSearchIndex(entries), buildMs = performance.now()-started;
Bun.gc(true);
const after = process.memoryUsage();
const queries = [`topic${String(Math.floor(count/2)).padStart(6,'0')}`, 'wave interference', 'physics', 'no-match-xqz'];
const results = queries.map(query => ({query, matches: index.search({query}).total,
  indexed: measure(() => index.search({query}), 100), previousScan: measure(() => previousScan(query), 100)}));
if (index.search({query: queries[0]}).total !== 1) throw new Error('Selective retrieval failed.');
console.log(JSON.stringify({kind: 'synthetic-catalog-retrieval', sourceRecords: source.length, records: count,
  buildMs: +buildMs.toFixed(2), heapDeltaBytes: after.heapUsed-before.heapUsed, rssDeltaBytes: after.rss-before.rss,
  results, limits: ['Repeated metadata is synthetic, not an expanded scientific corpus.',
    'Ranking changed from substring OR matching to token coverage and aliases; result sets may differ.',
    'Memory deltas and timings are process-local observations, not production capacity promises.',
    'Document I/O, model latency, authoring, rendering and visual review are excluded.']}, null, 2));

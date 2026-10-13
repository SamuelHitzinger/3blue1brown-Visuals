import { searchCatalog, readCatalog, relatedCatalogEntries } from '../visualization-catalog.js';
import { readFileSync } from 'node:fs';
import type { CatalogSearchInput, CatalogSearchResult, CatalogToolSearchResult, CatalogDetail, CatalogEntry, CatalogSummary } from '../../../shared/animlib/catalog/types.js';

export const CATALOG_SEARCH_BYTES = 12_000;
export const CATALOG_DETAIL_BYTES = 28_000;
const bytes = (value: unknown) => Buffer.byteLength(JSON.stringify(value));
const summary = ({id, title, description, tier, domains, readiness}: CatalogEntry): CatalogSummary =>
  ({id, title, description, tier, domains, readiness});

export function summarizeCatalogSearch(found: CatalogSearchResult): CatalogToolSearchResult {
  const result: CatalogToolSearchResult = {...found, entries: found.entries.map(summary)};
  const setNext = () => {
    if (result.offset + result.entries.length < result.total) result.nextOffset = result.offset + result.entries.length;
    else delete result.nextOffset;
  };
  setNext();
  while (bytes(result) > CATALOG_SEARCH_BYTES && result.entries.length > 1) { result.entries.pop(); setNext(); }
  if (bytes(result) > CATALOG_SEARCH_BYTES) throw new Error('Catalog summary exceeds the model response budget.');
  return result;
}

export interface CatalogTools {
  search(input: CatalogSearchInput, signal: AbortSignal): Promise<CatalogToolSearchResult>;
  read(id: string, signal: AbortSignal): Promise<CatalogDetail & {relatedEntries: CatalogSummary[]}>;
}
export const catalogTools: CatalogTools = {
  async search(input, signal) {
    signal.throwIfAborted();
    const result = summarizeCatalogSearch(await searchCatalog(input));
    signal.throwIfAborted();
    return result;
  },
  async read(id, signal) {
    signal.throwIfAborted();
    const [detail, relatedEntries] = await Promise.all([readCatalog(id), relatedCatalogEntries(id, 6)]);
    const result = {...detail, relatedEntries: relatedEntries.map(summary)};
    while (bytes(result) > CATALOG_DETAIL_BYTES && result.relatedEntries.length) result.relatedEntries.pop();
    // Never truncate a scientific limitation or recipe midway. An oversized
    // record must be split by its maintainer; the HTTP detail remains available.
    if (bytes(result) > CATALOG_DETAIL_BYTES) throw new Error('Catalog detail exceeds the model response budget; split the catalog record.');
    signal.throwIfAborted();
    return result;
  },
};
// The same small Markdown router reaches planning, authoring, review and repair.
// Growth belongs in indexed catalog documents, never in this injected context.
export const CATALOG_GUIDANCE = readFileSync(new URL('../../../shared/animlib/catalog/navigation.md', import.meta.url), 'utf8');

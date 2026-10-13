import { searchCatalog, readCatalog, relatedCatalogEntries } from '../visualization-catalog.js';
import { readFileSync } from 'node:fs';
import type { CatalogSearchInput, CatalogSearchResult, CatalogDetail, CatalogEntry } from '../../../shared/animlib/catalog/types.js';

export interface CatalogTools {
  search(input: CatalogSearchInput, signal: AbortSignal): Promise<CatalogSearchResult>;
  read(id: string, signal: AbortSignal): Promise<CatalogDetail & {relatedEntries: CatalogEntry[]}>;
}
export const catalogTools: CatalogTools = {
  async search(input, signal) {
    signal.throwIfAborted();
    const result = await searchCatalog(input);
    signal.throwIfAborted();
    return result;
  },
  async read(id, signal) {
    signal.throwIfAborted();
    const [detail, relatedEntries] = await Promise.all([readCatalog(id), relatedCatalogEntries(id, 6)]);
    signal.throwIfAborted();
    return {...detail, relatedEntries};
  },
};
// The same small Markdown router reaches planning, authoring, review and repair.
// Growth belongs in indexed catalog documents, never in this injected context.
export const CATALOG_GUIDANCE = readFileSync(new URL('../../../shared/animlib/catalog/navigation.md', import.meta.url), 'utf8');

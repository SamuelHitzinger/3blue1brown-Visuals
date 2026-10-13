/** Public authoring metadata. These records do not register runtime assets. */
export type CatalogTier = 'resource' | 'technique' | 'foundation';
export type CatalogReadiness = 'ready' | 'host-preparation' | 'reference';
export interface CatalogEntry {
  id: string;
  title: string;
  description: string;
  tier: CatalogTier;
  domains: string[];
  tags: string[];
  /** Discovery synonyms; no semantic inference or executable registration. */
  aliases?: string[];
  /** Exact scene API names or explicitly host-only preparation capabilities. */
  capabilities?: string[];
  relatedIds: string[];
  readiness: CatalogReadiness;
  /** Relative to shared/animlib/catalog; only the host resolves this path. */
  document: string;
  provenance: string;
  limitations: string[];
}
export interface CatalogDetail extends CatalogEntry { content: string }
export interface CatalogSearchInput { query?: string; tier?: CatalogTier; domain?: string; readiness?: CatalogReadiness; offset?: number; limit?: number }
export interface CatalogSearchResult { entries: CatalogEntry[]; total: number; offset: number; limit: number }
/** Small model-facing discovery records; full provenance and limits require a read. */
export type CatalogSummary = Pick<CatalogEntry, 'id' | 'title' | 'description' | 'tier' | 'domains' | 'readiness'>;
export interface CatalogToolSearchResult { entries: CatalogSummary[]; total: number; offset: number; limit: number; nextOffset?: number }
export interface CatalogIndex { schemaVersion: 1; shards: string[] }
export interface CatalogShard { schemaVersion: 1; entries: CatalogEntry[] }

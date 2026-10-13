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
  relatedIds: string[];
  readiness: CatalogReadiness;
  /** Relative to shared/animlib/catalog; only the host resolves this path. */
  document: string;
  provenance: string;
  limitations: string[];
}
export interface CatalogDetail extends CatalogEntry { content: string }
export interface CatalogSearchInput { query?: string; tier?: CatalogTier; offset?: number; limit?: number }
export interface CatalogSearchResult { entries: CatalogEntry[]; total: number; offset: number; limit: number }
export interface CatalogIndex { schemaVersion: 1; shards: string[] }
export interface CatalogShard { schemaVersion: 1; entries: CatalogEntry[] }

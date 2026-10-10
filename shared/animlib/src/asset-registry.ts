import type { AssetGeometryRef, AssetRegistry, PreparedModelInput } from './asset-types.js';
import { ASSET_LIMITS, assetCheck, freezeAsset, hashAssetContent, validatePreparedModel } from './asset-validation.js';

/** Caller-owned immutable registry. No global cache; duplicate instances allocate only references. */
export async function createAssetRegistry(inputs: PreparedModelInput[], options: { maxBytes?: number } = {}): Promise<AssetRegistry> {
  assetCheck(Array.isArray(inputs) && inputs.length <= ASSET_LIMITS.models, 'registry model limit exceeded');
  const limit = options.maxBytes ?? ASSET_LIMITS.registryBytes;
  assetCheck(Number.isSafeInteger(limit) && limit > 0 && limit <= ASSET_LIMITS.registryBytes, 'invalid registry memory limit');
  const entries = new Map<string, ReturnType<typeof validatePreparedModel> & {hash:string; pins:number}>();
  let decodedBytes = 0, leases = 0;
  for (const input of inputs) {
    assetCheck(!entries.has(input.id), 'duplicate asset ID');
    const entry = validatePreparedModel(input);
    decodedBytes += entry.bytes; assetCheck(decodedBytes <= limit, 'registry memory limit exceeded');
    const { id: _id, ...content } = entry.model;
    entries.set(input.id, {...entry, hash:await hashAssetContent(content), pins:0});
  }
  const catalog = freezeAsset(Array.from(entries.values(), entry=>({...entry.descriptor,hash:entry.hash})));
  assetCheck(JSON.stringify(catalog).length <= ASSET_LIMITS.catalogBytes, 'descriptor catalog size limit exceeded');
  return Object.freeze({
    catalog,
    acquire(refs: readonly AssetGeometryRef[]) {
      const allowed = new Map<string, Set<string>>();
      for (const ref of refs) {
        const entry = entries.get(ref.id);
        assetCheck(entry && entry.hash === ref.hash, `missing or stale model ${ref.id}`);
        assetCheck(entry.meshes.has(ref.part), `missing part ${ref.id}/${ref.part}`);
        const parts = allowed.get(ref.id) ?? new Set<string>(); parts.add(ref.part); allowed.set(ref.id,parts);
      }
      for (const id of allowed.keys()) entries.get(id)!.pins++;
      leases++; let disposed = false;
      return Object.freeze({
        resolve(ref: AssetGeometryRef) {
          assetCheck(!disposed, 'lease is disposed');
          const entry = entries.get(ref.id);
          assetCheck(entry && entry.hash === ref.hash && allowed.get(ref.id)?.has(ref.part), `reference not held by lease: ${ref.id}/${ref.part}`);
          return entry.meshes.get(ref.part)!;
        },
        dispose() { if (disposed) return; disposed=true; leases--; for(const id of allowed.keys()) entries.get(id)!.pins--; },
      });
    },
    stats() { return { decodedBytes, pinnedBytes:Array.from(entries.values()).reduce((sum,e)=>sum+(e.pins?e.bytes:0),0), leases, models:entries.size }; },
  });
}

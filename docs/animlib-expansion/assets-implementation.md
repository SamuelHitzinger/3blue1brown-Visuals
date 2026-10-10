# Prepared model implementation

Status: implemented static-model slice, 2026-10-11. Shared-file handoff from
path-engine completed before edits. Existing budgets are unchanged.

Pinned interface: `Geometry.kind === 'mesh'` plus optional
`asset: { id: string; hash: string; part: string }`, with no vertex/index arrays.
`CompileInput.assetCatalog` is an array of model descriptors (ID, SHA-256,
part IDs, counts and bounds). `s.model(id, {asset, ...style})` builds an ordinary
group with stable `${id}.${part.id}` child IDs. No model bytes enter QuickJS.
`s.modelInfo(assetId)` returns a detached descriptor with bounds/part counts.
`PlayerOptions.modelAssets` and `SequenceOptions.modelAssets` hold the registry;
the existing `assets` option continues to serve audio. Offline hosts pass the
registry in the fourth argument, `withOfflineScene(..., {modelAssets})`, and give
`sampler.assetGeometry` to `renderer.prepare(scenes, resolver)`.

Host `createAssetRegistry(models)` is asynchronous for SHA-256 content identity.
Registry owns deep-frozen cloned plain geometry arrays and a frozen descriptor
catalog. `registry.acquire(refs)` validates the complete set before changing
reference counts. Returned `AssetLease` supplies `resolve(ref): Geometry` and
idempotent `dispose()`. Values returned by resolve are deeply immutable; no raw
mutable typed arrays are exposed. Registries are caller-owned and bounded;
leases pin referenced models without owning/discarding other players' entries.

The single `resolveAssetGeometry(geometry, resolver)` function will compose
immutable mesh arrays with per-element appearance only inside CPU preparation.
Frames and retention keys remain small references. Renderer, bounds and render
validation receive an explicit `AssetGeometryResolver`; no process-global
registry. Both GPU backends consume the existing common geometry output.
Bounds and overlap APIs accept `assetGeometry`; picking receives the same
capability from the player. Retained keys use references before resolution.
Mesh expansion uses a weak identity annotation to avoid serializing source
arrays for the existing bounded mesh-shading cache. No new model/global array
cache was introduced.

`SceneAssets` prepares each candidate before host preparation, checks references
and counts against the live registry, then releases uncommitted scene leases in
the sequence transaction's `finally`. Prefix/recovered scenes follow the same
ownership rule. Offline callbacks own one scoped lease and release it on success,
failure or cancellation. Immutable registries remain caller-owned; this version
has no incremental registry mutation or eviction mechanism.

Registry identity hashes canonical native model content except host ID; package
integrity separately hashes canonical manifest content except its hash field.
The v1 package reader validates field sets, counts, provenance, units, paths,
SHA-256 and exact byte lengths. Node I/O checks real paths against the package
root, then performs bounded reads through an open handle. Registry/model memory
accounting reserves 128 bytes per triple to bound boxed-array storage rather than
pretending wire byte length is JavaScript heap usage.

Image descriptor v1 is pinned as RGBA8/sRGB/top-left/straight-alpha, host source
color authorization only. Palette-indexed images and image rendering are deferred.

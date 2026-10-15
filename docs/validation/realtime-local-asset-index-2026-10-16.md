# Local asset lookup checkpoint — 2026-10-16

`backend/bench/realtime-media/asset-index.ts` adds a host-only inventory for the persistent-world experiment. It reuses the production catalog search index, native `loadAssetRegistry`, and `ModelAssets` publication payload. It does not create subject animations, download assets, call a model, mutate a scene, or change the production player.

The existing production visualization resolver remains useful for its curated resource and scientific preparation routes. It does not replace this local file/clip inventory. The new adapter is deliberately under `bench`; no production agent tool or network endpoint was added.

## Actual installed catalog evidence

The adjacent JSON records one local run, including exact paths, hashes, bounds, provenance, query timings, cache flags, loading results and exclusions. Timings are observations on this machine, not a latency guarantee. Test execution ran concurrently, and OS caches were not reset.

| Measurement | Result |
| --- | --- |
| Indexed records | 52: 42 native models, 5 native images, 3 JSON data files, 1 source glTF, 1 published GLB |
| Index build | 134.59 ms; 107 bounded file reads; 9,490,660 bytes |
| `suzanne textured` / native model | 0.328 ms first query; 0.017 ms cached |
| `4YLN` / published GLB | 0.066 ms first query; 0.011 ms cached |
| JSON data filter | 0.069 ms first query; 0.017 ms cached |
| Textured Suzanne registry load | 210.86 ms; selected model plus its exact image dependency |
| Published 4YLN payload load | 19.07 ms; 3,803,752 decoded bytes; SHA-256 matched |

The actual 4YLN model contains 90,004 triangles and 12 parts. Its dimensions are 153.683 × 153.128 × 140.315 angstrom. The asset is `backend/data/models/b395b900e5008e039b988a865814311a9d55cc5ff1bf0675b01621265236e450.glb`; its renderer ID is `model-b395b900e5008e039b988a865814311a9d55cc5ff1bf0675b01621265236e450`. The returned provenance preserves the deposited 5.50 Å static experimental-model limitations, CA-trace representation and improper-nucleotide-linkage caveat. Its RCSB URL is recorded provenance; the index does not fetch it.

Installed animation metadata reports **49 known static records, zero records with clips, and three unknown records** (JSON data). The clip-name test uses a small supplemental glTF fixture because the installed corpus has no clips. This is not evidence of an animated GLB rendering path. Clip playback, skinning and morph-target playback remain unsupported.

The oversized `fixtures/biological/peptide-staged/staging.json` is explicitly excluded by the 1 MiB metadata cap and appears in `metrics().issues`. No missing dimensions, licensing, source or animation information is fabricated.

## API and world integration

Create one index per host session, then call `query({query,kind,format,animated,limit,offset})`. Exact kind/format/animation filters combine with the existing deterministic catalog retrieval. This is lexical/curated catalog retrieval, without embeddings or a vector database. `select(id)` returns a defensive copy, and selection APIs accept indexed IDs rather than arbitrary paths.

Records include absolute asset/manifest paths, byte hash, native package/descriptor hashes where available, bounds/dimensions and their origin, counts, provenance, runtime route and limitations. glTF clip metadata uses the actual name (or `null` for unnamed clips), index, absolute path, JSON pointer and duration only when input accessor metadata supports it. `animated:false` excludes unknown metadata. Raw source glTF/GLB entries require import validation and cannot be sent directly to the renderer through this adapter.

Native packages use `await index.loadNativeRegistry(ids)` and the existing `WorldOptions.assets` route. The loader includes exact image dependencies, verifies manifests have not changed, validates binary hashes through the existing loader, and checks descriptor identity. Retain the returned registry in the host; the index does not keep a second geometry cache.

Published static GLBs use `await index.loadPublishedModels(ids)`, returning the existing `RenderModelAssets` shape. The result contains base64 bytes and is for host use, not model/tool context. The method rechecks the indexed sidecar and containment, retains `ModelAssets.provenance()` validation, and loads each unique GLB with a bounded file-handle read and SHA-256 verification. It does not call the unbounded `ModelAssets.forRendering()` reader. The existing `ModelStore` subsequently checks the payload hash and parsed metadata during preparation and caches decoded geometry.

The world now accepts `WorldOptions.models`. The smallest native integration is:

```ts
const index = await createLocalAssetIndex();
const record = index.query({query: '4YLN', format: 'published-glb'}).entries[0];
const payload = await index.loadPublishedModels([record.id]);
const models = createOfflineModelStore(payload); // existing tools/load-models.mjs
const world = new LiveWorld({
  models: models.metadata,
  prepare: async (scene, _assets, signal) => {
    signal.throwIfAborted();
    await models.prepare([scene]);
    signal.throwIfAborted();
  },
});
// Existing CanvasRenderer fourth argument is models; native registry is third.
// The host disposes both world and models when the session ends.
```

`runtime.liveWorld:true` for published GLBs means this supported static route is available with the host metadata/preparation/renderer wiring; it does not mean a query loaded geometry or enabled animation playback. Preparation remains transactional in the world. Metadata is immutable for a world session; registering new model IDs requires an explicit inventory lifecycle design beyond this index.

## Bounds and snapshot behavior

- Default scan: 512 candidate files, 64 MiB aggregate bytes; configurable ceilings are 2,000 files and 128 MiB. Directory depth is 8 and directory count is 512.
- Native/source JSON is capped at 1 MiB; published sidecars and GLBs at 32 MiB each; GLB JSON at 2 MiB. Clip metadata is capped at 128 clips. Symlinks are excluded; loading rechecks realpath containment.
- Queries are memory-only, capped at 240 characters, 20 results and under 64 kB per response, with a 64-entry LRU query cache. Pagination advances by records actually delivered after the byte cap.
- Selection takes 1–16 unique indexed IDs. Published loading caps each GLB at 32 MiB and the sum of unique raw GLB bytes per call at configured `maxBytes`; base64 payload size has the usual 4/3 encoding overhead. An opened file's size is checked before allocation, reads use a fixed size-plus-one-byte buffer to detect concurrent growth, and hash mismatch rejects same-size tampering. Registry and model decoding retain their existing resource budgets. `readData` returns at most 8,000 characters from indexed local JSON and rejects changed snapshots.
- Rebuild explicitly to discover changed files. Lookup metrics describe index file reads and query cache use; host asset loads have separate counters and are not included in `metadataReads`.
- Raw glTF dimensions are mesh-local accessor bounds and exclude node transforms. Native model bounds come from existing conversion descriptors; registry loading validates the selected descriptor identity.

## Verification

Fresh focused run after the published-file bounds fix: **9 tests passed, 0 failed, 49 assertions**. Cases cover actual textured native assets, published GLB payload bytes, post-index growth beyond 32 MiB or a smaller configured budget, same-size GLB tampering/restoration, actual clip names/unnamed clips/unknown metadata, changed snapshots, directory-junction escape and byte-capped pagination. Both oversized-file regressions first failed against the previous implementation because its unbounded read reached the hash check. Focused TypeScript checking passed.

A follow-up actual 4YLN load through the bounded path returned the same 3,803,752 bytes, SHA-256 and 90,004 triangles in 19.70 ms (including output decoding and verification). The adjacent JSON retains the earlier complete catalog timing snapshot.

From `backend` with `TEMP` and `TMP` set to a writable local `.tmp` directory:

```powershell
../node_modules/.bin/bun.cmd test ./bench/realtime-media/asset-index.test.ts
../node_modules/.bin/tsc.cmd --noEmit --target es2022 --module esnext --moduleResolution bundler --types bun --skipLibCheck bench/realtime-media/asset-index.ts bench/realtime-media/asset-index.test.ts
../node_modules/.bin/bun.cmd bench/realtime-media/asset-index.ts 4YLN
```

The Windows junction regression needs permission to create a temporary junction; its full test run was executed with the available sandbox escalation. The CLI prints the first and cached query plus index metrics; the adjacent JSON also captures successful registry and published-payload loads through the API.

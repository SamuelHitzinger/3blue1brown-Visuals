# Preparing static glTF assets

Run from `shared/animlib`, after `npm run build`:

```sh
node tools/convert-gltf.mjs --input /path/model.gltf --output /path/prepared --id my-model --metadata /path/provenance.json
```

`.glb` uses the same command. `--scene 0` overrides the source default scene. Output contains one native model JSON, image JSONs, content-hashed binary blobs and `conversion-report.json`. Preparation is offline; no network requests or scene-VM decoding occur. Build output is used for final registry validation and hashing. Output directories should be new or dedicated to this asset: matching manifest filenames are replaced, old unreferenced blobs are not removed.

Metadata is required. Supply `source`, `creator`, a known `license`, `preparedAt`, `selection`, `modifications` (array), `fidelity`, and `converter:{name,version,options}`. The tool computes the input file SHA-256, records every loaded buffer/image SHA-256, selected scene, baked transforms and omissions. This metadata records the operator's license knowledge; it does not infer legal permission from the model file.

```json
{
  "source": "https://example.org/model",
  "creator": "Actual model author",
  "license": "CC0-1.0",
  "preparedAt": "2026-10-11",
  "selection": "default scene",
  "modifications": [],
  "fidelity": "Static base-color asset",
  "converter": {"name":"animlib static-gltf + pngjs","version":"1 / pngjs 7.0.0","options":{}}
}
```

## Accepted subset

- glTF 2.0 JSON with local relative dependencies, or GLB 2.0 with one JSON chunk followed by at most one BIN chunk. Unknown chunks and extensions fail. Only `KHR_materials_unlit` is recognized, at materials.
- Selected static scene, acyclic unique-parent node tree, triangle primitives, indexed or sequential. Float32 POSITION/NORMAL, Float32 or normalized unsigned 8/16-bit TEXCOORD_0, unsigned 8/16/32-bit indices. Checked offsets, buffer view ranges and interleaved vertex strides. Vertex tuples are never welded, preserving UV seams.
- Affine matrix or TRS transforms are baked in glTF's metre/right-handed convention. Normals use inverse transpose, reflections reverse winding. Singular/projective transforms and non-unit quaternions fail. Native geometry stores Float32; transformed positions/normals and normalized integer UVs are explicitly rounded to that representation before registry hashing.
- PNG base-color images, top-left rows, unchanged encoded sRGB samples, straight alpha, RGBA8 storage. Eight-bit RGB, RGBA, grayscale, grayscale-alpha and indexed PNG are accepted; palette lookup preserves the PNG colors. No scene-palette mapping, premultiplication, gamma operation, vertical pixel flip or UV flip occurs. Missing color metadata uses glTF base-color sRGB semantics.
- OPAQUE/BLEND, UV set zero, equal nearest/linear min/mag sampling and equal clamp/repeat S/T wrapping. Strict material import requires unlit, double-sided materials with white/absent baseColorFactor. Use `s.model(...,{shading:'unlit'})` when displaying these source samples; per-part glTF shading is not persisted. Material-free geometry is neutral geometry for author styling.

## Explicit derivative policy

Full PBR is unsupported. `--material-policy base-color-only` permits an explicitly labelled derivative and records omitted metallic-roughness/PBR lighting, normal/occlusion/emissive channels, tangents, and back-face culling. This does not promise the source renderer's overall appearance. Non-white baseColorFactor still fails: a deliberate source-color bake is needed. Alpha MASK, unknown extensions/material transformations, unsupported attributes, cameras, skins, morph targets and animations fail rather than silently disappearing.

PNG limitations are deliberate: interlace, other bit depths (including 16-bit), APNG, ICC/cICP profiles and non-sRGB gamma/chromaticity fail. No high-bit-depth quantization happens. The pinned `pngjs@7.0.0` synchronous decoder is wrapped with header/chunk checks and bounded DEFLATE output before decoding; CRC checking remains enabled. The [upstream API](https://github.com/pngjs/pngjs#sync-api) documents synchronous decoding; installed implementation was inspected to exclude its unbounded interlaced inflate branch.

## Bounds and filesystem boundary

Input/dependency byte budget is 64 MiB (embedded image data is conservatively counted again), JSON limit 4 MiB, at most 1,024 entries per source table, 128 output parts, 20,000 vertices and 20,000 triangles per part, and a conservative 32 MiB decoded model budget. Image dimensions are at most 4,096 per axis with a 128 MiB aggregate decoded image cap; the registry additionally enforces its aggregate host budget. Excesses fail.

Dependencies must use simple relative ASCII paths inside the source package. Remote/data/absolute URIs, parent traversal, URL escaping and backslashes fail before reading. Resolved real paths also must remain inside the package, so symlink/junction escapes fail. Bounded file handles check exact size and growth. This is an offline import boundary, not a promise against concurrent adversarial filesystem mutations.

## Use native packages

Load all image and model manifests together, with explicit host `colorPolicy:'source'`, through `tools/load-assets.mjs` or `decodeImagePackage` / `decodeModelPackage` plus `createAssetRegistry`. Pass the registry as `modelAssets` to compilation/offline APIs. The scene gets descriptors and immutable references only:

```js
const model = s.model('object', {asset:'my-model', shading:'unlit'});
const image = s.image('map', {asset:'my-model-image-0', width:3});
s.keep(model, image);
```

Production render manifest/frame input supports `modelAssets:[...nativeManifestPaths]` and `colorPolicy:'source'`. The host registry, shared geometry resolver and renderer remain the sole preparation/rendering path.

Reproduce the licensed fixture with `node tools/prepare-suzanne-textured.mjs`. See `fixtures/suzanne/textured/README.md` for source fidelity and omissions.

# Static importer and source-color asset proof

Implemented 2026-10-11 on amilibsam after model snapshot3370559. This worker owns only new offline importer/PNG/preparation tools, their tests, fixture additions, pngjs dependency, documentation and proof source. Shared registry/compiler/rendering changes belong to the image worker; there is one production rendering pipeline.

## Result and reproduction

`shared/animlib/tools/convert-gltf.mjs` is a reusable offline glTF/GLB subset converter, not a hardcoded Suzanne extractor. `prepare-suzanne-textured.mjs` pins the real licensed source and invokes that converter with an explicit derivative policy. User-facing subset, CLI, bounds, material/transform failures, provenance requirements and host integration are documented in `shared/animlib/docs/assets-import.md`. Source texture files and native image/model packages are under `shared/animlib/fixtures/suzanne/{source,textured}`.

The strict policy rejects unsupported appearance rather than suggesting full fidelity. Suzanne explicitly omits tangents, back-face culling and metallic-roughness/PBR lighting. Position, normal and UV tuples remain exactly source-faithful; no vertex welding or UV/pixel flipping occurs. Base-color pixels are unchanged, including RGB under transparent alpha in synthetic tests. Only eight-bit PNG is supported; 16-bit sources fail without quantization. Interlace/APNG/custom color profiles also fail. Node transforms use inverse-transpose normals and reflected winding, then explicit native Float32 serialization before hashing.

The authorized pinned devDependency is `pngjs@7.0.0`; no runtime dependency was added. Official API documentation consulted: https://github.com/pngjs/pngjs#sync-api . Installed pngjs parser implementation was checked. The wrapper rejects its interlaced inflate path and preflights header, dimensions, chunks and bounded DEFLATE length before CRC-checked synchronous decode.

## Verification

Final focused run: **44/44 tests passed across four files**, then `npm run typecheck --workspace animlib` passed. Build passed before preparation/native export. Files: `gltf-import.test.ts`, `gltf-files.test.ts`, `gltf-fixture.test.ts`, `png-assets.test.ts`.

Coverage includes reflected transforms/inverse-transpose normals, explicit Float32 serialization, interleaved accessors, offset/stride/range/index/count budgets, missing license, provenance snapshot during asynchronous reads, nonfinite coordinates, unsupported skins/animation/morphs/modes/extensions, cyclic nodes, non-unit quaternions, projective/singular matrices, GLB lengths/chunks/embedded data/padding, normalized UVs and seam preservation, material/alpha/sampler failures, explicit derivative omissions, bad dimensions/decoded lengths, source PNG CRC/truncation/depth/interlace, lexical URI escapes, bounded filesystem reads, actual Windows junction escape rejection, and full native fixture round-trip including registry catalog identity.

Run:

```
npm test --workspace animlib -- test/gltf-import.test.ts test/png-assets.test.ts test/gltf-fixture.test.ts test/gltf-files.test.ts
npm run typecheck --workspace animlib
```

Windows sandbox blocked `realpath` itself even for a local workspace input. The final four-file run therefore used authorized normal-host execution and process-local TEMP/TMP `data/animlib-expansion/tmp-assets`. The other three files passed inside the sandbox. No weakening or skipped filesystem test. An initial native-fixture assertion individually traversed4MiB and exceeded Vitest's5s default; using exact `Buffer.compare` brought the complete focused run to334ms. These are test wall-clock observations, not performance benchmarks.

## Actual native proof

Tracked source/portable manifest: `shared/animlib/demo/expansion/image-assets.js` and `image-assets-manifest.json`. Native artifacts: `data/animlib-expansion/image-proof/`.

- `film.mp4`: production CanvasRenderer/WebGPU via `render-video.mjs`, H.264/yuv420p, 1,280×720,24fps,144frames,6.00s, no audio. FFmpeg readback confirmed stream shape and duration.
- `frames/`: native full-size frames at0,1,2.5,4,4.6,6s for both1,280×720 and960×720; sheets visually inspected.
- `all-frames.png`: all144 decoded video frames in contact sheet, visually inspected for blank frames, discontinuities and texture attachment.
- `style-contract.md`: reference comparison and deliberate scope. Original scene uses a persistent source map beside unlit Suzanne. It holds1s, turns smoothly to1.35radians, then holds4.6–6s. Original yellowish eye patches stay correctly attached. Planar map remains top-left oriented. Native frames show no cropping/label collisions at either aspect ratio.
- No reference frames became generated output. Approved skill images informed local labels/persistent objects, but this is a texture/UV fidelity proof, not a complete explanatory lesson or claim of3Blue1Brown style identity. Root's independent reviewer must supply the separate external review gate. Full temporal reference similarity is unverified.

The unlit model deliberately isolates texture fidelity from stylized renderer lighting; source PBR metallic response is absent and not represented as reproduced.

## Measured data

`fidelity-measurements.json` records actual production compiler/registry values for one model instance and one planar image sharing the same image asset:

| Item | Bytes |
|---|---:|
| Source scene | 865 |
| Descriptor catalog | 835 |
| Compiled scene JSON | 4,655 |
| Sample frame JSON | 2,393 |
| Native manifests + unique referenced blobs | 4,624,146 |
| Conservative decoded registry memory | 9,232,384 |
| Native RGBA image | 4,194,304 |
| Pinned bytes after offline disposal | 0 |

Source geometry:11,808 paired POSITION/NORMAL/UV tuples,3,936 triangles. Image dimensions:1,024×1,024. Source PNG SHA-256: `1c009f45e53b260ceecd383f2c356ed08b08e05acd4633bcc713213319b2092b`.

**Independent decoder check:** FFmpeg7.1 decoded the original PNG directly to RGBA. Its bytes exactly match both pngjs decoded samples and the native image blob; all three SHA-256 digests are `b1aaf9bd7af54d30527bdad3b1f2d7bbe02ae34ccb160141f707f08587924e24`. This proves preparation retained source RGB/alpha; H.264 is a lossy display artifact and is not used for pixel equality. The package fixture test separately compares every source vertex/normal/UV tuple to the decoded native arrays and compares rebuilt registry descriptors with the saved catalog.

Video SHA-256: `08a11fcd069096d998f69f4a009c681b77fe88da0385f212d02f256345c72f5d`.

Actual retained mesh/texture upload reuse and draw metrics are supplied by the image worker; the payload figures above are not GPU timing claims.

## Boundaries and remaining scope

General imported glTF PBR, compressed meshes/textures, skinning, animation, morphing, multiple UV channels, texture transforms, material factors needing baking, alpha cutouts, mipmap samplers and JPEG are unsupported and rejected. Shader lighting selection remains an explicit `s.model` author option rather than per-part glTF state. The filesystem boundary is checked offline; it does not claim raceproof handling of concurrently hostile filesystem mutations. Proof artifacts under ignored `data/` remain local; tracked source, fixture, report and tests reproduce the result.

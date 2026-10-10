# Image texture implementation and verification

Implemented on `amilibsam`, without a push or merge. Root serializes commits.
The asset registry, descriptor catalog, existing compiler/sequence/player,
retained geometry, both backends and native exporters now share image appearance.

## Delivered behavior

- Host-owned RGBA8/sRGB/top-left/straight-alpha images, SHA-256 identity and
  immutable pixel snapshots. `colorPolicy:'source'` is a host registry/export
  option. Scene code cannot grant it. Image source RGB is not palette-quantized.
- Model UV0 and image dependencies, source-preserving UV seams, image-aware
  retained meshes and batching, and `s.image` with validated aspect ratio.
- Actual WGSL/GLSL texture sampling. Untinted images use white multiplication;
  explicit palette tint, opaque/blend alpha, nearest/linear and clamp/repeat work.
  Transparent triangles retain global depth order.
- Per-renderer bounded GPU image/sampler resources, upload sharing, active-frame
  sweeping, disposal and WebGL restoration from immutable CPU data. Renderer
  preparation checks images against actual device texture dimensions.
- Transactional image leases, candidate failure cleanup, native image package
  decoding and native export via the existing `modelAssets` manifest list plus
  host `colorPolicy:'source'`. Image pixels never cross the scene VM/frame boundary.
- Package header/size/hash checks; decoded model budgets checked before binary
  reads; aggregate image/model memory preflight before any package binary reads.
  Sparse model coordinate/index/normal and UV values are rejected. These last
  model checks repair two independently reported preimage defects.

The renderer's established working space is encoded sRGB. Images use RGBA8 unorm
sampling with no hidden sRGB decode/re-encode, matching the existing palette
working space. Exact unlit source pixels are preserved. Stylized lighting and
alpha composition remain encoded-space operations, not linear-light PBR.
Source vertex colors, palette-indexed images, mipmaps, PBR channels, image clipping,
outlines and procedural/scalar image combinations are outside this slice.
Unsupported sampler/material combinations reject explicitly.

## Proof and measured results

`data/animlib-expansion/image-proof/film.mp4` is an original six-second, 144-frame,
1280×720 native WebGPU export of the CC0 Suzanne/base-color pairing. The source
texture also appears on a planar card. Both 1280×720 and 960×720 sheets were
inspected. The unlit UV mapping places the source's eyes correctly through the
turn. This demonstrates base-color reuse, not the source renderer's PBR appearance.

`fidelity-measurements.json` records exact agreement between the original PNG's
independent FFmpeg 7.1 decode, pngjs decode, and native prepared RGBA bytes:
`b1aaf9bd7af54d30527bdad3b1f2d7bbe02ae34ccb160141f707f08587924e24`.
It records the explicit omitted tangent, back-face culling and metallic/roughness
PBR channels. See `asset-converter-report.md` for preparation scope and provenance.

The native measurement script `shared/animlib/tools/prove-image-rendering.mjs`
measures eight actual textured instances (94,464 logical vertices):

| Metric | First frame | Subsequent frames |
| --- | ---: | ---: |
| Image uploads | 1 | 0 |
| Image upload bytes | 4,194,304 | 0 |
| Buffer upload bytes | 321,584 | 720 |
| Draws / instances | 1 / 8 | 1 / 8 |

The eight-instance source is 286 bytes, catalog 835 bytes, compiled scene 10,005
bytes, and frame 6,679 bytes. Decoded registry memory is 9,232,384 bytes; pins and
leases return to zero after disposal. Recorded CPU-plus-queue wall times are
26.95 ms cold, 1.70/0.95 ms warm; these are observations, not GPU timestamp timing
or a broad performance benchmark. Packed vertices grew from 31 to 34 floats.

## Verification status

Failure-first checks reproduced missing image support/white native pixels,
unsupported header reads, sparse coordinates, late decoded-memory rejection,
image pipeline disposal races, and late device dimension rejection before fixes.

Final focused command passed **80 tests in seven files**: image assets, image
packages, asset preflight, asset rendering, renderer fallback, renderer lifetime
and planar lighting. `vitest.images.config.ts` passed the native WebGPU test over
nine pixel scenarios and verified two uploads for two independent source images.
Real browser `demo/image-test.html` passed **12/12** checks, including context loss
and restoration. See `webgl-results.json` under the proof directory.

Native and WebGL checks cover exact non-palette source RGB, top-left orientation,
straight alpha, opaque alpha, explicit tint, linear interpolation, repeat/clamp,
independent images, sorted transparent layering and opacity. Unblended RGB probes
are exact; blended probes allow one byte of backend UNORM rounding difference.
Fresh typecheck and production build passed after the final runtime edits.

Integrated suite history is not hidden: the first run found two 31-float stride
regressions, repaired in planar shadow packing and an asset test expectation.
The later sandbox run passed 821 tests and failed only the converter filesystem
test because Windows realpath was denied by the sandbox. Elevated full-suite run
passed 821 tests and failed eight while another worker was actively adding
molecular functionality: seven `nucleic-structures.test.ts` cases had intentionally
unimplemented stubs, and one `science-proofs.test.ts` case hit the existing 200 ms
compile deadline under contention. The science file passed both tests when rerun
alone. Root will run a fresh integrated suite after molecular ownership settles.
Existing unrelated baseline GPU material one-byte equality failures remain tracked
by root; this image slice does not relax those assertions.

## Released ownership

Runtime/source edits: `asset-{types,validation,catalog,builders,registry,geometry,
package}.ts`, `image-validation.ts`, `image-resources.ts`, `scene-assets.ts`,
`types.ts`, `compiler.ts`, `runtime.ts`, `player.ts`, `core.ts`, `render-validation.ts`,
`render-geometry.ts`, `composition.ts`, `retained-geometry.ts`, `texture-shader.ts`,
`renderer.ts`, `webgl.ts`, `planar-shadows.ts`.

Tool edits: `load-assets.mjs`, narrow host colorPolicy plumbing in
`render-frames.mjs`/`render-video.mjs` (preserving science palette plumbing), and
new `prove-image-rendering.mjs`. New image tests/config/demo plus narrow existing
asset-render/renderer-fallback/renderer-lifecycle tests are also released.
Converter/fixture/proof scene files remain the separate asset preparer's work.
Independent technical and visual review is the next acceptance gate.

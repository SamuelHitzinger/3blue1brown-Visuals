# Static prepared model registry report

Date: 2026-10-11. Branch `amilibsam`; no push or merge. Shared files were handed
off by path-engine before integration. Image work is a subsequent slice.

## Delivered

- Host-owned, bounded, immutable registry with SHA-256 identity and descriptor-only
  QuickJS input. Public input is cloned and nested arrays are frozen. Scene Frames,
  tracks, worker messages and handoffs retain model references rather than arrays.
- `s.model(id,{asset,...style})` emits ordinary groups and stable part IDs;
  `s.modelInfo(asset)` returns bounds/count descriptors. Transforms, opacity,
  inherited parts, keep/remove and views use existing scene behavior. Asset
  deformation, topology morphs and source inline-array mixtures fail explicitly.
- Live host revalidation prevents stale/missing references and forged descriptor
  counts. Per-part 20,000 vertex/triangle and scene 100,000 point budgets remain;
  repeated instances count toward scene work even when storage is shared.
- Transactional candidate leases in `SceneSequence`; scoped offline leases;
  independent players share a registry without disposal invalidating each other.
- One explicit resolver serves CPU fallback, retained preparation, render
  validation, clipping, shadows, transparent sorting, bounds, picking and label
  occlusion. Both render backends consume the same prepared draw geometry.
- Native package reader with exact-length bounded reads, SHA-256 checks, path
  containment including resolved symlinks, count/index/normal/coordinate checks,
  units/provenance and aggregate limits. Image/unknown fields fail rather than
  being interpreted as a lossy model format.
- Production frame/video tools accept `modelAssets` package-manifest paths.
  Audio API remains unchanged. Image descriptors reserve RGBA8/sRGB source color
  storage; image rendering is not implemented by this slice.

## Real prepared fixture and fidelity

Tracked fixture: `shared/animlib/fixtures/suzanne/`. Official source attribution:
[Khronos Suzanne README](https://github.com/KhronosGroup/glTF-Sample-Assets/blob/main/Models/Suzanne/README.md),
CC0-1.0, UX3D / Norbert Nopper (2017). Downloaded source JSON, source binary and
license attribution are retained. The one-time preparation script pins their
SHA-256 values and is reproducible with no runtime source parser dependency.

This is an **explicit geometry-only derivative**: every one of 11,808 position
and normal tuples and 3,936 triangles survives; indices widen from uint16 to
uint32. Source UV/tangents and base-color/metallic-roughness texture/material are
explicitly omitted and recorded. Scene-authored yellow fill and stylized lighting
replace appearance. This is real external model reuse, not original texture/PBR
fidelity, molecular fidelity, or artist-reference matching.

## Measurements

`shared/animlib/tools/prove-assets.mjs` produces
`data/animlib-expansion/assets-proof/measurements.json`. Local one-run CPU timings;
20 warm retained samples and five streamed samples. Not GPU frame rates.

| Measurement | Result |
|---|---:|
| Repeated instances / logical vertices | 8 / 94,464 |
| Native geometry blobs | 330,624 bytes |
| Authored source / one model inline source | 315 / 1,476,799 bytes |
| Descriptor catalog | 469 bytes |
| Compiled scene / sampled Frame | 8,454 / 4,856 bytes |
| Conservative boxed-array accounting | 3,526,656 bytes |
| Package preparation / compilation | 63.37 / 36.19 ms |
| Cold retained preparation | 22.78 ms |
| Warm retained median / p95 | 0.45 / 0.87 ms |
| Streamed CPU median / p95 | 5.25 / 6.98 ms |
| Shared retained meshes / draw commands | 1 / 1 |

The inline source is rejected by the unchanged 256,000-character source limit.
Instrumented **production GPURetained code with device stubs** uploads 249,488
vertex bytes plus 47,232 index bytes once, followed by 640 instance bytes per
sample. This proves resource reuse in that code path, not driver allocations,
native GPU timing or context-loss recovery for this new fixture. Lease count and
pinned-byte accounting return to zero after export; caller-owned decoded registry
storage remains available by design.

## Visual and test evidence

Actual production native WebGPU outputs:

- `data/animlib-expansion/assets-proof/frames/`: six native PNGs at t=0,1,2,
  at 1280x720 and 960x720, plus full-frame sheets and JSON manifest.
- `data/animlib-expansion/assets-proof/proof.mp4`: 24 frames, two seconds,
  960x540, 12 fps, silent H.264; subtitle sidecars retained.
- `data/animlib-expansion/assets-proof/video-all24.png`: all encoded frames,
  decoded in order using FFmpeg for inspection.

Both complete frame sheets and all 24 decoded video frames were viewed. Eight
separate models remain inside the frame and rotate progressively from frontal
toward side views. Source positions/normals/topology yield recognizable Suzanne
geometry. This is decoded-frame motion inspection, not real-time playback.

Initial registry and compilation gates failed with missing implementation; later
27 focused asset tests passed. Full portable suite: **759/759, 50 files**, before
the final overlap regression. That regression first failed because text-only
inspection unnecessarily resolved skipped mesh geometry; the corrected selection
order and resolver option passed **35/35 asset-render + overlap tests**. A further
focused host-count regression checks forged catalog budgets without leaking a
lease. Typecheck and library build passed. Final targeted count is recorded in
the handoff message after the last regression run.

Windows sandbox default TEMP remapping caused Vitest ENOENT in multi-file runs;
the full run passed with process-local TEMP/TMP in
`data/animlib-expansion/tmp-assets`. Node realpath and native GPU access required
approved unsandboxed runs. These were environment workarounds, not relaxed tests.
Existing unrelated GPU-suite baseline failures remain outside this report; no
new all-GPU-suite or WebGL2 pixel-parity claim is made.

## Remaining gates

Independent code/spec review is pending. Original image/source-color fidelity,
UVs, vertex colors and actual WebGPU/WebGL2 image parity remain image-worker work.
General glTF/OBJ conversion is not delivered by the pinned fixture script.
Context-loss asset-specific measurements and dense textured/translucent scientific
models remain unverified. Immutable caller-owned registries intentionally defer
incremental replacement and eviction policy.

Author verdicts: static-reuse reasoning ready; technical probe readability ready;
original appearance/reference style unverified; static production export ready
for independent review.

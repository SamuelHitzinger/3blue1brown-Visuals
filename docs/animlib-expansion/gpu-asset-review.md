# Independent image review and GPU diagnosis

Reviewed current `amilibsam` worktree on 2026-10-11. No branch changes, commits,
pushes or merges performed by this reviewer. Molecular integration remained
owned by its separate worker; this was a focused review, not a full-suite gate.

## Verdict

The two previous prepared-asset blockers are repaired. Dense tuple validation
and decoded package-memory preflight are ready within the reviewed scope. Image
schema, transactional leases, dependency resolution, sampler binding, source
color handling and upload/disposal paths have no further confirmed blocker in
the inspected paths after the cache-pressure repair described below.

**GPU parity is not ready.** Both exact pixel-equality failures still reproduce.
The investigation isolates repeat differences to multisampled rendering before
resolve, but does not establish a safe production root-cause repair. No renderer
quality setting, exact assertion, tolerance, or test skip was changed to hide it.
CPU frame equality is not GPU parity evidence.

## Asset boundary verification

- Vec3 coordinates, triangle indices, normals and UV tuples now iterate dense
  `Array.from` values. Holes become `undefined` and reject. Outer sparse entries
  also reject through the `for...of` validation path.
- `decodeModelPackage` accounts boxed decoded vertices, triangles, normals and
  UVs during the complete manifest pass, before hashing/reading binary payloads.
  The seven-part, 20,000-vertex/20,000-triangle sentinel regression passes with
  zero reader calls.
- `loadAssetRegistry` reads bounded manifests and totals decoded image/model
  memory before entering its binary decode loop. Added a filesystem regression
  with three 4096-square image packages and three individually valid model
  packages (six 20,000-vertex/20,000-triangle parts each). Every binary path is
  deliberately absent. It rejects the aggregate decoded-memory limit instead
  of reaching a missing binary. This avoids allocating the declared payloads.
- Image snapshots remain copied before asynchronous hashing; GPU handles remain
  renderer-owned; leases hold immutable CPU data; failed candidates release
  their leases; model image dependencies acquire/release with the model.
- GPU and GL samplers map nearest/linear and clamp/repeat explicitly. Texture
  identity participates in draw grouping. Opaque versus blend alpha handling
  is shader-driven; source RGB remains in the documented encoded working space.

## Confirmed image cache defect and repair

`GPUImages` and `GLImages` previously kept old-frame images until `endFrame`,
but tested a new upload against the budget before sweeping them. A renderer
switching from a full prior asset working set to a smaller new asset working
set could fail despite the current frame fitting. This is particularly relevant
when a renderer is prepared with a replacement host asset resolver.

Added resource-boundary tests for both backends. They first fill the 256 MiB
cache with four declared 64 MiB images, begin a new frame and bind a new image.
Both tests failed with `Image GPU memory limit exceeded` before the repair.
Under pressure the cache now sweeps resources not used by any current-frame
command before applying the same limit. The tests verify old resources are
released, four current images survive, a fifth current image still rejects,
and disposal releases all textures. The GPU objects are doubles to avoid a
320 MiB allocation; this test proves resource lifecycle and accounting, not
actual driver allocation capacity. Native image pixels were rerun separately.

## Recovery and budget harness repairs

- The two async-backend-error tests forced unavailable Vulkan even though the
  normal native adapter works. They now use native adapter selection, explicitly
  request a 256 MiB buffer limit, and keep genuine native validation fault
  injection (`maxBufferSize + 4`). Both error orderings remain covered: backend
  failure before/after scene budget rejection; smaller scene pixels render red;
  the backend error remains blocked and prevents playback.
- Shadow allocation assertions contained old 31-float byte counts after the
  new image layout grew to 34 floats. A focused run failed at that assertion.
  Counts now derive from the independently counted fixture vertices and shared
  packed stride. Tests still assert the fitting payload, growth clamping, the
  oversized payload exceeding actual device limits, zero invalid uploads, last
  frame preservation, and later recovery.
- The native GPU config description no longer incorrectly promises Vulkan.

## GPU parity evidence

Fresh focused execution still fails:

1. `reactive/rebuilt pixels: independent material and texture parameters`,
   control 0.1 at time 0.
2. `keeps identical text, rectangles, paths and round arrows pixel-identical
   throughout a morph`, arrow3D opacity 0.45 at time 1.5 in the latest run.

Ignored diagnostic `data/animlib-expansion/gpu-review-repeat.mjs` extends root's
original native probe without changing production code. Each run reuses the
exact same Frame object for 26 draws, covering six sphere appearance variants
and both retained/forced-streamed routes. Results are stored beside the probe
as `gpu-review-repeat-*.jsonl`.

| Diagnostic change | Observation |
| --- | --- |
| Production 4x MSAA | Repeated draws differ; latest baseline up to 47 channel values, maximum delta 3 for streamed material+bump. |
| Single-sample diagnostic override | All twelve appearance/geometry-route cases were exactly stable for 26 draws. This is an isolation experiment, not an accepted rendering change. |
| Fine derivatives | Differences remain; up to 40 changed channels in material+bump, and a plain streamed run had a maximum delta 6. |
| Centroid or per-sample interpolation | Differences remain and the number of changed channels grows. No interpolation qualifier change is accepted. |
| Depth32float | Differences remain; replacing depth24plus does not repair them. |
| Disabled depth writes/test | Differences remain, so depth precision/tie ordering alone does not explain the effect. |
| Backface culling | Most sphere differences vanish but streamed material+bump still differs by one channel. Culling changes two-sided semantics and is not a repair. |
| Direct readback of each MSAA sample | A compute shader uses `textureLoad` on all four samples, then packs RGBA8 into a mapped buffer. Samples themselves differ after a new draw; duplicate reads without a draw are exact. Thus final resolve/readback is not the sole cause. |

All these experiments reported no uncaptured GPU validation errors. Sample
readback captures show changes at particular surface sample locations, sometimes
one sample changing while the others remain equal. Detailed examples and
coordinates are retained in `gpu-review-repeat-samples-detail.jsonl`.

The next useful investigation is a minimal native multisample raster/fragment
reproduction with fixed vertex buffers and no animlib submission path, ideally
checked against a second native adapter/backend. Current evidence does not
distinguish all hardware/driver behavior from raster/fragment pipeline behavior
and does not authorize weakening exact tests. WGSL explicitly defines default
interpolation as perspective/center and distinguishes centroid/sample execution:
[WGSL interpolation specification](https://www.w3.org/TR/WGSL/#interpolation).
That specification was used to design the diagnostic overrides; it is not proof
that these observed differences are permitted or inevitable.

## Fresh checks

Commands ran with TEMP/TMP scoped to
`data/animlib-expansion/gpu-review-tmp`.

- Typecheck: passed after adding the Node asset loader's declaration file.
- Production build: passed.
- Eight focused image/asset/resource/lifecycle files: **49/49 passed**.
- Native image configuration: **1/1 passed**, running all existing image probe
  scenarios and the two-source upload-sharing check.
- Focused native budget/recovery checks: **4/4 passed**, 144 unrelated skipped
  by name filtering.
- Focused exact native parity checks: **0/2 passed**, 146 unrelated skipped by
  name filtering. Failures listed above remain unresolved.
- The filesystem preflight test initially encountered sandbox `realpath` EPERM;
  the same test passed under approved escalation. No filesystem security check
  was removed or mocked to make it pass.
- This reviewer has not independently repeated the real browser image harness.
  Root was asked to rerun it after the resource-sweep repair. No new whole-suite
  or browser visual signoff claim is made.

## Edited files and ownership release

- `shared/animlib/src/image-resources.ts`
- `shared/animlib/test/image-resources.test.ts` (new)
- `shared/animlib/test/asset-host-preflight.test.ts` (new)
- `shared/animlib/tools/load-assets.d.mts` (new)
- `shared/animlib/test/gpu-recovery.gpu.ts`
- `shared/animlib/test/gpu.smoke.ts`
- `shared/animlib/vitest.gpu.config.ts`
- This report; ignored diagnostic probe/output files described above.

Ownership is released after reporting these checks to root. The exact parity
blockers and browser rerun remain explicit integration tasks.

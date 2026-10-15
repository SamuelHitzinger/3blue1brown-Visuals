# Render performance checkpoint — 2026-10-16

The measured bottleneck in a 96-label scene was one retained draw per glyph. Combining opaque glyph geometry per label reduced native WebGPU render-call median **5.835 → 1.944 ms**, p95 **6.442 → 2.243 ms**, and draw calls **566 → 96**. All eight affected label PNGs and both native readback hashes are exact before/after matches. This is a frame-loop optimization, not proof of a ten-second model-to-visual response.

## Evidence and reproduction

All evidence is local and ignored by Git:

- Before: `data/realtime-workshop/render-profile/2026-10-15T23-44-31.286Z-a1dc49ea`
- After: `data/realtime-workshop/render-profile/2026-10-15T23-46-18.685Z-a4c406d2`
- Paired comparison: the after directory's `comparison.json`.
- Each case has source/input, result, subprocess timing, a CPU profile and the production export worker's output. `started.json` hashes the probe and relevant source/dist files. The model has its own SHA-256 receipt.

```powershell
.\node_modules\.bin\tsc.cmd -p shared/animlib/tsconfig.build.json
.\node_modules\.bin\bun.cmd backend/bench/realtime-render-profile.ts --samples=20 --profile --export
node backend/bench/realtime-render-profile/compare.mjs BEFORE_DIRECTORY AFTER_DIRECTORY
```

The CLI creates a new directory and exclusively creates result files. `--case=simple,labels,surface,glb`, `--samples=3..200`, `--model=PATH`, and `--out=NEW_DIRECTORY` are supported. The comparison expects all four cases and export outputs. No model calls, media uploads, browser automation or network downloads occur.

## Workloads and measurement boundaries

Node 24.15.0 runs the production built library and native `webgpu` renderer at 1280×720. The export worker additionally renders 960×720. Three initial frames precede twenty measured samples; simulation times are deterministic. Separate Node subprocesses provide process-cold caches. They are not guaranteed disk-cold or driver-cold starts.

All four scene sources are **hand-authored profiling fixtures**, not generated model outputs. They vary dimensionality, visual density and update cost: simple 3D motion, dense 2D labels, changing 3D mathematical geometry and a detailed organic molecular asset. They do not evaluate subject understanding, model authoring speed, explanatory quality, scientific adequacy or the ability to choose an appropriate representation. A simple 2D line-graph authoring case belongs in the separate model screening matrix; no result here substitutes for that check.

- **Simple:** one retained box with a sandbox time-driven rotation. A separate Bun run exercises the actual `LiveWorld` transaction and sampling wrapper.
- **Labels:** 96 distinct plain-text mathematical labels containing omega and superscript two.
- **Surface:** a 40×40 parametric mesh, 1,681 vertices and 3,200 triangles, continuously deformed through the real QuickJS callback.
- **GLB:** the existing published 4YLN transcription-initiation complex, 90,004 triangles, 12 parts, 3,803,752 bytes. File `backend/data/models/b395b900e5008e039b988a865814311a9d55cc5ff1bf0675b01621265236e450.glb`; SHA-256 equals its filename. The recorded sidecar metadata supplies the compiler inventory; `ModelStore` decodes the actual file and retains its hierarchy/materials. This tests rigid model rotation, not animation-clip playback.

The probe separates module loading, compilation, model preparation, adapter/device acquisition, renderer preparation, sample evaluation, CPU render-call time, queue writes/submissions, completion wait and readback. Queue-call durations are CPU wall time. Completion waits are wall-clock fences, **not isolated GPU execution timestamps**; no display presentation time is measured. The GPU supports timestamp queries, but this probe does not enable or use them. Instrumentation adds overhead, especially to scenes with many calls.

Sampling includes sandbox callback execution, reactive-update validation/merging and timeline evaluation. The separate geometry/composition pass uses its own retained cache after renderer measurements; its medians must not be added to render-call time. Export subprocess wall time includes startup, compilation, model decode, two renderer/device setups, six readbacks, PNG compression and two contact sheets.

## Measured stages

Before-change values; milliseconds unless indicated:

| Workload | Cold compile | Warm compile median | Sample median | CPU geometry median | Composition median | Render-call median | Completion-wait median |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Simple | 44.08 | 13.80 | 0.116 | 0.026 | 0.002 | 0.271 | 0.052 |
| Labels | 50.98 | 18.48 | 0.227 | 0.788 | 0.066 | 5.835 | 0.040 |
| Surface | 87.57 | 48.59 | 7.319 | 1.908 | 0.004 | 2.860 | 0.063 |
| GLB | 45.03 | 15.31 | 0.192 | 0.109 | 0.018 | 0.505 | 0.099 |

| Workload | Module loading | Adapter | Device | Renderer preparation | Model preparation | First render call | Warm readback | Complete export subprocess |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Simple | 315.42 | 370.38 | 30.91 | 304.14 | 0.06 | 8.81 | 1.65 | 1,583.48 |
| Labels | 300.62 | 299.06 | 33.19 | 364.91 | 0.08 | 210.93 | 1.91 | 2,075.87 |
| Surface | 301.44 | 298.52 | 28.78 | 309.09 | 0.08 | 25.48 | 1.71 | 1,755.02 |
| GLB | 304.15 | 311.38 | 27.13 | 283.96 | 116.12 | 444.60 | 1.65 | 2,579.10 |

Renderer preparation includes vector text preparation and GPU shader/pipeline initialization. The GLB's first completion wait was another 47.53 ms. Its warm path uploads only 1,056 bytes/frame for camera and instance state; it does not upload the model again. The deforming surface streams 1,382,576 bytes/frame and spends more time in callback/validation/evaluation than rendering. The separate persistent-world run committed the simple program in 39.41 ms and then sampled it in roughly 0.10–0.21 ms after the first sample, with rotation continuity asserted.

## Bounded change and correctness

`shared/animlib/src/render-geometry.ts` now uses the existing retained-mesh combination option for `text` and `latex`, as already done for arrows. It combines only opaque, retainable glyph geometry belonging to the same label. Label identity, transform, style and layer remain live. Transparent labels, morphing labels, camera-dependent labels and precision-sensitive fallback geometry continue through their existing paths. The earlier Greek-glyph fix remains intact.

The hot-path explanation is supported by native counters and the CPU profile: 566 glyph commands caused 567 buffer writes per frame. After batching, 96 commands require 97 writes. Total camera/instance uploads drop **45,376 → 7,776 bytes/frame**. The first label render drops **210.93 → 192.86 ms**. Small changes in unrelated workload timings are measurement variation, not attributed to this patch.

Two focused text/LaTeX regressions failed before implementation. They now prove one retained mesh per opaque label, exact expanded vertex arrays, reuse through transform changes, and unchanged transparent/morph output. The focused retention, Unicode, LaTeX, typography and overlap suite passed **113 tests**. Build, strict probe typecheck and diff checks passed. The parent independently ran its broader focused checks.

The affected native label hashes at time 0 and 0.3666667, and all six export frames plus two contact sheets, match exactly. This exact claim is scoped to the label workload. Simple outputs also match. Unchanged surface/GLB geometry digests match; some unrelated first exported frames differ in a handful of channels by 1/255, and GLB native readback hashes differ. These are recorded differences, not an asserted exact match or an established cause.

**Evidence correction:** an investigation command accidentally re-ran the production export worker using the optimized run's existing surface output directory. Those surface PNGs were overwritten. They are excluded from the original paired comparison; `evidence-correction.json` records the incident and the original observed mismatch. Original before-run evidence, label/simple/GLB exports, measured results, source hashes and native raw readback hashes were untouched. No further repeat testing was used to conceal the difference.

## Lifecycle review and next priorities

The review followed these implementation paths rather than relying on a standalone synthetic renderer:

- `compiler.ts` / `compiler-client.ts`: fresh bounded QuickJS context, trusted library bootstrap, plain-data serialization, full scene validation, retained callback sessions, worker deadlines and disposal. Each reactive update crosses JSON boundaries and validates before host merging. Library bootstrap is outside the authored-code deadline. No runtime pooling or weakened validation was introduced.
- `timeline.ts` / `bindings.ts`: pure evaluation clones element state, orders lifecycle/track events and resolves attachment/connector dependencies against final poses. A mutable-frame identity cache would violate existing direct-frame editing semantics. The measured deforming surface warrants targeted sampling/validation profiling before changing this path.
- `scene-assets.ts` / `asset-geometry.ts`: prepared immutable geometry is available only through held leases; candidates release leases at transaction boundaries. The render path rechecks live lease access even when retained geometry is cached.
- `model-store.ts` / `model-render-geometry.ts`: immutable hash identities deduplicate loads, verify bytes/metadata, retain decoded primitives and cache expansions weakly. Resident budgets are one million vertices and 32 megapixels; disposal aborts pending work. The warm 90k-triangle result confirms that retention is already effective. Cold packing/indexing and decoder work deserve separate profiling if first-model latency is a product bottleneck.
- `retained-geometry.ts` / `model-packing-cache.ts`: content keys detect in-place edits; active working sets are swept each frame. Changing geometry streams until stable. Precision/clip gates, transparency, shadows and label occlusion can force world-space packing. The transparent-model packing cache is bounded to 128 MiB; generic mesh expansion uses a 16 MiB LRU.
- `renderer.ts` / `gpu-retained.ts` / `model-textures.ts`: native buffer-size preflight precedes allocation; mesh/index buffers are reused, instance uniforms remain live, unused meshes are released, and GPU resources are recreated after device loss. Renderer initialization creates four pipelines. Model material/texture caches last for the renderer lifetime. This patch leaves budgets, recovery and resource ownership unchanged.

A long-lived renderer avoids repeated adapter/device/pipeline startup and PNG export work. That is more consequential for first-ready latency than shaving fractions of a millisecond from the already-fast simple scene. It must be integrated with existing lifecycle/cancellation checks rather than conflating offline export time with a visible live update.

For scale: eliminating the measured simple sample-plus-render work entirely would save about **0.39 ms** per frame, under **0.04%** of even a 1.2-second model response. The observed label optimization saves about **3.89 ms/frame**, under **0.33%** of that same model time. These bounds exclude separate cold preparation and compilation; they explain why renderer speed alone cannot solve model-to-ready latency. The improvement is useful for continuous animation and larger label scenes, while model authoring, cold initialization and semantic correctness remain separate bottlenecks.

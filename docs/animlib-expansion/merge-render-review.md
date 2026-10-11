# Rendering merge review

Reviewed 2026-10-11 against the working merge of animlib `ea6e07a` and main `b35e4a8`. This is a bounded source review, not approval of the pending integration gates. No production source or Git state was changed by this review.

## Findings

No actionable merge-specific rendering defect found in the reviewed changes.

## Preserved contracts

- `texture-shader.ts`, `render-geometry.ts`, `renderer.ts`, and `webgl.ts` agree on 36 floats per vertex: location 14 is UV0/UV1 at floats 31–34, and location 15 is prepared-image alpha policy at float 35. Imported vertex alpha remains in float 23. Prepared image tint/straight-alpha handling and imported linear-space tint/material alpha policy retain their respective parent implementations.
- WebGPU has separate image and model shader modules/pipelines, each with its own group-2 layout. Opaque, transparent, and compositor depth-only image draws select the image pipeline and matching camera/image/instance bind groups. Non-image draws bind the model layout, including a neutral material for ordinary geometry.
- `composition.ts` carries both resource fields and requires matching image binding keys, model material identity, and opacity mode before merging streamed or retained commands. `retained-geometry.ts` stores both resource fields; transparent geometry still bypasses retention. The content key keeps animated stroke fields and main's immutable model key. Parent transforms, group opacity, view offsets, and instance state remain live.
- Prepared geometry continues resolving through the held lease, including a live lease check on retained hits. GLB resolution creates replacement frame/element/geometry objects. No merge change copies decoded host assets into author scene state or mutates source geometry.
- WebGL restores model flags, textures, and samplers before every geometry draw; an image draw then installs its own texture/sampler on unit 3. The following model draw restores all five model units. The compositor clears sampler overrides on units 0/1, and the focus pass clears the sampler on unit 0 before sampling its render target.
- Focus camera uniforms and sample passes survive the merge for both resource families. Group depth passes carry the same resource metadata. Planar shadows use the final stride and retain main's MASK exclusion. World-space shadow/occlusion paths continue disabling retention when required.
- GPU release disposes both image and model uploads plus retained, compositor, and focus resources. WebGL restoration passes the original model image map into the replacement backend; prepared images remain available through the renderer's lease resolver. Camera bind-group caches are cleared on GPU release and pruned when view uniforms are removed.

## Evidence and limits

Compared each reviewed production file with both parents and inspected adjacent `image-resources.ts`, `model-textures.ts`, `model-shader.ts`, `model-store.ts`, `asset-geometry.ts`, and `gl-compositor.ts` for binding, ownership, and state transitions. Also inspected `mixed-asset-geometry.test.ts`, `mixed-assets.gpu.ts`, the developing `mixed-assets.browser.ts`, and existing model/image/focus/retained/recovery tests.

The mixed CPU test explicitly checks UV1 and image alpha lanes in both retained and streamed draws. The mixed native GPU test checks prepared image + prepared mesh + transformed UV1 GLB colors, focus, isolated opacity/depth passes, sharp replay, retained/streamed equivalence, and texture disposal. Existing model GPU cases cover OPAQUE/MASK/BLEND, vertex alpha, object fades, PBR maps, and isolated groups. Existing focus coverage includes source-image alpha, view/HUD separation, occlusion, budget rejection, and resource disposal.

The parent reported passing focused model (15), mixed (1), image (1), focus (1), and fallback (25) cases. Those results were not independently rerun here, to avoid competing with the parent's full GPU gate and short scene-VM timeouts. Full GPU gate completion and actual execution of the mixed WebGL context-loss/restoration harness remain integration requirements; reading a test is not an execution pass. This review does not claim new pixel evidence for every combination of PBR maps, shadows, alpha, and focus.

## Follow-up: executed gates and baseline pixel failure

The parent subsequently completed the full native GPU gate: **164/165 passed**. The sole failure is the exact-buffer comparison in `reactive/rebuilt pixels: independent material and texture parameters`, at control value `0.1`, time `0`. The parent also reported all six mixed WebGL harness checks passing, including image colors, transformed GLB UV1, focus, isolated composition, retained/streamed replay, context restoration, and lease disposal.

Independently reproduced the exact same GPU assertion on **both untouched parent snapshots**, created with `git archive` into the ignored `data/animlib-expansion/merge-validation/render-diagnostic/` directory:

| Snapshot | Focused result | Assertion location |
| --- | --- | --- |
| Animlib parent `ea6e07a` | Same failure, `0.1 @ 0` | `test/gpu.smoke.ts:380` |
| Main parent `b35e4a8` | Same failure, `0.1 @ 0` | `test/gpu.smoke.ts:389` |
| Merged working tree | Same failure, `0.1 @ 0` | `test/gpu.smoke.ts:392` |

Command in each package directory: `vitest run --config vitest.gpu.config.ts test/gpu.smoke.ts --maxWorkers=1 -t 'reactive/rebuilt pixels: independent material'`. The untouched parent run logs are `ea6e07a-baseline.log` and `b35e4a8-baseline.log` in the diagnostic directory. A dedicated writable temporary directory avoided sandbox temporary-cache errors from an earlier merged invocation.

After those unchanged baseline runs, diagnostic instrumentation was added only to the disposable main/merged test copies. It retained the original failing assertion and measured the readbacks. **Main and merged produced the same initial mismatch: five RGB channel bytes across three pixels, each differing by exactly one 8-bit level**:

- `(356,186)`: red 63 → 64.
- `(305,208)`: green 169 → 170.
- `(305,209)`: RGB `(75,167,189)` → `(76,168,190)`.

The rebuilt and reactive frames serialize identically, including their material, checker texture, transform, and camera values. On main, bypassing `RetainedGeometry.get` and repeatedly rendering the **same frame object** also produced occasional single-byte, one-level differences between consecutive readbacks. This rules out a reactive value mismatch and demonstrates that the phenomenon is not confined to retained-cache reuse. It is consistent with existing backend numerical/rasterization variability; these checks do not identify the exact driver operation responsible. The failing fixture uses `checker`, so main's new `noise` branch is not the direct trigger.

Diagnostic logs: `merged-diagnostic.log` and `b35e4a8-diagnostic.log` beside the baseline logs. No production implementation, checked-in test assertion, or tolerance was changed. The full GPU suite remains **164 passed / 1 known pre-existing failure**, not an all-green gate. The merge preserves the observed parent behavior for this failure; fixing native exact-pixel repeatability would be separate work.

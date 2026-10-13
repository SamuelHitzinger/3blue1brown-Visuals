# Playback validation

Validated 2026-10-13 using unchanged production-generated complex-v3 scene 2 and its exact 4YLN model. No generated source or molecular asset was edited to obtain the improvement.

## Changes

- Reuse immutable imported mesh expansion, rather than serializing and expanding large coordinate/UV/color arrays every frame.
- Merge adjacent draws only when complete shader material state matches; names stay in model metadata. Texture image identity and sampling settings remain distinct. Transparent triangles keep their global depth order.
- Reuse exact world-packed transparent vertices across camera-only frames. All live transforms, opacity, palette-derived colors/emission, layer, and viewport values remain cache inputs. Recompute triangle depths on orbit. Cache holds at most one sample per active model/view slot, capped at 128 MiB, and releases absent slots/disposed renderers.
- Overlay labels no longer disable unrelated opaque mesh retention. Hide/fade visibility and planar shadows still require world triangles.

## Comparison

CPU measurements use production CanvasRenderer and decoded assets with GPU/DOM stubs. Each case warms three samples, then records twelve. They measure CPU preparation, not GPU completion or browser FPS. Profiling affects timings; one machine/run does not establish a universal speedup.

| Case | Before median / p95 | After median / p95 |
| --- | --- | --- |
| RNA observation hold | 344.54 / 361.56 ms | 54.98 / 74.10 ms |
| Explanation reveal | 338.71 / 349.54 ms | 52.16 / 78.00 ms |

Uploads fell from approximately 84.5 MB to 39.4 MB per frame. Draw submissions fell from approximately 46,224 to 76-77; material batching and opaque retention change these totals together. Shapes, element colors, atom positions, and source resolution remain unchanged.

Browser WebGPU measurement compares the intermediate expansion/material/overlay fixes against final packing fixes, on the same local 15-23 second window with the same viewport. Median render call: 74.1 to 48.5 ms; p95: 91.7 to 61.6 ms. Rendered samples: 102 to 147 over approximately 8.2 seconds. Final test ran with test runners idle. This establishes improvement, not 60 FPS playback. Live scene-1-to-scene-2 handoff and Pause completed without the earlier automation timeout.

Native captures cover nine scene times at 1280x720 and 960x720. Twelve samples have matching prior captures: first frames identical; remaining rasterization differences affect fewer than 0.13% of pixels with at most 5/255 channel difference, consistent with retained GPU transforms. See playback-pixel-comparison.json. Label-specific before/after captures separately prove restored endpoint 46 with molecular pixels unchanged.

## Verification and reproduction

- Canonical Node/Vitest full runtime suite: 1,126 tests passed, 102 files.
- Native WebGPU model and recovery suites: 17 tests passed.
- Independent reviewer: 88 focused tests passed; no findings.
- TypeScript build passed. Material identity-only expectation was replaced by equal-state batching plus genuinely differing roughness separation. Palette-emission cache regression failed first, then passed after adding resolved emission to the key.
- Regression tests cover clipping, public bounds, camera depth changes, transform/style/palette changes, prior-array preservation, groups, slot eviction, memory cap, and authored mutable geometry.

Run `node docs/validation/molecular-representation-choice/playback-benchmark.mjs <output-name>` from repository root after building animlib. Requires local production render-input.json and its assets under data/molecular-representation-choice/proof/final-complex-focus/0. The retained JSON result files document this run; raw CPU profiles and native batches stay in local data. Browser metrics came from the temporary gallery's Measure playback control, which wraps the real renderer without modifying scene sources.

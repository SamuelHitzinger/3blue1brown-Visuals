# Spatial holdout preflight review

The holdout harness was corrected before any live holdout run. Its source, fixture and subtitle package remain frozen and hashed before live generation.

The original rotation test measured scaled basis displacement, so a valid 90-degree turn at display scale 0.01 failed its 0.05 threshold. The revised pure `checkHoldoutMotion` uses normalized axes and an angular threshold of 10 degrees. Translation must cover at least 5% of the displayed separation between the two pinned landmarks. Both thresholds are stated in the author fixture and saved as `acceptanceThresholds`, so camera framing and arbitrary display units do not change acceptance.

The checker requires the protein and both markers to descend from `assembly` at every sampled time. The protein's pose relative to that assembly must remain invariant, preventing a moving dummy pivot or compensating protein motion from passing. Existing exact model geometry, relative primitive geometry, landmark attachment, cue-boundary, static camera, pause and carry checks remain in place.

Ribbon acceptance now checks finite geometry, valid triangle indices and nonzero triangle area. It has no arbitrary vertex/triangle count minimum. The production native visual gate still judges the requested visible sector shape and its presentation.

Pure compiler tests cover turns and translations at display scales 0.01, 1 and 3; exact and below-threshold boundaries; detached protein/markers and a dummy pivot with the whole subject detached; counter-rotation; scale changes; coarse valid ribbon geometry; collinear/nonfinite/invalid-index meshes; and fixture cue/threshold consistency. The original scale rejection was independently reproduced before the correction; the new test file first failed on missing pure acceptance exports.

Verification, with `TEMP` and `TMP` set to workspace `backend/.tmp`:

- `bun test ./backend/test/animation-holdout.test.ts`: **7 passed, 26 assertions**.
- `tsc --noEmit --strict --target ES2022 --module ESNext --moduleResolution Bundler --lib ES2022,DOM --types bun --skipLibCheck backend/bench/animation-holdout.ts backend/test/animation-holdout.test.ts`: **passed**.

No model generation, native rendering, production prompt/runtime edits, dist build, or broad test run was performed for this correction. These are harness-validity checks, not visual-quality or live holdout success evidence.

## Trial1 asset-backed annotation correction

The first live trial's native gate approved scene 0 after one repair, but the harness then rejected its model count. This was a harness defect: the saved frame contains all 46 unique pinned protein primitives (indices 0–45), plus one different published model for the custom annotation. Neither `protein` nor `assembly` carries model metadata on its group root. Counting every model primitive as protein therefore produced 47. The annotation is removed at the end, which also invalidated the former all-assets identity check. A subsequent literal inline-mesh-only ribbon check would have rejected the same valid annotation.

The approved source constructs `turn-indicator/ribbon` through a custom `s.compose` callback returning `view.model(scopedId, ...)`. The actual registered annotation GLB has 25 vertices and 21 nondegenerate triangles. Publishing those bytes is consistent with the production requirement that geometry bytes belong in assets. The correction permits that representation without changing the frozen fixture or its shape/motion thresholds.

The shared `checkHoldoutFrames` now selects only the pinned asset and requires exact unique primitive coverage at every sample, with every selected primitive descending from `protein`. Extra or missing pinned primitives, duplicated indices, substitutions and detached instances fail. Per-primitive immutable geometry and internal-pose checks remain. Unrelated annotation assets can appear or disappear independently.

Ribbon validation resolves registered GLB primitives from hash-checked bytes, compares parsed metadata with the registry, and applies the existing finite/index/nonzero-area checks to actual geometry. The sampled ribbon must descend from the actual `turn-indicator` group, and all nongroup descendants of that scoped ribbon must be valid meshes; an empty group, missing asset, missing primitive, bad hash, metadata mismatch, or degenerate geometry fails. Source inspection uses the existing TypeScript parser to recognize an inline or locally declared compose callback, without prescribing its return-expression syntax. The real compiler validates the returned scoped handle, while the checker validates the actual sampled hierarchy and geometry. Static callback presence does not prove arbitrary JavaScript execution provenance; this remains a narrow structural contract. The production native review continues to assess the visible sector shape.

Regression tests were written and run red before the missing support was added. The pure suite now includes a real two-primitive protein and separately published ribbon, annotation removal, malformed or missing immutable bytes, invalid/degenerate referenced geometry, callback versus descriptor/comment cases, a callback returning a local handle, runtime rejection of an incorrect scoped ID, an unused callback plus a direct mesh without the required group, and continuation input drift. The common checker also runs against that compiled fixture, preventing reassessment from using a different acceptance path from live runs.

Verification after the correction, using workspace `TEMP`/`TMP`:

- `bun test ./backend/test/animation-holdout.test.ts`: **14 passed, 58 assertions**.
- Strict direct `tsc` with the prior flags and the three explicit paths `backend/bench/animation-holdout.ts`, `backend/bench/animation-holdout-assess.ts`, `backend/test/animation-holdout.test.ts`: **passed**.
- `bun run backend/bench/animation-holdout-assess.ts trial1 trial1-scene0-corrected-v2`: **passed**, without generation or native rendering.

The final write-once separate assessment is `data/animation-efficiency/holdout-assessments/trial1-scene0-corrected-v2.json`; its compact durable evidence is [holdout-trial1-scene0-assessment-v2.json](animation-authoring-benchmark/holdout-trial1-scene0-assessment-v2.json). The earlier v1 assessment and its [durable evidence](animation-authoring-benchmark/holdout-trial1-scene0-assessment.json) remain unchanged; v2 records the two independent-review corrections above. Each binds the historical result, unchanged approved source (`517da89c8b9fd7e00713a6a6a8b625dfa4d920dd17f8e2d041213ac1e113367e`), registry, frozen fixture/package, review receipt, sampled frames, boundary frame and its checker hashes. All originally frozen production dependencies must still match. Recompilation reproduced every saved sample in reverse and repeated seeks, and reproduced the exact saved final frame. The assessment re-read its inputs and historical result before returning to detect concurrent drift. Trial1 and its failed result remain untouched.

Scene 0 passes the common corrected checks: 46 pinned primitives, 34.3774677-degree turn, maximum marker error `5.44e-16`, and maximum internal-pose error `5.62e-15`. This is a scene-0 assessment only; `fullHoldoutComplete` is explicitly false. It provides no new visual, continuous-playback or acoustic evidence and does not alter historical timings.

An honest continuation would use a fresh, explicitly labeled continuation directory. Before any model call, verify the assessment's exact source/registry/fixture/boundary hashes and frozen production dependencies, copy the existing approved scene artifacts, lesson/subtitle package and immutable model files, and start the existing generator at scene index 1 with the exact assessed boundary frame. Run the same native and deterministic carry checks for scene 1. Keep scene-0 historical timing and new scene-1 timing separate; never present the sum as a fresh end-to-end trial. The current change includes the input-drift verifier, but intentionally does not implement a resume framework. A small explicit continuation entry point would need roughly 60–100 lines plus tests for copied input identity, starting index and carry-boundary handling; a fresh trial2 remains simpler if independent full-run evidence is preferred.

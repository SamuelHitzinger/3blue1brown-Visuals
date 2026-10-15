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

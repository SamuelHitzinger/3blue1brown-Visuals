# Orbit label viewport validation

Validated 2026-10-13 against unchanged generated `protein-v2` scene 0 at 20 seconds.

The reproduction uses the actual scene camera with effective yaw `0.65 - 110 * pi / 460.8` and pitch `0.1 - 40 * pi / 460.8`: a 110-pixel right / 40-pixel down drag in the 1280x720 gallery view. Native WebGPU captures cover 1280x720 and 960x720 (4:3).

- `label-viewport-before/*-0.png`: same native renderer with viewport fitting disabled in an isolated compiled copy. Endpoint 46 falls entirely below the view scissor although the molecular endpoint remains visible.
- `label-viewport-after/*-0.png`: current shared renderer. Both glyphs are visible inside the view with a four-pixel inset. Molecular geometry and endpoint 1 remain pixel-identical.

The correction translates the entire label footprint only when its true transformed attachment is inside its own view. Authored positions, billboard offsets, relative glyph geometry, and near/far and hide/fade decisions remain intact. Fixed screen text, ordinary depth-tested text, offscreen attachments and labels too large to fit retain their previous behavior. Screen bounds now read the same per-vertex screen flag used by the renderer.

Regression evidence: seven new edge/orbit/pan tests failed before fitting and passed afterward. A further public-bounds test failed before the screen-flag correction and passed afterward. The focused label, explanatory and bounds suites pass all 65 tests under Node; TypeScript typecheck passes. Full combined-suite validation belongs to the integrating change.

Reproduction helpers are `.tmp/native-label-{before,after}.mjs` and `.tmp/label-{before,after}-input.json`; they override only the sampled frame camera, never generated source. Native evidence manifests accompany each capture directory.

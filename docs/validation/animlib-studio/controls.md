# Interactive controls — 2026-10-20

The installed viewer exposes native reactive parameters as labeled sliders and
enables the existing renderer's orbit/pan controls. Wheel zoom, keyboard
navigation, and Reset view are viewer-local. Parameters persist through
checkpoints and remain synchronized with MCP edits.

Validation:

- 14 session tests pass, including 550 successive parameter edits, atomic
  rejection, compacted replay, and 33 different controls split into batches
  within the native 32-parameter update limit.
- Four transport regressions pass.
- Production build and strict viewer TypeScript check pass.
- `node plugins/animlib-studio/tests/controls.mjs` exercises three sliders,
  native range keyboard input, external updates, drag orbit, wheel zoom,
  Shift-drag pan, reset, reload persistence, subsequent editing, and a 420px
  viewport without horizontal page overflow.
- Reset wave-geometry captures differed from the initial paused image by
  approximately 0.00011 per RGBA channel on the 0–255 scale. The test allows
  less than 0.001 mean channel error; camera movements produce errors above 1.
- The installed in-app viewer was inspected with all three sliders and all
  labels visible, including after the user rotated and changed parameters.
  Its status bar reported a 27 ms local edit. This is one observation, not
  a percentile or model-inclusive authoring benchmark.

## Capture limitation

Headless WebGPU captures intermittently omit text even across unchanged paused
frames. CPU draw lists, label transforms, and GPU submission include the
labels; clearing retention, bypassing text retention, and awaiting GPU
completion did not resolve it. No speculative shared-renderer change was made.
The automated camera pixel oracle therefore uses the example's full wave
geometry with text omitted. Text readability was checked separately in the
installed visible viewer. This does not prove all headless text captures stable.

Revisions are renderer-local: compacted checkpoint replay may yield a lower
revision than the previous renderer. Clients must inspect after reconnecting.
Camera exploration resets on reload; parameter values are retained.

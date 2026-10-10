# Original science motion proofs — author handoff

Branch `amilibsam`. Native production renderer, original scene geometry, no source
video pixels used as assets. Separate independent review remains required.

## Artifacts and reproduction

- Sources, palettes, manifests, style contract and runner:
  `shared/animlib/demo/expansion/{artem-state,logistic-residual}*` and
  `science-style-contract.md`, `science-proofs.mjs`.
- `data/animlib-expansion/science-proofs/artem-state.mp4`:7.5s,225frames.
- `data/animlib-expansion/science-proofs/logistic-residual.mp4`:7s,210frames.
- Both H.264/yuv420p,1280x720,30fps, no audio or subtitle stream.
- Full native frame directories contain both1280x720 and960x720 at
  0,.8,1.6,2.6,3.8,4.4,5.2,6.3,7, then3.8 again (backward seek).
- `*-motion/`: decoded MP4 contact sheets at6fps, 3x3 ordered left-to-right,
  top-to-bottom; `sample-times.json` gives sample cadence. Black tail cells on
  the last logistic sheet are tile padding, not movie frames.

From repository root, after the ordinary animlib build:

```
node shared/animlib/demo/expansion/science-proofs.mjs
npm run test --workspace animlib -- --run test/science-proofs.test.ts --reporter=dot
```

Runner uses the supplied local FFmpeg binary; `FFMPEG` overrides its path.
`--frames-only` omits encoding. The runner checks actual decoded native PNG
background bytes, exact repeated-frame PNG equality for both sizes, encoded
stream metadata, and the decoded video background. It invokes existing production
tools, not another renderer. Production frame/video tools now accept optional
`input.palette` / `manifest.palette` and pass it through the existing compiler;
the renderer receives the compiled palette normally. Model assets are preserved.

## Source evidence actually inspected this authoring round

Read the prior `neuroscience-quantum-reference.md`, but independently reopened
actual YouTube source playback via CUA. Browser full-video rectangle was
2195x1235 at0,0 after fullscreen and focusing `#movie_player`. Only complete
video compositions were used to judge layout. Playback muted. Browser images
are scaled view captures, not decoded native source frames.

Artem, QHj9uVmwA_0: complete readyState4 frames at232.218s (event rows),
242.218s and242.626s (smooth rates),244.529s,245.529s,249.529s (compression and
new function glyphs),259.529s (completed vector). Playback ran232.218–259.529,
with intervening screenshot observations, then the interior was revisited by
frame-stepping. A rapid stepping batch also produced246.529–248.529 requests
while readyState1: these images visibly corroborate coherent movement but their
exact decoded timestamps are not verified and are not counted as precise frames.
This is sampled temporal evidence, not every-frame or uninterrupted-view coverage.

Visually Explained,3bvM3NyMiE0: readyState4 complete frames at200.426s (stable
model and samples),204.869s (setup),206.869s (selected pair emphasized),208.869s
(dashed residual and difference),210.869s (squared error),215.426s (held result).
The204.869–210.869 sequence used60 normal paused frame steps between observations;
each actual screenshot was delayed to the next tool observation and checked at
readyState4. Playback200.426–224.869 also ran, but the endpoint224.869 is already
the following illustration and does not support the regression comparison.
Only the user-confirmed Visually Explained channel is used; no QuantumSense claim.

## Author corrections and numerical evidence

Artem uses five deterministic synthetic spike rows,9/8/9/9/10events, seconds.
Each event contributes a Gaussian with sigma=.13s and integral1 over the real
line. Displayed individual kernels stop at4sigma (or the visible domain edge);
the summed trace evaluates the full Gaussian formula. Trace units are s^-1,
vertical scale .075 world-units per s^-1 for all rows. Kernels are exposed before
the true summed stroke is geometrically revealed. Events and kernels then fade;
the same traces compress left, shared t=2 cursor appears, and color-matched vector
entries show[7.07005,.22408,7.25111,3.07271,6.46734] approximately. The exact
source-computed entries are authoritative; tests independently recover rates from
the scene's actual event positions and compare trace samples, markers and numbers.
The final state is a point in five-dimensional rate coordinates; no manifold
recovery or biological measurement is claimed. No new domain module was needed
for these two bounded, distinct formulas.

An initial native render exposed a collision between the kernel formula and
state heading at960x720. The formula now moves left with the traces, while the
synthetic-event label leaves after its role is clear. Corrected native endpoint
and both-aspect sheets were inspected. Final fully readable hold5.85–7.5s.

Regression uses p=sigma(wx-2), w=.6→1.4 over2.7–4.9s, and fixed selected x=2,
y=1. Curve samples, yellow prediction and white dashed residual use that same
weight at every scene time. Endpoint p=.6899744811; squared error=.09611582235.
The feature guide geometrically ends at the prediction. Other observations stay
fixed and dim. Numeric error/prediction are shown only after parameter settling;
the symbolic local error remains visible throughout the change. Final hold5.4–7s.

The first `mathtt` raster was upright but visibly slab-serif. Per the brief,
word labels were corrected to supported `mathsf`, inspected in actual native
pixels. They are sans-serif **but proportional**, so the reference's monospaced
word spacing remains an explicit typography difference for the evaluator.
Math expressions and number slots use existing native TeX glyphs.

Two correctness tests pass: normalized-kernel mass, independently reconstructed
rates, same selected data point throughout layout, row/color continuity, stable
sample order, fixed observations, numeric weight-versus-curve agreement at
interior times, exact residual endpoints, sigmoid range, exact final squared
error, and nonmonotonic seeks. The native runner additionally verifies palette
and pixel-identical repeated seeks at both aspect ratios.

The fresh workspace typecheck at this handoff failed only in concurrently authored
`test/gltf-import.test.ts` (missing .mjs declaration) and `test/image.gpu.ts`
(self-referential inferred sequence/prepare types). Those owners and root were
notified; no science test/source type error was reported. No whole-suite or
whole-workspace typecheck pass is claimed by this author.

## Author visual review and limits

Actually inspected all ten6fps MP4 contact sheets: Artem0–7.333s,45ordered
samples; regression0–6.833s,42ordered samples. Native sheets and full960 endpoint
frames were also viewed. Curves reveal progressively, trace compression preserves
row order, selected points remain at the common time, and the regression residual
shortens continuously while observations stay fixed. No every-frame playback
claim. Source and original proof use different datasets and timings by design.

Author QA is not an independent style approval. Reasoning, readability, reference
style and technical delivery verdicts remain with the separate evaluator. Current
known difference: regression word spacing is proportional sans rather than the
source's sans monospace. A library-wide arbitrary font API is not added here.

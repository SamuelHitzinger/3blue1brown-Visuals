# Path engine and domain integration report

Date: 2026-10-11. Branch confirmed `amilibsam`. No checkout, worktree, commit,
push, or shader/backend change performed by this worker.

## Implemented

- Fixed-cardinality retained `points` on point-authored path/line/arrow geometry.
  Coordinates are finite and bounded; SVG, mesh/circle, connected-endpoint,
  timeline-morph ownership, and count changes reject explicitly. Canonical
  lifecycle geometry is unchanged by retained snapshots and reverse seeks.
- `strokeStart` / `strokeEnd` normalized local arc length, plus immutable
  `dashArray` and signed local-distance `dashOffset`. Range and phase work with
  ordinary animate actions and retained callbacks. See `path-engine-design.md`.
  Start >= end paints no stroke. Original closed fill stays intact. SVG/smooth
  flattened paths and disconnected contours use cumulative length without jumps.
  Dash phase does not reset at sampled segments or reveal boundaries. Closed
  painted seams retain their joins. Generated fragments are bounded before
  tiny-dash iteration/allocation, with an additional output-point budget.
- Arrowheads follow the last painted tip. Both flat strokes and round native
  tubes pass through the existing shared CPU geometry preparation. Retained
  cache keys include all stroke controls. Bounds/overlap use those same painted
  triangles; existing picking supports no paths, and planar shadows remain
  sphere/mesh-only. No new path hit-shape or path-shadow support is claimed.
- `s.attach(...,{anchor:'midpoint'})` uses resolved line/arrow endpoints through
  source world transformation and target-parent inverse, plus world offset.
  Origin attachment remains the default. Nested transformed graph edge/label
  regression passes at multiple absolute times.
- Shared self-contained factory installation for host and QuickJS:
  `s.plane`, `s.graph`, `s.collection`, `s.dijkstra`, `s.molecularBackbone`,
  `s.molecularBackboneGeometry`, `s.articulatedChainPose`. Pure molecular helpers
  and Dijkstra remain callable inside retained callbacks; mutating scene APIs
  retain the existing build-only guard. Public domain types and core factory
  exports are present. No `s.paths` facade was needed or introduced, following
  the math author's explicit clarification.

## Owned edits and handoff

New files: `src/path-stroke.ts`, `test/path-animation.test.ts`,
`test/domain-integration.test.ts`, `test/path-render-cases.ts`, this report and
the pinned design. Added focused worker-serialization regression to
`test/compiler-client.test.ts` and one cross-backend case to
`test/integration-cases.ts`.

Engine edits: `types.ts`, `runtime.ts`, `compiler.ts`, `core.ts`, `reactive.ts`,
`timeline.ts`, `bindings.ts`, and `render-geometry.ts`. Shared file ownership was
explicitly released to assets_builder after path integration was green; later
asset changes are separate work interleaved in those files. Domain modules belong
to their original workers and were not edited here.

Original 5–8 second Artem and Visually Explained proof authoring is handed to
root's dedicated science worker. Root acknowledged that handoff. This report's
two-second geometry fixture is a technical test, not either requested science
proof and not evidence of artist/reference parity.

## Regression-first evidence

Initial path suite: 13 intended failures and 4 invalid-input checks passing.
Failures established missing clipping/dashes, unsupported reactive points,
unrecognized scalar animation properties, absent validation, and wrong transformed
midpoint. A separate closed-seam regression was observed failing before its fix.
Existing math worker integration regressions also went from missing APIs/midpoint
failure to passing. Final path suite contains 20 tests.

Final focused commands (workspace-local TEMP/TMP set per progress ledger):

```
npm run typecheck --workspace animlib
npm run build --workspace animlib
npm run test --workspace animlib -- --run test/path-animation.test.ts test/domain-integration.test.ts test/compiler-client.test.ts test/diagrams-production.test.ts test/diagrams-graphs.test.ts --reporter=dot
npm run test:gpu --workspace animlib -- -t "arc-length paths" --reporter=dot
```

Results: typecheck PASS, build PASS, five focused files / 39 tests PASS, native
WebGPU new path case PASS (147 unrelated cases skipped). Tests cover unequal
segments, coincident points, exact corners, SVG disconnected paths, smooth SVG,
closed fill/seams, arrows, invalid values, count/ownership guards, ordinary
controls, SourceCompiler, SceneSequence, worker request serialization, offline
sampling, bounds, cache invalidation, pure molecular retained helper calls,
host-versus-QuickJS data, and reverse seeks.

An earlier complete portable run yielded 745 pass / 1 failure: the concurrent
assets worker's then-unimplemented `decodeModelPackage`. No full-suite pass is
claimed from that run. Root requested focused checks while concurrent asset work
continued. The pre-existing native GPU baseline remains recorded in progress.md;
this worker did not reinterpret or hide its four failures.

## Native visual artifacts

Fixture: `shared/animlib/test/path-render-cases.ts` (`pathRenderSource`).
Input: `data/animlib-expansion/path-frames-input.json`.
Command:

```
node shared/animlib/tools/render-frames.mjs data/animlib-expansion/path-frames-input.json
```

Native production-renderer PNGs: `data/animlib-expansion/path-frames/`, at
1280×720 and 960×720, times 0, .5, 1, 1.5, 2, .5. Contact sheets named
`1280x720-sheet-0.png` and `960x720-sheet-0.png`. The 1280-wide sheet was inspected
after final rendering: changing dash phase and point shape, progressively advancing
arrow tip, unchanged closed fill, and repeated .5 sample are visible. Pixel
assertions compare retained and streamed output and reverse seeking on each GPU.
These six samples do not constitute a dense motion or reference-fidelity review.

## Real browser WebGL2 check

Opened `http://127.0.0.1:5176/webgl-test.html` through CUA, clicked **Run browser
tests**, and read the final DOM results. Result: **143 pass / 3 fail**. The new
`cross-feature: arc-length paths, continuous dashes, retained points and reverse
seeks` case passed, including retained/streamed pixel comparisons. Browser source
worker execution was used. Full result appeared in the browser tool record;
compact saved result is `data/animlib-expansion/path-webgl-result.json`.

Unresolved failures, reported separately to root:

1. `reactive/rebuilt pixels: independent material and texture parameters` —
   pixels differ at value=0.1, time=0.
2. `reactive/rebuilt pixels: sphere radius with animated position` — pixels
   differ at value=0.1, time=0.
3. `reactive/rebuilt pixels: view-local sphere` — pixels differ at value=2.5,
   time=0.

There was no pre-change WebGL baseline in this task, so these are **not proven
pre-existing**. Root assigned a separate GPU diagnosis brief. The new path case
passed; that does not excuse or resolve the broader failures.

The ordinary Vite server was interrupted by concurrent source hot reload. Stable
test server command (outside the sandbox; automatic approval accepted):

```
node data/animlib-expansion/path-test-server.mjs
```

This helper uses the existing Vite config with local-only host, HMR disabled,
watching disabled, requested port 5174; occupied ports selected 5176. Both test
servers and the temporary browser tab were stopped after evidence collection.

## Limits and remaining evaluation

Fresh independent engine review, root's complete integrated regression run, the
three WebGL mismatch investigations, and artist-specific science proof review
remain outstanding. Graph and molecular source data/geometry work is owned and
reported separately. No broad channel/reference equivalence, scientific molecule
fidelity, or end-to-end expansion completion is claimed here.

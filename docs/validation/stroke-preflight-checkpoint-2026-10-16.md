# One-pass label/stroke review evidence

The renderer now supplies optional projected glyph/stroke intersections to the existing visual review. This catches the previous hydrogen-label strikethrough without another model request, frame sample or render pass. It is an advisory, not a quality verdict or automatic repair. Existing hard text/text validation is unchanged.

The detector uses projected glyph and stroke triangles, including glyph holes, clipping, viewports, opacity and mixed morphs. It avoids unrelated mesh tessellation when label occlusion permits. Labels using occlusion policies can still require full-scene geometry. Native rendering and diagnostics receive the same sampled frame with imported models resolved to their real meshes. A fresh code review caught an initial mismatch where metadata bounding boxes hid labels visible through sparse meshes; a real sparse-GLB native regression now covers this and repeat-resolution idempotence.

Direct rendering remains opt-in. The production visual gate enables the report, retains at most 32 records and gives the reviewer at most 12 compact records in a bounded advisory. Invalid diagnostics cannot discard valid pixels; diagnostic failures are recorded. Review instructions require pixel inspection and prohibit rejection or repair from these warnings alone. Evidence-version changes invalidate older cached approvals.

## Local workload checks

Each case samples 2, 4 and 6 seconds at 1280×720 and 960×720. Each has three native process runs: diagnostics off, on, and off again. Arm order alternates. These are single offline observations, not model-authoring, speech-alignment or ten-second end-to-end measurements.

| Workload | Native off / on (ms) | Diagnostic work across six samples (ms) | Observed warnings |
| --- | ---: | ---: | --- |
| 129-point 2D parabola with deliberate crossing | 1550 / 1573 | 53 | Curve/label and leader/label |
| Detailed 3D saddle, 3,200 triangles plus slicing plane | 1768 / 2011 | 342 | Four projected pairs across samples; not all certified defects |
| Full 24-atom caffeine, prior annotation defect | 1873 / 1963 | 202 | Hydrogen/leader in all six samples |
| Same caffeine with repaired leader clearance | 1798 / 2001 | 198 | No crossings in these samples |
| 90,004-triangle imported model with annotation control | 2507 / 2562 | 63 | Deliberate control crossing in all six samples |

The large model's low diagnostic cost does not establish universal scaling: it has a small annotation workload and does not exercise every occlusion policy. The sparse-model regression separately tests real mesh occlusion. CPU probe geometry for the large workload uses model references; native rendering resolves the actual GLB.

All 30 CPU samples preserve frame state, existing draw arrays and rebuilt draw geometry exactly. Native PNGs are not universally byte-identical: the surface off/off control differs by up to 76 pixels and 2 channel levels, versus up to 45 pixels and 2 levels for off/on. Molecule off/on differences reach 5 pixels and 1 level; their off/off controls are identical. Large-model controls and off/on both reach 6 pixels and 1 level. These measurements are consistent with small native rendering variability, but do not prove GPU identity. No pixel threshold was used to grant a quality pass.

The initial exact-PNG-hash probe failed on the surface and remains preserved in `data/realtime-workshop/stroke-preflight-01/`, with independent CPU cache traces and native repeat controls. The revised probe records actual differences rather than claiming equality. Its frozen script, exact sources and raw results are in `data/realtime-workshop/stroke-preflight-02/`. [Sanitized results](stroke-preflight-results-2026-10-16.json) retain source hashes, raw-result hash, timing, warning pairs and every pixel comparison.

## Verification and limits

Fresh root runs passed 45 engine tests and 22 backend tests / 138 assertions, including the real native GLB regression. The production engine TypeScript build and targeted strict TypeScript checking of the backend implementation/tests passed. Independent code review found no remaining blockers after the model-resolution fix. An initial backend invocation accidentally matched archived test copies and used sandbox temporary paths, producing permission failures; it was stopped. The corrected invocation uses explicit `./backend/test/...` paths and repository TEMP/TMP. No broad-suite pass is claimed.

No provider requests occurred. There is no new blind visual-quality verdict, measured review-loop reduction, or proof of ten-second lecture-to-visible response. Prior [quality-recovery sampled verdicts](quality-revision-checkpoint-2026-10-16.md) remain scoped to their original images. In particular, newly reported surface crossings need pixel/depth interpretation before any repair. Cross-subject, detail-stratified acceptance continues under the [complexity protocol](complexity-matrix-protocol.md); passing this diagnostic workload cannot qualify all subjects or all detailed 3D scenes.

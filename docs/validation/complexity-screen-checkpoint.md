# Complexity screen results — 2026-10-16

Eight matched tasks now cover algebra, multivariable calculus, probability, wave physics and organic chemistry. They vary both explanatory complexity and actual visual detail. Eighteen model attempts were recorded: sixteen original attempts plus a separately preserved two-arm correction of a host prompt defect. No generated source was repaired.

**Finding:** this screen does not establish a reliable speed improvement from extra helper guidance. No generated source used `compose` or `schedule`, so it tests guidance uptake rather than helper execution. The existing library can render the required geometry, but generation latency and semantic/readability failures remain separate barriers.

## Results by stratum

Times below are request-to-provider-termination seconds, **not source-to-visible-frame time**. Both arms used `gpt-6.1-sol`, low reasoning, requested priority; every actual response reported default tier. Quality scores are the fresh reviewer's sampled-frame judgments out of five, revealed only after blinded review.

| Task | Baseline model time | Candidate model time | Baseline / candidate sampled score | Result |
| --- | ---: | ---: | --- | --- |
| Simple line graph | 8.49 | 9.14 | 4 / 4.5 | Both sampled-ready; candidate slightly clearer, slower |
| Detailed two-line comparison | 12.47 | 20.01 | 4 / 4 | Both sampled-ready; both miss model-only deadline |
| Coarse 3D saddle, 200 triangles | 8.10 | 10.22 | 3 / 0 | Baseline label occlusion; candidate compile failure |
| Detailed 3D saddle, 3,200 triangles | 10.85 | 9.81 | 3.5 / 3 | Correct moving surface traces; both need readable depth/labels |
| Probability densities | 17.44 | 18.46 | 2.5 / 0 | Baseline parameter label wrong during transition; candidate compile failure |
| Wave superposition | 15.08 | 18.51 | 4.5 / 2.5 | Baseline sampled-ready; candidate hides negative contribution and clips labels |
| Full 3D caffeine, 24 atoms | 12.52 | 12.23 | 4 / 4.5 | Both sampled-ready with complete geometry; both miss model-only deadline |
| Heavy-atom caffeine, corrected prompt | 9.63 | 17.34 | 4 / 1 | Baseline sampled-ready; candidate displaces atoms during emphasis |

The original heavy-atom pair took 14.14/15.41 seconds. The candidate used a hex color because my common API instructions incorrectly said hex colors were accepted. The strict native palette rejected it. This is explicitly a host test-harness defect, not solely a model failure. Original evidence remains in `screen-01`; `screen-02-palette` changes only that common guidance and reruns both arms. Its outputs do not overwrite the original pair or erase its failure. Future prepared matrices use corrected palette instructions.

Original screen: 13/16 sources rendered; three failed compilation. Four original responses terminated within ten seconds; this does not imply four accepted live explanations. The corrected pair rendered both sources, with one model-only time under ten seconds. These single observations are not reliability or p95 estimates.

## Actual geometry and quality evidence

Native WebGPU export sampled 0, 1, 3, 5, 6 and 8 seconds at 1280×720 and 960×720. Every rendered source has exactly eight seconds. Source/data hashes and unmodified compiled inputs accompany the output. The first render report's `initialElements`/`initialTriangles` describe the compiler's pre-lifecycle array and are zero; use the separate `geometry-audit.json` sampled-frame counts instead. The benchmark now labels/counts the actual first frame for future runs.

- Coarse saddle: 10×10 cells, 200 triangles. Detailed saddle: 40×40 cells, 3,200 triangles plus the two-triangle slicing plane. Native sampled callbacks preserve the explicit surface equation; mesh count alone is not a quality test.
- Caffeine low detail: 14 heavy atom identities, 15 bonds depicted with 19 strokes because four are double bonds; eight triangles per atom mesh.
- Caffeine high detail: 24 atom identities including 10 hydrogens, 25 bonds depicted with 29 strokes; 128 triangles per atom mesh. Atom coordinates and bond orders come from the same verified public computed conformer. Rigid group motion preserves topology in the full-detail outputs.
- The fresh critic caught a failure invisible to endpoint counts: one heavy-atom candidate uses scaling on meshes with absolute coordinates, moving highlighted atoms off their bonds during the sequence. This supports checking relational invariants throughout motion rather than only compile success or final counts.

The [blind review](complexity-blind-review.md) inspected all available contact sheets, selected full-size frames, smaller-width endpoint frames and exact anonymized source. It distinguishes reasoning, readability, reference style and technical delivery. **It does not approve full motion or the overall real-time goal.** The role mapping was revealed afterward, without changing scores.

## Reproduce and continue

The local comparison viewer at `http://127.0.0.1:5365/` exposes all eight original cases. Root browser verification confirmed native WebGPU readiness for both full-caffeine arms, shared playback advancing to the eight-second endpoint, and shared seeking back to three seconds. Switching to the failed coarse-surface case removed the previous canvases and showed the exact compiler error with playback disabled; switching back recreated the molecular pair. This verifies player behavior, not an independent full-motion quality approval. The corrected heavy-atom rerun remains separate evidence rather than silently replacing its original failure. A browser screenshot is saved locally at `data/realtime-workshop/complexity-matrix/comparison-preview.jpg`.

Verification: nine focused pair-provenance and molecular-fixture tests passed (45 assertions), and targeted strict TypeScript checking passed for the matrix runner, comparison host/client and pair loader.

`backend/bench/realtime-complexity-matrix.ts` prepares all eight cases with tracked public molecular data. `--stage=author` makes one subscription model request per arm; `--stage=render` compiles exact source and adds only the declared data prelude. Use a new `--out` directory for each screen. The manifest, frozen prompts and provider receipts retain configuration. [Protocol](complexity-matrix-protocol.md), [numeric receipts](complexity-matrix-results-2026-10-16.json), and [molecular provenance](complexity-molecule-fixture.md) separate assumptions and measurement boundaries.

Next architecture work should reduce generated construction through existing local-coordinate factories and host data references, enforce relationship/parameter consistency cheaply, and benchmark inference speed independently. Do not add a new descriptor language merely to shorten syntax: the [research experiment](compact-authoring-next-experiment.md) found that a literal JSON action conversion grew these outputs. A broader screen still needs unfamiliar topics, larger organic molecules, asset selection, corrected incoming evidence and long-running sessions. Live ingestion/ASR/persistent-world/presentation timing remains unmeasured here.

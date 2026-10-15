# Spatial authoring holdout

`backend/bench/animation-holdout.ts` defines a new case, **Turning a protein is not folding it**. It has two linked scenes, independent of the binary-search, derivative, and RNA matched fixtures. Fresh trial2 passed both scenes and all declared checks. The original harness contract and preparation checks are retained below; live results follow at the end.

## Scene and source contract

The first scene rotates one deposited 1CRN residue-bead model with two attached C-alpha markers and an offset measurement bracket. A custom triangulated sector ribbon indicates the authored turn. The second scene begins from the exact retained frame and translates the same assembly without rotation or rescaling. Both preserve internal geometry. The model is a residue-level representation; the bracket is an annotation, not a bond; the motion is illustrative, not folding or molecular dynamics.

The source structure has canonical JSON SHA-256 `a5ccb3b7356bdcac54bc9ad69d38dc6f0c2d0716d18142a99dd60f74c6c8a607`. The harness selects the farthest C-alpha pair deterministically before generation: PRO 19 and GLY 42, corresponding to `residue-18` and `residue-41`. It subtracts the model's shared origin exactly once and verifies that origin against the prepared context. Only the two compact landmarks enter author context; geometry remains host-owned.

The pinned `1crn-beads` publication has GLB SHA-256 `cb6fb2a3879d3e9b82549c270ec866b1241e7f30f62e1b1b4ea45a7c3aad0529`. A changed structure or GLB stops the run; it is not silently accepted as the same fixture.

## Execution

From the repository root, after building current animlib/native renderer dependencies:

```powershell
node_modules/.bin/bun.cmd --env-file=backend/.env.local backend/bench/animation-holdout.ts trial1
```

This command invokes the configured model and real native visual review. It must be scheduled outside other timed model/render benchmarks. It uses the signed-in agent configuration, two visual reviews maximum, a 15-minute deadline per scene, no external web tools, and no speech provider. Source/settings fingerprints are saved before generation. Model files and prepared caches are isolated under the trial directory.

Each `data/animation-efficiency/holdout/TRIAL` directory is write-once. Existing, failed, or interrupted trials cannot be overwritten. Failures retain their source, prompts, model registrations, result status, review artifacts and available sampled frames. Use a new trial name for an intentional rerun.

## Timing scope

The production subtitle path builds a fixed package with `timingBasis: subtitle-reading`. Scene durations are **16.534 seconds** and **18.134 seconds**. Five planned phrases resolve to exact word spans: `mark-sites`, `turn-whole-structure`, `same-distance`, `slide-whole-structure`, and `shape-unchanged`. Each scene ends with an explicit two-second pause.

These are deterministic reading estimates. They test semantic cue resolution, scheduled motion, pause holds and duration; they do **not** test alignment to spoken audio. No silent audio is mislabeled as measured speech.

## Evidence collected

- Four concurrent resolver calls publish one real model into the actual generation job. A fresh preparer reuses exact persisted bytes without conversion. A separate registry receives its own publication of the same identity. Timings and producer counts are kept separate from model-generation time.
- The approved lesson, subtitle package, landmarks and complete fixture receive hashes. Each model task saves its prompt, prompt bytes, timing/token metrics and resolver-call records. Final results include total and generation elapsed time, input/output/cache tokens, source size and exact-source approval receipts.
- Generated scenes compile with both published model metadata and the previous frame. Actual delivery bytes are hash-checked through `ModelAssets.forRendering`; no mock GLB registry is used.
- Absolute-time samples include cue boundaries and interiors, pause boundaries and interiors, and scene endpoints. Reverse and shuffled seeks must reproduce those frames. The offline sampler evaluates retained time callbacks, avoiding a false pass from frozen bindings.
- Every sampled frame must contain exactly one complete pinned model instance. Primitive identities and geometry remain unchanged; four local probes per primitive detect movement relative to the protein. Markers must remain centered on their actual source landmarks. Rotation preserves its assembly pivot; translation preserves orientation; sampled scale remains constant. Assembly movement outside its named cue and visible changes during explicit pauses fail acceptance.
- The first scene must contain the custom triangulated ribbon. Kept object state and camera must match at the second scene's initial frame. Inspection reports retain advisory bounds/overlap warnings; they do not replace native review.

## Native acceptance

The production visual gate renders both 1280×720 and 960×720 evidence and must approve the exact returned source. Native inspection should demonstrate recognizable spatial rotation, attached colored markers, a readable external bracket, a meaningful custom turn ribbon, and a clean inherited scene boundary. No cropped molecule, floating labels, accidental duplicate protein, hidden conclusion, or implied chemical bond is acceptable. The frame receipts and sampled states are retained for independent inspection.

Sampled native evidence cannot certify every in-between frame or motion feel. Continuous playback and acoustic synchronization remain separate evidence requirements. This one holdout measures correctness/generalization, not a statistically supported generation-speed advantage over a baseline.

## Harness preparation checks

Direct TypeScript checking with backend compiler settings passed. A pure fixture check loaded the pinned structure, validated the planned lesson, built both subtitle scenes, resolved all five positive-duration cue spans, and confirmed the subtitle timing basis. No model generation, model conversion, native rendering or broad test suite was run during these preparation checks.

## Live result and preserved failure

Trial1 generated and visually approved scene0 after one repair, then failed a harness check that counted a published custom ribbon as part of the pinned protein. The original failed result remains unchanged. The [checker correction and separate assessments](animation-holdout-sanity.md) document exact 46-primitive coverage, valid asset-backed ribbon geometry and unchanged-source/seek/boundary reproduction. Independent review found two callback-check edge cases; both were fixed with regressions. Root's final focused run passed 14 tests and 58 assertions. A fresh full run was chosen instead of adding a benchmark-only resume framework.

Trial2 ran at `51a4013` using the same fixture and subtitle-package hashes as trial1. It completed in **257.828 seconds**, with **7,591 output tokens**. Both scene sources received exact-source native approval in 1280×720 and 960×720. Scene0 required one 44.1-second targeted repair for label clearance; scene1 passed its first review after correcting one invalid author submission. Neither scene exceeded two visual reviews.

| Acceptance | Trial2 evidence |
| --- | --- |
| Pinned model integrity | Exactly 46 unique protein primitives throughout both scenes |
| Rigid rotation | 27.501974 degrees inside the declared turn cue; fixed pivot and internal geometry |
| Translation | 25.8426% of displayed landmark separation inside the slide cue; zero rotation |
| Landmark attachment | Maximum marker error `5.44e-16` in both scenes |
| Internal geometry | Maximum relative-pose error `3.98e-15` in both scenes |
| Custom geometry | Valid triangulated ribbon in actual scoped composition; native shape review passed |
| Handoff | Every retained object and camera matched exactly at the scene boundary |
| Timing and seek | Cue/pause checks and reverse/repeated frame sampling passed |
| Advisory inspection | Zero final warnings in both scenes |

Four concurrent resource resolutions produced one conversion and one publication. Cold preparation took 114.35 ms; a fresh preparer reused disk bytes in 0.77 ms without conversion. A separate job registered the same identity once. These timings describe this local run, not a distribution or general complex-asset guarantee.

Root agent inspected progression sheets and final native frames for both scenes. The repaired rotation keeps residue labels outside the molecule, the brace and its explanatory label separate, and the turn ribbon clear of the header. Translation preserves the same visible molecule and attached measurement. This is agent inspection and bounded native review, not human adjudication or continuous playback review.

Durable raw results: [failed trial1](animation-authoring-benchmark/holdout-trial1.json), [complete trial2](animation-authoring-benchmark/holdout-trial2.json). Full local sources, assets, native images, review receipts and samples remain under `data/animation-efficiency/holdout/trial1` and `trial2`. No trial was overwritten. The holdout supplies novel 3D correctness evidence; it has no matched baseline for a generation-speed claim and no spoken audio for an acoustic-synchronization claim.

# Moving transcription cycle: native proof release

Released 2026-10-11 for independent visual review. The four films below are frozen. The earlier biological revision2 release is unchanged. This is an original schematic mechanism and a bounded source-derived demonstration, not a deposited polymerase or a claim of complete Nucleus parity.

## Implementation and provenance

`src/nucleic-transcription-cycle.ts` and its types expose the self-contained pure `createNucleicTranscriptionCycleBuilders().nucleicTranscriptionCycle(props,time)`. Root wired the same factory as public `s.nucleicTranscriptionCycle`, including retained QuickJS callbacks. The proof generator is `shared/animlib/demo/expansion/transcription-cycle-proof.mjs`; `--focus` creates a separate optical-focus comparison. No factory source or large vertex arrays are embedded in authored scenes.

The 24 explicit complementary DNA pairs and eight RNA identities persist. The active register advances from template6 to template13. A compact cosine-squared radial opening and local twist reduction follow that register; paired radius and twist close behind. Integrated axial increments preserve both strand link lengths exactly. RNA arrivals rotate and meet the returned active anchor before their edge appears. Previously formed RNA moves on the prescribed fixed-spacing exit rail in the continuous active frame. The common DNA recentering moves outer sites; it does not claim perfect world anchoring. Completion clamps the schedule and rail.

Anatomy comes from the original CC0 manifests under `shared/animlib/fixtures/biological/nucleotide-anatomy/`: rounded sugar, phosphate and one/two-ring base scaffolds plus four lit organic machinery lobes. Their preparation recipes, blob hashes and schematic fidelity statements remain authoritative. No new asset geometry was needed and no source pixels were used. The machinery is an illustrative shell, not recovered enzyme structure. The 1CRN deposited-structure proof remains separate.

Source evidence is the previously inspected whole Nucleus chronology and continuous115–131s growth passage under `data/animlib-expansion/source-frames/nucleus-chronology/` (earlier captures also exist under `data/animlib-expansion/nucleus-chronology/`). Full90/110/125s frames were revisited for this iteration. Purple DNA, green RNA, colored bases, blue machinery, gray environment and the foreground triplet are source-specific visual choices. The exact original sequence and trajectory are not reproduced.

## Frozen films and inspection

Each is native WebGPU, H.264/yuv420p, silent,8 seconds,240 frames,30fps. Both1280×720 and960×720 are included. Each directory contains inputs, public scene source, manifest, twelve native frames per aspect, ordered whole-film sheets, measurement JSON and invariant results.

| Directory / film | SHA-256 |
| --- | --- |
| `data/animlib-expansion/transcription-cycle-proof/cycle-16x9.mp4` | `4eee2a86c62f6b508b030f694b9d595a5c83371e9ef6ea60898fac92a596d63f` |
| `data/animlib-expansion/transcription-cycle-proof/cycle-4x3.mp4` | `fc034bf234d78703dc3984d89b92949549405deac1b5a8f8e4b0d4cc092c5837` |
| `data/animlib-expansion/transcription-cycle-focus-proof/cycle-16x9.mp4` | `616acb3d04d5d6d349949a548d2e0fdc32b071d720a5452696a8e0daed36254e` |
| `data/animlib-expansion/transcription-cycle-focus-proof/cycle-4x3.mp4` | `ad4f72b7caf26072019eaeb99d0536886ff5c87d0b62cd846f94c62e90a3a141` |

`tools/inspect-transcription-cycle.mjs` fully decoded every film and generated8fps ordered samples. Author inspected all16 sheets/256 samples plus full native close-ups and active-site frames. The initial whole-complex view approaches the moving site, then turns to a side-on foreground C–A–U triplet; its persistent labels and bracket fit both aspects. The distant context remains visible. Early formed RNA and machinery rotate with the changing active frame; this prescribed motion is visible and should be evaluated independently for readability and source resemblance.

The two variants have identical geometry, camera trajectory, lighting and contrast treatment. The focus variant alone sets real thin-lens focus at camera distance32, aperture0→.12 during approach and .3 during the final close-up,32 samples. Final DNA opacity is .45 and machinery .25, so optical softening has visible context to act on. Foreground C–A–U remains opaque; subsequent RNA is .45. This contrast choice is separate from optical focus. Native frames show background DNA softening while focal anatomy remains sharp. No whole-source approval is inferred from these author checks.

## Quantitative checks and cost

`tools/verify-transcription-cycle.mjs` tested actual proof inputs at321 times:56 stable IDs,46 DNA links, seven final RNA links. Maximum DNA and RNA length error are both8.881784197001252e-16. Every opening/docking/translocation/cycle boundary was sampled at±1e-7; largest position/tip/frame difference was1.1664643047806305e-12. Template6 closes to its original paired radius while template13 is active; the complete result remains identical at time1e100. All56 native anatomy positions and rotated tips, across three parts and eight times, match pure factory anchors within1e-10. Native reverse seeks are exact. Labels retain exact RNA IDs0/1/2 and basesC/A/U. The9 direct and host/QuickJS/retained integration tests passed again after proof completion.

Measured baseline/focus source size12503/12595 characters;203 scene elements;121 samples including full-frame JSON serialization took1458/1583ms. Maximum serialized frame203491/203558 bytes. These are full-frame measurements, not an exact VM callback response measurement. Five referenced models decode to10674176 bytes. The final scene has96200 logical mesh vertices and191004 triangles. At32 lens samples, conservative submitted triangle vertices are18336384 and1280×720 sampled pixels29491200, within the existing32M/64M budgets. No VM, reactive, asset or renderer limits were raised.

The two4:3 native encodes took39859ms baseline and39984ms focus while overlapping on the same machine. These end-to-end numbers include sampling, GPU work, readback and H.264 encoding; they are not isolated optical overhead measurements. The renderer worker owns isolated backend benchmarks.

## Deliberate limits

The DNA axis and RNA exit rail are straight. The rail follows the active frame, including rotation; it is not a curved polymer dynamics solution. The conservative whole-schedule feasibility bound may reject otherwise feasible geometry. The terminal bubble remains open; final closure is not shown. The machinery has no recovered catalytic channel or chemical energetics. Gross nucleotide anatomy has no atomic bond-angle fidelity. Processing, pore passage and translation are separate capabilities and proofs. Independent visual verdict remains pending.

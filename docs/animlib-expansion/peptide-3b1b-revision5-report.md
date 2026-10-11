# Peptide revision 5 — frozen schematic candidate

This ten-second proof applies the user's unified 3Blue1Brown art direction to the already reviewed staged peptide motion. Thin semantic-color curves and small residue nodes replace the heavy atomic and surface display. Four coils form side-visible, hold for local alpha labels, then pack into the same compact endpoint. A restrained final orbit moves around the retained chain. Independent acceptance is pending.

## Scope and correspondence

The new generator is `shared/animlib/demo/expansion/peptide-3b1b-revision5.mjs`; the contract is `docs/animlib-expansion/peptide-3b1b-revision5-contract.md`. It uses the unchanged `peptide-staged-pose.mjs`, original 72-residue rig and reviewed rounded staging keyframes. All 72 displayed nodes come from the actual CA anchors. Each of the 71 trace links is a Catmull–Rom segment passing through its two exact anchors; the curve is a schematic backbone representation, not an atomic bond. Blue, teal, orange and violet map permanently to the four ordered sequence regions. N/C endpoint labels have short leaders to their actual anchors.

The camera stays fixed through local formation and the read hold. Alpha labels identify the actual four coil regions and fade as global packing starts. The camera then adjusts scale to maintain framing, and begins its final orbit only after the authored pose settles. The existing realistic revision 4 and its multipart packages remain separate optional capability evidence. No shared helper, renderer, core, or existing asset was edited for this revision; no new prepared assets, images, particles or surface textures are used.

## Frozen media and visual inspection

Outputs are under `data/animlib-expansion/peptide-3b1b-revision5/`.

| Film | SHA-256 |
| --- | --- |
| `peptide-16x9.mp4` | `aa31fd7c65c30a230e57a64d187b89ffb4009f9c6412a9ee968ddfe6fa3c7420` |
| `peptide-4x3.mp4` | `f5c8b5a5a9a0c55a6293a9eb5e31b7bd55a2b9744cf1d947df1caf5aa8b608a1` |

Both films are native WebGPU, 300 frames at 30 fps, ten seconds, H.264/yuv420p, without audio. Complete decode to null passed for both (`decode-16x9.log`, `decode-4x3.log`). `film-hashes.json` records exact hashes. Five ordered sheets per aspect, `peptide-{16x9,4x3}-ordered-01.jpg` through `-05.jpg`, contain 80 encoded samples each at 8 fps. All ten sheets were personally inspected in order, covering 160 complete sampled compositions. This is dense sampled inspection, not uninterrupted real-time playback.

Representative native previews at 1.4/3.1/3.7/4.2/5.4/7.8 seconds in both aspects preceded encoding. Initial straight segments and a teal label collision were corrected; a smooth anchor-preserving trace and clearer label placement were re-rendered and inspected. The final N/C leaders were then inspected in both native aspects at 3.5/7.8/9.5 seconds before complete encoding.

Authoritative final native frames are `frames/{1280x720,960x720}-{index}.png`, indexed 0–13 at `[0, 0.7, 1.4, 2.1, 2.8, 3.5, 4.2, 4.9, 5.6, 6.6, 7.2, 7.8, 8.4, 9.5]` seconds. `frames/frames.json` and `peptide-frames.json` provide the full index. The earlier `preview/` directory is iteration evidence and precedes the final endpoint leaders.

Motion-reference inspection covers all nine Protein Folding chronology sheets, the separate credits-gap sheet, all eight dense folding-playback sheets, and native frames 071/079. The approved 3Blue1Brown components and derivative images were personally inspected during the preceding transcription proof. Source imagery was used only for review; no film pixels or source geometry were imported.

## Verification and reproduction

Independent review found that the camera fit lookahead introduced a small height drift near 4.0–4.2 seconds despite the fixed-scale hold contract. The generator now enforces the common safe height after lookahead, and the verifier explicitly asserts height as well as orientation throughout the hold. Both native hold frames and all ten complete ordered sheets were inspected again after rerendering. The superseded films, sheets and hashes are preserved in `pre-hold-fix/`; the table above identifies the repaired freeze.

`node shared/animlib/tools/verify-peptide-3b1b-revision5.mjs` passed 401 sampled times at 0.025-second spacing. It verifies exact input rig/keyframes, all 72 residue identities and fixed color assignments, all 71 visible native trace links and their anchor endpoints, N/C leader endpoints, fixed formation camera orientation and height, exact reverse seeks, and the original compact atomic endpoint under the existing common rigid transform. Maximum native anchor/link error is 1.73e-13; maximum compact endpoint error is 1.11e-13. `invariant-checks.json` records results.

`npm --prefix shared/animlib test -- peptide-staged-proof.test.ts peptide-motion.test.ts` passed all 10 tests in two files (813 ms). This includes the existing peptide bond, torsion, local-coil separation and endpoint tests. The log is `focused-tests.log`; the dedicated temporary directory is `data/animlib-expansion/tmp-peptide-r5`. No complete repository suite claim is made here.

Frozen revision 4 film hashes remain `67e93602d8eda967d3290d5e341ee7fe543adf01e27bd19c22d6ed669c125fb7` and `9c5d4c245ad4b32c65501ada12d32c88dc087a65f3b525382d7258d4f12fa083` for 16:9 and 4:3 respectively. Run the verifier with `--check-archives` to audit these historical exports explicitly. Default verification checks the regenerated current proof and versioned rig/staging/endpoint fixtures without requiring old films; the report states when the archive check was not requested. Both modes passed after introducing this portability option; frozen scene and film bytes were unchanged.

`measurements.json` records 151 elements, 170,220 source characters (including the embedded staged keyframes), approximately 112 ms compilation, 1,072 ms for 121 samples including serialization, and a maximum serialized frame of 77,842 bytes. These are local CPU measurements, not a GPU performance guarantee.

Reproduce by running the generator, `render-frames.mjs` with `peptide-frames.json`, and `render-video.mjs` with `peptide-manifest.json` at 1280×720 and 960×720, 30 fps. `inspect-peptide-3b1b-revision5.mjs` fully decodes, extracts all ordered sheets, and freezes film hashes. Inputs and generated source are `peptide-inputs.json` and `peptide.js`.

This is an original illustrative peptide with prescribed torsions. It does not claim a physical folding simulation, atomic rendering, measured folding chronology, or collision-free molecular dynamics. [Independent review](peptide-3b1b-revision5-independent-review.md) accepted the repaired freeze with all four gates ready after inspecting all refreshed ordered sheets and native frames, independently decoding both films, and verifying the exact fixed-height hold.


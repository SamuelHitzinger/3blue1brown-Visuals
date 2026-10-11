# Transcription revision 3 — frozen schematic review candidate

Revision 3 applies the user's corrected direction: 3Blue1Brown artistic language throughout the library, with biological reference films supplying motion and explanatory flow. The complete eight-second scene uses a near-black field, thin native geometry, restrained semantic colors, local serif base letters, and a minimal polymerase outline. It contains no prepared model assets, cellular textures, or decorative particles. The [independent review](transcription-cycle-revision3-independent-review.md) accepted this bounded proof on 2026-10-11, with all four gates passing against the hashes below.

## Motion and object correspondence

The active generator is `shared/animlib/demo/expansion/transcription-cycle-revision3.mjs`. It reads the frozen revision 2 cycle inputs and preserves its eight complementary arrivals, exposed docking, incorporation, register advance, and curved RNA exit. Every base letter is attached to its actual helper anchor. Two short orange contact marks appear at each coincident pair. Nearby contextual DNA letters fade to preserve RNA legibility while the molecular geometry remains. The camera approaches before the first docking, then continuously reframes the same retained RNA sites `rna-0:C`, `rna-1:A`, and `rna-2:U` under a local codon bracket.

This revision did not edit the transcription helper, revision 2 generator, or revision 2 assets. The input schedule is exactly equal to revision 2. Frozen revision 2 film hashes remain `a646a1c0ba8260404360997b3fd6fe864140da0ebf5eb5b401bc7baa421e31f9` (16:9) and `b2d17aafd6b46f994cba86c9d7da56a564d95213d349660f1715b7725572b1ab` (4:3). Other work in the shared checkout may already modify helper files; this is a revision-specific preservation statement, not a claim of a clean checkout.

## Frozen outputs

All active evidence is under `data/animlib-expansion/transcription-cycle-revision3/`.

| Film | SHA-256 |
| --- | --- |
| `cycle-16x9.mp4` | `3517939cce5f81380e91ca89f8d0c23727e740c567386143712af69dbeeccd74` |
| `cycle-4x3.mp4` | `d622e8e4ce4149fdf48779fc84124b28c6fe4e06db2e2b93a4854a85683747b0` |

Both are native WebGPU renders, 240 frames at 30 fps, 8 seconds, H.264/yuv420p, without audio. Full decode to null completed successfully for both; logs are `decode-16x9.log` and `decode-4x3.log`. `film-hashes.json` records the hashes and extraction results.

The full ordered review set is `cycle-16x9-ordered-01.jpg` through `-04.jpg` and `cycle-4x3-ordered-01.jpg` through `-04.jpg`. Each aspect contains 64 encoded samples at 8 fps. All eight sheets were personally inspected in order. This is dense sampled inspection, not an uninterrupted real-time playback claim.

Final native frames are `frames/1280x720-{index}.png` and `frames/960x720-{index}.png`. The time index is: 0→0s, 1→0.8s, 2→1.1s, 3→1.29s, 4→1.55s, 5→2.2s, 6→3.5s, 7→4.8s, 8→5.45s, 9→5.9s, 10→6.5s, 11→7.5s. Native critical views at the first docking, active growth, final docking, and final triplet were inspected at both aspects. `cycle-frames.json` and `frames/frames.json` bind the frame instructions. Earlier `schematic-representative/` frames are iteration evidence; the final `frames/` directory and hashed films control review.

## Verification

`node shared/animlib/tools/verify-transcription-revision3.mjs` passed. `invariant-checks.json` reports 321 times sampled at 0.025-second spacing, all 56 native letters matching helper identities, exact visibility for all eight RNA labels and seven joining links, and exact reverse seeks. All eight complementary docking events have coincident tips and visible contact marks. Maximum DNA/RNA link error is 8.89e-16; maximum native anchor error is 3.56e-15.

`npm --prefix shared/animlib test -- nucleic-transcription-cycle.test.ts nucleic-transcription-cycle-integration.test.ts` passed 14 tests in two files. The log is `focused-tests.log`. The revision-specific temporary directory was `data/animlib-expansion/tmp-transcription-r3`. No whole-repository test claim is made.

`measurements.json` records 255 native elements, 12,102 source characters, approximately 97 ms compilation, 863 ms for 121 samples including serialization, and a maximum serialized frame of 92,869 bytes. The scene uses no external asset packages.

## Reproduction and superseded capability

Fresh-checkout generation reads the versioned schedule in `shared/animlib/demo/expansion/inputs/transcription-cycle.json`; the generated source, manifest and inputs remain byte-identical to the reviewed freeze. Default correspondence verification needs only that schedule and regenerated current outputs. Add `--check-archives` to `verify-transcription-revision3.mjs` to explicitly audit the historical revision 2 film hashes. The report states when this optional archive check was not requested. Both modes passed after the portability change.

Run the active generator, then the existing `shared/animlib/tools/render-frames.mjs` with `cycle-frames.json` and `render-video.mjs` with `cycle-manifest.json` at the two native dimensions. Run `verify-transcription-revision3.mjs` and `inspect-transcription-revision3.mjs` for correspondence checks, complete decodes, ordered samples, and hashes. The manifest and generated source are `cycle-manifest.json` and `cycle.js` in the output directory.

Before the user's correction, six biological representative frames and original CC0 illustrative Gaussian assets were prepared. These are preserved only as optional capability evidence: `shared/animlib/tools/prepare-transcription-revision3-assets.mjs`, `shared/animlib/fixtures/biological/transcription-revision3/`, and output files `biological-attempt-generator.mjs`, `superseded-biological-contract.md`, and `representative/`. They are not dependencies of the final schematic proof. Their source hashes bind the original generator; no source film pixels, meshes, or atomic coordinates were copied. Neither the illustrative forms nor the active schematic claim atomic fidelity or physical simulation.

The style contract is `docs/animlib-expansion/transcription-cycle-revision3-style-contract.md`. Independent review should separately judge reasoning, native readability at both aspects, the approved mathematical visual style, and technical integrity against these exact frozen films.

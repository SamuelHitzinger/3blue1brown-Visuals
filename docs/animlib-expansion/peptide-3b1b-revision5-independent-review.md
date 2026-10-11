# Peptide revision 5 — independent schematic review

Reviewed 2026-10-11. Verdict: **accept the repaired, frozen revision5 proof** for the current [unified 3Blue1Brown direction](unified-3b1b-direction.md). A small fixed-camera contract mismatch was found independently and repaired by the author before this acceptance. No production code was edited by the reviewer.

| Gate | Verdict | Scope |
| --- | --- | --- |
| Motion and correctness | Pass | Same staged 72-residue chain, local coil formation, read hold, prescribed global packing and compact endpoint; fixed sequence identities persist. |
| Reasoning and readability | Pass | Four side-visible coil regions form before packing. Local alpha labels appear during the hold; N/C leaders track the actual endpoints. Camera motion reveals the retained form after it settles. |
| Current 3Blue1Brown art | Pass | Restrained blue/teal/orange/violet sequence roles, thin clean curves, small nodes and local serif/math notation make a coherent explanatory world. |
| Media and technical | Pass after repair | Both repaired hashes/full decodes pass. Fresh 401-time native correspondence and fixed-camera checks pass; ten focused helper/staging tests pass. |

This is an illustrative prescribed folding motion, not a physical simulation, collision-free molecular dynamics or a recovered source protein. Source realism is no longer the requested art target. Historical realism findings remain preserved in the earlier reviews; the prior films did not become accepted new-style films merely because the target changed.

## Personally inspected evidence

I read the contract, report, complete generator and verifier, and used the previously read explanation-style baseline/review gate and personally viewed approved/rejected baseline images. I inspected **all ten ordered sheets / 160 encoded samples** before the repair and again all ten newly generated sheets after it: `peptide-{16x9,4x3}-ordered-01..05.jpg` under `data/animlib-expansion/peptide-3b1b-revision5/`, covering the whole ten seconds at 8 fps. This is dense ordered still-sequence inspection, not uninterrupted realtime playback.

Before repair I inspected native 1.4, 3.5, 5.6 and 9.5 seconds in both aspects. After repair I inspected refreshed native 3.5, 4.2 and 9.5 seconds in both aspects: `frames/{1280x720,960x720}-{5,6,13}.png`. The side-visible hold and local notation fit both native sizes, with no label collision. The same colored chain remains through packing; there is no surface substitution that conceals a change of identity. Apparent overlapping lines during packing and the final orbit follow projected depth. The final teal region becomes more end-on during the orbit, after the side-visible formation has already been shown and held.

I freshly revisited actual Protein Folding chronology frames 071, 079 and 110. The complete eight-sheet / 127-capture folding-playback inspection from my revision3 review and subsequent revision4 comparison remain the motion reference evidence. The extended chain → local coils → compact configuration is preserved as a motion technique. No glossy surface, fine molecular sculpture or exact source shape is required for this new art target.

## Found and resolved during review

The initial generator froze raw camera-fit samples through 4.2 seconds, then applied forward-looking maximum filters. Those filters reintroduced future packing scale during the hold: height rose from 10.715103026109066 to approximately 11.05 by 4.2 seconds. The initial verifier checked yaw/pitch but not the contract's fixed scale. I extended the copied reviewer verifier with an exact height assertion and reproduced the failure.

The author now freezes the final filtered height array through index42, using the maximum held value so the framing remains safe. I inspected this narrow change and re-ran the extended verifier: yaw, pitch and height now remain exactly fixed throughout the sampled 0–4.2-second interval. Both native 3.5/4.2 views show the same held composition. The prior media, hashes and ordered sheets are preserved in `pre-hold-fix/`; acceptance refers only to the repaired hashes below.

## Fresh technical evidence

I ran the author verifier from a reviewer copy with only import/output paths changed and the additional height assertion. Across 401 times it confirms the original rig and rounded staging input, all 72 retained anchor identities/colors, all 71 native curve-link endpoints, N/C leader attachment, exact reverse seeks and original compact atomic endpoint under the common rigid transform. Maximum native anchor/link discrepancy is 1.72747277745206e-13; maximum compact endpoint discrepancy is 1.1025224573019168e-13. Evidence: `data/tmp-review-peptide-transcription/peptide-r5-verification.{mjs,json}`. The generated Catmull–Rom links interpolate the actual CA anchors; their interpolated curves are schematic backbone traces, not atomic bonds.

Fresh `peptide-staged-proof.test.ts` and `peptide-motion.test.ts` passed ten tests before the camera-only repair. These retain the existing bond/torsion, separation and endpoint coverage; production helper and pose code did not change during the repair. After repair I reran the complete 401-time correspondence/camera verification, independently matched both new film hashes, and fully decoded both films: 300 frames / ten seconds / 30 fps each.

- 16:9: `aa31fd7c65c30a230e57a64d187b89ffb4009f9c6412a9ee968ddfe6fa3c7420`.
- 4:3: `f5c8b5a5a9a0c55a6293a9eb5e31b7bd55a2b9744cf1d947df1caf5aa8b608a1`.

Decode logs are `data/tmp-review-peptide-transcription/peptide-r5-{16x9,4x3}-decode.log`. Frozen revision4 film hashes still match. The new proof uses 151 retained elements and no external assets; its internal held-pose cache retains actual camera time. No new helper, VM or renderer limit was introduced. No additional repair is requested for this bounded proof.

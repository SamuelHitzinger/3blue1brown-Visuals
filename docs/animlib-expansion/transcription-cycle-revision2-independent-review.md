# Transcription cycle revision 2 independent review

Reviewed 2026-10-11 without modifying the frozen candidate, implementation, assets or Git state. The explanation-style skill's reasoning, readability, style and technical gates were applied separately. The actual transcription and Nucleus sources control biological presentation; mathematical reference styling was not imposed.

| Gate | Verdict | Scope |
|---|---|---|
| Reasoning | ready | Repeated arrival, complementary docking, incorporation and register advance can now be reconstructed |
| Visual readability | ready | Active pairing remains exposed and RNA exits side-on; final C–A–U remains identifiable in both aspects |
| Reference style | revise | Machinery shape, molecular surface detail and luminous populated depth still differ materially from the sources |
| Technical delivery | ready | Focused tests, independent adversarial/VM probes, native-anchor checks, hashes and full decodes pass |

Do not close the user's near-identical biological reference target. This is a bounded acceptance of exposed multi-cycle transcription and retained curved RNA, not a full-fidelity claim.

## Evidence personally inspected

Viewed every tile of all eight MP4-derived `cycle-{16x9,4x3}-ordered-01..04.jpg` sheets in `data/animlib-expansion/transcription-cycle-revision2`: 128 full-composition samples at 8fps spanning both complete eight-second films. Also viewed twelve complete native frames, indices 3/5/6/7/8/11 in both aspect directories, at 1.29/2.2/3.5/4.8/5.45/7.5s. Native frames were inspected as complete frames, not replaced by sheet tiles or crops. This is dense ordered sampled-motion inspection, not uninterrupted realtime playback or visual inspection of every encoded frame.

Source comparison covered the complete sampled 164-second transcription sequence: all twelve opening sheets (`sheet0-32`, `sheet32-64`, `sheet64-94`, four each) and all nine completion sheets (`sheet94-100`, `sheet100-116`, `sheet116-140`, `sheet140-164`), representing the supplied 329 half-second captures. Also viewed full opening frame104 (approximately 52s), all seven Nucleus growth-playback sheets (109 irregular captures around 115–131s), and full Nucleus 119/124. These live under `data/animlib-expansion/transcription-late` and `nucleus-chronology`. The two sources are [Transcription (DNA to mRNA)](https://www.youtube.com/watch?v=_Zyb8bpGMR0) and [Nucleus: How Your Body Creates Proteins](https://www.youtube.com/watch?v=LCIkd-WwC7o). Existing source captures were used only for comparison.

Read the previous independent review, revision contract/report, helper and types, both focused test files, API documentation, scene generator, original-asset preparation script, and author verification scripts.

## Visual findings

**V1 — The previous active-site occlusion and end-on RNA failure are repaired.** The fixed open blue machinery leaves the template/new RNA pair visible through more than three successive cycles. Native 2.2/3.5/4.8/5.45s and the intervening ordered samples show newly arriving bases joining the active end while the older green RNA extends and bends leftward. The exit no longer rotates the entire growing chain into an end-on rod. DNA visibly advances/recloses through the maintained active view. The complementary relationship is much easier to reconstruct than in the earlier proof.

Some older RNA exits the left edge in 4:3 during the active-end hold. This does not lose the active pairing operation, and the final camera returns to the same first three RNA sites. At 7.5s, C–A–U, its bracket and associated green anatomy fit inside both frames. The labels remain local to those sites. Optical focus visibly softens distant context. These are bounded readability passes; no claim that every nucleotide remains simultaneously on screen is needed.

**V2 — The machinery still reads as a smooth open ring rather than source-like enclosing molecular machinery.** Across the side-on hold, the blue body describes a broad nearly planar oval aperture with a rounded tubular rim. The source's machinery has more articulated volumes, depth and enclosing mass around a readable reaction region. The revision's open cavity is geometrically real, and it solves occlusion, but its silhouette and volume distribution remain materially simpler. The preparation script confirms a continuously modulated tubular surface; more tessellation alone will not change that design.

Smallest useful next revision: redistribute the original machinery into asymmetric connected lobes with appreciable front/back depth while retaining the tested clear sightline to the active pair. Preserve the side-on multi-cycle staging, then recheck the entire 1.3–5.9s passage in both aspects against transcription 104 and Nucleus 119. Do not regain enclosing mass by covering the newly readable pairing operation.

**V3 — Molecular form and environmental illumination remain visibly below the source target.** The new sugars and bases have differentiated lobes, but at native 7.5s many still read as simple rounded triangular/bean-like forms with modest silhouette detail. Nucleus 124 has more integrated irregular lobed anatomy and broad luminous highlights. The candidate's background remains predominantly gray, with large faint curved scaffolds and isolated contextual molecules; it does not yet produce the source's rich near/far molecular depth. The purple DNA behind the final triplet also retains enough saturation and sharpness to compete with the selected foreground anatomy. The optical blur is real, but that alone does not reproduce the source's focus hierarchy and lighting.

Refine original base/sugar shapes and broad highlight response, then compose contextual molecules at deliberate scales and depths around the active view. Adjust the final focus/framing/illumination so the selected triplet is visually dominant while the continuing DNA remains contextual. Compare full native 2.2/3.5/7.5s and their connecting motion with Nucleus 119/124. Extra decorative particles or a numeric depth count alone cannot satisfy this gate. These are asset, staging and material findings, not evidence of a renderer defect.

## Independent technical verification

Fresh focused run: `npm --prefix shared/animlib test -- nucleic-transcription-cycle.test.ts nucleic-transcription-cycle-integration.test.ts` passed **14/14 tests in two files**. Dedicated TEMP/TMP was `data/tmp-review-peptide-transcription`.

The reviewer-authored `data/tmp-review-peptide-transcription/transcription-probe.mjs` imports the current TypeScript helper directly. It tested 480 seeded varied schedules: 415 accepted, 65 conservatively rejected before sampling. Variation included signed twist/bend, both lock states, active/axis exit frames, arbitrary axis orientations, radii/pitches/window widths/separations and incoming angles spanning the supported range. Across **17,249 poses**, maximum exact-link deviation was `3.375077994860476e-14`; maximum unit/orthogonality deviation was `4.6351811278100286e-15`. No accepted schedule failed later.

The probe included 216 exact/adjacent-representable arrival, docking and advance samples across three timing schedules, including 80000s start with 0.01s cycles. Visibility, incorporated count, bond count and completion matched absolute event definitions. Maximum position/frame change across ±1e-8 at boundaries was `1.8281158417171437e-10`. Nine targeted malformed new-option/geometry inputs were rejected. Negative/positive `Number.MAX_VALUE` clamped correctly. First/last single-RNA mappings on 2- and 128-site DNA passed; input immutability passed.

An independent retained QuickJS scene exported every anchor's position, tip, normal and tangent at 78 times. Maximum host/VM numeric difference was `1.7763568394002505e-15`, below 1e-11. IDs, visible identities, incorporation/completion flags and RNA bond pairs were checked exactly in the VM; discrete exported values matched the host exactly. Reverse seeks reproduced the complete sampled scene frames exactly. Results are saved in `transcription-probe-results.json` beside the probe.

Code inspection supports the documented whole-schedule preflight: the cosine-squared opening gradient bounds adjacent radial change; the bounded radius/twist term bounds transverse angular displacement; the positive residual produces a real axial step preserving DNA chord length. Axis exit constrains the tangent away from degeneracy, and the bounded circular exit uses radius `L/(2*sin(bend/2))` to preserve adjacent RNA chord lengths. Lock orientation coherently rotates the entire duplex, including exterior DNA, as documented. This remains prescribed illustrative motion, not a flexible-polymer or chemical dynamics solver.

The author probes were independently rerun with output redirected into the reviewer directory. The 321 legacy samples remain byte-equal to commit `ab5f34d3540269c05d695ef2d75612c37a30ff41`; its 12,960-pose audit passed. The 321 frozen-schedule checks retained 56 identities, 46 DNA bonds and 7 final RNA bonds, maximum DNA/RNA link error `8.881784197001252e-16`, no post-completion drift, and the intended closed-behind/final-active registers. Native generator checks covered 56 sites × 3 anatomy parts × 8 times, including rotated tips within 1e-10 and exact reverse seeks. A local sandbox `EPERM realpath` required a narrowly scoped read-only escalation for asset loading; the rerun passed.

Independent budget accounting reproduced 92,316 logical vertices, 173,436 triangles, 8,324,928 conservative submitted triangle vertices at 16 focus samples and 16,649,856 at 32; 4,128 focus draws at 16. The five model manifests total 4,958,208 decoded bytes, below 32 MiB. These are bounded resource counts, not a fresh GPU performance benchmark or a complete renderer correctness review.

Both frozen hashes match:

- 16:9: `a646a1c0ba8260404360997b3fd6fe864140da0ebf5eb5b401bc7baa421e31f9`
- 4:3: `b2d17aafd6b46f994cba86c9d7da56a564d95213d349660f1715b7725572b1ab`

Both films were freshly decoded in full with FFmpeg 7.1: 240 frames, 8.00s, 30fps, yuv420p, 1280×720 / 960×720, no audio, successful completion. Decode logs and reviewer probe outputs are under `data/tmp-review-peptide-transcription`. No full repository suite, new film render or realtime playback benchmark was performed for this review.

# Scope update — 2026-10-11

The user subsequently changed the target to 3Blue1Brown art/graphing style, with biological references guiding motion techniques. This report is preserved as historical evidence. Molecular realism/style differences below no longer block the new target; the existing clip does not thereby gain approval as a 3Blue1Brown presentation. Reuse the accepted opening/travel/exit motions and identity bookkeeping, then review a new film with restrained semantic colors, clean geometry, local serif/math labels and explicit causal staging.


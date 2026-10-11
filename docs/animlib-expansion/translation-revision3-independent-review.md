# Translation revision 3 independent review

Reviewed 2026-10-11. The frozen eight-second candidate, assets and production code were not edited by this reviewer. A reviewer-only exact-event regression was added; its separate helper finding is described below. The explanation-style review discipline was applied using the actual Nucleus biological reference.

| Gate | Verdict | Scope |
|---|---|---|
| Reasoning | ready for this segment | Gly arrival, persistent Met transfer, one-register advance and empty-carrier exit are traceable |
| Native readability | ready | Foreground isolation and the paired operation survive the oblique transition in both aspects |
| Reference style | revise | Broader rounded adaptor relief and simplified smooth ribosome/conduit still differ; full-film accumulation/release remains outside this proof |
| Technical delivery | media ready; helper boundary revision required | Frozen encodes/hash checks pass; a new exact-event regression exposes pre-existing helper boundary errors |

The representative proof materially repairs the earlier foreground and camera failures. It does not establish near-identical rendering or accept the unshown remainder of an expanded film.

## Evidence personally inspected

Viewed all **31 source sheets**, covering all **486 captured frames** in `data/animlib-expansion/source-frames/nucleus-chronology/translation-playback`, approximately 158.396–224.927s, plus full chronology frames 180/185/190 and translation-playback 208. Source native captures are 2195×1235 and were displayed at 2048×1152. The source is [Nucleus translation](https://www.youtube.com/watch?v=LCIkd-WwC7o&t=158s). The source includes a long held codon explanation, foreground adaptor isolation, oblique transfer, accumulating product, stop and release; the later operations inform the larger target but are not present in this short candidate.

Viewed every tile in all **eight final candidate sheets**, `motion-{16x9,4x3}/sheet-01..04.png`: 128 full-composition samples at 8fps, spanning both complete films. Also viewed all **twelve encoded native frames** at 0/2.7/3.5/4.6/5.5/7.8s in both aspects. These are under `data/animlib-expansion/translation-revision3-proof/encoded-native`. This is dense ordered motion sampling and full native inspection, not uninterrupted realtime playback or inspection of every encoded frame.

Read the author contract/report, earlier independent review, entire helper, its API documentation, three supplied test files, revision generator and original-asset preparation script.

## Visual assessment and remaining work

The initial two-second hold gives the green Gly adaptor clear ownership of attention. It is visibly sharp against the dim, desaturated and optically softened ribosome. Gly, tRNA and Anticodon labels are local, sans-serif and readable at 720p in both aspects. The adaptor has asymmetric branches and depth relief instead of the earlier bent tube. These are substantive improvements, not a palette-only change.

The 2–3.5s pullback continues into a three-quarter view with diagonal RNA and a measured orbit. By 3.5s, both carriers and their codon/anticodon associations can be compared. From 3.5–4.8s the blue Met residue visibly moves to the purple Gly residue while the old carrier becomes empty; the same two-residue product then advances with the occupied carrier. The later departure moves through depth. The spent carrier reaches the upper edge near the end, but this occurs after the operation and does not crop the active carrier or product. The lower subunit partly occludes peripheral RNA; active matching remains readable. No object reset, duplicate residue, disconnected annotation, or large color-transition jump was found in the ordered final encodes.

**V1 — Continue refining the adaptor's original surface language before declaring the source-style problem solved.** Native 0s now has branches and rounded relief, but the silhouette is still dominated by a thick curving stem, bulbous side lobes and a rounded upper loop. Source 190/208 has flatter folded surfaces, deeper creases and broader luminous highlight transitions. The candidate is a recognizable improvement yet remains a different simplified sculpture. Refine the connected original scaffold's cross sections and folds, preserving the anticodon and cargo anchors. Compare the entire foreground hold and rotating departure, not only a single frontal silhouette.

**V2 — The conduit is recessed, but still reads as two raised soft ridges on a smooth shell.** Native 3.5–7.8s shows a more integrated opening than the old exposed rigid U-channel. However, the two rounded parallel ends remain conspicuous, and the large subunits have simple smooth inflated contours with visible low-frequency polygonal shading. Source 180/185 and the oblique source sheets give a more unified translucent passage through the surrounding volume, with fine surface relief. Refine the original shell/recess/conduit relationship and material response while preserving the current unobstructed pair and product. More opacity alone would risk hiding the very operation that now passes.

The revision appropriately does not pretend that two residues constitute the source's accumulated protein. A full extension still needs explicitly mapped additional residues, a persistent irregular bounded product path, continued traffic/context and a complete reviewed stop/release passage. Those earlier scope gaps remain open. The current proof is a useful staging foundation; neither this report nor the author report accepts an unseen full-length revision.

## Technical evidence and exact-event finding

Fresh run of the three supplied targeted files passed **16/16 tests**. These cover the standard codon table, wrong cargo rejection, geometry/attachment invariants, complete host/QuickJS state within 1e-11, exact reverse evaluation within each engine, malformed inputs and maximum permitted input size. Existing event tests predominantly use a 4s cycle and do not establish adjacent-representable discrete boundaries for nonbinary durations.

**T1 [P2] — Derive discrete event decisions from a consistent absolute event time.** With the frozen revision's `start:3` and `cycleDuration:4.4`, the documented first incorporation occurs at `start + .25*cycleDuration`, which evaluates to 4.1. At that exact time, the helper returns `incorporated:false` for Met, zero incorporated residues, and no attached carrier. The phase expression `(time-start)/cycleDuration` rounds below .25. At 11.579999999999998, one representable value before the first spent-carrier exit at 11.58, that carrier is already invisible and `spent`. These are observable exact-seeking/API errors even though their subframe duration does not create an established lasting defect in the frozen films.

Added `shared/animlib/test/nucleic-translation-event-review.test.ts` before any production repair. Its five cases cover exact and adjacent-representable arrivals, incorporation, transfer metadata/attachment, occupancy, translocation/exit and stop/release/completion across three schedules: `(start,duration)=(3,4.4),(3,.7),(80000,.1)`. The initial run yielded **4 failed /1 passed**; stop/release/completion passed. Log: `data/tmp-review-peptide-transcription/translation-events-before-repair.log`. The expected thresholds are expressed directly as absolute event times, without an epsilon. The coordinator owns the production repair and subsequent verification. This report records the frozen, pre-repair helper state; do not silently relabel the films as regenerated after that repair.

Before the coordinator's repair, independent SHA-256 comparison matched all **29 revision-3 entries** and all **14 original frozen entries**. The original freeze includes the helper source, so an authorized later helper repair must be disclosed as a deliberate source mismatch rather than changing its historical manifest. The original and new films/assets remain frozen.

The new film hashes match:

- 16:9: `259feac379b1b0195838646dd5ecaacf6f858194bce416266bad3b41da04684e`
- 4:3: `d336a0b8033aa20087017dcd7996a4450109be80c44b9acf6ccae07a1285129a`

Both were freshly decoded completely with FFmpeg 7.1: 240 frames, 8.00s, 30fps, H.264/yuv420p, 1280×720 / 960×720, no audio and no decode error. Reviewer decode logs are under `data/tmp-review-peptide-transcription`. The author reports 44 elements, 10,907,648 decoded asset bytes and a 48,952-byte peak serialized frame; those measurements were read rather than independently benchmarked here. No renderer/runtime/asset limit was raised by this visual-only revision. The full repository/native GPU suite was not rerun for this review.

The helper remains prescribed schematic translation, not molecular dynamics, atomic chemistry or recovered ribosome geometry. Technical tests cannot substitute for presentation review.

## 2026-10-11 scope change and independent repair verification

The user has now requested 3Blue1Brown art/graphing style throughout, with the other sources guiding motion techniques. V1/V2 above remain accurate historical comparisons; realistic adaptor sculpting and ribosome material fidelity no longer block the new target. The frozen clip is not newly approved as a 3Blue1Brown presentation.

The accepted bounded motion capability is persistent carrier/cargo identity, staged arrival and docking, continuous old-chain transfer, RNA/carrier translocation, empty-carrier departure, focus restoration and a legible oblique camera transition. The generic helper additionally supports mapped product growth and stop/release/disassembly; the eight-second film does not itself prove an extended presentation of those later events. A new full proof should show those operations explicitly before claiming complete explanatory coverage.

For the new art direction, use clean schematic adaptors and subunits, restrained role-based colors with matching codon/anticodon accents, subdued background geometry, and local serif/math labels at the active pair, A/P/E sites and growing product. Keep the existing hold, identity, transfer and unobstructed active area. Remove the need for sculptural realism and cinematic material matching. A longer product must still consist of the actual mapped residues, not decoration; the changed art direction does not waive biological bookkeeping or causal staging.

The coordinator repaired T1 using explicit absolute events, bounded current-cycle selection and clamped absolute interpolation intervals. I independently reread the complete repaired helper and reran all four targeted files: **22 tests pass**. The original five reviewer regressions now pass. A sixth independent case additionally checks complete host/QuickJS states within 1e-11 for numeric values and exact metadata, byte-exact reverse evaluation within each engine, exact-length existing product links and adjacent-double positional continuity below 1e-8. It covers arrival, docking, transfer, translocation, exit, stop recognition, release and completion for `(3,4.4)`, `(3,.7)` and `(80000,.1)`, including a rotated frame and coiled product. No remaining exact-event defect was found in this bounded audit.

The technical helper finding is closed by that separately verified repair. The frozen films retain their pre-repair generation history and were not regenerated or relabeled. The current clip art still requires the new style pass; the historical molecular-realism deficits are no longer completion blockers under the user's changed scope.


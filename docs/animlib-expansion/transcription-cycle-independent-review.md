# Independent moving-transcription-cycle review

Reviewed 2026-10-11. The visual review was completed independently without changing production material. After finding T1, the coordinator explicitly assigned this reviewer its narrow helper/test/documentation repair; that repair is identified separately below and requires the coordinator's independent code review. Assets, frozen films and Git state were not changed. The explanation-style skill, its three bundled images, its review gate, the current style contract, and the previous biological-motion review were read. The Nucleus and transcription references control biological style; no Euler-specific layout is imposed.

**Do not close the near-identical biological reference target.** The advancing opening and reclosing duplex are substantial improvements. The persistent final C–A–U triplet remains readable, and the focus variant visibly softens distant geometry. The intermediate pairing operation remains obscured during several cycles, and the surface, environment, and RNA motion still differ substantially from the references.

| Gate | Verdict | Scope |
|---|---|---|
| Reasoning | revise | The moving window and persistent extrusion are established, but a viewer cannot consistently inspect the complementary docking relationship through the shell. |
| Visual readability | revise | Final triplet passes in both aspects; intermediate active-site visibility does not. |
| Reference motion/style | revise | Rigid straight RNA rail, separate ovoid shell lobes, coarse base silhouettes and sparse flat environment remain material differences. |
| Technical delivery | ready for frozen media; boundary repair locally verified | All four films decode and match frozen hashes. T1 is corrected in source with failure-first tests; the coordinator owns independent patch review. |

These judgments apply to both baseline and optical-focus variants, in both aspects. Optical focus is a visible bounded improvement, not an overall style pass. Renderer implementation correctness is outside this review and belongs to the separately assigned renderer review.

## Evidence actually inspected

Personally viewed every tile in all **16 MP4-derived ordered sheets**, sheets 01–04 for each variant/aspect: **256 sampled frames**, 64 per film, covering 0–7.875s at 8fps. This is ordered dense sampled-motion review, not realtime playback or individual visual inspection of all 960 encoded frames.

Also viewed **16 full native frames**:

- Baseline, both 1280×720 and 960×720: indices 3/5/6/7/8/11, at 1.29/2.2/3.5/4.8/5.45/7.5s.
- Focus variant, both aspects: indices 6/11, at 3.5/7.5s.

Source comparison was direct: all seven `data/animlib-expansion/nucleus-chronology/growth-playback/sheet-01..07.jpg` (109 irregular ready/playing browser captures, 115.235881–131.124844s), full chronology frames 119 and 124; both `transcription-late/opening/sheet32-64-03.jpg` and `sheet32-64-04.jpg` (32 half-second samples, approximately 48–63.5s), and full frame 104 (approximately 52s). The two sources are [Nucleus: How Your Body Creates Proteins](https://www.youtube.com/watch?v=LCIkd-WwC7o) and [Transcription (DNA to mRNA)](https://www.youtube.com/watch?v=_Zyb8bpGMR0). No new source download or production use of source pixels occurred.

Independent FFmpeg complete-decode logs and SHA-256 results are under `data/animlib-expansion/transcription-cycle-review/`. All four films contain one H.264/yuv420p video stream, 8s, 30fps, 240 successfully decoded frames, and no audio stream. Dimensions are 1280×720 and 960×720. The independent hashes match the frozen author manifest:

| Film | SHA-256 |
|---|---|
| baseline 16:9 | `4eee2a86c62f6b508b030f694b9d595a5c83371e9ef6ea60898fac92a596d63f` |
| baseline 4:3 | `fc034bf234d78703dc3984d89b92949549405deac1b5a8f8e4b0d4cc092c5837` |
| focus 16:9 | `616acb3d04d5d6d349949a548d2e0fdc32b071d720a5452696a8e0daed36254e` |
| focus 4:3 | `ad4f72b7caf26072019eaeb99d0536886ff5c87d0b62cd846f94c62e90a3a141` |

## Actionable visual findings

**V1 — Keep the active pairing exposed through at least three successive cycles.** The opening genuinely advances and the duplex closes behind it. However, at 2.2s the new green RNA is a foreshortened cluster underneath the upper lobe; by 3.5s a large frontal blue lobe covers the active register, while the earlier RNA projects as a narrow upward rod. At 4.8s the strand swings back across the opening, and at 5.45s the row is finally side-visible. Thus repeated rotation of the whole exit rail and shell dominates the period when docking and translocation should be clearest. Native indices 5/6/7/8 show this in both aspects, and the complete sheets establish that these are part of the continuous motion. Increasing shell transparency alone has not made the complementary relationship reliably reconstructible.

Smallest useful revision: retain the moving-window helper, but stage a cutaway or stable side view that keeps the selected template base, incoming RNA base, and new backbone connection unobstructed. Hold that view through at least three complete arrival → docking → edge creation → one-register advance cycles before approaching the triplet. The RNA exit direction and shell presentation should stay legible while the active register advances; if that requires a curved or independently transported exit rail, extend the bounded contract honestly. Recheck the full 1.3–5.9s passage in both aspects. Nucleus frame119 and the ordered growth sheets show several separated complementary pairs with an incoming nucleotide visibly joining the end; transcription frame104 shows a readable growing chain bending away inside enclosing machinery.

**V2 — Refine biological shapes and illumination before claiming source-style correspondence.** At 7.5s the selected bases are smooth, roughly oval blobs with visible polygonal surface structure; green anatomy is a few joined rounded bodies. The four machinery pieces remain separate ellipsoid-like masses in a largely uniform gray field. Nucleus frame124 has strongly lobed base/backbone silhouettes, broad soft bright highlights, and a molecular environment with depth and scale variation. Frame119 also separates several arriving molecules from the active row at different depths. The proof's faint distant specks do not provide comparable context. These differences are visible in the full native frames and survive the optical-focus variant.

Revision: use more differentiated original base/sugar silhouettes and an enclosing machinery form with a readable opening, then tune broad soft illumination and a small number of properly scaled contextual molecules around the active view. Do not substitute denser decorative clutter for an exposed pairing operation. Recheck 2.2/3.5/7.5s and the intervening motion against source119/124. This is an asset/staging/material requirement, not evidence that the renderer itself is defective.

**V3 — The final triplet and optical-focus improvement pass their bounded gates.** At 6.5–7.875s the same C–A–U triplet remains foreground, with a bracket and local letters, and fits both aspects. At native 7.5s the focus variant makes background purple DNA visibly softer while the selected green anatomy and colored bases stay sharp; baseline and focus use the same framing. That is actual visible depth-selective softening, separate from the shared transparency treatment. The letters sit above each selected nucleotide, and the continuing RNA remains visible. The close-up still contains substantial superposed context and lacks the source's luminous surface quality, so this bounded pass does not override V1/V2.

## Independent technical review

Read the pure helper, types, public runtime/compiler/core wiring, focused direct and retained-VM tests, API documentation, and proof generator. The factory is self-contained after TypeScript erasure; no imported runtime helper is required in its serialized body. Dense explicit DNA/RNA identities, complement order, contiguous mapping and antiparallel direction checks are present. The conservative whole-schedule bound is mathematically defensible: the cosine-squared radial gradient bounds radial change, the average radius bounds the geometric mean, and the sine inequality bounds transverse angular displacement. Its documented false-rejection possibility is a deliberate conservative limit.

The independent source-import probe is `data/animlib-expansion/transcription-cycle-review/adversarial-probe.mjs`. It checked **400 seeded alternative schedules** with varied radii, pitches, positive/negative twists, window sizes, orientations and exit vectors. 353 were accepted and sampled at 41 times; 47 were rejected by the conservative preflight. Including endpoint and extreme-time cases, **14,504 poses** were checked. Maximum link error was `3.197442310920451e-14`; unit-frame error `2.6645352591003757e-15`; normal/tangent dot error `5.773159728050814e-15`. Event position/frame differences at ±1e-6 were at most `1.1687513035394387e-10`. Twenty-four malformed/nonfinite cases were rejected. Input immutability, serialized-factory parity, negative and `Number.MAX_VALUE` clamps, and first/last single-RNA mappings on both 2- and 128-site DNA passed.

The two supplied test files were independently rerun serially: **9/9 passed**, including public host/QuickJS construction and retained reverse seeking. Logs are saved alongside the probe. These tests do not replace the following exact-event finding.

**T1 [P2] — Use one absolute timestamp definition for docking and completion.** In `src/nucleic-transcription-cycle.ts`, docking uses `(time-start)/cycleDuration-i >= dockFraction`, while `complete` compares an independently computed absolute time. With the frozen proof inputs, exact final docking time `start+(7+dockFraction)*cycleDuration` is `5.84`. At that exact value the helper returns `complete:true`, `incorporated:7`, `incomingId:'rna-7'`, and only six RNA bonds. Exact docking times for RNA4/5/6 also leave those sites incoming. The division/subtraction path rounds below 0.6 while the absolute completion comparison has already succeeded. This affects event-driven callers and exact seeking even though ordinary 30fps film inspection does not expose a lasting discontinuity.

The saved `adversarial-results-before-fix.json` records the failure without relying on prose. The coordinator subsequently assigned its narrow repair to this reviewer. The helper now computes each absolute arrival and docking time, compares time directly for discrete visibility/incorporation, and derives completion from all incorporation decisions. It adds no epsilon and does not alter the geometry solver or timeline interpolation. Two new tests first failed: RNA4 was not incorporated at exact docking, and RNA6 was already visible one representable time before arrival. They now pass across three schedules, including a late 80000s start and 0.01s cycle, checking every event at the exact time and its adjacent IEEE-754 representable values. Final-cycle and huge-time states are checked too. All **11 focused direct/host/QuickJS tests pass**; the 14,504-pose adversarial probe passes again and every exact docking event is now consistent. Type checking passes. The coordinator owns independent review of this reviewer-authored repair.

The API document's stale integration wording was corrected and the absolute arrival/docking formulas are now explicit. Frozen films were not rerendered after this source repair; the visual evidence and hashes in this report identify the prerepair films exactly. Samples at a representable value adjacent to a declared event can change their discrete visibility under the repair, so any newly generated release must be identified separately.

The full serial suite was also run: **936 passed, 3 failed, 939 total**. `asset-host-preflight.test.ts` and `gltf-files.test.ts` failed with sandbox `EPERM realpath`; both passed when rerun outside the sandbox. The remaining failure is concurrent `peptide-staged-proof.test.ts:36`, whose formation row-gap assertion expected approximately 10 and received `9.90414817126107`. It was reported to the coordinator, who owns that separate peptide work. This is not a clean whole-repository suite claim. Logs are `full-tests.log`, `filesystem-recheck.log`, `boundary-red.log`, `boundary-green.log`, and `typecheck.log` in the review evidence directory.

## Decision

Accept the moving-window geometry, identity preservation, exact link constraints, retained final triplet, media validity and visible optical softening as demonstrated improvements. Keep active-site readability and biological reference style open. The exact-event source repair has focused and adversarial verification, with independent patch review assigned to the coordinator. A schematic provenance label is necessary disclosure but cannot satisfy the user's near-identical visual target by itself.

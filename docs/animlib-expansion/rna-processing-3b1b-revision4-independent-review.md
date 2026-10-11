# RNA processing revision 4 — independent review

Reviewed 2026-10-11. Verdict: **accept these bounded motion proofs** under the current [unified 3Blue1Brown direction](unified-3b1b-direction.md). No substantive repair is required in the frozen four films. This verdict is independent of the author handoff and does not certify a complete biological lesson or molecular dynamics.

The changed art target supersedes source-realism requirements from earlier reviews. Those historical verdicts remain valid for their former scope. The current films were inspected anew; old films are not retroactively approved as 3Blue1Brown presentations.

## Separate gates

| Gate | Verdict | Evidence and limits |
| --- | --- | --- |
| Motion and correctness | Pass | Persistent RNA forms the loop, holds, cuts at two boundaries, separates the removed interval, closes the exons and exposes the replacement connection. Pore traversal preserves the same chain through approach, held opposite-side camera cut and curved emergence. These are schematic kinematic capabilities. |
| Reasoning and readability | Pass | The yellow interval and white cut ends identify what changes; the teal survivors remain traceable. Local labels and blue boundary guides make the operation readable. The joined state holds long enough to inspect. The pore marker and label remain readable on both sides. |
| Current 3Blue1Brown art | Pass | Near-black space, restrained teal/yellow/blue semantics, clean geometry and local serif labels form a coherent explanatory scene. Organic anatomy and cellular textures are intentionally outside this target. |
| Media and technical | Pass | All four frozen hashes match, all four films decode completely, and fresh state verification plus 18 focused tests pass. |

## Personal visual inspection

I read the style contract and current direction, re-read the explanation-style skill's baseline and review gate, and personally viewed its two approved images and rejected chart-template image. I personally inspected **all 22 ordered MP4-derived sheets / 352 samples**: six splice sheets per aspect and five pore sheets per aspect, at 8 fps across the complete 12-second and 10-second films. This is ordered full-film still-sequence inspection, not a claim of realtime video playback.

At full native resolution I inspected splice `1280x720-3` (5.39 s), `1280x720-5` (6.17 s), `960x720-7` (8.04 s), `960x720-9` (11.9 s), and pore `1280x720-3` (4.649 s), `1280x720-4` and `960x720-4` (4.65 s), `960x720-7` (9.9 s). Paths are in `data/animlib-expansion/rna-processing-3b1b-revision4/{splice,pore}-frames/`; the frame indexes and `evidence.json` enumerate all times and ordered sheets.

I also personally revisited all 12 actual source pages in `data/animlib-expansion/source-frames/nucleus-chronology/splicing-playback/`, covering 179 captures. Formation, joining, passage through the opening and rising emergence remain recognizable motion techniques after abstraction. I did not impose the source's realistic sculpture, material or lighting on this revision.

The earlier pore-label collision is repaired. A thin segment of its leader is depth-occluded by the membrane near the cut; the word and selected marker remain clear. That is a minor observation, not a readability blocker. Apparent shortening of the chain after the cut follows projection and occlusion; verification confirms identical held chain positions. The blue splice guides are deliberately schematic and do not establish anatomical detail.

## Fresh verification

I read the generator and verifier. The proof reuses frozen revision2 helper properties, with no new core API or external assets. I independently recomputed all four film hashes against `evidence.json` and ran full FFmpeg decodes: both splice films contain 360 frames / 12 seconds; both pore films contain 300 frames / 10 seconds, at 30 fps. Decode logs are in `data/tmp-review-peptide-transcription/rna-r4-*-decode.log`.

To keep frozen evidence unchanged, I copied the author's verifier to the review evidence directory, changing only its import/output paths, and ran it afresh. It checks all 360 splice and 300 pore encoded poses, retained IDs, cut/replacement topology, exact reverse seeks and exact chain positions during the 4.4–4.9-second cut hold. Maximum host/VM anchor error was 4.440892098500626e-16 for splice and 3.552713678800501e-15 for pore. Numerical tolerance is distinguished from the exact identity/topology assertions. Evidence: `data/tmp-review-peptide-transcription/rna-r4-verification.{mjs,json}`.

Fresh tests passed: `nucleic-processing.test.ts`, `nucleic-processing-integration.test.ts`, `rna-processing-revision2-independent.test.ts` — 18 tests. The last file retains the independent aperture/path-clearance coverage. Source review confirms this is prescribed arc traversal and formation, not a physical simulation or a proof that every rendered inter-site chord is the exact curved centerline.

No candidate source, helper, asset or frozen media was edited during review. No further art revision is requested for this bounded proof.

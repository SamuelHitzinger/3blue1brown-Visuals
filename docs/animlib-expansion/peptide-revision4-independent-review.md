# Peptide surface revision 4 — independent review

Reviewed 2026-10-11. Candidate films, assets and production code were left unchanged. This review supersedes neither the frozen revision-3 evidence nor its historical verdict.

## Current scope and verdict

During this review the user changed the presentation target: use **3Blue1Brown art and graphing language throughout**, with the biological references supplying motion and animation techniques. Remaining molecular sculpture/realism differences therefore do not block the new target. The existing film has not thereby become a finished 3Blue1Brown presentation.

| Gate | Verdict |
|---|---|
| Reusable motion capability | Accepted for the bounded authored formation → hold → packing → endpoint representation transition |
| Reasoning and readable motion | Accepted within that illustrative sequence, in both aspects |
| Multipart API, frozen asset consistency and cache correctness | Accepted within the checks below |
| Current clip art against the new target | Requires a new coherent style pass |
| Physical folding or full reference-fidelity claim | Not established and not claimed |

## Motion and visual evidence

I personally inspected all ten ordered MP4-derived 8fps sheets, 160 samples spanning both complete ten-second films. Native inspection included 16:9 at 3.5, 4.9, 7.8 and 8.4 seconds and 4:3 at 3.5, 8.4 and 9.5 seconds. I compared the final surface directly with revision 3 and actual Protein Folding source frame 110. The previous revision's independent review contains the complete source-folding chronology inspection.

The local coil formation remains side-visible; the explicit hold precedes global packing. Identity, ordering and the compact endpoint persist through the atom/stick/surface transition. The final camera motion reveals the same form without a reset or a detached overlay. The weighted red/yellow boundary is substantially smoother, and the earlier angular highlight strips are reduced. The blue aperture region remains a recessed portion of the same extracted field, not an independently inserted plane. Broad smooth lobes still differ from the source's finer surface relief; that is a historical comparison, no longer a request to continue realistic sculpting under the changed scope.

The accepted capability is authored, seekable deformation and stable representation changes. The prescribed poses do not establish collision freedom, measured chemistry, physical folding or a recovered molecular structure.

For the new style, retain the motion but replace the glossy rainbow sculpture as the main explanation. Use a restrained semantic palette consistently across linked views; introduce only the color distinctions the operation needs. Use clean chain/ribbon or bead geometry with controlled line weight and subdued depth cues. Add short local serif/math labels for the active chain segment, local formation, packing and preserved endpoint; keep each label attached to its referent. Highlight one causal change at a time, hold the before/after relationships, and preserve the existing persistent identities. A final surface can remain a secondary representation if its appearance and purpose are explained. These are concrete requirements for a new presentation, not retrospective acceptance of this film's art.

## Technical audit

All **33 entries** in `biological-motion-revision4/frozen-hashes.json` independently matched SHA-256. Both complete FFmpeg decodes succeeded: 300 frames, 10 seconds, 30fps, H.264/yuv420p, 1280×720 and 960×720, silent. Decode logs are in `data/tmp-review-peptide-transcription`.

Fresh focused envelope verification passed **10 tests**. I inspected the complete implementation, its diff from HEAD, the preparation script and generated-scene transform. The legacy API still passes its original 20,000 triangle/vertex ceilings to the unchanged extraction algorithm. The multipart path bounds total extraction to 160,000 triangles and 100,000 vertices, each output to 20,000 vertices and the requested face limit, total emitted vertices to 100,000, and part count to 128. Density-work and grid limits remain. Extraction and smoothing precede partitioning; complete original faces are copied with common positions/normals. The API is host-only; no scene VM or renderer ceiling was increased.

Independent comparison with the HEAD implementation passed **24 legacy compatibility cases**: 20 varied accepted geometries matched exact JSON, and four invalid inputs produced identical rejection messages. Existing focused tests also check exact unsplit parity, expanded face coverage, shared normals, deterministic partitioning, small-part exhaustion and excessive density work.

The frozen binary assets contain five parts, **53,868 triangles**, **28,360 emitted vertices**, and **26,916 unique coordinates**. Every index is in range; every coordinate, normal and UV is finite. All **1,444 duplicated shared coordinates** have exactly equal serialized normals and UVs. Maximum unit-normal error is 4.34e-8. The preparer computes a continuous weighted sequence coordinate and analytic density-gradient display normals once per shared position. Its nearest-distance subtraction stabilizes all Gaussian weights equally; it does not reintroduce nearest-atom ownership boundaries.

I independently reversed only the cache-key clamp in the frozen revision-4 source. At **18 distinct times**, including formation, packing, settle, adjacent doubles around 7s, representation changes and the end, **36 complete frame comparisons** matched exact SHA-256 in forward and reverse/interrupted seeks. Camera and opacity retain actual time. The registry ended at 17,918,976 decoded bytes including the bead model, with zero pins and leases. Evidence and reproducer: `data/tmp-review-peptide-transcription/peptide-r4-audit.{mjs,json}`.

I also inspected the earlier benchmark's complete implementation and recorded results: its 309 comparisons cover 103 times, and its approximately 31% held-phase improvement measures CPU frame evaluation plus JSON serialization, not rendering. I did not independently rerun its timing benchmark. One fresh audit attempt hit the unchanged VM execution limit during compilation; the initial run and isolated rerun completed successfully without any limit change. This remains a scheduling sensitivity, not evidence of a geometry or cache mismatch. The full repository/GPU suite was not rerun for this bounded review.

No additional production defect was found. Reuse the motion and technical capabilities; judge the forthcoming 3Blue1Brown presentation on its actual new film.

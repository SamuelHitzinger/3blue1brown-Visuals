# Independent compact queue review

Reviewed 2026-10-11 on `amilibsam`, after completing the separate RNA revision-2 review. Both demo sets remained frozen. No production edits or git mutations were made. This review adds independent tests and this report only.

| Gate | Verdict | Evidence and limit |
|---|---|---|
| Reasoning | ready | The same immutable route/cost/destination record enters, advances and leaves the frontier. Two graph relaxations visibly explain the cheaper candidates. |
| Visual readability | ready | Entire graph and queue remain legible in both aspects; native inspection resolves the longest route. Fading arrivals/departures deliberately overlap; survivor order remains clear. |
| Reference style | revise | Compact insertion/extraction flow is demonstrated. The broader near-identical visual target still needs source-like soft state halos, white card contrast and consistent sans weight/cost text. These are visible differences in the actual source, not technical defects in queue scheduling. |
| Technical delivery | ready | Matching hashes and complete decodes of both films; eight queue tests including four independent adversarial tests pass; package typecheck passes. |

## Direct visual coverage

Personally inspected all **22 source ordered sheets and 344 real captures** in `data/animlib-expansion/reducible-complete/insertion-playback/`, spanning 310.286429–335.882646 s. The initial burst contains 240 captures through 318.551803 s; the later burst contains 104 from 318.937894 s. The capture gap is not covered. Sheet padding is not counted. The early sheets show a long narrated hold with one candidate; subsequent sheets show simultaneous arrivals, sideways extraction, cheaper-candidate insertion and the next extraction. The early browser/player overlay is not part of the intended reference design.

Personally inspected all **10 candidate MP4-derived ordered sheets and 144 samples**, 72 per aspect at 8 fps over 0–8.875 s: `16x9-sheet-01.png` through `05`, and `4x3-sheet-01.png` through `05` in `data/animlib-expansion/compact-frontier/`. This covers the complete nine-second duration by dense sampling. Also viewed native candidate `frames/1280x720-5.png` at 3.025 s, `frames/1280x720-11.png` at 6.45 s, `frames/960x720-11.png` at 6.45 s and `frames/960x720-12.png` at 7.425 s. These displayed at their actual dimensions.

Native source comparisons were `data/animlib-expansion/reducible-complete/insertion-playback/320.jpg` (332.141211 s) and `333.jpg` (334.245549 s). The image tool resized the source's 2195×1235 images to 2048×1152. This is ordered dense sampled review plus native spot inspection, **not real-time playback or a claim to have visually inspected every encoded frame**. Successful complete decoding checks every encoded frame structurally and does not increase visual coverage.

## Motion, reasoning and readability

The source's lower frontier closes upward after a short sideways departure, with the route, cost and destination moving as one card. New cards enter through a short fade/offset; they are not sent on long orbital paths. The candidate reproduces that compact behavior with .65 s operations at .8, 2.7, 4, 5.8 and 7.1 s. Survivors move together without exchanging identity. The source also has fading overlap, so demanding collision-free motion for all fading arrivals would contradict the particular reference mechanism and the agreed API scope.

The candidate graph establishes `1 + 2 = 3 < 7` before inserting A→B→C at 2.7 s; C's old direct record remains cost 7. It similarly establishes `3 + 1 = 4 < 5` before inserting A→B→C→D at 5.8 s; the direct D record retains cost 5. The operation holds are much shorter than the source's narrated pause, but the arithmetic, insertion, settling and extraction remain separable. The nine-second proof is a bounded demonstration, not a complete Dijkstra lesson or a claim that obsolete candidates are processed to termination.

At native 6.45 s, A→B→C→D fits its upper band in both aspect ratios; the cost 4 and destination D have separate bands. The graph labels, sums and frontier do not collide or crop. At 3.025 and 7.425 s, a fading card crosses a surviving card, but the offset/fade and completed before/after states make the intended movement readable. The dimmed old records after the final extraction are still identifiable. No explanatory title stack or footer substitutes for the visible operation.

## Concrete reference-style revision

The compact queue mechanics are accepted by this review. Current presentation still differs materially from actual source natives 320/333:

1. **Soft state halos.** Source active nodes have conspicuous soft yellow halos; the source orange/red start and green target have soft radial light around their node discs. Candidate 6.45 s has hard uniform rings and little surrounding falloff. Add local soft halo geometry/material or a suitable reusable radial image, preserving the existing state timings and node identities. Compare active C, settled B and target D before and after the 7.1 s extraction against the actual source's differently colored node states. Do not turn the entire scene into an undifferentiated glow.
2. **Card contrast.** The source uses strong white outlines and dividers. Candidate cards have fine lavender borders and a faint lavender fill. Increase outline/divider contrast toward white while preserving the compact three-band grouping and current readable route fit. Source records are visually stronger than inactive graph edges; retain that hierarchy in both aspect ratios.
3. **Weight/cost typography.** The source uses the same sans/handwritten-like numeric language across cards and edges. Candidate native 6.45 s has clearly serif graph cost and edge-weight numerals, while node names and route labels are sans. Make graph costs, edge weights and arithmetic consistent with the intended source typography; retain local placement above the nodes, which prevents the earlier weight-label collision.

The source also has a subtle purple gradient/geometric texture absent from the flat candidate. This is a secondary difference worth a restrained correction after the three focal issues. The smaller original graph and labels A–D are legitimate demonstration content, not failures to copy source data. The style verdict remains **revise** under the broad near-identical visual goal; accepted operation geometry does not waive this visible presentation gap.

## Code and independent checks

Read the plan, handoff report, API documentation, Reducible motion supplement, complete compact queue implementation/types, existing tests, graph proof generator, compiler/runtime/type/core wiring, and ownership preflight implementation. One factory supplies both host and compiled paths. The fixed record pool is copied/frozen; visible subsets and offsets are copied. The helper keeps persistent wrapper identities and resolves absolute time by bounded binary search. All transition validation occurs before appending the schedule or changing final order. It rejects overlapping/out-of-order schedules and survivor permutations. Interpolating survivor slots with a common eased parameter preserves their relative order and minimum slot separation, including insertions between survivors. Hidden records remain addressable for reinsertion.

Ownership preflight checks all custom handles and planned wrapper/default-child IDs before creating any queue element. It rejects foreign or already-parented handles, repeated handles and planned-ID collisions. This review does not extend the contract to physical nonintersection of every fading card.

Added `shared/animlib/test/compact-queue-independent.test.ts` with four independent checks:

- Foreign/repeated handles and a late planned-ID conflict reject before any wrapper/default child is created, and the original unparented handle remains usable.
- 256 valid schedules are accepted despite 256 rejected permutation attempts; transition 257 rejects without changing order. The exact 86400-second endpoint is accepted and a larger endpoint rejects.
- Mutating caller records, initial/target order, origin and entry/exit arrays after scheduling cannot change the immutable records or trajectory. Multiple survivors maintain minimum separation across 201 transition samples with an intervening insertion and departure.
- Host callbacks and retained compiled sampling agree at phase boundaries, forward/reverse seeks and arbitrary intermediate times for horizontal multiple-arrival/removal/empty/reinsert transitions.

All four new tests and four existing queue tests pass. The 25 existing tests in `diagrams-collections.test.ts` and `collection-preflight.test.ts` also pass. Package `npm --prefix shared/animlib run typecheck` passes. The first typecheck caught a test-only `toReversed` use beyond the configured library; it was replaced with a copied `reverse`, then the tests and typecheck passed. TEMP/TMP were set to `data/animlib-expansion/tmp-rna-queue-review`. No broad native suite was rerun; the known unrelated exact-MSAA failures are not attributed to this change.

## Frozen media integrity

Independently recalculated SHA-256 and completely decoded both final MP4s with `data/video-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe`. Both decodes exited 0. They are silent H.264 High/yuv420p, 30 fps, 270 frames and 9.00 seconds.

| Frozen film | Size | SHA-256 |
|---|---|---|
| `data/animlib-expansion/compact-frontier/compact-frontier-16x9.mp4` | 1280×720 | `6202758ec8dc1ead19e3b488160b783128e0959e59fa841803d10e9dceb9d662` |
| `data/animlib-expansion/compact-frontier/compact-frontier-4x3.mp4` | 960×720 | `635a4d534e81cc2e26e0736f99f7d0a96cb3c1ce9a201d8bf7ccfccec15c5ac5` |

Any visual revision needs new named outputs, a fresh inspection ledger and new hashes; these verdicts describe the frozen files above.

# Compact frontier — independent 3Blue1Brown review

Reviewed 2026-10-11. Verdict: **accept the bounded frontier motion proof** under the [unified 3Blue1Brown direction](unified-3b1b-direction.md). Its queue mechanics, readable staging, current art and media delivery pass separately. This is not approval of a complete Dijkstra lesson or every possible queue schedule.

The user now requests one 3Blue1Brown visual language throughout. Reducible remains the source for insertion, extraction and compaction motion. Earlier source-channel art matching findings are preserved historically and do not define this new proof's palette or typography.

## Separate gates

| Gate | Verdict | Evidence and limits |
| --- | --- | --- |
| Motion and correctness | Pass | Immutable path records enter, leave and compact while retaining their identity. Cheaper C3 and D4 entries coexist with stale C7 and D5 records. Local arithmetic explains both accepted improvements. |
| Reasoning and readability | Pass | Graph paths, changing costs and queue operations are causally staged. The two local sums remain clear in both aspect ratios. Intentional moving-card overlaps are transient, with clean settled orders. |
| Current 3Blue1Brown art | Pass | Near-black field, thin quiet cards and graph edges, mathematical labels and restrained blue/teal/yellow roles form a coherent presentation. There is no detached footer claim or ornamental panel system. |
| Media and technical | Pass | All seven frozen entries match their hashes; both full 270-frame decodes pass; eight queue tests pass; old/new queue mechanics match exactly at 276 times forward and reverse. |

## Personal visual inspection

I read the report, style contract, restyle generator, original proof and queue helper, along with the unified direction and explanation-style baseline/review gate. I personally viewed all three bundled approved/rejected baseline images during this review cycle.

I personally inspected **all ten ordered sheets / 144 actual samples**: `16x9-sheet-01..05.png` and `4x3-sheet-01..05.png` under `data/animlib-expansion/compact-frontier-3b1b/`, covering the complete nine seconds at 8 fps. I inspected full native frames at 0, 3.025, 6.45 and 7.425 seconds in both aspects: `frames/{1280x720,960x720}-{0,5,11,12}.png`. This is full ordered still-sequence inspection, not a claim of realtime playback.

For actual source motion comparison I personally viewed source sheets 15–22 in `data/animlib-expansion/reducible-complete/insertion-playback/`, showing arrivals, extraction, cheaper insertion and subsequent compaction. I also read the earlier [compact queue review](compact-queue-independent-review.md). The candidate retains those useful motion techniques while simplifying the visual treatment.

At 6.45 seconds the four-node route fits its card and the local `3+1=4<5` sum clears D. The DB edge weight remains readable away from the AC crossing. Both sums sit next to the operation they explain. During insertion/extraction, transparent incoming or outgoing cards briefly overlap survivors; the movement and settled endpoints remain traceable. Intermediate counting digits above graph nodes are transitional display values, while record costs remain fixed. The proof ends with dim stale records; it does not demonstrate their later stale-entry discard.

## Fresh verification

I independently verified every entry of `frozen-hashes.json` — seven of seven match, including the generated source, generator, original proof, manifest, helper and both films. Full FFmpeg decodes passed at 270 frames / 9 seconds / 30 fps each. Logs are `data/tmp-review-peptide-transcription/compact-3b1b-{16x9,4x3}-decode.log`.

Frozen film hashes:

- 16:9: `00bf1188524e47d1c1c95cb6c96ceb35fb4b53ede1f9cdb50eda48fbbb9edf3c`.
- 4:3: `626e5716be3c8768b29c98cc7b20d2043c21641c26ad3e91f922312ce779f30b`.

Fresh `compact-queue.test.ts` and `compact-queue-independent.test.ts` passed all eight tests. Independent coverage includes rejected handles without partial queue creation, exact budgets, immutable caller input snapshots, survivor separation, endpoint validation and host/compiled parity at phase boundaries in reverse order.

I added a review-only audit, `data/tmp-review-peptide-transcription/compact-3b1b-parity.mjs`, comparing the old and new proofs at all 271 times from 0 through 9 seconds on a 30 fps grid plus extra exact phase boundaries: 276 unique times. Every queue wrapper and every record child's ID, position, rotation, scale and opacity matched exactly in forward and reverse sampling. All six settled orders were checked explicitly: B1/D5/C7 → D5/C7 → C3/D5/C7 → D5/C7 → D4/D5/C7 → D5/C7. Results are in the adjacent JSON. Colors, glyph shape and explanatory annotation position are intentionally outside this mechanics comparison because those are the restyle.

Code review confirms the generated proof changes palette, stroke widths, mathematical text and local annotation placement while retaining the original graph data, Dijkstra-derived improvements and queue schedule. No shared helper repair, renderer limit increase or production edit was made during this review. No additional revision is required for this bounded proof.

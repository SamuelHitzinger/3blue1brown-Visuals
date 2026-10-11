# Compact queue transport

Evidence: `reducible-motion-supplement.md` records complete native playback near
310–336 seconds. The existing complete-permutation collection helper is accepted
for general reorder, but long separated lanes differ from this passage's compact
insertions, vertical shifts and one-record sideways extraction.

Add a separate `compactQueue` scene helper, preserving `collection` semantics.
Register a bounded immutable pool of records with stable IDs, values and optional
custom handles. An initial ordered subset is visible. A scheduled transition to
another subset preserves the relative order of surviving records, shifts them
along contiguous slots, fades arrivals into their final slot and fades departures
along an explicit offset. Ordinary groups retain route/cost/destination together.
The helper manages wrapper position and opacity; caller controls internal styles.

Expose `transition(order, timing)`, `insert(id, index, timing)` and
`remove(id, timing)`, immutable record metadata, persistent handles and a copy of
the final scheduled order. Absolute-time bindings support arbitrary seeks.
Reject reorder of survivors, duplicate/unknown IDs, sparse inputs, nonfinite
dimensions/offsets, overlaps and schedules outside bounds before any mutation.
Keep the existing 256-record budget; bound schedules too. Incoming/outgoing fades
are intentionally choreographic and do not promise collision-free transparent
overlap. Surviving records maintain spacing because they share one easing curve.

Verification: failure-first schedule/identity/atomicity tests, public host and
retained VM sampling, reverse seeks, a small source-derived graph/frontier proof
in both aspects, complete media decode and independent direct visual review.
Palette and typography remain Reducible-specific. Native output never embeds
source footage. Stop only after bounded helper and representative choreography
are accepted; this does not certify every video from the channel.

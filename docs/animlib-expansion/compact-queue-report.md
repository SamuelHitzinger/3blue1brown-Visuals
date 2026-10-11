# Compact queue author handoff

Status: frozen candidate for independent review. This addresses the compact
insertion/extraction gap in `reducible-motion-supplement.md`; it does not replace
the existing collision-separated general permutation helper.

`s.compactQueue` retains a fixed pool of immutable candidate records and schedules
ordered visible subsets. Survivors shift through contiguous slots; departures
fade sideways and arrivals fade into a new slot. The implementation preflights
record ownership and IDs, rejects invalid schedules atomically, preserves survivor
ordering, and samples absolute time by binary search over at most 256 transitions.
Runtime, compiler, public types and core exports share the same factory.

The native graph proof uses two accepted Dijkstra relaxations: A→B→C costs 3,
and A→B→C→D costs 4. Old direct candidates retain costs 7 and 5 respectively.
Each route/cost/destination stays one grouped record. Short .65s insertion and
extraction operations alternate with explanatory holds. Narrow three-band cards,
purple background, sans labels and ring states follow the separate Reducible
contract. The graph is a small original example, not the source's exact graph.

Root viewed all ten final ordered 8fps sheets, **144 full-composition samples**
across both nine-second films, with native inspection and actual source playback
sheet21 compared again. The complete source passage's22sheets/344samples had
already been inspected in the documented research. This is sampled motion review,
not a claim to view every encoded frame. Overlap during fading arrivals/departures
is deliberate and also visible in the source; survivor order and spacing stay
stable. A pre-final layout moved graph costs above nodes and narrowed cards to
avoid a weight-label collision and improve the source's card proportions.

Both H.264/yuv420p films are silent,30fps,270frames,9seconds. Complete FFmpeg
decodes succeed. Files under `data/animlib-expansion/compact-frontier/`:

| File | SHA-256 |
|---|---|
| `compact-frontier-16x9.mp4` (1280×720) | `6202758ec8dc1ead19e3b488160b783128e0959e59fa841803d10e9dceb9d662` |
| `compact-frontier-4x3.mp4` (960×720) | `635a4d534e81cc2e26e0736f99f7d0a96cb3c1ce9a201d8bf7ccfccec15c5ac5` |

Four focused tests cover duplicate-value identity, atomic rejection, surviving
spacing, host/retained-VM reverse seeks, empty subsets, horizontal slots, multiple
arrivals and reinsertion. An unrepresentable interval at start80000/duration1e-15
failed first and now rejects. A native cost-format/layout correction belongs to
the proof only. Existing collection tests continue to pass. See
`shared/animlib/docs/compact-queue.md` for API limits and reproduction via the
checked-in `compact-frontier-manifest.json`.

Independent review must evaluate code, complete motion and native text readability
separately. Do not infer full channel fidelity from these bounded operations.

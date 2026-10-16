# Indexed static assets in the joined lecture path

2026-10-16. The joined host now freezes up to four supported published static
models before constructing the browser world. It serves metadata and exact bytes
through local capability routes, supplies bounded lexical candidates alongside
lecture evidence, and requires matching inventory identity on start/generate.
The browser shares one ModelStore with the world and renderer. Model preparation
finishes before renderer preparation and world publication; cancellation still
prevents publication. Repeated instances reuse the loaded model.

This closes the specific wiring gap in
[the earlier audit](asset-live-gap-and-transferable-mechanisms.md). It does not
add dynamic registration, semantic retrieval, animation-clip playback or a
solution for changing an established 2D world into a 3D world.

## Scientific identity and bounded context

Repeated publication of identical geometry with different scientific context can
leave a mutable base sidecar containing old context but a new provenance pointer.
The session now accepts only the canonical sidecar for each asset identity.
Regression coverage publishes both versions through the actual ModelAssets API.

The real 4YLN descriptor initially exceeded the 16,000-byte context budget because
converter options alone contained 4,173,032 bytes of mappings and raw validation
details. Converter options above 4,096 bytes are now omitted whole, with an exact
path, byte count, SHA-256 and explicit notice that uninspected details may contain
additional constraints. All remaining scientific fields, source identity, units,
selection, modifications and fidelity caveats remain intact. Full original
provenance remains host-owned and contributes to inventory identity. If remaining
context exceeds the budget, the entire candidate is omitted. Missing mappings
and warnings are opaque; the prompt requires deferral for operations needing them.

This projection makes the actual candidate 6,701 bytes. It does not certify that
the asset is suitable for an arbitrary scientific explanation.

## Actual local proof

Ignored artifacts live at `data/realtime-workshop/lecture-assets-local-04/`:
frozen handwritten probe, result, exact saved world frames, embedded model bytes,
native render worker, six PNGs, two contact sheets and browser readiness capture.
[Sanitized results](lecture-static-assets-results-2026-10-16.json) retain the
asset identity, measurements and artifact hashes.

| Measurement | Single observed run |
| --- | ---: |
| Model | 12 parts; 90,004 triangles; 3,803,752 bytes |
| Index plus session construction | 165.57 ms |
| Cached candidate lookup | 0.54 ms |
| World add, including local HTTP load | 104.51 ms |
| Local HTTP read, nested inside world add | 2.82 ms |
| Retained translation patch | 0.87 ms |
| Model reads after a second instance | 1 |

At simulated times 1, 1.5 and 2 seconds, the translation patch preserves entity
IDs, the time-bound rotation and all 90,004 resolved triangles. Unknown asset
requests and stale-inventory start requests return 400; the latter fails before
provider authentication or source startup. Native WebGPU renders the exact saved
world frames at 1280×720 and 960×720. Source recompilation supplies preparation
metadata only; sampled geometry/state comes from the saved world frames.
Inspection confirms visible detailed structure and changing transform, not a
scientific mechanism or style pass. Browser reload shows WebGPU ready with one
indexed static model; Start was not clicked. Provider requests: zero.

These are handwritten integration checks, with a simulated world clock and
offline GPU export. No model selection, live deadline, hardware presentation,
generation speedup or visual-quality parity is claimed. Timings are single
observations, not p95 estimates; do not add nested measurements.

Earlier proof attempts remain preserved: `local-01` exposed the oversized
descriptor; `local-02` encountered sandbox localhost connection refusal;
`local-03` used a supposed no-match phrase containing words recognized by the
index's any-token search. The successful proof uses one genuinely unmatched
token. The broad lexical matcher remains a retrieval limitation.

## Coverage and verification

The user's range requirement remains explicit: sparse/dense 2D graphs,
coarse/dense 3D surfaces, small complete molecules and large organic structures,
across algebra, calculus, chemistry, probability and wave physics. Subject
reasoning, visual detail and change workload remain separate axes. Each detailed
stratum needs its own correctness and quality gate; easy plots cannot compensate
for failed detailed scenes. See the [matrix protocol](complexity-matrix-protocol.md)
and [controlled detail results](controlled-detail-checkpoint.md).

This checkpoint adds actual large-asset integration evidence. It does not turn
the prepared cross-subject model trials into completed tests. Existing surface
and caffeine comparisons still have a `revise` style verdict. No fresh model
trial ran while the separate model-payload upload approval remains pending.

Focused verification: **30 passing tests, 171 assertions**, across lecture join,
asset index, session, model-backed world and retained model integration. Targeted
strict TypeScript checking passed. Independent read-only review found no
remaining actionable integration defects after the provenance fix; it did not
review generated-scene quality or run tests.

```powershell
.\node_modules\.bin\bun.cmd test backend/bench/realtime-media/lecture-assets.test.ts backend/bench/realtime-media/asset-index.test.ts backend/bench/realtime-media/asset-world.test.ts backend/bench/realtime-world/models.test.ts backend/bench/realtime-lecture-join.test.ts
```

# Reuse finished programs' callback outputs

The retained-world prototype previously reran every time-dependent callback on every sampled frame, even after the program reached its authored end. All those calls received the same clamped time. As finished constructions accumulated, they continued consuming sandbox evaluation and serialization work while unrelated animation was still running.

`LiveWorld` now retains one terminal callback snapshot per time-bound program. The first request at the authored end performs the existing validated update; simultaneous terminal readers share its promise. Failed requests are evicted and can retry. Active and earlier-time samples still use the original compiler normally. The original scene remains the compiler-session and asset-lease identity.

This relies on the existing [pure-callback contract](../../shared/animlib/docs/reactive-controls.md): callbacks must depend only on arguments and immutable captured data. Runtime does not enforce purity. Closure counters or random consumption inside callbacks are unsupported and will behave differently when repeated terminal calls are removed.

The cache stores callback output, not a rendered or composed frame. Every sample still evaluates timeline state, clones elements, applies current host overrides/removals and resolves attachments/connectors. Rendering cost remains. Cache storage grows by one derived callback snapshot per retained time-bound program, not by frame count. The compiler remains alive for earlier-time sampling; this does not reclaim its sandbox memory. Retired programs clear their cached reference after all readers drain.

## Correctness evidence

Before the change, four new regressions failed because repeated terminal sampling, host editing, concurrent readers and retry paths dispatched extra updates. The disposal regression already passed. After the change, all six targeted cache tests pass, including a further asset-lease regression.

Coverage includes exact terminal and reverse-time frame values, caller mutation isolation, concurrent samples plus a cancelled edit, failed update retry, disposal while readers wait, live host tweens/attachments/connectors/removals, and a cached image program surviving unrelated commits before releasing its lease exactly once on removal.

Root verification passed **34 tests / 250 assertions** across cache, retained world, GLB inventory and shared asset-world integration. Targeted strict TypeScript checking passed. Independent review found no blockers and separately exercised original asset identity through terminal/earlier sampling, host edits and full removal. No provider requests occurred.

The [paired sampling probe](terminal-sampling-checkpoint.md) covers seven workloads and 532 exact baseline/candidate frame pairs. Held sampling medians improved from 1.363 to 1.016 ms for the actual detailed surface and from 124.323 to 16.401 ms for 16 synthetic deforming surfaces. Callback-free graph and full-molecule controls remained effectively unchanged. Active synthetic surfaces also remained expensive: 124.376 to 124.508 ms. Three additional harness tests passed with 12 assertions; strict TypeScript checking passed for the combined cache and harness files.

These are CPU sampling measurements from one local run, excluding GPU work. The 16-surface candidate still spends about 16.4 ms sampling before rendering. They cannot establish browser frame rate, visible presentation, model generation latency, or the full ten-second quality goal. Cross-subject visual quality and continuous-motion acceptance remain required under the [complexity protocol](complexity-matrix-protocol.md).

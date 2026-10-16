# Faster configuration across visual complexity

Eight new, single-attempt direct-native submissions used `gpt-6-luna`, reasoning `off`, requested priority. Every response reported actual tier `default` and zero reasoning tokens. Seven provider responses completed within ten seconds, but only two sources compiled with the requested eight-second duration. Faster configuration is not yet a qualified authoring path.

This is a configuration screen, not an isolated causal comparison of models: the earlier screen used `gpt-6.1-sol` with low reasoning at a different time. Current inputs retain the eight tasks and verified public molecule data; common instructions use the corrected native palette contract. No source was repaired, retried or replaced. There was no image, audio, live input or private data in these eight calls.

| Case | Provider termination | Compiled duration | Exact-source result |
| --- | ---: | ---: | --- |
| Simple line | 3.336 s | 8 s | Rendered |
| Detailed lines | 10.527 s | 6 s | Rendered; duration requirement failed |
| Coarse 3D surface | 5.941 s | 6 s | Rendered; duration requirement failed |
| Detailed 3D surface | 7.954 s | — | Reactive mesh topology failure |
| Probability curves | 7.734 s | 6.05 s | Rendered; duration requirement failed |
| Wave superposition | 8.491 s | 8 s | Rendered |
| Heavy-atom caffeine | 6.518 s | — | Compiler reports undefined iterator |
| Full caffeine | 7.646 s | 6 s | Rendered; duration requirement failed |

Times start at provider dispatch and stop at terminal response. They exclude capture, recognition, transport, compilation, resources, visible presentation and the explanatory operation itself. One observation per task cannot estimate reliability or p95. No actual priority service or fast-mode entitlement is established by requesting it.

## Execution and diagnostic boundary

The initial host render request used fixed samples through eight seconds. Four model outputs ended earlier, so the native worker correctly rejected the host's out-of-range sample with `Invalid sample time.` The wrapper exposed this as `The scene renderer is temporarily unavailable.` This diagnostic was reproduced by invoking the native worker on the retained request. It was a host sampling error, separate from the model's duration failure.

Those four unchanged sources were then rendered at their actual timestamps, including their true endpoint. Initial failures remain in `rendered/result.json`; the separate `actual-duration-results.json` records the sampling correction. No timeline stretching, final hold insertion, source correction or new model attempt occurred. The matrix renderer now selects samples within actual duration while retaining `exactEightSeconds` as an independent acceptance condition.

Six sources rendered at 1280×720 and 960×720. Two did not compile: the detailed surface explicitly binds its plane to an empty vertex array, violating stable topology; the heavy-atom compiler reports an undefined iterator, and source inspection additionally finds nested action arrays. The full-caffeine source also constructs opacity and translation actions without playing them; compilation alone cannot establish its intended hydrogen reveal.

The [fresh blinded review](speed-screen-blind-review.md) passes only the new simple-line output, and prefers its prior baseline. Every other new output needs revision or fails compilation. Concrete defects include collapsed probability plotting scale, false wave cancellation, stale point labels, missing hydrogen reveal and missing holds. Prior baselines were preferred in all eight pairs, although probability and surface baselines themselves still need revisions. This supports rejecting the faster configuration as the default general authoring path despite its better model-only response times. The review used sampled native frames and exact source, not full-motion playback.

## Implications for architecture

The latency headroom makes a fast model useful for further retained-edit experiments, but routing complex creation to it without correctness evidence would degrade output. Timing arithmetic, action ownership, local geometry and data-reference integrity remain failure sources even when strict tool JSON succeeds. Generic invariants and host-owned measured scheduling deserve priority over more subject templates.

The parallel [representation probe](local-geometry-probe.md) preserved detailed line and molecular scenes but saved only 5.56% of source bytes overall. It does not justify a new graphics language. Local atom coordinates did prevent center drift under a separately labeled scaling stress; retain that correctness lesson without calling it a latency result.

The [ingestion audit](retained-ingestion-next-probe.md) identifies the remaining real-path join: observed raw media chunks, local ASR, causal packets, cancellable strict model requests, atomic retained publication and revision-correlated browser pixels. Current model-only screens cannot stand in for that join.

## Evidence

Exact prompts, tool schemas, provider events, sources and receipts are in ignored `data/realtime-workshop/complexity-matrix/luna-screen-01`. The frozen manifest identifies the single direct-native arm. [Sanitized numeric receipts](fast-config-screen-2026-10-16.json) retain hashes, timings, tokens, geometry counts and diagnostic history. Local orchestration scripts are `.tmp/luna-complexity-probe.ts`, `.tmp/luna-complexity-render.ts` and `.tmp/luna-duration-render.ts`; they use the existing strict probe and native exporter without modifying generated source.

The shared matrix runner now honors a frozen manifest's optional `arms` array (`baseline` and/or `candidate`, unique and nonempty); legacy manifests keep both. `--stage=author` already reads the frozen model/reasoning settings. Thus this single-arm screen can be reproduced through the existing runner after preparing and explicitly freezing its manifest, without the temporary author wrapper. Two focused tests (15 assertions) verify arm validation and actual-duration sampling. An unchanged six-second detailed-line source was rendered again through this shared runner with samples `[0,1,3,5,6]`, `exactEightSeconds:false`, and no spurious second-arm attempt.

Anonymized comparisons against prior successful baseline sources are in `blind-speed-screen-02`; identities and timings were withheld from the new reviewer. These compare sampled quality, not simultaneous model performance or complete motion.

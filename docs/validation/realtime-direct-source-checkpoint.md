# Direct-source authoring and persistent media checkpoint

Measured 2026-10-16 local time. The current deadline is **10 seconds**, replacing the earlier five-second target. No result below establishes end-to-end acceptance.

## One model request instead of two

The previous matched MIT pair spent 13.758/13.576 seconds in perception plus authoring. This experiment puts the public lecture frame, measured past-only speech and causal visual instructions into one strict `submit_scene` call. No precomputed causal brief is supplied. Exact prompts, images, sources, timing and failures remain in ignored local evidence under `data/realtime-workshop/tool-probes/`.

| Run | Model / reasoning | Request to provider termination | Output tokens | Result |
| --- | --- | ---: | ---: | --- |
| `luna-direct-physics-01` | gpt-6-luna / off | 6.174 s | 802 | Compile failed: invented action shape and invalid geometry update. |
| `sol61-direct-physics-01` | gpt-6.1-sol / low | 13.709 s | 925 | Missed deadline before rendering. Initial Greek text renderer failure fixed in library; unchanged source then rendered, but oversized world-unit strokes obscure composition. |
| `luna-direct-physics-02` | gpt-6-luna / off | 8.020 s | 1,034 | Rendered, but duration is seven seconds instead of requested eight; unsupported spring depiction and detached equation composition. Rejected as acceptance evidence. |
| `luna-direct-biology-02` | gpt-6-luna / off | 4.365 s | 456 | Rendered eight seconds, but redraws/underlines lecture board and misreads scientific distinction. No explanatory operation. Rejected as acceptance evidence. |

These are single observations, not latency distributions or a controlled model ranking. The second prompt revision explicitly specifies world-unit stroke widths and concrete handle-generated actions. Each call remains a separate frozen attempt: failed outputs were not silently repaired. Priority was requested; every response reported actual tier **default**. These timings exclude capture, ASR, compilation, GPU preparation and presentation. Strict JSON constrains the source container, not JavaScript validity or scientific correctness.

Physics used the public MIT oscillations frame at 900 seconds and actual prior speech from 893–897 seconds. Biology used the public MIT frame at 1800 seconds plus actual local CPU transcription of 1796–1800 seconds: 283.55 ms inference, excluding capture and model load. No private audio or transcript was uploaded or committed. The previously approved private-frame probe is separate.

Native render evidence: the two revised Luna runs are in `rendered/2026-10-15T23-35-28.722Z`; unchanged Sol source after Greek handling fix is in `rendered/2026-10-15T23-36-30.022Z`. Root inspected rendered frames. This was failure triage, not fresh blind full-motion approval.

**Inference:** removing the serial round trip creates a plausible latency envelope, but faster syntax generation alone does not preserve explanation quality. Next representation experiment should retain a compact causal operation, object correspondence and relational layout within the same request. Do not promote the current Luna samples.

## Media corrections and static models

`MediaReplay` now feeds the existing causal scheduler with opaque frame references and measured ASR word timings. Observed completion and replayed measured duration remain explicitly distinct. Original event deadlines survive queueing, failures and retries. Receipts report render submission separately from unknown hardware presentation and unknown semantic completion.

`LiveWorld` accepts an external abort signal and a synchronous publication guard. Actual QuickJS integration tests exercise corrections during resource preparation and queued corrections activated immediately before publication. The rejected candidate releases resources; prior motion survives. These tests inject submission timestamps and do not claim GPU timing.

Immutable host model metadata now enters the world compiler; model geometry stays in the host `ModelStore`. A [real 4YLN integration probe](realtime-asset-world-2026-10-16.json) selected and loaded the indexed 90,004-triangle, 12-part GLB, prepared it and preserved rotation while moving its parent. One run measured 126.04 ms index construction, 18.95 ms selection/payload load, and 101.22 ms world add including 62.01 ms model preparation. These are handwritten host integration timings, excluding GPU rendering and model generation. GLB animation clips, skinning and morph-target playback remain unsupported.

Focused verification before asset-loader follow-up: 63 tests passed, 401 assertions. Initial sandbox run blocked two filesystem tests with Windows EPERM; rerun with filesystem permission passed. Independent review found an unbounded published-GLB read after index creation. The loader now reads through a bounded open handle and verifies size, growth and hash before returning the existing renderer payload. Root reran all nine asset-index tests (49 assertions) and its focused TypeScript check successfully after the fix.

## Architecture decision

Use the [existing-solutions research](fast-visuals-existing-solutions.md) to prioritize compact retained transactions, host-owned generic relations and an independently benchmarked faster inference endpoint. Keep the warm renderer; profile and optimize measured hot paths without attributing millisecond savings to multi-second authoring latency. Continue evaluating exact generated sources, including failures, against matched baselines.

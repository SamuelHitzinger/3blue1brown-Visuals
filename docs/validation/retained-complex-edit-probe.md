# Retained complex edit: one real model operation

2026-10-16. **A single accepted Luna/off operation moved an existing full caffeine molecule coherently, with the world commit reached in 1.900 seconds.** This tests a small edit on already-authored complex geometry. It does not test initial scene generation, live evidence ingestion, browser-visible readiness, arbitrary edits or end-to-end ten-second performance.

The request asked the model to move the existing `caffeine-rigid` group from `[0,0,0]` to `[-0.6,0,0]` over two seconds, leaving rotation, scale, atom/bond identities and the separate formula/legend unchanged. The model received a concise host description and stable group ID, not instructions to regenerate the molecule. The accepted native `WorldPatch` contains exactly that one position change, duration 2, and no removals. There was no output repair.

## Attempts and actual timing

| Observation | Result |
| --- | --- |
| Requested configuration | `gpt-6-luna`, thinking `off`, priority tier, strict `submit_world`, SSE, zero retries, 10-second timeout and external deadline |
| Actual service tier | `default` |
| Valid completed tool call | 1,859.30 ms after dispatch |
| Successful provider terminal response | 1,881.29 ms after dispatch |
| Request entry through saved receipt return | 1,894.18 ms |
| Native world apply | 2.03 ms |
| Request entry through world commit | 1,899.54 ms |
| Tokens | 1,134 input; 67 output; 0 reasoning |
| Normalized accepted operation | 235 UTF-8 bytes |

The first attempted dispatch (`live-01`) failed locally before observable payload construction: credential-store lock creation outside the sandbox returned `EPERM`. Its 1.76 ms terminal error is **not provider latency or a model/schema failure**. A diagnostic blocked every network request and reproduced the sanitized exception with zero network attempts. That receipt remains intact. The separately authorized `live-02` run permitted the existing credential lock and model network; it used byte-identical prompt/schema and identical model/thinking settings. The actual outgoing tool metadata records strict mode, and the provider returned a successful matching submission. No schema change or model repair intervened.

Native rendering happened afterward in a separate offline process. Twelve frames were generated at 1280×720 and 960×720; no browser paint or first-visible-pixel timing was measured. The table must not be read as an end-to-end display measurement. This is one successful provider request, not a reliability estimate.

## Explicit seed adaptation

The source is the successful Sol full-caffeine baseline from `complexity-matrix/screen-01`, using the same public PubChem conformer data. Unmodified source fails `LiveWorld` because it contains an initial zero-duration camera action. The rejection, original source/hash, adapted source/hash and exact one-line diff are retained.

Only that camera-action line was removed for world seeding. All geometry, labels, styles, reveal/rotation actions and eight-second seed duration stayed intact. Element arrays match the original exactly at seven times from 0 through 8 seconds, excluding camera state. For offline review only, the original final camera was reapplied as a fixed render view. This is **not unchanged full-scene preservation**: the retained world's default camera and the fixed review camera are distinct, declared configurations.

Original source SHA-256: `faf91194dd50490bfe03be932b8a8aecf92d317134e0c2cbb5a71b9b05f7712e`. Adapted source: `2ed0718288a1f59379b2c3dec824e6b98a4486947013482d53fe7078fe9e7b15`. Host molecular data: `c9258f019dcaad8754b4f171dd379f6b78e33bd27b8aa90b949378cd7079dce1`.

## Retained geometry and cancellation checks

The world reached the seed's final hold before the edit. The model's actual accepted patch was first tested with an already-aborted transaction signal: revision and every element remained unchanged. The valid application then checked the external signal and ten-second deadline immediately before publication, advancing revision **1 → 2**. This exercises pre-publication cancellation; no midstream provider cancellation was induced in this run.

Twenty-one frames sample the two-second edit every 0.1 seconds. All 94 native IDs remain; the molecule retains **24 atoms, 25 bonds depicted by 29 strokes, and 128 triangles per atom**. Geometry/topology, paint and opacity remain unchanged. Every object outside the molecular group is exactly unchanged. Across 40,026 sampled vertices/endpoints, maximum error against the expected rigid translation is **4.44×10⁻¹⁶** world units. Maximum atom-pair distance drift is **8.88×10⁻¹⁶**. Bond endpoints follow the same translation within **4.44×10⁻¹⁶**. These are sampled relational checks, separate from visual readability.

An independent critic (`/root/speed_screen_blind_critic`) passed the sampled visual quality after inspecting both sequence sheets and every before/midpoint/after PNG. Only neutral comparison context was supplied; model and latency metadata stayed withheld until the verdict. The critic found coherent left translation, attached hydrogen and double-bond strokes, no clipping, lost detail or new collisions, readable fixed annotations with pixel-identical regions, and consistent endpoint/hold frames. This review does not establish every-frame motion quality or scientific topology; those limits remain separate from the numerical geometry checks.

## Offline motion replay

`live-02/retained-edit-side-by-side.mp4` compares the unchanged control with the measured accepted edit using the same fixed camera. It contains 72 native sampled frames at 24 fps: the two-second translation followed by a one-second hold. Both halves render at 1280×720, producing a silent 2560×720 H.264 video. Every edited frame comes from the retained world; there is no image interpolation or model retry. Labels identify the unchanged control and the offline measured-edit replay.

Offline rendering and encoding took 1,572.58 ms and produced 141,599 bytes. This work happened after the measured request and commit, so it is neither provider latency nor browser-visible readiness. Independent ffmpeg decoding succeeded with exit code 0 and confirmed 72 frames, 3.00 seconds, H.264/yuv420p, 24 fps and no audio. The sampled visual critic verdict above does not constitute a full-motion review of this replay.

## Evidence and boundary

Ignored artifacts live under `data/realtime-workshop/retained-complex-edit-probe-01/`: `preflight-01`, preserved failed `live-01`, successful `live-02`, offline diagnostics, and neutral `visual-review`. The successful run includes raw provider events/calls, normalized `world.json`, request receipts, seed source/diff, world summaries, all sampled frames, native PNGs, a frozen host script/render worker and `artifact-audit.json` proving equal prompts/schemas and recording hashes. `motion-input.json`, `motion-export.json`, `prepare-replay.ts` and `render-replay.mjs` preserve the separate offline replay inputs and procedure. The normalized operation SHA-256 is `b841ba339c8e2a3073ef07c4ff10a96bacf55a3fb61ee99f8a6150f50956c85d`.

The result supports a narrow claim: a small model-authored operation can preserve an already-detailed molecular construction while reusing native grouping and world patching. It does not show that Luna can initially author the same geometry correctly, choose a scientifically useful manipulation from ambiguous lecture evidence, safely edit arbitrary relationships, or sustain a retained live session. No production libraries were edited for this experiment.

# Active deformation copy checkpoint

The guarded candidate reduced median CPU update time by about 12–15% on three trusted numeric surface fixtures. This is a bounded local probe of `createSceneProgram.update`, not a rendering, FPS, generation-speed or end-to-end latency result.

`s.deform` already copies the input point and callback result for every vertex. The runtime now recognizes its own detached, finite numeric snapshots and avoids an additional JSON stringify/parse copy. Ordinary bindings still snapshot immediately. Signed zero, nonfinite values, custom numeric serialization and inherited JSON hooks use the existing path. There is no new API, reduced mesh detail, skipped deformation, changed normal calculation or weaker sandbox/host validation. Ownership relies on normal built-ins and the documented pure-callback contract; arbitrary mutation of runtime internals is not an equivalence claim.

Baseline: `c1298f469501abe7e20098dc159cbb559654e8d8`. Runtime/compiler git blobs were frozen; both arms use the same frozen compiler and relocated imports. Candidate runtime was frozen separately (SHA-256 `e12d0eae0dfbc08631a6e51532ea87ef2b1c9545d502de5a7a3ac7415405d3d8`). Source/dependency hashes, raw outputs and timings remain in ignored local evidence; tracked aggregate receipts are in `deform-copy-results.json`.

| Fixture | Baseline median ms | Guarded median ms | Change |
| --- | ---: | ---: | ---: |
| Surface 10×10, 121 vertices | 0.53360 | 0.46845 | 12.2% lower |
| Surface 20×20, 441 vertices | 1.74625 | 1.48305 | 15.1% lower |
| Surface 40×40, 1,681 vertices | 6.56210 | 5.57600 | 15.0% lower |
| Reactive rotation control | 0.02180 | 0.02220 | 0.00040 ms higher |
| Callback-free timeline control | 0.01220 | 0.01155 | 0.00065 ms lower |

Each fixture used one warmup followed by 20 paired active updates, alternating arm order. Timers exclude compilation, setup, hashing, equality checks and frame construction. They include QuickJS callback work, serialization, host parsing and validation/merge. Callback-free scenes do not install the runtime update function: that control separately times `evaluateScene`, so its numbers are not comparable to QuickJS update costs. Setup costs are recorded but not treated as optimization evidence. These are short local samples without confidence intervals; tiny control differences are noise, not demonstrated improvements.

Authoritative evidence: `data/realtime-workshop/deform-copy-candidate-03`. All 100 returned-output/frame pairs matched exactly. Frames explicitly merge returned reactive updates before evaluation. Every surface vertex is checked against `z = sin(x + t) cos(y)` and a noninitial vertex is required; transform controls check the analytic rotation. An additional 15 untimed comparisons at 3.603 → 0.25 → 2 seconds matched frame, mesh triangle/normal data and packed draw data, covering backward seek and resumed motion. No GPU pixels were compared in this probe.

The initial unsafe diagnostic removed only `properties: clone(properties)`, replacing it with `properties`. Its 29–34% surface timing reduction isolated the cloning contribution, but it bypasses compatibility protections and is not a proposed implementation. The guarded candidate retains the ordinary path where required; its smaller measured gain is the applicable result.

Preserved attempts:

- `deform-copy-diagnostic-01`: returned-update equality and timings valid; initial active-frame claim invalid because returned updates were not merged into the evaluated scene. Correction receipt retained.
- `deform-copy-candidate-01`: failed before measurement because checkout CRLF differed from git LF. Original inputs and failure receipt retained. Retry verified compiler equality after line-ending normalization and executed the identical frozen compiler in both arms.
- `deform-copy-candidate-02`: returned-update equality and timing valid; frame/normal/draw claims invalid for active deformation because they evaluated initial reactive state. Correction receipt retained.
- `deform-copy-candidate-03`: corrected authoritative run above. No earlier evidence deleted or overwritten.

The focused harness regression first failed for the missing frame helper, then passed three assertions: analytic noninitial deformation, changed vertex position and unchanged input scene. Before the runtime edit, the new no-redundant-copy regression failed while five compatibility cases passed. After the edit, 91 library tests and 31 retained-world/harness tests passed. Coverage includes detached callback inputs/results, shared arrays across ordinary bindings, direct-runtime signed-zero normalization, custom serialization, invalid-update recovery, dynamic surfaces, normals, compiler lifecycle and retained-world transactions. Full library typechecking, library build and targeted harness strict TypeScript validation passed. Independent implementation review found no blockers within the pure-callback contract. No providers, network requests or uploads were used.

Independent evidence review verified baseline Git blobs, relocated sources, candidate/dependency hashes, all raw aggregates, balanced arm order, 100 output/frame pairs, 15 recorded geometry/draw parity checks, 89,720 recorded analytic vertex checks and all 79 receipt file hashes. It found no blockers. The checked-in harness differs from the frozen candidate-03 harness only by two defined-coordinate assertions outside timing, added for strict TypeScript; the exact run script remains preserved in its evidence directory.

## Native side-by-side preview

[Baseline/candidate video](../../data/realtime-workshop/deform-visual-01/baseline-candidate.mp4) and [contact sheet](../../data/realtime-workshop/deform-visual-01/contact-sheet.png) retain the original detailed 40×40 source and camera. Both arms were evaluated and rendered independently through native WebGPU. The eight-second silent export contains 192 frames at 24 fps, mapping source time to `min(frameIndex/24, 6)`: six seconds of movement and a two-second endpoint hold. Each arm is 1280×720; the combined video is 2560×720. The fixed export rate is not live playback performance.

All 192 merged scene-frame pairs match exactly; every surface coordinate was checked analytically. Native raw RGBA matches in 173/192 pairs. The other 19 pairs differ by only one intensity level in 25 channels total across the entire clip. Identical held inputs also produce tiny within-arm output variation. Root independently decoded all 384 PNG files and recomputed these totals. The lossy H.264 preview is for visual inspection, not pixel hashing. MP4 SHA-256: `a558639551d10e6447f6fe1fe64351133e9fcdc468c20a1cec6837aca57372f8`.

A fresh critical subagent found no perceptible degradation in six matching frame pairs and the enlarged poster: silhouettes, folds, shading, scale and placement appeared equivalent, with no new holes, cracks or faceting. It also flagged shared baseline defects: the upper tip briefly crops at the top edge, and the uniformly shaded surface offers weak depth references for assessing fine detail. Visual readability therefore still needs revision for a finished lesson. This is sampled-frame review, not full-motion, instructional-quality or style approval. The clip demonstrates this optimization's preservation limits; it does not satisfy the cross-subject ten-second end-to-end acceptance gate.

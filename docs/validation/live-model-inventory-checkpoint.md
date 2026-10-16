# Mid-session model inventory checkpoint

2026-10-16. The retained lecture world now accepts newly published static models without rebuilding its world/store, changing scene revision, restarting existing motion or renewing the original scene-response deadline. This closes resource admission, not automatic asset discovery or the full ten-second lecture goal.

## Implemented contract

- Host admits one to four exact canonical published runtime IDs per batch. It verifies bytes and full scientific provenance, stages the whole batch, enforces the shared browser envelope and checks cancellation/deadline immediately before publication. Maximum cumulative inventory is 64 models, additionally bounded by serialized bytes and metadata nodes.
- Inventory revisions and known prior digests support clients already running. Each generation pins matching candidate descriptors and a manifest before inference; browser reconciliation appends unknown models and cannot downgrade an accepted snapshot.
- ModelStore stages its entire batch before mutation, preserves compatible same-hash URL refresh and rejects provenance replacement. LiveWorld snapshots model metadata per compilation and keeps inventory revision separate from scene revision. Registration, preparation and scene publication retain their existing cancellation guards.
- Local registration route accepts IDs, never client paths or URLs. It rebuilds the configured local index. External semantic retrieval, import selection, animated clips and camera-mode transitions remain separate work.

## Local scientific integration proof

`backend/bench/realtime-media/live-inventory-proof.ts` starts with an empty model inventory and an active native graph, rotating/translating cube and deforming surface. It publishes the existing local 1CRN scientific GLB afterward, rebuilds the index, registers through host and browser reconciliation, and adds it to the same world. A subsequent addition reuses decoded geometry.

Final run `data/realtime-workshop/live-inventory-01/rHJ4clR` preserves all **10,784 triangles and 46 parts**, the complete original scientific provenance, old program epoch, rotation, deformation, host transition and camera. It also exercises cancelled host admission, expired original deadline, stale/conflicting manifests, idempotent retry and cancellation during scene preparation. Resolved primitive arrays are shared on reuse; model byte reads remain one.

| Measurement | One observed run |
| --- | ---: |
| Local file/publication through compile, prepare and resolved geometry | 93.18 ms |
| Cold compile, prepare and resolve within that interval | 43.45 ms |
| Reused compile, prepare and resolve, measured separately | 24.96 ms |
| Separate offline native readback process | 1,876.88 ms |

These are local component timings, not baseline-versus-candidate speed gains, reliability statistics or lecture-to-display latency. The asset was explicitly chosen before the run. State assertions use a controlled world clock; elapsed work uses `performance.now()`. No provider request, transcription or network retrieval occurred. Original scientific constraints still apply: this static representation is not a molecular simulation.

Offline native WebGPU readback receives the actual sampled world frame, with only persistence flags added. A reviewer independently compared that input with the saved frame and verified full provenance and triangle counts. Both 1280×720 and 960×720 PNGs pass bounded graph/surface pixel checks: 572 graph pixels and 64,941 surface pixels. These establish visible components, not explanation quality. The isolated offline renderer does not establish retained browser-renderer behavior or hardware presentation; both live timestamps remain null.

The [numeric receipt summary](live-model-inventory-results.json) records hashes, checks, timing boundaries and limitations. Raw frames, manifests, source, receipts and diagnostic history remain in the ignored local evidence directory.

## Review corrections and verification

Review caught two implementation defects: host could accept metadata exceeding browser envelope, and the coordinator rejected legitimate optional undefined fields. Both have regression coverage and were fixed before final proof. The host publication guard was moved after potentially substantial snapshot validation.

Initial graph coordinates used subpixel screen units and produced no visible graph. Correct world-plane lines and pixel gates fix that test defect. Later visual interpretation incorrectly suggested the surface disappeared and source order restored it. Independent PNG decoding disproved that diagnosis: original-order and reordered images are byte-identical, including 64,488 exact opaque teal pixels at identical positions. No renderer change was made; original graph-before-surface order is restored. Earlier receipts and the diagnostic reversal are preserved rather than erased. This demonstrates why objective geometry/pixel evidence must accompany model review.

Final validation passed **105 tests across 12 host/index/store/world/reconciliation/cancellation/proof files (727 assertions)**, plus strict TypeScript checks and the library build. The library full run had 1,252 passing tests and one Windows junction-permission failure; that isolated test passed with the required filesystem permission. Local HTTP smoke checks confirmed idempotent registration and invalid-path rejection with unchanged inventory. Browser initialization reported native WebGPU ready with one indexed model; lecture Start was not invoked.

## Subject and complexity coverage

The [expanded matrix](cross-subject-visual-matrix.md) separates subject reasoning, visual detail and operation complexity. Existing [eight-case screen](complexity-screen-checkpoint.md) covers algebra, multivariable calculus, probability, waves and organic chemistry, including simple 2D lines, 3,200-triangle saddle surfaces and complete 24-atom caffeine. Its failures remain part of the evidence; it did not establish a reliable speed improvement. Additional holdouts and cold/warm/mid-session trials in the matrix are planned, not completed.

The full target remains open: source-grounded model generation, suitable automatic retrieval, speech alignment, continuous readable motion and independently accepted visual quality delivered within ten seconds across those strata.

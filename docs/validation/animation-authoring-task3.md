# Task 3: strong bounded visual review

Date: 2026-10-15. Branch: `codex/animation-authoring-efficiency`. Baseline: inherited checkpoint `6d9798e` (sampler unchanged from `fba95bd`).

## Production behavior

The default is two visual review rounds: one comprehensive verification, one targeted repair when necessary, and independent verification of the repaired source. The final rejection stops before another repair. Explicit callers can request 1–5 rounds; exact repeated source hashes and a demonstrated finding surviving two repairs stop larger budgets conservatively. Finding identity uses the exact timestamp, sorted object IDs, and whitespace/case-normalized problem text; it does not infer semantic similarity or reject on cosmetic preference.

Review/rewrite protocol submissions are limited to two conversations per phase; targeted patch submissions retain their existing limit of three. At most one complete regeneration is available for invalid patch/source recovery. Spent submissions, source hashes, terminal failures and repair evidence paths survive interruption. Infrastructure failures retain infrastructure recovery. Exhausted quality/protocol work throws `RECOVERY_EXHAUSTED`, which the durable video workflow treats as terminal. The user-facing message no longer claims every failure took 50 attempts.

Context fingerprints include the input, resolved policy and author contract for both full-video and caller-owned policies. A changed policy/contract invalidates old checkpoints. Existing caller-owned lecture policy isolation and atomic writes remain intact. Generic author/editorial recovery constants are unchanged.

The evidence planner retains opening/end states, prioritizes operation and camera interiors, includes named speech cue boundaries when provided by the shared scene brief, and fills temporal gaps with hold/boundary/global samples. Exact prior finding timestamps are pinned. Plans stay within 16 timestamps and explicitly report partial coverage and omitted risks. Too many distinct known defect times terminate rather than permit an unverified approval.

All contact sheets remain in the review request. Up to two additional full-resolution native frames per rendered viewport provide readable detail; known defects take priority. Both native production viewport sizes remain 1280×720 and 960×720. Missing/empty evidence and contact-sheet/native mismatches cannot approve; prior defect evidence must exist in every provided viewport. Resumed repairs reload the saved image evidence. Approval still publishes only the independently approved exact source hash.

## Baseline and regression evidence

The read-only baseline passed 21 visual-gate/recovery/edit tests in 1.69 seconds. Seeded baseline probes showed that a short operation from 6.23–6.31 seconds had no interior sample, and the fifth camera movement from 50–50.2 seconds lost its midpoint. Before implementation, eight new regression tests failed as expected. One rejected scripted case exposed 54 patch/rewrite submissions under the previous nested limits.

Further red/green tests demonstrated and corrected protocol-budget resets across interrupted validation, missing images during resumed repair, default-policy checkpoint reuse after an author-contract change, omitted known defect evidence from alternate renderers, and missing named speech boundaries.

Initial focused validation: **38 tests passed, zero failed, 193 assertions**, covering visual gate, evidence selection, review efficiency, generic recovery and exact edits. Backend `tsc --noEmit` passed. `git diff --check` found no whitespace errors. Root owns the combined repository validation after all workstreams finish.

Reproduce from `backend/` on Windows with `TEMP` and `TMP` set to that writable directory:

```powershell
..\node_modules\bun\bin\bun.exe test ./test/visual-gate.test.ts ./test/review-efficiency.test.ts ./test/visual-evidence.test.ts ./test/recovery.test.ts ./test/visual-edits.test.ts
..\node_modules\.bin\tsc.cmd --noEmit
..\node_modules\bun\bin\bun.exe bench/review-efficiency.ts --native --output=../data/review-efficiency-20261015
```

## Benchmark results

`runReviewEfficiencyBenchmark({ directory?, native? })` is exported for the root aggregate command; direct execution is guarded by `import.meta.main`. The benchmark embeds the baseline sampler from `6d9798e`, records source hashes and raw timestamp plans, and distinguishes scripted review control flow from native rendering.

Raw run: `data/review-efficiency-20261015/result.json`. Total deterministic/native benchmark elapsed time: 5213.33 ms; this is not model latency.

| Seeded risk | Baseline interior covered | Candidate interior covered | Candidate times | Native frames | Images supplied by selection |
| --- | --- | --- | ---: | ---: | ---: |
| Brief overlap, 6.23–6.31 s | No | Yes, 6.27 s | 12 | 24 | 4 sheets + 4 native |
| Fifth camera, 50–50.2 s | No | Yes, 50.1 s | 12 | 24 | 4 sheets + 4 native |

The 48 frames were rendered by the production native WebGPU worker. Visual inspection of the overlap midpoint in both aspect ratios confirms the yellow circle fully hides the blue circle while the caption says “Two separate objects.” The fifth-camera fixture establishes sampling of the late transition; it does not itself establish a visual defect. No generated source was manually repaired for this measurement.

| Scripted host case | Review submissions | Repairs | Renders | Outcome |
| --- | ---: | ---: | ---: | --- |
| Clean | 1 | 0 | 1 | Exact source approved |
| One repair | 2 | 1 | 2 | Repaired source approved |
| Persistent rejection | 2 | 1 | 2 | Terminal; no approval |
| Malformed protocol | 2 | 0 | 1 | Terminal; no approval |

Native benchmark hashes (before the independent-review follow-up below):

- Gate source: `143bd32885f05f6f34c29177e3e5b54222f052491cad80dc38136d8735cf8d68`.
- Evidence planner: `445e14f9eb93642a6cb87dc77bb1874aef4edf72e5568034012334d530d5b048`.
- Overlap fixture: `fee41d8499bf7a3cf05c3b8e8379b3d0cd5afd6cb6ebd05b3ce7e6feca8a8b11`.
- Camera fixture: `112659baa2ec655b6453228b74cfa57e3fbe24d2ca313b88f971006a0bacd721`.

## Independent-review follow-up

Fresh review identified two concrete P2 issues. Both were reproduced before implementation, with five failing regression cases in the initial follow-up run.

1. A successful approval following one malformed response had spent both review submissions. Restarting before the generator saved its scene could incorrectly exhaust the budget. Approval now commits a self-contained receipt containing the context hash, original candidate hash, approved source bytes/hash and independent review, then persists an `approved` checkpoint phase. Recovery checks and revalidates the receipt before budget exhaustion. It can recover the repaired source if the final checkpoint transition or generator scene write was interrupted, including a missing checkpoint. A changed original source starts a fresh candidate; wrong context, wrong source hash and changed approved bytes cannot reuse approval. Legacy receipts without these identities are not treated as reusable proof.
2. A finding at `0.8` seconds could exceed the compiled sum `.1 + .7` by floating-point roundoff and leave a selected timestamp without a candidate. Evidence planning now clamps endpoint overflow only within the existing `1e-6` duration-validation tolerance, records requested and sampled times, and supplies only legal compiled timestamps. A genuinely out-of-range finding remains explicitly uncovered, preserving its requested time in diagnostics and preventing approval.

Follow-up validation: **39 tests passed, zero failed, 183 assertions** across `review-efficiency`, `visual-evidence` and `visual-gate`; backend `tsc --noEmit` passed. No native or broad test benchmark was rerun during root's active timed baseline. The raw native benchmark above remains unchanged and records its original source hashes.

## Limits and integration

Scripted reviewers prove host control flow and image delivery, not real-model defect detection, false-positive rate, or authoring quality. Native images establish the supplied sampled views, not continuous motion or interactions. Root's matched model-generation and independent visual-review experiments remain necessary for the overall architecture goal.

The two-round default can produce more honest terminal failures until first-pass authoring improves. Dense timelines still exceed bounded visual coverage; omitted-risk metadata is explicit. Additional native images increase per-review image cost, which must be measured against the avoided repair rounds. Initial approval remains one model review.

Owned changes: `visual-gate.ts`, new `visual-evidence.ts`, `video-errors.ts`, scene verification/repair prompts, visual-gate/evidence/efficiency tests, and `bench/review-efficiency.ts`. No commits or dependency changes were made by this worker.

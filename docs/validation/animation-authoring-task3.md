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

## Measured trial2 sampling follow-up

The first measured binary candidate exhausted its two-review budget honestly. Initial source `35c1923d85525c3cd88c99ab3da5b65e8353f2a3900849f78d3238bdb2687b0a` had findings at 10.275 s (superimposed comparison formulas) and 15.848 s (incoming interval crossing the outgoing equality). The first 16-sample plan omitted the equality transition at 13.8625 s. After repair, changed sample selection exposed that third defect. Its compiled tracks show a latex morph from a hidden old inequality (`from.opacity = 0`) during 13.479–14.246 s, concurrent with a fade-in on the same `compare` handle. Treating this like ordinary motion lost it to temporal spacing. Selecting the earliest motion for native detail compounded the omission.

The planner now ranks same-handle text/latex morph plus reveal first, other text/latex morphs next, then overlapping text hide/reveal, camera motion, and ordinary operation/cue samples. Overlap candidates use the actual intersection of track windows. These are inspection priorities, not automatic defect findings: no geometry, approval rule, review count or repair budget changed. Known defect timestamps still take precedence, and two slots remain reserved for temporal coverage. Native detail uses the highest semantic priorities instead of the earliest motion; opening and final states remain in all overview plans. Omitted candidate interiors and cue boundaries remain explicit.

`backend/bench/fixtures/review-transition.ts` reduces the measured scene to its relevant geometry and identical competing operation windows. Before the fix it reproduced the complete measured first-review timestamp/native plan; its new inclusion assertion failed. After the fix both the unchanged measured source and compact fixture produce the same 16 timestamps, including all three findings. The regression also verifies exact prior-defect native priority, final state, a later coverage sample, and disclosed omissions. The benchmark includes this third seed alongside the existing overlap/camera seeds.

| Initial measured source | Before priority fix | After priority fix |
| --- | --- | --- |
| Equality interior 13.8625 s | Omitted | Included |
| Native detail times | 8.812 s, final state | 13.8625 s, 10.275 s |
| Total timestamps | 16 | 16 |
| Omitted operation interiors | 4 | 2 |
| Omitted named cue boundaries | 1 | 3 |

The repaired measured source also retains 13.8625 s in the overview while its two native times remain the exact prior defects, 10.275 and 15.848 s. Replanning does not mutate either measured source or the frozen trial.

Validation: **41 tests passed, zero failed, 198 assertions** across the three focused visual review files. Backend `tsc --noEmit` passed immediately after the planner fix; the final shared-workspace check reported only concurrent `shared/animlib/src/authoring.ts:102–113` step-weight narrowing errors, handed to the owning worker. No planner or benchmark type errors were reported. Deterministic benchmark `data/review-efficiency-semantic-20261015/result.json` took 663.76 ms with `nativeRendered: false`; `measured-replans.json` in that directory records both unchanged measured sources' before/after plans. Planner SHA-256: `1d97b1336284e01d5020be94c98842bd6e516658e55c3bc4d0dfb95017f0beca`. Compact fixture SHA-256: `7d55c6c65c439b54fba2f735e35dd9bff17e8b57e773ca0e0f1740bf1d84bc5a`. All three seeded interiors are covered; the hidden equality was missed by both the inherited baseline sampler and the previous candidate sampler. Scripted host cases remain 1 review/0 repairs for clean approval, 2/1 for corrected approval or terminal rejection, and 2/0 for malformed protocol. No native rendering or external model call was performed for this follow-up. Improved real reviewer detection is still unmeasured.

## Limits and integration

Scripted reviewers prove host control flow and image delivery, not real-model defect detection, false-positive rate, or authoring quality. Native images establish the supplied sampled views, not continuous motion or interactions. Root's matched model-generation and independent visual-review experiments remain necessary for the overall architecture goal.

The two-round default can produce more honest terminal failures until first-pass authoring improves. Dense timelines still exceed bounded visual coverage; omitted-risk metadata is explicit. Additional native images increase per-review image cost, which must be measured against the avoided repair rounds. Initial approval remains one model review.

Owned changes: `visual-gate.ts`, new `visual-evidence.ts`, `video-errors.ts`, scene verification/repair prompts, visual-gate/evidence/efficiency tests, and `bench/review-efficiency.ts`. No commits or dependency changes were made by this worker.

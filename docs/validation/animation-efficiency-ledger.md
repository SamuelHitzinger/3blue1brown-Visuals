# SDD ledger — plan: docs/superpowers/plans/2026-10-15-animation-authoring-efficiency.md

## Starting state

- Active goal: all five architecture workstreams with benchmarks and continued improvement.
- Latest upstream lecture catalog verified by fetch: fba95bd, 0 ahead/0 behind.
- New branch created/pushed: codex/animation-authoring-efficiency on visuals.
- Inherited lecture work checkpointed/pushed separately: 6d9798e.
- Baseline backend typecheck passed. Frontend suite: 200 node checks plus 42 selected Bun checks passed. Review agent narrow baseline: 21 passed.
- Resource baseline: 18 passed; Windows sandbox junction creation EPERM blocks one containment fixture, not a product failure.

## Rulings

- User's explicit instruction to work on all proposed architecture tasks and use swarms authorizes implementation and parallel ownership; do not park on repeated design approvals. Design and plan remain visible and correctable.
- Work in requested new branch in current checkout, preserving inherited uncommitted work via separate checkpoint. A separate clean worktree would omit that required current work.
- Agents may mutate independent owned files concurrently; root alone commits and edits shared integration files.
- Default two visual reviews, not three: initial review plus one repair verification. Exhaustion remains honest failure, never bypass approval.
- Deterministic benchmark targets establish engineering improvements, not final visual/model quality. Native evidence remains required.

## Interface conflict review

| Tasks | Shared surface | Resolution |
| --- | --- | --- |
| 1 and 4 | timing-prelude cue type; generator/plan integration | Agent exports resolver/type; root owns plan/generator |
| 1 and 4 | reference headings/extractor | Agent coordinates new heading; root updates extraction expectations |
| 2 and 4 | runtime tools, generator/lecture callbacks | Agent owns runtime; root owns callback wiring |
| 3 and 4 | shared scene brief/review input | Root adds brief to authoritative packet; gate consumes unchanged task prompt |
| 1 | sequential authoring state vs absolute anchors | Lower in chronological order, reject overlap |
| 2 | ready metadata vs actual usable assets | Readiness only when real refs/preparation exist |
| 3 | bounded gate vs outer retries | Throw terminal RECOVERY_EXHAUSTED |
| 4 | smaller context vs required API | Preserve verbatim lookup and full fallback |
| 5 | unit success vs rendered quality | Separate evidence classes and require both |

## Progress

- All five workstreams have first-wave implementation. Independent reviews found numeric-alignment and visual-gate resume/endpoint issues; all were fixed with regressions and passed independent re-review.
- Resource work passed independent review with no findings. Root reran 68 resource/runtime checks (14,195 assertions) outside the Windows sandbox so existing hardlink/junction checks can execute. All passed.
- Deterministic source benchmark: 36–37% less timing/composition boilerplate across three equivalent fixtures, with identical compiled scenes and forward/backward state samples. Timing accounts for the gain; composition alone does not shrink these small examples.
- Catalog benchmark: top-three covers 10/10 curated supported intents, top-one 9/10, zero false capability matches. Concurrent conversion runs once; disk/new-process reuse avoids conversion. Unsupported external datasets and animated GLB features stay explicit.
- Native review benchmark rendered 48 frames across both aspect ratios. Two seeded short risk interiors missed by the prior sampler are now included. Scripted reviewers prove budgets, not real-model detection.
- Live frozen-input baseline binary-search run completed: both scenes approved on first review, 178.9 seconds total. Candidate comparison and remaining domains are pending.
- Broad backend run: 572 passed; five failures are Windows sandbox hardlink/junction restrictions. Root's elevated resource rerun covers those paths. Animlib: 1,170 passed; its one sandbox junction failure passed an elevated targeted rerun. Both workspace typechecks passed. Initial sandbox-temp import failures were resolved by workspace-local TEMP/TMP.
- After the numeric fix, root reran timing/planning/brief checks: 41 passed and one incomplete test fixture failed because its second spoken word lacked timing. Completed that fixture's actual word list; all 10 generator timing integration checks then passed. Independent fix review: three numeric regressions passed.
- Independent review-gate fix review: ten regression checks passed, including approval reuse after interruption and floating-point endpoint normalization.
- Pushed resource milestone 49890de and authoring/prompt milestone 2718b71. Next checkpoint contains the reviewed bounded visual gate and experiment harnesses.
- Completion not established. Model speed, independent rendered quality and holdout evidence remain required.

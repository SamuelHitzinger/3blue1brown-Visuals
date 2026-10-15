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
- Whole-branch review P1: immutable speech-cue resolution failures now terminate as `RECOVERY_EXHAUSTED`, preserving their cause and scene/package diagnostic artifact. A real-generator/SQLite VideoService regression failed before the fix and now proves no author call, retry wait or restart; 1 test/13 assertions passed. The successful named-cue generator case also passed (1 test/9 assertions). Focused checks only during live timing.
- Whole-branch review fix passed independent re-review and was pushed in 2a2d15e. No additional demonstrated defect was found in that review scope. Model speed/quality remains a separate open requirement.
- Live binary trial2 candidate failed after its two permitted visual reviews: 253.6 seconds and 8,421 output tokens versus baseline's successful 178.9 seconds and 5,441 tokens. The failure and raw reviews remain immutable; comparison reports no speedup for an incomplete candidate. Simultaneous formula replacement and reveal caused unreadable glyph overlap. The first sampler omitted one consequential transition at 13.8625 seconds, which the second review found.
- Second iteration responds to that evidence: weighted sequential steps inside measured cue windows remove manual substep timing; semantic text/morph risk priorities improve the same 16-frame review budget. Both changes undergo focused tests and independent review before another live run. Prior failures remain part of the record.
- Benchmark harness checkpoint 0ab53f0 adds a frozen 3D protein holdout and blinded real-model review experiment with clean controls. Neither unrun harness counts as quality or performance evidence.
- Live derivative trial2 completed: baseline 276.4 seconds / 9,962 output tokens, candidate 597.6 seconds / 21,430 output tokens. Candidate needed one visual repair for overlapping whole-formula crossfades; root confirmed the doubled notation in the saved native frame. Final approval does not establish an efficiency gain. Candidate authored source was also 30.2% larger. Both domains are included in the raw comparison report.
- Sampler iteration passed independent review against the full saved binary source plus 27 focused checks; root reran all 9 evidence-planner tests. Pushed as 000bd7e. The new weighted-step review found a partial-mutation failure on invalid later actions; owner is fixing atomic lowering before rollout.
- Blinded review trial1 finished all eight conversations without retries. Both arms accepted both clean controls and rejected the persistent count mismatch. Current evidence also exposed the brief disappearance at 6.25/6.29 seconds, which inherited sampling omitted. Root agent inspected corresponding native pixels and findings; no human adjudication or general accuracy claim is recorded. Raw results and frozen manifest are retained separately from interpretation.
- Live cost investigation isolated three narrow, already-valid candidate revisions costing 126.2 seconds and 5,756 output tokens because authors repeated full source. Candidate author prompts were already 14–17% smaller. Next measured improvement adds bounded exact edits to existing inspect_scene candidate IDs, preserving host validation, inspection budgets and complete-source fallback.
- Weighted sequential steps and atomic rollback passed two independent scoped reviews, the owner's 65 animlib checks, and root's fresh 48-test authoring run. Pushed in 6388625. Both earlier mutation probes now preserve the original state and continuation cursor. After the extra recipe, the applicable reference remains 26.51% smaller with all 12 deferred sections recoverable verbatim.
- Exact inspection edits passed independent review and 49 focused runtime/patch tests (186 assertions), plus backend typecheck. Failed edits preserve their original validated candidate; successful edits receive host validation and a new candidate ID before inspection, under the same four-call budget. Live savings remain to be measured.
- RNA baseline trial2 completed in 409.1 seconds. Each scene required its one permitted visual repair. This establishes the third frozen-domain baseline; candidate work follows on the improved revision.
- Fresh aggregate at ec2d8d9 passed all five deterministic gates in 7.0 seconds, including local native evidence. Summary is preserved in `animation-authoring-benchmark/deterministic-ec2d8d9.json`; no model or TTS calls contributed to those gates.
- Holdout preflight caught and fixed three experiment defects before its first model run: scale-dependent motion thresholds, an undeclared mesh-resolution minimum, and missing proof that the subject follows the moving assembly. The revised, declared normalized thresholds and attachment checks passed independent review and seven pure geometry tests / 26 assertions. Native review remains responsible for visible explanatory quality.

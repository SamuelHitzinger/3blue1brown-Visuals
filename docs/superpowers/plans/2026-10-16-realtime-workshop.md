# Real-time workshop implementation plan

> **For agentic workers:** Use subagent-driven development for isolated research
> components and inline integration for shared code. Do not treat this first
> experiment plan as the full user's completion criteria.

**Goal:** Establish measured model/runtime latency and faithful visual output,
then implement a continuous lecture-driven world meeting the 10-second deadline.

**Architecture:** Compare short native programs with generic operations using the
existing sandbox/compiler/renderer. Advance to hybrid persistent transactions only
when evidence supports the choice. Keep lecture synthesis off the visual path.

**Tech stack:** TypeScript, Bun, existing Pi model runtime, QuickJS, animlib native
renderer and browser player. FFmpeg for local media extraction.

**Spec:** `docs/superpowers/specs/2026-10-16-realtime-workshop-design.md`.

## Global constraints

- Deadline 10 seconds end to end; five seconds diagnostic only.
- Arbitrary subject geometry; no subject-specific answer-template library.
- Fresh blind visual comparison and complete coverage required for acceptance.
- No false priority claims, precomputed-answer latency claims, or erased failures.
- Preserve source provenance and private local media outside tracked files.
- Continue regular commits to the existing branch and `visuals` remote.

## Review focus

1. Stream boundaries, truncation and malformed output must not become committed edits.
2. Concurrent updates and corrections must not apply stale world revisions.
3. Untouched animation, camera and object identity must survive mid-motion edits.
4. Empty/partial/wrong scenes must not pass a latency result.
5. Model/asset warm-up, transcription and capture cadence must not disappear from timing.

## Task 1: Model stream measurement

Files: `backend/bench/realtime-model-probe.ts`,
`backend/bench/realtime-probe/{prompts,metrics,metrics.test}.ts`.

- [x] Add model-only CLI with explicit model/reasoning/tier and immutable results.
- [x] Test fragmented text, terminal failures and retained evidence.
- [x] Run initial actual provider calls; inspect sent and returned settings.
- [ ] Complete matched native/operation create/edit matrix and real-image probe.

## Task 2: Native runtime measurement

Files: `backend/bench/realtime-runtime-probe.ts`,
`backend/bench/realtime-runtime/*`.

- [x] Measure process-cold/warm compilation, append, replace and reactive updates.
- [x] Assert geometry/identity changes and invalid-update rollback.
- [ ] Inspect independent verification and render representative actual outputs.

## Task 3: Operation lowering and visual proof

Files: `backend/bench/realtime-probe/lower.ts`, `lower.test.ts`, plus a dedicated
probe-output verifier. Interface: `lowerOperations(text, previousFrame?) -> source`.

- [ ] Test incomplete batches, unknown operations, duplicate/missing IDs and unsafe keys.
- [ ] Lower only complete bounded transactions into native sandboxed code.
- [ ] Compile actual native/operation outputs; check command obligations separately.
- [ ] Render motion proof and request fresh blinded critical review.

## Task 4: Persistent-world runtime

Choose exact API after tasks 1–3. Required contract: revisioned atomic apply,
current-playhead sampling, uninterrupted unaffected motion, stale cancellation,
rollback and resource retention. Tests must cover each review-focus item above.

- [ ] Write failing continuity and concurrent-update tests before implementation.
- [ ] Implement generic structural edits and procedural geometry support.
- [ ] Connect streamed updates to one persistent browser renderer.
- [ ] Measure complete usable output, not only compilation or first pixels.

## Task 5: Real-media and broader evaluation

- [x] Inspect supplied lecture and acquire two official online media sources.
- [ ] Feed timestamped real audio/frames incrementally without future context leakage.
- [ ] Measure capture, recognition, model, validation, delivery and presentation separately.
- [ ] Run held-out cross-subject create/manipulate/correct sequences and burst/long-session tests.
- [ ] Obtain fresh critical blind verdicts against task-matched baseline and approved style.
- [ ] Audit every original requirement before marking the overall goal complete.

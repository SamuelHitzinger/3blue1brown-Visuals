# Animation authoring efficiency — integration evidence

Branch: `codex/animation-authoring-efficiency`, pushed to `visuals`.
Baseline: inherited lecture work checkpoint `6d9798e`, above fetched catalog `fba95bd`.

## Delivered architecture

Authors define explanatory objects, relationships and operations. Host resolves resources, binds operations to narration, validates exact source and assembles rendered review evidence.

- `s.compose` gives reusable objects scoped IDs and ordinary handles, including custom constructors. `s.schedule` resolves named speech/word/utterance/pause anchors, computes waits and weighted substeps, and pads to measured duration. Failed schedules roll back their mutations. Existing direct authoring and deterministic seeking remain available.
- One resource resolver returns actual prepared model, code or data references with hashes, provenance, capabilities and readiness. Content caching avoids repeat conversion; each job retains its own publication registration.
- Planned speech cues resolve against immutable measured word spans before authoring. Ambiguous, missing or infeasible cues fail visibly. Immutable failures terminate instead of restarting the author indefinitely.
- One shared scene brief carries claim, operations, stable objects, cues, end state, inheritance and limits. Applicable 2D prompts defer spatial API detail with exact retrieval; unknown/3D needs retain full context.
- Default review budget is one rendered review plus one repair verification. Evidence prioritizes semantic transitions, action interiors and prior defects within 16 timestamps and both aspect ratios. Exact-source approval is mandatory. Bounded candidate edits avoid repeating valid source for small inspection repairs.

## Deterministic component gates

The latest aggregate, [deterministic-ec2d8d9.json](animation-authoring-benchmark/deterministic-ec2d8d9.json), passes all five gates. These figures establish host behavior, not model speed or general visual quality.

| Target | Evidence |
| --- | --- |
| At least 30% less timing/composition boilerplate | 36.2–36.9% across three paired fixtures; compiled scenes and forward/backward samples agree |
| Compatible, fast resource reuse | Expected record in top three for 10/10 curated intents; zero false compatibility; one concurrent producer; persistent-byte reuse; separate-job registration preserved |
| Automatic measured scheduling | Exact cue spans, numeric/repeated-word safeguards, pause/reveal rules, retiming, invalid-window rejection and handoff/seek checks |
| Bounded comprehensive review | Clean/repair/reject/protocol/restart contracts; exact source receipts; no publication after exhaustion; seeded short risks included |
| At least 25% less applicable API context | 26.51% smaller 2D selection; all 12 deferred sections recover verbatim; full fallback retained |

Resource latency and unsupported routes are detailed in [task 2 evidence](animation-authoring-task2.md). Timing/composition savings are concentrated in scheduling; composition alone adds structure rather than shrinking every small scene.

## Matched live generation

All pairs use the same fixed synthetic lesson, plan, prerecorded narration, model and thinking settings. Baselines use trial2. Improved binary/derivative use trial3; RNA uses trial2. All three improved runs have identical recorded production-source hashes despite different documentation/benchmark commit IDs. No speech was regenerated.

| Domain | Baseline seconds | Improved seconds | Time change | Baseline output tokens | Improved output tokens | Token change | First review approvals |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Binary search | 178.904 | 179.266 | +0.20% | 5,441 | 5,339 | −1.87% | 2/2 |
| Derivative | 276.414 | 166.780 | −39.66% | 9,962 | 5,631 | −43.48% | 2/2 |
| RNA transcription | 409.063 | 325.809 | −20.35% | 14,502 | 11,114 | −23.36% | 1/2 |
| Sum of these three runs | 864.380 | 671.855 | −22.27% | 29,905 | 22,084 | −26.15% | 5/6 |

Every improved scene received exact-source native approval. Root agent inspected progression sheets and native final frames for all six scenes. RNA scene0 used its one permitted targeted repair; all remaining scenes passed initial review. These observations support the iteration's representative outcome, not a statistical performance guarantee. Binary time is effectively unchanged.

Authored source size changed −2.73%, −7.09% and +3.38% respectively. Generated-source reduction is therefore smaller and less consistent than equivalent-fixture boilerplate reduction. Reported output tokens include provider reasoning. Summed savings are descriptive totals over these runs, not a population estimate; model/provider variance and shared prompt caching remain uncontrolled.

Raw comparisons: [improved binary/derivative](animation-authoring-benchmark/live-trial3-vs-trial2.json), [RNA and earlier candidates](animation-authoring-benchmark/live-trial2.json).

Earlier outcomes remain retained: old binary candidate failed both permitted reviews after 253.6 seconds; old derivative completed in 597.6 seconds with 21,430 output tokens. Those failures motivated safer sequential formula transitions, better semantic evidence sampling and exact inspection edits. They are not erased or counted as speedups. Multiple changes were evaluated together, so the live comparisons do not isolate each feature's causal contribution.

## Independent review experiment

Eight blinded, fresh reviewer conversations compared inherited and current evidence on two clean/defective pairs. Both accepted both clean controls and rejected the persistent count mismatch. Current evidence also exposed a brief disappearance that inherited sampling omitted. Root agent inspected native pixels and findings; no human adjudication or broad defect-detection accuracy claim is recorded. See [review detection report](animation-review-detection.md) and its frozen manifest/raw results.

## Spatial holdout status

The first protein holdout run failed a benchmark check after scene0 received native approval. Diagnosis found a checker defect: it counted a separately published custom ribbon as another part of the pinned protein. All 46 protein primitives were present. A separate corrected assessment checks the unchanged source, actual asset bytes, saved frames and boundary; the original failed result remains immutable.

Fresh trial2 completed both scenes in 257.828 seconds with 7,591 output tokens. Rotation passed after one targeted visual repair; translation passed initial review. Both preserved all 46 pinned primitives, attached markers, exact cue windows, pause holds and deterministic reverse/repeated seeks. The turn measured 27.502 degrees; translation covered 25.84% of the displayed landmark separation with no orientation change. Retained state and camera matched exactly across the scene boundary. Root inspected both progression sheets and native final frames. One invalid author submission in scene1 was corrected before visual review.

The fixed fixture/package hashes match trial1; no acceptance threshold was weakened. This completes the novel spatial/custom-geometry/carry case. It is correctness evidence, not a baseline speed comparison. The holdout uses explicitly labeled subtitle-reading estimates, so it cannot establish acoustic synchronization. See [spatial holdout evidence](animation-authoring-holdout.md) and [raw trial2 result](animation-authoring-benchmark/holdout-trial2.json).

## Validation and limits

Component owners and independent reviewers covered source/cue integrity, rollback, carry/seek behavior, exact asset compatibility, cache/job isolation, review termination, approval reuse, candidate edits and prompt completeness. Backend and animlib suites passed their applicable checks; Windows hardlink/junction cases passed targeted runs outside the restricted sandbox. Both workspace typechecks passed. Details and counts are preserved in the [implementation ledger](animation-efficiency-ledger.md).

Scope remains deliberate: static GLBs, supported scientific construction/data packages and curated resource intents. Skeletal clips, morph-target animation, arbitrary external data ingestion and general scientific retrieval are not implemented by this resolver. Still-frame evidence cannot certify every transition, motion feel or perceptual audio synchronization. No additional asset families or unrelated production changes are required to finish this iteration.

All five declared component gates and the representative three-domain plus novel holdout acceptance are now supported. The iteration is complete within this scope; results do not promise universal speedups or flawless first-pass animation.

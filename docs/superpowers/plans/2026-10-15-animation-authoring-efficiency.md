# Animation authoring efficiency implementation plan

> **For agentic workers:** Use superpowers:subagent-driven-development. User explicitly selected parallel subagent swarms. Execute independent ownership areas concurrently; root integrates shared files.

**Goal:** Implement and measure all five animation authoring improvements without sacrificing visual explanation or custom geometry.

**Architecture:** Add composable construction and semantic scheduling to animlib, connect catalog resources to actual host preparation, assemble a shared scene brief, and improve bounded rendered review. Preserve existing renderer, VM and saved scenes.

**Tech Stack:** TypeScript, animlib/QuickJS, Bun backend, Vitest/Bun tests, native WebGPU frame rendering.

**Spec:** ../specs/2026-10-15-animation-authoring-efficiency.md

## Global constraints

- Work branch codex/animation-authoring-efficiency; push verified milestones to visuals.
- Inherited changes are isolated in checkpoint 6d9798e; never reset them.
- No new renderer, arbitrary scene network access, fabricated provenance, or unverified publication.
- Saved scenes remain self-contained. Named speech anchors resolve from measured narration.
- Every deferred API remains available verbatim through bounded reference lookup.
- Root alone commits. File ownership conflicts are resolved before mutation.

## Review focus

- Repeated spoken phrases and numeric punctuation must not silently bind to wrong words.
- Seeking backwards and handoffs must match sequential playback.
- Repeated resource requests must not reuse another job's asset registration or swallow cancellation.
- Rejected visual work must terminate through the durable workflow rather than restart indefinitely.
- Compact prompts must retain relevant APIs, scientific limitations and interaction requirements.

## Task 1: Composition and semantic scheduling

**Owner:** scene_timing

**Files:** new shared/animlib/src/authoring.ts and authoring-types.ts; types.ts/runtime.ts/compiler.ts integration; dedicated authoring tests; backend/src/agents/timing-prelude.ts and timing tests; docs/reference.md authoring additions (coordinate heading changes with root); backend/bench/authoring-efficiency.ts.

**Interfaces:** `s.compose(prefix, parts)` returns group and local handle lookup; `s.schedule(narration, beats)` consumes named/word/utterance anchors and lowers ordered beats to existing tracks. Export timing packet/cue types and `resolveSpeechCues` for parent integration. Keep existing __narration.start/end(wordId).

- [ ] Write failing equivalence and invalid-window tests, then implement host/VM parity.
- [ ] Cover custom parts, duplicate IDs, unknown cues, ambiguous phrases, overlap, pause/reveal, final duration, carry and backwards seeks.
- [ ] Produce three equivalent baseline/candidate fixture sources and report authored bytes, timing-expression counts, compile cost and sampled-state equivalence.
- [ ] Supply root integration snippet and exact named-cue type before completion.

## Task 2: Resource resolution

**Owner:** asset_resolver

**Files:** shared/animlib/catalog/types.ts; backend/src/visualization-catalog.ts; new visualization-resolver.ts; bundled-models.ts; agents/runtime.ts catalog/resolve tool registration; dedicated resolver/catalog/bundled tests and backend/bench/resource-efficiency.ts.

**Interfaces:** `resolve_visualization_resource` returns bounded structured result with readiness, true package references, provenance, limits and required input. A constructor accepts existing publishModel callback. Root wires generator/lecture author callbacks. Exact all-of capability filter extends existing search API. Recipe package refs use existing read_animlib_reference IDs.

- [ ] Write failing capability and resolution tests, including unsupported skin/clip/morph requests and missing input.
- [ ] Implement exact filters, curated intent routing, resolver and runtime tool; preserve catalog budgets.
- [ ] Cache actual bundled conversions by immutable content; test concurrent/cross-instance reuse and cancellation.
- [ ] Benchmark real discovery queries, incompatible cases, bytes, latency and actual producer counts. Report unsupported routes honestly.

## Task 3: Strong bounded review

**Owner:** review_pipeline

**Files:** agents/visual-gate.ts; new visual-evidence.ts/budget helper as necessary; video-errors.ts; scene-verify/scene-repair prompts; focused gate/evidence tests; backend/bench/review-efficiency.ts.

**Interfaces:** existing reviewGeneratedScene call remains compatible. Default two visual reviews, bounded protocol retries, terminal RECOVERY_EXHAUSTED. Sampling yields stable timestamp/reason metadata and selected native-frame evidence; up to 16 timestamps.

- [ ] First prove current missed short-action/fifth-camera interiors with seeded inputs.
- [ ] Implement bounded reviews, no wasted last repair, checkpoint-aware cycle guards and clear terminal error.
- [ ] Include exact prior defect times and readable native evidence, preserving both aspect ratios and approval source hash.
- [ ] Verify clean/repair/reject/protocol/restart cases and benchmark calls, samples and risk coverage. Distinguish mocked from real-model evidence.

## Task 4: Shared brief and focused prompt assembly

**Owner:** root

**Files:** new agents/scene-brief.ts; agents/planning.ts; authoring-reference.ts; generator.ts; lecture-visual.ts wiring; relevant assembly/integration tests.

**Interfaces:** optional ScenePlan.speechCues uses timing owner's exact type. `buildSceneBrief` derives compact acceptance/context packet from plan, narration and existing state. Focused reference selector retains core and requested advanced sections, with full lookup fallback.

- [ ] Add failing brief/selection tests: identity, cue resolution, inherited state, interactions, provenance and API recovery.
- [ ] Add planned speech cue parsing/validation and integrate resolved cues/scheduling instructions into generation without conflicting old cursor instructions.
- [ ] Wire resolver with existing publication callback and no reviewer side effects.
- [ ] Integrate focused reference selection; benchmark prompt bytes and retrieval completeness.

## Task 5: Integration, native evidence and continued improvement

**Owner:** root coordinates independent reviewers and reruns.

**Files:** backend/bench/animation-efficiency.ts aggregate command; docs/validation/animation-efficiency-2026-10-15.md; plan ledger.

- [ ] Capture inherited baseline and component benchmark results with versions/hashes.
- [ ] Review each workstream independently; repair demonstrated findings.
- [ ] Run applicable combined tests/typechecks and existing production integration tests.
- [ ] Generate matched three-domain cases and one holdout using frozen narration/settings, inspect actual native frames and timing; preserve failures.
- [ ] Compare time to approved scene, source/output tokens, retrieval and review quality. Improve failed targets; do not report deterministic savings as model speedup.
- [ ] Commit and push verified milestones; audit every spec goal before goal completion.

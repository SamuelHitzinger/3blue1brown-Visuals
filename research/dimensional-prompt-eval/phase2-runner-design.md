# Phase 2 runner reuse design (not launched)

Prepared while the nine-run matrix remains active. This document changes no active harness, production prompt, source, model setting, budget, or output. Parent review and launch authorization are pending.

## Comparison

Use the unchanged enzyme request bytes from cases.json and the exact frozen spatial prompt files. Compare two fresh complete production runs: spatial checklist moved after the installed API reference (`order-only`), and that same ordering plus one real construction specialist (`specialist`). The original spatial enzyme from phase 1 is contextual evidence, not a fresh paired control. A fresh unchanged spatial arm can be added only if the parent chooses it. An augmented specialist pipeline must be described separately from prompt-only routing experiments.

## Separate entrypoints and data

Create `phase-run.ts` as a reviewed copy of the frozen run.ts, recording the original harness SHA256 in the new manifest. Keep the current run.ts and matrix.ts unchanged. Parameterize only new code with required `--manifest`, `--cases`, `--strategy`, `--case`, and `--construction-mode`. The new manifest fixes allowed arms, exact request hashes, frozen prompt/reference/checklist/specialist/decorator hashes, runtime source snapshot, model/settings snapshot, and phase identity. No fallback to phase-1 metadata or live candidate bytes is allowed.

Create `phase-matrix.ts` to launch only manifest-listed jobs, at most two concurrently, from a manifest-specific queue-state path. Refuse existing state or result slots. Give every run a fresh UUID. Save raw artifacts under ignored `data/dimensional-prompt-eval/phases/<phase-id>/runs/<arm>/<case>/<uuid>` and logs under that phase. Save compact summaries, provenance audit, and matrix state under `research/dimensional-prompt-eval/phases/<phase-id>/`. No phase-1 convenience summary or provenance file is overwritten.

Use the current frozen production-source snapshot if it still verifies exactly. The new manifest references its digest and the phase-1 experiment id, but has a new UUID and explicit augmented pipeline boundary. Record the new harness/decorator/excerpt-selector files as additional immutable experiment inputs, and verify before each task and at completion. Never recapture changed source silently.

## Runner ordering and logging

Retain the actual `createPiGenerator` and supported subtitle mode. The call chain is generator -> exact spatial prompt substitution -> createConstructionRunner -> final-input logger/tool meter -> PiAgentRunner. The final-input logger is the sole source of model task metrics, so helper calls are counted exactly once and include their latency and tokens in total effort. Each helper gets a distinct `construction-specialist` role in addition to the production scene log context. The decorator events additionally save original/effective task hashes, role, brief, and checklist movement provenance; they do not contribute duplicate metrics.

Save every final system, user prompt, completion suffix, image hash, output, and runtime metric. Keep pre-decorator production assembly and substitution fragment counts separately, as with phase 1. Audit order-only system byte length, one exact checklist occurrence after the reference, and unchanged non-checklist bytes. For specialist, audit the identical ordering plus one bounded helper brief appended consistently to author/reviewer/repair packets. Non-spatial tasks pass through and have zero helper usage.

## Frozen helper context

Extract the authoritative scene from the freshly approved lesson, resolved narration/timing, continuity and available asset metadata; never seed a plan or hand-author geometry. Validate view mode from that approved scene, then build a bounded packet without silent truncation. Freeze an explicit generic excerpt selection manifest against the installed API reference before inference. Preserve exact excerpt bytes and offsets/hashes, check checklist/reference uniqueness, and validate structural brief output. Runtime/tool/compiler/native gate budgets remain unchanged. A failed helper or source fails the arm; no quiet fallback or raised gate limit.

## Verification before launch

1. Review the isolated copy diff against frozen run.ts and all decorator tests.
2. Run dry modes for both arms; verify request/model/source equality and separate output paths.
3. Exercise fake-runner logging to prove helper/author identity, no metric double count, unchanged planar pass-through, and correct cancellation.
4. Freeze the manifest and all experiment input hashes before the first actual call.
5. Launch only after the nine-run matrix finishes and parent authorizes the exact jobs.

Native/source failures remain measured failures and allow the queue to continue. Authentication, quota/model configuration, renderer infrastructure, or provenance drift halts new jobs. Parent and independent reviewer receive the same raw native/source evidence and stage-level effort summaries.

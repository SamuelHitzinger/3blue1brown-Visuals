# Phase 2 independent integration review

Read-only harness review, 2026-10-11. No inference, source compilation, native
rendering or production edits were performed. The notes file documenting the
current helper summary limit is the only existing research file changed here.

## Checked

- `phase-run.ts:254–262` keeps the production generator and routes each task
  through frozen substitutions, the construction decorator, then the final-input
  logger and Pi. The native visual gate and source validators remain unchanged.
- `phase-run.ts:181–210` consumes the decorator start event by final system/user/
  context fingerprint, labels the helper `construction-specialist`, and records
  final input, image hashes and the runtime completion suffix. Runtime assembly
  at `backend/src/agents/runtime.ts:138–144` uses the same completion expression.
- `phase-run.ts:216–229` collects metrics only from actual Pi requests. Decorator
  finish-event metrics are separate evidence and are not added again.
- A saved actual author prompt, baseline enzyme
  `728cd3db-221a-494d-bfa6-5cde10ab277f/task-2-scene.user.txt`, parsed successfully
  through `constructionContext`, including its host `__narration` instructions.
  Deep equality against `scene-0.input.json` confirmed preservation of request,
  planning, narration scene and model assets. The approved per-scene mode was
  `3d`, and the helper packet contained 26,770 characters.
- Fresh per-arm UUID/output roots prevent saved scene reuse. Model, thinking,
  subtitle/timing, preview and execution settings match the frozen baseline.
  The phase wrapper is scoped to one complete job, not the production singleton.
- `phase-prepare.ts` freezes the new adapter/prompt/excerpt selector/harness inputs
  and source/settings identities. Inference requires a frozen manifest and all
  nine prior runs to be terminal; dry mode does not invoke a model.

## Findings sent to harness owner before freezing

1. `phase-provenance.ts:18–22` initially treated absent metrics and unreported
   reasoning tokens as zero. Expose missing coverage or null rather than present
   an unknown effort as measured zero. Reasoning remains a subset of output.
2. `phase-verify.ts:33` initially verified only tasks with a present construction
   task ID, and did not inspect pending-event count. Require correct construction
   IDs/roles for recorded spatial author/review/repair tasks, and no pending
   events on completed runs. Otherwise a missing event could leave an ordering
   arm with falsely passing provenance.
3. `phase-prepare.ts` should explicitly compare the original cases file to
   `formal-experiment.json.casesSha256` before claiming the request is unchanged.
   Current bytes match; this closes a future stale-input acceptance path.

The 128-element previous-frame summary limit remains deliberate for the current
single-scene phase. It is not suitable for a later large-structure multi-scene
held-out test or production. A future explicit semantic summary may retain core
carried/shared IDs, poses and group relationships plus total/omitted counts and
the complete-frame hash; the author must retain the full frame. That policy
requires a new frozen experiment, not silent truncation or reduced fidelity.

Follow-up: all three findings were corrected before freeze and independently
rechecked. Effort now carries coverage and null for missing totals/reasoning;
the verifier requires spatial task role/identity and no pending completed-run
events; preparation checks the original cases against the prior formal hash.
The four focused research test files pass (26 tests), and strict TypeScript
checking passes for the phase harness, helpers and their tests.

Status: no remaining substantive integration issue found for the current
single-scene phase. Refresh and review the manifest/dry-run hashes after these
changes. This document does not authorize launch or establish visual benefit.

# Progressive Animation Implementation Plan

> **For agentic workers:** Use test-driven development for each owned slice. User approved implementation; proceed in this chat with delegated runtime/protocol work and root-owned integration.

**Goal:** Show supported setup before all facts arrive, then update motion and native geometry without rebuilding unrelated programs.

**Architecture:** Extend the existing retained world with host-timed constant velocity and transactional program replacement. Add opt-in strict tool branches, retain legacy schemas, replace conflicting live prompt instructions, and carry new operations through the existing browser dispatcher and journal.

**Tech Stack:** TypeScript, Bun tests, QuickJS scene compiler, native WebGPU viewer.

**Spec:** `docs/validation/progressive-animation-prompt.md`

## Constraints and boundaries

- Unknown velocity does not mean zero; create supported static setup without asserting rest.
- Model supplies semantic velocity in declared display coordinates; host owns actual commit time and pose.
- Replacement preserves original program epoch and compatible host state; unrelated programs never restart.
- New native source remains available for custom geometry/topology. Existing world camera/audio/input restrictions remain explicit; this work does not claim complete baseline parity.
- No unvalidated streamed argument publication, no automatic provider retries, no future facts in prefix tests.
- Use current branch, exact-file commits and approved `visuals` remote.

## Review focus

Late updates after authored duration; stale/cancelled preparation; duplicate/foreign/tombstoned IDs; ownership conflicts on bound properties; corrections versus new physical events.

## Tasks

- [x] Runtime: first write failing tests in `backend/bench/realtime-world/progressive.test.ts`; implement `setMotion(WorldMotionPatch, time, options)` and `replaceProgram(ProgramRequest, time, options)` in `world.ts`. Verify actual commit anchoring, speed changes, stop/restart, attachments, expiry, ownership, rollback and resource cleanup.
- [x] Protocol: first failing tests in `realtime-tool-probe.test.ts`; add default-off `progressiveWorld` option and strict `motion`/`replace` branches. Preserve all prior schema hashes when disabled. Test malformed/mixed branches, receipt agreement and adapter propagation.
- [x] Integration: failing dispatcher/journal/context tests; route the new operations, retain exact history and bounded motion state. Replace live prompt contradictions, enable progressive schema in the live caller, preserve measured speech/deadline checks.
- [x] Proof: run the cube-prefix sequence and custom-geometry replacement through real compiler/world/dispatcher; render in browser. Run new model prefix tests using only synthetic evidence and generated scene state, preserving failures and requested/actual configuration.
- [x] Verification: focused regressions, strict targeted TypeScript, independent review, evidence report, exact-file commits and pushes. Report any remaining capability or performance limits.

## Outcome

Implementation and planned verification completed. See ../../validation/progressive-animation-checkpoint.md for two preserved model runs, measured timings, and scientific-quality failures. Completion of this implementation slice does not establish full baseline parity or general visual correctness.

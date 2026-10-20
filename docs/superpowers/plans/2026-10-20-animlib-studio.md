# Animlib Studio Implementation Plan

> Execution: inline using executing-plans, with test-driven development and final review.

**Goal:** Merge Desmos Studio's persistent direct-authoring workflow into animlib.
**Architecture:** Adapt local capability/SSE transport; browser owns existing
LiveWorld and CanvasRenderer. A small controller lowers declarative scenes and
sequenced cues into existing atomic world operations.
**Tech stack:** Node ESM, TypeScript, Vite, existing QuickJS/animlib, Bun tests.
**Spec:** `docs/superpowers/specs/2026-10-20-animlib-studio.md`.

## Constraints and review focus

- No Desmos runtime or network dependency, no new package dependencies.
- Preserve existing renderer/compiler restrictions and video generation gates.
- Handle stale revisions, duplicate renderer ownership and unknown outcomes.
- Reject malformed/oversized cues without partial mutation.
- Replay interruption and pause without restarting native clocks.
- Persist commits even when optional verification fails.
- Do not infer semantic correctness from a changed screenshot.

## Tasks

### 1. Compact scene authoring and retained session controller

Files: `plugins/animlib-studio/src/{scene,session}.ts`,
`plugins/animlib-studio/tests/session.test.ts`.

- [x] Write tests for scene construction, patch preserving IDs/motion, interrupted
  interpolation, stale sequences/revisions, atomic failures and paused replay.
- [x] Run tests and establish missing-feature failure.
- [x] Lower primitives/recipes to sandbox source; implement serialized session
  operations, virtual clock, bounded cue queue and event checkpoint replay.
- [x] Run focused tests against real LiveWorld, not mocked geometry.

### 2. Plugin transport, browser renderer and packaging

Files: `plugins/animlib-studio/src/{bridge,server,tools}.mjs`,
`plugins/animlib-studio/web/*`, `plugins/animlib-studio/scripts/*`,
plugin manifest/MCP configuration, `tests/transport.test.mjs`.

- [x] Test capability checks, duplicate viewer leases, timeout semantics and
  checkpoint validation.
- [x] Port transport from the supplied plugin with source attribution.
- [x] Implement explicit MCP schemas and bounded help; build renderer with Vite.
- [x] Couple command results to persistence and optional verification/PNG.
- [x] Validate package build and MCP stdio discovery.

### 3. Live validation and workflow documentation

Files: `tests/live.mjs`, plugin README/skill, root scripts,
`docs/validation/animlib-studio-*`.

- [x] Launch actual browser, run RPC create/scene/patch/flow/verify/reconnect.
- [x] Inspect 2D and 3D PNGs; benchmark patches against source replacement.
- [x] Run regression checks for retained world and authoring APIs.
- [x] Review changes, record limitations and exact measured evidence.

## Ledger

- Clean base: `6982449`; new branch created successfully.
- Architecture reuses existing retained world rather than duplicating animation.
- Branch-local edits only; supplied plugin remains untouched.
- 91 retained-world/studio, 62 authoring and 4 transport tests passed.
  Vitest needed workspace-local TEMP/TMP to avoid Windows sandbox temp imports.
- Production viewer and plugin typecheck passed; existing library bundle warnings
  remain documented. No dependency installation or upgrade.
- Real MCP/WebGPU checks passed, including two-process routing, 2D/3D pixels,
  bundled verification, interrupted flow, exact revisions and paused reconnect.
- Review found four concrete defects; all reproduced, fixed and reviewed again.
  Late-result regression failed against the old bundle and passed after rebuild.
- Full MCP benchmark: patch median 3.72 ms versus replacement 35.85 ms, 12 paired
  samples. Arguments 107 versus 265 bytes. Model generation excluded.
- Standalone package candidate verified: 21 file hashes, 14 tools, viewer served
  from portable package. Final package is generated from the committed branch.
- Ruling: source plugin is a separate repository. Adapt its transport and retain
  provenance instead of merging unrelated Git histories or copying Desmos APIs.
- Ruling: renderer leases are process-local as in the source plugin. Peer routing
  detects active duplicates; manually opening one saved session across separate
  servers remains explicitly unsupported.

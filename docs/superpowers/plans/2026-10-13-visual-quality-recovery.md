# Visual quality recovery implementation plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task by task.

**Goal:** Restore the requested intuition-first, accurate and navigable 3D lesson improvements on latest main in SamuelHitzinger/3blue1brown-Visuals, prove clean-checkout behavior and merge only after CI and visual checks.

**Architecture:** Preserve main's prompt consolidation, direct manipulation and persisted recovery. Restore the previously reviewed application delta from b6df259 to 078cd9c, excluding generated bundles for rebuilding; keep unrelated dimensional research out. Fix demonstrated defects at their owning layer.

**Tech stack:** TypeScript, Bun backend, animlib/QuickJS/WebGPU, React/Vite, GitHub Actions.

**Spec:** User requirements recorded in this chat; previous preference reports restored with the application delta.

## Constraints and review focus

- New main starts at 90e8a8d; original repository is not modified.
- No dependency on ignored local directories, caches or package links.
- Molecular identity, coordinates/topology and element colors remain source-derived; coarse models are identified honestly.
- Rotation/pan/reset keep screen explanations fixed and referent labels attached.
- Preserve main's 50-round checkpoint recovery and direct manipulation.
- No automatic deployment to inherited production host from this new repo; deployment requires explicit configuration.
- Test actual generation and rendered evidence against prior iterations, not only source declarations.

## Tasks

- [x] Install from lockfiles in managed clean worktree; build and baseline tests.
- [x] Restore application delta and rebuild bundles; preserve latest README.
- [x] Fix molecular test fixtures using OS temporary directories. Reproduce before/after from empty cwd; audit other tests for same dependency.
- [x] Add destination deployment opt-in and document it; validate deployment configuration.
- [ ] Run complete local gates and fresh Linux CI on a review branch.
- [ ] Run bounded real production generation with fresh plans, asset publication, native render review and retained evidence. Compare with prior approved cases; inspect navigation and molecular fidelity.
- [ ] Independent final review, resolve findings, rerun affected gates, merge PR into destination main and verify remote result.

## Evidence ledger

- Source latest main: 90e8a8d0308b25700062561ce79d73885754fe98.
- Previous merge was accepted by Git but failed CI; PR #112 reverted it. All six molecular tests reproduce ENOENT in empty cwd because mkdtemp used a missing .aha parent.
- Destination existed empty/public and was initialized with source main, preserving history and existing visibility.

- Clean baseline: 1064 animlib, 295 backend and 74 frontend tests passed. Restored version: 1105 animlib, 333 backend and 84 frontend tests passed, with typechecks/application/demo builds.
- Molecular regression: clean worktree 0/6 before fix, 6/6 after replacing missing .aha parent with OS tmpdir. All other backend mkdtemp calls already use OS temp roots.
- Linux deployment configuration tests cannot be interpreted on Windows (POSIX absolute paths and mode bits); require Ubuntu CI before merge. Docker daemon unavailable locally.
- User explicitly approved sending request, repository prompts, asset metadata and generated context to OpenAI Codex for fresh pipeline validation.

# Animation Library Expansion Implementation Plan

> **For agentic workers:** Use subagent-driven development. Read this plan and
> `design.md`; root assigns nonoverlapping file ownership before each task.

**Goal:** Add reusable, evidence-grounded animation capabilities and prove them
against the user's references through independent rendered comparison.

**Architecture:** Preserve existing compiler/renderer. Add bounded host asset
preparation, modular scene helpers, and renderer features justified by evidence.
Separate artist contracts and proof scenes from generic library code.

**Tech Stack:** TypeScript, QuickJS, WebGPU, WebGL2, Vitest, Vite, native render tools.

**Spec:** `docs/animlib-expansion/design.md`.

## Global constraints

- Stay on `amilibsam`; no push/merge into `main`.
- Every delegated agent: `gpt-6-astra`, reasoning `high`.
- Three active workers maximum alongside root; use sequential waves and direct messages.
- Root serializes integration and git commits; no worker stages other workers' files.
- Existing source baseline: `2b666eb`; initial tree clean.
- Maintain source/artifact provenance and honest inspection coverage.
- Do not equate technical tests or schematic coverage with reference fidelity.

## Review focus

- Arbitrary and backward seeks must reproduce playback states, including exports.
- Imported malformed/oversized data must fail before resource allocation escapes budgets.
- Helpers must preserve identities, geometric invariants, and meaningful color roles.
- Shared assets and retained geometry must have bounded lifetime and deterministic reuse.
- WebGPU/WebGL2 changes need actual visual parity and fallback checks.

## Task 1: Reference requirements

Files: `molecular-reference.md`, `math-algorithm-reference.md`,
`neuroscience-quantum-reference.md` in this directory.

- [ ] Inspect actual videos/complete frames and record precise coverage.
- [ ] Map observed needs to existing APIs, explicit gaps, and measurable proof criteria.
- [ ] Review proposed boundaries together; root records implementation task briefs.

## Task 2: Asset and library organization

- [ ] Assign dedicated architecture/asset worker after reference wave.
- [ ] Specify validated native model/texture reuse interfaces from observed needs.
- [ ] Write failing import, reuse, invalid-input, and budget tests; implement and verify.
- [ ] Add source/license manifest and reusable original or properly licensed fixtures.
- [ ] Independent code review; repair substantive findings before acceptance.

## Task 3: Domain capabilities and motion proofs

- [ ] Assign separate mathematical/algorithmic and molecular/scientific workers.
- [ ] Pin exact APIs and owned files in task briefs before implementation.
- [ ] Write invariant and seek tests; implement helpers using existing scene machinery.
- [ ] Write artist-specific style contracts and render 3–8 second motion proofs first.
- [ ] Independent direct comparison; iterate before expanding representative demos.

## Task 4: Optimization and integration

- [ ] Audit export retained-time evaluation and fix with regression proof if confirmed.
- [ ] Benchmark compile/seek/render/asset reuse and address evidenced bottlenecks.
- [ ] Update public API/capability documentation, preserving explicit limitations.
- [ ] Run integrated tests, typecheck, builds, and affected renderer checks.

## Task 5: Evaluation

- [ ] Fresh code/architecture review checks whole change against requirements.
- [ ] Separate visual evaluator inspects reference and finished demos, including motion.
- [ ] Resolve substantive findings and rerender affected proofs.
- [ ] Record per-reference capability verdicts and remaining gaps without inflated claims.
- [ ] Commit reviewed changes on `amilibsam` and provide reproducible demo entry points.


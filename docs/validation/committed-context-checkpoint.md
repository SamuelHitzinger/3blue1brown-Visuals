# Exact committed context checkpoint

2026-10-16. The joined lecture client now retains exact committed source and
patches, with run-scoped evidence references. This addresses a concrete gap in
the [first joined run](lecture-join-checkpoint.md): subsequent requests saw object
types and poses but could not inspect what existing labels or actions said.
Whether this improves model decisions or visual quality remains untested.

## Implemented boundary

One journal lives as long as the retained world, across source runs. Entries are
recorded synchronously after successful world publication, including publication
whose subsequent rendering fails. Deferrals and failed preparations are absent.
Renderer submission is tracked separately; semantic completion stays `unknown`.
Evidence corrections do not undo previously committed geometry.

Storage is bounded to 64 operations and 256,000 characters. Request snapshots
include whole exact operations only, with explicit omitted revision ranges.
They respect the remaining 60,000-character world budget and 120,000-byte UTF-8
request budget, including the request envelope. Oversized operations remain
opaque instead of becoming truncated executable source. An impossibly small
budget fails before dispatch. Complete global history does not constitute a
semantic explanation or a per-program dependency proof.

The common native API prompt also documents existing `surface` and
`parametricSurface` constructors, action scheduling and fixed-topology callback
constraints. This introduces no new engine API or subject-specific template.
Earlier complexity prompts already exposed surfaces; their quality failures
cannot be attributed solely to missing API documentation.

## Local evidence

- Focused verification: **93 tests, 688 assertions, zero failures** across the
  journal, joined transport, strict tool submission, causal events/replay and
  retained-world contracts. Targeted strict TypeScript checking passed.
- Native QuickJS/LiveWorld smoke: a 40×40 saddle has 1,681 vertices and 3,200
  triangles satisfying its supplied equation. A parametric plane and scheduled
  rigid translation preserve geometry at six samples. Unscheduled actions do
  not execute; a callback changing vertex count is rejected atomically.
- Restoring one historical committed operation increases its world description
  from 1,113 to 2,239 characters while preserving source exactly.
- A synthetic 64-record serialization load retained 16 complete records and
  explicitly omitted 48 under its output budget. Twenty local measurements had
  median **0.711 ms**, maximum **2.608 ms**. These measure serialization only,
  not provider latency, live presentation, reliability or quality.

[Sanitized measurements](committed-context-local-results-2026-10-16.json) contain
the exact audit parameters and source hashes. Raw offline artifacts reside in
ignored `data/realtime-workshop/committed-context-local-02/`. The browser reached
`Ready · webgpu` after restarting its development server; no new lecture/model
run was started. Its screenshot proves readiness only.

## Pending model comparison and broader acceptance

Two historical comparison payloads were prepared locally under
`data/realtime-workshop/committed-context-probe-01/`, without provider calls.
Automatic approval review rejected their upload because the earlier frame
approval did not clearly cover exporting generated JavaScript and project scene
state to OpenAI. Explicit approval for these additional payloads is pending.
The prepared candidate uses a prototype journal schema, not the final integrated
schema; any future result must retain that distinction. Reused historical input
also cannot establish live source-to-presentation timing.

The [complexity protocol](complexity-matrix-protocol.md) remains the acceptance
boundary: subject reasoning, visual detail and change workload are separate
axes. Matched pairs must preserve data, claim, camera, motion and reading hold.
Detailed surfaces and full molecular topology each need their own quality gate.
Simple 2D success cannot compensate for a failed 3D scene. Controlled detail-only
pairs, unseen subjects and full-motion parity remain outstanding.

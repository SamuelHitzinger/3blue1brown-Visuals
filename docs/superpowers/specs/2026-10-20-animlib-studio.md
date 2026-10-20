# Animlib Studio integration

## Outcome and authorization

User requested a new branch combining the Desmos Studio plugin's efficient
authoring workflow with the animation-authoring-efficiency branch and our own
animation library. Work starts at `6982449` on
`codex/animlib-studio-integration`. Source reference:
`C:/Users/samue/Documents/Codex/2026-10-19/ma/outputs/desmos-studio`,
commit `13544c8` (0.6.0). Do not modify the source plugin.

The requested overhaul authorizes implementation; design and plan stay reviewable.
No publishing, installation into user plugin configuration, paid generation, or
changes to existing video approval gates are needed.

## Architecture choice

Reuse the plugin's persistent session / SSE / capability / serialized command
transport, adapted for animlib. Reuse existing `LiveWorld`, `SourceCompiler`,
`CanvasRenderer`, timeline, palette and property validation. Add a standalone
local plugin under `plugins/animlib-studio`. A browser keeps the actual renderer
warm. MCP tools send compact operations, not new HTML or whole scene source for
every edit.

Alternatives: embedding Desmos would lose animlib behavior and require its API
service; rewriting LiveWorld would duplicate ownership and atomicity logic.
Neither serves the requested integration.

## Authoring contract

Explicit session IDs; create/list/help; structured scene creation with stable
object IDs and recipes; patch existing properties; add/replace custom animlib
programs in the existing sandbox; numeric parameters and constant velocity;
sequenced, bounded flow cues; pause/resume; inspect and verify with optional PNG
preview in the same call. No arbitrary browser JavaScript execution.

Structured primitives lower to existing scene constructors. Recipes demonstrate
2D and 3D geometry; custom sandbox source retains access to the current library's
broader construction and authoring APIs. LaTeX expression translation and
Desmos-specific calculator/account APIs are not part of this integration.

All edits preserve untouched programs and channels. Revisions detect stale
updates. Flow cues use LiveWorld's existing interpolation. Interrupt starts from
current visible pose; append keeps chronology. Sequence numbers reject stale
packets. Acceptance, frame submission, requested invariant checks, persistence,
and semantic quality are distinct statuses.

## Persistence and error behavior

Atomic checkpoints contain bounded command history and virtual playhead.
Reconstruct through the same sandbox on reconnect and restore paused. Refuse
history overflow before applying mutations. Preserve unknown-outcome reporting
on transport timeout; never retry a mutation automatically. Renderer leases
reject duplicate tabs and stale checkpoint writes. Bind loopback, validate Host
and Origin, require capabilities, serve only built assets.

## Evidence

Tests exercise actual LiveWorld geometry, interruption, atomic invalid edits,
sequence validation, stale revisions, persistence replay, transport auth and
renderer ownership. Live browser tests go through HTTP RPC and actual bundled
renderer, inspect PNG pixels, exercise 2D/3D and report warm end-to-end latency.
Paired patch versus source-replacement timings isolate authoring overhead.
Report cold startup separately; no claim about total model generation speed
without a model experiment.

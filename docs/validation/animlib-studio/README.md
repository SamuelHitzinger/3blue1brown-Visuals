# Animlib Studio integration evidence — 2026-10-20

Branch: `codex/animlib-studio-integration`, based on animation authoring efficiency
at `6982449`. Source transport reference: Desmos Studio `13544c8` / 0.6.0.

## Measured result

The live test uses actual stdio MCP calls from a separate Node process, registered
loopback runtime, bundled QuickJS compiler, native WebGPU renderer and atomic
checkpoint writes. Separate warm worlds receive equivalent geometry updates;
alternating patch/replacement order reduces ordering bias. Both final states
are verified numerically. Twelve samples per arm:

| Metric | Retained property patch | Whole program replacement |
| --- | ---: | ---: |
| Median complete MCP call | 3.72 ms | 35.85 ms |
| p95 (12 samples; observed maximum) | 5.67 ms | 40.09 ms |
| Serialized arguments | 107 bytes | 265 bytes |

Approximately **9.6× lower median update latency** for this small scene;
arguments are **59.6% smaller**. Raw samples and other timings are in
`results.json`. This isolates local authoring overhead. It excludes model
generation, narration and semantic visual review; it does not establish a
tenfold speedup for end-to-end video production. No paid model experiment ran.

Native `2d.png` and `3d.png` were inspected: expected colored geometry appears,
with shaded spheres and connected bonds in the 3D schematic. Pixel checks
confirm nonempty native rendered output. The molecular example is illustrative,
not a scientific simulation.

## Regression coverage

Core tests use real QuickJS/LiveWorld: stable object edits, retained motion,
atomic invalid edits, stale revision/sequence rejection, interruption,
paused checkpoint replay, native recipes, verification failure reporting,
flow ownership rejection, idempotent resume, append chronology, and existing
composition/cue-scheduling authoring APIs.

Transport checks cover capability and origin enforcement, duplicate renderer
leases, stale checkpoint leases, timeout unknown outcomes, caller-controlled
identity rejection, and reading the newest checkpoint across server processes.
The live test covers MCP session reuse, native 2D/3D rendering, bundled
verification/preview, interrupted flow, current revision reporting, failed
verification preserving committed/saved state and paused reconnect.

`tests/timeout.mjs` deliberately delays a browser result past its server deadline.
Old bundle failed by disconnecting the viewer; fixed bundle retains the renderer
and allows inspection after the unknown outcome.

Independent review found four defects before completion: stale cross-process
checkpoint cache, invalid flow admission replacing queued work, expired result
replies closing SSE, and stale revisions in flow responses. Each was fixed and
covered by regression evidence.

Final focused checks: **91 retained-world/studio tests, 62 authoring tests and
4 transport tests passed**. TypeScript and production viewer builds passed.
Portable-package smoke verified all 21 packaged file hashes, 14 MCP tools and
standalone viewer delivery. A separate verifier regression rejects missing
expected values instead of falsely passing absent geometry fields.

## Reproduction

Run repository `npm run studio:build`, then:

```powershell
node_modules/.bin/bun.cmd test plugins/animlib-studio/tests/session.test.ts backend/bench/realtime-world/
node --test plugins/animlib-studio/tests/transport.test.mjs
node_modules/.bin/tsc.cmd -p plugins/animlib-studio/tsconfig.json
node plugins/animlib-studio/tests/live.mjs
node plugins/animlib-studio/tests/timeout.mjs
```

Use `STUDIO_CHROMIUM` to select another local Chromium executable. Browser
background throttling applies; reconnect readiness checks bring the tested tab
to the foreground before waiting for its animation-frame-based readiness probe.
Build warnings concern the existing large animation-library chunk and
browser-excluded NodeIO modules; native browser checks exercise the shipped bundle.

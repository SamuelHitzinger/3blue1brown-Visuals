# Animlib Studio

Desmos Studio's persistent, compact authoring workflow, running **our animlib**
instead of the Desmos calculator. One warm browser owns `LiveWorld`,
`SourceCompiler` and `CanvasRenderer`. MCP edits operate on retained objects;
ordinary changes avoid recompilation and whole-source regeneration.

The integration starts from animation-authoring-efficiency commit `6982449`.
Transport/session routing derives from the supplied Desmos Studio 0.6.0,
commit `13544c8`; its source remains untouched. No Desmos SDK, key or service is
used. Existing Aha narrated-video generation and its approval gates remain
available through the Aha video plugin.

## Run from this repository

```powershell
npm run studio:build
npm run studio:start
```

Requires existing repository dependencies and Node 22+. Server prints its
runtime file path. `ANIMLIB_STUDIO_HOME` selects private session storage;
`ANIMLIB_STUDIO_PORT` optionally pins the loopback port. Default data directory:
`~/Documents/Codex/AnimlibStudio`. No paid model or TTS calls occur.

## Build portable plugin

```powershell
npm run studio:package
codex plugin marketplace add ./dist/animlib-studio-local
codex plugin add animlib-studio@animlib-local
```

Packaging uses a fresh destination and refuses overwrite. Pass a different
absolute destination to `node plugins/animlib-studio/scripts/package.mjs`.
Portable plugin contains built viewer, native compiler WASM, Node transport and
skill; no repository checkout or npm installation is needed at runtime.
Reload plugins/start a fresh chat after installation to load MCP tools.

## Authoring

`animlib_sessions` → reuse intended session, otherwise `animlib_create` and open
returned viewer URL. Use `animlib_help` for bounded schemas and examples.

```javascript
// One call creates native geometry, verifies its radius, and returns native PNG.
animlib_scene({
  sessionId,
  scene: {mode:"2d",objects:[
    {id:"ball",type:"circle",props:{radius:0.5,fill:"BLUE"}}
  ]},
  verify:{checks:[{id:"ball",property:"radius",expected:0.5}]},
  preview:true
});
// Existing object; no recompile.
animlib_patch({
  sessionId,
  changes:[{id:"ball",props:{position:[2,0,0],fill:"TEAL"},duration:0.35}]
});
// Local interpolation; no per-frame chat round trips.
animlib_flow({
  sessionId,source:"lecture",sequence:1,
  cues:[{id:"return",durationMs:700,
    changes:[{id:"ball",props:{position:[0,0,0]}}]}]
});
```

Primitive constructors: circle, sphere, rectangle, box, line, arrow, path, text,
LaTeX and mesh. Recipes: schematic orbit, water molecule and sine wave.
`animlib_program` accepts native sandbox source for custom geometry and
animlib's existing authoring/scientific APIs. `animlib_replace` updates structural
source while retaining compatible host overrides and original epoch.
`animlib_parameters` and `animlib_motion` retain continuous behavior.

Tools also expose inspect, verify, pause/resume/cancel and cross-process runtime
connect. Optional `baseRevision` rejects edits based on stale state.

## Interactive viewer

Reactive native sliders appear automatically below the canvas, with their
authored labels and ranges. Dragging updates the retained scene without a
recompile; the status bar shows local edit latency. The latest pointer value
wins when inputs arrive faster than rendering. MCP changes update these same
controls.

For 3D scenes, drag the canvas to orbit. Shift-drag (or right-drag) pans; the
mouse wheel zooms. **Reset view** restores the authored camera. With the canvas
focused, arrow keys orbit, `+`/`-` zoom, and `0` resets. Sliders also support
standard keyboard navigation. Camera exploration is local to this viewer;
parameter values are checkpointed and restored on reload.

## Guarantees and limits

- Existing LiveWorld validates atomic patches, object ownership, resources and
  sandbox output. Unsupported properties fail before publication.
- Source IDs must be unique across this studio session. First program chooses
  mode/camera. LiveWorld restrictions include audio, behaviors, animated views,
  cross-program attachments and interpolated edits of callback-owned properties.
- Flow defaults to interrupt; append schedules after previous cues. At most 128
  pending cues, 128 sequence sources, 256 changed objects per cue. Durations
  0–60 seconds. Cues over one second late are skipped and reported. Browser
  throttling means this is not a hard realtime scheduler.
- Checkpoints record at most 512 mutations/2 MB. Start a new session when full.
  Consecutive parameter updates to the same program compact into bounded
  batches, so continuous slider dragging does not consume one record per frame.
  Replay runs the same sandbox at recorded virtual times and restores paused.
  Revisions are local to a renderer and may rebase after compacted replay;
  inspect after reconnecting before supplying a new `baseRevision`.
  Pure deterministic callbacks are required, as in LiveWorld. No undo UI.
- Numeric checks sample now; they do not wait for a transition endpoint.
  Acceptance, renderer submission, checks and semantic quality are separate.
  Failed optional checks do not undo committed changes. Save failures explicitly
  return applied-but-unsaved state.
- One renderer lease per session/server. HTTP binds `127.0.0.1`, checks Host and
  Origin, and requires capabilities. Keep runtime files/viewer URLs private.
  Timeout after dispatch means unknown outcome; inspect before retrying.
  Avoid manually opening the same saved session in independently running servers:
  leases are process-local. Tool routing rejects detected active duplicates.
- Keep viewer open. Cross-process connection reuses an existing viewer without
  building another runtime. A fixed port keeps saved viewer URLs stable after
  server restart; otherwise obtain the new URL through sessions.

## Validation

```powershell
node_modules/.bin/bun.cmd test plugins/animlib-studio/tests/session.test.ts
node --test plugins/animlib-studio/tests/transport.test.mjs
node_modules/.bin/tsc.cmd -p plugins/animlib-studio/tsconfig.json
node plugins/animlib-studio/tests/live.mjs
```

Live checks use local Chromium and real WebGPU/QuickJS. Set `STUDIO_CHROMIUM`
to an executable if Playwright's local Chromium is unavailable.
Evidence: `docs/validation/animlib-studio/results.json`, `2d.png`, `3d.png`.
Measurements distinguish warm transport/render/checkpoint time from model
generation. They are local observations, not latency guarantees or evidence
that complete narrated-video production is faster.

---
name: animlib-studio
description: Create or edit persistent interactive animations with the Aha animation library through Animlib Studio. Use for direct scene authoring, compact edits, live sequenced cues and native previews. Narrated video generation uses the existing Aha video workflow.
---

# Animlib Studio

Use `animlib_sessions` to find the intended viewer; keep its explicit session ID.
Create a session only when needed and open its returned `viewerUrl`. That browser
owns the actual animlib GPU renderer. Keep it open. `animlib_connect` registers
another local server by its returned absolute runtime file path.

## Fast authoring

- Add structured geometry with `animlib_scene`, or arbitrary native sandbox
  source with `animlib_program`. Built-in recipes are optional schematic seeds.
- Edit existing IDs with `animlib_patch`. Change only requested properties so
  untouched animation continues. Set `duration` in seconds for interpolation.
- Use `animlib_parameters` for declared reactive controls and `animlib_motion`
  for retained constant velocity. Replace source only for structural changes.
- Submit several chronological changes with `animlib_flow`; each cue uses
  milliseconds. Increment `sequence` per source. Interrupt replaces pending
  cues and rebases changed properties when the new cue starts. Append preserves
  chronology. No per-frame model/tool loop.

Read `animlib_help` for the relevant topic (`scene`, `program`, `flow`,
`verification`) when exact schemas are needed. Ordinary edits need no shell,
repository reads or browser automation.

Bundle optional `verify:{checks:[...]}` and `preview:true` with an edit.
Verification samples current state; an accepted tween need not have reached its
endpoint. Use meaningful invariants and inspect previews for new visual
semantics. Avoid redundant screenshots after required checks passed.

## Runtime boundaries

Source runs in existing bounded QuickJS, not browser JavaScript. Native animlib
composition, scheduling and scientific constructors remain available, subject
to live-world restrictions: no audio, behavior controls, animated camera/views,
or cross-program attachments. First program sets camera/mode. Time callbacks
stop at authored duration. Parameter-owned properties use parameter updates.

Reconnections replay recorded operations and restore paused; resume explicitly.
`cancel` removes pending cues; `pause` also freezes active motion. Session limits
are returned by help. A timeout after dispatch has unknown outcome: inspect
before deciding on another edit, never automatically retry.

Report `persistence.saved:false` as applied but unsaved. Numeric verification and
renderer submission do not prove scientific correctness or semantic quality.
Local tool timings exclude model generation. Do not claim end-to-end authoring
speed from those timings alone.

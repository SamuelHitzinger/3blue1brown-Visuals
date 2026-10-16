# Retained numeric parameters for lecture worlds

2026-10-16. Experimental runtime path; model uptake and ten-second lecture delivery
remain unproved. This reuses native reactive bindings rather than adding a visual
language or a library of subject-specific scenes.

## Decision

An author creates geometry once and exposes meaningful numeric dependencies with
`s.slider(id,{reactive:true,min,max,default})` and `s.bind`/`s.deform`. Later model
responses name one existing program and changed numeric values. Host reevaluates
retained callbacks instead of recompiling source or recreating geometry.

The first slice permits an immediate atomic update within one program. Geometry
edits, additions, removals, parameter tweening and multi-program parameter batches
are separate operations. No user-facing slider UI is introduced. Parameters must
have actual binding dependencies; ordinary sliders, toggles and selects fail.

The tool protocol is opt-in (`retainedParameters:true`) and preserves historical
probe schemas by default. Joined lecture generation enables it explicitly.

```json
{
  "action": "parameters",
  "reason": "",
  "source": "",
  "changes": [],
  "remove": [],
  "parameterProgramId": "run-1-plan-1",
  "parameterValues": [{"id": "amplitude", "value": 2}]
}
```

Speech anchors remain part of the joined tool envelope. The model names an exact
supporting phrase; existing host code resolves measured words and retains the
original deadline. No timestamp arithmetic is delegated to the author.

## State and publication

`LiveWorld.setParameters({baseRevision,programId,values},now,options)` validates
finite bounded values, declared IDs and current revision. It keeps the original
compiled scene and compiler session identity, epoch, camera, assets and topology.
Each program carries a separate committed values/snapshot/cache state. Callback
evaluation receives all current values and current program-local time. Publication
replaces one state pointer after cancellation, evidence/deadline and revision checks.
Concurrent stale samples retry against the new revision. Terminal caches belong
to individual states, so old completions cannot overwrite new parameter results.

Unchanged values invoke no callbacks and create no revision. Browser records these
as uncovered no-ops rather than inventing a committed operation. Successful updates
enter the bounded committed-context journal with exact values and program ID.
Direct host overrides of parameter-owned properties fail, including generated
normals owned by vertex updates. Existing time-only override behavior remains.

Callbacks must be pure functions of inputs and immutable captured geometry.
This is the native library's existing authoring contract, not a purity verifier.
Host values and geometry publish atomically; arbitrary JavaScript closure mutation
cannot be rolled back. Worker loss can destroy retained sessions and fails
explicitly; automatic reconstruction is outside this slice. Imported GLB topology
is immutable, though rigid transforms may be parameterized. Numeric text cannot
be rebound by the current property API; authors must avoid stale numeric labels.

## Coverage and evidence boundary

Ten local runtime fixtures cross five subjects with two visual detail levels:
line graphs, waves, probability densities, saddle surfaces and complete caffeine.
Each detail pair preserves the same subject content. Caffeine keeps all 24 atoms
and 25 bonds; surface detail changes tessellation, not its equation or operation.

Within each case, compare the retained update against freshly constructed geometry
with the same final parameter defaults and scene-local time. Numerical checks cover
positions, geometry, topology, IDs, camera and continued unrelated motion. Source
and patch bytes and local work timings are reported separately. Neither byte
reduction nor local runtime speed proves faster model authoring or live display.

The local viewer shows both native worlds at the same clock after the parameter
change. Handwritten fixtures are mechanical controls, not a substitute for matched
model trials, source-grounded explanation review, unseen subjects or the supplied
German lecture. Full acceptance remains the independent quality and latency gates
in [the cross-subject matrix](cross-subject-visual-matrix.md).

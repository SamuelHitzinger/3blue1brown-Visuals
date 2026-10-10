# Infrastructure and asset architecture task

Read `design.md` first. Work only on branch `amilibsam`; no branch switches,
pushes, or merges. Root owns commits. This task supplies trustworthy motion
exports and a concrete next-step design for reusable model/image assets.

## Part A: retained-time export correctness

Audit `shared/animlib/tools/render-frames.mjs` and `render-video.mjs`. They currently
compile each source once and repeatedly call `evaluateScene`, which alone does
not evaluate retained `s.bind(..., [s.time], ...)` callbacks. Confirm with an
actual regression before modifying behavior.

Implement one shared, typed host sampling utility in
`shared/animlib/src/offline-sampling.ts` (or an equally focused existing module)
and focused tests in `shared/animlib/test/offline-sampling.test.ts`. Prefer the
existing `createSceneProgram` / SceneSequence machinery; do not compile on every
frame. Export tools must sample actual absolute time, dispose VM resources even
on error, and carry the evaluated endpoint into the next scene. Preserve static
timeline, subtitle, silent-export, and duration contracts.

Tests must fail before the change and verify:

- A retained position or vertex deformation differs at 0, midpoint, endpoint.
- Backward and nonmonotonic sampling gives the same state as direct sampling.
- The default exported previous-frame handoff uses the actual time endpoint.
- Static scenes and retained controls preserve expected semantics.
- Disposal and error paths do not leave a live QuickJS runtime.

Add a tiny native render proof with source and reproducible command. Render
native frames at setup/interior/end; technical tests alone do not prove the
tools use the new sampling path. Do not edit unrelated scene helpers.

Owned implementation files: offline-sampling.ts, offline-sampling.test.ts,
render-frames.mjs, render-video.mjs. Root will serialize any required core export.
If changing these boundaries is necessary, message root first.

## Part B: asset/organization design

Audit source/compiled limits, host `CompileInput`, `SceneSequence`, player,
geometry retention, and both render backends. Produce a precise proposal in
`asset-architecture.md` for reusable host-owned models/textures that avoids
inlining large arrays repeatedly into 256 KB scene source. Specify native format,
provenance, bounds, worker serialization, lifetime/cache policy, scene lookup API,
and effects on existing validation/palette behavior.

Assess a practical glTF/GLB or OBJ preparation path and actual image/UV textures.
Use authoritative format documentation. Distinguish a complete format from a
documented subset; do not silently discard skins, animation, materials, topology,
or texture maps. Reuse existing components; keep changes modular. Do not add
product dependencies or implement a renderer overhaul during this audit.

Also identify measured or code-evidenced performance risks from proposed dense
molecular/curve helpers. Initial CPU-stub benchmark resides in
`data/animlib-expansion/baseline-render.txt`; it is not GPU frame-rate evidence.

## Verification / report

Use meaningful regression-first tests. Process-local TEMP/TMP may need
`C:\Users\samue\Stuff\3yellow3white\data\animlib-expansion\tmp` on this Windows
sandbox. Baseline: 664 tests, typecheck, library build pass. Local FFmpeg:
`data/video-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe`.

Write commands/results, changed files, proof paths, concerns, and architecture
proposal summary to `infrastructure-report.md`. Return concise status. Independent
review arrives from root. Communicate with domain implementers about integration.

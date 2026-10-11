# Main integration and validation

Integrated on `amilibsam` on 2026-10-11. The original twenty conflicts are resolved
without selecting either branch wholesale. The first merge checkpoint is
`b2e9303`, combining animlib parent `ea6e07a` with main `b35e4a8`. Main subsequently
advanced to `d2fbc5797200063657f5e2a69a2f972e18374b70`; its mode-selector changes
were incorporated in a second clean merge before publication.

## Preserved contracts

- Prepared model/image descriptors and GLB assets remain distinct host-owned
  inventories. `s.model` resolves unique IDs automatically and requires
  `source: 'prepared' | 'glb'` when both contain an ID. Both formats return owned
  handles with working `part()` and `tintTo()`. Existing child IDs, GLB pivots,
  prepared styling, imported materials, handoffs and validation remain intact.
- A shared 36-float vertex layout preserves UV0 and GLB UV1 separately from
  prepared image alpha. Rendering dispatches matching image/model pipelines,
  retains both resource identities, and prevents sampler leakage into focus.
  Scientific geometry, path motion, shadows, focus and source-image handling
  coexist with GLB PBR maps and main's procedural-noise changes.
- Player and offline hosts prepare and dispose both asset systems. Exports keep
  retained `withOfflineScene` sampling; backend GLB rendering requests continue
  to work. No model/image bytes enter the scene VM.
- Main's strict authoring-reference inventory now includes the new domain-helper
  section. A regression test preserves that section and its host/scene guidance.
  A Windows newline-sensitive example test now accepts LF and CRLF.
- Documentation distinguishes both model formats and their limits. The current
  mathematical art direction, original accepted source films and showcase remain
  unchanged. No test tolerance or runtime execution budget was relaxed.

## Independent review

[API/host review](merge-api-review.md) and
[rendering review](merge-render-review.md) found no actionable merge regression
in their assigned scopes. The API reviewer independently ran 49 focused tests
and reproduced the native export evidence metrics. The rendering reviewer
compared both parents and investigated the native pixel failure below.

## Validation evidence

Saved logs and generated evidence live under the ignored local directory
`data/animlib-expansion/merge-validation/`; regression tests and browser harnesses
are versioned. Runtime test counts below apply to the first merge checkpoint;
the final consumer checks after main advanced are recorded separately below.

| Check | Result |
| --- | --- |
| Full animlib unit suite, one worker | 1,033 passed in 94 files |
| Library and backend typechecks | Passed |
| Library and backend preview build | Passed |
| Production demo bundle | Passed; existing large-chunk warning remains |
| Backend suite after authoring-reference repair | 277 passed in 32 files |
| Full native WebGPU suite | 164 passed; one pre-existing exact-pixel failure |
| Separate native image and optical-focus suites | Both passed |
| Mixed WebGL browser harness | Six checks passed, including context restoration |
| Existing GLB WebGL browser harness | Eleven checks passed |
| Native mixed frames, backend GLB frames and H.264 export | Passed |

Root executed both browser harnesses through the in-app browser. The mixed test
verified prepared-image RGB, prepared mesh, GLB UV1/texture transform, focus,
isolated opacity, retained/streamed replay, context recovery and lease disposal.
The GLB test additionally verified alpha modes, mirrored culling, PBR maps and
public-player replacement behavior. Browser warning/error logs were empty.

Native host evidence includes complete frames at 0 and 2 seconds in 1280×720 and
960×720, plus an eight-frame H.264 video. The actual backend chain
`ModelAssets.publish → forRendering → renderSceneFrames` was exercised. Both
prepared and imported objects move while retained path geometry changes.

Initial concurrent unit runs hit the existing 200 ms VM deadline in the neural
trajectory proof. Its focused rerun and the complete one-worker suite passed
without changing limits. Native filesystem checks required the normal approved
sandbox escape for Windows `realpath`/`lstat`; sandbox errors were not treated as
test passes. A new Node-only image fixture initially omitted its decoder and
then passed a non-Buffer input to PNGJS; both fixture errors were fixed before
the successful full suite. A non-UTF-8 comment dash was corrected before the
successful production demo build.

## Known native pixel limitation

The full GPU suite is not all green. The exact-buffer test for independent
material/texture parameters at control `0.1`, time `0`, fails on both untouched
parents and the merged code. Main and merged produce the identical discrepancy:
five RGB bytes across three pixels, each differing by one 8-bit level. Repeated
rendering of the same frame with retention bypassed also reproduces tiny native
readback variation. No assertion was removed or weakened. See the independent
rendering review for parent commands, raw logs and pixel coordinates.

## Final main refresh

Main's additional commits remove the interactive-mode selector and retain its
updated video contract, backend behavior, frontend source and published assets.
These files merged without conflict. Fresh backend/frontend checks and a
byte-preservation review passed before the final commit and push: **279 backend
tests, 67 frontend tests, backend typecheck and frontend TypeScript build**. The
frontend test prebuild also completed the library and backend preview build.
The independent API reviewer confirmed that every affected staged blob matches
upstream exactly and that the earlier merge resolution is preserved.

The final scoped documentation scan passed **253 local links, including 22
anchors, across 20 documents**. Publication uses a normal fast-forward push from
`amilibsam` to `main`; it does not require switching the working branch or
rewriting remote history.

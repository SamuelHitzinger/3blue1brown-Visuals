# Infrastructure implementation and verification report

Date: 2026-10-11. Branch: `amilibsam`. No commit, branch switch, push or merge by
this worker. Root owns the small `core.ts` export and integration commits.

## Result

The frame/video tools now evaluate retained callbacks at actual absolute sample
times with one QuickJS program per source. Both dispose the program on success
and every unwinding error. Video handoff evaluates the exact duration endpoint,
not its last encoded frame. Static timeline evaluation, declared duration checks,
silent-source checks, H.264 options and subtitle processing retain their contracts.

Shared API in `shared/animlib/src/offline-sampling.ts`:

```ts
withOfflineScene<T>(source, input, use, limits?): Promise<T>
// use receives { scene: CompiledScene, sample(time = scene.duration): Frame }
```

The callback may be asynchronous. `scene` is the canonical time-zero snapshot;
preparation may resolve its duration. Controls are fixed by `CompileInput`.
Sampling clamps finite times, merges retained outputs without modifying the
canonical scene and runs `evaluateScene`. The scoped sampler rejects use after
disposal. This uses `createSceneProgram` and the same reactive merge path as
`SceneSequence`, without compiling each frame or retaining all movie scenes.

## Regression and checks

Before implementation, a test reproduced the exact prior tool path:
`compileSource` once followed by `evaluateScene` at 0, 1 and 2 seconds. It failed
with actual X positions `[0,0,0]` versus expected `[0,1,2]`. This was the intended
behavioral failure, not a missing-module/import failure.

After implementation, `offline-sampling.test.ts` has six passing focused tests:
absolute-time positions without recompilation; backward/nonmonotonic seeking and
immutable earlier/canonical snapshots; default endpoint handoff to a downstream
scene; static timeline and supplied retained controls; vertex deformation; actual
QuickJS context/runtime disposal on normal completion, callback failure, invalid
time, invalid retained output and compilation failure. The lifecycle test spies
on creation while using real QuickJS and inspects each real context/runtime's
`alive` state. It does not replace QuickJS with a mock.

Commands executed from repository root (PowerShell):

```powershell
$env:TEMP='C:\Users\samue\Stuff\3yellow3white\data\animlib-expansion\tmp'
$env:TMP=$env:TEMP
npm test -w shared/animlib -- --run test/offline-sampling.test.ts
npm test -w shared/animlib
npm run typecheck -w shared/animlib
npm run build -w shared/animlib
node docs/animlib-expansion/offline-proof/run.mjs
```

Observed at this worker's verification point: focused 6/6; full suite 670/670 in
38 files; typecheck exit 0; build exit 0; native proof runner exit 0. Concurrent
domain workers may subsequently add more tests. The full suite result is library
unit/integration coverage, not the separate GPU suite. Root's earlier GPU baseline
reported four failures (two forced-Vulkan availability failures and two pixel
comparison failures); this worker did not modify those paths or claim their fix.

## Native proof and reproducibility

Tracked fixtures under `docs/animlib-expansion/offline-proof/` contain `motion.js`,
`hold.js`, `manifest.json`, `run.mjs`, and `verify.mjs`. The runner reads fixture
source, writes a local input descriptor, invokes both production export tools,
and verifies their pixels. Optional first argument is a local FFmpeg executable;
default is the existing workspace executable under `data/video-tools`.
After a fresh clone, install workspace dependencies, build animlib, and supply an
available FFmpeg executable:

```powershell
npm run build -w shared/animlib
node docs/animlib-expansion/offline-proof/run.mjs C:\path\to\ffmpeg.exe
```

Bulky generated output remains in ignored `data/animlib-expansion/offline-proof/`:

- `frames/1280x720-{0,1,2}.png`, `frames/960x720-{0,1,2}.png` and contact sheets;
  samples are exactly 0, 1 and 2 seconds.
- `proof.mp4`: native WebGPU, silent H.264/yuv420p, 640×360, 8 fps, 24 frames,
  3 seconds: two seconds of motion then one second holding inherited endpoint.
- `proof.srt`, `proof.vtt`, embedded `mov_text` subtitles.
- `verification.json`: measured centroids and decoded-video assertions.
- `run.log`: combined native export/verification output.

The yellow probe's native 1280-wide centroids are 459.5, 639.5 and 819.5 pixels;
960-wide centroids are 299.5, 479.5 and 659.5. All exactly match independently
derived camera positions. Decoded video centroids at frames 0/8/15/16/23 are
229.521/319.491/398.236/409.491/409.491, all within one pixel of expected values.
The jump from frame 15's last interior sample to frame 16's actual endpoint proves
next-scene handoff does not reuse the last encoded frame. FFmpeg inspection finds
H.264 and mov_text streams and no audio; sidecar cue times are checked.

The 1280-wide contact sheet was visually inspected: the probe is left, centered,
then right at the three samples. This is a narrowly scoped time/export technical
proof, not an explanatory animation or a match to an artist's reference style.
Native GPU availability succeeded using the default backend in this environment;
no forced Vulkan requirement was introduced. These outputs are not FPS evidence.

## Architecture proposal

`asset-architecture.md` audits current source/compiled/update/geometry limits,
`CompileInput`, worker serialization, `SceneSequence`, player preparation,
geometry retention and both backends. It proposes:

- Versioned native asset manifests plus hashed bounded binary model/image blobs,
  immutable host registry ownership and small validated scene references.
- Explicit provenance, source selections, coordinate transforms, bounds validation,
  cache/lease/disposal rules, transactional asset replacement and worker metadata.
- Simple host `palette | source` policy: trusted source-color assets can retain
  original RGB faithfully while scene-authored styling still uses palette tokens.
- Incremental UV/image/vertex-color support in both backends; current procedural
  textures stay separate. No claim that image support or full PBR exists today.
- Documented glTF/GLB and OBJ preparation subsets; unsupported skins, animations,
  topology and material/map features fail or require an explicit reported bake.
- Concrete code-evidenced dense-helper costs and staged GPU/CPU acceptance gates.

Authoritative format links are in the proposal. No product dependencies were
added, no importer implemented, and no geometry/renderer overhaul performed.

## Changed files / review scope

Owned production: `shared/animlib/src/offline-sampling.ts`,
`shared/animlib/tools/render-frames.mjs`, `shared/animlib/tools/render-video.mjs`.
Owned tests: `shared/animlib/test/offline-sampling.test.ts`.
Root integration: two export lines in `shared/animlib/src/core.ts`.
Documents and tracked fixture directory listed above. Generated outputs are
ignored data. No unrelated scene helpers changed by this worker.

Remaining concerns: independent code/asset-design review is pending with root;
WebGL/image/asset pipeline implementation belongs to subsequent scope. The default
sampler intentionally freezes controls for an export; interactive control changes
remain `SceneSequence`'s responsibility. Host-defined stateful live behaviors are
not introduced into offline exports by this retained-time fix.

# Cold compile boundary diagnosis

Read-only source investigation, 2026-10-11. No new compile, benchmark or inference
was run for this note. This does not change the formal matrix result.

The isolated routing enzyme attempt `4196448b-3f58-4104-86c5-c946c38eb64e`
failed before native visual review. Existing direct diagnostics of its untouched
source show Node's first 200 ms attempt failing after 228.4 ms at scene line 7,
then a second 200 ms attempt succeeding with 635.9 ms total elapsed. Bun's first
attempt fails after 225.6 ms at line 45, then succeeds at 625.9 ms. These are
diagnostic repetitions, not successful complete pipeline runs. See the two
`scene-0.visual/0/{node,bun}-compile-diagnostic.json` files for the complete data.

The 200 ms interrupt budget is **not a timer for generated geometry alone**:

- `shared/animlib/src/compiler.ts:339–352` validates input metadata, parses and
  rewrites source, awaits `getQuickJS()`, creates the context and sets memory/
  stack limits **before** setting the deadline at line 353. Initial WASM module
  loading and context creation are outside this deadline. The installed
  `quickjs-emscripten` package caches its WASM module promise, but this compiler
  creates a fresh QuickJS context on every call.
- `compiler.ts:353–382` sets one wall-clock `Date.now()` deadline and then builds
  and evaluates the runtime bootstrap: serialized input, the complete
  `buildScene` function, mesh factories and domain factories. Function `toString`
  and string/JSON construction after the deadline also consume wall time. The
  generated scene has not been called when this work begins.
- `compiler.ts:383–384` evaluates generated scene source and serializes its
  compiled result under that same deadline. There is no fresh scene-only budget
  between bootstrap and user code. Interrupt checks happen during QuickJS
  execution; their reported source location identifies where execution noticed
  the expired deadline, not which earlier operation consumed it.
- `compiler.ts:385–405` performs host JSON parsing, compiled-scene validation,
  metadata checks and palette enforcement after the last timed QuickJS call.
  These host steps do not invoke the QuickJS interrupt handler. Thus a successful
  call taking ~635 ms does not establish that QuickJS ran past its 200 ms budget.
- Reactive updates receive a separate refreshed deadline at `compiler.ts:411`.
  `offline-sampling.ts:26–44` creates the scene once, then samples it; static
  topology is not rebuilt on every exported frame unless scene bindings do so.

The native render path uses this same compiler, not another geometry compiler:
`shared/animlib/tools/render-frames.mjs:38` enters `withOfflineScene`, which
creates the program before its callback. WebGPU initialization begins inside
that callback at lines 45–52. A QuickJS interruption there precedes native GPU
rendering; a frame-render wrapper error is not itself evidence of a GPU limit.

The evidence supports cold process/runtime execution sensitivity within a shared
bootstrap-plus-scene wall-clock budget. First-use host/WASM execution/JIT work,
GC or scheduling could consume some of it; their individual costs are **not
measured here**. The changing interruption line and warm success do not isolate
generated geometry cost. In particular, do not conclude that the mesh's polygon
count caused this failure or that the camera instruction itself was expensive.
The scene's high sampling density remains an independent possible cost concern,
not a demonstrated cause from these diagnostics.

After active inference finishes, a separate controlled investigation could
measure bootstrap, scene execution, serialization and host validation boundaries
in fresh and warm processes using unchanged inputs. Any runtime boundary fix,
prewarming policy or prompt mitigation would require a new complete pipeline
experiment with native rendering and review. Increasing the timer or treating a
warm direct compile as an accepted trial would change the experiment.

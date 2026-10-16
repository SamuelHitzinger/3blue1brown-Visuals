# Terminal callback sampling checkpoint — 2026-10-16

Reusing a completed program's terminal reactive snapshot removes repeated callback work while other programs continue moving. This local probe found exact frame equivalence across seven workloads. Improvement depends on callback cost: callback-free graph and molecule controls remain effectively unchanged, and actively deforming surfaces remain expensive.

## Method and evidence

Baseline: `backend/bench/realtime-world/world.ts` from commit `295f14f2c1224961a79e6c659fee12b2d5e79525`, frozen before the candidate change. A runnable ignored copy changes only relative shared-library import paths. Candidate: current terminal snapshot cache, using the same compiler/runtime/timeline dependencies. Original/relocated baseline hashes and candidate dependency hashes are recorded in `data/realtime-workshop/terminal-sampling-01/started.json`. Candidate source hash was checked again after the run and remained unchanged.

Harness: `backend/bench/realtime-terminal-sampling-probe.ts`. Both arms use real headless `LiveWorld` and retained QuickJS programs. All programs commit at the same simulated epoch. Each world also contains an unrelated 120-second time-bound rotation sentinel. Baseline/candidate sample order alternates. Timed intervals include `LiveWorld.sample` and a delegating counter wrapper; they exclude compilation/commit, asset decoding, frame comparison/hashing, and all GPU work.

Each workload has 12 active samples, one first-terminal sample, 60 later held samples, a rewind into active time, a return to terminal time, and a host color override. Every pair is deep-equal and has matching full-frame JSON SHA-256; the sentinel's rotation also matches its analytic time function. Total: **532 paired frame checks**, 1,064 timed samples. First active and terminal frames are preserved as snapshots; raw per-sample times, callback counts, checks, fixtures, and failures if encountered are retained in separate workload directories.

`terminal-sampling-results.json` contains tracked aggregates. All seven workloads completed; no failed trial is removed or replaced.

## Workloads

- Actual graph: existing 129-point parabola and text/leader fixture from `stroke-preflight-02`. It contains no registered time callback and is a negative control.
- Actual surface: revised 40×40 saddle mesh, moving slice/trace and labels from `quality-revision-01`. Five registered time callbacks; most surface geometry remains static.
- Actual molecule: revised full 24-atom, 25-bond caffeine scene from `quality-revision-01`. It uses native timeline motion, no registered time callback, and is another negative control.
- Actual large GLB: unchanged source and model payload from `lecture-assets-local-04`; one group rotation callback. SHA-256 verification, one model read, and resolution to exactly 90,004 model triangles succeeded outside sample timing. Timed world frames contain model references, not copies of the decoded triangle mesh.
- Synthetic growth cases: 1, 4, and 16 separate 40×40 deforming surface programs, each with 1,681 vertices, 3,200 triangles, one registered time binding, explicit distinct IDs, and eight-second duration. These measure held-program scaling; they are not additional independently authored visual-quality cases.

LiveWorld rejects program camera tracks. The actual surface and molecule adapters remove only their initial zero-duration camera command, preserving scene duration and element geometry/motion. Original and adapted source hashes are preserved. No namespacing or geometry simplification is applied to the actual fixtures. Focused tests prove this camera-only adaptation preserves sampled element state and reject unsupported camera commands.

## Observed CPU sampling cost

Median milliseconds over 60 held samples, all with a simultaneously active sentinel:

| Workload | Baseline | Candidate | Held registered callbacks, baseline → candidate |
| --- | ---: | ---: | ---: |
| Actual graph | 0.089 | 0.088 | 0 → 0 |
| Actual surface | 1.363 | 1.016 | 300 → 0 |
| Actual full molecule | 1.351 | 1.348 | 0 → 0 |
| Actual 90,004-triangle model references | 0.164 | 0.139 | 60 → 0 |
| Synthetic surface ×1 | 7.750 | 1.066 | 60 → 0 |
| Synthetic surfaces ×4 | 31.273 | 4.225 | 240 → 0 |
| Synthetic surfaces ×16 | 124.323 | 16.401 | 960 → 0 |

Both arms execute the sentinel callback on all 60 held samples in every workload. Counts come from successfully returned `ReactiveUpdate` records: the runtime invokes one registered binding callback per returned record. These are observed registered callback executions, not estimates from scene count. They do not count nested per-vertex functions or construction-time callbacks. Dispatch counts are recorded separately.

The first terminal sample still executes all held callbacks. Rewinding restores active callback execution; returning to terminal reuses the cached snapshot. Host overrides remain visible and exact across arms.

Active sampling shows no material acceleration in this single run. Actual-surface active medians are 1.368→1.398 ms; synthetic ×16 active medians are 124.376→124.508 ms. The cache addresses repeated completed programs, not the cost of active deformation. Callback-free controls show no meaningful gain. The larger synthetic speedups must not be described as general animation generation speedups.

## Limits and reproduction

This is one fixed-fixture local Bun CPU experiment with alternating arm order, not a statistical performance study. It measures neither memory growth, browser workers, GPU rendering/FPS, screen presentation, model generation, causal lecture response, nor visual quality. Exact frame equality establishes data parity at sampled times; it is not a fresh full-motion visual review. Stateful callback side effects are outside the pure-callback contract used by this cache.

Three focused harness tests passed, 12 assertions; targeted strict TypeScript checking passed. Root-owned cache correctness tests are reported separately. No network, provider call, or upload occurs.

Independent read-only review found no blockers. It verified the baseline against the Git object, import-only relocation, frozen candidate/dependency/harness hashes, all tracked aggregates against raw rows, 532 matching frame-hash pairs, held arm-order balance, callback/sentinel counts, source adaptations, snapshot hashes, and GLB payload hash/triangle metadata. It did not rerun the performance trial.

```powershell
./node_modules/.bin/bun.cmd test ./backend/bench/realtime-terminal-sampling-probe.test.ts
./node_modules/.bin/bun.cmd backend/bench/realtime-terminal-sampling-probe.ts data/realtime-workshop/NEW-TERMINAL-SAMPLING-RUN
```

Reproduction requires the referenced ignored scene/model evidence and the frozen `.tmp/terminal-cache-baseline{,-original}.ts` plus `.tmp/terminal-cache-baseline-identity.json`. The harness verifies their hashes, freezes original baseline/candidate source into the new evidence directory, and refuses an existing output directory.

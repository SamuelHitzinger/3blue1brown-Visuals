# Baseline GPU failures: reproduce and repair

Baseline before expansion (2b666eb): native suite143 passed,4 failed. See ledger.
Two recovery cases explicitly force Vulkan, unavailable on this Windows host.
Default native WebGPU adapter works and all native proofs render through it.
Two real pixel equality regressions involved retained material/texture parameters
and an identical translucent arrow3D morph. Do not loosen assertions merely to
accept unexplained differences.

Root focused rerun after path integration, 2026-10-11:

```powershell
$env:TEMP='C:\Users\samue\Stuff\3yellow3white\data\animlib-expansion\tmp'
$env:TMP=$env:TEMP
npm run test:gpu --workspace animlib -- --testNamePattern 'independent material|identical text' --reporter=dot
```

Result1 pass (identical morph),1 fail (material/texture),146 skipped. Material
failure now control0.1 at time0, whereas full baseline first failed time1.5.
This suggests order/cache state could matter; it is not proof of cause or that
the arrow issue is repaired. Reproduce both isolated and after relevant preceding
fixtures. Renderer interactions and caches deserve inspection.

Read systematic-debugging skill; investigate before edits. Own focused GPU test
and renderer/cache changes only after coordinating with assets_builder/image
worker. Static models and future image support must not inherit stale resources.
Default-adapter recovery test should remain real fault injection and prove same
backend-error persistence semantics. Avoid broad backend-specific skips. Validate
budget assumptions against actual requested device limits rather than hardware
guesses. Keep test purpose intact.

Report minimal reproductions, ranked cause evidence, narrowly scoped fixes and
new meaningful regression coverage in gpu-diagnosis-report.md. Root serializes
commits on amilibsam. No main/push, no changing global machine GPU settings.

## Root diagnostic evidence, pre-image dist snapshot

Ignored reproducible probes in `data/animlib-expansion/`:

- `probe-reactive.mjs`: legacy versus reactive CPU Frames and streamed DrawItems
  are deeply equal for material/texture, animated sphere radius and view-local
  sphere at controls0.1/2.5/1 and times0/1.5/3 (all27 cases).
- `probe-native-parity.mjs`: instrumented RetainedGeometry.get proves both
  compared material draws use retention; repeated identical retained frames also
  fluctuate (typically1-level channel differences). Not merely a static/reactive
  or retained/streamed route mismatch. Other two fixtures were exact natively.
- `--repeat` renders the exact same Frame object26 times with both retained and
  forced-streamed geometry for six independent material/texture variants.
  `native-repeat-results.jsonl` records each difference against first draw.
  Retained plain/material variants were exact; textured variants varied by at
  most1 level in2–16 channel locations. Streamed plain had3 differing channels,
  max6; material+bump up to50 channels, max3. Width640,height480.
  Two readbacks of the same target without another render were always exact.
  No uncaptured GPU errors. Results may vary between runs.
- This is unexplained repeated-render behavior, not proof of GPU arithmetic
  nondeterminism or permission to relax pixel assertions. Check depth ties,
  derivative/helper invocations, MSAA, buffer lifetimes and native backend.
  W3C WGSL/WebGPU are primary references for precision and rasterization rules.

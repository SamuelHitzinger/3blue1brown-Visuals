# Independent normal optimization review

2026-10-11. Scope: pending `shared/animlib/src/mesh-shading.ts` optimization,
`mesh-normal-work.test.ts`, the two motion benchmark tools, and
`motion-performance-report.md`. Production files were read-only during review.
No branch, commit, or push action was performed.

**Verdict: no actionable findings or blockers in this bounded change.**

## Semantics

`unit` still performs the identical normalization arithmetic. Its successful
result is finite and nonzero, so checking its components for nonzero values is
equivalent to checking its norm for positivity. Failed normalization retains the
zero sentinel; absent normal entries still select the face fallback. A fallback
is computed once per face only when needed. Opposite faces therefore keep their
distinct fallback directions, including at shared canceled vertices.

Derived smooth normals retain the same cross products, face traversal, vertex
traversal, and component addition order. Flat normals use the same expressions
and normalization. Cached content keys and final Float32 packing are unchanged.
Transforms and reflections remain downstream of this local computation.

## Fresh verification

All commands ran from the repository root, using this process-local setup:

```powershell
$reviewTemp = Join-Path (Get-Location) 'data/animlib-expansion/tmp-normal-review'
New-Item -ItemType Directory -Force -Path $reviewTemp | Out-Null
$env:TEMP = $reviewTemp
$env:TMP = $reviewTemp
```

| Command | Result |
| --- | --- |
| `npm run build --workspace animlib` | Exit 0 |
| `npm run typecheck --workspace animlib` | Exit 0 |
| `npm test --workspace animlib -- test/mesh-normal-work.test.ts test/mesh-shading.test.ts test/retained-geometry.test.ts test/textures.test.ts test/explanatory.test.ts test/peptide-motion.test.ts --maxWorkers 1` | 136 tests, six files passed |
| `node shared/animlib/tools/benchmark-motion-normal-parity.mjs data/animlib-expansion/tmp-motion-perf/mesh-shading-before.js data/animlib-expansion/tmp-normal-review/normal-parity.json` | 32 exact packed comparisons passed |
| `node shared/animlib/tools/benchmark-motion-peptide.mjs data/animlib-expansion/tmp-normal-review/peptide --compare=data/animlib-expansion/performance/motion-before/peptide-profile.json` | Source hash and all 35 packed timeline hashes matched; forward/reverse/direct JSON checks passed; zero pins and leases |

The peptide command initially failed at validated fixture `realpath` with sandbox
EPERM. The identical command passed with approved normal-host execution. No
fixture checks or assertions were changed.

Two additional inline Node diagnostics loaded the saved original mesh module,
rebased its imports to the current dist dependencies, and compared it directly
to the fresh build:

- Exact mesh output in 32 cases and complete draw-item output in 192 cases:
  flat/smooth, reflected/unreflected vertices, mixed zero/signed-zero/nonfinite/
  subnormal/large/missing authored normals, reversed and degenerate faces,
  negative/zero/positive uniform scales, object rotation, and opaque/translucent
  output. All passed using strict deep equality, including Float32 arrays.
- The shared-normal fixture made 403 `Math.hypot` calls before versus three
  after; the complete outputs were strictly equal. This independently confirms
  the new work-count regression exercises an actual eliminated cost.

## Performance interpretation and limits

The report's 34.54 to 31.62 ms median CPU preparation result is a single paired
run, with unchanged upload volume and draw count. Its stated qualification is
appropriate. This independent replay during concurrent work measured 39.82 ms
median preparation and 64.72 ms evaluation; it does not establish a repeatable
8.5% latency gain. The eliminated normalization work is deterministic, but wall
time benefit depends on workload and runtime noise.

This review did not rerun native GPU rendering or the entire GPU suite. Exact
CPU packed parity is not a claim of exact GPU pixels. The known two baseline
MSAA parity failures remain outside this optimization review.

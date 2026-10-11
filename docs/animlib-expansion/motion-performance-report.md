# Measured motion costs and documentation integration

2026-10-11, shared `amilibsam` tree. Root approved one bounded renderer change;
this worker made no Git mutation. Peptide/RNA helpers, proof choreography,
palettes, camera, source samples and VM budgets are unchanged by this pass.

## Finding and bounded change

The entire QuickJS peptide pose costs about 2.89 ms median in a small-update
diagnostic. Pose plus molecular mesh construction costs 17.84 ms; the complete
proof sample costs 56.30 ms before full-frame serialization or rendering. A
prepared immutable peptide rig cannot remove more than the entire 2.89 ms pose
cost here, and would remove only its static portion. No new public rig API was
justified. The source already shares one computed pose/mesh between callbacks
at the same time; there is no duplicate call per rendered mesh in this proof.

The approved optimization is in `src/mesh-shading.ts`. Smooth meshes with
authored normals previously computed every face normal and repeatedly measured
the same normalized vertex normal at each expanded corner. Normal usability is
now computed once per vertex; geometric fallback normals are computed only for
faces that need them. Derived smooth normals retain the original face-area sum
order, flat normals retain their previous computation, and zero/missing/nonfinite
normals retain the original per-face fallback. Public interfaces, content cache
keys, coordinate precision and renderer packing are unchanged.

## Environment and reproduction

Windows 10.0.26300, Node v24.15.0, AMD Ryzen 7 9800X3D. Native adapter NVIDIA
GeForce RTX 5080 / Blackwell, D3D12 driver 32.0.16.1714. No GPU timestamp queries.
Native CPU-plus-queue wall times are not GPU execution times or FPS guarantees.
Initial sandbox fixture `realpath` returned EPERM; the same native benchmark
ran with approved normal-host execution, retaining all fixture validation.

```sh
npm run build --workspace animlib
node shared/animlib/demo/expansion/peptide-motion-proof.mjs
node shared/animlib/tools/benchmark-motion-peptide.mjs data/animlib-expansion/performance/motion --gpu
npm test --workspace animlib -- test/mesh-normal-work.test.ts test/mesh-shading.test.ts test/retained-geometry.test.ts test/textures.test.ts test/explanatory.test.ts test/peptide-motion.test.ts --maxWorkers 1
```

For a before/after comparison, save the pre-change built `mesh-shading.js` and
run the benchmark into a preserved baseline directory **before** the change.
After rebuilding, add `--compare=<baseline-directory>/peptide-profile.json`.
`benchmark-motion-normal-parity.mjs <saved-module> <output.json>` loads that
saved implementation only in its diagnostic process and compares both renderers.
It does not install an alternate production path.

This run's reports are in ignored
`data/animlib-expansion/performance/motion-before/peptide-profile.json` and
`motion-after/{peptide-profile,normal-parity}.json`. The saved prior module is
`data/animlib-expansion/tmp-motion-perf/mesh-shading-before.js`. Tests used that
worker's unique existing TEMP/TMP directory. Reproduction tools are tracked.

One unmeasured compile precedes five measured compile/lease setups. Eight warmup
samples precede 40 measured absolute times from 0.05–5.85s, covering changing
geometry throughout local coil formation and compaction. Cases run sequentially
in a warm process. Parallel desktop work and small compile/native samples limit
inference; no numerical gain is attributed to a phase untouched by the change.

## Measurements

| CPU phase, full peptide proof | Before median / p95 ms | After median / p95 ms |
| --- | --- | --- |
| Compile plus sampler/asset setup, 5 runs | 221.56 / 228.55 | 226.79 / 232.80 |
| Sample evaluation, 40 runs | 56.30 / 60.29 | 55.14 / 58.36 |
| Full-frame JSON serialization, 40 runs | 3.80 / 4.21 | 3.78 / 4.08 |
| Warm CPU draw geometry preparation, 40 runs | 34.54 / 40.75 | 31.62 / 38.33 |

The changed phase improves about 8.5% at the median in this run. Compile and
sample evaluation are outside the modified renderer path; their differences
are run variation. Compilation includes host work and is not the VM deadline.
Evaluation includes callback execution, VM JSON transfer/validation and host
timeline work; those internal components are not separately instrumented.

The diagnostic pose-only and pose-plus-mesh scenes return only a center position;
their difference identifies roughly 15 ms of mesh work in QuickJS. Their
difference from the full proof is **not** an exact additive accounting of JSON
transfer: the full proof also has additional bindings, validation and timeline
work. Independent host calls initially measured 0.16 ms pose / 1.15 ms mesh
medians; host JavaScript times cannot substitute for QuickJS times.

Payloads remain exactly 16,855 UTF-8 source bytes, 1,848,872 compiled JSON bytes,
and up to 1,034,812 full-frame JSON bytes in these sampled times. The full-frame
size is not the VM callback update size. Dynamic sticks remain 6,608 vertices /
6,608 triangles; the static endpoint asset remains 4,310,528 decoded bytes.
All sampled cases end with zero registry pins and leases.

Actual native 1280×720 rendering receives already sampled frames, so these
numbers exclude QuickJS evaluation. First frame is cold, the remaining five
frames warm the existing dynamic geometry path; reverse/direct seeks are included.

| Time | Before render + queue ms | After render + queue ms | Buffer bytes / draws, both |
| --- | ---: | ---: | ---: |
| 1.8, cold | 51.74 | 47.19 | 5,842,720 / 1 |
| 3.3 | 40.06 | 42.10 | 5,842,720 / 1 |
| 4.7 | 67.98 | 62.20 | 5,842,720 / 1 |
| 5.9 | 44.30 | 38.24 | 5,842,720 / 1 |
| 3.3, reverse | 33.94 | 34.10 | 5,842,720 / 1 |
| 1.8, reverse | 38.09 | 36.22 | 5,842,720 / 1 |

Warm medians are 40.06 → 38.24 ms. Some samples are slower and outliers remain;
this is not evidence of a universal native latency reduction. Upload volume
and draw count are unchanged. The large dynamic update/packing costs remain
the primary limitation; speculative instancing or a second geometry architecture
is outside this bounded pass.

## Preservation and checks

The new regression failed on the original implementation: 403 `Math.hypot` calls
for three shared authored normals over 100 triangles, versus the required three.
It passes after the change. Focused verification passes **136 tests in six files**;
ordinary build passes. Tests retain existing degeneracy, opposite-face normals,
morph endpoints, opacity, texture, scalar-color, retained resource and peptide
seek coverage. A separate parity tool compares the saved original renderer and
the current renderer over **32 cases**: unlit/flat, derived/authored/zero/missing/
nonfinite/tiny normals, scalar colors, opaque/translucent output, two cameras and
nontrivial object transforms. Packed Float32 vertices/normals/colors, ordering
and depth match exactly.

The full peptide proof's exact packed stream/style/order/depth hashes match at
**35 forward/reverse times**, including 0–8s in 0.25s steps, compaction, the
surface fade and the endpoint hold. Both versions also pass exact full-frame
JSON after forward/reverse/direct seeks. No scene semantics changed; a new film
was not needed for this numerical preservation check. Native rendering was
actually exercised above, but no new visual-style approval or exact GPU pixel
parity is claimed. Existing tiny 4×MSAA pixel nondeterminism is unchanged.

## Organization and release

README/reference/capabilities/helper-guide links now include sampled-state
projection, custom collection content/reorder, peptide poses, incoming nucleotide
rotation and fixed-link emergence. The new `demo/expansion/README.md` indexes
real generators, manifests, separate artist contracts, fixture source/license
records, reviewed artifact hashes and remaining fidelity limits. It explicitly
distinguishes biological source/manifest generators from film renderers.
No generic orchestration framework or module relocation was necessary.

Released files: `src/mesh-shading.ts`, `test/mesh-normal-work.test.ts`,
`tools/benchmark-motion-peptide.mjs`, `tools/benchmark-motion-normal-parity.mjs`,
library `README.md`, `docs/{reference,capabilities,helpers-and-assets}.md`,
`demo/expansion/README.md`, and this report. Root owns integration and the final
full-suite run; the independent reviewer receives this separate renderer diff.

All limits remain unchanged: 32 MiB VM, default 200 ms execution, 256,000 source
string units, 8 MiB compiled / 1 MiB reactive JSON string limits, 2,000 object IDs,
100,000 points, 20,000 vertices/triangles per mesh, and host registry/model caps.
The neural proof retains native `countTo` tracks and exact sample correspondence;
no numeric renderer field or track semantics were added for this optimization.

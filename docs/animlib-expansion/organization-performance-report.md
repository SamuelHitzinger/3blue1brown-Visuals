# Organization and measured performance

2026-10-11, `amilibsam`. No Git mutation by this worker. Root owns integration.
Scope: public documentation, reproducible CPU measurements, and one measured
scene-only optimization approved by root. No renderer/API refactor, new runtime
dependency, raised limit, assertion tolerance change, or GPU FPS claim.

## Organization

Updated `shared/animlib/README.md`, `shared/animlib/docs/reference.md` and
`shared/animlib/docs/capabilities.md`. The latter two feed generation prompts, so
their previous claims that domain APIs/models/images/UVs/native export were absent
were actively misleading. They now state the integrated APIs and supported
subsets. New `helpers-and-assets.md` supplies complete scene examples and the
descriptor catalog / host registry / scoped offline sampling workflow.

The public guide links to the existing static import and molecular-coordinate
guides; operational source research and acceptance ledgers remain here. These
boundaries match the implementation:

| Layer | Responsibility |
| --- | --- |
| `diagrams/*`, molecular/nucleic factories | Bounded relationship/geometry builders; self-contained factories can be installed verbatim in QuickJS |
| Host molecular import/envelope, glTF/PNG preparation tools | Parsing, provenance, heavy preparation and immutable native packages |
| Asset registry/catalog | Host snapshots and leases; descriptor-only IDs/hashes/counts/bounds enter source generation and the VM |
| Existing compiler/evaluator/renderer | One production scene and resource path; retained absolute-time sampling |
| Demo scene/style contracts | Separate mathematical, Reducible, Artem, Visually Explained and biological presentation choices |

No production module move was justified: active expansion is already separated
into factories, types, offline tools and renderer ownership. Generalizing those
boundaries while parallel integration is active would add risk without measured
benefit. Source provenance is not permission to reuse film assets. Text remains
bundled MathJax/TeX variants; a bounded font-family preset is a future design
requirement, not an implemented arbitrary-font API.

## Conditions and reproduction

Windows 10.0.26300; Node v24.15.0; AMD Ryzen 7 9800X3D, 16 logical processors,
66,054,815,744 bytes reported system memory. Native adapter reports NVIDIA
GeForce RTX 5080 / Blackwell, D3D12 driver 32.0.16.1714, non-fallback.

Run after the library build, from repository root:

```sh
node shared/animlib/tools/benchmark-asset-reuse.mjs
node shared/animlib/tools/benchmark-artem-source.mjs
node shared/animlib/tools/prove-image-rendering.mjs data/animlib-expansion/performance/native-image
node shared/animlib/bench/render.mjs --frames 30
npm test --workspace animlib -- test/science-proofs.test.ts --maxWorkers 1
```

Windows test TEMP/TMP pointed to existing `data/animlib-expansion/tmp`. The native
image proof needed authorized normal-host execution because sandbox `realpath`
denied the local fixture manifest. No filesystem validation was bypassed.
CPU benchmark files and native proof JSON are in ignored
`data/animlib-expansion/performance/`; tracked tools reproduce them. Original
GPU harness was reused without creating a second upload instrumenter.

The CPU reuse benchmark warms each compile once, measures three fresh compile/lease
setups, warms eight frame evaluations, then measures 40 samples. It separates
evaluation from geometry preparation. Cases run sequentially with warm process
caches. Small compile samples are diagnostic, not a statistical performance
guarantee. Reported memory is conservative registry accounting / retained typed
array bytes, not driver allocation or process peak memory.

## Equivalent repeated geometry

One original sinusoidal mesh: 1,024 vertices / 1,922 triangles; eight instances,
8,192 logical vertices. Both cases have identical group/child topology, color,
unlit appearance and absolute-time rigid rotation. Inline scene includes one
array literal reused by eight mesh constructions; host case holds the same arrays
once in an immutable registry. Exact composed Float32 geometry, style and order
hashes match at 0/1/2s. Direct and reverse frame seeks match within each case.

| Metric | Authored repeated meshes | Host model reuse |
| --- | ---: | ---: |
| Source bytes | 66,851 | 233 |
| Compiled JSON bytes | 539,690 | 7,994 |
| Frame JSON bytes | 536,549 | 4,853 |
| Catalog bytes | 0 | 375 |
| Compile + lease median / p95 ms (3 runs) | 118.35 / 124.12 | 8.06 / 8.21 |
| Evaluation median / p95 ms | 2.95 / 3.71 | 0.18 / 0.26 |
| Warm geometry preparation median / p95 ms | 2.05 / 2.65 | 0.08 / 0.16 |
| Cold evaluation + preparation ms | 17.54 | 6.63 |
| Unique retained meshes / composed commands | 1 / 1 | 1 / 1 |
| Retained vertex / index bytes | 139,264 / 23,064 | 139,264 / 23,064 |

Registry creation cost 6.16ms; conservative decoded bytes 377,088. Two independent
offline consumers held two leases, yielded identical streamed geometry, and the
survivor remained usable after its peer disposed. Final leases/pinned bytes were
zero. Decoded memory remains held by the host registry; disposal does not claim
that the host reference has been garbage-collected. This tests two sampler
consumers, not two browser players or devices.

This comparison shows why reuse belongs outside the VM. Both paths already
deduplicate retained GPU geometry; it does **not** establish fewer draws for host
reuse in this fixture. The remaining inline cost is array serialization/cloning
and content-based preparation. No unsafe global identity cache was introduced.

Additional bounded fixtures in the same tool:

| Fixture | Compile median ms | Evaluation median / p95 ms | Preparation median / p95 ms | Compiled bytes |
| --- | ---: | ---: | ---: | ---: |
| 1,000-point dashed path reveal | 11.36 | 0.19 / 0.33 | 0.48 / 1.26 | 36,058 |
| 24-site retained molecular motion | 20.83 | 3.40 / 4.62 | 0.83 / 1.71 | 97,576 |

The molecular fixture rebuilds actual fixed-topology vertex positions; it is not
a rigid-transform benchmark or a folding simulation. The hidden time-zero path
has zero draw commands, then reveals visible geometry. Neither fixture claims
GPU timing. Their direct/reverse checks pass.

## Actual native model/image reuse

Fresh `prove-image-rendering.mjs` run: eight textured Suzanne instances, 94,464
logical vertices. Source/catalog/compiled/frame sizes are 286 / 835 / 10,005 /
6,679 bytes. Conservative decoded registry bytes 9,232,384.

| Metric | Cold frame | Warm frames |
| --- | ---: | ---: |
| Actual image uploads | 1 | 0 |
| Image bytes uploaded | 4,194,304 | 0 |
| Buffer bytes uploaded | 321,584 | 720 each |
| Actual draws / instances | 1 / 8 | 1 / 8 |
| CPU plus queue-completion wall ms | 27.90 | 1.61, 0.95 |

Final pins/leases are zero. These are observed calls to the native device, not
mocked GPU uploads. Queue-completion wall time is not GPU timestamp timing.

The original CPU-stub baseline also reproduced: linear algebra median/p95
1.16/1.89ms, organic chemistry 0.18/0.25ms, sorting 0.08/0.28ms, interactive views
0.29/0.49ms. Its original ledger values were 1.49/3.53, 0.20/0.76, 0.12/0.53 and
0.26/0.41ms. Different runs/contention prevent attributing changes to this pass;
interactive views are not uniformly faster. The harness still explicitly mocks
GPU work and excludes timeline evaluation.

## Measured Artem optimization

Root reported an occasional 200ms VM compile deadline during a 64-worker suite;
the same proof passed alone. Inspection showed `plane.map` time-bound 45 ticks,
45 kernels and five traces. Ticks/kernels finish fading at3.4s; horizontal
compression starts at3.5s. The scene now binds only the five trace point arrays.
This is an intentional change to hidden geometry after it is invisible; visible
positions, rates, timing, labels, color roles and source sample counts are unchanged.
The generic coordinate factory is unchanged.

Final sequential measurement (10 compile runs, five warmups +40 samples per phase):

| Metric | Original map | Trace-only binding |
| --- | ---: | ---: |
| Bindings | 108 | 18 |
| Compiled bytes | 579,077 | 498,561 |
| Compile + lease median / p95 ms | 90.37 / 96.67 | 76.46 / 78.86 |
| Kernel-phase evaluation median / p95 ms | 16.74 / 17.67 | 4.77 / 5.79 |
| Compression evaluation median / p95 ms | 16.72 / 17.69 | 4.94 / 5.59 |
| Held-state evaluation median / p95 ms | 16.55 / 17.46 | 4.85 / 5.18 |

Compile median fell about15%; evaluation improved about3.4–3.5× in this run.
An earlier contended run showed a larger compile reduction; this report uses the
final sequential observation. This reduces deadline pressure but cannot guarantee
a wall-clock deadline under arbitrary system contention.

`benchmark-artem-source.mjs` reconstructs the old binding from the optimized
source and compares both. Exact composed Float32 visible stream/style/order
equality passed at80 times (0–7.5s every0.1s plus epsilon probes around3.4/3.5s).
Direct/reverse sampling gives exact frame equality within each version. The
existing scientific invariants passed **2/2 tests** in `science-proofs.test.ts`.
No full suite was run during parallel ownership; root owns integrated validation.

New native media: `data/animlib-expansion/revision2/artem-state/film.mp4`;
H.264/yuv420p,1280×720,30fps,225frames,7.5s,silent. FFmpeg decoded all225 frames.
SHA-256 `6e172782228a8d4504541b7c74da001e98d85b98a498606c6c89894fd5a965f4`.
Both1280×720 and960×720 native sheets include setup/interior/hold. A return to3.9s
after7.5s produced exact RGBA bytes at both sizes. Three ordered6fps sheets cover
the whole movie. Author inspected all45 ordered decoded6fps samples plus native
1280×720 setup/interior and960×720 endpoint/reverse sheets; no missing row,
cropping or visible discontinuity was observed. Previous proof media was preserved. Independent visual evaluator
has been sent this exact candidate; technical parity is not its style verdict.

## Limits and unresolved evidence

Unchanged: 32MiB QuickJS memory; default200ms VM execution; source256,000
JavaScript string units; compiled JSON8MiB and reactive-update JSON1MiB string
lengths;2,000 object IDs;100,000 aggregate points;20,000 vertices and triangles
per mesh. Assets still count logical instance vertices. Host registry256MiB and
per-model32MiB limits also remain. No budget was weakened to obtain these results.

The separate native GPU exact-pixel variation with4×MSAA remains unresolved.
Identical CPU streams do not prove bit-identical GPU pixels in all materials/
translucent-arrow cases. This pass neither hides that failure nor relaxes its
assertions. The exact Artem seek frames above establish only their sampled case.
Full multi-player/device loss tests belong to existing renderer validation, not
this small benchmark. Broad creator/cinematic fidelity remains proof-specific.

Ready for organization/performance technical review; independent visual recheck
of the optimized Artem film remains a separate gate.

## Released files

- `shared/animlib/README.md`
- `shared/animlib/docs/reference.md`
- `shared/animlib/docs/capabilities.md`
- `shared/animlib/docs/helpers-and-assets.md`
- `shared/animlib/tools/benchmark-asset-reuse.mjs`
- `shared/animlib/tools/benchmark-artem-source.mjs`
- `shared/animlib/demo/expansion/artem-state.js`
- `docs/animlib-expansion/organization-performance-report.md`

The guide's three complete scene examples were compiled and sampled at both
endpoints under default limits. Existing native image/catalog proof exercised the
documented host asset route. No unrelated working-tree changes are owned here.

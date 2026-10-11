# Expansion organization and cost inventory

2026-10-11. This pass organizes the growing library without relocating public
modules, changing package containment, regenerating frozen assets or revising
historical review findings. The [coverage index](../../shared/animlib/docs/expansion-index.md)
connects public APIs, separate artist profiles, asset families and current
independent decisions. The [proof index](../../shared/animlib/demo/expansion/README.md)
contains runnable entry points, output paths and representative release hashes.

## Metadata inventory

The initial snapshot scanned native version-1 model/image JSON manifests under
`shared/animlib/fixtures/biological`, before the new peptide revision-4 package
was produced. It found **33 packages, no duplicate asset IDs**, and 216,738 bytes
of native manifest metadata. Referenced binary bytes total 8,115,824; conservative
decoded accounting totals 88,004,096 bytes. These are historical family totals,
not one scene's working set. Staging/rig/source JSON is not a native model package
and is excluded. No geometry arrays were decoded for this inventory.

| Family | Packages | Referenced binary bytes | Conservative decoded bytes |
| --- | ---: | ---: | ---: |
| 1crn | 3 | 819,504 | 8,741,376 |
| illustrative-peptide | 1 | 404,112 | 4,310,528 |
| nucleotide-anatomy | 5 | 1,000,704 | 10,674,176 |
| peptide-polished | 3 | 1,876,976 | 21,456,384 |
| polymerase-channel | 1 | 263,376 | 2,809,344 |
| rna-processing | 1 | 36,864 | 393,216 |
| rna-processing-revision2 | 5 | 1,836,144 | 19,585,536 |
| transcription-revision2 | 5 | 464,832 | 4,958,208 |
| translation | 5 | 490,848 | 5,235,712 |
| translation-revision3 candidate | 4 | 922,464 | 9,839,616 |

Counts use declared blob lengths and the existing `assetPackageDecodedBytes`
formula, not process RSS or GPU allocation. The translation candidate can change
before freezing. The later revision-4 peptide asset has separate preparation
reports and is deliberately not folded into this historical snapshot.

There are 22 binary-hash groups with copies in multiple package directories,
representing **243,648 avoidable on-disk bytes** (about 3% of referenced bytes).
The largest repeat is shared nucleotide sugar/phosphate geometry between purine
and pyrimidine packages. A global blob store would disturb package-root
containment and frozen package paths for this small saving. Keep immutable
packages self-contained; no global filesystem cache or deduplication rewrite is
justified by these figures.

The existing loader already bounds manifest reads, checks real-path containment,
preflights decoded memory before binary loading and uses the native decoder's
content/dependency validation. A second manifest-validation implementation would
duplicate these contracts. `conversion-report.json` supplies descriptor-only
bounds and counts for navigation; rendering still requires the actual registry.

Reproduce a current family-size census from repository root after the build
(Node ESM script; PowerShell can pipe a single-quoted here-string to
`node --input-type=module`):

```js
import fs from 'node:fs';
import path from 'node:path';
import {assetPackageDecodedBytes} from './shared/animlib/dist/asset-package.js';
const root = 'shared/animlib/fixtures/biological', totals = new Map();
function visit(dir) {
  for (const item of fs.readdirSync(dir, {withFileTypes:true})) {
    const file = path.join(dir, item.name);
    if (item.isDirectory()) { visit(file); continue; }
    if (!file.endsWith('.json')) continue;
    const m = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (m.version !== 1 || !['model','image'].includes(m.kind) || !m.hash) continue;
    const family = path.relative(root,file).split(path.sep)[0];
    const row = totals.get(family) ?? {packages:0, decodedBytes:0};
    row.packages++; row.decodedBytes += assetPackageDecodedBytes(m);
    totals.set(family,row);
  }
}
visit(root);
console.table(Object.fromEntries([...totals].sort(([a],[b])=>a.localeCompare(b))));
```

## Bounded peptide hold-cache candidate

The frozen revision-3 staged proof already caches each pose and both geometry
representations once per exact sample time. Its prescribed packing saturates
after 6.6 seconds; the atomic and tube representations then remain stationary
while opacity and camera motion continue. The current cache still rebuilds both
representations for every distinct later time, including the 8.2–10 second
surface-only hold.

The proposed scene-only change is to clamp **only the expensive geometry
sampler's local cache key** at 7 seconds. This safely follows the actual binary
floating-point completion of `4.2 + 2.4`. Caller opacity, surface reveal, camera
motion and timeline time keep their original values. The cache retains a single
entry and is overwritten normally on an earlier seek; it does not accumulate
frames or change the public pose factory.

`tools/benchmark-peptide-hold-cache.mjs` asserts exactly one known source marker
before applying the transform in memory. It compares SHA-256 of complete frame
JSON, including hidden geometry and camera state, at 103 distinct times covering
0–10 seconds in 0.1-second steps plus adjacent representable values around 7.
It also visits each time after an unrelated early seek, in reverse order. These
are 309 equality assertions across baseline reversal, optimized forward and
optimized direct/reverse samples. Frozen source, assets and films remain intact.

```powershell
New-Item -ItemType Directory -Force data/animlib-expansion/tmp-org | Out-Null
$env:TEMP=(Resolve-Path data/animlib-expansion/tmp-org).Path
$env:TMP=$env:TEMP
node shared/animlib/tools/benchmark-peptide-hold-cache.mjs data/animlib-expansion/tmp-org/peptide-hold-cache-interleaved.json
```

On this Windows sandbox, the existing asset loader's `realpath` call was denied;
the benchmark ran with narrowly scoped normal-host access without bypassing
validation. It writes only the requested measurement JSON. CPU wall measurements
include evaluation and full JSON serialization, not rendering or GPU work. Both
contexts remain live for the timed phase; measurement order alternates for each
time to reduce sequential run bias. Host scheduling and garbage collection still
affect the result. This does not certify realtime playback or source-style parity.

Fresh interleaved run: all 309 complete-frame equality assertions passed; final
registry leases and pinned bytes were zero. Each phase used five warmup samples,
then 93 measured samples at 31 distinct times repeated three times.

| Phase | Original median / p95 ms | Local cache clamp median / p95 ms | Maximum complete-frame string units, unchanged |
| --- | ---: | ---: | ---: |
| Moving packing, 4.3–6.4 s | 72.96 / 76.13 | 73.06 / 75.49 | 1,210,793 |
| Settled geometry still visible, 7.1–8.1 s | 73.90 / 78.15 | 51.10 / 53.76 | 1,206,607 |
| Surface-only hold, 8.3–9.9 s | 74.85 / 87.50 | 51.80 / 61.07 | 1,206,484 |

Both held phases improved about 31% in this run; the moving phase is essentially
unchanged. Complete frame serialization remains expensive and its size is not
reduced. These complete-frame string lengths are not reactive-update payload
lengths and do not demonstrate a violation of the separate 1 MiB update limit.
An earlier sequential run was materially affected by concurrent host work and
showed a slower settled-visible candidate; the table uses the interleaved rerun
rather than presenting that first run as a universal speedup.

Source hashes are `a6c343a711b71289ae39287a3998ade6357adc9a7d1c54352e1ae460f997c3da`
before and `94925609b0e6d52016d69ebf3d62635c77f0d910d4b8264af0a85bfff1fc67ac`
after the in-memory cache transform. Measurements and all sample times are in
`data/animlib-expansion/tmp-org/peptide-hold-cache-interleaved.json`. The root
implementer receives the precise transform and benchmark for independent review
before applying it to the new revision-4 generator. This worker changes no
production scene or runtime implementation.

## Next scaling concern, not a completed optimization

The compiler constructs its QuickJS bootstrap by calling `toString()` on every
domain factory and embedding all of them for every scene, including scenes that
do not use biological helpers (`src/compiler.ts`, `__domainFactories`). Expanding
the library therefore increases per-compilation bootstrap work independently of
a scene's own complexity.

During this pass root reported an integrated 962-test run with 961 passing and
the neural-trajectory proof reaching the existing 200 ms VM wall-clock compile
deadline under concurrent builder/renderer load; its isolated rerun passed. This
is evidence of deadline pressure, not proof that eager factory injection caused
that specific failure. No deadline was raised and no assertion was relaxed.

A follow-up should measure empty-scene versus neural-scene compilation and
separate host string construction from VM parse/bootstrap and scene execution.
Only then consider caching the immutable bootstrap text or a carefully bounded
factory-loading design. Any change must preserve the public helper environment,
input rejection, default deadline, memory limit and host/VM parity. A speculative
compiler refactor during concurrent feature work is not part of this delivery.

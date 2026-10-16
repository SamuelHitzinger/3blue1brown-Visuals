# Retained parameter browser publication and renderer profile

2026-10-16. **Local publication evidence, not model speed or visual acceptance.**
This extends the [ten-case parameter checkpoint](parameter-trial-checkpoint.md).
The ten-second end-to-end goal remains unverified.

## Actual browser publication

`backend/bench/parameter-browser-fixture.ts` serves the unchanged lecture browser
on loopback port 5368, using the production resolver for compiled animlib modules.
It supplies scripted transcript/tool output, never starts capture, ASR inference
or a provider, and labels the page **OFFLINE SCRIPTED FIXTURE**. The API is bounded,
same-origin, serial, write-once and limited to one run per new output directory.

Each run sends synthetic speech with source offset 885 seconds and actual host
clock timestamps. After an accepted add renders, the next utterance requests a
retained parameter change. After that revision renders, a third utterance requests
the same value. The third request captures the actual browser's world summary and
committed journal. The no-op must retire without another revision or coverage.

All three selected browser runs completed:

| Case | Required construction | Changed value | Synthetic cue-end → parameter render submission, clock bounds | World commit → render submission |
| --- | --- | --- | --- | --- |
| `slope-low` | Simple 2D line, 17 samples | Slope 0.5 → 1.25 | 189.96–194.86 ms | 1.60 ms |
| `saddle-high` | Transparent surface, 1,681 vertices, 3,200 triangles; both traces retained | Curvature 0.4 → 0.8 | 233.16–238.36 ms | 13.50 ms |
| `caffeine-high` | Complete 24 atoms, 25 bonds, 29 bond strokes, 3,072 atom triangles | Rigid display rotation 0.15 → 0.65 | 215.66–220.26 ms | 6.80 ms |

These are one successful run per case, not latency distributions. The cue interval
includes local scheduling/HTTP/commit/render overhead with zero ASR/model work;
it cannot be compared to model-generated timing as a speedup. Add cue-to-render
upper estimates were 316.37, 413.36 and 368.32 ms respectively, under the same
scripted-input limitation. Rendering used WebGPU. Hardware presentation is null.

The persisted requests verify the same program identity and epoch, the original
clock element's rotation, changed parameter value, unchanged controls/ownership,
same exposed entity IDs, and exact add/parameter journals marked rendered.
Receipts show revisions 1 and 2 only, then no-op retirement without coverage.
The browser context deliberately omits full geometry: this is not a browser
topology oracle. The earlier native analytic/frame checks remain separate evidence.
For caffeine, all 79 global entity IDs are exposed, while the per-program list
explicitly omits 47; that bounded list is not a complete ownership inventory.
Final screenshots show the resulting constructions, not a blinded full-motion
quality verdict or proof of explanatory value.

Evidence under `data/realtime-workshop/parameter-browser-fixture/`:

- `slope-low-04/`, `saddle-high-01/`, `caffeine-high-01/`: raw requests, accepted
  scripted responses, events, browser receipts, result and `browser-result.jpg`.
- `browser-audit.json`: root assertions, exact timings and all receipt/image hashes.
- `summarize.ts`: local report reproduction; output is write-once.
- Browser main SHA-256: `2722472dc94c40dcb0f833ffc6d85eb14c925549f8fede44874738d3419bf3e3`.
- Fixture SHA-256: `bbfea61626f254a8eebdfc50dd96eb8a2401c25e70b7495253c641c44b455ae2`.

The first sandboxed server was unreachable from the browser; its process was
stopped and the loopback-only server relaunched outside the sandbox. Two actual
failed runs remain preserved: `slope-low-02` sampled a scheduling clock twice,
producing 0.0006 ms of inconsistent timing; `slope-low-03` reached revision 2 but
its third synthetic dispatch preceded the mapped endpoint by roughly 10^-10 ms.
The fixture now derives scheduled endpoints from one clock sample, uses the
consumer's exact source-to-host mapping, waits for readiness, and stamps observed
release time. Regressions use advancing/fractional clocks and real replay ingestion.
**Production speech validation, replay and browser code were not weakened or edited.**

Reproduce one run from repository root with a fresh directory:

```powershell
./node_modules/bun/bin/bun.exe backend/bench/parameter-browser-fixture.ts saddle-high data/realtime-workshop/parameter-browser-fixture/saddle-high-NEW
```

Open `http://127.0.0.1:5368/` and click Start once. Inspect the saved result, then
Stop; use a fresh process/output directory for another case. This is a test server,
not the live lecture service at port 5366. Completed probe processes were stopped.

## Current local renderer costs

The existing offscreen WebGPU profiler initially failed all three parameterized
sources before rendering: it called mixed parameter/time callbacks with `{}`.
The narrow worker fix passes authored control values and rejects a false render
return. A regression compares mixed bindings against an independent control-free
equivalent, requiring matching packed geometry, changing pixels and actual submits.
No renderer caching, appearance, topology or production runtime was changed.

Twenty measured frames after three warmups, original source defaults/detail:

| Case | Sample median | Render CPU median / p95 | Total GPU upload bytes/frame | New GPU buffer bytes across measured frames |
| --- | --- | --- | --- | --- |
| `slope-high` | 0.191 ms | 0.389 / 0.464 ms | 1,360 | 0 |
| `saddle-high` | 1.787 ms | 3.859 / 6.266 ms | 3,166,112 | 0 |
| `caffeine-high` | 1.118 ms | 1.929 / 2.420 ms | 4,416 | 0 |

Caffeine streamed zero geometry bytes; its writes were uniforms. The transparent
saddle and traces streamed 3,165,696 geometry bytes per frame. Opaque geometry
already has retained GPU meshes; transparent geometry still pays packing/upload
cost. These results do not justify dropping transparency or scientific detail.
They support keeping model-output reduction ahead of a renderer migration while
treating geometry packing as a separately measured optimization opportunity.

Evidence: `data/realtime-workshop/parameter-render-profile-02/` contains raw frame
counters, timings, source/dist hashes, numeric fixture audits and reproduction
scripts. Initial failures remain in `parameter-render-profile-01/`. Renderer dist
SHA-256: `6625b8dc134d9a4cab69b6d666f609e92de8cf3ad066788171ff167809cfae4f`.

Scope: offscreen 1280×720, times 0.05–0.3667 seconds, completion fence after each
frame, current compiled dist, no parameter transaction. These are CPU wall times
and submission counters, not isolated GPU execution, display latency, continuous
playback throughput or model latency. A separate contemporaneous default-adapter
probe identified NVIDIA GeForce RTX 5080 / D3D12; worker JSON omitted inherited
adapter-name fields. Component-pass timings use separate caches and are not additive.

## Verification and remaining work

Root verification: **22 tests passed, zero failed, 1,205 assertions** across the
fixture, native profiler and speech-integration suites. Strict targeted TypeScript
checking and whitespace checks passed. Independent review verified both clock
fixes; actual browser reruns verified the previously failing paths. Independent
inspection also checked all three persisted request/receipt chains and the surface
and molecule screenshots, finding no new issue or obvious viewport-edge clipping.

Remaining acceptance includes real model/ASR runs, the broader subject/detail
matrix and unseen holdouts, continuous/blinded visual review, and full measured
source-to-visible latency. Scripted browser success does not discharge those gates.
Provider upload approval and the separate GitHub destination approval remain pending.

# Live asset gap and transferable mechanisms

2026-10-16. Independent local audit and public primary-source research support
keeping the existing renderer and reducing model output through retained object
references, procedural definitions and named timing cues. No cited system proves
arbitrary scientifically correct lecture-to-animation output within ten seconds.

## Concrete integration gap

The local index already provides bounded search, stable IDs, provenance, native
registries and static published GLB payloads. However, the joined lecture prompt
explicitly forbids external assets, exposes only `submit_world`, and supplies no
retrieval results. Its client constructs `LiveWorld` without model metadata or
native assets and `CanvasRenderer` without a `ModelStore`.

Relevant code: `backend/bench/realtime-media/asset-index.ts`,
`backend/bench/realtime-lecture-join.ts`,
`backend/bench/realtime-lecture-view/main.ts`, and
`backend/bench/realtime-world/world.ts`. The world snapshots model metadata at
construction; existing `ModelStore.register` alone cannot make a new ID visible
to the running world's compiler. Also, `CanvasRenderer.prepare` does not perform
`ModelStore.prepare`; the host must await both before publication.

The [local index checkpoint](realtime-local-asset-index-2026-10-16.md) measured
52 records and sub-millisecond cached lookups. The actual 90,004-triangle static
model [CPU integration result](realtime-asset-world-2026-10-16.json) records
101.22 ms world-add time, including 62.01 ms model preparation. Do not sum nested
timings. These observations exclude model choice, GPU submission and presentation.

The smallest useful next integration test snapshots a bounded static inventory
before world construction, retrieves compact candidate descriptors for incoming
evidence, and lets the existing single submission reference a supported asset ID.
Bytes stay host-side. Wire metadata, model preparation and renderer resolution
together, then verify a retained edit preserves motion without repeated decoding.
Include an absent-match case. This tests preselected inventory; genuinely new
mid-session assets require a separate transactional registration design.

Clip playback is a separate missing capability. The installed corpus has zero
clips; the index declares `clipPlayback:false`, and the native parser rejects
animations and skins. Clip-name retrieval must not be advertised as playback.

## Existing systems worth borrowing from

| System | Useful mechanism | Boundary |
| --- | --- | --- |
| [Vega View API](https://vega.github.io/vega/docs/api/view/) | Retained signals/dataflow, batched changesets and asynchronous evaluation boundary | Primarily 2D; evaluation completion is not presentation or semantic correctness |
| [MathBox](https://raw.githubusercontent.com/unconed/mathbox/master/docs/intro.md) | Separate sampled data, coordinate systems and drawing primitives; procedural expressions and property animation | Architectural reference; concise expressions can still describe the wrong phenomenon |
| [MolViewSpec selectors](https://molstar.org/mol-view-spec-docs/selectors/), [MolQL](https://molstar.org/mol-view-spec-docs/molql/), [animations](https://molstar.org/mol-view-spec-docs/animations/) | Semantic atom/residue references, representations and interpolated named properties | Correct structures, numbering and scientific representation still require validation; interpolation is not molecular dynamics |
| [Three.js GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html), [AnimationMixer](https://threejs.org/docs/pages/AnimationMixer.html), [AnimationAction](https://threejs.org/docs/pages/AnimationAction.html) | Clip extraction, cached actions, seeking, scheduling and crossfades | Requires a relevant validated clip and a playback adapter; current native route is static |
| [Motion Canvas time events](https://motioncanvas.io/docs/time-events/) | Named events separate scene logic from numerical cue times | Documented editor-positioned events do not solve live ASR alignment or corrections |

The [glTF specification](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html)
allows optional names and application metadata, but names need not be unique.
Use asset hash/ID plus clip index or verified reference for identity. Scientific
meaning, units, provenance and suitable operations require validated descriptors.

Next comparisons should test compact retained operations against full-program
authoring on graphs, surfaces and molecular scenes, including corrections. Reuse
existing builders and scheduler. Measure generation, validation/preparation,
first useful frame and completed explanation separately. Token reduction and
latency improvement remain hypotheses until visual and scientific gates pass.

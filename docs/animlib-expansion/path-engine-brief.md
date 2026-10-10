# Path animation and shared helper integration

Read `design.md`, `neuroscience-quantum-reference.md`, and
`math-algorithm-reference.md`. All work stays on `amilibsam`; root serializes
commits. User authorized autonomous development and repeated visual evaluation.

## Scope and ownership

Own focused engine changes for retained point paths, arc-length stroke reveal,
and dashes; integrate completed domain factories into the scene environment.
Owned shared files: types.ts, runtime.ts, compiler.ts, reactive.ts, timeline.ts,
path.ts, render-geometry.ts, bounds.ts, render-validation.ts and related focused
tests as necessary. Avoid changing GPU shader/backend files unless root agrees.
Do not edit domain implementation modules owned by math/molecular workers.
Keep helpers and pure path calculations in focused modules, not growing runtime.ts
with large algorithms. Coordinate exact interfaces before integration.

## Retained points

Add `points?: Position[]` to supported reactive properties for point-authored
path/line/arrow geometry. Count remains fixed and order meaningful; validate every
coordinate and preserve existing scene/point limits. Reject SVG `d` geometry,
incompatible targets, nonfinite points, and topology/count changes. Clone or
otherwise preserve canonical scene input; cached geometry/bounds must update when
points change. Test actual SourceCompiler/SceneSequence update and direct/reverse
seeks, ordinary controls, compiler worker serialization, and offline sampler.

## Stroke reveal and dashes

Pin exact typed public API in `path-engine-design.md` before coding. Proposed
geometry properties are `strokeStart`/`strokeEnd` normalized arc-length bounds,
with immutable original path geometry and timeline/retained scalar updates; use
consistent names with existing animation APIs. Zero length reveals no stroke;
full [0,1] preserves existing pixels. Arrowheads follow the currently visible tip.

Reveal follows cumulative local arc length of the actual flattened path; it must
not fade/scale full geometry. Define disconnected contour handling explicitly.
Closed path fill behavior must be explicit and preserve original shape fill unless
the API deliberately controls it. Tests cover unequal segments, coincident points,
closed contours, smooth/SVG paths, exact endpoints, arrows and random seeking.

Add declarative positive finite dash pattern plus finite phase in local world
distance (screen-space elements use their existing screen coordinate units).
Pattern/phase must move coherently with object transformations and compose with
stroke range without reset at every sampled segment. Bound generated fragments
before allocation. Never make each dash a separately authored scene element.

Use shared CPU geometry preparation so both rendering backends consume the same
triangles. Audit cached geometry, bounds, shadows, morphs and picking where the
current engine supports them. Reject unsupported combinations precisely rather
than silently displaying the wrong geometry.

## Helper integration

Math factory signatures are pinned in `math-implementation.md` by math_builder:
`createCoordinateBuilders(s)`, `createGraphAlgorithms()`,
`createGraphBuilders(s, algorithms)`, `createCollectionBuilders(s)`; names approved
by root: `s.plane`, `s.graph`, `s.collection`, `s.paths`, and
`s.dijkstra(data, source)`. No extra path utility is required by these helpers.
Read actual completed files and
coordinate with author; do not invent signatures from this preliminary list.

Graph weight labels require `s.attach(target, source, {anchor: 'midpoint'})`.
Follow the exact transformed endpoint midpoint contract and failing regression in
`math-implementation.md`; origin attachment remains the default.

Molecular signatures are pinned in `molecular-implementation.md`:
`createMolecularBackboneBuilders(createMoleculeBuilders())`. Expose
`s.molecularBackbone(id, props)` convenience mesh group,
`s.molecularBackboneGeometry(props)` pure result for retained mesh rebuilds, and
`s.articulatedChainPose(spec,time)` pure positions. Integrate only completed
modules and keep host and QuickJS behavior consistent. Add public core exports,
SceneContext types and runtime assembly through self-contained factories. Shared
modules must work under default 200 ms compilation and existing 256 KB source cap.

## Original science proofs

After engine primitives pass tests, provide two separate 5–8 second proof sources:
Artem-inspired event rows→rate traces→state vector; Visually Explained-inspired
logistic prediction/residual with real dashes and local error annotation. Reuse
new coordinate helpers; keep palettes/styles distinct. Use deterministic data
and the same calculated values for all corresponding objects. Sample entire
motion densely and keep ≥0.7 s result hold. Independent evaluator reviews later.

If proof authoring exceeds this task's coherent scope, finish engine/integration
and report exact handoff; root will assign dedicated science author. Do not leave
unreported integration gaps or claim the references matched.

## Verification and report

Regression-first meaningful tests; baseline 664 unit tests plus six new offline
sampling tests. Typecheck/build. Native WebGPU and WebGL visual check for new path
semantics. Existing GPU baseline has four failures recorded in progress.md; do
not hide new failures among them. Process TEMP/TMP may need workspace data path.
Report command results, ownership, APIs, output paths and limits in
`path-engine-report.md`; root assigns fresh review.

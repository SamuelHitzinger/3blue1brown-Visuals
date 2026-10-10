# Mathematical and graph helper implementation

Read `design.md` and `math-algorithm-reference.md`. Stay on `amilibsam`; root
serializes git commits and shared compiler/runtime wiring. Distinct artist styles
remain in proof scenes, not universal defaults.

## Owned deliverable

Create focused modules under `shared/animlib/src/diagrams/`, domain types in that
directory, matching `test/diagrams*.test.ts`, and original proof sources under
`shared/animlib/demo/expansion/`. Own math/graph/collection files only. No compiler,
runtime, core, types.ts, reactive.ts, or renderer edits; send required integration
signatures to root early. Implement self-contained factory functions suitable for
QuickJS installation, receiving the existing SceneContext/handles. Host tests can
use real buildScene with an adapter to exercise helper behavior before integration.

Pin signatures and a short implementation sequence in `math-implementation.md`
before coding. Prefer separate reusable modules over a monolithic helper file.

### Coordinate world

Provide a reusable coordinate plane with explicit ranges, world origin/scales,
axes/ticks/grid, and toWorld conversion. Construct vectors, components, sample
curves, and an original/transformed grid from the same source coordinates.
Mapping must preserve meaningful vertex correspondence and label legibility.
Do not replace the existing LaTeX part/anchor APIs.

The first 3–8 second proof applies one shear to grid, basis, unit square, and an
identified vector. Retain quiet original scaffold. Local algebra/color roles must
follow the actual construction. Another operation can use rigid rotation to prove
length preservation; never fake rotation with endpoint interpolation.

Tests assert M(t)p for t=0,.25,.5,.75,1, origin stability, grid parallelism, and
weighted basis decomposition. Validate finite ranges, sampling ceilings, singular
but valid maps, reversed/nonmonotonic time, and object identity.

### Graph and collection identity

Separate immutable graph/event data from visual handles. Implement a useful
weighted directed/undirected graph with stable node/edge IDs, attached labels,
surface-connected edges, and explicit semantic state. If self-loops/parallel
edges are unsupported, reject them clearly rather than drawing misleading edges.
Use existing attach/connect and numeric slots. A small deterministic Dijkstra
trace helper can expose pop/relax/frontier events; test cycles, cheaper alternative
route, duplicate candidates, unreachable nodes, and reject negative edge weights.

Collection helpers separate item ID from slot/value. A pair swap follows opposing
arcs with explicit clearance; duplicate values must retain distinct IDs. Path
transport is absolute-time and preserves exact endpoints. Test midpoint clearance
and direct/backward sample equivalence. Keep this module only if it can be shipped
as a focused testable unit; report remaining proposal gaps explicitly.

### Reveal dependency

Arc-length reveal and reactive path points are shared engine needs. Do not work
around them with a full-path fade or fake coordinate scaling. Specify exact
required path update/reveal contract to root. You may implement a pure bounded
polyline prefix/point-on-path utility locally, but central runtime integration
will be assigned separately.

## Proof and report

Write tests first; observe intended failures, then implement. Use native scene
objects/timeline and actual renderer. Style contract first, then short proof,
native setup/interior/endpoint frames and encoded motion. Infrastructure agent
is repairing export sampling; coordinate before depending on retained callbacks.

Do not claim broad channel fidelity: reference report is an initial sparse
creator study with dense local approved baseline. Independent evaluator will
inspect more actual reference passages and original proof before acceptance.

Baseline 664 unit tests, typecheck/build pass. Process TEMP/TMP if needed:
`C:\Users\samue\Stuff\3yellow3white\data\animlib-expansion\tmp`.
Write commands/results/changed files/proof paths/limits to
`math-implementation-report.md`. Root sends fresh reviewer after implementation.

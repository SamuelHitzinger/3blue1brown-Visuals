# Math, graph and collection implementation report

2026-10-11, branch `amilibsam`. No commits, pushes, merges, branch switches, or
shared engine file edits by this worker. Root requested release of the worker
slot after source/API handoff; production rendering follows engine integration.

## Delivered

- `shared/animlib/src/diagrams/coordinates.ts` and `coordinate-types.ts`: one
  coordinate source for bounded grids, axes, ticks, vectors, components, paths,
  sampled curves and upright local labels. One retained map updates corresponding
  points from captured source coordinates; later additions inherit that map.
  Explicit world origin and nonuniform scale; singular maps remain valid.
- `graphs.ts` and `graph-types.ts`: immutable graph snapshots and deterministic
  Dijkstra events including pop, relax, stale candidates and frontier snapshots.
  Stable tie order, predecessor node/edge IDs, unreachable Infinity, bounded
  frontier snapshot allocation. Native visual nodes, attached labels, surface
  edges, exact static weights, mutable numeric cost slots and explicit semantic
  authoring states. Loops, parallel and reciprocal overlapping straight edges
  are rejected rather than misdrawn.
- `collections.ts` and `collection-types.ts`: stable IDs independent of values
  and slots, ordinary native groups, absolute-time opposing parabolic swap arcs,
  exact endpoints, explicit midpoint edge clearance and ordered swap schedules.
  Duplicate values remain distinct.
- Four tests: `test/diagrams-coordinates.test.ts`, `diagrams-graphs.test.ts`,
  `diagrams-collections.test.ts`, `diagrams-production.test.ts`.
- Original integrated proof sources under `shared/animlib/demo/expansion/`:
  `shear.js` (6.5 s), `graph-relaxation.js` (7 s), `collection-swap.js` (4 s),
  corresponding `*-manifest.json`, and `math-style-contract.md`.

Pinned APIs and integration contracts are in `math-implementation.md`. Root
approved source APIs `s.plane`, `s.graph`, `s.collection`, `s.dijkstra`.
Factories use type-only imports and are self-contained for QuickJS installation;
graph scene factory receives the algorithm factory result explicitly.

## Test evidence

1. Before implementation, ran `npm test -- --run
   test/diagrams-coordinates.test.ts test/diagrams-graphs.test.ts
   test/diagrams-collections.test.ts` from `shared/animlib`: all three suites
   failed with the intended missing new modules.
2. After initial implementation, the same command passed 8 tests. Corrections
   included the existing palette spelling `GREY` and an explicit host adapter
   for the not-yet-integrated reactive point dependency.
3. Added moving graph midpoint regression and observed the intended failure:
   weight x = 0 instead of connected midpoint x = -1. Added reciprocal-edge
   rejection regression, observed it fail, then implemented explicit rejection.
4. Latest host run: **10 passed, 1 failed**. Sole failure is the midpoint
   attachment regression assigned to the path engine worker. Includes t =
   0/.25/.5/.75/1 and backward sampling; weighted basis decomposition; source
   capture and later mapped members; rigid rotation length; singular map;
   sample/range budgets; negative/nonfinite weights; cycles; cheaper route;
   stale duplicate; unreachable nodes; unusual IDs; duplicate-value clearance;
   ordered sequential swaps and overlap rejection.
5. `npm run build` passed after the final helper changes.
6. `npm run typecheck` had no diagram errors after local corrections; that run
   was blocked by a concurrent molecular worker's then-missing new type module.
   Root should run the final whole-workspace typecheck after integrations settle.
7. `npm test -- --run test/diagrams-production.test.ts`: **3 intended failures**,
   each `SceneCompileError: not a function`, before new scene APIs are installed.
   Tests read the actual proof sources and will verify VM/interior geometry,
   unchanged originals, upright labels, cost correspondence, and reverse seeks.

## Integration handoff

Path engine worker received exact module names, types, signatures and test files.
Required changes outside this worker's ownership:

- Retained `points` on native point-based path/line/arrow geometry, finite and
  budget validated, preserving point order/cardinality. No shape-morph substitute.
- `s.attach(...,{anchor:'midpoint',offset})` after connector endpoint resolution,
  including source world transform and target parent inverse. Graph helper
  already requests the option; old runtime currently ignores it.
- Install factories/source APIs in host/QuickJS and export host factories/types.

No local path-prefix utility was needed; engine reveal work remains centralized.

## Visual evidence and remaining limits

Read the explanation-style skill, baseline and review gate. Inspected all three
bundled images with the image tool. Reference operations/evidence are recorded in
`math-algorithm-reference.md`; no additional creator frames were inspected by
this implementation worker. Artist contracts remain in proof sources/docs.

**No native proof frames or encoded clips have yet been rendered by this worker.**
Root explicitly deferred rendering until integrated engine APIs are available,
avoiding a temporary factory-wrapper rendering route. Four proof verdicts are
therefore **unverified** pending actual native output and independent review;
unit tests are not style evidence. Use the existing production `render-frames.mjs`
and `render-video.mjs` tools with the proof sources/manifests after integration.

Collection scope is deliberately a focused pair-swap unit. Arbitrary reorder,
queue enqueue/dequeue, stack operations, index pointers and comparison emphasis
remain proposal gaps. Coordinate maps are bound once; nonlinear maps preserve
sample correspondence but are not adaptive curve refinement. Plain labels stay
upright but caller positioning remains responsible for collisions. Dijkstra
limits: 256 nodes, 2048 edges, 100,000 total copied frontier records. Native scene
object limits still apply independently. Mutable cost display uses the existing
six-digit integer slot ceiling; algorithm distances can exceed it. Graph states
are explicit authoring records, not inferred sampled-time algorithm states.

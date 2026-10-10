# Pinned math/graph/collection implementation

All factories are self-contained and installable with `.toString()` in QuickJS.
They receive the existing SceneContext and create ordinary handles. Root owns
compiler/runtime/type integration; no alternate scene graph or timeline.

- `createCoordinateBuilders(s).plane(id, options)` with xRange/yRange, origin,
  scale, step, grid/axis/tick styles. Returns `toWorld`, stable `grid`, `axes`,
  `ticks`, `path(id, points, style)`, `vector(id, endpoint, style)`,
  `components(id, endpoint, styles)`, `curve(id, fn, range, samples, style)`,
  `label(id, tex, point, offset, style)`, `map(dependencies, fn)`.
  Mapping captures source coordinates; all subsequently created geometry shares
  the same map. Labels bind position independently so glyphs never shear.
- `createGraphAlgorithms().graph(data)` validates and snapshots immutable node/
  edge data; `dijkstra(data, source)` returns frozen pop/relax/stale/frontier events,
  distances, predecessors. Stable input order breaks equal-cost ties.
- `createGraphBuilders(s, createGraphAlgorithms()).graph(id,data,options)` returns node/edge/weight/cost
  handles keyed by semantic ID. Edges use surface `connect`; node labels use
  `attach`; `state(node,state,style)` produces explicit state plus native actions.
  Costs use existing numeric slots. Reject loops and parallel edges.
- `createCollectionBuilders(s).collection(id,items,options)` separates ID, value,
  and slot. `swap(a,b,{start,duration,clearance})` installs absolute-time opposing
  parabolic arcs with exact endpoints; tracks authoring slots separately from
  sampled motion. Initial unit supports swaps, not arbitrary queue operations.

Sequence: invariant tests (observe missing API failures); bounded coordinate
factory; graph data/trace and scene factory; focused collection swaps; typecheck;
QuickJS integration tests after root installs factories; native 6-second shear
proof and production renderer frames/video; independent review by root.

Required engine dependency: `s.bind` supports `points` on point-based path, line,
arrow geometry, preserving input point order and constant cardinality with finite
coordinate/budget validation. Root owns arc-length reveal; no full-path fade or
coordinate scaling substitute. Collection binds ordinary position only.

Additional exact binding dependency: `s.attach(target, source, {anchor?: 'origin' |
'midpoint', offset?: Position})`. Default origin preserves current behavior.
`midpoint` means the midpoint between a line/arrow's already-connected endpoints,
converted through source world transform then target parent inverse, followed by
the existing world-space offset. Example: `s.attach(weight, edge,
{anchor:'midpoint',offset:[0,.18]})`. Graph weights use this; no origin-based
substitute is valid during node layout motion. Root owns this narrow integration.
No separate path utility implementation is currently needed by these helpers;
the engine worker may own `s.paths` with reveal utilities.

Pure source API `s.dijkstra(data, source)` is approved. Graph data is limited to
256 nodes/2048 edges; trace snapshots stop at 100,000 total frontier records.
Unreachable distance is Infinity in algorithm data (never sent as geometry).
Static weights render exact strings; mutable cost labels default to six integer
digits and the maximum edge decimal precision capped at four places. Optional
`costFormat: {decimals?: number, digits?: number}` accepts 0–4 fractional places
and 1–6 integer digits. Values finer than the selected precision are rounded;
algorithm distances remain full precision. Native countTo validates overflow.
Opposite-direction edges sharing the
same node pair are rejected along with parallel edges because straight arrow
overdraw would be misleading. Cycles through three or more nodes remain valid.

# Stable RNA processing and pore transport

`s.nucleicSplice(props, progress)` and `s.nucleicThread(props, progress)` return
fresh schematic anchors and explicit bonds. The host equivalents are on
`createNucleicProcessingBuilders()` from `animlib/core`. Neither creates scene
elements: bind retained meshes to returned anchors, and display only the
returned bond identities. Progress is finite in `[0,1]`; arbitrary seeks are
history-free. Input arrays are never modified.

Splice input contains `sites:[{id,base,position}]`, an inclusive interior
`intron:{start,end}`, `initialNormal`, `baseReach`, `joinDistance`, and
`departure:{translation,axis,angle}`. Optional ordered `phases` default to
`{cut:.2,closeEnd:.7,departEnd:.95}`. There must be at least two sites in each
fragment. Before `cut`, the original adjacent graph is intact. At the cut, both
boundary edges disappear. The two exon fragments translate symmetrically so
their cut anchors reach `joinDistance`; only at `closeEnd` is the replacement
exon edge added. The removed interval rotates around its own centroid and
translates independently. Each fragment preserves every internal distance.
An intron may start as an authored curve, but this operation does not compute
biochemical loop/lariat formation or a flexible pre-cut conformation.

Results include `anchors`, `bonds`, `retainedIds`, `removedIds`, `cutEnds`,
`phase` and the measured current exon `joinDistance`. Before cutting, `cutEnds`
is empty. While closing it contains left-exon end, first-intron end,
last-intron end, right-exon end in that order. After joining, only the two
removed-intron ends remain free.

Thread input contains `sites:[{id,base,offset}]`, an authored `path:Vec3[]`,
`initialNormal`, `baseReach`, and
`aperture:{center,normal,radius,halfThickness,chainRadius}`. Offsets are strictly
increasing, starting at zero; the first site is the leading site. The helper
calculates exact cumulative polyline lengths. One smooth progress parameter
moves all sites along this same path with exact constant arc offsets. Positions
are continuous and frames are parallel transported; within a segment, a minimal
rotation carries the preceding vertex frame to the interpolated tangent.
There is no linear interpolation of opposing normals. Sharp position-path
corners remain corners: use a sufficiently dense authored path for visual
smoothness. Constant arc offsets do not imply constant Euclidean bond lengths.

The whole path must be strictly increasing along the aperture normal and cross
the complete membrane slab once. Every segment is clipped analytically to the
slab expanded on both faces by `chainRadius`. Its two clipped radial endpoints
must fit inside `radius-chainRadius`; convexity ensures the entire intervening
segment also fits. Outside that expanded slab, normal separation alone protects
the swept radius. This conservative test protects the entire authored polyline
plus its radius, including approach to the faces; it can reject safe paths near
the circular rim. It does not validate straight rendered bonds that shortcut
polyline bends: tessellate connections along the path when that matters.
`chainRadius` must
enclose `baseReach`. The path must fit the complete chain entirely on each side
at the two endpoints. Results include exact `arcCoordinates`, `signedSides`
(signed distance along the aperture normal), `pathLength`, anchors and bonds.
The returned clearance covers this authored centerline plus `chainRadius`, not
an arbitrary rendered mesh larger than the declared radius.

Both operations accept 2–128 dense sites with unique nonempty IDs of at most
120 characters and RNA bases A/C/G/U. Thread paths contain 2–512 dense points.
Coordinates are finite within ±100000; conservative full-schedule bounds also
reserve base reach. Splice rotation is within ±4π. Positive distances use a
minimum of `1e-5`; individual path segments and aperture dimensions are at most
10000, base reach/chain radius/join distance at most100. Offset gaps are at
least `1e-5`, offsets at most100000; normal progression per path segment is at
least `1e-6`. Frame vectors shorter than `1e-6` and corner/frame cosine below
`-0.95` are rejected. Initial normals parallel to the initial tangent are
rejected. Entire inputs/schedules are preflighted on every call, including at
progress zero. There is no collision solver outside the declared aperture.

See [proof generator](../demo/expansion/rna-processing-proof.mjs),
[types](../src/nucleic-processing-types.ts) and
[regressions](../test/nucleic-processing.test.ts). The proof reuses original CC0
rounded nucleotide/machinery assets and a separately reproducible original
membrane annulus. No reference pixels are used as assets.

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
translates independently. After the cut, each fragment preserves every internal distance.
Without `formation`, fragments remain rigid throughout, and the intron may start
as an authored curve.

Optional `formation:{start,end,angle,bendDirection}` bends an initially straight
bridge (left cut anchor, intron sites, right cut anchor) before cutting.
The bridge's material arc offsets remain fixed while its total bend angle grows
smoothly from zero to `angle`. Exons translate symmetrically; intron positions and
frames follow the analytic circular arc. At `end`, the conformation freezes for
the subsequent rigid cut, closure, and departure. This is schematic kinematics,
not a biochemical lariat or molecular dynamics model. Euclidean intron bond
lengths change during formation; only material arc lengths are constant.

Formation requires `0 <= start < end < cut`, `0 < angle <= 1.9π`, a nondegenerate
component of `bendDirection` perpendicular to the original bridge, and an
initial normal not parallel to that bridge. Bridge sites must be collinear and
strictly ordered. Each material interval may turn at most π/2, preventing sparse
chords from bypassing most of the arc. The final exon gap must accommodate
`joinDistance`. Stable sinc formulas preserve the straight limit; analytic frame
rotation has no half-turn singularity. Conservative whole-schedule coordinate
bounds are checked even at progress zero. The bridge length is at most10000.

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

The [current mathematical proof](../demo/expansion/rna-processing-3b1b-revision4-proof.mjs)
shows formation/cut/join and aperture passage using sparse native geometry.
[Independent review](../../../docs/animlib-expansion/rna-processing-3b1b-revision4-independent-review.md)
accepts both operations on reasoning, readability, current art and media gates.
Its versioned input JSONs reproduce the motion without old exports.
See [types](../src/nucleic-processing-types.ts) and
[regressions](../test/nucleic-processing.test.ts) for the complete contract.
The [first proof](../demo/expansion/rna-processing-proof.mjs) and
[cellular revision](../demo/expansion/rna-processing-revision2-proof.mjs) retain
optional original CC0 nucleotide, machinery and membrane assets. No reference
pixels are used as assets.

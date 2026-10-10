# Mathematical and algorithm animation reference investigation

Initial evidence pass, 2026-10-11, on `amilibsam`. This is a targeted operation study, **not a completed channel-wide survey**. No implementation is included in this change.

## Evidence and limitations

Read the explanation-style skill, `references/visual-baseline.md`, and `references/review-gate.md`; visually inspected all three bundled images. The approved components and derivative images are local authored reconstructions, not creator frames. The rejected sine image makes the user's rejection concrete: a bounded chart, centered changing equation, detached period note, and footer statement do not constitute the requested explanatory style.

Local motion source exists at `C:/Users/samue/OneDrive/Documents/ChatGPT/Explanation Video Skill/output/euler-animlib-0030-0100/film.mp4`. The following actual frame sheets were extracted with the existing imageio-ffmpeg binary and viewed. They are review evidence only, never output assets:

- [Whole approved clip, 2 fps](../../data/animlib-expansion/reference-evidence/approved-euler-2fps.png): row-major samples 0.0 through 29.5 seconds, six columns.
- [Component rotation, 4 fps](../../data/animlib-expansion/reference-evidence/approved-euler-component-4fps.png): row-major 2.5 through 4.25 seconds, four columns.
- [Translation and vector rotation, 2 fps](../../data/animlib-expansion/reference-evidence/approved-euler-vector-2fps.png): row-major 15.0 through 18.5 seconds, four columns.

The local source confirms motion timings; the sheets independently expose intermediate geometry. This modality is ordered dense frame inspection, not real-time audio/video playback. The whole-clip sheet is for continuity; use the two closer sheets for interior motion. The portable baseline supplies native full-size endpoint images for typography.

Live YouTube playback was accessible through the browser, without bypassing authentication. `video.downloadMedia` failed. Native screenshots and DOM media `currentTime` were used instead. Fast repeated seek attempts produced delayed/stale decoded frames and scrolling artifacts; those attempted 4:20–4:35 screenshots are **excluded** from temporal evidence. Player accessibility labels also lagged the actual playback time; the timestamps below use media `currentTime`. Browser screenshots are retained in this investigator's tool record, not exported into this directory. A fresh reviewer can reopen the exact timestamp links. No full-video or whole-channel coverage is claimed.

Existing `research/3b1b-transcripts` is extensive but establishes spoken content and source URLs, not animation quality. It must not be counted as visual inspection. Additional creator videos and sustained dense full sequences remain a later reference/review wave.

## Directly observed operations

### Approved local Euler construction

At 2.5–4.25 seconds, the original vector and component remain while a teal component copy rotates around the origin. Its label follows the changing direction; the multiplier travels toward the resulting expression. At 15–16 seconds, the orange segment and its expression translate coherently. At 16.5–18 seconds, a copied white resultant rotates while the original stays fixed. Both arrow lengths are preserved during rotation. The 18–22-second frames hold the resulting relationship. Around 22.5–23.5 seconds, the existing construction slides out while the derivative construction enters, rather than replacing the world with a title card. Later labels tie position and velocity to their vectors. This is the strongest dense motion evidence in this initial pass.

### 3Blue1Brown: basis transformation and algebra correspondence

Source: [Linear transformations and matrices, Essence of linear algebra chapter 3](https://www.youtube.com/watch?v=kYB8IZa5AuE). Original channel [3Blue1Brown](https://www.youtube.com/@3blue1brown). [Official lesson](https://www.3blue1brown.com/lessons/linear-transformations/) provides a corroborating written explanation, not a replacement for the frames.

Verified screenshot times: approximately 249/250, 255, 281.218, 291.739, 299.495, and 319.848 seconds. Playback ran between the latter observations, but the gaps are not densely sampled.

At [4:10](https://www.youtube.com/watch?v=kYB8IZa5AuE&t=250s), yellow v and green/red basis arrows share a full-frame plane. At 4:15 the transformed grid and arrows retain color roles. At [4:41](https://www.youtube.com/watch?v=kYB8IZa5AuE&t=281s), original basis arrows coexist with scaled/translated copies forming the yellow endpoint; unchanged coefficients remain in the algebra. At 4:51 a coordinate column appears beside its vector. At [4:59](https://www.youtube.com/watch?v=kYB8IZa5AuE&t=299s), colored columns enter a local calculation while the geometric referents remain. At 5:19 an interior grid transformation shows the neutral coordinate scaffold underneath. Exact easing/hold lengths remain unverified here.

### Reducible: graph traversal, cost records, attention state

Source: [A* Search: How Your Map Applications Find Shortest Routes](https://www.youtube.com/watch?v=88I6IidylGc), [Reducible channel](https://www.youtube.com/@Reducible). The visible description attributes animation to Nipun Ramakrishnan and Jesús Rascón and links [the creator's source repository](https://github.com/nipunramk/Reducible). This pass did not inspect that external source code.

Verified screenshot times: 273.315, 294.292, 313.274, and 326.968 seconds during uninterrupted playback of the Uniform Cost Search chapter beginning [4:12](https://www.youtube.com/watch?v=88I6IidylGc&t=252s).

At 4:33, purple numbered nodes retain their layout while yellow rings and edges mark traversal. At [4:54](https://www.youtube.com/watch?v=88I6IidylGc&t=294s), weighted edges and two upper-left frontier records show route, cost, and destination. At 5:13, node 3 and edge 0→3 are yellow while the remaining candidate 2 stays in its record. At [5:27](https://www.youtube.com/watch?v=88I6IidylGc&t=327s), the frontier has grown with route/cost/node records; graph positions are unchanged. Orange source, green goal, and yellow active state have separate roles. Sans-serif graph labels and purple background distinguish this work from the local Euler baseline. These sparse samples establish state correspondence, not precise transition easing.

## Existing animlib capability: preserve and reuse

The current library already supports most low-level mechanisms required here:

| Capability | Existing implementation | Consequence |
|---|---|---|
| Stable IDs, groups, scene carryover | `src/runtime.ts`, `src/sequence.ts`, `s.keep`, `s.previous` | Domain helpers should return ordinary handles; do not make a second scene graph. |
| Coordinated timeline and holds | `s.play([...], {duration,ease})`, `s.wait` | Reuse current deterministic timeline; pacing helpers should compile to it. |
| Rigid rotations | Group transforms and `rotateTo` | Use rotation for length-preserving vector movement, not an endpoint morph. |
| Mathematical typography | `src/latex.ts`, bundled MathJax outlines | Preserve shared em scale, fractions, scripts and matrix layout. |
| Semantic formula mapping | `\\animpart`, `morphTo(...,{map})`, `anchor`, `partColors` | Do not replace this with token guesses or per-glyph height normalization. |
| Stable numeric slots | `\\animnum`, `countTo` | Use for changing costs/parameters without repeatedly rebuilding text. |
| Attached labels/edges | `s.attach`, `s.connect`, center/surface endpoints | Build graph edges from node identities, including moving layouts. |
| Bounds and collision checks | `bounds.ts`, `overlap.ts` | Reuse for layout tests; text-only overlap detection does not catch every label/geometry collision. |
| Retained callbacks | `s.bind`, `s.deform`, `s.time` | Useful for exact parameterized geometry, provided all export/render hosts evaluate callbacks. Root is auditing that host issue. |

`shared/animlib/docs/reference.md` explicitly says matrices, arrays, and graphs belong to application helpers over existing shapes. It also states host-side helper registration is not exposed and arbitrary imports are not available inside the sandbox. Reusable helpers therefore need a deliberate compiler installation or supported source-generation path, not scene code that assumes imports work.

The existing `demo/scenes.ts` repeats a manual grid loop. Its linear demo morphs a vector while leaving the grid unchanged. Its bubble-sort helper swaps bars through one another and couples algorithm execution to animation authoring. These are real reusable-helper opportunities, not missing primitive rendering.

Current reactive property validation accepts position/rotation/scale/opacity/fill/vertices and several mesh properties, but not ordinary path `points`. An animated 2D function/coordinate mapping therefore needs a supported update route; pretending position transforms can express arbitrary nonlinear warps is insufficient. Named formula maps are one-to-one; copy-to-term, split, and merge correspondences remain separate needs.

## Discrete modules and measurable proof requirements

### 1. Coordinate constructions and data mappings

Suggested module: `helpers/math-2d` (name provisional). Provide coordinate conversion, major/minor grid, axes/ticks, sampled curves, points, vectors/components, and a shared point-map operation. All mapped geometry must derive from the same original coordinates and parameter. Return stable handles and named components. Labels require local offsets/anchors; transforming geometric space must not shear glyph outlines accidentally.

First proof: a shear applied to grid, basis, unit square and an identified vector, followed by basis decomposition. Retain the original scaffold. In tests, transformed points equal M(t)p at t=0, .25, .5, .75, 1; the origin stays fixed; grid parallels remain parallel; resultant equals the weighted basis sum. A separate rotation proof checks constant length at those interior times. Do not use generic shortest-distance outline morphing when endpoint order carries meaning.

### 2. Graph and traversal state

Suggested module: `helpers/graphs`. Separate immutable graph data, stable layout positions, visual handles, and explicit algorithm event data. Support directed/undirected edges, weights, surface-clipped connectors, local labels, self-loops/parallel edges only if explicitly implemented, and independent semantic states such as source/goal/frontier/active/settled.

An algorithm trace should name node and edge IDs, candidate cost, predecessor, and frontier contents. The scene consumes events; rendering must not silently infer algorithm correctness from colors. Reuse numeric slots for costs and existing attach/connect bindings for moving nodes.

Proof: a small weighted search with a cheaper alternative route, duplicate candidate handling, and a cycle. Assert the expected pop/relax order, predecessor chain and final cost; inspect frames before/during/after one relaxation. Edge endpoints must remain on node surfaces through layout motion. A frontier record and graph node must retain the same ID association during reordering.

### 3. Arrays, queues and coherent transport

Suggested module: `helpers/collections`. Separate item identity from slot index. Provide cells/labels, index pointers, comparison emphasis, swap/reorder, queue enqueue/dequeue and stack push/pop primitives. Algorithms should emit events rather than hide inside the drawing helper.

Curved transport semantics must be explicit: position follows a supplied polyline/Bezier/arc parameter; easing controls progress; orientation is optional; endpoint is exact; out-of-order seeks reproduce the same result. A swap should use opposing arcs with a documented clearance, retaining item labels/identity. Test duplicate values so equal data does not collapse identity. Verify midpoint clearance exceeds each item's half-height plus a chosen gap.

### 4. Reveal and attention primitives

Path reveal should mean a prefix of cumulative arc length, not fading a full edge or scaling it around its center. Zero progress has no visible segment, one reveals the full path, a moving arrowhead sits at the revealed tip, and disconnected subpaths have an explicit policy. Test unequal segment lengths, zero-length segments, reversed progress, and random seeking. Keep bounds and render validation consistent with the visible portion.

Attention helpers can compose rings, underlines, braces, or transient stroke emphasis around the actual target, with explicit setup/action/hold durations. They should return ordinary handles and restore prior style. A palette change alone is not evidence of a mathematical operation.

## Initial proof gate

Render a 3–8-second original proof at 1280×720, inspect native endpoints plus at least four interior frames, and inspect the encoded motion. Test 4:3 if that remains a delivery requirement. Keep algebra within the same construction; do not introduce a permanent heading/chart/footer arrangement. Use a separate algorithm visual language with legible sans labels and state markers. No creator frames or local baseline sheets may be used as scene assets.

For every proof report four independent verdicts: reasoning, readability, reference correspondence, and technical delivery. Retained callback geometry must agree between browser playback, random seek, still export, and film export. A successful build does not establish this. Complete broader reference coverage and a fresh reviewer comparison in the next review wave before claiming channel-level fidelity.

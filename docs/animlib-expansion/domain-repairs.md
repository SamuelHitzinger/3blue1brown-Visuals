# Domain review repairs and bead detail measurement

2026-10-11, branch `amilibsam`. No commits, branch switches, pushes, merges, or
shared compiler/runtime/renderer edits by this worker. Root owns integration and
the independent re-review. This report supersedes the relevant limitations in
the original implementation reports; it is not a reference-parity verdict.

## Six findings

Read the entire independent `domain-code-review.md`, math/molecular pinned API
contracts, proof style contracts and original implementation reports. Added
`test/domain-repairs.test.ts` before source changes. Its six cases all failed
with the reported symptoms: visible fractional value `0` instead of `0.25`,
stick-pole input accepted, sparse anchor accepted, mutated callback position
`[101.2,NaN]`, overflowed grid accepted, and compiled TeX containing literal
`quad`. No test depended on stale dist output.

1. Graphs retain nonnegative fractional algorithm weights. `GraphOptions` now
   exposes `costFormat` with 0–4 decimals and 1–6 integer digits, matching native
   numeric slots. Defaults infer the maximum edge precision capped at four
   decimals, with six integer digits. Integer graphs retain integer labels.
   The regression counts to the actual Dijkstra distance 0.25 and compares the
   resulting MathJax glyph contours, after translation, to literal `0.25`.
   Caller formatting and invalid formats are also tested. Precision finer than
   the chosen format rounds deliberately; algorithm values remain full precision.
   The pre-existing native digit-width overflow behavior is unchanged.
2. Sticks no longer silently switch seed axes. The normalized seed is projected
   perpendicular to the bond; sine of separation below 1e-7 is rejected with an
   instruction to choose `initialNormal` separated throughout the motion. This
   is continuous on its supported domain, not globally across a pole. The root
   approved this explicit precondition. Tests reject both signs on both sides
   of the old 1e-8 threshold, accept a Z-axis bond with an X seed, and check 101
   nearby supported orientations with radialSegments 3 for nonflipping normals,
   topology and residue correspondence. The API type and contract document it.
3. Molecular Vec3 validation checks all three indexed entries, including holes.
   Single-anchor/zero-bond sticks and backbone both reject sparse coordinates
   before returning anchors, regardless of whether any meshes would be emitted.
4. Collections copy the input origin. Mutation to 100 and NaN after creation
   cannot alter callback samples at the endpoint, start, or repeated midpoint.
5. Coordinate grids reject nonfinite or unsafe computed line counts before
   loops. Both ranges [1,2] with Number.MIN_VALUE now raise the grid-budget error.
6. Graph proof escapes the TeX `\\quad` command correctly in JavaScript. The
   regression checks the executed proof's compiled frontier record. Regenerated
   16 native frames at both aspect ratios; inspected the 1280×720 endpoint:
   the label visibly reads C followed by 2, with no literal word `quad`.

## Optional bounded bead improvement

`MoleculeProps.detail` and `MolecularBackboneProps.beadDetail` accept 0/1/2/3.
Existing defaults remain 0 and 1 respectively. A factory-private unit sphere
template cache avoids regenerating subdivision topology on each pose. Every
returned mesh owns its arrays, so editing a result cannot corrupt future calls.

| Detail | Vertices/site | Triangles/site | 33-bead vertices | 33-bead triangles |
| --- | ---: | ---: | ---: | ---: |
| 0 | 6 | 8 | 198 | 264 |
| 1 | 18 | 32 | 594 | 1056 |
| 2 | 66 | 128 | 2178 | 4224 |
| 3 | 258 | 512 | 8514 | 16896 |

Per-mesh limits remain 20,000 vertices and triangles. The molecule builder now
applies the same 500,000 aggregate geometry ceiling as the molecular backbone;
this does not narrow any formerly supported detail 0/1 site count. No limits
were raised. Tests cover exact counts/radii, output ownership, deterministic
chunking without dropping sites, identity and scalar mapping across a detail-3
batch boundary, aggregate rejection at 977 detail-3 sites, and detail 2/3 through
the production VM. Both new feature tests were observed failing before source
implementation; the molecule builder rejected detail 2 and backbone ignored the
requested detail.

The live 33-bead proof at detail 3 failed with `Invalid or oversized reactive
update`, an independent existing serialization payload cap. The proof therefore
uses detail 2 for large beads, retaining detail 1 for small stick joints. Smaller
or static models can request detail 3. No runtime payload cap was increased.

Regenerated the public-method molecular proof and all 28 native frames. At 2s,
the before/after inspection shows visibly rounder silhouettes with unchanged
positions, palette and framing. The 4.7s compact endpoint was also inspected.
This is a bounded silhouette improvement, not an atomic-model or PyMOL parity
claim. Comparison images are in `data/animlib-expansion/bead-detail-comparison/`:
`detail-1-at-2s.png`, `detail-2-at-2s.png`, and both `*-at-4.7s.png` files.

Final proof geometry: explicit bonds 512 vertices/512 triangles; stick joints
594/1056; beads 2178/4224; same-conformer surface 1392/2780. Six scene elements,
146579 source characters, 33 anchors and 32 explicit bonds. Recomputed 801
kinematic samples: maximum relative link-length error 1.7763568394002505e-15.
Direct/backward public-VM samples remain equal.

## Verification and artifacts

- Final `npm run typecheck --prefix shared/animlib`: pass.
- `npm run build --prefix shared/animlib`: pass.
- Final `npm test --prefix shared/animlib`: 759 passed, 50 files (01:10:05 run).
  Earlier 757-test full run also passed. One subsequent concurrent run had
  758 passed and one failure in `reactive.test.ts`, “validates updates, recovers
  from a bad callback value, and enforces sandbox limits on each invocation”:
  `SceneCompileError: interrupted` during initial creation with its 20ms budget.
  Isolated rerun passed all 15 reactive tests; the final full rerun passed all
  759. No unrelated test or execution limit was changed. A new test's optional-Z
  TypeScript diagnostic was corrected before the final typecheck.
- `domain-repairs.test.ts`: 8 passing cases, plus expanded molecule tests.
- Graph film regenerated at
  `data/animlib-expansion/math-proofs/graph-relaxation/film.mp4`: native WebGPU,
  H.264/yuv420p, 1280×720, 30fps, 210 frames, 7 seconds, no audio.
- Molecular film regenerated at
  `data/animlib-expansion/molecular-proof/film.mp4`: native WebGPU,
  H.264/yuv420p, 1280×720, 30fps, 240 frames, 8 seconds, no audio.

Both native render tools reported successful encoding. This worker inspected
stills, not movie playback. Independent visual motion/reference review remains
with the assigned evaluator; code tests and author still inspection do not
establish that gate.

Tracked source scope: diagram graph/collection/coordinate modules and graph
types; molecular-backbone module/types; molecules module/types; domain-repairs,
molecules and molecular-backbone tests; graph-relaxation source; molecular proof
generator/style contract; the pinned API contracts and molecule documentation.
Generated data stays under existing ignored proof-output directories.

# Independent math and molecular code review

Date: 2026-10-11. Branch under review: `amilibsam`. Scope: new diagram
factories/types/tests/proofs and molecular backbone factories/types/tests/proof
generator. No production source, engine source, or tests were edited; no commit
was made. This review reads the pinned design, both domain briefs, both pinned
implementation contracts, and both implementation reports.

## Findings

1. **[P2] Fractional graph distances are silently rounded in the supplied cost
   handles** — `shared/animlib/src/diagrams/graphs.ts:49`.
   Graph validation accepts finite nonnegative fractional weights and static edge
   labels retain their exact strings, but every mutable node cost fixes
   `numberFormat` to `{decimals:0,digits:6}`. A graph containing one edge of weight
   `0.25` produces algorithm distance `0.25`; the cost handle displays `0` after
   counting to that distance. Existing `latex.ts:135–136` formats the glyphs with
   `toFixed(decimals)`. This makes a supported weighted graph's visible arithmetic
   disagree with its trace. The pinned six-integer-digit capacity does not require
   zero fractional places. Expose a bounded cost format or explicitly reject
   unsupported fractional visual graphs; add a fractional-cost display test.
   The already documented six-digit overflow limitation is separate.

2. **[P2] Stick frame fallback introduces a 180-degree discontinuity for supported
   equal-topology inputs** — `shared/animlib/src/molecular-backbone.ts:105–106`.
   With the default seed `[0,0,1]`, one bond from `[0,0,0]` to `[x,0,1]`, radius
   `0.1`, and supported `radialSegments:3`, changing `x` from `0.999e-8` to
   `1.001e-8` switches from the positive-X fallback normal to the negative-X
   projected seed. The independently executed probe measured first-normal dot
   product `-1`; the first vertex jumps from approximately `[0.1,0,-9.99e-10]`
   to `[-0.1,0,0]`. Both inputs are accepted. Odd-sided rods visibly change their
   cross-section orientation, and vertex correspondence jumps for all side
   counts. The documented symmetry argument for round rods does not remove this
   polygonal geometry discontinuity. Use a continuous supported frame policy or
   reject/document the singular neighborhood consistently. Test both sides of
   the fallback threshold with odd radial counts. Backbone's separately
   documented rejected seed singularity is not itself a finding.

3. **[P2] Sparse molecular coordinates escape validation and return NaN anchors**
   — `shared/animlib/src/molecular-backbone.ts:13`.
   `Array.prototype.some` skips holes. A single-residue segment with
   `position:Array(3)`, `representation:'backbone'`, and no bonds returns a valid
   result containing anchor position `[NaN,NaN,NaN]` and no meshes; no subsequent
   tube/mesh validation runs. This violates the explicit finite-coordinate
   contract and allows invalid metadata out of the pure public geometry API.
   Validate each of the three indexed values, and include single-anchor and
   zero-bond cases in invalid-input tests.

4. **[P2] Collection callbacks retain the caller's mutable origin array** —
   `shared/animlib/src/diagrams/collections.ts:7` and `:13`.
   The builder snapshots item data but closes over `options.origin` directly.
   In a two-item default collection with a two-second swap starting at zero,
   sampling at `t=1` gives `[0.6,0.6]`; mutating the original origin's X to `100`
   and sampling the same callback at the same time gives `[100.6,0.6]`.
   Reusing/mutating an authoring options array therefore changes previously
   built motion and can bypass the initial finite-origin check. Copy the
   validated Vec2 into the retained configuration, as the coordinate builder
   already does, and test mutation followed by repeated/backward samples.

5. **[P3] Extremely small positive grid steps bypass the line-count budget check**
   — `shared/animlib/src/diagrams/coordinates.ts:14–16`.
   With both ranges `[1,2]` and `step:Number.MIN_VALUE`, both endpoint divisions
   overflow to Infinity; subtracting them produces NaN counts. `NaN > 512` is
   false, so the builder accepts a requested over-budget grid and emits zero
   lines. The probe confirmed `plane.grid.length === 0` without an exception.
   Reject nonfinite/unsafe computed counts before looping. This is a narrow
   validation defect, not a normal-scale geometry or performance failure.

6. **[P2] The graph proof visibly spells out `quad` in its frontier label** —
   `shared/animlib/demo/expansion/graph-relaxation.js:6`.
   The JavaScript string escapes the mathsf/animnum backslashes but contains only
   one source backslash before `quad`. JavaScript consumes it, so the actual
   TeX contains literal `quad` instead of the spacing command. Independently
   viewed native output
   `data/animlib-expansion/math-proofs/graph-relaxation/frames/1280x720-7.png`
   clearly reads `Cquad 2`. Escape the command backslash consistently and verify
   the rendered label; the existing numeric-state test cannot catch this defect.

## Spec and quality verdicts

| Domain | Spec verdict | Code/behavior quality verdict | Reason |
| --- | --- | --- | --- |
| Math/graph/collection | **revise** | **revise** | Source-coordinate mapping, stable IDs, immutable traces, native connectors, and focused swaps fit the pinned architecture. Fractional display correctness and retained configuration need repair; grid count validation has a minor hole. |
| Molecular | **revise** | **revise** | Explicit breaks/bonds, provenance, same-topology batching, fixed-link absolute-time kinematics, and separate representations fit the pinned architecture. Stick orientation continuity and sparse-coordinate rejection need repair. |

No blanket approval or reference-parity verdict follows from these code checks.
Style palettes/composition remain in proof sources/contracts rather than shared
renderer defaults. Geometry results carry scientific/schematic provenance;
the proof correctly identifies procedural motion and Gaussian surfaces as
schematic. Explicitly documented unsupported physical folding/collisions,
backbone reversals, capped tube ends, and arbitrary collection operations were
not treated as hidden implementations or defects.

The molecular proof generator uses common posed residue positions for sticks,
beads, labels, and the endpoint envelope. Its absolute-time pose cache is keyed
by requested time and does not integrate history. Stable mesh topology and
scalar identity maps are retained within each representation; cross-fades do
not claim cross-representation vertex correspondence. The final envelope uses
the endpoint pose. These source observations support the architecture but do
not establish visual fidelity or GPU performance.

## Verification and boundaries

The author-reported 13 molecular and 10 passing math host cases were read, not
rerun as redundant evidence. Their assertions cover useful fixed-length,
topology, identity, ordering, and ordinary budget invariants. Coverage does not
include the five domain inputs above or the proof's literal spacing command.
No new whole-suite passing claim is made.

Independent probes loaded the **current source** using TypeScript
`transpileModule` (ES2022/ESNext) into a Node data-URL module. Molecular probes
used the real existing molecule factory. Diagram probes used minimal scene
recorders to inspect their retained callbacks and emitted options. This avoids
depending on shared integration and tests the responsible domain layer.
All five numerical/output results listed above were reproduced in this review.
Fractional numeric formatting was additionally confirmed in the native LaTeX
slot formatter. An initial probe import used a nonexistent nested TypeScript
path; retrying the installed root `typescript` package succeeded.

The known graph midpoint attachment regression and three production-VM diagram
failures at dispatch belonged to the path-engine integration handoff. They were
**expected dependencies**, not additional findings against these modules. While
this review ran, root reported installing the public methods and rendering all
proofs. Current source imports the factories, and I independently checked that
the molecular measurement metadata now says `public SceneContext methods`.
The regenerated proof has 146551 source characters and retains reported maximum
relative link error `1.7763568394002505e-15`. This supersedes the implementation
report's older source-inlined proof status. I did not rerun the integrated tests;
root's fresh test evidence should determine their resolved status.

This reviewer inspected two native stills after root's rendering update: the
graph endpoint named above and molecular `frames/1280x720-3.png`. The graph
proof's **visual readability** is **revise** because of the literal `quad`;
the molecular still visibly has faceted bead silhouettes. The latter is a
**visual capability gap**, separate from code correctness: detail 1 delegates
to the existing 18-vertex/32-triangle bead template, as explicitly documented.
A future bounded detail 2/3 option and reusable sphere template could address it
without raising native aggregate geometry limits. It should be measured and
rerendered, not claimed to solve broader PyMOL/reference fidelity.

This reviewer did not inspect native movie playback/reference passages; that
work belongs to the separately assigned visual evaluator. **Reference style**
and complete integrated **technical delivery** remain **unverified here**.
The **reasoning** verdict is **revise** for the general graph capability because
fractional arithmetic can be misrepresented; the integer-only proof itself is
not disproved by that finding. Molecular schematic fixed-length reasoning is
supported by the implementation/test design, while proof-level independent
reasoning acceptance remains with the visual evaluator. No GPU throughput or
memory-performance claim was tested.

# Molecular backbone and motion task

Read `design.md` and `molecular-reference.md` before implementation. Work on
`amilibsam`, no branch switch/push/merge. Root serializes commits and shared
compiler/runtime integration. Keep molecular folding and cinematic transcription
styles distinct. This task enables the folding reference; it does not claim to
solve every cinematic biological requirement.

## Deliverable

Reusable deterministic molecular geometry and chain-motion module, not a large
one-off scene. Reuse existing native meshes, tubes, molecular batching, material
and envelope support. No new renderer and no folding-physics claim.

Own new files under `shared/animlib/src/molecular-backbone*`, matching test files,
and `shared/animlib/demo/expansion/molecular*`; documentation in this directory.
Do not edit compiler.ts/runtime.ts/types.ts/core.ts or shared renderer files.
Send exact integration exports/signatures to root early; a separate integration
step will expose sandbox scene methods. Build self-contained factories compatible
with existing QuickJS function-installation pattern where scene use is needed.

Required behavior:

- Consume ordered, explicitly identified residue anchors, explicit chain breaks,
  and an explicit representation choice. Reject invalid/duplicate identities and
  nonfinite coordinates. Do not infer connectivity across gaps or chains.
- Produce smooth tube/backbone geometry with stable vertex correspondence
  for equal topology. Transport orientation consistently without arbitrary flips.
  Preserve residue order, segment identity, and color mapping across representation
  changes; support native budget-sized chunks if needed.
- Support explicitly supplied bond edges; never silently infer chemical bonds.
- Supply a schematic articulated-chain function based on segment lengths and
  joint angles, or an equally sound parameterization that preserves each edge
  length at all times. Straight interpolation of folded/unfolded positions cannot
  satisfy fixed-length motion. Retained callbacks must depend on absolute time.
- Validate degenerate chains, repeated anchors, unsupported reversals/topologies,
  and mesh/scene budgets with precise errors or documented supported handling.
- Keep scientific coordinates/provenance distinct from schematic procedural data.

Pin exact public signatures in `molecular-implementation.md` before coding and
notify root so other agents can consume them. Domain types belong in focused files.

## Test and proof gate

Write tests first and observe meaningful failures. Cover explicit breaks/bonds,
fixed-length invariants across dense interior samples, finite nonflipping frames,
stable topology, known orientations, determinism/backward seeks, and budgets.

Write a folding-specific style contract from inspected reference. Author an
original 3–8 second proof: persistent residue colors and adjacency, actual chain
bending, endpoint hold, and stable sticks/beads/surface correspondence. The actual
folding reference shows sticks, residue beads, folded sticks, and a sequence-colored
surface. Ribbons are an inferred extension, not an observed requirement; implement
them only after the observed representation/motion needs work.
Retain source, manifest, and frames/video under ignored `data/animlib-expansion`
where bulky. Use native animlib; independent visual reviewer follows.

Export tools are undergoing retained-time fixes. Coordinate with infrastructure
worker before trusting their motion output. Existing standalone source can use
generated explicit data initially, but final API must be reusable through library.

Baseline: 664 tests + typecheck/build pass. For Windows tests use process-local
TEMP/TMP `C:\Users\samue\Stuff\3yellow3white\data\animlib-expansion\tmp`.
Report commands, results, files, proof paths, and remaining fidelity gaps in
`molecular-implementation-report.md`. Do not declare reference parity from tests.

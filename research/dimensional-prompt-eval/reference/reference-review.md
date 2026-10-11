# Independent reference review and dimensional evaluation rubric

Reviewed 2026-10-11. This review does not author or change production prompts or generated scenes. It establishes a target and test gates; it does not approve any future pipeline candidate.

## Evidence and provenance

- User reference: `C:/Users/samue/Downloads/showcase.mp4`, SHA-256 `699f6fd4b1607dd69226366a4f66a6fb5d5b47cf3052ab69a156361da752a072`. Read only. Fresh full decode exited 0: 3,930 frames, 131 seconds, 1280×720, 30 fps, H.264, no audio stream. Its eleven chapter titles and boundaries match the local curated capability showcase. The historical assembly review records a different reel hash, so that review's byte identity must not be assumed for this supplied file.
- Read the explanation-style skill, its visual baseline and review gate; personally viewed all three bundled approved/rejected images.
- Personally viewed the twelve-frame `showcase-overview.png`; native reference stills at 56, 62.8 and 85.5 seconds; all forty ordered peptide samples at 4 fps over 48–57.75 seconds; and all twenty-four ordered translation samples at 4 fps over 98–103.75 seconds. This is decoded still and ordered temporal evidence, not uninterrupted playback.
- Personally viewed eight ordered samples from the actual full-pipeline `docs/demos/pipeline-peptide-20261011/demo.mp4`, saved as `pipeline-peptide-comparison.png`; read its provenance and independent visual review. This run includes lesson drafting and editorial review, but only one six-residue prescribed torsion.
- Read the scene-stage showcase README, results and retry review. Personally viewed final native membrane retry frame 6, partial Rosenbrock retry frame 6 and rejected terrain retry frame 6. These are useful success/failure evidence, but their one-scene fixture bypasses lesson planning and cannot test dimension selection in the full pipeline. Latest user follow-up in `results.md` withdraws the earlier ready verdicts for SVD, dipole and excavator; do not reuse the older aggregate acceptance count as current approval.
- The local hand-authored 72-residue peptide, transcription and pore proofs establish engine capability and the requested visual target. They are not generated full-pipeline test results.

Sampling commands, exact timestamps and metadata are retained in `sample-reference.py`, `manifest.json` and `showcase-decode.txt`. Extracted images are review evidence only and must not become output textures or backgrounds.

## What the supplied reference actually demonstrates

| Dimension | Visible evidence | Transferable requirement |
|---|---|---|
| Geometry and complexity | At 48 seconds one extended connected chain contains four consistently colored regions. By 51–52.25 seconds several local coils are exposed separately. At 54.75–56 seconds they occupy a compact spatial arrangement. The matching source catalogue describes 72 residues; the count is source-derived, not inferred from the thumbnail. | Build enough meaningful structure for the requested mechanism: multiple connected substructures, local changes, and a global spatial relationship. More dots or mesh triangles alone do not constitute complexity. A six-residue hinge is a useful unit demonstration but does not establish comparable whole-chain packing. |
| Framing | The native 56-second folded chain occupies roughly x=400–865 and y=130–585, with only local N/C leaders. At 62.8 seconds the active RNA/template neighborhood fills the frame while its quieter context continues off the sides. | Choose scale for the decisive feature. Make active coils, aperture, contact, surface path or cavity readable at delivery size. Allow surrounding context to extend outside the view when intentional; never crop the operation itself. No required fixed percentage of frame occupancy or universal centered layout. |
| Causal use of depth | Packing changes relative placement and overlap of the same chain regions. The pore scene uses an oblique membrane plane and actual aperture geometry. A projection scene names a fixed 3D projection. | Depth must carry an observable relationship: spatial conformation, crossing/clearance, depth ordering, surface height, volume, or orientation. A tilted flat chart, decorative extrusions or arbitrary camera orbit do not earn 3D. |
| Lighting and materials | Native 56-second nodes have mild shading and tubes remain thin; chain colors preserve role identity. The reference is schematic, not a glossy molecular sculpture. Quiet rear context in transcription leaves the active chain readable. | Use shading, line width, opacity and stable color to separate shape and depth. Strong materials or photorealism are unnecessary. Inspect self-occlusion, dark silhouettes, hidden active parts and incorrect foreground/background order. |
| Motion and continuity | Samples show setup hold, local coil formation, a distinct coil hold, then packing, compact hold, and only then a modest orbit. Translation preserves codon/adaptor/cargo identity across transfer, register advance and exit. | Stage an operation so the viewer can track the same entities before, during and after it. Separate object motion from a later inspection move. Each camera move needs a visibility or correspondence purpose. Preserve meaningful topology and physical constraints throughout action interiors. |
| Annotation | Endpoint leaders remain attached; sequence colors persist. Translation labels actual codons and carriers. No persistent title–chart–footer frame encloses these constructions. | Local notation should identify a visible object or invariant. Essential labels cannot disappear into geometry. Avoid large formula/readout panels that substitute for an invisible operation. |

The expected result is a coherent explanatory construction with sufficient structural depth, not a requirement to use 3D everywhere. The first reference chapters legitimately use 2D for linear algebra, graph records and scalar residuals.

## Existing pipeline evidence and its limits

The full-pipeline peptide at 0–19.5 seconds remains a thin nearly horizontal chain with a small downstream hinge movement. It preserves the selected axis, ghost and circular trace, which explains its narrow torsion claim. It does not show multiple coils, global packing, enclosure, interlocking components or a complex depth relation. Its earlier ready verdict and the user's desire for stronger 3D can both be true: the accepted scope was small.

The generated membrane retry demonstrates that the scene author can produce dense spatial context and a readable cutaway. In its native frame 6 the paired lipid tails, head planes and gold pore are distinct. This is scene-stage evidence only. Conversely, native Rosenbrock frame 6 has a large visible surface but conceals the active descent path; a counter at k=202 does not expose that operation. Native terrain frame 6 has a landscape and legend but no readable connected river or advancing front. These failures make visible causal depth, rather than presence of 3D geometry, a necessary gate.

## Independent routing rubric

Record routing before rendering and judge the actual lesson/scene plan against the request. Do not award a routing pass because the eventual movie happens to contain a mesh. Each scene needs the representation appropriate to its current inference; a mixed lesson may use 2D first and 3D later.

| Case class | Expected decision | Rejection condition |
|---|---|---|
| Scalar functions, planar coordinate transformations, graph connectivity/costs, sequence order, distributions | Prefer 2D when the claim is fully and clearly shown in a plane. | Unrequested depth obscures values, labels, node correspondence or comparison; 3D is justified only as decoration. |
| Whole-chain conformation/packing, helices and spatial orientation, moving parts with clearance, apertures or cavities, surfaces whose height is the variable, volumes/cross-sections | Use 3D or a genuinely spatial construction with an explicitly chosen view. | Collapse the requested spatial claim into a flat icon, short toy fragment or a caption; preserve only topic words while removing spatial content. |
| Biological sequence or chemical identity compared with folding/geometry of the same object | Distinguish the question, not just the domain keyword. Sequence order can be 2D; conformation/packing needs spatial evidence. | Route all biology to 3D, or route a spatial mechanism to 2D merely to reduce complexity. |
| Explicit dimensional preference from the user | Respect the specified dimensional scope while making its consequence readable. | Override a clear user constraint using the default preference. |
| Multi-part lesson | Use representation transitions only where the next claim needs them, retaining object identity across the transition. | Force one global dimension on all scenes, or change dimensions without preserving what is being compared. |

For each case record `expected`, `planned`, `reason`, `spatial_claim`, `visible_operation`, and `scope_preserved`. A route is ready only when the chosen representation supports the requested claim and preserves requested complexity. Plausible alternatives may pass with an explicit causal justification; a magic word like "3D" in the plan cannot.

Useful held-out contrast pairs include shortest-path graph versus articulated mechanism clearance; peptide sequence versus whole-chain packing; scalar loss curve versus a path on a two-variable loss surface; nucleotide pairing/order versus a continuous chain passing through a spatial pore. Treat these as categories, not fixed mandatory scene templates.

Current planned case calibration: a sine transformation is an appropriate 2D control; a saddle with sections tests a genuine surface/intersection relation and must keep the section curve visible; a folded enzyme pocket is a stronger transfer challenge. The pocket requires enclosure, local access and ligand/site correspondence beyond the supplied clip's multiple-coil packing. Judge it as a separate held-out spatial test, not an exact recreation of an operation already shown in the clip. Its fidelity must be declared: an illustrative fold/pocket may be acceptable for an explicitly schematic request, while claims about a named enzyme, binding pose or deposited structure require matching data. Neither an arbitrary globule nor a cloud of atom-like dots establishes that fidelity.

## Rendered execution rubric

Use four separate verdicts from the explanation-style gate: **reasoning**, **visual readability**, **reference style**, **technical delivery**. Each is `ready`, `revise` or `unverified`; never average away a substantive failure. Report routing separately.

For an intended complex spatial case, all of these must be evidenced:

1. **Scope and structural complexity:** the generated objects instantiate the requested full mechanism and multiple relevant substructures; a smaller easy substitute fails even if attractive. Inspect the source only to confirm actual structure and identity, not as a substitute for the visible result.
2. **Depth is necessary and visible:** identify the exact spatial relationship and a timestamp where it is revealed. Strong cases show more than a single coplanar operation: multiple local structures plus their spatial arrangement, or multiple interacting bodies/regions with valid clearance and occlusion. No arbitrary universal polygon/residue minimum.
3. **Causal action:** name what changes, what stays fixed, and the visible consequence. During the action, the decisive marker/path/contact/cross-section remains readable. Captions and counters cannot compensate for hidden geometry.
4. **Persistence and constraints:** stable IDs/colors/endpoints/topology across setup, action and result; actual invariants tested numerically when relevant. Check interiors, reverse seeks and transition instants where possible. Prescribed kinematics must not be called a physical simulation.
5. **Camera and occlusion:** inspect setup, mid-action, endpoint and any camera transition at native size. A chosen view must expose the action; verify projected geometry, not only camera coordinates. Camera movement alone is not explanatory motion. A useful cutaway or a held alternate view may be preferable to continuous orbit.
6. **Framing, annotation and material:** active structure is large enough for its role; leaders identify their targets, text does not collide with objects, scaffold is quiet, colors stay meaningful, and shading does not hide the contact or path. Review at the intended delivery aspect and one alternate aspect when the output supports it.
7. **Timing and holds:** setup is identifiable, hard transformation has readable intermediate states, endpoint has a real reading hold, and any further motion serves a stated inspection need.
8. **Native and encoded delivery:** actual generated source reaches production validation and native rendered review. Inspect the final exported movie, metadata and decode; frames or source alone leave playback/encode properties unverified.

Minimum evidence for a serious comparison: one 3–8-second generated motion proof containing the difficult operation, native setup/action/endpoint frames, ordered samples dense enough to inspect its interior, and an independent reviewer who sees both proof and reference. Expand only after substantive proof failures are corrected. A longer existing reference may be cited for target quality but cannot replace new full-pipeline generation.

## Full-pipeline acceptance and provenance

Keep request → generated lesson → editorial review → dimension/scene plan → scene authoring → native validation/review → optional repair → final source/encode traceable. Save model/settings, exact effective prompt hashes, all candidates and repair outcomes. Do not hand-edit a generated source, seed a hand demo or replace planning with a one-scene fixture and then label that run full pipeline.

To claim improvement, evaluate fresh full-pipeline cases spanning ordinary 2D, genuinely spatial complexity, and a mixed or ambiguous case. Keep prompts, settings and acceptance gates comparable across baseline/candidate. Planning/routing probes can cheaply broaden coverage, but only rendered full-pipeline cases establish execution quality. Repeat any marginal result before claiming reliability; one approved output is evidence of capability, not a success-rate estimate.

Common automatic failure triggers: a 3D topic reduced to one tiny primitive; unconstrained camera drift; active path hidden by its surface; moving body penetrating intact geometry; changing counters over a static unexplained world; opaque faces hiding the only causal contact; bulk equation layout dominating the construction; a technically approved render substituted for independent style judgment.

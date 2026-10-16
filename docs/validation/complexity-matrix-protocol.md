# Subject and visual-complexity screening

The user explicitly requested both subject breadth and visual detail breadth. A successful simple graph cannot qualify a detailed molecule or surface. This first screen uses eight tasks, each with two matched authoring arms. It is not a live lecture test or a statistically powered benchmark.

| Subject | Lower detail | Higher detail / distinct workload | Required checks |
| --- | --- | --- | --- |
| Algebra | One line and rise/run triangle | Two lines, shared input, moving projections, paired slope triangles | Correct coordinates/scales; corresponding quantities remain attached; both curves preserved |
| Multivariable calculus | Shaded 10×10 saddle and two traces | Smooth 40×40 saddle, moving slicing plane/trace, fixed comparison trace | True 3D mesh; grid detail; trace lies on surface throughout motion; depth/readability |
| Organic chemistry | Caffeine: 14 heavy atoms, 15 bonds, coarse atom meshes | Same conformer: all 24 atoms and 25 bonds, smoother meshes, hydrogen reveal and rigid rotation | Exact source geometry/topology; all required atoms/bonds and double bonds; no invented molecular dynamics |
| Probability | — | Two normalized densities on shared axes with changing interval comparison | Correct peak/width relationship, common scales, probability interpretation |
| Wave physics | — | Two inputs and their sum during phase change, signed-vector addition | Constructive-to-destructive interference; persistent inputs; correct sum at intermediate frames |

The saddle uses the explicit supplied equation `z=(x*x-y*y)/2`, with traces following the standard method described in [OpenStax](https://openstax.org/books/calculus-volume-3/pages/2-6-quadric-surfaces). Chemistry uses [PubChem CID 2519](https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/2519/JSON?record_type=3d); its [fixture receipt](complexity-molecule-fixture.md) preserves exact coordinates, bond orders and computed-conformer limitations. Other tasks are explicit mathematical instruction fixtures. No unseen source facts or private lecture transcript are supplied.

## Matched arms

Both arms use `gpt-6.1-sol`, low reasoning, one strict structured scene submission, requested priority tier, a 30-second request timeout and identical user instructions/data/API documentation. The baseline uses native construction and `play`/`wait`; the candidate additionally receives existing `compose`/`schedule` guidance. Arm order alternates by case. Actual service tier and each model response are retained. No retries, source rewriting, numerical repair or omitted failures are allowed. A helper that the model ignores does not count as an evaluated helper optimization.

Each task requests exactly eight seconds with a two-second final reading hold. These are synthetic visual windows, not measured speech alignment. Chemistry's declared `DATA` binding is prepended deterministically from verified public JSON. Raw generated source, data hash, combined source and combined hash are retained separately. The host provides data, not a finished molecule animation or an explanatory plan hidden from the baseline.

## Separate measurements and gates

1. Model request: first valid completed tool call, provider termination, output tokens and actual tier. Report both deadline misses and failed outputs.
2. Execution: unchanged source compilation, duration, generated geometry counts, offline preparation/export cost. This does not measure a live presented frame.
3. Coverage and correctness: count/inspect required entities, dimensionality, geometry detail, equations/topology, and intermediate states. A readable text substitute fails geometry coverage.
4. Visual explanation: fresh blinded reviewer evaluates A/B native samples, object correspondence, meaningful operation, local labels and readable depth. Distinguish sampled-frame review from full-motion proof.
5. Overall acceptance: remains unproven until complete ingestion/ASR/model/resource/persistent-world/presentation timing and full-motion quality meet the ten-second goal across these strata. Do not average away high-detail failures behind easy cases.

The existing 90,004-triangle GLB and deforming-surface profiler are separate **handwritten runtime** workloads. They measure renderer capacity and cold/warm preparation; they do not establish model authoring quality. Future rounds must add novel subjects, larger molecules, resource selection, corrections and sustained session behavior. This screen identifies failure modes; one sample per arm cannot estimate reliability or p95 latency.

## Keep three kinds of complexity separate

The eight cases are a breadth screen, not a full factorial experiment. Several
pairs change both the visual detail and the requested explanation: the dense
surface adds a moving slice, and full caffeine adds a hydrogen reveal. Their
differences cannot be attributed solely to mesh density or atom count.

For subsequent comparisons, record three independent axes:

- **Subject reasoning:** one relationship, interacting relationships, or a
  multistep mechanism. Record the required inference and its invariants.
- **Visual detail:** sparse 2D geometry; dense 2D labels/curves; coarse 3D;
  detailed 3D mesh, molecule or imported asset. Record entities, topology,
  triangles, labels, attachments, occlusion and intermediate-frame readability.
- **Change workload:** initial construction; transform existing objects; change
  geometry/topology; introduce a new asset; correct earlier evidence. Measure
  cold retrieval/preparation separately from cached reuse.

Use controlled low/high-detail pairs with the same data, claim, motion and
reading hold before adding harder reasoning. For example, change surface mesh
resolution while retaining the identical slice operation; vary molecular sphere
detail while retaining the same atoms, bonds and reveal. Removing atoms,
annotations or causal steps is not an optimization unless both arms explicitly
have that reduced requirement.

Report pass counts and latency per stratum, including failures and deadline
misses. Require a quality gate for each detailed 3D stratum; easy line plots
cannot compensate for failed molecular or surface scenes. Keep an unseen
subject/media holdout for each architecture candidate. Repeated attempts on the
same eight tasks are development evidence, not unseen generalization evidence.

These are evaluation requirements for the next round, not completed trials.

## Next coverage matrix after the user's renewed breadth requirement

Keep the ten-second response budget separate from the eight-second animation
duration. Current evidence spans five subjects, but no stratum has passed the
complete speech-to-explanation-to-visible-update requirement. Existing model
screens, manual quality recovery and runtime probes are different evidence types.

| Case family | Detail levels | Required operation | Evaluation role |
| --- | --- | --- | --- |
| Parabola point and ordinate | 17/65/129 curve samples | Same point trajectory with attached ordinate and value | Development control |
| Saddle slice | 10/20/40 cells per axis | Same plane, traces, labels and motion; measure approximation error | Development control |
| Full caffeine | Atom detail 0/1/2; same 24 atoms and 25 bonds | Rigid motion and local labels; preserve bond endpoints and distances | Development control |
| Unseen measured series | Sparse/dense 2D, exact supplied JSON | Compare at shared input, correct one datum without changing other data/scales | Data holdout |
| RC charging | Simple circuit through linked circuit/curve | Explain supplied relation, change resistance, preserve initial condition | Subject holdout |
| Unseen parametric surface | Coarse/detailed 3D | Contour or tangent operation, parameter correction, attached labels | Geometry holdout |
| Unseen complete organic conformer | Medium/high atom detail, verified source | Highlight group without deforming topology, then rotate/translate | Molecule/data holdout |
| New static GLB and distractor | Detailed imported geometry | Correct selection, named-part/group edit, cached reuse | Retrieval holdout |
| Sustained speech corrections | Mixed sparse/dense 2D and 3D | Resolve referent, correct during preparation, retain unrelated motion | Causal/session holdout |

These rows specify future cases, not completed trials. Freeze candidate code and
prompt before revealing held-out media wording, data/asset identities and relation
structure. Merely changing coefficients in an existing task is not an unseen
subject test. Verify scientific sources before creating each held-out fixture.

For each case, record initial construction and retained edits separately. Capture
source-window start, decisive evidence endpoint, ASR completion, queueing,
retrieval, model completion, preparation, world commit, renderer submission and
first observed browser change. Preserve the original obligation's deadline
through correction/queueing. Report wrong outputs, late results and inappropriate
deferrals; a quick empty response does not satisfy visual coverage. Present
matched baseline/candidate motion with identical requirements at both widths.

Distinguish preselected startup inventory, first decode in the running session,
cached reuse and genuinely new mid-session assets. The current joined host freezes
inventory before world creation; mid-session registration remains unsupported.
Animation clips/skinning have metadata tests only, with zero clips in the current
installed corpus; they cannot be reported as working runtime capabilities.

Current evidence: [eight-case model screen](complexity-screen-checkpoint.md),
[controlled detail](controlled-detail-checkpoint.md),
[manual quality recovery](quality-revision-checkpoint-2026-10-16.md),
[retained edit](retained-complex-edit-probe.md),
[speech/browser join](lecture-join-checkpoint.md),
[large static asset](lecture-static-assets-checkpoint.md), and
[five-workload diagnostic check](stroke-preflight-checkpoint-2026-10-16.md).
None substitutes for the per-stratum end-to-end quality and deadline gate.

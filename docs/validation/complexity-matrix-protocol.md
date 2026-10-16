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

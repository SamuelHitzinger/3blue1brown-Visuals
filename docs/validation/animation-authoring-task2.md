# Resource resolution validation — 2026-10-15

Task 2 is implemented on `codex/animation-authoring-efficiency`, above inherited checkpoint `6d9798e`. No changes were made to the inherited `prepared-artifacts.ts`, `model-assets.ts`, or `molecular-models.ts` implementations. Root owns generator/lecture wiring and commits.

## Delivered behavior

- Catalog search accepts exact all-of `capabilities` plus a short natural-language `intent`. HTTP uses repeated `capability` parameters. Intent routes are an explicit, auditable vocabulary for rigid motion, oscillation, interference, conservation, event rates, deposited structures, and nucleic mechanisms. Unknown capabilities cannot be satisfied by a similar token or semantic expansion.
- `createVisualizationResolver({publishModel, referenceTools, signal})` exposes `resolve` and `read`. `AgentTask.resourceTools` opts a task into `resolve_visualization_resource` and `read_visualization_resource`. A task without this option has no preparation tool. The existing visual gate copies only catalog/reference readers to its review tasks.
- A resolution reports `ready`, `needs-input`, `preparation-required`, or `unsupported`, with actual package references, exact selected-package capability checks, provenance, limitations, and required inputs. JSON responses are bounded at 28,000 bytes. Unsupported results never report compatible readiness.
- Selected 1CRN representations and researched PDB selections publish through the existing job callback. Successful returned model IDs therefore belong to that callback's registry. Same-instance repeated/concurrent requests publish once. A fresh resolver invokes its own publication callback, preserving job registration isolation. PDB chains/accessions are canonicalized without changing the selected representation. Failed publications can retry.
- Seven catalog techniques resolve to five existing immutable scientific construction seeds through `read_animlib_reference`, with SHA-256 over the exact snapshot. These are illustrative starting constructions, not measured simulations or approved films.
- `transcription-cycle` and `rna-processing-splice` resolve to actual local JSON. The host checks installed helper validators at representative states, then exposes hash-pinned paginated reads. The read tool accepts only an already selected package ID and matching hash; it cannot read paths, URLs, arbitrary catalog Markdown, or `lecture-evidence`. Splice usage explicitly selects `input.props`.
- Bundled GLB conversion uses the existing `PreparedArtifactStore`, keyed by full verified package content plus publication version, atom-source identity, and element colors. Persistent bytes and provenance remain separate from each job's model publication. `BUNDLED_MODEL_CACHE_DIR` overrides the default `data/prepared-bundled` location. Returned bytes/context remain defensive copies.
- Per-call cancellation stops that caller's wait, while another caller can continue the shared work. The optional owning-job signal cancels active publication and prevents further resolution/reads after the job stops.

## Tests and verification

The capability/intent tests first failed against the previous search behavior; bundled-cache tests first failed on the missing preparer factory; the runtime test first failed because resource tools were absent. Resolver tests exercised the missing implementation and then real packet, input, publication, cancellation, and retry behavior. The transcription validator initially exposed an incorrect field selection (`rna` instead of the fixture's `transcript`); it was corrected before passing.

Latest combined resource regression run: **70 passed, zero failed, 14,201 assertions** across catalog capability, existing catalog, resolver, bundled cache, existing bundled geometry, prepared artifact, model asset, and runtime tests. An additional PDB normalization/private-reference test then passed with six assertions. Backend `tsc --noEmit` passed; the benchmark also passed a direct TypeScript check with the backend's compiler settings.

Windows filesystem tests require a process able to create junctions/hard links. The initial restricted baseline was 18 passing and one existing junction-creation `EPERM`; the final run outside that sandbox passed the containment and immutable scientific provenance tests as well. This was a test environment restriction, not a skipped production check.

Commands from `backend`, with `TEMP` and `TMP` set to the writable local `.tmp` directory:

```powershell
../node_modules/.bin/bun.cmd test ./test/catalog-capabilities.test.ts ./test/visualization-catalog.test.ts ./test/visualization-resolver.test.ts ./test/bundled-model-cache.test.ts ./test/bundled-models.test.ts ./test/prepared-artifacts.test.ts ./test/model-assets.test.ts ./test/runtime-speed.test.ts
../node_modules/.bin/tsc.cmd --noEmit
../node_modules/.bin/bun.cmd bench/resource-efficiency.ts
```

## Deterministic benchmark

The callable aggregate entry point is `runResourceEfficiencyBenchmark()` in `backend/bench/resource-efficiency.ts`; CLI execution is protected by `import.meta.main`. Raw results, source fingerprints, exact package hashes, per-query timings, packet byte counts, and limitations are saved in [resource-efficiency.json](animation-authoring-benchmark/resource-efficiency.json).

| Check | Result |
| --- | --- |
| Actual curated intent queries, including three alternate wordings | 10 |
| Expected record in top three | 10/10 |
| Expected record first | 9/10 |
| Falsely compatible returned records | 0 |
| Unsupported/partial capability checks with zero results | 5/5 |
| Cold batches of four concurrent bundled preparations | Five batches, one conversion each |
| Fresh preparer / fresh process using persisted bytes | Zero conversions; identical SHA-256 |
| Repeated/concurrent publication in one resolver | One callback |
| Registration by a fresh resolver | One new callback |
| Real published model packet | 14,016 bytes |

The alternate wording “material flow between stocks” ranked ecological flows before reaction/transport. Both expose the requested conservative-transport capability; the expected reaction/transport record remained in the top three. The acceptance gate required top-three coverage, not an arbitrary choice between these related methods.

Observed preparation timings for the 228,476-byte `1crn-beads` GLB:

| Phase | Samples | p50 | p95 |
| --- | ---: | ---: | ---: |
| Cold batch, four concurrent callers | 5 | 15.5291 ms | 100.3518 ms |
| Same-preparer memory reuse | 50 | 0.0372 ms | 0.0706 ms |
| Fresh-preparer disk reuse | 5 | 1.3496 ms | 2.6113 ms |

A separate fresh process reused the persistent artifact with zero conversions: 75.5951 ms preparation including fresh source/package decoding; 233.8396 ms process wall time. Later cold batches in the parent process already had decoded fixture inputs resident, so their medians are not independent cold-start estimates. The retained GLB SHA-256 is `cb6fb2a3879d3e9b82549c270ec866b1241e7f30f62e1b1b4ea45a7c3aad0529`.

## Limits

This is a small curated retrieval vocabulary, not general embedding search or proof of coverage for arbitrary science. Static GLB clips, skeletons/skins, and morph targets remain unsupported. Rigid movement seeds do not provide molecular dynamics or deformation. Horizons/USGS references, arbitrary native package files, and the large peptide rig/staging route remain explicitly unsupported by this resolver; no external data was downloaded or fabricated. Existing lower-level authoring/publication capabilities remain available where already authorized.

The benchmark measures real local host preparation, publication, retrieval, and payload sizes. It excludes model latency/output tokens, rendering, speech timing, scientific correctness, and visual acceptance. It supports the resource-reuse acceptance target; representative generated/rendered evidence remains part of root's overall integration work.

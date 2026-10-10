# Independent candidate code/API review

Reviewed commit: `3370559` (`amilibsam`), 2026-10-11.
**Overall verdict: revise.** The six prior domain findings are repaired and the
bounded bead-detail change is ready at the reviewed code/API scope. Two asset
validation/budget defects remain. This is not visual or reference-style signoff.

## Reproducible blockers

1. **[P2] Reject sparse prepared coordinate/index triples before accepting the
   registry** — `shared/animlib/src/asset-validation.ts:63–64` at `3370559`.
   The `point.every(...)` and `face.every(...)` checks skip array holes. Starting
   from `test/asset-fixture.ts`'s valid model, replacing either
   `parts[0].vertices[0]` or `parts[0].triangles[0]` with `Array(3)` is accepted by
   `createAssetRegistry`. The vertex case yields NaN descriptor bounds and
   undefined mesh coordinates; the face case yields undefined triangle indices
   through an acquired lease. Immutability subsequently preserves invalid data
   rather than making it safe. This is the same class of validation issue the
   molecular repair correctly eliminated. Validate all three indexed entries
   explicitly, including holes, before hashing, copying, or freezing. Add both
   sparse vertices and sparse faces to registry rejection tests. Any new UV
   validation should use the same dense-entry rule.

2. **[P2] Preflight decoded model memory before reading/allocating package
   geometry** — `shared/animlib/src/asset-package.ts:22–30` and `:43–47` at
   `3370559`.
   Package preflight applies the 32 MiB model cap to packed byte lengths, while
   `validatePreparedModel` uses 128 bytes per boxed triple. That decoded check
   happens only after every part has been read and expanded. A correctly signed
   manifest declaring seven parts, each with 20,000 vertices and 20,000
   triangles, represents 3,360,000 packed bytes but 35,840,000 accounted decoded
   bytes, already above the cap. The probe confirmed that this manifest invokes
   the blob reader instead of rejecting in preflight. It throws a sentinel at
   the first read, so this review did not allocate a large rejected model.
   With 69 such parts, packed bytes remain below 32 MiB while the implementation's
   decoded estimate exceeds 350 MB before late rejection. Compute the declared
   decoded total using vertex/triangle/normal counts during manifest preflight;
   reject before the first read. Keep exact byte lengths and content hashes as
   separate checks. Test rejection with a reader that must never be invoked.

Both findings were sent to root and `/root/image_texture_builder`; root assigned
their fixes to that worker. Those in-flight repairs are outside this snapshot's
verdict and require a fresh review after integration.

## Prior findings and bead extension

| Prior finding/change | Independent result at `3370559` |
| --- | --- |
| Fractional graph cost display | **ready**: format inference/caller precision now preserves 0.25; glyph-contour regression passes. Explicit 0–4 decimal precision and six-digit ceiling remain documented. |
| Stick frame fallback discontinuity | **ready** under the approved supported-domain restriction: singular neighborhoods now reject; odd-sided continuity and alternative seed tests pass. |
| Sparse molecular anchors | **ready**: indexed Vec3 validation rejects single-anchor/no-bond sparse input. |
| Mutable collection origin | **ready**: origin is copied; mutation followed by repeated/backward samples passes. |
| Overflowed grid line counts | **ready**: nonfinite/unsafe counts reject before grid loops. |
| Graph proof literal `quad` | **ready** at source/API level: actual compiled TeX now contains the correctly escaped spacing command. No new playback review performed. |
| Bead details 0/1/2/3 | **ready** at code/API level: private reusable templates, independently owned output, fixed 20,000 per-mesh caps, 500,000 aggregate caps, deterministic batches and residue-color correspondence pass. |

The detail-3 live update payload ceiling is an explicitly reported limit; it is
not silently increased. The molecular proof deliberately selects detail 2 for
large beads. The extension does not itself establish PyMOL fidelity, physics,
motion readability, or GPU performance.

## Additional integration review

**Retained points, stroke ranges/dashes, and midpoint attachments: ready within
reviewed scope.** Snapshot tests pass for exact local arc-length clipping,
unequal segments, contour gaps, closed seams, dash phase, fragment bounds,
reactive cardinality validation, competing ownership rejection, random/backward
seeks, rendered arrow endpoints, and transformed connected midpoint attachments
in target-parent coordinates. Source review found the expected validation at the
compiler/retained-update boundary and application before attachment resolution.
No additional blocker was confirmed in these paths.

**Asset ownership/lifetimes and geometry resolution: ready within reviewed
scope, conditional on the two input-boundary repairs above.** Existing tests
independently passed immutable geometry, repeated-reference sharing,
transactional acquisition, stale/missing references, forged descriptor count
rechecks, failed replacement cleanup, isolation between sequences, offline
failure disposal, array-free frames/handoffs, retained versus streaming drawing,
resolved bounds/picking, clipping, and text-occlusion resolution. Source review
confirmed candidate cleanup through `finally`, idempotent lease disposal, and
live lease resolution even before retained-cache reuse. No reference-count leak
was found in the reviewed success/failure paths. This does not measure GPU
resource use or untested browser interactions.

## Evidence and reproducibility

The review read the previous independent report and `domain-repairs.md`, then
used `git show 3370559:path` and a read-only Git archive extraction to avoid
mixing active image edits into the candidate. No Git state or production files
were changed. Snapshot/test scratch files reside under the ignored directory
`data/animlib-expansion/candidate-review-3370559/`.

Fresh command, run from repository root with process-local TEMP/TMP pointing to
`data/animlib-expansion/tmp`:

```powershell
npm exec -- vitest run --root data/animlib-expansion/candidate-review-3370559/shared/animlib test/domain-repairs.test.ts test/molecules.test.ts test/molecular-backbone.test.ts test/path-animation.test.ts test/assets.test.ts test/asset-package.test.ts test/asset-integration.test.ts test/asset-render.test.ts test/reviewer-probes.test.ts
```

Final result: **9 files / 89 tests passed**, consisting of **85 existing targeted
tests plus four independent reviewer probes**. Three probe cases reproduce the
two defects above; their passing result means reproduction succeeded, not that
the defects are fixed. The fourth probe ruled out a suspected registry ID race:
JavaScript evaluates the map key before awaiting the second argument's hash, so
changing the first model's input ID during hashing does not corrupt its lookup.
That initial suspicion was explicitly withdrawn after the test disproved it.

The initial archive omitted the molecule demo fixtures and caused one import
failure; extracting the exact snapshot's fixtures resolved it. No current-tree
image test failure was used as candidate evidence. No complete-suite, typecheck,
GPU, or visual-signoff claim is made by this focused review.

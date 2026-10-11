# Independent API and host merge review

Reviewed 2026-10-11 against the resolved working tree, animlib parent `ea6e07a06c3e0c10fd64d42a8f96f8d24ab3ca61` and main parent `b35e4a860c24d7b6e9b9ef40f5ce11ba32f033e5`. Read the earlier main-merge conflict audit, then compared actual parent implementations and the merged files. No Git or production-source mutations were made by this review.

## Result

No actionable P1/P2 merge regression found within the API/compiler/runtime/host scope. Bounded acceptance of this portion; this is not a claim that the complete repository or every GPU path passed.

- The model dispatcher preserves prepared `id.part` children and GLB `id/part` hierarchy/pivots, requires an explicit source for duplicate inventory IDs, and refuses cross-inventory fallback for explicit sources. Prepared fill/style controls and GLB tint/style restrictions remain separate. Both handle forms augment the original owned handles, so group ownership validation continues to work; root and part tint methods target actual descendants.
- Compiler validation retains descriptor-only prepared references, catalog identity/geometry constraints, imported metadata/reference checks, host-owned internal-field rejection, morph restrictions, and imported instance triangle budgets. Retained updates still cross the restrictive reactive-property validator; GLB nodes cannot receive mesh deformation and prepared references explicitly reject deformation.
- SceneSequence passes both inventories and preserves handoff/audio bindings, candidate asset preparation, rollback retention, and disposal. Player supplies both resolver capabilities, prepares GLB before rendering, filters audio assets, and disposes both host stores. Existing backend browser preview calls using the third-argument ModelStore remain supported by CanvasRenderer's compatibility dispatch.
- Frame/video hosts retain `withOfflineScene` sampling while preparing the GLB store, pass both host capabilities to rendering, and dispose the store in a finally block. The extracted embedded-file reader does not fall back to filesystem/network URLs; parsed model limits, metadata, hash checks and decoded image dimensions remain enforced downstream.
- Cleanly merged bindings retain midpoint attachment and main's connector bounds behavior. Picking retains prepared mesh resolution alongside bounded GLB picking. Public core exports retain both feature families without a duplicate ModelProps declaration.

## Independent checks

Ran from `shared/animlib` with TEMP/TMP redirected to `data/animlib-expansion/merge-validation/api-review-temp`:

```text
npm exec -- vitest run test/model-coexistence.test.ts test/offline-host-assets.test.ts test/connector-bounds.test.ts test/models.test.ts
4 files passed; 49 tests passed.
```

The first attempt failed before test execution because Vitest's sandbox temporary cache files were unavailable; the repository-local temporary directory resolved that environment issue.

Read the native host evidence manifests and inspected the mixed 0s/2s contact sheet: the prepared yellow triangle moves upward, the textured GLB moves downward, the retained path bends, and the prepared image remains fixed. Independently decoded both sizes of both PNG pairs and recomputed the verification script's RGB difference metric (per-channel threshold >8); results agree with `host-evidence/verification.json`. This validates the saved frame evidence, not a fresh GPU rerun. The saved video proof was read but not independently re-encoded or decoded in this review.

Full-suite/build/typecheck results and native GPU/browser validation belong to the coordinating review and GPU reviewer. Broader pre-existing behavior outside the merge integration was not exhaustively audited.

## Follow-up: backend authoring-reference integration

Reviewed the subsequent unstaged changes to `backend/src/agents/authoring-reference.ts`, `backend/test/authoring-reference.test.ts`, and `backend/test/scene-craft.test.ts`. No actionable P1/P2 finding.

The heading inventory now recognizes the actual domain-helper section in its existing position; extraction ranges and strict rejection of unknown, missing, duplicated or reordered headings are unchanged. This makes the expanded API section available within the existing scene-authoring range. The section includes explicitly labeled host-only preparation/lifetime guidance, which is useful boundary context; it does not add the separate host interface, Player API, TypeScript surface, live-submission, engine-verification, or GLB registration sections. The new test preserves the complete domain section and representative callable APIs plus ownership limits. The texture-contract assertion follows the reconciled documentation wording without weakening production validation.

The scene-craft fence expression now accepts both LF and CRLF while retaining the requirement for exactly one JavaScript example and compilation of that example. It changes only the test's Markdown extraction.

Independently executed Node assertions against the actual TypeScript extractor and reference: successful extraction; exact LF/CRLF output equivalence; all five existing host/development section exclusions; rejection of a renamed domain heading; and identical fenced-code extraction under LF and CRLF. All passed. Did not rerun the backend full suite; its final result remains the coordinator's responsibility.

## Follow-up: latest main PR 101 integration — 2026-10-11

Reviewed the clean staged integration of main `d2fbc57` on the saved resolved merge `b2e9303`, relative to prior main `b35e4a8`. No actionable merge-interaction finding.

Compared the entire staged raw diff from `b2e9303` with main's raw diff from `b35e4a8` to `d2fbc57`, disabling rename detection. The transitions match exactly, including every old/new blob ID. Also checked the affected paths against `d2fbc57` in the index and working tree: both diffs are empty. This establishes byte-for-byte integration of the 16 logical changed paths, including renamed/deleted built assets, without alteration or loss of the already-reviewed merge content. The staged diff for animlib and the prior authoring-reference/CRLF fixes is empty.

The request contract retains optional legacy videoMode metadata. New VideoService.create calls normalize it to interactive before persistence; matching retries compare content while returning existing records without rewriting their saved mode. Existing planning/generator consumers retain their classic fallback for old saved requests. WorkspacePage now explicitly supplies interactive and removes the selector. These contracts are consistent at this merge boundary and do not interfere with prepared/GLB asset dispatch or the expanded scene API. Reviewed upstream tests for JSON/multipart creation and saved-job retry/restart preservation; fresh backend/frontend execution is owned by the host-validation agent, not claimed here.

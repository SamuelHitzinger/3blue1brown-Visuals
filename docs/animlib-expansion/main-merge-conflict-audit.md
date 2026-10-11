# Main merge conflict audit

**Resolution follow-up:** the historical investigation below is superseded for
integration status by [main integration and validation](main-merge-resolution.md).
Its original conflict analysis remains the record of the two designs being joined.

Audited 2026-10-11 against freshly fetched `origin/main`. This is an investigation only: no merge, rebase, checkout, index update, or conflict resolution was performed.

## Exact scope and result

| Reference | Commit |
| --- | --- |
| Animlib branch (`amilibsam`) | `6e80d0a62df5ea085e724396438359b3fa99d196` |
| Fetched `origin/main` | `6fb7c22d8e226ff9c948f178cd541eb17b469a72` |
| Common ancestor | `2b666eb55d154e36710b0c450fffb3ca1c6061ab` |
| Stale local `main` (not the comparison target) | `44ba1c81f923d0303e5d570a979e6da24670b517` |

The branches have **12 animlib-only commits and 49 main-only commits**. Main's fetched tip is “Keep AI material upload available in empty courses (#98),” committed 2026-10-11 03:58:55 +0200. Of 25 paths changed on both sides, **20 have content conflicts**. There are no add/add, delete/modify, rename, or binary conflicts in this virtual merge.

The merge was evaluated with Git 2.53.0 using:

```text
git merge-tree --write-tree --messages --name-only 6e80d0a62df5ea085e724396438359b3fa99d196 6fb7c22d8e226ff9c948f178cd541eb17b469a72
```

`GIT_OBJECT_DIRECTORY` pointed to ignored `.aha/main-merge-audit/objects`; `GIT_ALTERNATE_OBJECT_DIRECTORIES` pointed to the existing object store. Git returned exit status **1** (conflicts) and virtual tree `9e12f3c9abb307e7e434f91e001336e3cde8bcce`. This writes only disposable audit objects, with no changes to refs, the index, or checked-out source. The raw result and conflicted virtual file copies are local, ignored audit evidence. Concurrent documentation/showcase edits are outside these pinned commit comparisons; rerun against their final commit before integration.

## Exact conflicted files

Paths below are repository-relative. These are the actual conflict paths, not simply files changed on both sides.

| File | Conflict and resolution direction |
| --- | --- |
| `shared/animlib/README.md` | Preserve the branch expansion entry points and main's current authoring/model documentation; reconcile the support table with the final API. |
| `shared/animlib/docs/capabilities.md` | Combine scientific helpers, prepared assets, images, and optical focus with main's GLB models and updated authoring capabilities. |
| `shared/animlib/docs/reference.md` | Reconcile duplicate model APIs after implementation; retain main's connector and procedural-noise documentation alongside expansion APIs. |
| `shared/animlib/src/compiler.ts` | Combine prepared-asset/image validation with GLB metadata validation, host-owned-field rejection, model reference verification, and imported triangle budgets. Preserve the asset catalog argument during validation. |
| `shared/animlib/src/composition.ts` | Draw commands and batching must retain both `imageBinding` and `modelMaterial`; batches must match both resource identities. |
| `shared/animlib/src/core.ts` | Export both feature sets, resolving public type name collisions first. |
| `shared/animlib/src/planar-shadows.ts` | Both changes allocate shadow vertices by `VERTEX_FLOATS`; keep one equivalent implementation using the final shared stride. |
| `shared/animlib/src/player.ts` | Wire both prepared-asset resolution and main's `ModelStore`; keep audio-only filtering, input/picking asset resolution, metadata preparation, and complete disposal. |
| `shared/animlib/src/render-geometry.ts` | Integrate the two UV/material paths, alpha handling, draw metadata, and retained keys. Preserve branch stroke animation keys and asset resolution together with main's `_modelKey` shortcut. |
| `shared/animlib/src/renderer.ts` | Reconcile resource constructor, vertex layout, shader variants, texture binding, draw dispatch, and cleanup while preserving optical focus. |
| `shared/animlib/src/retained-geometry.ts` | Retained meshes need both image and model resource metadata. |
| `shared/animlib/src/runtime.ts` | Both sides implement `scene.model` with different registries, node IDs, styles, and handles. This needs explicit compatibility design. |
| `shared/animlib/src/sequence.ts` | Pass both `assetCatalog` and GLB `models` to compilation; preserve `SceneAssets.prepare` and lease lifecycle. |
| `shared/animlib/src/texture-shader.ts` | Branch stride is 34 floats; main stride is 35. Choose a coherent layout and keep main's procedural-noise improvements. |
| `shared/animlib/src/types.ts` | Resolve two exported `ModelProps` definitions and duplicate model signatures; combine compile/player options and attach/connector capabilities. |
| `shared/animlib/src/webgl.ts` | Integrate image/GLB UV attributes, shader branches, texture units and samplers, draw bindings, and disposal including focus resources. |
| `shared/animlib/test/gpu-recovery.gpu.ts` | Keep explicit geometry-count-based allocation expectations parameterized by final `VERTEX_FLOATS`. |
| `shared/animlib/test/gpu.smoke.ts` | Same stride-aware budget arithmetic; retain main's model-related GPU setup and tests. |
| `shared/animlib/tools/render-frames.mjs` | Keep retained offline sampling and prepared packages, and add main's GLB preparation/decoding to that sampler flow. |
| `shared/animlib/vitest.gpu.config.ts` | Retain native adapter selection and include main's `test/models.gpu.ts`; keep separate image/focus suites discoverable. |

## Semantic conflicts requiring deliberate integration

### 1. The two `scene.model` contracts collide

The branch's `asset-types.ts` defines `ModelProps extends ElementStyle` with shading/material/texture/clipping/outline controls. Models resolve through an `AssetRegistry`, emit `mesh` children named `id.part`, and return an `ElementHandle`. The API also exposes `modelInfo` and standalone image helpers.

Main's `model-types.ts` defines a different `ModelProps` accepting `asset`, `tint`, and a restricted transform/opacity/shadow style. Its GLB metadata creates `model` primitives and imported node groups named `id/part`; it returns a `ModelHandle` with `part()` and `tintTo()` and preserves imported pivots and node hierarchy.

A text-level union is insufficient: the virtual file has two imports called `ModelProps`, two wildcard exports defining that name, and two `model` signatures at separate locations. Call sites cannot distinguish the registries from `{asset: string}` alone. Selecting either complete implementation discards working features.

Recommended approach: keep both asset forms at the host boundary, give internal/public property types unambiguous names, and define a compatibility dispatcher for `scene.model` based on a validated asset inventory. Reject IDs registered in both stores unless an explicit asset-kind selector disambiguates them. Preserve existing input forms, child IDs, style acceptance, and GLB part/tint methods for existing callers. Decide the return-type contract explicitly; do not claim every prepared-model handle has GLB part methods without implementing them. A unified asset system could follow later, but is broader than conflict resolution.

### 2. Shared GPU layout and texture bindings have incompatible meanings

Both implementations use vertex attribute location 14 at byte offset 124. The branch packs `(u, v, imageAlphaMode)` into three floats; main packs two UV sets into four floats. Merely setting the stride to 35 does not reconcile the data: index 33 means image alpha mode on one path and the second UV set's first coordinate on the other.

WebGPU also uses bind group 2 for both image texture/sampler bindings and main's model material resources. A single shader module cannot declare both incompatible layouts at that group. Main's WebGL model textures bind units 0–4; the branch's image path uses unit 3. Main also binds per-unit samplers, which must not leak into image/focus/compositor draws.

Recommended approach: define the final vertex layout once and dispatch clearly between plain, prepared-image, and imported-model draws. Separate shader pipelines can reuse a group number safely when each draw binds its matching layout. Alternatively reserve distinct fields/groups and update every producer/consumer together. Carry both resource identities through retention and batching. Validate alternating draw types, transparent/opaque/depth-only passes, context recovery, and disposal. Preserve main's `gl-compositor.ts` sampler resets and review the branch's new focus passes for the same state interactions.

### 3. Offline rendering must preserve retained motion and both asset hosts

Main's frame renderer compiles once and evaluates timeline snapshots. The branch deliberately replaced that with `withOfflineScene`/`sampler.sample(time)` to keep time-reactive callbacks alive. Restoring main's whole function would regress the scientific motion proofs even if GLB rendering works.

Keep the sampler flow, supply GLB metadata in its compile input, prepare the `ModelStore` from `sampler.scene`, pass both renderer capabilities, and dispose both asset lifetimes on failures as well as success. Main's backend actively sends a `models` request payload from `backend/src/agents/frame-renderer.ts`; dropping that payload path would break production visual review. Inspect the branch-only `render-video.mjs` as an adjacent integration surface even though Git reports no conflict there.

### 4. Compiler and runtime validation must preserve both trust boundaries

Preserve descriptor-only preparation for branch assets, GLB metadata verification, host-only internal geometry fields, missing-resource rejection, and imported triangle limits. Ensure retained/reactive scene updates receive equivalent validation. Do not put decoded image or mesh bytes into the scene VM to bridge the two systems. Verify both formats in the same scene, plus malformed metadata and ambiguous IDs.

### 5. Cleanly merged changes still need targeted checks

Five shared paths merge without conflict: `package-lock.json`, `shared/animlib/package.json`, `shared/animlib/src/bindings.ts`, `shared/animlib/src/spatial.ts`, and `shared/animlib/test/renderer-fallback.test.ts`.

- Dependencies: retain main's `@gltf-transform/core`/`extensions` alongside the branch's `pngjs`, then verify the workspace lock/install agrees.
- Bindings: preserve branch attachment `anchor: 'midpoint'` and main's connector visual-center/bounds trimming and default behavior. `types.ts` conflicts even though the implementation combines textually.
- Picking: preserve asset-resolved mesh picking and main's bounded GLB `model` picking.
- Renderer fallback mocks: both families of textures, samplers, focus passes, and recoverable failures must be represented after dispatch is reconciled.
- Main-only backend changes already consume `CompileInput.models`, `Asset` model manifests, and GLB metadata. They are unaffected by textual conflicts but depend on preserving those contracts.

## Recommended resolution order

1. Freeze the intended merge commits and resolve model identity, props, and handles in `types.ts`, asset/model types, and `runtime.ts`; add coexistence coverage for both asset formats.
2. Reconcile compiler validation and sequence/player host wiring, including audio filtering, picking, preparation, and cleanup.
3. Define vertex layout and rendering resource dispatch; resolve render geometry, retained geometry, composition, both backends, and focus/shadow passes together.
4. Integrate the frame export tool around retained offline sampling; exercise main's backend GLB request path and branch scientific assets.
5. Resolve GPU expectations/configuration, then combine documentation around the actual final contract.
6. Run the validation gates below against a real resolved merge in an isolated checkout. Rerun the virtual conflict check if either source tip moves.

## Validation needed after resolution

This audit does **not** claim a merged tree builds or passes tests: the virtual tree intentionally contains conflict markers. Unit/type/build checks on the current branch do not establish compatibility with main.

Run `npm run typecheck`, `npm test`, and `npm run build`; also validate the backend build/typecheck/tests because its model contracts changed. Exercise main's `models.test.ts`, `connector-bounds.test.ts`, `models.gpu.ts` and browser model coverage, plus branch asset/image integration, path animation, offline sampling, runtime ownership, and depth-focus coverage. Native GPU checks need the required adapter; report a missing backend as a limitation rather than a pass.

Add mixed-format render evidence: prepared image + prepared scientific mesh + textured GLB in one scene, alternating draws and transparency, retained path changes, focus/shadows, context restoration, and disposal. Export at multiple times to demonstrate scientific motion still changes, and run a backend-produced GLB frame-render request. Keep baseline rendering and performance evidence for both original branches when assessing the resolved merge.

## Post-showcase checkpoint verification — 2026-10-11

Repeated the same disposable-object virtual merge after the accepted showcase and documentation checkpoint, using branch commit `7891407f0c75d318e1131014b9d25aad03027c6c` against the unchanged fetched main commit `6fb7c22d8e226ff9c948f178cd541eb17b469a72`. The common ancestor remains `2b666eb55d154e36710b0c450fffb3ca1c6061ab`; divergence is now **13 branch-only / 49 main-only commits**.

Git again returned exit status **1**, with **20 content-conflicted files**, virtual tree `f0f8bcfec17bc07a0c5eec2111d9e7505f272c66`. Comparing the conflict path sets to the original audit found **zero added and zero removed paths**. The exact file list, semantic findings, and recommended resolution order above remain applicable. This focused rerun does not claim the unresolved virtual tree passes build or tests.

Raw local evidence: `.aha/main-merge-audit/merge-tree-post-checkpoint.txt`. No actual merge, index/ref update, or source edit was performed; only this report was appended.

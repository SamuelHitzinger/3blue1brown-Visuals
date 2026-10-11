# Native compile-budget findings

Read-only source/API investigation; no generated source or production files changed. These are possible follow-up prompt improvements if the frozen candidates fail, not modifications to an active comparison.

## Evidence boundary

The original enzyme run's native failure occurred after concurrent built-runtime (`dist`) drift. It is therefore not a clean matched experimental outcome until reproduced in the isolated, pinned worktree. The copied diagnostic still shows that its untouched generated source failed Node's 200 ms QuickJS budget twice at line 48, then compiled under a diagnostic-only 1000 ms limit. It does not establish that an increased budget is acceptable, that geometry is visually successful, or which construction block dominates cost.

The scene builds static meshes once and animates rigid transforms. There are no time bindings, topology changes or per-frame reconstruction. `withOfflineScene` compiles once (`shared/animlib/src/offline-sampling.ts:26`); compilation precedes GPU creation in `tools/render-frames.mjs:38–45`. The deadline covers runtime injection, authored construction and result serialization (`compiler.ts:353–384`). “Avoid per-frame rebuilding” would not address this source.

## API correction

The earlier suggestion to replace ellipsoids with anisotropically scaled sphere primitives was wrong. `ElementStyle.scale` and `scaleTo` accept a scalar (`shared/animlib/src/types.ts:138,474`); the `number | Vec3` scale at line 62 controls procedural texture frequency. Preserve ellipsoids with mesh vertex coordinates or an available static model, not `sphere({scale:[rx,ry,rz]})`.

## Representation-preserving optimizations

1. **Reuse computations before deleting geometry.** The original `limit(false)` and `limit(true)` each scan `3×49×96` surface sites (28,224 total); the first two ellipsoids are identical between the alternatives. Reuse those results, and precompute angular sine/cosine tables shared across parts. This reduces repeated work without changing sample positions, topology or the intended clearance calculation. It is not yet measured performance proof.
2. **Share an ellipsoid template in coordinates.** The six substrate lobes each resample the same 40×24 unit-sphere parameterization. Compute its unit vertices and triangle connectivity once, then form each ellipsoid's mesh vertices as `[cx+rx*x, cy+ry*y, cz+rz*z]`. This uses supported `s.mesh` arrays and preserves the sampled shape; it does not require unsupported nonuniform element scaling. Host cloning/serialization still costs time, so verify the complete compile path.
3. **Make contact calculations match the designed geometry.** For shapes with an analytic contact/clearance solution, derive the stop position from that shared shape. The current enzyme surface mixes a smooth union of ellipses with trigonometric relief; there is no justified exact closed-form contact shortcut. For that shape, use a bounded search with local refinement and a verified conservative margin, or externally prepared contact data if actually available. Do not invent a docking height or claim a sparse sample proves collision-free motion.
4. **Spend mesh samples where the picture needs them.** The main closed-U 112×80 surface samples 9,072 vertices; each 40×24 lobe samples 1,000. Surface generation also validates samples and tests every triangle's area (`surfaces.ts:33–84`). Choose resolution from the projected silhouette, narrow pocket wall and contact region. Modest global sampling plus locally concentrated custom mesh samples can preserve defining shape; reduced counts require native frame/motion comparison. No universal count is sufficient.
5. **Use assets only through available tools.** `publish_model` accepts an existing public HTTPS GLB or explicit generated named-mesh JSON (`reference.md:3674`; `runtime.ts:194`). It does not execute arbitrary geometry code, optimize meshes, or prepare contact calculations. An available immutable model can remove static geometry construction from the scene VM. It cannot be assumed that an author has shell access or an offline mesh-generation tool.

## Optional short authoring addition

> Rich spatial geometry must fit the complete native compile path. Reuse shared samples, trigonometric tables and mesh topology; derive simple contact poses from the same geometry instead of densely scanning every surface. Use a bounded, locally refined search only when the shape requires one, and verify conservative clearance. Choose sampling from visible curvature and the active contact region, then inspect native motion before reducing detail. Static models may use available published assets. Do not invent preparation tools, use vector element scaling, change execution budgets, or replace defining geometry with generic primitives. A successful analytical inspection alone does not establish native-render readiness.

Keep this addition separate from dimensional routing. If needed, create a newly named candidate and fresh run IDs; do not retrofit it into the frozen A/B comparison or count a diagnostic compile as a full-pipeline pass.

# Molecular implementation report

Date: 2026-10-11. Branch: `amilibsam`. No branch switch, commit, push, or merge performed by this worker.

## Delivered modules and boundaries

- `shared/animlib/src/molecular-backbone-types.ts`: explicit residue/segment identity, representation, scientific/schematic provenance, result correspondence, fixed-link pose specification.
- `shared/animlib/src/molecular-backbone.ts`: self-contained factory compatible with host and verbatim QuickJS installation; explicitly supplied bonds, ordered Hermite backbones, minimally transported ring normals, deterministic budgeted mesh chunks, persistent palette values and ID mapping. Beads delegate to existing `createMoleculeBuilders` detail 1.
- `shared/animlib/test/molecular-backbone.test.ts`: 13 focused regression/invariant cases.
- `shared/animlib/demo/expansion/molecular-proof.mjs`: reproducible original native proof generator, host preparation with existing molecular-envelope implementation, retained absolute-time geometry callbacks.
- `shared/animlib/demo/expansion/molecular-style-contract.md`: folding-specific source evidence, progression, caveats and review criteria.
- `docs/animlib-expansion/molecular-implementation.md`: pinned factory and approved public SceneContext integration signatures, limits and supported handling.

No compiler/runtime/types/core or renderer edits by this worker. The integration worker owns those files. Scientific PDB data, existing envelopes, material support and bead batching were reused rather than replaced. No physical folding, atomic chemical bonds, solvent-accessible surface, or reference parity claim is made.

## Test-first evidence and verification

Commands use process-local TEMP/TMP `C:\Users\samue\Stuff\3yellow3white\data\animlib-expansion\tmp`.

1. Wrote 11 behavior/invariant tests against explicit not-implemented factory stubs. Ran `npm exec --prefix shared/animlib -- vitest run shared/animlib/test/molecular-backbone.test.ts`: all 11 failed meaningfully on missing geometry/kinematics and expected validation, before implementation.
2. Implemented factory and focused types. Same command: 11/11 passed.
3. Added precision regression: tiny non-axis-aligned links at large origin silently lost length. Observed the new expected-error assertion fail. Added coordinate-relative precision rejection, plus early triangle-budget preflight. Focused command: 13/13 passed.
4. `npm run typecheck --prefix shared/animlib`: passed after final source validation change.
5. `npm run build --prefix shared/animlib`: passed before initial proof; rerun at handoff.
6. Full `npm test --prefix shared/animlib` on the concurrently changing tree: **693 passed, 4 failed** (697 tests). All molecular tests passed. Peer work-in-progress failures reported to root and math worker: `diagrams-graphs.test.ts` / "keeps edge endpoints on moved node surfaces and weight labels at the connected midpoint" (weight expected -1, got 0); `diagrams-production.test.ts` / "samples original shear geometry, quiet scaffold, labels and coefficients through the production VM", "keeps the graph cost and C frontier record synchronized with the actual improving trace", "seeks the same duplicate items directly and backward with exact endpoints" (VM methods not yet integrated). Root must rerun the complete suite after shared integration; this is not a full-suite passing claim.

Coverage includes explicit breaks/empty bond graphs/explicit cross-segment edges, duplicate residue and segment IDs, invalid bond graphs/nonfinite coordinates, repeated anchors, reversals, normal seed rejection, known orientation/outward triangles, near-straight and sharp bends, temporal nonflipping normals, topology and vertex-ID stability, deterministic chunking/budgets, analytical orthogonal pose, endpoint holds, dense interior link invariants, backward seeks, factory standalone installation, provenance and coordinate-relative precision loss.

## Original proof evidence

Generated and rendered through the actual animlib compiler, retained-time sampler and production native WebGPU renderer:

- Source: `data/animlib-expansion/molecular-proof/molecular-folding.js`
- Manifest: `data/animlib-expansion/molecular-proof/manifest.json`
- Video: `data/animlib-expansion/molecular-proof/film.mp4` (8 seconds, 1280×720, 30 fps, 240 frames, H.264/yuv420p, silent).
- Frames: `data/animlib-expansion/molecular-proof/frames/`; 14 explicit times (0, .7, 1.1, 2, 3, 4, 4.7, 5.1, 5.5, 5.8, 6.15, 6.5, 7.5, 8) at both 1280×720 and 960×720, plus contact sheets. `frames-manifest.json` lists paths/times.
- Measurements/provenance/source motion: `provenance-and-invariants.json` in that directory.

Measured: 33 identified anchors, 32 explicitly supplied bonds, six scene elements, endpoint envelope 1392 vertices/2780 triangles. 801 absolute-time kinematic samples from 0 to 8 seconds yielded max relative link-length error `1.7763568394002505e-15`. Production sampler confirms visible vertex movement and identical full frames after backward seeks. Source length before public integration: 165654 characters, below unchanged 256000 cap.

Author inspected native contact sheets for setup/motion/representation transitions and full endpoint framing at both aspect ratios. Initial framing clipped an endpoint; the final version uses consistent bounding-box centering and rotates the shared structure to fit. Current frames and video use corrected framing. This is composition QA only; the author has not completed dense frame-by-frame or actual playback inspection, and does not provide an independent style verdict. Root schedules the separate reviewer.

The current proof installs the reusable factory in scene source. It is native animlib geometry and rendering but **not yet proof of public SceneContext integration**. Run `node shared/animlib/demo/expansion/molecular-proof.mjs --integrated` after the integration worker exposes `s.molecularBackboneGeometry` and `s.articulatedChainPose`; that mode uses only those public methods and removes factory inlining. The generator intentionally lets missing API calls fail in the production VM. Then rerun frames and encode. Metadata records which integration mode generated the proof.

Reproduction from repository root:

```powershell
npm run build --prefix shared/animlib
node shared/animlib/demo/expansion/molecular-proof.mjs --integrated
node shared/animlib/tools/render-frames.mjs data/animlib-expansion/molecular-proof/frames-input.json
node shared/animlib/tools/render-video.mjs --manifest data/animlib-expansion/molecular-proof/manifest.json --output data/animlib-expansion/molecular-proof/film.mp4 --ffmpeg data/video-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe --width 1280 --height 720 --fps 30
```

## Remaining review and fidelity limits

Independent reasoning/readability/reference-style/technical verdicts remain pending. Reference inspection was inherited from `molecular-reference.md` and does not establish continuous source motion matching. This is a deliberately small residue-level schematic with fewer anchors and much simpler atom/bond detail than PyMOL. Existing bead detail 1 remains visibly polygonal at close zoom. The folded endpoint is a serial helical bend, not a physically determined protein fold; collisions are not modeled. Gaussian smoothing can merge nearby lobes. The proof has no protein ribbon extension, cellular environment, secondary-structure assignment, atomic sidechains, or full PDB bond/chain-break import.

Backbone tubes are open-ended and reject reversals and seed-normal singularities; explicit separate segments and beads handle these cases where appropriate. Equal-topology correspondence applies within a representation only. Cross-representation continuity is semantic (residue identity/position/palette), not a false vertex-index correspondence. Sticks have no inferred edges. Surface endpoint uses the exact final anchor coordinates, same origin, and nearest-anchor sequence-color mapping.

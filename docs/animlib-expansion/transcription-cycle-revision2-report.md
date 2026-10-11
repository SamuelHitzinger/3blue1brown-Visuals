# Transcription cycle revision 2 — author evidence

Status: frozen candidate for independent review, not an independent acceptance claim. This revision addresses the earlier rotating-shell occlusion and end-on RNA rail. Original proof and focus-proof files were not changed. Geometry, assets and films were frozen on 2026-10-11; RNA processing may reuse the frozen nucleotide packages.

## What changed

The optional helper controls `exitFrame:'axis'`, `exitBend`, and `window.lockOrientation` keep extrusion in a fixed anatomical basis with exact circular chord links. Coherent whole-DNA phase rotation holds the active baseward normal steady; it does not pin exterior DNA to world coordinates. The blue machine has one connected original open cavity and a fixed anatomical orientation. Arriving nucleotides remain exposed across repeated docking, incorporation and advancement. RNA progressively bends away without rotating the whole formed chain with the active helical normal.

Original lobed nucleotide silhouettes replace the plain ellipsoids. Purple DNA and green RNA retain separate sugar/phosphate/base parts and color-coded bases. Twenty-four contextual molecules at four depths and four large distant scaffold forms provide depth. Main DNA, RNA and enzyme remain opaque throughout; fixed low-opacity distant scaffolds are context. Actual finite-aperture focus separates foreground from depth, with 16 samples. Broad lighting, highlights and the gray/violet palette follow the source family. The final camera follows the same `rna-0`, `rna-1`, `rna-2` IDs into a C/A/U label and bracket hold, with corrected top margin in both aspects.

These are illustrative procedural meshes, not atomic coordinates, recovered source meshes, or a known enzyme structure. Purine and pyrimidine shapes differ, but neither resolves chemical rings. The connected shell is intentionally simplified, and the gray contextual scaffolds remain simpler than the source cellular environment. The prescribed circular path is not chemical dynamics or a general flexible-polymer solver. The lock option deliberately rotates exterior DNA. No near-identical source fidelity is claimed.

## Personally inspected evidence

Before revision: all 16 baseline/focus ordered sheets (256 samples), native 1.29/2.2/3.5/4.8/5.45/7.5 seconds for both variants and both aspects (24 frames), all seven source growth sheets covering 109 samples from Nucleus 115–131 seconds and native 119/124, plus the two opening sheets 32-64-03/04 and native104 (32 more samples). The controlling evidence and visual contract are in `transcription-cycle-revision2-style-contract.md`.

Final revision: all eight encoded ordered sheets, 64 samples per aspect at 8 fps (128 total), and native 1.29/2.2/3.5/4.8/5.45/7.5 seconds in both aspects. Final margin-adjusted 7.5-second native frames were inspected again after encoding. The middle passage maintains a side-on active pair through more than three cycles. The shell does not hide the arriving base. In 4:3 some older RNA leaves the left edge during the active-end hold; the final camera returns to the retained first triplet. The annotation stays attached and fully inside the frame. The complete 8-second files decode without errors. This is ordered frame inspection, not a claim of uninterrupted real-time playback.

## Reproduction and artifacts

From repository root, build with `npm run build` in `shared/animlib`. The original-geometry preparation script is `shared/animlib/tools/prepare-transcription-revision2-assets.mjs`; the scene generator is `shared/animlib/demo/expansion/transcription-cycle-revision2.mjs`. The asset root is `shared/animlib/fixtures/biological/transcription-revision2`. Its manifest `sourceHash` records the original scaffold description, while exact surface equations and tessellation are in the preparation script; binary content hashes bind the prepared geometry. Do not treat the small scaffold recipe alone as a complete mathematical surface specification.

The new output root is `data/animlib-expansion/transcription-cycle-revision2`. It contains `cycle.js`, manifest, inputs, frame instructions, 24 native frames, both films, eight ordered sheets, and machine-readable checks. Render using `shared/animlib/tools/render-frames.mjs` and `render-video.mjs` with `cycle-manifest.json`; films use native WebGPU at 1280×720 and 960×720, 30 fps, 240 frames, H.264/yuv420p, no audio. `inspect-transcription-revision2.mjs` fully decodes and extracts all ordered sheets. Native filesystem resolution required narrowly scoped local escalation on Windows.

Film SHA-256:

- 16:9: `a646a1c0ba8260404360997b3fd6fe864140da0ebf5eb5b401bc7baa421e31f9`
- 4:3: `b2d17aafd6b46f994cba86c9d7da56a564d95213d349660f1715b7725572b1ab`

## Verification and costs

The new tests were introduced before implementation: the locked active-normal and curved-exit cases failed, then passed after the helper changes. Final serial run: 2 files, 14 tests passed, including public host/QuickJS construction, retained callbacks, reverse seeks, exact event times and their adjacent representable values. TypeScript build passed. Logs are `focused-tests.log` and `build.log`; test TEMP/TMP was the dedicated `data/animlib-expansion/tmp-transcription-revision` directory.

`probe-transcription-revision2.mjs` compares 321 default-output samples byte for byte with the accepted exact-boundary helper at commit `ab5f34d3540269c05d695ef2d75612c37a30ff41`. All match. Explicit defaults also match omission. The exact absolute arrival/docking comparisons and `complete === (incorporated === count)` remain intact.

The seeded adversarial probe covers 160 accepted schedules and 12,960 poses with varied signed bends/twists, axis orientation, pitch, origin, exit direction, and both lock states. Maximum link error is 4.774e-15; maximum unit/orthogonality error is 2.998e-15. Invalid exit modes, insufficient axial direction, nonzero active-frame bends, tiny bends and excessive full-chain turns are rejected. Unwrapped angular normals avoid antipodal-zero interpolation. The bounds cover inactive as well as visible sites.

`verify-transcription-revision2.mjs` checks 321 scene-schedule samples, all 56 stable IDs, 46 DNA bonds and seven final RNA bonds. Maximum DNA/RNA link error is 8.882e-16. Event-side position difference at ±1e-7 seconds is at most 6.939e-13; the exact adjacent-representable event states are covered separately by tests. Closed-behind register6 and final active register13 behave as intended; post-completion geometry does not drift. Native batch anchor and rotated-tip checks cover all56 sites ×3 parts ×8 times within1e-10, with exact reverse-seek output and retained C/A/U IDs.

Measured compile cost is 117.34ms; 121 samples including serialization cost 1421.50ms; maximum serialized frame is 226,851 bytes. This is one local CPU measurement, not a benchmark guarantee. There are 258 scene elements and five prepared models, decoding 4,958,208 bytes. The heaviest geometry check counts 92,316 logical vertices and 173,436 triangles. Conservative submitted triangle vertices: 8,324,928 at16 samples, 16,649,856 at32; both under32M. At1280×720 and16 samples, 14,745,600 sampled pixels and4,128 focus draws are under64M/64k. The 44-byte-per-pixel focus storage estimate is40,550,400 bytes, under256MiB. No renderer budget was raised.

Independent review should decide whether the exposed multi-cycle view, curved persistent RNA, original lobed anatomy, optical focus and retained triplet now establish the required source-derived capability. Remaining visual simplifications above are explicit rather than hidden by the numerical checks.

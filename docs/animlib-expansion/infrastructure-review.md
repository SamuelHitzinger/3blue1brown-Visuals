# Independent infrastructure review

Date: 2026-10-11. Reviewer: independent delegated reviewer, not implementation
author. Scope: `85be910..be2755a` on `amilibsam`, using
`data/animlib-expansion/infrastructure-review.diff`; unrelated concurrent changes
were excluded. No production code edits, test reruns, commits, pushes or merges.

## Verdicts

- **Spec: ready.** The isolated export repair and architecture audit satisfy the
  infrastructure brief. The regression-first history is author-reported; the
  resulting regression coverage and production integration were inspected.
- **Code quality: ready.** No blocking correctness, lifecycle, export integration,
  or scope finding in the isolated code change.
- **Asset architecture: ready as a proposal.** Essential host/VM/renderer and
  lifetime boundaries are present. Resolve the two low-priority clarifications
  below in the implementation brief; they do not block this export repair.

## Findings and implementation handoff

1. **P3, schema clarification — `docs/animlib-expansion/asset-architecture.md:41`:**
   `ImageAsset.pixels` is unconditionally RGBA8 with sRGB encoding, whereas lines
   168–172 permit an explicitly palette-indexed image representation. Make pixel
   storage a discriminated union (RGBA8 versus index plane plus palette mapping),
   or explicitly defer palette-indexed images in version 1 and reject them. A
   host policy flag alone must not stand in for the storage format or enable
   unvalidated RGB images in a palette-only host.

2. **P3, interface clarification — `docs/animlib-expansion/asset-architecture.md:151`:**
   Specify the shared host-side geometry resolver that supplies validated asset
   positions/indices/bounds to both retained and streamed CPU geometry paths.
   The stable-key route is described, but the implementation contract should
   explicitly cover `bounds.ts`, render validation, clipping, shadows, and
   transparent triangle sorting when retention is unavailable. Use one narrow
   read-only resolver in the proposed `asset-geometry.ts`, backed by a held lease;
   avoid backend-specific expansion or restoring large arrays into `Frame`.

These are documentation handoff improvements, not demonstrated export bugs. No
changes to the export implementation are requested by this review.

## Evidence against the brief

| Requirement | Inspected evidence |
| --- | --- |
| Compile once; sample actual absolute time | `offline-sampling.ts:23` creates one `SceneProgram`; lines 30–38 clamp time, update retained callbacks, and merge into a fresh snapshot. Both native tools call `sampler.sample(time)`. |
| Default endpoint handoff | `render-video.mjs:106` assigns the scoped callback result to `previous`; line 138 returns `sampler.sample()` after rendering. Its default is the exact scene duration, independent of the last encoded sample. |
| Backward/nonmonotonic samples and immutable snapshots | Focused test samples 2, 0, 1.5, 0.25, 1 and checks canonical/prior snapshots; deformation test returns to zero. Logic matches `SceneSequence.sampleScene`. |
| Static timeline and retained control semantics | Static frames compare against existing `evaluateScene`; supplied slider value is captured from the compiled scene. No interactive control mutation API was added. |
| VM cleanup including errors | `offline-sampling.ts:42` uses `finally`; `return await use(...)` covers asynchronous rejection. Compilation errors remain owned by `createSceneProgram` cleanup. Test spies inspect real QuickJS context/runtime `alive` state for success and failures. |
| Static/subtitle/silent/duration contracts | Existing video validation, encoder arguments, subtitle generation/mux and cleanup remain intact; only compilation/sampling scope changed. The public helper is exported from `core.ts:5`. |
| Native production integration | Tracked runner invokes both production tools. Existing native PNGs and decoded MP4 frames were independently viewed, as detailed below. |
| Bounded host assets, provenance, external formats | Proposal includes descriptor-only VM input, hash identity, package validation, aggregate budgets, source/license/modification records, transactional leases, per-renderer device ownership, and explicit converter subsets. |
| Performance claims and scope | Dense geometry costs are tied to implementation/counts. CPU-stub figures are explicitly not GPU frame-rate evidence. No renderer overhaul or dependency addition appears in the diff. |

## Native proof inspection

Viewed both native frame contact sheets in
`data/animlib-expansion/offline-proof/frames/`: `1280x720-sheet-0.png` and
`960x720-sheet-0.png`. Their three complete frames show the yellow probe left,
center, and right at t=0, 1, and 2 with stable size and vertical position.

Independently decoded the existing `proof.mp4` into a contact sheet containing
**all 24 frames**, preserving frame order and complete frames. Command (exit 0):

```powershell
& 'data/video-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe' -hide_banner -loglevel error -y -i data/animlib-expansion/offline-proof/proof.mp4 -vf 'scale=320:180,tile=6x4' -frames:v 1 data/animlib-expansion/offline-proof/reviewer-video-all24.png
```

Viewed `reviewer-video-all24.png`: frames 0–15 advance steadily right; frame 16
advances to the endpoint; frames 16–23 hold the same endpoint. This independently
inspects the encoded temporal sequence rather than relying solely on the
author's measurements. It is decoded-frame inspection, not real-time playback.
Read the recorded native run log, source fixtures, verifier, subtitle sidecars
via their verification assertions, and `verification.json`. Reported centroids
are consistent with the images and the fixture's camera mapping.

Proof verdicts: **reasoning ready** for the narrow absolute-time/handoff claim;
**visual readability ready** for the technical probe; **reference style
unverified / outside this proof's scope**; **technical delivery ready** for this
retained-time export change. The moving circle provides no artist-fidelity,
scientific-model, image-texture, WebGL parity, or GPU-performance evidence.

The author reports focused 6/6, full 670/670, typecheck, build, and native proof
success. Those checks were not rerun, as requested. This review does not newly
certify their execution or the separate GPU suite; the report explicitly records
the earlier GPU baseline failures.

## Architecture assessment

The registry is justified by the existing source/VM/payload bounds; metadata-only
worker transport and geometry references address repeated serialization directly.
Leases, candidate rollback, shared registry ownership and per-device GPU resources
are necessary lifecycle rules rather than speculative infrastructure. Keeping
active-frame GPU sweeping and postponing a GPU LRU avoids premature complexity.
Build the registry/reference static-model slice first; add UV/image support and
the documented converter subset through the later gates already listed.

The format distinction was checked against the linked [Khronos glTF 2.0
specification](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html): GLB
packaging does not eliminate material, skin, animation or sampler semantics.
Explicit rejection/baking and fidelity reports are appropriate. The proposal's
OBJ/MTL references are available from the [Library of Congress OBJ
description](https://www.loc.gov/preservation/digital/formats/fdd/fdd000507.shtml)
and [MTL description](https://www.loc.gov/preservation/digital/formats/fdd/fdd000508.shtml).
No complete-format support or renderer fidelity is implied by this proposal.

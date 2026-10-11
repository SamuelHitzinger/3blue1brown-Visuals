# Peptide revision 3 handoff

Status: frozen author candidate; independent visual and technical review pending.
The full reference-fidelity goal remains open. Previous films remain unchanged.

## Change and evidence

The earlier proof let connecting-loop torsions turn entire downstream helices
end-on while local coils formed. This revision uses offline inverse kinematics
to keep all four helix blocks side-visible and separated, then holds that state
from 3.1 to 4.2 seconds before prescribed compaction. It retains the same 72
residues, 414 atoms, 413 edges and original compact endpoint.

Seventy-two retained references share one reusable CA bead mesh. The final
envelope derives from the unchanged compact coordinates, with six smoothing
iterations and one shared-edge subdivision; common normals precede part splitting.
A small original texture interpolates sequence color on the surface. The surface
appears after CA-to-stick transition, followed by a restrained orbit. The visual
contract is `peptide-revision3-style-contract.md`.

Root reviewed all ten MP4-derived ordered 8fps sheets across the complete two
10-second films: **160 sampled full-composition frames**. It also reviewed all
six native still sheets and full-resolution 3.5s/8.4s frames in both aspects,
alongside actual source frames 071/079 and the previously inspected complete
folding playback. This is dense sampled motion inspection, not a claim to have
viewed every encoded frame. All stages remain in frame; the local coils remain
side-visible through their hold. Global compaction remains a visibly prescribed
loop motion; independent review must judge its fit to the reference.

## Frozen media

Both files are H.264/yuv420p, 30fps, 300 frames, 10s, silent, under
`data/animlib-expansion/biological-motion-revision3/`. Complete FFmpeg decodes
finish successfully at 300 frames. Ordered sheets use 16 samples per page.

| File | SHA-256 |
|---|---|
| `peptide-16x9.mp4` (1280×720) | `1c2812d8295a9fbed1d6dd6824348d23b2b88108c0624cbe143aeb62f89b8cd9` |
| `peptide-4x3.mp4` (960×720) | `9ffa8a529bc4a2f2d71a338eea87d17029da2ec37e612aaccebed03d24afb1ab` |

## Verification and limits

Three focused tests pass: all identities and displayed bond lengths across 201
poses (error below 1e-10), four side-visible separated blocks across 121 formation
poses, and the unchanged endpoint under its common rigid transform (below 1e-9),
including arbitrary reverse seeks. These tests also passed in the 940-test
integrated snapshot. They caught a loop-control warm-start reset and insufficient
keyframe density before film generation; their tolerances were not weakened.

The generator checks retained-VM reverse seeks exactly. Its local sample reports
171,050 source characters, 80 elements, 361ms compile wall time, 9,068ms for 121
samples including full-frame serialization, and a largest serialized frame of
1,213,412 bytes. This last number is not an individual reactive-update size.
The original runtime limits remain unchanged; no realtime playback guarantee is
made. Static assets decode to 21,456,384 bytes. A heavier generated bead approach
was replaced with shared asset instances to satisfy existing VM limits.

This is an original idealized peptide with authored torsions, not measured
folding, a force field, collision avoidance or an exact copy of the source
protein. The surface is a schematic display envelope. Original assets are CC0;
pinned official CCD provenance remains attached to the underlying rig.

## Reproduction

From repository root after building animlib:

```sh
node shared/animlib/tools/prepare-peptide-staging.mjs
node shared/animlib/tools/prepare-peptide-surface.mjs
node shared/animlib/demo/expansion/peptide-staged-proof.mjs
```

Use `tools/render-frames.mjs` with the generated frame JSON, and
`tools/render-video.mjs` with the generated manifest, 30fps and each stated size.
The original and refined fixtures have separate IDs and provenance files.

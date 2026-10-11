# Biological visual revision 2 release

2026-10-11. Frozen for independent review. This iteration responds to the peptide and transcription findings in `motion-visual-review.md`; it does not close the broader Nucleus chronology or moving-active-site gap.

The peptide opens in an original broad looped pose, exposes bright persistent CA beads and a connecting tube, forms local coils, holds, compacts, returns to branched sticks, and reveals the unchanged endpoint envelope. No title/footer carries its explanation. All 414 atom IDs and 413 explicit graph edges remain unchanged. The revised staging torsions are generated separately from the unchanged original rig and compact endpoint.

The RNA scene replaces plates with reusable original rounded sugar/phosphate/base assets. Context DNA and foreground RNA use separate bounded quality levels. Four original smooth machinery lobes retain a visible channel; sparse distant subunits provide depth context. Sites `rna-0`, `rna-1`, `rna-2` become the foreground U/G/C subject, with individually anchored letters, leaders and a three-site bracket. The camera follows their current anchors during the zoom. Other material loses contrast; this is not optical depth-of-field blur. Terminal frame motion includes the separate repair worker's released continuity fix.

## Frozen artifacts

All files below are in `data/animlib-expansion/biological-motion-revision2/`. Each film is 8 seconds, 240 frames, 30fps, silent H.264/yuv420p. Aspects are 1280×720 and 960×720.

| Film | SHA-256 |
|---|---|
| `peptide-16x9.mp4` | `951d154c85fc6217c733e0f8da313d17d1af5153f05d8ba11371d1e3a88b7ddc` |
| `peptide-4x3.mp4` | `cc889aae2719d9e64820fd40d42dd6d74c7f960cc4cdaaa6b55dcb987bb0d17b` |
| `transcription-16x9.mp4` | `ff263d51b333ad6cfbcad055ecf9f9949cf4f9f7b87670efabac2f522d548497` |
| `transcription-4x3.mp4` | `79585094790b290c37c5a7cfb5716f23a2beb66c265c654724aa6d28badb34da` |

All four complete FFmpeg decodes succeeded. The author viewed all 16 final MP4-derived ordered sheets at 8fps: 256 sampled full-composition frames, plus native full frames and native both-aspect still sheets. This is dense sampled motion inspection, not every encoded frame or realtime playback. An intermediate RNA zoom clipped the moving triplet; current-anchor camera targets corrected it before the final two RNA renders and their complete reinspection.

## Reproduction and provenance

Generators: `shared/animlib/demo/expansion/peptide-motion-proof.mjs` and `transcription-motion-proof.mjs`. Anatomy preparation: `shared/animlib/tools/prepare-nucleotide-anatomy.mjs`; all native assets, exact original scaffold recipes, provenance hashes and README are under `shared/animlib/fixtures/biological/nucleotide-anatomy/`. Assets are original CC0 schematic geometry, not deposited polymerase, exact atomic nucleotide chemistry, or reference-image extractions. The existing peptide CCD source hashes, scientific limits and endpoint assets remain unchanged.

The new scene assets are five packages: high-detail purine/pyrimidine, lower-detail contextual variants, and four-lobe machinery. Each nucleotide has separate `sugar`, `phosphate`, and `base` parts. Local x points toward the base and local y follows the returned tangent; nominal local reach is .675. Scene transforms use the persistent backbone anchor and returned frame. Prepared vertex arrays are never embedded in scene source. Existing public native helpers and asset references compose the proof. Shared runtime, renderer, and nucleic implementations were not edited by this visual revision.

## Checks and budgets

`node shared/animlib/tools/verify-biological-motion.mjs` passes. Across 161 revised peptide poses, maximum displayed graph bond-length error is `1.2434497875801753e-14`; all IDs/edges persist, and the compact endpoint matches the saved endpoint within `1e-10`. Across 161 RNA times, maximum formed-link error is `3.3306690738754696e-16`. Native anatomy position/orientation and individual letter anchors match the pure host RNA sites within `1e-10`; both scene reverse seeks are exact. The focused peptide, nucleic geometry and nucleic integration suite passes 18 tests in 3 files.

| Local measurement | Peptide | RNA |
|---|---:|---:|
| Scene source characters | 17,472 | 11,368 |
| Scene elements | 10 | 178 |
| Compile time | 393ms | 139ms |
| 121 samples including full-frame serialization | 10,038ms | 2,412ms |
| Largest serialized full frame | 1,351,660 bytes | 258,438 bytes |
| Static decoded asset bytes | 4,310,528 | 10,674,176 |

These single local measurements are not realtime guarantees or exact VM callback-response byte counts. The existing VM/reactive and 100,000 scene-vertex limits remain unchanged. A first attempt to use foreground detail everywhere exceeded the geometry budget; contextual quality variants resolved it. No limits were raised.

The peptide surface remains the existing relatively coarse envelope, and local movement is prescribed torsions without collision avoidance or dynamics. Nucleotide anatomy communicates gross subunits and base ring class, not atomically faithful chemistry. The machinery is illustrative. The DNA window is still fixed; shell translation does not prove advancing chemistry. The next boundary proposal is documented in `biological-revision2-contract.md`; it is not implemented. Independent review decides whether these local readability and anatomy revisions pass.

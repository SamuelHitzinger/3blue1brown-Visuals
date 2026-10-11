# Cached peptide display assets

These original assets reuse the exact compact endpoint in
`../illustrative-peptide/endpoint.json`; `conversion-report.json` records its
SHA-256. No source-video image or mesh is included.

- `peptide-polished-surface.json`: Gaussian display envelope of all 414 heavy
  atoms, six smoothing iterations and one shared-edge Loop subdivision. Shared
  normals are computed before splitting 64,272 triangles into six bounded parts.
- `peptide-sequence-colors.json`: original 512 by 1 RGBA sequence-color texture.
  Each shared surface vertex gets its nearest atom's sequence coordinate; values
  interpolate across triangles and sample this texture linearly.
- `bead/peptide-unit-bead.json`: one subdivided unit sphere reused by 72 retained
  CA instances. It avoids rebuilding identical bead triangles every frame.
- `palette.json`: the corresponding seven-color scene palette.

Regenerate from the repository root after building animlib:

```sh
node shared/animlib/tools/prepare-peptide-surface.mjs
```

The envelope is schematic, not a solvent-excluded surface or physical fold.
Original geometry, texture and palette are dedicated under CC0-1.0. Atomic
component provenance remains in the original peptide fixture. Package hashes,
external binary buffers and decoded-byte accounting use the ordinary native
asset registry. The two models and image decode to 21,456,384 bytes.

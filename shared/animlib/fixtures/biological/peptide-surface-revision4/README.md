# Original peptide display surface, revision 4

Prepared from the unchanged 72-residue, 414-heavy-atom illustrative endpoint in
`../illustrative-peptide/endpoint.json`. The native manifests retain its SHA-256,
original CCD provenance chain, all preparation parameters and CC0-1.0 license.
This is an original asset; reference-video imagery was used only for review.

The host-only partitioned envelope uses a finer grid and common geometric normals
before splitting. This specific display asset then evaluates the analytic density
gradient at each final smoothed vertex for smooth display normals. Its continuous
Gaussian-weighted local sequence coordinate replaces nearest-atom ownership,
removing abrupt color-field jumps. Shared vertices receive identical field values
and normals across parts. The original endpoint and recessed regions are retained.

Reproduce from repository root after building animlib:

```sh
node shared/animlib/tools/prepare-peptide-surface-revision4.mjs
node shared/animlib/demo/expansion/peptide-surface-revision4-proof.mjs
```

The proof derives from the frozen revision-3 generated scene. Reproduce that
scene first with `peptide-staged-proof.mjs` if its local data artifacts are absent.
Revision-3 files remain historical evidence. The bead mesh is reused from
`../peptide-polished/bead/`; it is not duplicated here. The color image is an
explicit dependency of this surface package.

This surface is a schematic smoothed Gaussian contour, not a measured protein,
solvent-excluded surface, physical folding trajectory or collision-free pathway.
Independent reference-style approval is recorded in the expansion review reports.

# Reusable biological fixtures

These are offline prepared native model packages. The scene VM loads the packages through the existing asset registry; it does not parse PDB, fetch coordinates, or carry large geometry arrays in source.

## Deposited crambin: 1CRN

Source: [RCSB PDB 1CRN](https://www.rcsb.org/structure/1CRN), W. A. Hendrickson and M. M. Teeter, DOI [10.2210/pdb1CRN/pdb](https://doi.org/10.2210/pdb1CRN/pdb). The entry reports 1.50 Å X-ray resolution. Raw coordinates are from `https://files.rcsb.org/download/1CRN.pdb`; component dictionaries are the 15 named files from `https://files.rcsb.org/ligands/download/<COMPONENT>.cif`. All raw inputs and SHA-256 digests are pinned in `1crn/source/` and `1crn/source-lock.json`. PDB archive and CCD data are distributed under [CC0](https://www.rcsb.org/pages/policies).

Selection: first model, chain A, ATOM heavy atoms, positive occupancy, one residue-wide alternate conformer. The fixture contains 327 atoms and 46 residues. Its 337 unique graph edges have explicit provenance: 3 deposited CONECT disulfides, 289 pinned CCD intraresidue edges, and 45 explicitly enabled standard peptide links. See `structure.json` and `residue-templates.json`. [CONECT](https://www.wwpdb.org/documentation/file-format-content/format33/sect10.html) alone does not provide the complete protein graph. TER, author gaps, missing polymer atoms, and incompatible distances split chains rather than creating geometric guesses.

All three models subtract the same recorded origin. Atomic sticks include branched side chains; each edge has two halves colored by endpoint residue. Multiple/aromatic orders remain metadata but are displayed as single cylinders. Beads use the exact deposited CA anchors plus a residue adjacency guide, which is separate from the atomic graph. The surface uses the same 327 atom positions: Gaussian sigma 1.35 Å, iso 1.05, resolution 27, three smoothing iterations. It is a schematic envelope, not a solvent-excluded or electron-density surface. Each surface triangle belongs to the residue of the nearest atom to its centroid. `surface-residue-ids.json` records those assignments. There are 45 exposed residue parts; one buried residue has no surface triangles. Part `residue-N` means residue index N in `structure.json` for every representation.

The proof colors these stable identities in seven sequence bands. It shows a representation transition within one conformer, with no invented folding trajectory.

## Illustrative polymerase channel

`polymerase-channel/` is original procedural geometry dedicated to the public domain under CC0-1.0: a Gaussian envelope around an irregular open C-shaped scaffold. It is neither a deposited polymerase nor an atomic model. Its opening and translucent mass provide context for the schematic DNA/RNA mechanism. Source video frames and third-party artwork are not included.

## Reproduce

From repository root, after `npm --prefix shared/animlib run build`:

```sh
node shared/animlib/tools/prepare-biological-assets.mjs
node shared/animlib/demo/expansion/biological-proofs.mjs
```

The first script verifies every source hash before preparing native packages. Its CCD reader deliberately accepts only the pinned seven-column bond-loop syntax; it is not a general mmCIF importer. The second emits production scene sources, video manifests, frame requests, reverse-seek checks and measurements in `data/animlib-expansion/biological-proof/`. Native render tools consume those manifests. No network access is required for regeneration.

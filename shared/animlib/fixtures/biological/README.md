# Reusable biological fixtures

These are offline prepared native model packages. The scene VM loads the packages through the existing asset registry; it does not parse PDB, fetch coordinates, or carry large geometry arrays in source.

## Fixture catalog

All preparation commands below run from repository root after
`npm run build --workspace animlib`. Table paths are relative to this directory;
script names are under `shared/animlib/tools/`. A fixture is reusable data, not a
visual acceptance claim; see the [coverage/evidence index](../../docs/expansion-index.md).

| Family | Contents and dependencies | Provenance / preparation script |
| --- | --- | --- |
| `1crn/` | Deposited structure, templates, sticks, CA beads and schematic envelope; pinned raw inputs in `source/` | PDB/CCD CC0, source lock and selection below; `prepare-biological-assets.mjs` |
| `polymerase-channel/` | Original open C-shaped context envelope | Original CC0-1.0, not a deposited polymerase; same preparation script |
| [illustrative-peptide](illustrative-peptide/README.md) | Original 72-residue rig, endpoint and first display envelope; reuses pinned ALA/SER/VAL CCD component files from `1crn/source/` | CCD CC0 plus original CC0-1.0 sequence/torsions; `prepare-peptide-motion.mjs` |
| [peptide-polished](peptide-polished/README.md) | Endpoint-derived textured envelope, sequence image, palette and unit bead; models require their image dependency | Original CC0-1.0 derivative, endpoint hash in conversion report; `prepare-peptide-surface.mjs` |
| [peptide-staged](peptide-staged/README.md) | Compact torsion schedule for held side-visible coil formation; data, not a native model package | Original CC0-1.0 schedule over the illustrative rig; `prepare-peptide-staging.mjs` |
| [nucleotide-anatomy](nucleotide-anatomy/README.md) | Original purine/pyrimidine foreground and context anatomy plus machinery | Original CC0; `prepare-nucleotide-anatomy.mjs` |
| [transcription-revision2](transcription-revision2/README.md) | Analytic lobed anatomy at two detail levels and open cavity shell; context packages are also reused by RNA processing | Original CC0; `prepare-transcription-revision2-assets.mjs` |
| `rna-processing/` | First processing enzyme package; retained for the original proof | Original procedural CC0-1.0; `prepare-rna-processing-assets.mjs` |
| [rna-processing-revision2](rna-processing-revision2/README.md) | Broad membrane with 25 lumens, pore lobes and enzyme at two detail levels | Original CC0; `prepare-rna-processing-revision2-assets.mjs` |
| [translation](translation/README.md) | First large front/back mantle, small subunit, adaptor and tunnel packages | Original CC0; `prepare-translation-assets.mjs` |
| [translation-revision3](translation-revision3/README.md) | Distinct IDs for branched adaptor, asymmetric back/small subunits and rounded conduit | Original CC0-1.0; `prepare-translation-revision3-assets.mjs`; bounded motion reviewed, optional source-specific art |
| `peptide-surface-revision4/` | Finer endpoint-derived multipart envelope and continuous sequence texture; reuses the polished unit bead | Original CC0; `prepare-peptide-surface-revision4.mjs`; independent API, motion and cache review accepted |
| [transcription-revision3](transcription-revision3/README.md) | Fused nucleotide and enclosing machinery surfaces | Original CC0; `prepare-transcription-revision3-assets.mjs`; optional prepared assets, unused by current mathematical proof |
| [rna-processing-revision3](rna-processing-revision3/README.md) | Membrane lumens, pore relief and baked illumination images | Original CC0; `prepare-rna-processing-revision3-assets.mjs`; optional prepared assets, unused by current mathematical proof |

Manifests identify assets and binary content hashes; `conversion-report.json`
records descriptor bounds, counts and conservative decoded bytes. Keep the
manifest's full provenance with the package. Source/recipe hashes may identify a
scaffold rather than the complete mathematical surface equation; the preparation
script and binary hashes provide the remaining record. Do not combine different
revisions under the same asset ID or regenerate a frozen candidate in place.

For example, generate only the intended new family with
`node shared/animlib/tools/prepare-translation-revision3-assets.mjs`. Loading a
scene should follow its `modelAssets` list, including image dependencies and
explicit `colorPolicy:'source'` when required. Loading every historical family
adds memory without improving a particular scene.

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

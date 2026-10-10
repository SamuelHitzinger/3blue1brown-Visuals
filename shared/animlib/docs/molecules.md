# Molecular coordinates and batched beads

`s.molecule(id, props)` draws many coordinate-centered beads as a few ordinary
meshes and returns one animatable group. It avoids one scene element per site:
3,001 low-detail sites become two meshes and a group instead of 3,001 spheres.
The production renderer, palette, materials, grouping and seekable timeline stay
unchanged. No fetching or coordinate-file parsing occurs in the scene VM.

```js
const protein = s.molecule('protein', {
  positions: [0, 0, 0, 3.8, 0.2, 0], // packed XYZ, illustrative only
  radius: 1.5,                       // chosen display radius, same units
  origin: [0, 0, 0],                 // subtract before transforming
  detail: 1,
  scale: 0.2,                        // world units per coordinate unit
  fill: 'GOLD',
  material: { roughness: 0.7, specular: 0.2 },
});
s.play(protein.rotateTo([0, 0.8, 0]), { duration: 2 });
```

- `positions`: nonempty flat number array, three values per site, at most
  10,000 sites per call. Coordinates and generated vertices must remain within
  ±1,000,000. Sparse and nonfinite arrays are rejected.
- `radius`: required positive finite display radius. Uniform per call.
- `detail`: octahedral subdivision `0` (default, 8 faces/site), `1` (32), `2` (128), or `3` (512). Private unit templates are reused; output meshes remain independently owned. Total output is bounded to 500,000 vertices and triangles in addition to the existing per-mesh limits. Live deformation also remains subject to the separate reactive-update payload limit, so larger models may require lower detail.
  Smooth radial normals affect shading; silhouettes remain polygonal.
- `origin`: optional common coordinate origin, default `[0,0,0]`. For chains of
  one structure, use the **same** origin and scale to preserve their relationship.
- Usual fill, stroke, material, position, rotation, scale, opacity, viewport
  offset and space settings apply. The handle transforms the entire collection.
  Children use reserved IDs `${id}/batch-N`. Use separate calls for different
  colors, chain selection or independently moving parts. Individual beads are
  not separate handles. Geometry is built once during compilation.

Each batch stays below the existing 20,000-vertex/triangle mesh caps. This is
an allocation limit, **not** a performance guarantee: large clouds can still
exceed the unchanged 200 ms QuickJS budget or 256,000-character source cap.
Prefer selected chains, lower detail or host-side subsampling. Keep retained
deposited coordinates unchanged and disclose the sampling rule. Do not increase
the production timeout to accommodate a molecular scene.

## Import deposited coordinates outside the VM

The host export `importPDB(text, { source, selection?, chains? })` in
`animlib/core` reads **legacy PDB** files. `source` records the source URL/path.
It returns an `animlib-molecule-v1` object containing coordinates in Ångströms,
chain IDs/kinds, site labels, a shared bounding-box center and provenance.
Default `selection: 'residues'` retains Cα (`CA`) sites for standard protein
residues and phosphorus (`P`) sites for standard nucleic-acid residues.
`'heavy-atoms'` retains non-H/non-D `ATOM` records. `chains: ['A','B']` filters
deposited single-character chain IDs (`''` selects the blank chain).

```ts
import { importPDB } from 'animlib/core';
const data = importPDB(pdbText, {
  source: 'https://files.rcsb.org/download/1CRN.pdb',
  selection: 'heavy-atoms',
});
// Host prepares the scene source. In that source, for each selected chain:
// s.molecule('chain-0', { positions: chain.positions, origin: data.center,
//   radius: 1.5, scale: 0.2, fill: 'GOLD' });
```

From the repository root, after downloading a file and building the library:

```sh
npm run build
node shared/animlib/tools/prepare-molecule.mjs input.pdb output.json https://files.rcsb.org/download/1CRN.pdb heavy-atoms A
```

The CLI additionally records the original file SHA-256. Keep provenance beside
the prepared coordinates; embed only the selected positions in scene source.

The reader takes the first model, excludes zero-occupancy sites, and selects
one alternate conformer per residue by highest mean occupancy (lexicographic
tie-break), retaining shared blank-alt atoms. This is a deterministic display
choice, not an inference about conformational populations or dynamics.
It excludes all `HETATM` records, including ligands, waters and modified residues.
It does not infer missing atoms, bonds, secondary structure, biological assembly
transforms, missing backbone segments or solvent-accessible surfaces. The input
coordinate frame is preserved. The mmCIF format is deliberately unsupported;
it requires a dedicated offline parser/conversion, never silent PDB parsing.

## Smooth organic envelopes, prepared offline

Use the host export `createMolecularEnvelope` when the explanatory view needs
a contiguous organic mass. It sums continuous, truncated Gaussian kernels over
**all supplied sites**, samples a bounded grid, extracts a welded marching-
tetrahedra surface and applies controlled Taubin smoothing. Area-weighted normals
are recalculated from the final geometry. It returns a normal animlib mesh; the
scene VM only receives the finished arrays and never executes this generator.

```ts
import { createMolecularEnvelope } from 'animlib/core';
const geometry = createMolecularEnvelope({
  positions: data.chains.flatMap(chain => chain.positions),
  origin: data.center,
  sigma: 9,                 // Å; chosen visual density-smoothing scale
  isoLevel: 2,              // threshold of the summed unit-height kernels
  resolution: 14,           // cells on the longest padded bounding-box axis
  smoothingIterations: 6,  // paired Laplacian passes, lambda=.5 / mu=-.53
  maxTriangles: 20000,
});
// Embed finished arrays in source: s.mesh('ribosome', {...geometry,
//   scale: 0.024, fill: 'GOLD', material: {roughness: 0.7, specular: 0.2}});
```

The kernel is `max(0, exp(-r²/(2 sigma²)) - exp(-8))`, with exactly zero
support beyond four sigma. Padding therefore encloses the complete support.
`sigma` and `isoLevel` are display parameters, not experimental density values.
The surface has no calibrated electron-density or solvent-accessibility meaning.
It may obscure small channels, missing components and atomic detail. Taubin
smoothing changes the display surface further; it does not move or overwrite
the deposited input sites. Do not use an envelope to imply a complete ribosome,
an inferred chemical bond or a physical folding trajectory.

The generator accepts 1–100,000 sites, resolution 4–64 (default 16), smoothing
iterations 0–20 (default 6), and at most 20,000 triangles/vertices. A 25-million
grid-update work cap bounds preprocessing; invalid or excessive requests throw
instead of dropping triangles. Coarse sampling relative to sigma can alias the
field. Inspect rendered silhouettes and increase resolution before relying on
the result. Geometry size still counts toward the unchanged scene source limit.

The reproducible CLI keeps source provenance, source/prepared-data SHA-256,
all-site count, origin, bounds, kernel and smoothing parameters beside the mesh:

```sh
npm run build
node shared/animlib/tools/prepare-molecular-envelope.mjs shared/animlib/demo/assets/molecules/1crn.json shared/animlib/demo/assets/molecules/1crn-envelope.json 2.5 1 14
node shared/animlib/tools/prepare-molecular-envelope.mjs shared/animlib/demo/assets/molecules/1jj2.json shared/animlib/demo/assets/molecules/1jj2-envelope.json 9 2 14
```

Artifact schema: `{ format: 'animlib-envelope-v1', units: 'angstrom', origin,
geometry, bounds: {min,max}, parameters, provenance }`. Mesh vertices are centered
on `origin`; deposited axis directions are preserved. CLI positions/normals are
rounded to three decimals for compact source. Reuse one uniform display scale
if comparing physical size. Nonuniform reshaping must be labeled schematic.

## Reproducible examples and scientific limits

Open `/molecules.html` with `npm run dev`, or render native proof frames:

```sh
npm run build
npx bun shared/animlib/tools/molecular-proof.ts
```

The proof uses `render-frames.mjs` and the actual production renderer, producing
1280×720 and 960×720 PNGs under ignored `data/molecular-smooth-proof-repaired/`.
Initial grid-artifact frames remain separately under `data/molecular-smooth-proof/`.
The committed
JSON files in `demo/assets/molecules/` retain the source URLs and hashes:

| Example | Deposited data used | Display choice |
| --- | --- | --- |
| [1CRN](https://www.rcsb.org/structure/1CRN), crambin | All 327 selected heavy atoms | Smooth gold envelope, sigma 2.5 Å / level 1; 2,080 triangles, about 74 KB |
| [1JJ2](https://www.rcsb.org/structure/1JJ2), *Haloarcula marismortui* large ribosomal subunit | All 6,567 CA/P sites in 30 chains, no subsampling | Smooth gold joint envelope, sigma 9 Å / level 2; 2,940 triangles, about 110 KB |

Both use resolution 14 and six Taubin cycles. Gold describes the joint envelope;
it does not distinguish RNA from protein. The earlier bead examples remain
available as `molecularBeadSources` for comparison; only those examples use
subsampling and blue/gold component colors. Both smooth meshes compile together
under the production 200 ms budget and fit below 240,000 source characters in
the regression fixture. Actual scene overhead must also fit the 256,000 cap.

The examples have independent display scales. 1JJ2 is a **large ribosomal
subunit**, not a complete translating ribosome. Deposited positions are
experimentally informed structural models; they are not direct photographs or
error-free instantaneous coordinates. Display radii, Gaussian kernels and smoothing are schematic.
Neither example is an atomically accurate molecular surface or a folding/translation
simulation. For atom-specific radii/coloring, prepare scientifically sourced radii
and split calls by radius/color; the library does not invent those values.

Authoritative format and data references:
[wwPDB coordinate records](https://www.wwpdb.org/documentation/file-format-content/format33/sect9.html),
[format limitations](https://www.wwpdb.org/documentation/procedure), and
[wwPDB CC0 usage policy](https://www.wwpdb.org/about/usage-policies).
The deposited files are CC0; cite their entry pages and primary structure papers
when presenting scientific results. Downloaded 1CRN SHA-256:
`42199a30a0701864a2a5cc76cd7f35cc544cd0e65fbcf63e03c166543249b811`;
1JJ2 SHA-256:
`f3eeb133fedd51dfb3d98b50c338c76bb1e7c5474416744eccd8862a7b7308bb`.

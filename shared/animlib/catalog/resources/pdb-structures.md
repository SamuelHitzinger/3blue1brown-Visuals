# RCSB deposited molecular structures

Use when the claim depends on a particular deposited structure, complex, chain or nucleotide arrangement. Research the correct accession and source before choosing geometry. A familiar protein name is insufficient evidence for a particular binding site or mechanism.

If the host exposes `publish_model`, provide `pdbId` and optional `pdbChains` using author-chain IDs; do not mix this with fixtureId, url or generated. Use returned asset ID, chain parts, landmarks, gaps and scientific warnings. The host uses fixed RCSB endpoints, content-addressed snapshots and hash checks. This is a preparation prerequisite, not a guarantee that every requested structure fits production budgets.

The [preparer](../../../../backend/src/molecular-models.ts) currently produces deposited protein CA traces and nucleotide heavy-atom geometry with CCD connectivity. It does not promise protein atomic side chains, assembly reconstruction, imported dynamic trajectories or a realistic outer surface. Unsupported source formats or selections must fail visibly rather than become invented structure.

Landmark coordinates are already in model-local angstrom coordinates with common origin subtracted. Apply the displayed model's scale, rotation and translation once; do not subtract origin again. Representative sites are not inferred active sites. First and last retained residues do not necessarily mean biological termini.

Preserve source URLs, accession, chain selection, units, recorded source hash and source warnings from the publication result. Sources: [RCSB PDB](https://www.rcsb.org/) and the [local molecular API guide](../../docs/molecules.md).

Verify the returned representation can support the exact claim, selected chains remain identifiable, gaps are not silently bridged, and required landmarks are visible. Coordinate agreement alone does not establish dynamics, contact chemistry or biological causation.

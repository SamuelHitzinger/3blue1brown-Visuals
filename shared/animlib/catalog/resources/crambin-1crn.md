# Deposited crambin: 1CRN

Use for explaining a protein's representations while keeping residue identity and coordinates fixed. Inputs are chain A, first-model heavy atoms, with explicit source selection and pinned CCD bond templates.

The production model catalog provides fixture IDs `1crn-sticks`, `1crn-beads`, and `1crn-surface`. When `publish_model` is available, pass exactly one `fixtureId`; reuse an existing matching published model first. Use the returned asset ID with `s.model`, never the fixture ID as an assumed runtime asset. This publication path works during video planning and authoring. Other hosts must explicitly provide asset preparation.

The three representations share one recorded origin. Returned model context describes residue parts, units, representation and color meanings. Stick vertex colors encode element identity; avoid replacing C/N/O/S colors with arbitrary semantic tints. Beads represent CA residue anchors; the surface is a Gaussian envelope rather than a solvent-excluded or measured electron-density surface.

Provenance: [fixture record](../../fixtures/biological/README.md), [source lock](../../fixtures/biological/1crn/source-lock.json), [deposited structure data](../../fixtures/biological/1crn/structure.json), and [production preparation](../../../../backend/src/bundled-models.ts). The record attributes RCSB PDB 1CRN and CCD data under CC0.

Verify aligned coordinates under uniform scale and rigid transforms, stable residue selections, source/part mapping and labels at the intended view. Do not animate this structure into an invented measured folding trajectory. Publication success does not establish visual readability or scientific suitability for another protein.

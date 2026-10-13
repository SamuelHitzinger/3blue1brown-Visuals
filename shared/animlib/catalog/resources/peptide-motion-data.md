# Illustrative peptide rig and staging

Use for demonstrating how local torsion changes affect chain shape while retaining residue identity. This is a designed 72-residue ALA/SER/VAL example, not deposited 1CRN.

Exact reusable inputs are the [rig](../../fixtures/biological/illustrative-peptide/rig.json) and [staging samples](../../fixtures/biological/peptide-staged/staging.json). Their [rig provenance](../../fixtures/biological/illustrative-peptide/README.md) and [staging description](../../fixtures/biological/peptide-staged/README.md) document original CC0-1.0 schedules and pinned CCD components. The data must be selected/prepared by the host before scene execution; catalog lookup does not fetch or inject the JSON into scene code.

Use absolute-time torsions with `s.peptidePose` and stable residue IDs. Reconstruct all linked geometry from the same pose. Hold local coils before packing; avoid a future fitting window that makes the held geometry drift. Rigidly reposition the whole chain when a view change is the only desired operation.

Do not interpolate Cartesian atom endpoints to imply preserved bond lengths. The helper's terminal chemistry, side-chain frame assumptions and carbonyl construction remain schematic. There is no solvent, energetic dynamics or general atomic clash solution.

Verify local links through motion interiors, deterministic reverse seeks, held stages and the representation transition. A previously reviewed demonstration accepts its exact bounded operation, not any new choreography using these data.

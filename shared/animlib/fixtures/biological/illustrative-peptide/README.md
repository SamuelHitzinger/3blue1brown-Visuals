# Original illustrative peptide motion

This is an original 72-residue ALA/SER/VAL sequence, **not deposited 1CRN and not a measured folding trajectory**. It contains 414 heavy atoms and 413 explicit displayed bonds. No disulfides are omitted from a deposited protein. `rig.json` contains the reusable small component dictionary, stable residue identities, and extended/local-coil/compact torsion arrays. `endpoint.json` is the exact result of `peptidePose` at the compact endpoint.

ALA/SER/VAL ideal heavy-atom coordinates and intraresidue edges derive from pinned official wwPDB CCD files already stored in `../1crn/source/`. Their hashes are recorded in the rig and conversion report. CCD archive data are [CC0](https://www.rcsb.org/pages/policies); original sequence, torsion schedule and resulting illustrative geometry are dedicated under CC0-1.0. Regeneration is offline:

```sh
npm --prefix shared/animlib run build
node shared/animlib/tools/prepare-peptide-motion.mjs
node shared/animlib/demo/expansion/peptide-motion-proof.mjs
```

The parser only accepts the pinned simple CCD atom loops. Hydrogens and leaving atoms are excluded. The helper preserves each component's N–CA/CA–C lengths and N–CA–C angle; side chains follow that frame rigidly. The C–N peptide link is explicitly 1.33 Å, CA–C–N is 116°, C–N–CA is 121°, and omega is trans. Phi/psi are prescribed. The carbonyl O retains its template C–O length but follows a planar external bisector; its bond angles are schematic rather than a claim to ideal peptide refinement. Terminal chemistry, hydrogen bonding, solvent, energetic dynamics and collision avoidance are not modeled.

Four helical blocks precede compaction of their connecting loops. A fixed-seed 6,000-step offline search minimizes a radius/CA-overlap score to obtain a legible compact endpoint. It does not establish a physical folding route or eliminate all possible atomic clashes. The CA radius of gyration is 71.1106 Å extended, 31.2275 Å after local coil formation and 9.8245 Å compact.

The static endpoint surface uses **all exact final atom positions and the same mean-CA origin**: Gaussian sigma 1.2 Å, iso 1.05, resolution 31, two smoothing iterations. This is a schematic envelope, not a solvent-excluded surface. Triangle-to-residue assignments are saved in `surface-residue-ids.json`; the native model groups those assignments into seven sequence-color bands. The source scene embeds only the compact rig/torsions and references this cached model; it does not inline the surface mesh.

# Peptide surface revision 4

The independent revision-3 review accepts coil staging, identity and endpoint
alignment but rejects stepped sequence-color boundaries and angular surface
highlights. Preserve the frozen revision-3 assets and films. This revision changes
only the final display surface, its scalar color field and surface lighting;
staging, residues, bonds, timing and compact endpoint remain fixed.

Add a host-only `createMolecularEnvelopeParts` preparation API. Reuse the current
density extraction and smoothing algorithm, compute common normals before
partitioning, and return deterministic bounded mesh parts. The existing single
mesh API must retain exact geometry and its existing budgets. Keep the existing
25-million density-work ceiling and 64-cell resolution ceiling. The new preparation
path permits at most 160,000 total triangles, 100,000 global/output vertices,
128 parts, and 20,000 triangles/vertices per part. These are preparation bounds;
scene, VM, asset and GPU budgets remain unchanged. Reject instead of truncating.

Verify single-part exact parity, shared boundary normals/coordinates, triangle
coverage, deterministic partitioning, default compatibility and budget failures.
Prepare a finer endpoint-derived surface under a new asset ID. Interpolate the
sequence field from nearby atoms with continuous distance weights rather than
hard nearest-atom ownership. Do not delete the correctly recessed blue region.
Render native 8.4-second views first, compare source frame 110 and frozen revision
3, then render the complete unchanged ten-second scene in both aspects. Inspect
every ordered motion-sheet tile and representative native views; independent
review must separately assess style, continuity, media and API correctness.

This is a schematic Gaussian display envelope, not a solvent-excluded surface
or a physical folding model. Original generated assets remain CC0.

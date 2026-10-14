# Rigid molecular subunit motion

Choose this technique to explain relative placement of named rigid subunits. Preserve each prepared part's identity and geometry. Use [rigid motion API guidance](../../docs/rigid-motion.md) and the [runnable construction seed](../recipes/rigid-motion.js).

Prepare the exact deposited structure through publish_model. Explicit pdbRepresentation is mixed (default protein CA plus nucleotide heavy atoms) or backbone (protein CA plus nucleotide P anchors). Backbone is appropriate only for whole-complex placement questions; it does not support atomic contacts. Select it explicitly, never as an automatic budget fallback. Persistent preparation keys retain source hash, CCD hashes, converter version, exact chains and representation. Geometry remains an immutable host artifact outside prompt and scene VM.

Construct s.rigidMotion with absolute-time keyframes containing translation and rotation and a chosen pivot. Bind a named model part to at(t), and use transformPoint(point,t) for landmarks so geometry and readouts share one pose. Read the API for renderer rotation order and bounds. Random seeks must reproduce the same pose.

Declare provenance illustrative for authored staging, or supplied when transforms come from provided data with attribution. Neither status implies MD simulation, inferred kinetics, energy minimization, collision avoidance or measured dynamics. Rigid motion preserves intrapart distances; deformation and folding need appropriate data or explicit peptide builders.

Readiness records helper availability. Confirm asset representation and scientific claim, then run normal scene validation and native visual review; catalog readiness does not approve a scene.

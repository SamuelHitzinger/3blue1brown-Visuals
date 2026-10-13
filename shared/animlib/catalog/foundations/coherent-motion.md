# Coherent motion and persistent identity

Define what remains the same: original coordinates, coefficients, atom/residue IDs, graph records, adjacency or physical link lengths. Distinguish object identity from a displayed value; equal values do not make two records the same object.

Derive related geometry and readouts from one explicit numerical model. Evaluate state from absolute time or current controls rather than integrating by frame count. Endpoint agreement does not prove valid intermediate motion. For rigid or articulated systems, use shared local transforms or an explicit constraint-preserving construction.

Follow the [reference](../../docs/reference.md) and [reactive control contract](../../docs/reactive-controls.md). A live connector follows endpoints but enforces no fixed length. Avoid competing binding and timeline ownership of the same property. Scene construction is not a per-frame callback.

For scene handoff, evaluated previousFrame is authoritative; preserve carried IDs and incoming poses. Re-establish bindings, attachments, connectors and behaviors that are not part of carried geometry. Plan independently moving parts before introducing the object.

Verify beginning/end and motion interiors, reverse seeks, phase boundaries, paused controls and the final held picture. Preserve narration timing and source facts during repairs. Still images do not establish continuous motion or interaction correctness.

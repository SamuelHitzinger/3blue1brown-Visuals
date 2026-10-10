# Original molecular folding proof — style contract

Reference: Protein Folding (AskaBiologist upload, underlying animation credited to DeLano Scientific LLC/PyMOL), https://www.youtube.com/watch?v=yZ2aY5lxEGE. Reference report describes full-frame browser observations at 0:20/0:27 extended sequence-colored sticks, 0:55/1:09 beads, 1:23 compact beads, 1:38 folded sticks, 1:56 sequence-colored smooth surface. Temporal transition details remain unverified. The independent reviewer must inspect reference and actual exported motion.

The original proof isolates one explicitly identified schematic chain on black. Stable red/orange/yellow/green/cyan/blue sequence values persist across sticks, beads, and the same-coordinate endpoint surface. All representations share one origin and the same endpoint pose. No cellular set, title/card layout, stock molecule, unrelated envelope, protein ribbon, or inferred atomic bond chemistry is claimed.

Eight seconds: 0–0.7 extended/broad curved sticks hold; 0.7–1.1 beads replace sticks; 1.1–4.7 smooth joint-angle motion bends the actual chain while link lengths remain fixed; 4.7–5.1 folded bead hold; 5.1–5.5 folded sticks return; 5.8–6.5 surface crossfade; 6.5–8 endpoint hold. A static oblique camera may ease closer as the compact endpoint earns focus. The chain and local end markers own the frame.

Inference: the same ordered residues admit different visual representations while their adjacency and identity remain traceable. Movement is schematic forward kinematics, not a simulation, scientifically measured trajectory, secondary-structure claim, or collision-free protein fold. The visible surface is an existing Gaussian envelope generated from the same final anchor coordinates, not an atomic solvent surface.

Independent gates remain separate: reasoning (fixed links/identity/provenance), readability (whole chain and local marks visible), reference style (isolated molecular geometry and persistent sequence colors), technical delivery (native GPU frames, eight seconds, 30 fps, silent H.264). Known fidelity gap: the proof uses residue-level bonds, fewer anchors and simpler shape than the atomic PyMOL reference. No reference-parity claim follows from tests.

The revised proof uses bead detail 2 (66 vertices/128 triangles per residue) for
the visible large beads and retains detail 1 for small stick joints. Detail 3
was tested but exceeded the unchanged live-update payload limit for 33 beads;
no geometry or compiler caps were raised. This revision addresses faceted
silhouettes only; the scientific and reference-fidelity limitations above remain.

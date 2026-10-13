# Nucleic mechanism inputs

Use these exact versioned example inputs to understand the helper contract before designing a new sequence or event schedule:
[transcription cycle](../../demo/expansion/inputs/transcription-cycle.json),
[RNA splice](../../demo/expansion/inputs/rna-processing-splice.json), and
[portable input notes](../../demo/expansion/inputs/README.md).

These are authored schematic input records, not measured molecular trajectories. Preserve source/recipe provenance when adapting them. The host must load and validate the chosen data; listing a catalog entry does not make JSON available in the synchronous scene sandbox. Load only needed inputs, not all historical proof families.

The inputs identify nucleotide pairing, sequence direction, absolute phases and mechanism-specific parameters. Follow the [nucleic processing contract](../../docs/nucleic-processing.md) and [transcription contract](../../docs/nucleic-transcription-cycle.md). Geometry must be derived from the helper's returned state, IDs and bonds, not a separately invented graph.

Check complementarity, strand directions, incoming/base incorporation boundaries, cut/join topology, clearance and end-state identity. Use a new output filename when reproducing or adapting the proofs; do not overwrite reviewed data or media. RNA chemistry and machinery are schematic unless separate exact-source evidence supports a stronger claim.

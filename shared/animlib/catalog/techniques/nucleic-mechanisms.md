# Nucleic pairing, processing and translation

Inputs must state antiparallel strand directions, complementary base pairs, RNA sequence and stable nucleotide IDs. The underlying helper returns explicit state, anchors and connectivity; derive displayed geometry from that result.

Read [transcription](../../docs/nucleic-transcription-cycle.md), [processing](../../docs/nucleic-processing.md), or [translation](../../docs/nucleic-translation.md) for the chosen mechanism. `s.nucleicTranscriptionCycle` stages paired arrival, incorporation and register advance. `s.nucleicSplice` provides cut/join topology; `s.nucleicThread` supports bounded path/aperture transport. `s.nucleicTranslationCycle` preserves codon, carrier and product identities through transfer, advance, stop and release.

Show the local causal operation before advancing the surrounding machinery. An incoming nucleotide must not have a polymer backbone bond before incorporation. A removed segment must disappear from the graph at the cut; an exon join must use the returned new connectivity. Carrier/product transfers should preserve the same material identity.

Returned geometry is schematic kinematics, not chemical reaction dynamics or a general collision solver. Translation does not predict protein folding. Verify event-boundary states just before/at/after transfer, bond appearance and stop events; check the final connected graph, bounded aperture clearance, reverse seeking and label visibility during movement.

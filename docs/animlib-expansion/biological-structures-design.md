# Biological structure and transcription implementation design

2026-10-11, `amilibsam`. Pure bounded factories first; root/image worker owns shared runtime integration. Existing `importPDB` stays compatible. This is an original transcription mechanism and deposited-structure slice, not whole-film fidelity.

## Scientific preparation API (host only)

New `molecular-structure-data.ts` and `molecular-structure-types.ts`:

```ts
importPDBStructure(text: string, options: StructureImportOptions): MolecularStructure;
structureBackboneProps(structure: MolecularStructure, representation: 'atoms' | 'residues', radius: number): MolecularBackboneProps;
```

Options require `source`, optional accession, optional selected chains, supplied `residueTemplates` (per-component explicit atom-name edges with source/version), and explicit opt-in `polymerLinks: 'none' | 'standard-peptide'`. Result preserves first-model deposited heavy-atom XYZ in Å, atom serial/name/element/alt, stable atom and residue IDs, author sequence/insertion code, TER segment occurrence, selected conformer, explicit breaks, and bonds with provenance (`CONECT`, supplied CCD/template, or declared peptide rule). No distance-based intraresidue inference. Polymer linking requires consecutive author residue IDs, same uninterrupted TER segment, actual C/N atoms, allowed standard components, and a bounded sanity distance; absent sites/gaps split instead of bridging. Sparse or malformed/duplicate records and budgets fail early. CCD templates are supplied offline from pinned official RCSB data, not fetched in the VM. Existing PDB importer remains unchanged.

Prepared 1CRN endpoint uses exact same selected heavy-atom positions for sticks and Gaussian envelope; residue beads use its CA anchors. Color values derive from shared residue order. Native asset packages carry static geometry, source hashes, accession/model/selection and CC0 attribution. No fabricated unfolded trajectory is needed for this endpoint proof.

## Nucleic factory API (host + verbatim QuickJS)

New `nucleic-types.ts` and `nucleic-structures.ts`:

```ts
createNucleicBuilders(molecular: {
  molecularBackbone(props: MolecularBackboneProps): MolecularBackboneResult;
}): {
  nucleicDuplex(props: NucleicDuplexProps, opening: number): NucleicDuplexResult;
  nucleicTranscript(props: NucleicTranscriptProps, time: number): NucleicTranscriptResult;
};
```

`NucleicDuplexProps`: required axis Vec3[] (one center per pair, 2–128), ordered `template: {id,base:'A'|'C'|'G'|'T'}[]` in **3′→5′**, ordered `coding` in **5′→3′**, explicit `pairs: [templateId,codingId][]` in axis order, `initialNormal`, `radius`, `backboneRadius`, `twistPerBase`, `window: {start,end,separation}`, optional geometry quality. Directions are required literal fields and validated. IDs must be globally unique and every explicit pair complementary. Arrays are aligned by the explicit pairs; arbitrary/missing pairing is rejected instead of guessed. No chemical atom geometry is claimed. Existing ordered-backbone meshes are reused; shaped extruded purine/pyrimidine plates and their covalent stems form bounded native batches.

Opening ∈[0,1] is explicit absolute phase. A smooth local window relaxes twist and separates strands; sites outside the window keep their authored helical targets. Desired adjacent directions are normalized and integrated using baseline per-strand link lengths, then recentered as a whole. Thus backbone lengths stay fixed throughout the schematic opening; minor coupled axial repositioning is permitted and documented. This is schematic constrained geometry, not molecular dynamics or measured DNA geometry. Rotation-minimizing centerline frames position/orient bases and expose anchors; poles/reversals are rejected explicitly.

Result: bounded `{parts: {id,geometry,role}[], anchors: {id,base,strand,backbone,tip,tangent,normal}[], pairs, ends, linkLengths, provenance}` with consistent IDs/topology and finite frames at equal settings. Both strands are continuous and antiparallel; no bridges are invented across missing pairs because incomplete duplexes are explicitly unsupported in v1 (call separately for separate segments).

`NucleicTranscriptProps`: explicit ordered RNA bases `{id,base:'A'|'C'|'G'|'U',templateId}` in 5′→3′, fixed fully-open duplex result, start, secondsPerBase, approachFraction, RNA radius and optional incomingOffset. Each RNA base must complement its referenced template base, references must be consecutive in template 3′→5′ order, and IDs must be distinct from DNA IDs. Template geometry is a snapshot of the fully-open state, so existing transcript sites never jump when a new nucleotide arrives. Target RNA anchors sit opposite the template bases; fixed target links are declared schematic lengths. Incoming nucleotides approach their target then a new backbone edge appears only upon incorporation; no premature chemical bond is shown. No covalent-length claim is made for a free approaching nucleotide. Return stable native part topology with per-part opacity, ordered anchors/state, end/triplet metadata and explicit formed edges. One bounded part per nucleotide combines its shaped base/stem/backbone contribution (not one scene element per polygon). Pure sampling depends only on time and copies inputs.

Proof stages: full curved helix → opening window → stable open template with sequential incoming RNA bases → short 5′→3′ transcript and hold. A prepared original irregular, channeled polymerase-like shell provides translucency and spatial context, explicitly labeled illustrative, not a deposited polymerase or ribosome. An unrelated crambin envelope must never masquerade as this machinery. Palette is cyan/blue DNA, warm RNA and muted purple machinery from the transcription source; isolated sequence-rainbow remains confined to real-structure representation proof.

## Evidence used and gates

Author independently viewed all 64 complete-frame thumbnails covering transcription32–63.5s in four ordered half-second sheets. Source visibly reveals the bubble through purple machinery, docks nucleotides, grows red RNA with 5′ label, then pulls wide. Viewed Nucleus0–31s in 32 ordered one-second frames; larger environmental coverage is still being gathered by root. More source inspection and exact coverage report follow. No screenshots are production assets.

Tests first: dense/sparse validation, explicit antiparallel Watson–Crick pairing, frame orientation and finite normals, stable IDs/indices/colors, link invariants at interior opening values, independent/reverse time sampling, no premature transcript bonds, accurate first-model/alt/TER/gap semantics and precise budgets. Native proof at1280×720 and960×720, 5–8s, with ordered decoded-frame review; independent evaluation remains separate.

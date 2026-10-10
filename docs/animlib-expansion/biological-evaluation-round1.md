# Independent biological evaluation — first native slice

Reviewed2026-10-11. This report evaluates the four final open-channel films in `data/animlib-expansion/biological-proof`, not the older schematic molecular film. It does not approve broad Nucleus/Protein Folding motion fidelity.

## Evidence

Viewed all14 ordered output sheets: transcription4sheets per aspect, structure3sheets per aspect. These cover the full8s/6s films at nominal8fps, including opening, every incorporation, every representation transition and final holds. Also inspected full native transcription4.5s frames at1280×720/960×720, full structure atomic setup1280×720 and surface960×720. This is complete-duration decoded-frame sampling, not real-time playback or every-frame inspection. Earlier closed-shell stills were not used for the verdict; viewed frames show the final C-shaped opening.

Direct source comparison uses Nucleus growth-playback sheets01 and04 (machinery/emergent RNA→close incorporation and triplet emphasis) and the Protein Folding source motion samples documented in round1. Root has more complete source captures; this report does not claim personally viewing all those additional captures. Reviewed biological brief/design/style contract, nucleic types/builders, host structure importer/mapping, preparation script and focused tests.

| Proof | Reasoning | Readability | Reference motion/style | Technical correctness |
|---|---|---|---|---|
| Paired DNA opening and six RNA incorporations | ready for this bounded schematic mechanism | ready for current slice, label placement can improve | revise for source-level target | ready within documented schematic scope |
| Deposited1CRN atoms→CA beads→atoms→surface | ready for representation correspondence | ready | revise as broad folding/reference proof; bounded same-conformer transition demonstrated | ready for the reviewed deposited graph and representation mapping |

No averaged overall pass. A self-authored limited style contract does not reduce the user's nearly-identical motion/flow target.

## What the native films establish

The paired rails open continuously before RNA appears. Incoming base glyphs travel toward successive sites, then a persistent warm backbone grows; earlier incorporated sites do not jump when later sites arrive. The local DNA template3′→5′ and RNA5′/growing3′ labels establish direction. The C-shaped translucent machinery leaves the pairing mechanism visible. Both aspects keep the main construction inside frame and hold the final six-site product. The RNA5′ annotation is close to similarly colored base geometry, and the incoming label passes in front of the coding strand; give these labels clearer space in the forthcoming closer composition.

The1CRN film visibly contains branched atomic side chains, beyond the original single-chain schematic. Sequence colors and positions persist into CA beads, back into sticks and into the enclosing surface. The static camera makes that correspondence easy to track. Surface coloring is a per-triangle nearest-residue assignment, so boundaries are visibly jagged; this is a display limitation rather than a mismatched conformer. A Gaussian envelope is not a solvent-excluded surface, and the author correctly records this distinction.

## Independent correctness checks

A separate Node audit of `structure.json` against raw `source/1CRN.pdb` found all327 retained atom coordinates exactly equal by atom serial. There are46residues and337edges;119atoms have degree≥3, independently confirming a branched graph rather than a fabricated residue path. All16 source-lock hashes match their saved bytes. All three CONECT edges join SG toSG. The289 intra-residue edges come from the pinned CCD templates and45 peptide edges from the explicitly enabled standard C–N rule, not generic distance-neighbor inference.

The importer preserves first-model coordinates, residue/atom identity and TER/chain/gap distinctions. Alternate-location selection is residue-wide; the preparation uses one common origin across all representations. CA adjacency is a separate residue-level guide and is not added to the atomic graph. Surface metadata retains45 exposed residue groups out of46; absence of an interior residue from the boundary is not a lost atom/conformer.

Reviewed nucleic code validates explicit antiparallel template/coding directions and complementary pair identities. RNA bases refer to consecutive template IDs in template3′→5′ order, use RNA complement/alphabet, and form only links between incorporated sites. Geometry construction preserves baseline backbone-link lengths by integrating directions, then translating the strand; outside-window positions may move, as the contract now says. No false guarantee of pinned exterior sites should be added. This is deterministic schematic geometry, not an atomistic bond-angle/energy model.

Independently ran the focused nucleic-structures, molecular-structure-data and biological-fixtures suites:16tests passed. The simultaneous integration suite initially failed during import with an ENOENT in a temporary Vite SSR cache; running that suite alone immediately passed its1test. This was not a failing biological assertion. The tests include dense opening/link checks, incorporation timing, retained identities/backward seeks, graph reconstruction and package hash/mapping checks. No new correctness defect established.

## Why reference fidelity is still revise

The native transcription film keeps the opened bubble and machinery static while fixed-orientation incoming plates translate downward. The inspected Nucleus passage shows rotating arrivals, machinery/DNA relative progression, RNA emerging from the channel and an explicit close focus/zoom to a persistent triplet. Its soft, rounded components, depth layers and focus separation also differ materially from the native flat plate silhouettes and fixed wide view. These are visual and motion differences, not a demand for the same licensed asset, exact sequence, or branding.

Smallest useful next proof: demonstrate orientation change→settling at incorporation, sustained polymerase/DNA relative travel with a growing RNA exit path, then move closer to one persistent triplet. Preserve anchor identities and already formed link lengths; don't fake polymerase progression with unrelated fades. The close view should keep enough structural detail and lighting/depth to approach the source's visual density, rather than only adding more flat base glyphs. The source's exact polymerase reconstruction is not required.

The deposited1CRN film establishes real structure preparation and same-conformer representations, but its geometry stays stationary. It cannot establish the source's local coil/helix formation followed by global compaction, dense moving side chains and changing view. Add a separate explicitly illustrative motion proof with persistent site identities, transported side-chain frames, visible local secondary-structure formation, then compaction and a same-conformer envelope/rotation. Do not imply the synthetic path is deposited1CRN dynamics or physical simulation. Keep the scientifically grounded static proof as separate evidence.

These are missing representative capability proofs. Additional unit tests or an author's declaration that the two current clips are deliberately limited cannot close that visual gate.

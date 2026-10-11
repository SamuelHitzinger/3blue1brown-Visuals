# Biological motion follow-up

2026-10-11. New native mechanism proofs following `biological-evaluation-round1.md`. Implementation and author inspection are complete for this iteration; independent visual review remains the gate. No source-level style parity is claimed.

## Reusable behavior

`createPeptideBuilders().peptidePose(spec,phi,psi)` and public `s.peptidePose` construct an original idealized peptide with explicit component atoms/bonds, stable residue identities and absolute torsion arrays. The factory is self-contained in host and QuickJS and callable inside retained callbacks. It validates dense arrays, geometry, component connectivity, required backbone atoms, budgets and identities. Bounds are 96 residues, 8 components, 24 atoms/32 bonds per component, and aggregate 1,536 atoms/2,048 edges. Unsupported cyclic/cross-linked backbone templates are rejected. Existing native molecular batching supplies the visible graph.

The motion fixture is **original 72-residue ALA/SER/VAL**, separate from the unchanged verified 1CRN assets. It has 414 atoms and 413 displayed bonds. Four helical blocks form before loop torsions compact them; the endpoint surface comes from the exact final pose. The component dictionary is 4,279 characters. See its fixture README for precise source hashes, explicit peptide geometry, carbonyl-angle approximation and scientific limits. The continuous path is illustrative, with no dynamics/collision-avoidance claim.

Two compatible optional `NucleicTranscriptProps` fields are added:

- `incomingRotation:{axis,angle}` rotates a free nucleotide's whole frame about its backbone anchor, easing exactly to zero by incorporation. Existing callers retain their previous output when omitted.
- `emergence:{direction,distance,delay,duration}` intentionally transports incorporated RNA away from the template. Per-site exit offsets begin after incorporation plus delay; the latent target chain is integrated backward with its original link lengths. Future targets remain fixed. There is no geometry switch based on the integer incorporated count, so earlier sites move continuously across subsequent incorporation. Only formed edges are displayed. Frames rotate with the exit direction. The default fixed-anchor behavior is unchanged.

## Native artifacts and author inspection

Tracked generators: `shared/animlib/demo/expansion/peptide-motion-proof.mjs` and `transcription-motion-proof.mjs`. Four production native WebGPU films are in `data/animlib-expansion/biological-motion-proof/`: `peptide-{16x9,4x3}.mp4` and `transcription-{16x9,4x3}.mp4`. All are 8 seconds/240 frames, 30 fps H.264/yuv420p, at 1280×720 and 960×720. All four decode completely through FFmpeg to null. Both scripts use public scene helpers and existing static asset packages; no helper factory or prepared mesh is inlined into scene source.

The peptide film shows continuous local coil formation, a held coil configuration, global compaction, and an exact endpoint surface fade with a short orbit. A conservative camera schedule derived from intermediate pose bounds corrected early clipping in the first draft. The RNA film shows a curved helix opening, eight arrivals rotating into docking frames, fixed-link emergence, machinery translation relative to DNA, and a closer view of the same U–G–C triplet. The illustrative C-shaped machinery is oriented so its opening faces the exit path. Local labels use the returned persistent anchors.

The author viewed all sixteen final MP4-derived ordered contact sheets at 8 fps (256 decoded samples), as well as native full frames and both-aspect still sheets. Inspection is sampled motion, not a claim to uninterrupted real-time playback or every frame. Apparent missing text in some tool displays is not classified as an encoded defect: root documented repeated same-file display artifacts, and identical files redisplayed with text. No reference image is a production asset.

## Verification and budgets

26 focused tests pass across peptide, nucleic geometry, nucleic host/QuickJS integration, molecular structure import and scientific fixtures. Typecheck/build pass. New peptide regressions measure all displayed bonds over 101 interior torsion poses, signed phi/psi and trans omega via an independent atan2 dihedral formula, carbonyl planarity, sustained local helix repeat geometry, stable IDs, exact endpoint reconstruction, and retained QuickJS reverse seeks. New RNA regressions prove orientation change, exact settling, unchanged default formed anchors, exit-link invariants, future-target persistence and continuity around incorporation boundaries.

| Measurement | Peptide | Transcription |
|---|---:|---:|
| Scene source characters | 16,850 | 6,173 |
| Scene elements | 10 | 26 |
| Native dynamic stick mesh | 6,608 vertices / 6,608 triangles | bounded existing nucleic batches |
| Compile, local sample | 294 ms | 125 ms |
| 121 samples including serialization | 7,367 ms | 2,372 ms |
| Largest serialized full frame | 1,034,508 bytes | 282,579 bytes |
| Static asset decoded bytes | 4,310,528 | 2,809,344 |
| Reverse seeks | exact | exact |

These are single local measurements, not a realtime guarantee. The peptide costs approximately 61 ms per full sample including serialization on this machine. The serialized full-frame size is an upper-level diagnostic, not the exact VM callback response size. Existing VM/reactive limits were retained. Detailed JSON measurements accompany the generated films.

The peptide CA radius of gyration decreases 71.1106 → 31.2275 → 9.8245 Å; this and invariant local helical geometry distinguish shape change from the accompanying camera zoom. The exact compact endpoint is independently reconstructed in the fixture regression before the envelope's shared origin is compared.

## Remaining visual/scientific limits

The opening overview of the long peptide has thin atomic strokes. The RNA bases remain flat extruded schematics; sugar/phosphate anatomy, soft depth/focus, environmental density and source-level organic machinery are not reproduced. The shell is illustrative, and its relative translation does not model a moving chemical reaction window through an arbitrary long gene. RNA release and backbone motion are geometric constraints, not chemical dynamics. The peptide has only three component types, no physical folding model, and no guarantee that all side-chain clashes are absent. Independent review must decide the next iteration; passing these tests and producing films do not close the source-style target.

# Reusing motion in the mathematical visual language

Use 3Blue1Brown's geometry-led visual language for new explanatory scenes. Draw
motion techniques from the other inspected channels: purposeful compression,
attention shifts, compact queue traffic, staged folding, paired arrivals,
cut/join operations and carrier transfer. The public helpers return geometry,
identities and events; they do not impose a creator's palette or layout.

Start with a persistent world large enough for the operation. Keep scaffolds
neutral, reserve color for stable roles and put notation beside its referent.
Use axes when quantities need coordinates. Biological diagrams instead expose
strands, sites, contacts and material topology. Preserve the object through its
change, then hold the visible consequence before naming it.

## Choose an operation

| Operation to borrow | Reusable mechanism | Current example |
| --- | --- | --- |
| Coordinate deformation and component reasoning | `s.plane`, mapped vectors/components, persistent originals | `shear.js`, `matrix-transport.js` |
| Copy terms into a calculation without losing correspondence | Formula slots, glyph identity and local attachments | `matrix-transport.js`; [identity transport](identity-transport.md) |
| Compact frontier arrival/extraction | `s.compactQueue` with an immutable record pool and contiguous slot transitions | `compact-frontier-3b1b.mjs`; [queue contract](compact-queue.md) |
| Events become rates, rates become state | Shared timestamps and kernels, aligned paths and numeric slots | `science-3b1b.mjs` → `artem-state` |
| Many traces become one projected trajectory | `s.sampledState`, explicit projection, growing disconnected runs | `science-3b1b.mjs` → `neural-trajectory`; [sampled state](sampled-state.md) |
| Selected observation becomes a residual | One parameter drives curve, prediction, vertical difference and local value | `logistic-residual-3b1b.js` |
| Local coils form, hold, then pack | `s.peptidePose`, staged torsions, persistent residue anchors | `peptide-3b1b-revision5.mjs` |
| Repeated pairing, strand advance and RNA emergence | Absolute-time `s.nucleicTranscriptionCycle` with stable bases and explicit exit frame | `transcription-cycle-revision3.mjs`; [transcription](nucleic-transcription-cycle.md) |
| Loop forms, boundaries cut, exons join | `s.nucleicSplice`, explicit bond topology and material arc | `rna-processing-3b1b-revision4-proof.mjs`; [processing](nucleic-processing.md) |
| A chain passes through a finite aperture | `s.nucleicThread`, bounded path and swept-radius clearance | Same processing example; camera cuts while the chain holds |
| Arrival, transfer, one-register advance and release | `s.nucleicTranslationCycle`, codon mapping and persistent cargo IDs | `translation-3b1b-revision4-proof.mjs`; [translation](nucleic-translation.md) |

Example filenames resolve under [`demo/expansion`](../demo/expansion/README.md).
That index supplies generation commands, output manifests and independent reviews.
Copy the chosen data/choreography into a new scene; do not modify frozen proof
inputs to create a different lesson.

## Keep data, time and appearance separate

1. Define the objects and invariants first: original coordinates, immutable IDs,
   adjacency, selected sample or complementary sequence. Reuse their IDs across
   representations and repeated events. A duplicate numeric value is not an ID.
2. Evaluate motion from absolute time. Bind the curve, marker and number to the
   same underlying value. For biology, evaluate one helper pose per exact time
   and use that pose for every linked primitive. Avoid integration by frame count.
3. Schedule explanatory emphasis around the operation. A carrier can hold while
   the camera inspects it; geometry time and camera time need not be identical.
   A held object should not drift because an automatic fitting window looks ahead.
4. Choose geometry and materials after the mechanism works. Thin lines, small
   anchor dots, restrained silhouettes and local serif/math notation are enough
   for the current default. A detailed mesh is an optional representation of the
   same identity, not a replacement for its motion data.
5. Inspect interior motion, event boundaries, reverse seeks and both intended
   aspects. Confirm the explanation remains visible while objects move. Numeric
   correctness, readable composition, source-motion correspondence and valid
   media are separate gates.

Use local palette roles consistently: blue constructions/carriers, teal selected
data or RNA, warm active correspondence, white syntax/product, gray context.
These are starting roles, not mandatory global color names; multivariate traces
need enough stable colors to distinguish their actual dimensions. Do not flatten
those distinctions simply to use fewer colors.

## Reuse prepared models efficiently

Prepare and validate immutable native model/image packages on the host. Generate
with descriptor-only catalogs, load only declared assets and keep the registry
alive for rendering. The [fixture catalog](../fixtures/biological/README.md)
records original schematic packages, pinned CC0 coordinate sources and licenses.
The [asset import contract](assets-import.md) covers supported glTF/GLB geometry
and source-color image policy. Neither scene generation nor a reference-video
inspection grants rights to reuse somebody else's film pixels or meshes.

`createMolecularEnvelopeParts` prepares bounded multipart surfaces without raising
runtime mesh budgets. Cache immutable geometry or one current pose, not all
frames. The reviewed surface-only example clamps its expensive geometry cache
after the pose settles while opacity and camera clocks continue. That optimization
has measured CPU/serialization evidence; it is not a general GPU-speed claim.

Current entrypoints generate from versioned source/input files. Optional archived
proofs may have explicit historical preparation dependencies. See the
[coverage index](expansion-index.md) for exact accepted scope and remaining limits.

# Expansion coverage and evidence

**Current user direction (2026-10-11):** use 3Blue1Brown art and graphing style
throughout, borrowing motion and animation techniques from the other references.
The historical artist profiles and source-art verdicts below remain research
records. They do not override the [current unified visual contract](../../../docs/animlib-expansion/unified-3b1b-direction.md).

This is the navigation entry point for the expanding library. API contracts,
artist profiles, reusable assets and proof acceptance are separate records.
An API test pass is not a visual-style pass. A reviewed film establishes only
its stated representative operation and exact artifact identity.

## Find the right layer

| Need | Start here |
| --- | --- |
| Watch what the library can animate | [Capability showcase](showcase.md): complete reviewed films with chapter navigation |
| Choose a public helper or understand budgets | [Helpers and assets](helpers-and-assets.md), [complete API reference](reference.md) |
| Author a scene without copying an existing film | [Reusable explanatory motion](explanatory-motion.md), the [current visual contract](../../../docs/animlib-expansion/unified-3b1b-direction.md), then [proof entry points](../demo/expansion/README.md) |
| Select prepared geometry and inspect provenance | [Biological fixture catalog](../fixtures/biological/README.md), [Suzanne](../fixtures/suzanne/README.md), [asset import contract](assets-import.md) |
| Load assets | `tools/load-assets.mjs`; use descriptor-only `registry.catalog` for generation and keep the registry alive for rendering |
| Verify a visual claim | The latest independent review below, including its exact scope and artifact hashes |
| Reproduce a candidate | [Proof commands](../demo/expansion/README.md#reproduce-current-candidates); export to a new filename and preserve reviewed media |
| Investigate cost | [Measured organization/reuse report](../../../docs/animlib-expansion/organization-performance-report.md), [motion costs](../../../docs/animlib-expansion/motion-performance-report.md), [current inventory](../../../docs/animlib-expansion/organization-inventory.md) |

## Public APIs and their representative coverage

| Domain | Public surface / ownership | Representative evidence |
| --- | --- | --- |
| Coordinates and formulas | `s.plane`, mapped paths/vectors/components; [formula identity transport](identity-transport.md) | Shear and matrix column → sum → row transport |
| Graphs and queues | `s.graph`, `s.dijkstra`, `s.collection`, [s.compactQueue](compact-queue.md) | Relaxation, equal-value swap, general frontier reorder, compact insertion/extraction |
| Sampled science data | [s.sampledState](sampled-state.md), aligned `countTo` and path samples | Event → rate → vector, trace → projected trajectory, logistic residual emphasis |
| Molecular motion | `s.molecularBackbone`, `s.molecularBackboneGeometry`, `s.articulatedChainPose`, `s.peptidePose` | Deposited representation identity and separate original prescribed peptide poses |
| Nucleic motion | `s.nucleicDuplex`, `s.nucleicTranscript`, [s.nucleicTranscriptionCycle](nucleic-transcription-cycle.md) | Paired strands, RNA arrival/emergence and exposed repeated transcription cycles |
| Processing and translation | [s.nucleicSplice / s.nucleicThread](nucleic-processing.md), [s.nucleicTranslationCycle](nucleic-translation.md) | Cut/join topology, bounded pore transport, codon/adaptor/product identity |
| Host preparation | `importPDBStructure`, `structureBackboneProps`, `createMolecularEnvelope`; native package conversion | Pinned coordinate import, original schematic surfaces, retained models/images |
| Multipart host envelopes | `createMolecularEnvelopeParts` from `animlib/core` | Independently reviewed revision-4 preparation path. [API and film review](../../../docs/animlib-expansion/peptide-revision4-independent-review.md), [plan and bounds](../../../docs/animlib-expansion/peptide-surface-revision4-plan.md) |
| Optical focus and export | `camera.animate({focus:…})`, `withOfflineScene`, native frame/video tools | Independently reviewed bounded rack-focus diagnostic; [focus contract](../../../docs/animlib-expansion/depth-focus.md) |

Host preparation does not run inside scene QuickJS. Multipart envelopes retain
the existing per-part 20,000 vertex/triangle ceilings, with at most 128 parts,
160,000 total triangles and 100,000 aggregate output vertices; density work stays
bounded at 25 million. These preparation bounds do not increase scene, VM,
registry or renderer budgets. See the API implementation and revision plan for
the full input limits.

## Historical source profiles

| Profile | Presentation contract | Observations / source record |
| --- | --- | --- |
| Mathematical explanation | [Math contract](../demo/expansion/math-style-contract.md), [matrix contract](../demo/expansion/matrix-frontier-style-contract.md): persistent objects, local reasoning, teal/orange roles | [Math/algorithm research](../../../docs/animlib-expansion/math-algorithm-reference.md) |
| Reducible algorithms | Graph/frontier section of the matrix contract; purple field, sans labels, node rings, grouped route/cost/destination cards; [compact motion supplement](../../../docs/animlib-expansion/reducible-motion-supplement.md) | Same research, with the later dense compact insertion/extraction inspection |
| Artem science | [Science contract](../demo/expansion/science-style-contract.md), [neural trajectory contract](../../../docs/animlib-expansion/neural-trajectory-style-contract.md): event/rate/state correspondence and time-colored trail | [Neuroscience/quantum research](../../../docs/animlib-expansion/neuroscience-quantum-reference.md) |
| Visually Explained | Separate residual section of the science contract: dim chart context, emphasize selected observation/prediction and local residual | Same research; exact monospaced typography parity is not claimed |
| Protein Folding reference | [Peptide revision-3 contract](../../../docs/animlib-expansion/peptide-revision3-style-contract.md): held side-visible local coils, then packing and representation change | [Protein motion supplement](../../../docs/animlib-expansion/protein-motion-supplement.md) |
| Transcription / Nucleus biology | [Biological contract](../demo/expansion/biological-style-contract.md), [transcription revision 2](../../../docs/animlib-expansion/transcription-cycle-revision2-style-contract.md), [processing revision 2](../../../docs/animlib-expansion/rna-processing-revision2-style-contract.md), [translation](../../../docs/animlib-expansion/translation-style-contract.md) | [Transcription](../../../docs/animlib-expansion/transcription-motion-supplement.md), [Nucleus processing](../../../docs/animlib-expansion/nucleus-processing-motion-supplement.md), and the translation independent review |

These profiles preserve the earlier authored contracts, not current art direction
or runtime presets. Extract their motion techniques into the unified mathematical
visual language without imposing a fixed slide template. Bundled MathJax/TeX variants are available;
arbitrary font loading is not. Research frames document observations and do not
grant a license to copy film pixels, source meshes or artwork into output.

## Latest independent acceptance and current candidates

Status snapshot: 2026-10-11. Historical reports retain their original findings;
later reviews take precedence only for the exact replacement they inspected.
An author report or new revision directory does not supersede independent
acceptance. Follow the linked review for all four gates and its evidence limits.

The [final visual coverage review](../../../docs/animlib-expansion/final-visual-coverage.md)
accepts eleven representative scenes under the current direction. The
[capability and reproduction audit](../../../docs/animlib-expansion/current-capability-audit.md)
maps those operations to reusable APIs, package ownership and portable inputs.
The [final independent library review](../../../docs/animlib-expansion/final-library-review.md)
accepts the implementation and evidence set, with scientific and performance
limits recorded explicitly.

| Proof | Latest independent decision | Newer work / remaining gate |
| --- | --- | --- |
| Shear, graph relaxation, Artem event/rate/vector, logistic residual | [Round 2, including its graph and Artem rechecks](../../../docs/animlib-expansion/visual-evaluation-round2.md): bounded operations ready | Broader creator fidelity and exact typography remain outside those passes |
| Equal-value swap and image/UV turn | [Round 1](../../../docs/animlib-expansion/visual-evaluation-round1.md): identity/readability ready; swap creator match unverified; image orientation target ready | No full PBR or channel-wide style claim |
| Matrix transport, general frontier reorder, neural trajectory | [Motion visual review](../../../docs/animlib-expansion/motion-visual-review.md): bounded representative operations ready | General frontier reorder is distinct from compact queue choreography; neural path/data remain synthetic |
| Compact frontier | [Unified independent review](../../../docs/animlib-expansion/compact-frontier-3b1b-independent-review.md): reasoning, readability, current art and technical delivery ready | Preserves reviewed compact insertion/extraction; general reorder remains a separate operation |
| Scientific plots | [Unified independent review](../../../docs/animlib-expansion/science-3b1b-independent-review.md): all three plots ready on all four gates | Synthetic logistic, event/state and projected trajectory data; no learned-manifold claim |
| Peptide | [Clean revision-5 independent review](../../../docs/animlib-expansion/peptide-3b1b-revision5-independent-review.md): staged formation, fixed hold, packing and current art ready | [Revision-4 API/assets/cache review](../../../docs/animlib-expansion/peptide-revision4-independent-review.md) covers optional realistic surfaces |
| Transcription | [Unified revision-3 independent review](../../../docs/animlib-expansion/transcription-cycle-revision3-independent-review.md): all four gates ready | Eight paired arrivals and curved emergence; schematic machinery |
| RNA processing | [Unified revision-4 independent review](../../../docs/animlib-expansion/rna-processing-3b1b-revision4-independent-review.md): all four gates ready | Formation/cut/join and aperture transport, including repaired local labels |
| Translation | [Unified revision-4 independent review](../../../docs/animlib-expansion/translation-3b1b-revision4-independent-review.md): full 43s bounded cycle ready on all four gates | Seven mapped residues, repeated transfer/advance, stop/release/separation; schematic kinetics |
| Optical rack focus | [Independent focus review](../../../docs/animlib-expansion/depth-focus-independent-review.md): ready within the six-second optical contract | Does not approve simplified anatomy as full biological fidelity; finite-sample and focus workload limits remain |

The [proof index](../demo/expansion/README.md#reviewed-artifacts-and-open-limits)
retains selected release hashes. Independent reviews and frozen hash manifests
identify exact films; regeneration may produce a different encode. Existing
4×MSAA exact-pixel variation is not closed by CPU parity. No proof claims
physical protein folding, recovered neural manifolds or atomistic RNA chemistry.

## Asset ownership and update discipline

- Reused third-party data: pinned PDB/CCD coordinates and component dictionaries
  are CC0; Suzanne retains its upstream CC0-1.0 attribution and source files.
- Original prepared assets: biological scaffolds, illustrative sequences,
  torsion/staging schedules, palettes and sequence textures carry their own
  CC0-1.0 provenance. CCD-derived components retain the upstream source lock.
- A package manifest identifies its asset ID, provenance, content hash and
  binary dependencies. `conversion-report.json` adds descriptor bounds/counts
  and conservative decoded accounting. A report's source/recipe hash is not
  necessarily a hash of the complete preparation script; inspect both.
- Load only a scene's declared packages. A fixture-family disk total is not
  that scene's logical vertex count, decoded working set or GPU timing.
- Keep reviewed packages and media frozen. New visual geometry uses new IDs and
  directories. Central navigation may update status; historical reviews remain
  evidence of the candidate actually inspected.

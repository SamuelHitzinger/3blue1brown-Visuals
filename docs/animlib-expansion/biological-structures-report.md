# Biological structures: reusable foundation and first native proofs

2026-10-11, `amilibsam`. Implementation and author inspection report. **This stable slice is ready for reuse, but independent evaluation identified motion gaps; source-level visual parity is not achieved.** The next proof must demonstrate sustained local protein coil formation and compaction, rotating nucleotide arrivals, RNA emergence and machinery/DNA travel.

## Delivered contracts

- `createNucleicBuilders` supplies bounded curved antiparallel DNA, explicit complementary pairs, shaped purine/pyrimidine plates, two continuous backbones, an opening window, and a sequential RNA mechanism. `s.nucleicDuplex(props,opening)` and `s.nucleicTranscript(props,time)` are public pure geometry APIs in host and QuickJS, including retained callbacks. IDs, frames, end labels, formed edges, incorporation state and triplet metadata are returned separately from batched native parts. No factory source is inlined in proof scenes.
- Baseline DNA link lengths are preserved by integrating normalized desired directions. Recentring and cumulative twist relaxation can move distal sites; no perfect outside anchoring is claimed. RNA grows 5′→3′ against an ordered 3′→5′ template. A free nucleotide has no covalent edge; the edge appears only after incorporation. The current RNA target is a fixed open snapshot and arrival has translation only. These are schematic geometric rules, not chemistry simulation.
- Host-only `importPDBStructure` preserves heavy-atom coordinates, atom/residue IDs, chain/TER blocks, author sequence/insertion codes, residue-consistent conformer choice, explicit breaks and graph provenance. It distinguishes deposited CONECT, supplied CCD edges and opt-in standard peptide links. Malformed and unsupported input is rejected or diagnosed. Existing `importPDB` is unchanged.
- The prepared 1CRN fixture contains 327 atoms, 46 residues, one chain segment and 337 bonds: 3 deposited disulfides, 289 CCD edges and 45 peptide links. Sticks have real side-chain branches/rings; beads share deposited CA anchors; the surface uses the same atom coordinates and origin. All preserve residue color identity. See `shared/animlib/fixtures/biological/README.md` for source/licence details and reproduction.

The 1CRN surface is a Gaussian envelope, not a solvent-excluded surface. It has 45 visible residue parts because one buried residue owns no exposed triangles. Bond orders are retained in metadata but rendered as one cylinder per edge. The importer supports a bounded first-model PDB protein subset, not general mmCIF, arbitrary ligands, microheterogeneity or biological assembly expansion. The offline CCD extractor accepts only pinned supported bond loops.

## Native proof artifacts

Reproducible tracked generator: `shared/animlib/demo/expansion/biological-proofs.mjs`. Preparation: `shared/animlib/tools/prepare-biological-assets.mjs`. Style contract: `shared/animlib/demo/expansion/biological-style-contract.md`. Generated sources, manifests, measurements and films are under `data/animlib-expansion/biological-proof/`:

| Film | Size | Duration / frames | Content |
|---|---|---|---|
| `transcription-16x9.mp4` | 1280×720 | 8 s / 240 | Curved helix, constrained opening, six complementary RNA arrivals and incorporation |
| `transcription-4x3.mp4` | 960×720 | 8 s / 240 | Same mechanism and timing |
| `structure-16x9.mp4` | 1280×720 | 6 s / 180 | Branched atomic sticks → CA beads/guide → sticks → same-conformer surface |
| `structure-4x3.mp4` | 960×720 | 6 s / 180 | Same endpoint identity proof |

All use the production native WebGPU renderer, retained absolute-time sampling, 30 fps H.264/yuv420p. All four pass full FFmpeg decoding to null. Proofs are silent, with static cameras. The machinery is original procedural open-channel geometry explicitly labeled illustrative; no crambin shape substitutes for a polymerase. No reference image is a production asset.

## Checks and measurements

Focused verification: 17 tests pass across `nucleic-structures`, `nucleic-integration`, `molecular-structure-data` and `biological-fixtures`. Tests cover malformed/sparse inputs, bounded settings, frame finiteness, complement/direction identity, stable topology, link invariants, formation timing, reverse seeks, host/QuickJS equivalence, conformer selection, model/TER/gap handling, source hashes, exact fixture graph reproduction and every referenced packed blob hash. Typecheck/build pass. Root independently reported the integrated 841-test suite passing before the two new fixture tests were added.

Measured maximum relative DNA link error over 401 opening phases: **1.1102230246251565e−15**. Reverse seeks of both production proofs are exact. Host/QuickJS geometry comparisons allow 1e−10 rounding for elementary floating-point differences. `measurements.json` records these observations and local timing; timings are a single warm-machine sample, not a benchmark guarantee.

| Proof | Source characters | Scene elements | Compile | 121 absolute-time samples | Static assets decoded |
|---|---:|---:|---:|---:|---:|
| Transcription | 5,187 | 22 | 131 ms | 1,782 ms | 2,809,344 bytes |
| Structure | 1,209 | 139 | 25 ms | 220 ms | 8,741,376 bytes |

Prepared geometry counts: sticks 10,784 vertices/10,784 triangles; beads plus guide 4,476/7,328; surface 5,492/8,676; illustrative channel 5,488/10,972. Static geometry uses the existing reusable asset registry. Dynamic DNA/RNA uses bounded native batches; no per-polygon scene elements or giant scene-source arrays.

## Actual inspection and open evaluation

`biological-reference-inspection.md` records complete sampled source chronology and denser growth/folding evidence personally viewed by the implementer. For the generated films, all fourteen final MP4-derived contact sheets at 8 fps were viewed in order (224 samples across both aspects), plus native full frames. The transcription stills were refreshed after the final open-channel change. The sampled transitions are stable and framed; there is no claim of full-frame-rate author playback.

Independent evaluator's early findings are substantive: the current bubble stays in place, arrivals retain one orientation, RNA does not emerge from the machinery, and static representation fades do not establish the local-coil-to-compact folding capability seen in the source. Those remain the next motion scope. The current shell is visibly schematic; the surface uses seven color bands with triangle assignment boundaries, and source-level organic shading, environment and detailed anatomy are not reproduced. Numeric checks and this report do not constitute visual approval.

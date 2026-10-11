# Absolute-time translation choreography

`s.nucleicTranslationCycle(props, time)` evaluates a bounded original schematic without changing props or relying on previous samples. The host factory is `createNucleicTranslationBuilders()` from `nucleic-translation.ts`; its source is self-contained for the compiler's QuickJS installation. `NucleicTranslationProps` and `NucleicTranslationResult` are public types.

Supply a dense RNA list of 6–192 uniquely identified bases, in complete codons starting AUG and ending in exactly one terminal stop. Supply one carrier per sense codon, each with its own unique carrier and residue IDs, correct three-letter amino-acid name, and complementary anticodon written **3′→5′** against the RNA's **5′→3′** direction. The helper validates all 64 standard-code assignments using [NCBI table 1](https://www.ncbi.nlm.nih.gov/Taxonomy/Utils/wprintgc.cgi#SG1), not source-film labels. UAA/UAG/UGA never create a carrier or residue. Alternative genetic codes, alternative start codons and wobble are unsupported.

The origin, axis and normal establish an orthonormal local frame. `pitch` is the base spacing; A, P and E sites are separated by three pitches. `carrierHeight` locates the acceptor payload relative to the anticodon. `arrivalOffset` and `exitOffset` are local-frame translations. `peptideSpacing` sets every formed peptide edge's exact length. Assembly moves the large/small subunit origins independently by `subunitSeparation` along the normal. Assets are optional consumers of these transforms; the helper returns no meshes.

`assembly.start/duration` must finish before `start`. Each `cycleDuration` includes arrival (0–25%), a docking hold, transfer (30–50%), A→P/P→E translocation (50–70%), and the previous carrier's exit (70–95%). The initial Met carrier enters P directly and is incorporated at 25%; subsequent incoming carriers enter A and receive the existing product at 50%. During transfer the result reports `product.transfer` with source, destination and continuous progress, rather than falsely reporting a stationary attachment. After transfer `attachedCarrierId` identifies the current product carrier. The chain moves continuously; existing edges and residue identities persist.

After the last sense cycle, the terminal stop remains in A; the last peptide remains on its P-site carrier until release begins one quarter-cycle later. `releaseDuration` moves the same product away on a prescribed local displacement `[6,1,2]`, while the final spent carrier exits. `disassemblyDuration` follows release. Complete schedule must fit 86400 seconds. Times before the schedule and far after it clamp to fixed initial/final poses. All bounds are checked before geometry generation, even when sampling before initiation.

Every RNA, carrier and residue remains in the returned arrays for stable scene identities. Use `visible`, `incorporated`, `phase`, `loaded`, bonds and attachment/transfer fields to decide rendering. Product bonds appear only after the corresponding transfer completes. `loaded` means carrier cargo occupancy; it does not mean the original single amino acid remains chemically unmodified. RNA follows a prescribed shallow bend, so this helper does not promise fixed RNA bond lengths. It is not molecular dynamics, an atomic reaction simulation, a folding model, deposited ribosome geometry, or a reconstruction of Nucleus's surfaces.

Reproduce the proof from the repository root:

```
npm run build --workspace animlib
node shared/animlib/tools/prepare-translation-assets.mjs
node shared/animlib/demo/expansion/translation-proof.mjs
node shared/animlib/tools/render-frames.mjs data/animlib-expansion/translation-proof/frames.json
```

The generated manifest is compatible with `tools/render-video.mjs` at 1280×720 or 960×720, 30 fps. The proof uses three residues deliberately: AUG GGU GCU UAA → Met–Gly–Ala, stop. Its original lobed assets are reusable and hashed. The proof demonstrates operations, but current Nucleus style acceptance remains **revise**: the subunit silhouette is too simple, the tunnel is not the reference's elongated exit path, the foreground-carrier hold is shorter, and the source's many-residue accumulation is not reproduced.

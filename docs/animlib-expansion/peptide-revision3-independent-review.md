# Peptide revision 3 independent review

Reviewed 2026-10-11. The frozen candidate, implementation, assets and Git state were not changed. This review applies the explanation-style skill's separate gates to the actual Protein Folding reference, rather than importing mathematical or cellular styling.

## Verdict

| Gate | Verdict | Scope |
|---|---|---|
| Reasoning | ready | Explicitly authored local torsion formation, hold, packing and representation change; not physical folding |
| Visual readability | ready | The revision-2 end-on coil failure is repaired in both aspects |
| Reference style | revise | Surface color boundaries and local shading remain visibly less resolved than the source |
| Technical delivery | ready | Fresh focused tests, frozen hashes and full decodes; no realtime-performance certification |

Do not close the full reference-fidelity goal. This revision earns a bounded coil-staging acceptance, not a near-identical rendering claim.

## Personally inspected evidence

Viewed every tile of `data/animlib-expansion/biological-motion-revision3/peptide-{16x9,4x3}-sheet-01..05.png`: all ten ordered MP4-derived 8fps sheets, 160 full-composition samples covering both complete ten-second films. Also viewed twelve complete native frames: indices 2/4/5/7/10/12 in both aspects, at 1.4/2.8/3.5/4.9/7.2/8.4 seconds. These were full frames, not crops or contact-sheet substitutes for native readability.

Compared all eight `protein-chronology/folding-playback/sheet-01..08.jpg` sheets (127 irregular browser playback captures, approximately 70.18–87.09s) and complete chronology source frames 071/079/103/110. All paths above are under `data/animlib-expansion`. This is dense ordered sample inspection, not uninterrupted playback or inspection of every encoded frame. The source captures contain browser overlays and do not establish exact subframe easing.

Read the revision contract, author report, earlier round-2 review, staging/surface preparation scripts, pose sampler, scene generator, fixture READMEs and focused tests.

## Visual findings

The four rows now remain separated while their repeated turns develop. The red, yellow, teal and blue blocks can each be followed from the broad opening through 2.8s into the 3.5s hold. The orange and cyan connectors remain distinguishable from the helical blocks. The 3.1–4.2s hold gives time to read the local structure before packing. There is no repeat of the earlier narrow end-on coil state or large formation-stage framing swing. This is a substantive repair, supported by the whole ordered interval rather than only a successful final still.

Packing at 4.2–6.6s is visibly prescribed: connected blocks sweep and reorient into the compact form. Color identity and the connected chain remain trackable, though depth crossings necessarily obscure portions. This supports the declared illustrative operation; it does not establish collision-free motion or a physical folding pathway. The reference likewise separates local formation from subsequent assembly, so exact copying of its protein, residue count or turns is not required for this bounded gate.

At 7.2s the stick view retains the compact object; the 7.4–8.2s envelope reveal follows it rather than introducing an unrelated silhouette. Both aspects preserve the complete subject. The final surface has markedly rounder lobes and more continuous highlights than revision 2.

The remaining actionable style failure is visible at native 8.4s and throughout the final ordered sheet: the red/yellow boundary down the upper-middle surface and yellow/cyan boundary contain sawtooth edges, with small angular/crease-like patches in otherwise rounded lobes. Source frame 110 has more integrated fine surface relief, softer broad highlight transitions and less conspicuous color-boundary triangulation. Improve the shared-vertex sequence field and local surface/normal resolution, then recheck the complete 7.4–10s reveal and orbit in both aspects. More illumination alone cannot remove a stepped color boundary.

The small blue region behind the orange/yellow aperture looks locally flat in the native frame. Inspection of the preparation code shows it is part of the endpoint-derived textured envelope, not a separately introduced blue plane. This review does **not** establish misaligned geometry there; it records an apparent shading/color-detail difference. Do not repair it by deleting a correctly recessed portion of the protein merely because it looks flat from this view.

## Fresh technical verification

`npm --prefix shared/animlib test -- peptide-staged-proof.test.ts` passed: one file, three tests. Dedicated TEMP/TMP was `data/tmp-review-peptide-transcription`. The checks reconstruct 201 poses to preserve atom IDs, bonds and displayed bond lengths below 1e-10; inspect 121 formation poses for four separated side-visible blocks; compare the compact endpoint under its common rigid transform below 1e-9; and check an arbitrary reverse seek exactly. Source inspection confirms the sampler reconstructs all atoms through peptidePose and interpolates torsions, not Cartesian atom positions. The surface generator reads the original endpoint and computes common normals before splitting its parts. No bond/endpoint failure was found in this bounded audit.

Independent SHA-256 calculations match the frozen films:

- 16:9: `1c2812d8295a9fbed1d6dd6824348d23b2b88108c0624cbe143aeb62f89b8cd9`
- 4:3: `9ffa8a529bc4a2f2d71a338eea87d17029da2ec37e612aaccebed03d24afb1ab`

Both files were independently decoded in full with the supplied FFmpeg 7.1 binary: 300 frames, 10.00 seconds, 30fps, yuv420p, 1280×720 / 960×720, zero audio output, successful completion. The author's integrated 940-test result and CPU/asset measurements were read but not independently rerun here. The focused tests do not prove self-collision freedom, chemical dynamics, arbitrary user-generated staging robustness, or frame-time performance.
# Scope update — 2026-10-11

The user subsequently changed the target to 3Blue1Brown art/graphing style, with biological references guiding motion techniques. This report is preserved as historical evidence. Molecular realism/style differences below no longer block the new target, and the old film is not retrospectively approved as a 3Blue1Brown presentation. The accepted staged motion and subsequent bounded surface/API review are recorded in `peptide-revision4-independent-review.md`.


# Independent review: unified science proofs

Reviewed 2026-10-11 by the transcription/peptide author, who did not author these science scenes. Production files were read-only. The governing contract is [science-3b1b-style-contract.md](science-3b1b-style-contract.md); the user requires 3Blue1Brown art and source-derived motion mechanisms, rather than source-specific art.

| Proof | Reasoning | Visual readability | Reference style | Technical delivery |
|---|---|---|---|---|
| Logistic residual | ready | ready | ready | ready |
| Event to state | ready | ready | ready | ready |
| Projected neural trajectory | ready | ready | ready | ready |

No substantive unresolved defect found. These verdicts cover the bounded illustrative mechanisms below, not measured neural activity, learned dimensionality reduction, or a general scientific simulation.

## Material personally inspected

I viewed all three skill baseline images (`approved-components.png`, `approved-derivative.png`, and `rejected-chart-template.png`). Source-motion evidence comprised all four `artem-complete/sheet-*.png` pages (29 captures, 232–260 seconds), all three `visexpl-complete/sheet-*.png` pages (22 captures), all three `neural-trajectory-complete/sheet-*.png` pages (41 captures, 260–300 seconds), and all six dense `neural-trajectory-complete/growth-playback/sheet-*.png` pages (178 captures, approximately 264.025–290.096 seconds). These are ordered sampled inspections, not a claim of uninterrupted real-time playback. Reference pixels are inspection material, not scene assets.

Final media under `data/animlib-expansion/science-3b1b/` were inspected in full temporal order through every 8 fps sheet: four pages per aspect for Artem, four per aspect for logistic, and five per aspect for trajectory. That is all 26 pages and 384 actual samples, covering 0–7.375, 0–6.875, and 0–9.375 seconds respectively. Padding cells were not counted as frames. Additional full native 1280×720 and 960×720 frames were viewed at Artem 3.8/6.3 seconds, logistic 2.6/3.8/6.99 seconds, and trajectory 3.4/9.49 seconds: 14 native frames. I also read the generated sources, generator, logistic authoring source, contract, and verification code.

## Reasoning, motion and art findings

**Event to state:** During 0.6–3.4 seconds, kernels appear at the actual event positions and their colored sum grows across each of the five rows. Fading the ticks before 3.5–4.7 second horizontal compression keeps the retained rate curves identifiable. At 4.7–6.0 seconds the common time slice at t=2 and five matched markers earn the adjacent state vector. At 6.3 seconds the values and row colors remain legible at native scale in both aspects. The curves occupy the mathematical world, with no card or footer structure. The formula is local to the construction; color maps rows to corresponding entries, rather than changing between stages. The final hold gives time to inspect the result. The source's event/kernel/state correspondence survives the art change.

**Logistic residual:** The 0–1 second curve reveal is followed by selection of the fixed observation at x=2. During 1.3–2.5 seconds the warm model prediction and vertical residual expose the compared pair. From 2.7–4.9 seconds the same parameter drives the moving curve, prediction and displayed weight. The observed point stays at y=1; the residual shortens while the initial curve remains a quiet reference. The later squared error is earned by that visible shortening and holds from 5.4–7 seconds. At native 2.6, 3.8 and 6.99 seconds, the model formula, prediction label, residual label, observation label and error expression avoid each other and the meaningful curve segment in both aspects. Axes and the sparse quiet grid preserve an unambiguous common coordinate world. This keeps the source's selected sample/model/residual mechanism while removing its card presentation. It illustrates a prescribed parameter change and one sample's squared error; it does not claim an optimizer or global loss improvement.

**Trajectory:** From 0.5–1.6 seconds the five traces and their state entries compress coherently into the upper left. From 1.6–2.4 seconds a labeled fixed projection and three component axes introduce the next inference. During 2.4–8.5 seconds the shared cursor, numeric state, component guides, moving head and growing trail preserve correspondence while the camera turns gradually. The head remains distinguishable from the subdued historical trail. The 8.5–9.5 second hold retains the completed trajectory and final five values. Native 3.4/9.49 second frames show readable local serif notation and all three axis labels in both aspects. The upper-left traces function as a live linked view of the same mathematical object; the large spatial construction below has no surrounding card or dashboard chrome. A time-color key explains the restrained purple-to-blue trail. The different layout is justified by simultaneous five-dimensional state and three-dimensional projection, and follows the source's motion relationship. The explicit projection is (f1,f2,f5)/5, not an inferred latent manifold.

## Independent checks

All 14 entries in `frozen-hashes.json` were recomputed and matched. Every film was independently decoded to completion with the repository FFmpeg binary. Media are H.264 High, progressive yuv420p, 30 fps, no audio, at 1280×720 or 960×720: logistic 210 frames/7 seconds, Artem 225 frames/7.5 seconds, trajectory 285 frames/9.5 seconds. Logs are in `data/tmp-review-science-3b1b/*-media.log` and `*-decode.log`.

I reran the author verifier in a review-only copy with its output redirected to `data/tmp-review-science-3b1b/verification.json`. It passed 211 logistic, 226 Artem and 286 trajectory poses, complete reverse seeks, and exact repeated native frames in both aspects. Logistic geometry and weight have maximum numerical discrepancy 1.7763568394002505e-15. Artem and trajectory retained geometry, transforms and numeric choreography exactly equal the prior source at every checked pose, allowing only the explicit mathsf-to-mathrm replacement.

Fresh focused tests passed: `npm --prefix shared/animlib test -- science-proofs.test.ts neural-trajectory-proof.test.ts sampled-state.test.ts` — eight tests, three files. These independently exercise event-derived rates and normalized kernels, sample/marker correspondence, fixed projection and active trail endpoints, component guide continuity, missing-data segmentation, and deterministic seeks. The retained-scene equality check connects those older-scene invariants to the new unified renders. No full repository suite claim is made. The first direct Vitest invocation used a nonexistent package-local binary; the subsequent npm invocation above completed successfully.

| Film | SHA-256 |
|---|---|
| Artem 16:9 | `eaae5d5c0e7aa5a6c5d24e29a650e88c712d3a0493dc64ffd51a156b21535c9b` |
| Artem 4:3 | `f8d006fe49f2031a1e4c32a6f95093dcb24e9cf256cbf19915e8c754205ad762` |
| Logistic 16:9 | `47274a1fdcab7693ee0abedc42e69791fd2df11b3038bc0d7b8189dcb82d45c5` |
| Logistic 4:3 | `4d2d24f16ee508a4353952e3bc525a879d38bb56e827c0422e89b7f072f4b572` |
| Trajectory 16:9 | `3f91942fe841fab606c384a1f672ad9da6e859a12a7f18da1ed203330d325934` |
| Trajectory 4:3 | `80e48869c81be5ab4f6facc4f8a3650bd8e1cb87b238a0bfde79bd15a3da3c76` |

Acceptance applies to these exact freezes. Changes to motion, layout or typography require reinspection of the affected passage and final encoded outputs.

# Independent visual review: pipeline peptide demo

Reviewer: independent delegated visual reviewer. No scene, runtime or Git edits were made. Review date: 2026-10-11.

## Exact reviewed source and scope

Source: `872ef266-3328-4b6b-a520-c911f0952d69/scene-0.subtitles.js`.
SHA-256: `70968c5345f11e026cddf1ca98494fdb0ed665ea158a8036ec90bb484458cc6f`.

Final encode: `demo.mp4`, SHA-256 `edc0e44e0ba10f5e0ccf8ff8602c35ec11fc5dd1dcd968abd19dd82f1e0d5ba6`.

Read the user request in `request.json`, project `docs/demos/pipeline-peptide-20261011/style-contract.md`, the explanation-style skill, its visual baseline and review gate. The task is a six-residue schematic with one prescribed phi rotation, not physical folding or an energetic prediction. Source inspection confirms the single index-2 phi change from -120 to -60 degrees, fixed other torsions, pose-derived circular locus, fixed world transform and camera. Numerical correctness is the responsibility of the separate geometry audit; visual evidence alone does not establish exact bond invariance.

## Evidence actually inspected

- Viewed all three bundled baseline images at native size: approved-components.png, approved-derivative.png and rejected-chart-template.png.
- Decoded and viewed ten ordered baseline movie samples at 2 fps over 15.0–19.5 seconds, saved in `reference-review/euler-15-to-19p5.png`. This shows coherent component/label translation, copied-vector rotation with original retained, and endpoint hold. It is sampled temporal evidence, not continuous playback.
- Viewed exact final-source native 1280×720 WebGPU frames at 0, 3.3612, 5.0418, 8.2, 10.0835, 11.7641, 13.4447 and 20.167 seconds under `scene-0.visual/0`. Timing comes from its `frames.json`.
- Decoded and viewed 32 ordered samples of `proof-final.mp4` at 4 fps. Proof time 0–7.75 seconds corresponds to source time 7.5–15.25 seconds. Contact sheets are `reference-review/final-proof-4fps-01.png` and `-02.png`. Native stills establish fine text readability; reduced contact sheets establish progression and continuity.
- Inspected generated source and subtitle metadata. The subtitle text explicitly says the torsion is prescribed and not a folding simulation.
- Earlier `proof.mp4` candidate was inspected only diagnostically and is not the basis of final approval.
- Decoded and viewed forty ordered full-movie samples at 2 fps over 0–19.5 seconds, saved in `reference-review/full-demo-2fps-01.png` through `-04.png`. The unused black cells in the fourth sheet are contact-sheet padding, not movie frames. Also viewed native 1280×720 encoded frames at 18 seconds and the final frame at 20.166667 seconds. These confirm setup, operation, annotation transitions and final hold survive encoding.
- Independently decoded all 485 video frames without errors. FFmpeg reports H.264, yuv420p, 1280×720, 24 fps, about 20.21 seconds. With 485 frames at 24 fps the duration is 20.208333 seconds. No audio stream exists. Extracted the embedded English mov_text subtitles and confirmed the six cues, including the prescribed-torsion caveat at 15.833–19.367 seconds. Caption rendering in every external player is not verified.

## Separate verdicts

| Gate | Verdict | Evidence |
|---|---|---|
| Reasoning | ready | During 8.644–12.2 seconds the downstream portion rotates around the fixed teal hinge while the retained upstream chain stays fixed. A marked moving atom, curved trace and faint original make the operation reconstructible without captions. At 13.7–15.167 seconds a downstream bond is highlighted and linked to its equal initial/final length annotation. Ready for this schematic claim, with numerical audit kept separate. |
| Visual readability | ready | Native 1280×720 frames show an approximately 865-pixel-wide chain, small clear atoms, unclipped sweep, readable serif labels and leaders. The ghost is distinctly quieter than the current chain. Labels identify the hinge or selected atom/bond without material collision. |
| Reference style | ready | The molecule owns the frame. Persistent geometry, stable role colors, local notation, a visible operation and endpoint hold transfer the approved baseline's explanatory mechanism. No title/chart/footer, card sequence, decorative camera move or reset. |
| Technical delivery | ready | Full final H.264 movie decodes all 485 frames without errors: 1280×720, 24 fps, 20.208333 seconds, no audio. Forty ordered full-movie samples and native endpoint frames retain the reviewed construction and final hold. Embedded optional English subtitles preserve the scientific caveat. |

## Style gate findings

1. Construction ownership: at 0 seconds the only substantive content is the chain. At 10.0835 seconds it remains the main construction, with local hinge/atom notation. Empty space supports the sweep; there is no bounded chart or permanent heading/footer.
2. Identity: across source 7.5–15.25 seconds the cyan upstream chain, teal N–C-alpha hinge, orange downstream branch and grey initial branch remain identifiable. The camera does not drift or recenter.
3. Annotation linkage: N and C-alpha have short leaders to the hinge atoms. Phi is tied to the hinge midpoint. The orange tracked-atom label moves with its marker and then retires as the result is established. The final length annotation leads directly to the white selected bond.
4. Color: teal consistently identifies the hinge, orange the moving portion and tracked point, muted cyan the retained upstream portion. White is a brief bond-invariant emphasis rather than a chapter-wide recoloring.
5. Earned claim: the viewer can see downstream displacement against the ghost while the upstream chain remains stationary, and the traced point moves along a curved locus. The caption does not supply the entire mechanism. Exact circular geometry and bond lengths require the separate numerical audit.
6. Purposeful timing: molecular pose is held through setup, the operation lasts about 3.56 seconds, and the endpoint remains from 12.2 seconds through the 20.167-second source end. The proof shows gradual interior motion at 4 fps and a stable result. It does not establish the absence of every possible single-frame artifact.
7. Topic-required differences: molecular sticks replace vectors; no grid is needed. Algebra is minimal because the claim is geometric. The black background and narrower vertical footprint differ from the Euler reference but do not create the rejected presentation structure.

No substantive style, reasoning, readability or technical revision is required for delivery of this schematic demonstration.

Optional clarity improvement for a future generation: the final `1.40 → 1.40` annotation is in model length units (explicit in source), but those units are not named onscreen. The delivery description should retain the idealized/schematic qualification and must not present this number as a calibrated experimental bond measurement. This does not invalidate the equal-length comparison.

## Limits

Review uses actual native frames, ordered decoded movie samples and source inspection, not continuous playback. It does not establish physical realism, energetic plausibility or predictive folding. The visual gate is independent of production self-review and is not inferred from successful compilation.

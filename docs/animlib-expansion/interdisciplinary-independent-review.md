# Independent coupled-mode proof review

Reviewed 2026-10-14 by an independent scene reviewer. The reviewer authored the
underlying scientific-state helpers but did not author the proof scene, its
composition, or its animation. Mathematical tests and visual judgments are
reported separately.

**Candidate:** `shared/animlib/demo/expansion/coupled-modes.js`, copied to
`.tmp/interdisciplinary-proof/coupled-modes.js` for rendering.
Source SHA-256:
`79307e58f1eccf3b2a12283c293c81727563931ce409be5d0d1dee0e7c23b8eb`.
Duration: eight seconds. Backend: native WebGPU. Scene: 71 elements.

## Evidence inspected

- The explanation-style skill's actual `approved-components.png`,
  `approved-derivative.png`, and `rejected-chart-template.png` images, together
  with its baseline and four-gate instructions.
- The [proof contract](interdisciplinary-style-contract.md) and exact scene
  source, including physical-time mapping and spring/component construction.
- Native PNGs at 0, 3.6, and 8 seconds at both 1280×720 and 960×720, under
  `.tmp/interdisciplinary-proof/frames/`; ordered contact sheets spanning the
  setup, motion interiors, endpoint, and hold from 0–8 seconds.
- Compiled-scene tests verifying displacement/component correspondence, spring
  endpoints, and repeated/backward seeks. Separate helper tests verify the
  supplied oscillator parameters' constant total energy; the film does not
  claim to demonstrate that energy invariant visually.

This is sampled-frame and source inspection, not uninterrupted movie playback
or inspection of a final encoded film. Full-motion similarity to the reference
remains unverified. Native frame dimensions and deterministic scene behavior
are established; movie codec, frame rate, and audio-stream properties are not.

## Four separate gates

| Gate | Verdict | Evidence and scope |
| --- | --- | --- |
| Reasoning | **Ready** | At each mass, teal and orange head-to-tail displacement components meet the white resultant and its actual position. Supplied symmetric/antisymmetric modes govern all displayed masses and spring endpoints. The second coordinate's opposite antisymmetric sign is represented in geometry and local notation. The scene earns the limited claim that the component motions add; it does not derive the eigenmodes or claim a visual energy proof. |
| Visual readability | **Ready** | Native frames at both aspects preserve all three mechanical rows, mass identities, equilibrium guides, spring connections, and local formulas. The 1.4-second setup and 1.6-second endpoint hold provide reading time. No blocking collision or cropped geometry was found. |
| Reference style | **Ready** | The mechanical construction owns the frame. Persistent objects, restrained semantic colors, aligned equilibrium references, local head-to-tail addition, and formulas beside their actual referents follow the approved component-construction mechanism. There is no detached title/chart/footer or recap card. Three rows are needed to relate the two component motions to their sum; they are not unrelated topic cards. |
| Technical delivery | **Ready for the native proof** | The actual animlib compiler, reactive sampling path, and native WebGPU renderer produced the inspected 16:9 and 4:3 PNGs. Source identity is pinned above. This verdict is limited to the native proof artifacts and compiled scene; final encoded-film delivery is unverified. |

**No blocking findings.** This acceptance applies only to the pinned proof and
its stated operation. It does not approve every scientific recipe, establish
universal generated-scene quality, or measure model-generation latency.

## Image-inspection anomaly checked

Some tool-displayed copies appeared to omit static labels late in the clip.
Before diagnosing a rendering failure, the reviewer decoded the PNG files and
compared the top-label rectangle (300×65 pixels, centered horizontally, y=65–129).
At indices 0, 4, 8, 9, 10, and 11, at both aspects, that region had 670 foreground
pixels and the identical RGBA SHA-256:
`faf5c07e750dfc7004d25c151b4d460f7bd07835fd48b1244b3b772d8a70ff0f`.
The encoded label region did not disappear. No renderer defect is inferred
from those inconsistent tool displays.

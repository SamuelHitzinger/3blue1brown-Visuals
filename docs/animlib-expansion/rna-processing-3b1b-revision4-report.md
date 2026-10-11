# RNA processing revision 4: frozen review handoff

The user's latest instruction makes 3Blue1Brown visual language the art target and retains the biological footage as a motion reference. This revision follows that change: teal persistent RNA, yellow selected or removed material, thin blue mechanism guides, a near-black world, and local serif labels. It does not pursue the earlier Nucleus cellular textures, organic anatomy or contact-lighting style. The separate [style contract](rna-processing-3b1b-revision4-style-contract.md) defines the new gates. This is an author handoff for independent review, not an independent visual approval.

## Outputs and preservation

All current outputs are under `data/animlib-expansion/rna-processing-3b1b-revision4/`. The four native WebGPU films are silent H.264/yuv420p at 30 fps. Splice is 12 seconds/360 frames in each aspect; pore is 10 seconds/300 frames in each aspect. Frozen revision2 films/assets and rejected orbit evidence remain unchanged. The unfinished original textured revision3 attempt remains optional capability, described in [its status note](rna-processing-revision3-optional-status.md).

| Film | SHA-256 |
| --- | --- |
| `splice-1280x720.mp4` | `1570b6be18f0bec2d2ff78fd35bb1e536078a962c7a23c81c045a283926d078f` |
| `splice-960x720.mp4` | `eba79a83936d81ba71f758a35ede4a848fd11682ded738620d0b6d2a06be601e` |
| `pore-1280x720.mp4` | `df19ed509b7d6f0dad52c9972698f415cbb3fa94bd7c129eb1cafef0843d0af7` |
| `pore-960x720.mp4` | `e196926a7f2ccd527151087f572a1046928a15baa317d3c63cffdcd9cb10f02f` |

Generator: `shared/animlib/demo/expansion/rna-processing-3b1b-revision4-proof.mjs`. It reads the frozen revision2 helper properties, writes `splice.js`, `pore.js`, both render manifests and representative-frame specifications. Revision4 uses no external asset packages, textures, optical focus, new helper APIs or shared-core changes. Geometry uses existing spheres, lines, text and mesh primitives. Flat ambient illumination preserves the semantic palette.

Source SHA-256 values: splice `e989110d313c1ce1f82a869bf3464b7c6e83631892c6d9fd7d931ee61e5c3972`; pore `0ebf906476353de982fdc198376a582345ad88c850f1dee050bc20768c8c1fd9`.

## Motion and readable operations

Splice preserves the accepted straight-to-loop formation, formation hold, two-boundary cut, rigid fragment departure, exon closure and replacement edge. Forty retained site identities are visible as nodes with short base ticks. Blue open boundary guides approach the same boundaries. White cut-end markers appear during closure. The yellow material remains visible after removal while joined teal RNA holds its resulting state.

Pore preserves the accepted curved approach and rising emergence, with the same 26 site identities and selected site. An actual radius-1.3 opening, cylindrical wall and two thin rim circles make the aperture visible. Membrane occlusion remains real. The chain is held from 4.4 through 4.9 seconds, and the purposeful opposite-side camera cut occurs at 4.65 seconds with identical chain positions. The mRNA label moves into clear space on each camera side, retains its selected-site association, and no longer crosses the teal shaft. Its fine leader can be partly depth-occluded by the membrane; the word remains visible.

The retained helper contracts are schematic kinematics, not molecular dynamics. Formation preserves material arc offsets while adjacent Euclidean chords change. Thread offsets follow the declared piecewise-linear arc; the conservative expanded-slab swept-tube clearance is retained. The helper does not certify every rendered straight inter-site chord as the exact curved centerline. No biochemical or physical-shadow claim is added.

## Author inspection evidence

The author re-read the 3Blue1Brown skill baseline and review gate, and viewed all three bundled approved/rejected reference images. Earlier source inspection covered all 12 ordered source sheets/179 actual captures. During this revision the author personally revisited source sheets 09–11 and native source frames 153 and 158 before the art target changed. These references now govern motion only.

Final films were decoded to full native 8 fps samples. The author personally inspected every ordered final sheet: six splice sheets per aspect and five pore sheets per aspect, 22 sheets/352 samples total. All sheet paths and time intervals are in `evidence.json`. The author additionally viewed native splice formation, cut and joined-result frames, and pore native 4.649/4.65 frames in both aspects, plus representative exit/hold frames. Native words and geometry remain separate in those cut checks. Final whole-motion inspection found the expected formation, cut, departure, joining, traversal and hold sequence.

Representative native frame index: `splice-frames/frames.json` and `pore-frames/frames.json`. The file suffix is the zero-based index into these time lists, for either `1280x720` or `960x720`:

- Splice: `[0, 2, 3.5, 5.39, 6.15, 6.17, 7, 8.04, 9, 11.9]`.
- Pore: `[0, 3.5, 4.4, 4.649, 4.65, 5.4, 6.5, 9.9]`.

Ordered final samples are `motion/{splice,pore}-{1280,960}x720/frame-NNN.png`; sheets are `sheet-NN.png`. Sample zero is time zero, spacing is 0.125 seconds, 16 samples per sheet. This was ordered still-sequence review, not a claim of browser video playback.

## Technical verification

`shared/animlib/tools/verify-rna-processing-3b1b-revision4.mjs` samples every encoded time: 360 splice and 300 pore poses. It compares VM site anchors against the host helper within 1e-10, verifies retained element IDs, splice cut/replacement graph, reverse seeking, and exact chain positions throughout the camera-cut hold. Measured maximum host/VM anchor difference is 4.44e-16 for splice and 3.55e-15 for pore. These tiny rounding differences are recorded rather than called bitwise equality. ID, graph, reverse-seek and held-chain assertions are exact.

Targeted validation passed all 18 tests across `nucleic-processing.test.ts`, `nucleic-processing-integration.test.ts` and `rna-processing-revision2-independent.test.ts`. Both native renderers finished every film. Full-film FFmpeg extraction decoded all four outputs and produced exactly 96 samples per splice film and 80 per pore film. Film metadata and hashes are recorded in `evidence.json`; the verifier records the expected encoder contract, while the render/decode results establish actual delivery.

Single-run measurements: splice 127 elements, maximum serialized frame 44,698 bytes, compile 70.55 ms, 121 samples including serialization 441.45 ms; pore 58 elements, 51,703 bytes, compile 33.37 ms, 121 samples including serialization 466.47 ms. These are local observations, not performance guarantees. No independent approval is inferred from technical checks. The independent reviewer must separately assess reasoning, readability, source motion, current visual language and technical delivery.

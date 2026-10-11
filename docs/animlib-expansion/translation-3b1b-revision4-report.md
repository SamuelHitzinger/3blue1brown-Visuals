# Translation revision4: complete clean motion proof

This frozen candidate follows the current user direction: 3Blue1Brown visual language, with Nucleus used for motion technique. The separate [style contract](translation-3b1b-revision4-style-contract.md) supersedes historical cellular-art matching for this candidate. Older films, source files and asset packages remain unchanged. No helper, renderer or public API changes were needed.

The complete 43-second bounded example shows assembly, Met arrival and start-codon hold, foreground Gly/CCA inspection, return to the A site, old-chain transfer to the new cargo, one-register advance, spent-adaptor exit, five further mapped additions, UAA recognition, release and subunit separation. The same seven residue identities finish as Met–Gly–Ala–Phe–Glu–Lys–Pro. UAA contributes no residue. This is an explicitly short peptide example, not a claim to show a long protein or biochemical folding prediction.

Teal identifies RNA, blue identifies carriers, white identifies peptide material, and persistent yellow selects Gly and the terminal stop notation. Open subdued subunit outlines leave the operation visible. Local serif codon, anticodon and E/P/A labels move with their referents. Foreground inspection uses a held helper clock and purposeful camera movement. Original line silhouettes and primitive geometry require no external assets, molecular surfaces, images or textures.

## Frozen delivery

Output root: `data/animlib-expansion/translation-3b1b-revision4/`.

| File | Native delivery | SHA-256 |
| --- | --- | --- |
| `translation-1280x720.mp4` | 1280×720, 43 s, 30 fps, 1290 frames | `3e9e0c7e5d329aac2aa14aad47c817f2a0ddd4212d54fbc16c1a28013c4d085e` |
| `translation-960x720.mp4` | 960×720, 43 s, 30 fps, 1290 frames | `9544e233b4ff1e1b08b9ede663827c236e920ee3a62b8ece9443528d89274c7c` |

Both films use native WebGPU, H.264/yuv420p, no audio or embedded subtitles. Full FFmpeg decodes reached all 1290 frames without errors; logs are `decode-{aspect}.log`. The source SHA-256 is `d62c1864f4403140e475ce1658768a26cd4cbe42af8072a9b3f593771abcaf70`. Sources/manifests are `translation.js` and `translation-manifest.json`. The representative 6.5-second preview, corresponding to complete-film 7.8–14.3s, remains alongside as `preview-{aspect}.mp4`.

Generator: `shared/animlib/demo/expansion/translation-3b1b-revision4-proof.mjs`. Verification: `shared/animlib/tools/verify-translation-3b1b-revision4.mjs`. Run each with Node from the repository root after building animlib. Render using `shared/animlib/tools/render-video.mjs --manifest <output-root>/translation-manifest.json --output <output-root>/translation-<aspect>.mp4 --ffmpeg data/video-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe --width <1280-or-960> --height 720 --fps 30`.

## Personally inspected evidence

The author viewed the approved-components, approved-derivative and rejected-chart-template skill images before this visual direction. Motion reference inspection covered all 31 `source-frames/nucleus-chronology/translation-playback/sheet-01..31.png` sheets: 486 actual browser captures from 158.396–224.927s. All 22 earlier complete-film 16:9 sheets in `translation-proof/motion-16x9/` were inspected, 344 samples. The earlier 4:3 motion was not inspected in its entirety during this revision.

Before full encoding, all eight new preview sheets were inspected, 104 ordered 8 fps samples across both formats, with selected native frames around the hold, docking, transfer and exit. Anticodon letters were moved away from the carrier stem, the codon visibility window was narrowed to avoid the lower arc, and site notation was lowered to leave the codon line clear. These repairs are included in the frozen films.

After full encoding, the author personally viewed every sheet in `motion/1280x720/sheet-01..22.png` and `motion/960x720/sheet-01..22.png`: 688 ordered encoded samples at 8 fps, covering both complete films. The last sheet has eight actual frames and unused black cells. Assembly, repeated traffic, product growth, stop, release and final hold remain coherent; no substantive staging defect was found by the author.

All six native contact sheets were inspected, covering 16 times in both aspects. Exact times and zero-based native indices in `translation-frames/` are:

`0:0, 1:1.3, 2:4.2, 3:7.8, 4:9.8, 5:11.1, 6:12.1, 7:12.99, 8:14.1, 9:21, 10:30.8, 11:36.8, 12:37.4, 13:39.5, 14:41.5, 15:42.9`.

Additional direct native inspection covered 960×720 indices 0, 2, 12 and 15, and 1280×720 indices 5, 9, 12 and 15. `translation-frames.json` reproduces them. Source correspondence is a sampled-motion judgment, not a claim of pixel-identical artwork or real-time reference playback.

## Technical verification and limits

Fresh focused tests passed: all four files `nucleic-translation.test.ts`, `nucleic-translation-integration.test.ts`, `nucleic-translation-independent.test.ts`, and `nucleic-translation-event-review.test.ts`, 22 tests total. The existing helper's corrected absolute event boundaries are reused unchanged.

The author verifier checked every encoded time: 1290 poses, 108 persistent element IDs, RNA anchors, carrier positions/visibility, every residue position/visibility, product link topology/endpoints, stop visibility, selected reverse seeks, and terminal bookkeeping. Maximum host/VM coordinate difference was 2.220446049250313e-16; maximum formed peptide-link length error from 0.46 was 1.8318679906315083e-15. Final state has seven incorporated visible residues, six bonds, no visible carriers, no stop cargo, released product and complete separation. Exact results and film hashes are in `evidence.json`.

The generator measured 26.3 ms compilation, a maximum serialized frame of 42,323 bytes, and 1,379.6 ms for 431 samples including serialization on this run. It uses no external assets or optical focus. These local measurements are observations, not performance guarantees. Kinetics and the bounded exact-chord product path are schematic; no collision-free carrier motion, atomistic structure, physical rate or predicted folding claim is made.

[Independent review](translation-3b1b-revision4-independent-review.md) accepted the complete films on motion, readability, current art and media gates. The reviewer inspected all 688 ordered samples, 12 complete native frames and the preview evidence, independently audited 1413 full-grid/event-boundary times with reverse hashes, and decoded both complete films. This author report is separate from that acceptance.

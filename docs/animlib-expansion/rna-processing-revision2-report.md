# RNA processing revision 2 evidence

This revision adds visible pre-cut loop formation and original cellular staging to the earlier bounded RNA processing proof. It is ready for independent review; the author does not grant its own reference-style pass. Original first films/assets and the rejected revision-2 pore orbit candidate remain unchanged.

Final films are `data/animlib-expansion/rna-processing-revision2/splice-{1280,960}x720.mp4` and `data/animlib-expansion/rna-processing-revision2/pore-cut/pore-{1280,960}x720.mp4`. Splice is 12 seconds/360 frames; pore is10 seconds/300 frames. All four use native WebGPU, H.264/yuv420p,30fps, no audio. Full frame decoding generated96 splice and80 pore samples per aspect at8fps. `evidence-final.json` records exact film SHA-256 values, every asset package/manifest hash, and ordered sheet paths/times. `evidence.json` preserves the superseded orbit candidate hashes.

## Change and contract

`nucleicSplice` now accepts optional `formation:{start,end,angle,bendDirection}`. An initially collinear bridge bends analytically at fixed material arc offsets; exons translate with its endpoints, and frames rotate continuously. Stable sinc expressions cover the straight limit. The maximum total bend is1.9π, and adjacent material samples may span at mostπ/2. The entire schedule is bounded at progress zero. Euclidean intron chord lengths change during formation; the documentation and provenance state this explicitly. After cutting, fragments are rigid. This does not model lariat chemistry, energetic forces or physical timing.

The film uses one persistent40-site diagonal strand. Formation runs1.98–5.39s, followed by a hold until the cut at6.16s. Both original boundary edges disappear then. The replacement exon edge appears only at8.03s; removed sites remain present and depart with the blue machinery. The final joined chain holds. Shape/color IDs persist, with separately colored bases and a yellow intron.

The original enzyme is a connected asymmetric Gaussian horseshoe with a true central cavity, rather than separated decorative ellipsoids. The scene contains27 enzyme context instances across three depths and four background strands. Physical camera focus differentiates foreground and background, with32 samples for splice. It reuses the transcription agent's frozen original analytic lobed nucleotide context packages; their exact hashes are recorded.

The pore membrane spans60 units with25 genuine holes, two faces, lumen walls and a gently undulating surface. Eight elongated connected orange lobes surround the main lumen; distant lower-detail pores establish its broader setting. The membrane package's legacy source-description string says “nine-tile”; the recipe,25 mesh parts,60-unit extent and README give the actual geometry. That descriptive typo is retained to preserve frozen package hashes. No source pixels or recovered meshes are assets.

The pore's241-point normal-monotone path gives a curved approach and rising emergence. One green26-site chain and its yellow site marker persist. The conservative entire-polyline swept-tube clearance, including the chain-radius expansion at slab faces, is unchanged. This particular film's straight bond segments were additionally checked in601 poses: minimum sampled radial clearance0.7940797020 units. This sampled proof does not expand the public helper's analytic guarantee to arbitrary straight rendered bonds. Constant arc-gap error was at most1.9984e-15.

The initial orbit candidate was inspected and rejected because its edge-on camera crossed a foreground pore and obscured the crossing. The final pore-cut candidate holds the exact chain pose from4.4–4.9s and cuts to the opposite side at4.65s. The pore identity, geometry and chain state remain unchanged across that cut. Transport resumes into the rising arc, finishing at9.1s. It uses16 focus samples. The earlier orbit candidate remains beside the splice outputs for comparison.

## Inspection and checks

The author genuinely viewed all12 ordered source sheets/179 browser captures, source natives034/095/113/147/153/158, and all16 first-proof sheets/256 samples plus selected native frames in both aspects. The source captures are130.419031–157.994288s; image display resized source natives to2048×1152. The Nucleus biological family takes priority over the three also-viewed mathematical explanation baseline images.

For revision2, the author viewed all22 sheets/352 samples of the first splice+orbit pair and native formation, cut, final join, approach, crossing and emergence frames in both aspects. The author then viewed all10 final pore-cut sheets/160 samples and native frames immediately before/after the cut in both aspects, plus the final4:3 emergence frame. All final22 sheets/352 samples have therefore been inspected. This is dense ordered sampled motion, not every encoded frame or real-time playback. Native frames preserve full1280×720/960×720 pixels.

Focused processing tests:16 passed, including1000-pose frame continuity, near-zero bends, phase boundaries, identities, graph changes, arc/chord value and exact quarter-turn limit, whole-schedule rejection, immutable inputs, host/QuickJS equivalence and reverse seeking. TypeScript build passed. The full serial suite passed954 tests with two fixture realpath EPERM failures in the Windows filesystem sandbox; those two tests passed on scoped escalation. No unrelated changes were made for those environment failures.

The proof verifier checks601 poses per operation for stable IDs and ordered topology, plus path arc gaps and sampled rendered-link clearance. Retained scene reverse sampling is byte-identical. Latest compilation/sample measurements: splice119.6ms and1476.2ms for121 samples including serialization; pore-cut102.7ms and1054.6ms. Largest serialized frames are215116/175036 bytes,322/278 elements. Registry decoded20,353,536 bytes; splice pinned4,413,952 and pore15,939,584. These are local host measurements, not browser realtime performance promises.

## Reproduction

Build animlib, prepare frozen transcription revision2 assets if absent, then run `node shared/animlib/tools/prepare-rna-processing-revision2-assets.mjs`. Generate each proof with `node shared/animlib/demo/expansion/rna-processing-revision2-proof.mjs splice` or `pore`. The latter writes under `pore-cut/`. Use `render-frames.mjs` on the corresponding frame JSON; use `render-video.mjs` on each manifest with width1280 or960, height720 andfps30. Extract ordered full-duration8fps frames and4×4 contact sheets. Finally run `node shared/animlib/tools/verify-rna-processing-revision2.mjs`. Windows TEMP/TMP for this worker is `data/animlib-expansion/tmp-rna-revision`; local asset realpath/render operations required scoped sandbox escalation.

Remaining fidelity differences include illustrative molecular anatomy, a deliberately simple two-enzyme choreography, authored timing, evenly repeated distant pores, and the purposeful opposite-side camera cut. They remain visible differences for independent judgment; schematic labels are not a waiver of the source-style gate.


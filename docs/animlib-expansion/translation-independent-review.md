# Independent translation review

Reviewed 2026-10-11 on branch `amilibsam`. Production code, demo, assets, and frozen films were not edited during this review. This evaluation applies to the frozen candidate in `data/animlib-expansion/translation-proof/frozen-hashes.json`.

**Decision: retain the helper as technically ready within its documented schematic scope; revise the film before claiming source-style fidelity.** The independent reviewer agrees with the author's style rejection, based on direct inspection rather than the author's verdict.

| Gate | Verdict | Reason |
| --- | --- | --- |
| Reasoning | READY within stated scope | Assembly, triplet matching, persistent product transfer, one-codon progression, spent-carrier exit, stop, release, and separation remain traceable. Seven residues are explicitly identified as a peptide. |
| Visual readability | READY at reviewed native sizes, with refinements | Active matching/transfer and the final result are legible in both aspects. Context labels are small, and foreground emphasis should improve with the style repair. |
| Reference style | REVISE | Primitive molecular silhouettes, nearly fixed frontal composition, exposed rigid tunnel, and short regular product differ substantially from the source's sculpted, oblique, spatially accumulating sequence. |
| Technical delivery | READY for the bounded checks below | All 16 targeted tests pass; both final encodes decode completely with expected duration, dimensions, and frame counts. This is not a claim that the entire repository or native GPU suite passes. |

## Direct evidence inspected

The actual reference is [Nucleus translation](https://www.youtube.com/watch?v=LCIkd-WwC7o&t=158s). The 3Blue1Brown explanation-style skill, its visual baseline and review gate, and its three bundled calibration images were read/viewed as review discipline; Nucleus determines this biological film's appearance.

I independently viewed **all 31 ordered reference sheets**, containing all **486 captured frames** from source time **158.396359–224.926951 s**, in `data/animlib-expansion/source-frames/nucleus-chronology/translation-playback`. Their metadata records actual browser playback (`readyState: 4`, `paused: false`), rather than seek-placeholder frames. I also inspected source frames `110.jpg`, `208.jpg`, and `362.jpg` at large size. The originals are 2195×1235; the image tool displayed these at 2048×1152. This was dense ordered motion sampling, not a claim that I independently played the source continuously in real time.

I independently viewed **all 44 candidate sheets**: `motion-16x9/sheet-01.png` through `sheet-22.png` and `motion-4x3/sheet-01.png` through `sheet-22.png`. These cover **688 samples, 344 per aspect**, at 8 fps over the complete 43-second film. Blank cells on the final sheet are sheet padding. Selected original native render frames covered assembly, the foreground carrier, paired transfer, late elongation, stop/release, and separation in both aspects.

To check the delivered artifact itself, I then freshly extracted and viewed **eight native frames from the frozen MP4s**, at **8.5, 12.1, 36.8, and 42.9 s in each aspect**. They are retained as `data/animlib-expansion/tmp-translation-review/encoded-{16x9,4x3}-{time}.png`. A possible touching-letter concern in a pre-encode sample did **not** reproduce in these final encoded frames and is not reported as a defect.

## Required style repairs

These are visible differences from the requested reference, not biological correctness objections.

| Priority | Source evidence | Candidate evidence | Actionable repair |
| --- | --- | --- | --- |
| 1 | [184–191 s](https://www.youtube.com/watch?v=LCIkd-WwC7o&t=184s), especially frame 208 at 186.549 s: the incoming adaptor has an asymmetric branched/lobed body with strong surface relief. Its sharp green form separates from desaturated, softly blurred context. | 7.2–10.3 s, native encoded 8.5 s: the adaptor reads as a smooth bent sausage; the rear carrier and brown ribosome retain considerable visual weight. | Replace the original adaptor scaffold with a deliberately asymmetric, branched, rounded sculpture. Preserve the anticodon/payload anchors. During the close-up, desaturate and soften the background complex, and use depth staging so only the incoming adaptor owns attention. |
| 1 | [191–206 s](https://www.youtube.com/watch?v=LCIkd-WwC7o&t=191s): an oblique rotating cutaway reveals depth relationships between carriers, RNA, tunnel, and emerging chain. | 10.3–36 s, native encoded 12.1 s: the camera returns to almost the same frontal composition and stays there through repeated cycles. Incoming traffic crosses the active foreground chiefly in screen space. | Continue the close-up exit into an oblique three-quarter cutaway; stage entry/exit through depth and animate a measured camera orbit. Verify that both anticodons and the transferred chain remain unobscured throughout the orbit. |
| 1 | [177–206 s](https://www.youtube.com/watch?v=LCIkd-WwC7o&t=177s): irregular lobed ribosome, with a diagonal translucent conduit integrated into its volume. | Cutaway through late elongation: squat arch/bean silhouettes and a straight vertical U-channel with parallel hard edges visibly projecting above the shell. | Resculpt the large subunit's asymmetry and recesses. Integrate a rounded, angled tunnel into the shell instead of leaving an exposed architectural channel. Keep its opening legible through controlled opacity. |
| 2 | [200–219 s](https://www.youtube.com/watch?v=LCIkd-WwC7o&t=200s), especially frame 362 at 207.986 s: many accumulated beads form a substantial irregular protein mass, followed by a conspicuous release. | 30.9–42.9 s: seven residues make a short regular helix; release is clear but has much less accumulated mass or spatial payoff. | Decide explicitly whether the final film will retain the seven-residue teaching example or show a longer sequence. For near-source fidelity, use additional real incorporated residues and an irregular bounded product path, preserving every ID/bond. Do not silently inflate the seven-residue peptide into a protein-sized mass. |
| 2 | The reference uses local sans-serif labels and selective triplet emphasis. | Serif type, many continuously visible individual base letters, and small subunit/mRNA context labels compete with the molecular rendering. | Specify a sans-serif family, reduce persistent base labels outside the active triplet, and size referent labels for 720p delivery. Preserve codon/anticodon orientation and native readability in both aspects. |
| 3 | Background complexes vary with spatial context and remain subordinate. | Three dark copies of the same silhouette are recognizable as repeated backdrop shapes. | Vary orientation/depth or reduce them further after the foreground geometry and camera are fixed. |

**Next highest-value repair:** make one original **5–8 second foreground-adaptor-to-oblique-transfer proof** before rerendering the entire film. It should combine the revised asymmetric adaptor, subdued background, integrated rounded tunnel, and actual camera transition. Render both aspects, inspect its entire ordered motion and native close-up/transfer frames, then obtain independent style acceptance for that segment. Palette or glow changes alone cannot address the current rejection.

Readability observations do not independently block the current technical demonstration: active pairing, transfer, stop bracket, released peptide, and separated subunits stay identifiable. The 4:3 frame crops some entering/spent carriers at the left edge, but retains the active pair and final result. Context type is small at 720p and should be enlarged during the revision.

## Independent technical checks

Added `shared/animlib/test/nucleic-translation-independent.test.ts`, leaving production untouched. Fresh command:

```powershell
$env:TEMP=(Resolve-Path data/animlib-expansion/tmp-translation-review).Path
$env:TMP=$env:TEMP
npm test --workspace animlib -- --run test/nucleic-translation.test.ts test/nucleic-translation-integration.test.ts test/nucleic-translation-independent.test.ts
```

Result: **3 files, 16 tests passed**, including five new independent cases. Existing tests exercise A/P/E event timing, product topology, release/disassembly, and public integration. Added coverage independently checks:

- All 61 sense codons against separately grouped standard assignments, wrong cargo rejection for each, and all three stop codons. The independent primary reference was [NCBI standard genetic code table 1](https://www.ncbi.nlm.nih.gov/Taxonomy/Utils/wprintgc.cgi#SG1). The source film's displayed ACG/Gly pairing is not copied: this demo correctly uses GGU/Gly with CCA anticodon.
- Complete host/QuickJS outputs at 74 absolute times, including exact event boundaries and adjacent samples, then exact reverse-order resampling inside each engine.
- 801 poses in a rotated, translated coordinate frame: formed peptide bonds retain 0.5-unit length, carrier frames remain orthonormal, and an attached product's latest residue coincides with its carrier payload.
- Maximum permitted 192-base/63-residue input with extreme allowed geometry, tested before, during, and after the schedule: finite output and coordinates below 250,000 absolute units for this adversarial case. This does not claim every output coordinate is limited to the 1,000-unit input-vector limit.
- Sparse arrays/vectors, duplicate IDs, malformed bases/orientations, zero/parallel frame vectors, missing assembly, impossible coil geometry, invalid or overflowing schedules, invalid scalar values, and nonfinite evaluation times, including validation before the animation starts.

The first new cross-engine run used strict numeric equality and exposed only approximately **2×10⁻¹⁶** differences in normalized frame components, consistent with host/QuickJS floating-point `Math.hypot` evaluation. With the parent's explicit approval, cross-engine numeric leaves use an absolute **1×10⁻¹¹** tolerance. Object keys, strings, flags, phases, IDs, topology and other nonnumeric values remain exact; repeated/reverse evaluation remains exact **within each engine**. No production behavior was changed to satisfy the test.

Fresh SHA-256 comparison matched all **14 frozen entries**. Film hashes:

- 16:9 `film.mp4`: `edd86250ae5d69f30a9bd6565ebbd1670794d55c11dfe052bbdaf459fec63dc2`
- 4:3 `film-4x3.mp4`: `b21447ac0e95dd9b717d859157264843f033d242b7873c6755c08bed73964152`

Both final files were independently decoded completely using the local FFmpeg 7.1 binary. Both exited 0: **1290 frames, 43 seconds, 30 fps, H.264 High/yuv420p**, respectively **1280×720** and **960×720**, with no audio stream and no reported decode errors. Logs are retained as `data/animlib-expansion/tmp-translation-review/decode-16x9.log` and `decode-4x3.log`.

The helper remains a deterministic explanatory schematic: fixed peptide chord lengths and persistent identities do not make it molecular dynamics, catalytic chemistry, a release-factor structure, wobble modeling, or an atomically accurate ribosome. RNA curvature is a layout model. No production defect was established in this bounded review. I did not independently rerun the full build or the complete native GPU suite; the two previously known exact-4×MSAA parity baseline failures must remain disclosed separately.

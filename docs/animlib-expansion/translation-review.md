# Translation candidate 2 — author inspection

This is an author review, not independent acceptance. Nucleus remains the actual reference; the 3Blue1Brown skill supplies the inspection workflow only. The reusable helper is delivered separately from the fidelity judgment.

## Source inspection

Before design, personally inspected all 31 ordered source sheets comprising 486 genuine browser captures from 158.396–224.927 seconds of Nucleus's translation passage, plus native captures 110, 208, 267, 362, 438 and 479. The source report is `nucleus-processing-motion-supplement.md`; the captures are under `data/animlib-expansion/source-frames/nucleus-chronology/translation-playback`. Native 208 was revisited during the foreground-adaptor revision. No reference pixels or extracted meshes are used in the output.

## Candidate and boundaries

Generator: `shared/animlib/demo/expansion/translation-proof.mjs`. Output: `data/animlib-expansion/translation-proof`. First version preserved separately in `translation-proof-v1`.

The 43-second scene uses AUG GGU GCU UUU GAA AAA CCG UAA, mapping to Met, Gly, Ala, Phe, Glu, Lys, Pro and a terminal stop. The standard code is [NCBI table 1](https://www.ncbi.nlm.nih.gov/Taxonomy/Utils/wprintgc.cgi#SG1). The source's ACG/Gly labeling is not used as chemical truth. Anticodons are written 3′→5′ against 5′→3′ RNA.

Seven carrier and product identities persist. There are simultaneous A/P occupants, old-chain transfer, one-codon translocation, spent-carrier exit, a growing same-ID product, stop recognition without a residue, product release and subunit separation. A 2.5-second scene-clock hold at helper time 7.8 seconds supports the foreground Gly close-up. The helper remains a pure absolute-time evaluator.

The ribosome and adaptor are original Gaussian scaffold envelopes. An original posterior half-conduit has explicit inner and outer walls and open half-annular rims. The anterior half is removed for cutaway visibility. The product follows prescribed exact-chord helix anchors; it is not a predicted fold or an atomistic chain constrained by the conduit. During transfer the chain moves between the A/P sites; no physical tunnel-constrained simulation is claimed.

## Native frame inspection

Personally inspected all six native contact sheets and native frames for initiation, foreground Gly, paired carriers, transfer, accumulated product, stop and final release. Both 1280×720 and 960×720 were checked. Frame times: 0, 1.3, 2.6, 4.3, 7.5, 8.5, 10.2, 11.8, 12.1, 13.15, 16.6, 30.9, 36.8, 38, 39.8 and 42.9 seconds.

Corrected during this inspection: reversed conduit winding, excessive background opacity, close-up anticodon-label association, hidden codon brackets, bracket-label overlap, and the final 4:3 camera framing. Native optical focus uses 32 samples only during the foreground camera passage. It visibly softens the P-site carrier and ribosome behind the incoming Gly carrier.

## Complete encoded-motion inspection

Both native films completed and fully decoded: 43 seconds, 1290 frames, 30 fps, H.264/yuv420p, no audio. Personally inspected **every ordered sheet 01–22 in each aspect ratio**, 344 samples per movie at 8 fps covering the full 0–43 second interval. The last sheet's empty lower cells are tile padding, not black movie frames. This is dense ordered-frame inspection, not a claim of real-time playback.

Observed continuous assembly and cutaway (0–4 s), a stable initial-product reading hold (4–7 s), foreground arrival and focus/reading hold (7.2–10.3 s), return and paired transfer (10.3–12.5 s), repeated carrier transfer/advance/exit with conserved growing product (12.5–36 s), stop recognition (36.3–37.4 s), product departure (37.4–39.4 s), and separation/final hold (39.4–43 s). The 4:3 crop admits entering carriers at the edge but retains the active pair, codon guides, released product and final subunits. No sequence reset, extra stop residue, lost product or encode glitch was observed. Native frames established text and optical-focus readability beyond the reduced sheets.

Frozen SHA-256:

| File | SHA-256 |
|---|---|
| translation.js | `f2a4818b16a5cef21065230a5676a635c6feb6ceb4bcd2183920e25d3b0045bf` |
| film.mp4, 1280×720 | `edd86250ae5d69f30a9bd6565ebbd1670794d55c11dfe052bbdaf459fec63dc2` |
| film-4x3.mp4, 960×720 | `b21447ac0e95dd9b717d859157264843f033d242b7873c6755c08bed73964152` |

`frozen-hashes.json` in the proof directory also records helper, type, test, generator, preparer and all five asset-manifest hashes. Complete decode logs and ordered sheets are alongside the films.

## Verification

At 03:19:28 on 2026-10-11, direct plus integration suites passed: 11 tests across two files. Build passed after the productCoil change. Coverage includes preflight bounds, dense arrays, unique identities, standard-code cargo and complementary anticodons, all three stops, no internal stops, every event boundary, dense complete schedules, exact formed peptide-edge lengths, unit carrier frames, reverse seeks, nonmutation and self-contained factory evaluation. The seven-residue coil is checked at 801 dense poses and every cycle event.

The native QuickJS proof compiled in 103.3 ms; 431 samples plus serialization took 5532.8 ms. Maximum serialized frame was 153,678 bytes across 155 elements. Source is 7,953 characters; five immutable asset manifests decode to 5,235,712 bytes. Reverse seek was exact. These timings are one local measurement, not a general performance guarantee.

## Author verdicts

- Reasoning: **ready within the declared schematic scope**. Each product residue comes from a valid sense codon, the stop adds none, and the same product survives transfer and release.
- Visual readability: **ready for independent review**. The foreground hold exposes cargo and anticodon; paired-site transfer and subsequent exit remain readable; start/stop brackets and final product stay visible in both formats.
- Reference style: **revise**. The reference has finer lobed surface relief, softer luminous material, desaturated close-up context and a much larger accumulated protein. Our cutaway conduit is visibly more geometric. The added lobes, close-up and original depth context improve the source-family resemblance but do not establish near-identical fidelity.
- Technical delivery: **ready**. Both silent native formats encoded and fully decoded, all 44 ordered motion sheets were inspected, and the candidate is frozen by hashes.

The independent reviewer should inspect actual motion before accepting any temporal or reference-fidelity claim. No independent verdict is represented here.

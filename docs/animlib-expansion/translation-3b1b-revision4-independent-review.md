# Translation revision 4 — independent complete-cycle review

Reviewed 2026-10-11. Verdict: **accept the frozen complete 43-second proof** for the current [unified 3Blue1Brown direction](unified-3b1b-direction.md). This acceptance covers the bounded seven-residue example and its reusable motion techniques. It does not claim exhaustive source-channel capability or physical molecular simulation. No production source or frozen media was changed by the reviewer.

| Gate | Verdict | Evidence and scope |
| --- | --- | --- |
| Motion and correctness | Pass | Assembly, arrival, codon/anticodon read hold, chain transfer, register advance, spent-carrier exit, repeated growth, stop, release and separation remain causally ordered. Seven identities and six final links persist; UAA adds no cargo. |
| Reasoning and readability | Pass | The foreground Gly inspection establishes the local correspondence before repetition. The selected residue stays yellow in the growing and released product. Open subunit contours leave the operation visible in both aspects. |
| Current 3Blue1Brown art | Pass | Near-black world, restrained semantic teal/blue/white/yellow, clean lines and local serif notation form a coherent schematic presentation. No chart template or molecular sculpture is needed. |
| Technical and media | Pass | Independent 1413-time audit, exact reverse frame hashes, 22 focused tests, matched frozen hashes and complete 1290-frame decodes of both films. |

## Personally inspected evidence

I read the complete generator, repaired translation helper, style contract and author report. The approved-components, approved-derivative and rejected-chart-template baseline images were personally viewed during this review cycle, alongside the explanation-style review gate. The biological references guide motion; their realism is not the current visual acceptance target.

I personally inspected **all 44 final ordered sheets / 688 encoded samples**, covering every part of both films at 8 fps: `data/animlib-expansion/translation-3b1b-revision4/motion/{1280x720,960x720}/sheet-01..22.png`. The last sheet in each aspect contains eight actual samples and unused black cells. This is dense ordered still-sequence inspection, not uninterrupted realtime playback. I also inspected all eight representative preview sheets / 104 samples and eight preview natives around inspection, docking, transfer and departure.

Complete-film native inspection covered indices 2, 10, 12, 13 and 15 in both aspects, plus indices 1 and 5 at 960×720, under `translation-frames/`: 12 full native images. These correspond to 4.2, 30.8, 37.4, 39.5 and 42.9 seconds in both sizes, plus 1.3 and 11.1 seconds at 960×720. Local labels, late peptide visibility, stop notation and released product remain readable. RNA context extends offscreen while the active operation and product remain framed. Transient projected carrier crossings during arrival do not conceal the subsequent separated pairing/transfer holds. This proof does not establish collision-free trajectories.

The motion comparison reuses my earlier personal inspection of all 31 actual Nucleus translation-playback sheets / 486 captures (approximately 158.396–224.927 seconds), with the source chronology/native comparisons recorded in [the earlier independent review](translation-revision3-independent-review.md). I also freshly viewed translation-playback images 180, 185 and 190 during this cycle. The new proof retains inspection → pairing → transfer → advance → empty exit and release/separation techniques. It does not reproduce the source's long molecular product, optical effects, cellular materials or literal timings. Those art differences are outside the changed target, rather than retrospectively repaired in historical films.

## Independent technical checks

The reviewer audit is `data/tmp-review-peptide-transcription/translation-r4-audit.mjs`, with results in the adjacent JSON. It evaluates 1413 unique times: the complete 30 fps grid including the terminal endpoint, plus absolute phase boundaries and adjacent floating-point times. It checks the actual generated native elements against the host helper, not only helper internals.

All 108 element IDs remain stable. RNA anchor and bond endpoints, seven carrier positions/visibility and anticodon strings, seven residue positions/visibility, all six possible product-link endpoints and visibility, eight codon labels, and stop visibility match their corresponding helper state. Gly stays yellow and the other peptide residues stay white. Maximum native coordinate discrepancy is 2.220446049250313e-16; maximum formed product-link length error is 1.8318679906315083e-15. Full serialized frame hashes are exactly equal on reverse resampling at every audited time. The held Gly geometry is bitwise identical at 7.8, 8.3, 9.2 and 10.299 seconds; the release boundary is included in the tolerance audit. The final state has seven retained residues, six links, no stop cargo, released product and complete separation.

Fresh focused runs passed all **22 tests** in `nucleic-translation.test.ts`, `nucleic-translation-integration.test.ts`, `nucleic-translation-independent.test.ts` and `nucleic-translation-event-review.test.ts`. These include the earlier independent exact-event regressions and host/VM comparisons, reverse sampling, mapped codons and malformed-input checks. The helper's absolute-event repair is already documented separately in the historical review; this proof uses that repaired helper. Acceptance is not inferred merely from those numerical tests: the full new visual sequence was inspected independently as described above.

## Frozen media

I independently hashed the two actual films and generated source, then decoded every frame using the repository FFmpeg binary. Both decodes reached `frame=1290`, `out_time=00:00:43.000000`, `progress=end` without errors. Reviewer progress logs are `data/tmp-review-peptide-transcription/translation-r4-decode-{1280,960}.txt`. Native delivery is 1280×720 or 960×720, 30 fps, H.264/yuv420p, silent.

| Frozen file | SHA-256 |
| --- | --- |
| `translation-1280x720.mp4` | `3e9e0c7e5d329aac2aa14aad47c817f2a0ddd4212d54fbc16c1a28013c4d085e` |
| `translation-960x720.mp4` | `9544e233b4ff1e1b08b9ede663827c236e920ee3a62b8ece9443528d89274c7c` |
| `translation.js` | `d62c1864f4403140e475ce1658768a26cd4cbe42af8072a9b3f593771abcaf70` |

No blocking finding remains within this bounded motion/readability/art/media scope. The illustrative exact-chord peptide path, schematic subunit contours and timing should continue to be described as explanatory staging, not atomistic geometry, biochemical kinetics or predicted protein folding.

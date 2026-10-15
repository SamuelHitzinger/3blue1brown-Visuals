# Diagram-led notes refinement

User requested more explanation in diagrams, less repeated text, wider use of the page, stronger visual connections, no repeated edit labels, and another chemistry regeneration.

## Implementation

- Notes fill available app width, with a 1480px outer maximum. Diagram groups lead with figures (62% on wide paper), followed by compact supporting text and equations. A shared heading and subtle rail connect the two; mobile keeps the same reading order.
- Text-only groups pair across the page. An unmatched group spans the row; contiguous leading equations can sit beside trailing definitions without reordering or splitting a derivation.
- Repeated visible edit footers are removed. Accessible 40px pencil controls retain explicit editing, drafts, save/cancel/reset, and figures during edits.
- Synthesis plans the explanatory construction first and deletes prose that merely narrates it. Necessary calculations, units, conditions and caveats remain once. Self-contained static figures may have an empty explanation caption.
- Full rewrites receive prior ID/topic metadata, exact valid questions and full protected edit anchors. They no longer receive all unedited prior prose/diagram geometry as a template. Incremental updates remain unchanged. Validation still uses original prior notes for protected anchors, questions and legacy compatibility.
- Diagram guidance requires actual supported states/objects/species and values beside the corresponding arrow or state, rather than generic placeholders requiring a parallel prose list.

## Validation

- 33 focused backend tests / 173 assertions passed; backend TypeScript passed.
- 11 focused frontend document tests and frontend TypeScript passed. Leading equations can share a row with trailing notes, caveats and relations; later equation/math content prevents splitting.
- Final app build passed.
- Browser regressions were red on prior builds and green after changes. Checks include editing access, no repeated edit labels or footers, full page width, diagram-first order, unpaired formula rows, exact questions, saved overrides, retained figures, label readability and no viewport overflow.
- Final actual chemistry render/source review passed; no material blocker. Desktop/phone captures have no detected text-label collisions or document overflow. Wide diagrams retain local horizontal scrolling on small screens to preserve readable labels.

## Baseline and review method

Baseline is the previous compact version, saved from the live app before this task: 100 sources, three exact questions, seven sections, 43 points and 326 point words. At 1440px desktop, generated content is 994px wide and 3479px high; at 393px phone it is 307px wide and 4671px high.

Independent review checks source fidelity across the diagram and its companion text, not a requirement to repeat every fact in both. It specifically checks the third-law conditions, supported propane pathway without an invented total, the 298 K ammonia calculations and the system/universe distinction. An intermediate regeneration was rejected for inheriting a generic Hess figure with an ambiguous step-label position; that finding led to the rewrite-context change above. A subsequent candidate restored the Hess species/path but replaced a meaningful entropy magnitude comparison with a heat-flow graphic and a verbal assertion. The final prompt explicitly requires representative objects for count/arrangement contrasts and common-zero, common-scale contributions/net construction for opposing magnitudes. A transfer arrow or caption cannot substitute for that geometric evidence.

## Final regenerated result

| Measure | Previous compact version | Diagram-led version |
| --- | ---: | ---: |
| Sections | 7 | 5 |
| Points | 43 | 23 |
| Point words | 326 | 172 (47% less) |
| Figures | 3 | 3 |
| Desktop content width | 994px | 1246px (25% wider) |
| Desktop content height | 3479px | 2309px (34% less) |
| Phone content height | 4671px | 2913px (38% less) |

Heights exclude questions, measured at the same 1440px desktop and 393px phone viewports. Point-word counts exclude diagram labels, captions and equation labels: some reasoning deliberately moved into figures. Body and diagram fonts were not shrunk. Comparison screenshots use the same display scale.

The final regeneration completed in 164 seconds, with three provider calls and two validation-recovery attempts. All 100 source objects were unchanged throughout generation; the lecture remains unfinished. Three assigned questions are identical to the baseline.

The diagrams now carry substantive explanation:

- Hess: actual chemical states on enthalpy levels, the intermediate, supported +103.85/−1181 kJ steps, and water formation. No unsupported final numerical total.
- Gas arrangements: four independently positioned representative molecules versus two in equal volumes, connected to the reaction and entropy decrease.
- Entropy balance: common-zero arrows with lengths proportional to −199, +310 and +111 (0.65 SVG units per J mol⁻¹ K⁻¹). The positive result and spontaneity follow visibly; separate companion equations retain the surroundings calculation.

Critical chemistry and conditions were preserved, including the pure perfect crystal at 0 K and the 298 K ammonia substitution. This is not exhaustive transcript preservation: the brief calorimetry definition in the prior version was omitted. No material factual or visual blocker remained in the independent review.

Comparison exported to `exports/chemistry-notes-visual-comparison/index.html` and served at `/static/review/chemistry-notes-visual-comparison/index.html`. Both screen-size buttons and all four comparison images passed browser verification. Detailed snapshots, rejected intermediate candidates, screenshots and logs remain in `.tmp/notes-visual-v2/`.

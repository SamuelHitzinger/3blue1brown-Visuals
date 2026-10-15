# Generated notes reference audit

The main gap is composition: short fragments still occupy large, separate containers, while diagrams often repeat those fragments. Better notes put a meaningful visual, its equation, and its conditions together. The visual should carry part of the explanation and let redundant prose disappear.

## Evidence and scope

Five focused subagents covered math references, engineering references, current generation/rendering, visual capabilities, and an independent synthesis check. The main review covered science/medicine references and checked representative findings. Archive inventory: 439 files, including 392 PDFs. Visual sample: 54 distinct pages across 23 PDFs, with document types kept separate. This is representative sampling, not an exhaustive review or scientific correctness certification.

Reference files and page renders remain local under `.tmp/notes-audit/`. Document instructions and links were treated as source material. No production code was changed by this audit.

Current-output evidence is the saved captured session `.tmp/chemistry-after-regeneration.json`, dated 15 October 2026 (notes format version 3), rather than a fresh live database read or a new generation with the current code. Its 100 source chunks became **41 points, 297 point words, 13 groups, 7 sections, and 3 static diagrams**. Longest point: 13 words. No selected photos or generated animations/interactives in that snapshot. Those counts do not imply every section needs a visual or animation.

## What strong references do

| Pattern | Specific reference evidence | Transfer to our notes |
| --- | --- | --- |
| Geometry explains an equation | Analysis I Mitschrift, PDF p106: shaded integration region, marked angular bounds, and local arc-length triangle | Draw the quantities and assumptions used by the equation; keep them adjacent |
| Linked views explain a relationship | Analysis II Mitschrift, p3: 2D cross-section, hemisphere, and special level-set cases | Coordinate views with shared symbols and colors; preserve limiting cases |
| Aligned plots reveal cause and response | Mechanik II Theorieskript, p5: loading, shear, and bending moment | Use small comparable panels with aligned axes instead of isolated pictures |
| Intermediate transformation earns the result | Mechanik II Theorieskript, p31: moment decomposition → stress components → summed formula | Show the missing reasoning step, not only an object and final caption |
| Mechanism and behavior complement each other | Satushev medicine notes, p76: spring/dashpot model, equation, loading and response curves | Let each representation answer a different question |
| Local diagrams replace repeated descriptions | Stochastics/ML summary, pp2,7: set comparisons, distributions, algorithm structures | Borrow small comparisons, direct labels, and visual grouping |

The references are not uniformly good. Some contain long prose, tiny labels, excessive highlighting, large margins, or export defects. The best principle is **high explanatory value per unit of space at a readable size**.

### Document types matter

- **Lecture and explanatory notes:** primary models for explanation, conditions, and diagram placement. Includes handwritten lecture notes and tutorial theory scripts; an exercise-session header does not automatically make a document a problem set.
- **Summaries and formula collections:** secondary models for compact comparisons and retrieval. Many are A3 landscape with four columns. Their type size and page density are unsuitable as default screen layouts. The finite-element summary still contains useful explanations; classification cannot rely on filenames alone.
- **Problem sets and solutions:** controls only. Bioengineering Problem Set 10 p1 contains answer boxes; Problem Set 6 Solutions p2 preserves exercise/answer structure. Neither is a learning-note layout benchmark. Keep assigned questions separate and preserve their wording.

## What our notes currently lack

| Priority | Observed gap | Evidence | Concrete change |
| --- | --- | --- | --- |
| 1 | Repeated meaning across points, captions, and drawings | Chemistry Hess-law ordering and entropy/heat sections repeat relationships already drawn | Compose text and visual together; retain equations, conditions, and interpretation, remove duplicate narration |
| 1 | Space spent on containers around tiny fragments | `frontend/app/src/lecture-notebook.css:17,23,103,107`: group gaps, equation padding, padded relation nodes; 13 groups add 364px of vertical group padding alone on desktop | Reduce nested cards and routine margins before shrinking text; reserve emphasis for results and caveats |
| 1 | Diagrams attached only to whole sections | `frontend/app/src/LecturePage.tsx:75-77`; CSS `:36,101`: all section text precedes block figures | Anchor figures to the specific group/claim; place beside it when readable, immediately after it on narrow screens |
| 1 | Deterministic duplicate sketch caption | `backend/src/agents/lecture-wire.ts:61` assigns caption to both title and explanation; `LecturePage.tsx:100` renders both | Display identical title/caption once. This affects the compact incremental sketch path, not every concept |
| 2 | Static visuals favor simple recognition over visible reasoning | Chemistry particle drawing shows four versus two dots; heat sketch shows direction and numbers without visually comparing loss/gain | Select the actual explanatory question; use comparisons, geometry, transformations, or source crops that answer it |
| 2 | Static rendering has weak quality gates | `backend/src/agents/lecture-diagram.ts:7-38` validates schema/bounds; static diagrams lack the rendered review used for rich visuals | Check labels, collisions, units, source fidelity, and whether the intended relationship is visible at final display size |
| 2 | Narrow static vocabulary | `shared/lecture.ts` and `frontend/app/src/LectureDiagram.tsx:30-42`: text, lines, circles, rectangles on fixed 600×340 canvas | Add targeted support for curves/plots, shaded regions and aligned comparisons, or route to existing richer rendering/source-photo support |
| 2 | Finished notes can retain incremental fragmentation | `backend/src/lectures.ts:460-472`: finishing processes outstanding sources; caught-up manual regeneration requests rewrite | Add a final editorial consolidation that preserves source references, conditions, questions, and user edits |

The synthesis prompt already requests concise content and useful visuals. It enforces 18 words per point and 12 per visual caption (`backend/src/agents/lecture.ts:177-184`). Another generic “be concise” instruction will not address these structural issues.

The chemistry improvements do not require a new renderer: existing lines and rectangles can already show a signed entropy comparison. Its three diagrams use 13, 12, and 9 elements, below the 50-element limit; three concepts are below the 12-concept limit. Curves, filled arbitrary regions, mathematical figure labels, and compact semantic tables are separate capability improvements for broader subjects.

Animation and interaction already exist. Only the first newly discovered nonstatic concept per update is automatically generated (`backend/src/lectures.ts:242-245`); others require deliberate requests. Review selection and scheduling where motion or manipulation adds understanding. Increasing animation count is not a useful objective by itself.

## Concrete chemistry restructuring

The current reaction-entropy, spontaneity, and surroundings-entropy sections contain 19 points. One taught example spans all three. A more coherent arrangement would keep the general entropy rules together, then present the ammonia example as one compact visual explanation:

| Example component | Keep visible |
| --- | --- |
| Context | Reaction, 298 K, constant-pressure condition for the heat/enthalpy substitution, and units |
| Calculation | A compact equation sequence retaining stoichiometric weighting and the relevant substitutions |
| Visual comparison | Signed entropy contributions on a common scale: system −199, surroundings +310, total +111 J mol⁻¹ K⁻¹ |
| Interpretation | Total entropy increases despite the system's decrease |

The comparison would replace separate prose announcing heat direction, repeating the two values, and restating the same conclusion. Keep the general rule and necessary conditions. A particle-count sketch can illustrate this particular taught example, but must not imply that particle count alone universally determines entropy. A signed contribution plot illustrates the numerical balance; it does not itself explain microscopic entropy.

## Acceptance criteria for a revision

1. Every kept line adds a definition, condition, equation, reasoning step, result, or caveat. Repeated meaning across labels, captions, and prose is removed unless comparison requires it.
2. Every visual answers a named question that is harder to understand from the remaining text alone. No image quota and no decorative diagrams.
3. Related figure, symbols, equation, and interpretation remain locally connected. Mobile reading order preserves that connection.
4. Diagrams preserve supported topology, directions, labels, units, assumptions, and uncertainty. New representations must stay grounded in the same evidence.
5. Compare before/after viewport height for the same taught content, with body text and diagram labels still readable. Do not claim a percentage saving until measured.
6. Review actual rendered static diagrams at desktop and phone sizes. Passing JSON validation is insufficient.
7. A finished-note pass consolidates repeated concepts without losing citations, user edits, or exact assigned questions.

## Sample coverage

All page references are 1-based PDF pages. Source IDs below map to exact archive and extracted paths in `.tmp/notes-audit/sources.json`.

| Source ID | Document | Pages inspected |
| --- | --- | --- |
| 435 | [Analysis I Mitschrift](<C:/Users/samue/Stuff/3yellow3white/.tmp/notes-audit/sources/435-ETH Analysis I Mitschrift (HS22).pdf>) | 3, 53, 106 |
| 436 | [Analysis II Mitschrift](<C:/Users/samue/Stuff/3yellow3white/.tmp/notes-audit/sources/436-ETH Analysis II Mitschrift (FS23).pdf>) | 3, 52, 105 |
| 192 | [Linear Algebra I lecture recaps](<C:/Users/samue/Stuff/3yellow3white/.tmp/notes-audit/sources/192-ETH Lineare Algebra I Vorlesungsrésumés.pdf>) | 3, 40, 81 |
| 377 | [Linear Algebra II lecture recaps](<C:/Users/samue/Stuff/3yellow3white/.tmp/notes-audit/sources/377-ETH Lineare Algebra II Vorlesungsrésumés.pdf>) | 3, 51, 103 |
| 183 | [Analysis I summary](<C:/Users/samue/Stuff/3yellow3white/.tmp/notes-audit/sources/183-ETH Analysis I Zusammenfassung (Max Schaldach, DE).pdf>) | 2, 3, 4 |
| 405 | [Analysis II summary](<C:/Users/samue/Stuff/3yellow3white/.tmp/notes-audit/sources/405-ETH Analysis II Zusammenfassung (Max Schaldach, DE).pdf>) | 6, 7, 8 |
| 42 | [Linear Algebra I and II summary](<C:/Users/samue/Stuff/3yellow3white/.tmp/notes-audit/sources/42-ETH Lineare Algebra I & II Zusammenfassung (Robin Frauenfelder).pdf>) | 2, 3, 4 |
| 404 | [Mechanik I Mitschrift](<C:/Users/samue/Stuff/3yellow3white/.tmp/notes-audit/sources/404-ETH Mechanik I Mitschrift (Michał Skórnik, HS20).pdf>) | 7, 25, 97 |
| 434 | [Mechanik I Theorieskript](<C:/Users/samue/Stuff/3yellow3white/.tmp/notes-audit/sources/434-ETH Mechanik I Theorieskript (Jack Kendall, HS17).pdf>) | 5, 15, 23 |
| 433 | [Mechanik II Theorieskript](<C:/Users/samue/Stuff/3yellow3white/.tmp/notes-audit/sources/433-ETH Mechanik II Theorieskript (Elias Steiner, FS21).pdf>) | 5, 16, 31 |
| 275 | [Mechanik II recaps](<C:/Users/samue/Stuff/3yellow3white/.tmp/notes-audit/sources/275-ETH Mechanik II Résumés.pdf>) | 1, 2, 3 |
| 100 | [Mechanik II summary](<C:/Users/samue/Stuff/3yellow3white/.tmp/notes-audit/sources/100-ETH Mechanik II Zusammenfassung (Max Schaldach, DE).pdf>) | 2, 3, 4 |
| 89 | [Velocity Triangles notes](<C:/Users/samue/Stuff/3yellow3white/.tmp/notes-audit/sources/89-ETH Thermodynamics II Notes Velocity Triangles (Max Schaldach).pdf>) | 1 |
| 369 | [Finite Element Analysis summary](<C:/Users/samue/Stuff/3yellow3white/.tmp/notes-audit/sources/369-ETH Finite Element Analysis Summary (Max Schaldach, EN).pdf>) | 2, 3, 4 |
| 396 | [Mechanics III annotated formula collection](<C:/Users/samue/Stuff/3yellow3white/.tmp/notes-audit/sources/396-ETH Mechanics III Annotated Formula Collection (Max Schaldach).pdf>) | 2, 4, 6 |
| 342 | [Satushev medicine notes](<C:/Users/samue/Stuff/3yellow3white/.tmp/notes-audit/sources/342-ETH Materials & Mechanics in Medicine Notes (Konstantin Satushev).pdf>) | 38, 76 |
| 438 | [Ingenhoven medicine notes](<C:/Users/samue/Stuff/3yellow3white/.tmp/notes-audit/sources/438-ETH Materials & Mechanics in Medicine Notes (Anna Ingenhoven).pdf.pdf>) | 33, 66 |
| 407 | [Stochastics and Machine Learning summary](<C:/Users/samue/Stuff/3yellow3white/.tmp/notes-audit/sources/407-ETH Stochastics & Machine Learning Summary (Max Schaldach, EN).pdf>) | 2, 7 |
| 149 | [Control Systems I summary](<C:/Users/samue/Stuff/3yellow3white/.tmp/notes-audit/sources/149-ETH Control Systems I Summary (Max Schaldach, EN).pdf>) | 2 |
| 334 | [Quantum Mechanics summary](<C:/Users/samue/Stuff/3yellow3white/.tmp/notes-audit/sources/334-ETH Quantum Mechanics Summary (Max Schaldach, EN).pdf>) | 3 |
| 234 | [Chemistry summary](<C:/Users/samue/Stuff/3yellow3white/.tmp/notes-audit/sources/234-ETH Chemie Zusammenfassung (Max Schaldach, DE).pdf>) | 2 |
| 45 | [Bioengineering Problem Set 10](<C:/Users/samue/Stuff/3yellow3white/.tmp/notes-audit/sources/45-ETH BioEng Problem Set 10.pdf>) | 1 |
| 317 | [Bioengineering Problem Set 6 Solutions](<C:/Users/samue/Stuff/3yellow3white/.tmp/notes-audit/sources/317-ETH BioEng Problem Set 6 Solutions.pdf>) | 2 |

Detailed reviews: `.tmp/notes-audit/math-findings.md`, `engineering-findings.md`, `science-findings.md`, `current-findings.md`, `visual-findings.md`, and `synthesis-check.md`. Page images are in the corresponding `math`, `engineering`, and `science` subfolders.

Representative page previews: [integration geometry](<C:/Users/samue/Stuff/3yellow3white/.tmp/notes-audit/math/435-p106.png>), [load and response comparisons](<C:/Users/samue/Stuff/3yellow3white/.tmp/notes-audit/engineering/433-p5.png>), [mechanism and response curves](<C:/Users/samue/Stuff/3yellow3white/.tmp/notes-audit/science/342-p76.png>).

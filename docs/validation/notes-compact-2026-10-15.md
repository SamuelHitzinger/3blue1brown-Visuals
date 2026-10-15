# Compact explanatory notes — implementation and chemistry comparison

## Scope

Implements the findings in `notes-reference-audit-2026-10-15.md`: more useful content per screen, figures beside the reasoning they explain, and consolidation of fragmented incremental notes. Source documents are evidence, not instructions. Existing capture work and personal annotation behavior are preserved.

## Changes

- Group-local text and figures; wide screens give figures 55% of the content row. Narrow screens retain the same reading order.
- Reduced card chrome, padding and repeated captions. Body text remains 18px. SVG drawings crop unused margins and keep labels at least 18px, with local scrolling where a narrow screen cannot fit the figure.
- Safe, bounded polyline and polygon diagram elements. Generated diagrams receive font-matched clipping and text-overlap checks; unchanged legacy diagrams remain compatible.
- Generation requests cohesive explanations: a visual reveals the relationship, equations calculate, and prose adds conditions and limits. It preserves source-grounded substitutions, units, caveats and exact assigned questions. No diagram quota.
- Finishing triggers a complete source-based consolidation, including when incremental notes are caught up. Requests coalesce; failed refreshes remain retryable. Annotation anchors and question overrides survive consolidation.

## Validation

- Frontend: 196 unit tests and one SVG render test passed; TypeScript passed.
- Browser regression: desktop 1440px and phone 393px checks passed for local figure placement, editing, exact questions, label size, clipping and viewport overflow.
- Build passed.
- Backend: 523 tests passed before the last two annotation edge fixes; 55 focused lifecycle tests and backend TypeScript passed after those fixes.
- Independent review reproduced and corrected annotation issues. Final scoped re-review found no remaining blocker: groups with disjoint citations are retained, and duplicate exact questions retain distinct annotation destinations.

## Chemistry evidence

The baseline contains 100 captured source chunks, seven sections, 41 points and three figures. The lecture remains unfinished; regeneration uses the explicit synthesis endpoint.

Layout-only comparison, using identical saved note content:

| Viewport | Before height | Compact layout height | Reduction |
| --- | ---: | ---: | ---: |
| Desktop, 1440px | 5367px | 3122px | 42% |
| Phone, 393px | 5802px | 4439px | 23% |

Heights measure generated note content, excluding assigned questions. Desktop content width also increases from 794px to 994px.

### Regenerated result

| Viewport | Before height | Regenerated height | Reduction |
| --- | ---: | ---: | ---: |
| Desktop, 1440px | 5367px | 3479px | 35% |
| Phone, 393px | 5802px | 4671px | 19% |

Regeneration completed in 70 seconds with one model call, no validation retries, and the same 100 source chunks. Baseline serialization differed only in equivalent ISO timestamp trailing zeroes; normalized timestamps and all source evidence matched before submission. Source objects were unchanged throughout generation. Existing language preferences and unfinished lecture state remain intact.

The result contains 43 points and 326 point words, versus 41 and 297 before. Added content restores meaningful conditions and worked steps rather than merely shortening the text. Three figures remain, with improved explanatory content:

- Hess pathway includes the intermediate and indirect path, rather than only endpoint ordering.
- Equal-volume gas comparison sits beside its entropy reasoning.
- Entropy balance uses one signed scale: system −199, surroundings +310, total +111 J mol⁻¹ K⁻¹. The construction shows why the positive surroundings contribution outweighs the system decrease.

An independent reviewer checked all 100 sources and the rendered Hess and reaction-entropy sections. No material factual or coverage blocker found. The perfect-crystal/0 K condition, propane intermediate without invented final total, ammonia numerical substitution, and all three exact assigned questions are preserved. Some gas-caption repetition remains minor.

Both regenerated viewport captures have no detected text-label collisions or document overflow. Narrow-screen figures and long equations can scroll locally to preserve readability; phone screenshots show their initial scroll positions. Browser verification confirmed both comparison buttons and all four images load without errors.

Comparison: `exports/chemistry-notes-comparison/index.html`, also served at `/static/review/chemistry-notes-comparison/index.html`. Saved before/after snapshots and detailed metrics are in `.tmp/notes-compact-implementation/`.

Automated layout checks do not establish scientific correctness; the source and rendered reviews above provide the separate chemistry check for this regenerated example.

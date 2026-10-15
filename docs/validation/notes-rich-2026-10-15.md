# Rich explanatory chemistry notes — 2026-10-15

Request: replace impoverished arrow/box sketches with complete graphs, recognizable physical context or useful analogies, while keeping notes compact and visually connected.

## Implementation

- Notes synthesis now routes substantial graphs and physical constructions through the existing rich scene author. Static drawings remain available where their vocabulary is sufficient.
- Scene authoring requires quantities, units, scales/reference states, known/unknown scope, physical correspondence, and explanatory operations. Analogies require an explicit mapping and limit. Source documents remain untrusted evidence, not instructions.
- Physical context must be integrated into the construction, not appended as a decorative icon. Route comparisons retain persistent state identity and common endpoints; quantitative contributions must visibly combine.
- Rich figures use the notebook's full group width, with compact complementary text below. Static figure layout is unchanged. Lecture visuals initially show their complete final hold; Replay exposes the construction.
- Zoom/fit keeps the same player and playback position. A keyboard-focusable local scroll region supports dense diagrams on phones without page overflow.
- Explicit `POST .../concepts/:id/visualize` with `{regenerate:true}` can refresh a current scene. Active requests coalesce, and the previous working source survives processing or failure. Ordinary requests retain their idempotent behavior.
- Rich generation has a 12-minute deadline for authoring plus rendered review/repair. The previous six-minute deadline aborted a real second repair; note synthesis deadlines are unchanged.

## Evidence preservation

Chemistry lecture `4f030c8d-e975-463f-adef-0942371c3bd1` remains unfinished. All 100 source chunks and all three assigned questions are preserved. The source comparison normalizes only ISO timestamp formatting in the PowerShell baseline. Notes contain five sections, 17 points and 167 point words, compared with 23 points and 172 words before this pass. The brief calorimetry definition was restored.

No missing propane water-formation value or total reaction enthalpy is fabricated. Ammonia retains 298 K, −199/+310/+111 J mol⁻¹ K⁻¹ and −92.4 kJ mol⁻¹. No Gibbs formula, kinetic mechanism or activation barrier is introduced.

## Verification

- Original rich-routing changes: 27 focused backend checks and backend TypeScript passed.
- Explicit regeneration/cancellation/preservation: 10 focused lecture tests passed. New regeneration test failed before implementation, then passed.
- Final-hold/replay: 30 playback tests passed, including a new behavior regression test. Frontend production build passed; existing comparison exports were restored afterward.
- Ammonia actual-page desktop/mobile capture: no runtime errors or page overflow; 10 temporal samples and replay clock passed. At desktop width 1440, the scene occupies the full 1246-pixel group instead of the former 753 pixels.
- Phone zoom: 307→900 pixels; local pan verified; Fit restores 307 pixels and scroll origin. Desktop zoom: 1246→1869→1246. Canvas identity and time 12 seconds remain unchanged.
- Independent ammonia review passed scientific reasoning, desktop readability, physical correspondence, and technical delivery. Phone zoom is readable; the fit overview cannot display all fine text legibly at once.

The initial browser test timeout was caused by Puppeteer network interception preventing worker WASM loading. Replacing interception with read-only fetch/XHR/sendBeacon guards resolved it; no product compiler timeout was increased.

## Final artifact review

Ammonia: illustrative constant-pressure piston vessel and surrounding medium linked to heat flow and a complete common-scale signed entropy graph. A copied +310 contribution translates to the −199 endpoint, leaving the visible +111 surplus. The small vertical separation between tip-to-tail arrows is non-blocking.

Propane: final regeneration and actual-page review pending at report creation. Earlier candidates were rejected for small labels and decorative physical context. Previous working source remains available until a replacement passes the rendered gate.

Evidence directory: `.tmp/notes-rich-v3/`. Reference frames inspected from the local `3blue1brown-explanation-style` skill; no claim of full-motion reference matching. Ordered frame samples plus playback-clock checks establish the tested states and playback behavior, not exhaustive motion quality.

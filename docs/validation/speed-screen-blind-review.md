# Blind paired visual review — speed screen 02

Reviewed blind, without identity maps, previous reports, other experiments, model identities, or generation timing. Scope: the eight case `task.txt` files and each arm's `scene.js`, `evidence.json`, and PNGs under `data/realtime-workshop/complexity-matrix/blind-speed-screen-02`. No repairs or rerenders were performed. This review makes no speed comparison.

Baseline: read the 3blue1brown-explanation-style skill, visual-baseline and review-gate; viewed approved-components, approved-derivative, and rejected-chart-template. The relevant standard is persistent geometry, a visible operation that earns the conclusion, local notation, stable color roles, and readable holds. A 3D scientific scene need not imitate Euler's coordinate grid.

Evidence modality: inspected all fourteen available 1280×720 contact sheets, their ordered setup/interior/endpoint samples, and native 960×720 frames from every rendered arm. Inspected additional native 1280×720 frames for detailed-line A, probability A, wave B, and both molecule cases. Standard sample times are 0, 1, 3, 5, 6, 8 seconds. Exceptions: detailed-line A, basic-surface B, and full-caffeine A stop at 6 seconds; probability B stops at 6.05 seconds. Two arms have no frames. Source corroborates invariants and scheduled operations; these sparse samples do **not** establish full-motion smoothness, every intermediate occlusion, or an encoded movie's validity.

## Scores and paired decisions

Scores: 5 = requirement strongly demonstrated; 4 = sound with minor weaknesses; 3 = material revision; 2 = major defects; 1 = little usable evidence; 0† = no delivered visual because of technical failure. C = mathematical/scientific correctness, O = causal operation, G = geometry/detail preservation, L = label readability, S = reference style, I = identity/continuity. These are separate judgments, not an averaged pass threshold. `Pass` means the supplied scene proof passes this screen, not that a final movie has been verified.

| Case | Arm | C | O | G | L | S | I | Scene duration | Decision |
|---|---|---:|---:|---:|---:|---:|---:|---|---|
| Line basic | A | 5 | 5 | 5 | 5 | 4 | 5 | 8s | Pass |
| Line basic | B | 5 | 4 | 5 | 4 | 4 | 5 | 8s | Pass, weaker |
| Line detailed | A | 2 | 2 | 2 | 2 | 2 | 2 | 6s | Revise |
| Line detailed | B | 5 | 5 | 4 | 5 | 4 | 5 | 8s | Pass |
| Probability | A | 3 | 4 | 5 | 4 | 3 | 5 | 8s | Revise |
| Probability | B | 2 | 1 | 1 | 1 | 1 | 2 | 6.05s | Revise |
| Wave | A | 5 | 5 | 5 | 5 | 5 | 5 | 8s | Pass |
| Wave | B | 1 | 1 | 2 | 2 | 1 | 1 | 8s | Revise |
| Surface basic | A | 4 | 5 | 4 | 3 | 3 | 5 | 8s | Revise labels |
| Surface basic | B | 4 | 2 | 4 | 2 | 2 | 4 | 6s | Revise |
| Surface detailed | A | 0† | 0† | 0† | 0† | 0† | 0† | Failed | Revise |
| Surface detailed | B | 5 | 5 | 5 | 3 | 3 | 5 | 8s | Revise labels |
| Caffeine heavy | A | 5 | 5 | 5 | 4 | 4 | 5 | 8s | Pass |
| Caffeine heavy | B | 0† | 0† | 0† | 0† | 0† | 0† | Failed | Revise |
| Caffeine full | A | 5 | 2 | 5 | 3 | 2 | 4 | 6s | Revise |
| Caffeine full | B | 5 | 5 | 5 | 4 | 4 | 5 | 8s | Pass |

† Zero records an absent delivered proof, not a visual observation or a claim that every source expression is wrong.

| Case | Preferred arm | Reasoning gate A / B | Readability gate A / B | Style gate A / B | Technical screen A / B |
|---|---|---|---|---|---|
| Line basic | A | ready / ready | ready / ready | ready / ready | ready / ready |
| Line detailed | B | revise / ready | revise / ready | revise / ready | revise / ready |
| Probability | A, both revise | revise / revise | ready / revise | revise / revise | ready / revise |
| Wave | A | ready / revise | ready / revise | ready / revise | ready / ready |
| Surface basic | A, both revise | ready / revise | revise / revise | revise / revise | ready / revise |
| Surface detailed | B, labels revise | unverified / ready | unverified / revise | unverified / revise | revise / ready |
| Caffeine heavy | A | ready / unverified | ready / unverified | ready / unverified | ready / revise |
| Caffeine full | B | revise / ready | revise / ready | revise / ready | revise / ready |

Technical `ready` here means the supplied evidence reports a successful 8s scene render and the sampled endpoint/source support the requested hold. Final encoded media and continuous playback remain unverified for **every** arm. Technical readiness does not excuse a visual failure.

## Findings, source corroboration, and passages to recheck

Paths below are relative to the blind-screen root named above. Line numbers refer to each arm's `scene.js` as supplied, including the DATA prelude in molecule files.

**Line basic — A is stronger; both usable.** A preserves the line while moving the point (1–3s), constructs the run and rise sequentially (3–5.4s), then places the quotient beside the triangle at 6s. At the 5s sample the still-growing rise is visible; at 6s the equal completed legs support the quotient. Source lines 18–22 corroborate this chain. B moves the point and fades both complete legs in together, which is a weaker explanation but still establishes equal lengths. At 3–8s its `rise = 1` text crosses the vertical leg (line 12); moving the label slightly right would improve reading. Neither uses detached heading/footer framing. Both are modest in scale relative to the large baseline construction, but remain legible at native size.

**Line detailed A — broken correspondence, stale input, label collisions.** At 3s, the points reach (1,1) and (1,2), but a short guide floats to the right of the x=1 marker instead of joining either point; `x = .2` remains beside the moved input. At 5s, that stale value contradicts `same x = 1`, and `rise = 2` overlaps `y = x`. Lines 21–25 translate fixed short guide objects with `moveTo` rather than recomputing their endpoints, and move the x-value label without changing its text. Lines 33–36 place the final labels in the cramped construction. The reported duration is 6s, not 8s. Recompute both guides from the shared x, update/remove the stale number, enlarge the diagram and separate labels; recheck 1–4s and the final hold. B's 3s sample correctly joins the shared x to both moving points and their y-axis projections; source lines 20–29 use the same x in all bindings. Its final offset rise-2 indicator is a reasonable display separation, though a short endpoint connector would make the offset explicit.

**Probability A — sound density mapping, misleading intermediate labels.** At 3s the teal one-sigma interval spans approximately [-1.4,1.4], yet it is already labeled `σ = 2`; at 5s it spans [-1.8,1.8] under that same label. Lines 11–19 explicitly produce this mismatch. The visible `x → 2x` / `height → height / 2` target rule also precedes the completed factor-two mapping. The source density `f(x/a)/a` is correct, the common scales are fixed, the final peaks have the correct 2:1 ratio, and the three tracked beads make the transformation substantially more causal than a caption alone. Use a variable/current sigma label during the operation and reveal the numeric factor-two statement at completion. Tie the mapping notation to the beads/interval instead of the detached upper annotation row. Recheck 1–6s. At 960 width the positive `x` axis-name is clipped, though both requested curve domains remain visible. The unit-area statement is correctly about the complete distributions, not exactly the displayed finite [-5,5] window.

**Probability B — collapsed plotting scale and wrong interval width.** At 3s both curves occupy a narrow spike near the left edge; at 960 width, labels are clipped and stacked there. `X=x=>-5+10*x/600` (line 4) maps the whole ten-unit domain into only 1/6 scene unit. The density formula itself (line 18) is correct, but the rendered comparison cannot communicate widths. The teal interval starts with width `X(4)-X(-4)` and then scales by two (lines 26,35), inconsistent with the claimed [-2,2] span; this is a source-confirmed error independent of the poor visibility. Replace the coordinate mapping and derive interval endpoints directly. Recheck interior widening and 6.05s endpoint, then restore the requested 8s duration.

**Wave A — strongest causal proof.** At 3s and 5s, the teal input and yellow sum evolve together on fixed aligned axes; the shared sample line links all rows. At 5s the negative teal contribution points downward from the blue arrow's head. At 6–8s both input curves survive, the sum is a visible zero line, and equal opposite component arrows justify cancellation even without the formula. Lines 14–15 and the bound input/addition vectors evaluate the same phase. Identity, colors, and local labels remain stable. Full-motion passage through a zero-length arrow is not established by these samples.

**Wave B — severe mathematical and continuity failure.** At 0–1s the yellow curve labeled sum has amplitude 1 while its sum arrow has amplitude 2. At 3s and 5s the sum and second addition arrow have disappeared; the diagram still shows `φ = 0`. At 6s it asserts cancellation while the teal `b` arrow still points upward above the blue arrow, and the opposite input profile is absent. Source constructs `sum` with the ordinary single sine curve, fades it out, uses an unplayed `bHalf.fadeIn()`, and never changes `vb`'s upward endpoints. A linear morph between opposite sine point arrays would also scale amplitude through zero, not implement sin(x+φ) at intermediate phase. Rebuild b, sum and signed arrows from one phase variable and retain the second input. Recheck 0s, 3s, 5s, 6s. At 960 width the detached left input labels and phase are additionally clipped. The 8s technical success does not rescue this arm.

**Surface basic — A performs the requested reveal; both need readable annotations.** A's 3s frame has the completed yellow trace and no blue trace; 5s shows the blue trace being drawn; 6s retains both. Source lines 8–12 compute both parabolas and sequential reveal, using a small +.018 depth offset to avoid coincident surface rendering. At 5–6s the blue formula is foreshortened, low-contrast against the surface, and crosses the geometry; the yellow formula is much larger in projection. Reposition/billboard labels with leaders and comparable screen-space sizes; recheck 3–6s at both widths. B already shows both entire traces at 0s because their constructors omit opacity:0 (lines 11–12); later animations to opacity:1 reveal only formulas. Its yellow formula is severely foreshortened and tiny compared with the blue one at 3s. Restore actual sequential trace reveal, improve labels, and extend 6s to 8s. Both genuinely use 10×10-cell 3D surfaces; neither is merely a flat image.

**Surface detailed A — technical failure, plus source defects.** Evidence reports `Reactive mesh updates must preserve vertex count and topology`; no frame exists. Line 28 returns `vertices:[]` for the slicing surface, matching the error. Line 18 constructs a patch of the saddle rather than a vertical y=c slicing plane, and line 30 moves a permanently `c = −1` label. These are source findings, not observed visual failures. Preserve a four-vertex plane topology and update its y coordinate, and update the c annotation. A fresh render is required before any visual verdict.

**Surface detailed B — valid moving slice, weak fixed-trace label.** At 3s and 5s the yellow plane and trace occupy intermediate positions; source lines 11 and 21–26 evaluate `[x,c,(x*x-c*c)/2]` and the same c for the plane, border, and labels. This algebraically preserves the required surface constraint between samples. The 40×40 surface and fixed negative-curvature trace remain present, and c=1 holds at 6–8s. At 3s `y=c` collides with the blue `x=0` label; at 6s the latter is dim and partly buried against the surface/plane. The formula also shares the plane-border direction rather than a clean reading plane. Keep labels facing the viewer, move the fixed-trace label off the surface with a leader, and recheck 3–6s. The geometry merits retention; the label gate still needs revision.

**Caffeine heavy A — topology and attachment verified, not merely counted.** Source lines 6–8 use one centered uniform scale, all heavy IDs 1–14, and bond indices 0–14. The four listed double bonds (1–9, 2–10, 6–11, 7–8) each receive two parallel sticks: 15 chemical bonds represented by 19 strokes. Atom centers and bond endpoints are never independently animated; only added labels/halos fade in. In the 3s and 5s samples the emphasized atoms remain at their bonded positions; the 6s frame retains the complete scaffold with O1/O2 and N1–N4. Faceted detail:0 is visible, H omission and computed provenance are stated. N4 slightly overlaps its adjacent double bond, a minor readability weakness. This arm does not exhibit atom detachment. The supplied DATA prelude is treated as supplied context; its authorship is not inferred.

**Caffeine heavy B — technical failure, no observed moving-atom claim.** Evidence reports `cannot read property 'Symbol.iterator' of undefined`; there are no frames. Source lines 20–23 use scalar `scale` values in atom animation, and scale only atoms, not bonds. That deserves a fresh attachment check after resolving the compile error, but the permitted evidence does not identify the exact failing call or prove visible atom detachment. It also emphasizes the two O atoms together and all four N atoms together, rather than sequentially identifying each atom for counting. Do not give it visual credit based on apparent source counts. Repair the failure, use countable per-atom emphasis without moving centers, and inspect interior frames before scoring visual quality.

**Caffeine full A — correct topology, missing reveal, wrong schedule.** At 0s the small white hydrogens and their bonds are already visible; 1s does not reveal a new scaffold. Lines 13 and 29 create opacity animations without playing them; the later reveal has zero duration. Source schedules rotation at 1–4s and a hold to 6s, rather than reveal at 1–3s, rotation at 3–6s, hold to 8s. Its full graph is nevertheless correct: all 24 atom IDs and 25 chemical bonds, with four doubles/29 strokes, are constructed from DATA. All atom and bond handles share one rotation group (line 36); the 3s sample retains their attachments. This is not an invented chemical motion/topology failure. The oblique formula/provenance/legend at left are substantially smaller and harder to read than the molecule. Set initial H visibility through an executed operation, reveal atoms and bonds together over 1–3s, correct the schedule and face the annotations toward the viewer. Recheck setup, 2s reveal, 4–5s rotation and final hold.

**Caffeine full B — preferred, with limited motion evidence.** At 0–1s the heavy scaffold is complete and H is absent. At 3s H atoms and bonds are present; at 5s the full structure has rotated with attachments intact; 6s and 8s retain the endpoint. Source lines 24–26 and 35–38 group all H atoms/bonds for a two-second reveal and put that group plus every heavy atom/bond under one rigid rotation. The source topology is 24 atoms, 25 bonds/29 strokes, detail:2, with smaller H. Specifically H15 attaches to C11; H16–18 to C12; H19–21 to C13; H22–24 to C14. These are the supplied graph's attachments, not guessed from silhouettes. The four double bonds remain paired in the interior/final samples. Some H projections overlap at intermediate angles, so silhouette counts alone would be insufficient. The right methyl group approaches the annotations at 3s; a little more clearance would improve the layout. No frame inside the 1–3s reveal is supplied, so gradual opacity is source-supported, not playback-proven.

## Disposition

Six arms pass this bounded proof screen: basic-line A/B, detailed-line B, wave A, heavy-caffeine A, full-caffeine B. Probability A and both rendered preferred surface arms contain useful constructions but require the specific revisions above. Two arms fail technically and cannot receive visual approval. Sparse sampled evidence is sufficient to identify the cited failures and source invariants; it is insufficient for a claim of fully verified motion or final encoded delivery.

## Parent identity reveal after review completion

The independent reviewer completed the report before this mapping was read or appended. Scores and findings above remain unchanged. `Prior` is the earlier direct-native Sol/low baseline (the separately corrected heavy-atom pair where applicable); `new` is the Luna/off direct-native configuration. These were not simultaneous matched model runs.

| Case | A | B |
| --- | --- | --- |
| Line basic | Prior | New |
| Line detailed | New | Prior |
| Surface basic | Prior | New |
| Surface detailed | New | Prior |
| Probability | Prior | New |
| Wave | Prior | New |
| Caffeine heavy | Prior | New |
| Caffeine full | New | Prior |

Only the new simple-line output passes this bounded sampled proof screen, and the reviewer prefers its prior counterpart. The seven other new outputs need revision or fail compilation. Thus the faster configuration does not preserve baseline quality across complexity strata. Neither arm has new full-motion or end-to-end live-delivery approval here.

# Formal routing saddle — independent native review

Experiment `73665671-b492-4d6c-acff-3069aca4d418`; isolated run `56b5415a-f9ce-40a3-8cc7-f4bbe901aa0f`. Production completed at initial native attempt 0, without visual-gate repair. Duration 38.967 s. Independently recomputed final source SHA256: `c070e697f761fe3da628d79b5937a233519f6d81b27d191a75a9837cd7d63289`.

| Gate | Verdict | Evidence / limit |
|---|---|---|
| Dimensional choice | ready | One actual 3D saddle with central perpendicular sections and shared coordinate axes. |
| Reasoning | ready within sampled scope | Sections and tangents are correct on positive, zero and negative coordinate sides; slope signs reverse without reversing concavity. |
| Readability | ready | Colored curves and tangent arrowheads identify the two slope directions at native size. Shafts remain close to the curves, a polish limitation noted below. |
| Reference style | ready | Persistent surface and objects, color-linked equations, staged section construction and a meaningful negative-side extension rather than unrelated recap. |
| Technical native | ready | Approved native scene, both aspect sets inspected and final source hash matched. |
| Technical encoded | unverified | No continuous playback, encoded movie or live orbit test. |

## Evidence inspected

Raw base:

`C:\Users\samue\.codex\worktrees\dimensional-prompt-eval\3yellow3white\data\dimensional-prompt-eval\runs\routing\saddle\56b5415a-f9ce-40a3-8cc7-f4bbe901aa0f`

Viewed all four `scene-0.visual/0/{1280x720,960x720}-sheet-{0,1}.png` sheets and native `1280x720-{7,9,11}.png`, `960x720-11.png`; read source, script and final review. Ordered sample times are 0, 0.5, 3.78182, 6.4945, 9.74175, 14.16667, 19.4835, 22.73075, 25.978, 29.22525, 34.16667 and 38.967 s.

| Time | Exact relative frame | Observation |
|---|---|---|
| 0 s | `scene-0.visual/0/1280x720-0.png` (sheet 0) | Single saddle and axes establish the common spatial world. |
| 3.78182–6.4945 s | `scene-0.visual/0/1280x720-2.png`, `1280x720-3.png` (sheet 0) | Both central curves and plane outlines belong to the same surface, with a horizontal right-angle marker. |
| 14.16667 s | `scene-0.visual/0/1280x720-5.png` (sheet 0) | Blue/gold assignment and section equations emerge in the same geometry. |
| 22.73075 s | `scene-0.visual/0/1280x720-7.png` | Positive-side points and directed tangents: blue points uphill along positive x, gold downhill along positive y. |
| 29.22525 s | `scene-0.visual/0/1280x720-9.png` | Paired positive-side comparison and slope labels are readable; arrowheads remain identifiable. |
| 34.16667 s | `scene-0.visual/0/1280x720-10.png` (sheet 1) | Both points return to origin with horizontal tangents and zero slope labels. |
| 38.967 s | `scene-0.visual/0/1280x720-11.png`, `scene-0.visual/0/960x720-11.png` | Points on the negative halves, reversed slope signs and unchanged upward/downward bending. The two colors preserve identity despite projected side changes. |

## Mathematical and visual check

Common map is `(x,y,z) -> [x,z,-y]`. The surface is `[x,x*x-y*y,-y]`; blue section is `[t,t*t,0]`, gold `[0,-t*t,-t]`. Tangent directions are `[1,2*t,0]` and `[0,-2*t,-1]`, so labels correctly report blue positive/gold negative at t=1.2, both zero at t=0, and blue negative/gold positive at t=−1.2. The arrowheads indicate increasing coordinate direction, not necessarily the current point travel direction. That distinction matters on the negative-side passage, where the narration correctly says signs reverse but bending does not.

At each end of the motion, tangent shafts lie close to their parabolas. Their total length is 1.3 units, giving horizontal half-extent 0.25 and maximum quadratic departure 0.0625 at |t|=1.2. Native frames show small but recognizable arrowheads and directed shafts. These distinguish the slope cues better than the shorter unheaded strokes in spatial saddle; longer straight extensions would still make the tangent-versus-curve comparison easier. This is recorded as polish, not a substantive failure: direction and signed comparison remain readable without relying only on the captions.

The surface remains visible and quiet; equations and labels are tied to section color and coordinate conditions. Native frames support positive/zero/negative states and preserve units/topology. They do not establish formula-morph interiors, continuous point motion or interactive orbit behavior. No compiler diagnostic or additional rendering/export was run during review, and no generated source was edited.

## Complete saddle comparison

All three choose correct actual 3D and correct common geometry. Baseline required a production tangent-length repair and its final long straight extensions are the clearest tangent separation among these samples, with a minor origin-caption crossing. Routing's initial approved result gives readable directed tangents and adds a correct negative-half comparison. Spatial's shorter plain segments nearly merge with the curves in the final comparison, leaving an independent readability revision despite automatic approval. These results support two usable sampled native saddle explanations with different strengths, not a general proof that either prompt candidate improves routing or complex geometry.

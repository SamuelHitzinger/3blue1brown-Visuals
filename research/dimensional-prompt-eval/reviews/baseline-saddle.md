# Formal baseline saddle — independent native review

Experiment `73665671-b492-4d6c-acff-3069aca4d418`; isolated run `027622fa-f66b-4d0f-a71e-b39f7aa16619`. Production completed, approving attempt 1 after a targeted tangent-length repair. Duration 37.634 s. Independently recomputed final source SHA256: `7289e3d98cb7c0ad1c174bd703d9c05f047a65a795108b5152ad45f79882a4b9`. This formal run is separate from the historical original-checkout saddle whose runtime changed during its run.

| Gate | Verdict | Evidence / limit |
|---|---|---|
| Dimensional choice | ready | Actual 3D surface, common intersecting section planes and points/tangents on those sections. The root's `mode:'2d'` houses annotations; it does not describe the 3D model subview. |
| Reasoning | ready | Both sections belong to z=x²−y² and their tangents have the correct derivatives. Points move on positive coordinate axes, matching the narration's slope signs. |
| Readability | ready | Both colored curves and the repaired straight tangents are visible against the quieter translucent surface at both aspect ratios. A minor origin-caption crossing is noted below; it does not obscure the comparison. |
| Reference style | ready | One persistent geometric world, semantic blue/gold correspondences, sections before tangent comparison, and a held result. The algebra develops with the geometric operation. |
| Technical native | ready | Approved native scene and source hash verified; setup, action and end frames render at both requested aspects. |
| Technical encoded | unverified | No continuous playback, encoded movie, player subtitle layout or live interactive orbit/slider test inspected. |

## Evidence inspected

Raw base:

`C:\Users\samue\.codex\worktrees\dimensional-prompt-eval\3yellow3white\data\dimensional-prompt-eval\runs\baseline\saddle\027622fa-f66b-4d0f-a71e-b39f7aa16619`

Viewed all four approved `scene-0.visual/1/{1280x720,960x720}-sheet-{0,1}.png` contact sheets. Their ordered native times are 0, 0.5, 5.1, 9.6, 14.13333, 16.4, 18.817, 22.7, 25.54667, 28.2255, 32.83333 and 37.634 s. Also viewed `scene-0.visual/1/1280x720-6.png`, `1280x720-10.png` and `960x720-11.png` at native size. Read final generated source, lesson narration, and both production review records. No generated source was edited.

| Time | Exact relative frame path | Visible evidence |
|---|---|---|
| 0 s | `scene-0.visual/1/1280x720-0.png` (sheet 0) | One translucent saddle with axes and quiet grid establishes the shared surface. |
| 5.1 s | `scene-0.visual/1/1280x720-2.png` (sheet 0) | Blue upward parabola belongs to its central plane and the same surface. |
| 14.13333 s | `scene-0.visual/1/1280x720-4.png` (sheet 0) | Blue upward and gold downward sections coexist; outlined crossing planes expose their perpendicular spatial relationship. |
| 18.817 s | `scene-0.visual/1/1280x720-6.png` | Points have left the common origin; pale straight tangents are distinguishable from curved sections and have opposite signed slopes along their positive axes. |
| 22.7–25.54667 s | `scene-0.visual/1/1280x720-7.png`, `1280x720-8.png` (sheet 1) | Extended tangents remain visible after the points reach their comparison locations. |
| 32.83333 s | `scene-0.visual/1/1280x720-10.png` | Short horizontal strokes at the origin accompany the zero-slope statement while the farther points remain visible for contrast. Caption crosses the lower gold tangent; text remains readable but has avoidable proximity. |
| 37.634 s | `scene-0.visual/1/960x720-11.png` | Final surface, colored sections, points, tangents and equations persist with no crop of the meaningful geometry. |

## Mathematical and spatial check

Source uses one common coordinate mapping `(x,y,z) -> [x,z,-y]`. The surface is parameterized by `(x,y,x*x-y*y)`. Blue section is `(a,0,a*a)`; gold is `(0,a,-a*a)`. Their central cutting planes share the origin and are perpendicular before projection. This is a genuine spatial construction, not two unrelated planar graphs tilted into a frame.

Both moving points use the same positive distance a, from 0 to 1.2 by default. Blue tangent endpoints have z=a²+2aΔx; gold endpoints have z=−a²−2aΔy, so their derivatives are 2a and −2a. The narration explicitly says positive axes, avoiding the incorrect generalization that moving away on either coordinate side always gives those derivative signs. The two horizontal reference strokes at the origin support the later zero-slope statement.

The repair lengthens tangent extensions while retaining exact directions and points. In the action native frame they visibly leave the curved sections away from the points. This addresses the production review's original substantive concern that the short tangent strokes merged with the parabolas. The surface remains a quiet context, and no camera motion is required to manufacture a sense of depth.

## Minor placement note and evidence limits

At 32.83333 s the text `At origin: slope 0` is centered over the bottom part of the model and crosses the gold tangent. Moving that caption into the clear lower margin, or nearer the origin with a clear connection, would improve placement. The words and the tangent comparison are still readable, so this is recorded as polish rather than an unresolved substantive reasoning/readability failure. Recheck that passage if layout is changed.

The large horizontal black margins are a consequence of this chosen narrow projected saddle and the flanking equations; the mathematical object still owns the scene. Dense action samples or playback would strengthen claims about movement continuity and formula transitions. Current temporal conclusions are qualified by the ordered native samples plus source timing. The interaction exists in source but was not exercised. No same-case candidate outcome informed this verdict; strategy comparison remains pending.

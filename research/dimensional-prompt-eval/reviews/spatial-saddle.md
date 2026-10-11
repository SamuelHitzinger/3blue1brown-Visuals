# Formal spatial saddle — independent native review

Experiment `73665671-b492-4d6c-acff-3069aca4d418`; isolated run `e01d21d4-c514-4c0b-b7a9-216ba26071a0`. Production completed at initial native attempt 0, without a visual-gate repair. Duration 40.8 s. Independently recomputed final source SHA256: `6351fa9fa44e770e78ed9f7f1d48a1497352d925f802272db5ebfe0490a6e058`.

| Gate | Verdict | Evidence / limit |
|---|---|---|
| Dimensional choice | ready | A genuine 3D subview contains one saddle and its perpendicular central sections. Root 2D mode is for annotations. |
| Reasoning | ready within sampled scope | Surface, sections and tangent directions are mathematically correct; narration specifies motion along positive coordinate axes. |
| Readability | revise | At the final slope comparison the short tangent segments nearly merge with the section curves; their identity as straight tangents is weak. |
| Reference style | ready | One persistent construction, quiet surface context, color-linked sections and equations, observation hold before explanation, no unrelated visual reset. |
| Technical native | ready | Actual approved native render and matching source hash; both aspects inspected. |
| Technical encoded | unverified | No encoded movie, continuous playback or interactive orbit test. |

Initial automatic approval does not remove the independent tangent-readability concern.

## Evidence inspected

Raw base:

`C:\Users\samue\.codex\worktrees\dimensional-prompt-eval\3yellow3white\data\dimensional-prompt-eval\runs\spatial\saddle\e01d21d4-c514-4c0b-b7a9-216ba26071a0`

Viewed all four `scene-0.visual/0/{1280x720,960x720}-sheet-{0,1}.png` sheets; native `1280x720-{8,10,11}.png` and `960x720-11.png`; read final source and script. Ordered sample times are 0, 0.5, 6.8, 10.2, 13.6, 17, 20.4, 25.73333, 30.6, 33.78333, 37.11667 and 40.8 s.

| Time | Exact relative frame | Observation |
|---|---|---|
| 0 s | `scene-0.visual/0/1280x720-0.png` (sheet 0) | One neutral translucent saddle and coordinate axes establish the common world. |
| 10.2 s | `scene-0.visual/0/1280x720-3.png` (sheet 0) | Central blue and gold section constructions appear with perpendicular plane outlines. |
| 13.6–20.4 s | `scene-0.visual/0/1280x720-4.png` through `1280x720-6.png` (sheets) | Same upward/downward curves remain visible for comparison before moving points and equations. |
| 30.6 s | `scene-0.visual/0/1280x720-8.png` | Near-origin points and short straight tangents are distinguishable, providing an initial slope comparison. |
| 37.11667 s | `scene-0.visual/0/1280x720-10.png` | Away from origin, pale tangent strokes mostly coincide with the corresponding colored curves. |
| 40.8 s | `scene-0.visual/0/1280x720-11.png`, `scene-0.visual/0/960x720-11.png` | Final plus/minus slope labels are clear, but tangent strokes look like short curve highlights. Origin horizontal references are retained. |

## Mathematics and native finding

Mapping is `(x,y,z) -> [x,z,y]`. The common saddle uses `[x,x*x-y*y,y]`, blue section `[a,a*a,0]`, gold `[0,-a*a,a]`. Points share a positive a from 0 to 1.2. The blue tangent rotates about display z by atan(2a); the gold tangent rotates about display x by atan(2a), giving the correct slopes 2a and −2a in their respective coordinate directions. There is no sign mistake and no substitution of two unrelated planar graphs.

The straight tangent lengths remain 1.04 world units as they rotate. At a=1.2, their half horizontal-coordinate extent is 0.52/sqrt(1+2.4²)=0.2. Over that interval the section parabola departs from its tangent by at most 0.04 vertically. This small separation is consistent with what the native final frames show: a pale stroke along each curve, rather than a clearly separate straight extension. The mathematical direction exists in source, but the intended straight-line comparison is difficult to read at the later points. This is a readability finding, not a claim that the slope conclusion is false; point height changes and curve orientation still support its sign.

Concrete revision: extend and distinguish each tangent enough to expose a straight segment away from the curved section while keeping the same point and derivative direction. Recheck motion from 30.6–40.8 s and the final hold at both aspects. Do not infer that a color change alone will reveal straightness if the geometric separation remains below the stroke footprint.

The plot remains relatively narrow within the wide frame, but its curves and equations are readable at native size. Color consistently links blue/right x-section and gold/left y-section. The structured observation pause is purposeful. Ordered samples plus source timing support the progression; continuous transitions, player subtitles and live orbit remain unverified. No extra renderer, compiler diagnostic or export was run during review.

## Comparison status

Formal baseline saddle was initially rejected for short tangent segments merging with the sections, then delivered visibly longer straight extensions after repair. Spatial saddle passes the production gate without repair but retains an analogous readability weakness in the native final comparison. Both choose correct 3D and correct mathematics; first-pass approval does not by itself show visual improvement. Routing saddle remains pending for the complete same-case comparison. No generated source was modified.

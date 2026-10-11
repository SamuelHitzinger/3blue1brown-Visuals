# Formal spatial sine — independent native review

Experiment `73665671-b492-4d6c-acff-3069aca4d418`; isolated run `454dc97c-ecb0-487b-9cca-7e2f82c566d5`. Production completed and approved attempt 1 after one tick-label repair. Independently recomputed final source SHA256: `0d0cba9e523f4c6cb14da3b5cfb06d91ecc3a2c055bb536e7d6a00c459444b31`.

**Duration deviation:** actual duration is 34.734 s, 0.266 s below the requested 35–45 s range. This is a small explicit scope miss, not a renderer failure. It must not be silently rounded to 35 s or hidden by visual approval.

| Gate | Verdict | Evidence / limit |
|---|---|---|
| Dimensional choice | ready | Fixed planar graph; spatial-construction guidance did not force depth onto a planar claim. |
| Reasoning | ready within sampled scope | Moving landmarks retain y while x compresses; original and transformed curves, peak correspondence, period spans and amplitude measurement establish the claim. |
| Readability | ready | Repaired abscissa labels sit below curve minima with clearance at both aspects. Rings versus filled points supplement the blue/teal distinction. |
| Reference style | ready | One shared construction, semantic color, persistent geometry, local calculation and a final measured comparison. |
| Technical native | ready | Production rendered and approved the scene; final hash matches. |
| Technical encoded | unverified | No encoded movie or continuous playback inspected. |
| Requested duration | revise | 34.734 s is below the stated 35 s minimum. |

## Evidence inspected

Raw base:

`C:\Users\samue\.codex\worktrees\dimensional-prompt-eval\3yellow3white\data\dimensional-prompt-eval\runs\spatial\sine\454dc97c-ecb0-487b-9cca-7e2f82c566d5`

Viewed all four approved `scene-0.visual/1/{1280x720,960x720}-sheet-{0,1}.png` sheets and native `1280x720-{4,7,11}.png`, `960x720-11.png`. Read final source and narration. Ordered sample times are 0, 0.5, 3.8, 8.6835, 11.578, 14.4725, 17.367, 20.03333, 22.73333, 26.0505, 30.73333 and 34.734 s. The 0 s frame is the start of an initial 0.4 s axes fade, followed by the common graph; this is not a blank-render failure.

| Time | Exact relative frame | Observation |
|---|---|---|
| 3.8 s | `scene-0.visual/1/1280x720-2.png` (sheet 0) | Original blue cycle with five reference rings and full-width 2π span. |
| 11.578 s | `scene-0.visual/1/1280x720-4.png` | Compression interior: filled teal markers have shifted horizontally, preserving peak/trough height against stationary rings and ±1 guides. |
| 14.4725 s | `scene-0.visual/1/1280x720-5.png` (sheet 0) | Further compression, same object identities and stable axes. |
| 20.03333 s | `scene-0.visual/1/1280x720-7.png` | Local π/4 and π/2 guides relate the two peaks; abscissa text is below the curves, not crossed by the descending teal branch. |
| 26.0505 s | `scene-0.visual/1/1280x720-9.png` (sheet 1) | Input equality develops alongside the same retained geometric referents. |
| 34.734 s | `scene-0.visual/1/1280x720-11.png`, `scene-0.visual/1/960x720-11.png` | Both curves, two period spans and a unit amplitude bar remain readable; final tick labels have clearance. |

Source drives the transformed cycle and all five markers by the same smooth b from 1 to 2: `(u/b, sin u)`. A continuation grows over the remaining domain as b increases. Heights stay fixed while a complete cycle narrows from 2π to π. The initial and copied markers keep their roles; local peak guides and the short input equation explain rather than replace the geometric mapping. The repaired labels are farther below the x-axis but remain aligned to their ticks and avoid curve intersections.

No substantive native mathematical or composition defect was confirmed. Ordered action-interior samples are stronger motion evidence here than in routing sine, whose early compression fell between supplied samples, but neither set is continuous playback. No additional diagnostic compilation or export was run during this review.

## Sine comparison

All three formal runs choose appropriate 2D and establish correct input scaling. Each needed one automatic label-placement repair. Baseline finishes at 37 s with all sampled native gates ready. Routing finishes at 36.9 s but retains the independently observed 2π endpoint-label crossing. Spatial is visually ready in the inspected samples but misses the requested minimum duration by 0.266 s. Therefore the control provides no evidence that either candidate improves dimensional routing over baseline; it does show that both candidates preserve the planar choice in this sample. No general success-rate claim follows from one trial per strategy.

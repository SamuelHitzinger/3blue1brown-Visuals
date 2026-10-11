# Formal routing sine — independent native review

Experiment `73665671-b492-4d6c-acff-3069aca4d418`; isolated run `ef8e30c5-b8bd-4586-aeb9-89a50d3cab0c`. Production completed after one visual repair, approving attempt 1. One 36.9 s scene. Independently recomputed final source SHA256: `63f457f2c7dcfb45255d00708551fd9e2fa560744caf64313896b2d27cd7372f`.

| Gate | Verdict | Evidence / limit |
|---|---|---|
| Dimensional choice | ready | Fixed 2D graph supports the full input-scaling claim without unnecessary depth. |
| Reasoning | ready within sampled scope | Copy compresses from x to x/2 at unchanged y in source; native result retains corresponding landmark shapes, equal heights and half-width period. |
| Readability | revise | Repaired downward-zero label is clear, but the final second gold cycle intersects the numeral 2 of the 2π tick label. |
| Reference style | ready | Persistent graph, original/copy identity, meaningful color and marker correspondence, local input example, amplitude guides and measured period spans. |
| Technical native | ready | Approved native scene, both aspect sets and matching final hash. |
| Technical encoded | unverified | No encoded video or continuous playback inspected; early compression interior is not captured by the supplied native sample times. |

The remaining label defect prevents an unconditional independent ready verdict. Automatic approval is recorded without overriding this native finding.

## Evidence inspected

Raw base:

`C:\Users\samue\.codex\worktrees\dimensional-prompt-eval\3yellow3white\data\dimensional-prompt-eval\runs\routing\sine\ef8e30c5-b8bd-4586-aeb9-89a50d3cab0c`

Viewed all four `scene-0.visual/1/{1280x720,960x720}-sheet-{0,1}.png` sheets, plus native `1280x720-3.png`, `1280x720-8.png` and `1280x720-11.png`. Ordered sample times are 0, 0.5, 4.65, 9.225, 11.56667, 13.81667, 16.01667, 18.45, 23.66667, 27.675, 32.3 and 36.9 s. Read final source and narration. No generated code was changed.

| Time | Exact relative frame | Observation |
|---|---|---|
| 0 s | `scene-0.visual/1/1280x720-0.png` (sheet 0) | Original blue cycle and three distinct landmark shapes establish the common graph. |
| 4.65 s | `scene-0.visual/1/1280x720-2.png` (sheet 0) | Gold cycle is half as wide with corresponding peak, descending-zero circle and endpoint square; original remains visible. |
| 9.225 s | `scene-0.visual/1/1280x720-3.png` | Repaired downward-zero text clears the descending blue branch; landmark names/shapes make the correspondence inspectable. |
| 23.66667 s | `scene-0.visual/1/1280x720-8.png` | Local peak arrow and π/2 to π/4 input calculation connect unchanged height to horizontal input scaling. |
| 27.675 s | `scene-0.visual/1/1280x720-9.png` (sheet 1) | ±1 guides and trough markers show unchanged amplitude. |
| 36.9 s | `scene-0.visual/1/1280x720-11.png` | Period spans π and 2π, plus two gold cycles, show repetition. The rising final gold branch cuts through the white 2 in the 2π axis tick below the endpoint. |

## Native finding and concrete revision

At 36.9 s, the tick text is centered beneath `(2π,0)` while the gold sine branch approaches that point from below-left. The branch crosses the numeral's stroke. This was checked in the actual 1280 PNG, including a read-only pixel-color inspection of x=976–1028, y=338–376; it is not inferred solely from a reduced contact sheet. Shift the 2π tick annotation to a clear side of the endpoint or provide equivalent clearance, then recheck the final extension and hold at both aspects. Do not move the mathematical endpoint or alter the curve.

## Source and comparison

Source parameterizes a complete cycle as `(X(u/b),Y(sin u))`. Its morph uses the same sampled u points at b=1 and b=2, with matched marker moves and constant y. Thus the mathematical mapping and amplitude invariance are correct. The second gold cycle is added after the first period is established. The rendered samples show before/after and several explanatory holds; they skip the early compression interior, so smooth motion is supported by authored timing rather than continuous visual inspection.

Compared with formal baseline sine, both select correct 2D and preserve the mathematical invariants. Routing names three landmark roles before revealing the rule; baseline uses four markers and a longer visible compression construction. This run does not demonstrate a routing advantage over an already correct baseline. Both needed one production repair, but the baseline's final endpoint-label clearance was independently confirmed whereas this run retains an endpoint text crossing. This is a single-run comparison, not a reliability estimate.

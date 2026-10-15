# Capture framing validation — 2026-10-15

The previous detector searched only axis-aligned rectangles and required strong
contrast along almost every edge. It missed angled, faint, shadowed, and partly
obscured teaching surfaces. The replacement searches a fixed number of tilted
lines on the existing 320-pixel thumbnail, refines those lines, then validates
four supported sides using color as well as brightness.

Returned crops enclose the entire quadrilateral with a safety margin. Persistent
surface-color differences beyond the border distinguish a board from an internal
drawn diagram. Weak room-sized candidates lose to well-supported board boundaries.
Failed or unavailable detection still uses the entire image and clears old crops.

## Evidence

- Ten generated difficult scenes: **1/10 before, 10/10 after**, requiring both full
  content containment and meaningful removal of background. Includes tilt,
  perspective, faint contrast, shadows, distant slides, wide boards, occlusion,
  and writing with classroom clutter. Baseline source matches commit `432d340`.
- Three public-domain photographs: two boards cropped with independently marked
  bounds; one borderless whiteboard preserves the whole photo instead of selecting
  an internal diagram. Dimmed and mirrored variants of both positive photos pass.
- Blank, random noise, stripes, and internal diagrams with 2-, 5-, 8-, and 10-pixel
  strokes preserve whole-photo fallback. The 5-pixel diagram regression failed
  before the farther surface-color check was added.
- Real pixel/JPEG capture tests preserve both edge labels through camera zoom,
  crop, and notes handoff. Five repeated captures with small simulated hand motion
  request no additional hardware zoom, hence no repeated camera-settling wait.
- Focused capture suite: **44 passed**. Complete frontend suite: **194 passed**.
  Production TypeScript/Vite build passed. Independent review found the thick
  diagram issue; its regression and subsequent review passed after correction.
- Inspected the generated crop gallery: all generated teaching surfaces enclosed;
  real classroom crop excludes furniture; borderless diagram photo remains whole.

These are regression cases, not a representative accuracy dataset. No user's
camera images or physical phone were available. Severe perspective, missing
borders, glare, or unfamiliar clutter can still require whole-photo fallback;
geometric detection cannot establish semantic certainty for every rectangle.

## Latency

Offline benchmark: Node v24.15.0, AMD Ryzen 7 9800X3D, 16 fixtures (10 generated,
3 photographs, blank/noise/stripes), 10 warmup rounds and 60 timed calls per fixture.
Image loading and fixture rendering excluded; 960 measured calls per version.

| Detector | First cold call | Warm median | Warm p95 |
| --- | ---: | ---: | ---: |
| Previous | 7.72 ms | 1.08 ms | 2.20 ms |
| Improved | 17.05 ms | 3.64 ms | 7.52 ms |

Median increase: **2.56 ms per detection** on this desktop. These numbers do not
predict phone timing or include camera, JPEG encoding, upload, or note generation.
There is no added network/model request or timer. Detection still runs once for
steady captures. Hardware zoom changes retain the existing 250 ms settling delay
plus a fresh-frame wait and require re-detection; unchanged zoom avoids that wait.
Search uses at most 12 lines in each orientation, rejects bad candidates early,
and runs at the existing thumbnail size rather than full photo resolution.

## Reproduce

From repository root, in PowerShell:

```powershell
npm --prefix frontend/app test
npm --prefix frontend/app run build -- --emptyOutDir false
New-Item -ItemType Directory -Force .tmp
git show 432d340:frontend/app/src/captureFraming.ts | Set-Content .tmp/captureFraming-baseline.ts
node scripts/benchmark-capture-framing.ts .tmp/captureFraming-baseline.ts
```

The benchmark prints per-fixture timing and writes `.tmp/capture-framing-gallery.png`.
Green outlines show detected crops; orange outlines show whole-photo fallback.
Photo provenance is recorded in `frontend/app/tests/fixtures/boards/README.md`.

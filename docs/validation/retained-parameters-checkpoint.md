# Retained parameter and visual-detail checkpoint

2026-10-16. Local mechanical evidence across ten cases, five subjects and two
detail levels. **No new model trial, lecture upload or ten-second end-to-end claim.**
See [design](retained-parameters-design.md) and [machine-readable results](retained-parameters-results.json).

## What changed

Joined lecture authors can expose numeric dependencies once and later submit a
small program-scoped parameter batch. Existing native geometry, compiler sessions,
camera and animation epochs survive. No-op updates receive no coverage credit.
Speech-supported updates reuse exact phrase resolution and the original deadline.
Bounded world context retains exact included IDs/values/bounds, records omissions,
and marks parameters with removed dependencies unusable.

Independent review found and corrected three integration issues before release:
dependency descriptions could overflow the request budget; removed targets still
appeared usable; rapid paused seeking could display an old frame with a new time.
Exact character/UTF-8 boundary regressions also cover JSON boolean size changes.

## Same-content detail coverage

| Subject | Low detail | High detail | Retained change |
| --- | --- | --- | --- |
| Algebra | 17 line points | 129 line points | Slope and attached ordinate |
| Wave physics | 33 points on each of three curves | 129 points on each curve | Phase, preserving both inputs and sum |
| Probability | 33 points on each density | 129 points on each density | Standard deviation on shared axes |
| Multivariable calculus | 121 vertices / 200 triangles | 1,681 vertices / 3,200 triangles | Saddle curvature and two traces |
| Organic chemistry | 192 atom triangles | 3,072 atom triangles | Rigid rotation of the entire conformer |

Both molecular levels retain **24 atoms, 25 bonds and 29 bond strokes**, identical
source coordinates, element identities, radii and bond endpoints. Rotation does
not represent a reaction or molecular dynamics. Higher detail never substitutes
for more subject coverage; these are development fixtures, not unseen holdouts.

Four post-update samples per case match freshly constructed final-parameter
geometry exactly: **40 comparisons, maximum numerical difference zero**. Separate
analytic checks catch matched-but-wrong curves/surfaces, lost hydrogens, wrong bond
endpoints and nonrigid atom transforms. Compiler spying confirms the ten updates
invoke no compilation. Initial authoring still requires native JavaScript.

Local parameter patches contain **64–65 bytes**, compared with **839–3,953 bytes**
of native source. This measures representation size, not model output tokens or
generation latency. Per-case local compilation/update/sample timings remain in
the receipt; sequential order, warm runtime effects and excluded rendering prevent
a randomized speedup claim.

## Native visual evidence and framing correction

Final run: `data/realtime-workshop/retained-parameters/rkdjgWq/`.
It includes exact sources, frame JSON, snapshot renderer inputs, receipts and a
viewer manifest. At local time three seconds, both arms were rendered with native
WebGPU at 1280×720 and 960×720. Of 20 pairs, **17 are byte/pixel identical**. Three
translucent-saddle pairs differ on 5–13 pixels by at most one channel value.
Seven of eight unchanged-input rerenders also differ by one channel value. This
supports readback variability rather than an arm-specific effect; its precise
cause remains unproved. Do not describe all renders as byte-identical.

Original run `rmgqSNK` clipped a hydrogen at the bottom. That failed evidence is
preserved. Both arms and both caffeine detail levels now use the same uniform
root display scale of 0.7; no atom, bond, local coordinate or mesh detail changed.
Checks of full sphere radii at times 3–7 seconds and both widths give a minimum
85.69-pixel margin. Corrected caffeine renders match exactly. Eight unchanged
nonmolecular cases reuse hash-verified original render evidence; the three tiny
surface mismatches remain in the new receipt.

Reviewer `/root/live_inventory_host_audit` inspected the final paired caffeine
browser screenshot and found matching visible geometry, detail, colors and
framing, with no relative legibility loss. This was an informed screenshot review,
not blind acceptance, scientific validation, full-motion or lesson-style approval.

## Playback and validation

Run the local viewer with:

```powershell
./node_modules/bun/bin/bun.exe backend/bench/retained-parameter-view.ts data/realtime-workshop/retained-parameters/rkdjgWq/manifest.json
```

Open `http://127.0.0.1:5367/`. Select subject/detail, play both native worlds on one
clock, seek, and switch aspect ratio. Left creates final defaults; right updates
an existing world at local time three seconds. This compares post-update state,
not the timing of rebuilding an actively displayed scene. Both arms are handwritten.
Browser smoke checks confirmed WebGPU readiness and shared-clock surface/molecule
playback. Frozen readback does not measure hardware presentation.

Focused verification passed **125 tests across 12 files (4,538 assertions)**,
covering runtime transactions/cache races, model retention, protocol, speech
anchors, bounded history/context, dispatch, analytic geometry and framing. Strict
TypeScript checks passed. No shared rendering-library implementation changed.

Still required: matched model-authored edits and creations, supplied German lecture
plus independent online material, unseen subjects/assets, independent blind motion
review, and complete quality-accepted responses within the current **ten-second**
deadline. Smaller patches and passing local controls do not establish those results.

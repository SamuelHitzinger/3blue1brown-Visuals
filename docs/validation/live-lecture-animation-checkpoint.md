# Live lecture screen integration

2026-10-16. The main lecture page now includes **Start live animation**. It uses the shared `animlib/live` retained world and native renderer. New saved lecture sources trigger serial model requests; the response updates the existing canvas without waiting for synthesized notes.

## Behavior

- Creates objects from partial information, then applies property, parameter, motion, or complete program updates as more evidence arrives.
- Stop updates preserves the displayed world. Resume keeps its source cursor. Navigation or reload resets this browser-owned world.
- Hidden, suspended, finished, or unmounted lectures stop updates. Late responses cannot publish after cancellation. Failures require explicit retry.
- The server selects whole, owner-scoped source records; checks evidence freshness and world revision; bounds request/context sizes; and limits generation to one active request per lecture with a ten-second deadline.
- Capture and transcription delivery are unchanged. This integration consumes arrived source text; it does not provide word-level speech timestamps or promise ten-second microphone-to-display latency.

## Actual model and browser proof

`backend/bench/live-app-proof.ts` serves the real application against an isolated lecture database. Four synthetic facts were submitted sequentially through the existing source endpoint. Actual provider replies were used without mocks, repaired JavaScript, or automatic retries. Model: `gpt-6-luna`, reasoning off. Priority was requested; responses reported default tier.

| Arrived fact | Actual operation | Provider completion |
|---|---|---:|
| Cube A; motion unspecified | add | 2.206 s |
| Move right at 0.08 display units/s | motion | 2.607 s |
| Stop at current position | motion | 1.573 s |
| Correct shape to sphere | replace | 1.733 s |

The main lecture canvas visibly showed the cube, its changed position, stopped pose, and replacement sphere. These provider timings exclude capture, transcription, browser polling, preparation, and presentation. Screenshots alone do not prove continuity; runtime tests separately exercise continuous pose and replacement.

Evidence is retained locally under `data/realtime-workshop/live-app-01/`: isolated database, manifest, raw prompts/provider outputs, and five screenshots. `final-live-screen.png` shows the stopped-update screen with the sphere still visible. Evidence directories are ignored by Git. The fixture deliberately has no notes synthesis or capture configuration; those panel errors do not represent animation failures.

**Known visual defect:** the model created label A without `s.attach`, so the label stayed behind during motion. Replacement positioned it above the sphere again but did not fix attachment. This run proves main-screen integration, not robust labeling or broad visual-quality parity. Domain checks, complete baseline feature parity, imported animated assets, and persistent worlds remain future work.

## Verification

- 72 backend tests passed across animation, lectures, lecture view, request origin, and identity: 370 assertions.
- Six focused frontend tests passed, including actual native add → late motion → replacement, empty initial frames, cancellation, suspension, malformed replies, and explicit retry behavior.
- The full frontend suite passed 206 tests before the final native continuity regression was added; that new regression passed in the focused six-test run.
- `npm run app:build` passed, including shared library build, frontend TypeScript, and Vite output. Targeted backend/proof TypeScript checks passed.
- Independent integration review found and verified fixes for initial revision-zero frame handling and normalized edit validation. Rendered review retained the label defect above rather than claiming complete quality.

The shared-runtime extraction is committed separately as `c28bec0`. Built frontend assets are included because the normal server serves `frontend/site`.

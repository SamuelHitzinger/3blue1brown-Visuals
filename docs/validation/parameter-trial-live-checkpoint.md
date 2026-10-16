# Paired model trial: retained parameters versus source reconstruction

2026-10-16. The user approved the forty prepared OpenAI requests and regular pushes
to `visuals/codex/animation-authoring-efficiency`. One batch ran; no repair or retry
requests were made. No lecture video or evaluator answers were uploaded.

## Result

| Path | Requests | Provider completed | Numerical audit passed | Median completed response | Median output tokens |
| --- | ---: | ---: | ---: | ---: | ---: |
| Full source reconstruction | 20 | 17 | 13 | 3.278 s | 363 |
| Retained parameter update | 20 | 20 | 20 | 1.416 s | 49 |

The last two columns use available completed receipts, including semantically
failed responses. They are not a paired speedup calculation. Among the **13 pairs
where both paths passed**, the median within-pair response-time ratio was
**2.682029**, and median within-pair output-token ratio was **7.489796**. These
successful-pair statistics exclude all caffeine pairs and other failed baselines.
All retained responses completed within 2.999 seconds of request dispatch.

The source path failed seven times: three deadline-associated incomplete caffeine
streams near ten seconds, two responses using the wrong operation branch, and two
responses returning the original source byte-for-byte. Those unchanged sources
left both the requested function and its control default unchanged. Receipt error
classification for the deadline-associated failures is `PROVIDER/network`; no
successful provider terminal was received.

| Case | Source passes | Retained passes |
| --- | ---: | ---: |
| Slope, low detail | 2/2 | 2/2 |
| Slope, high detail | 1/2 | 2/2 |
| Waves, low / high detail | 2/2 each | 2/2 each |
| Gaussian, low / high detail | 1/2 each | 2/2 each |
| Saddle, low / high detail | 2/2 each | 2/2 each |
| Caffeine, low / high detail | 0/2 each | 2/2 each |

## Experimental boundaries

Seed 20261016, two counterbalanced repeats, ten development cases. Both paths saw
identical initial source, state summary, task and scene time. The assigned action
was the experimental difference. The source path reconstructs an isolated world;
it does not perform atomic replacement inside a running world. The retained path
applies the returned numeric values to the existing world.

Configuration requested `gpt-6-luna`, thinking off, priority, 2048 output tokens,
and a 10000 ms stream timeout. All payloads reported reasoning `none`; the adapter
did not forward an output-token cap. Thirty-seven completed responses reported
`default`; three incomplete receipts reported `auto`. **No priority delivery was
confirmed.** Available token receipts reported no cache reads.

Provider timings exclude capture, ASR, runtime setup, compilation, rendering and
display. The timeout begins after runtime setup. These measurements establish
neither ten-second speech-to-screen performance nor initial scene creation speed.
Tasks change one exposed parameter in known development scenes. Broader subjects,
new topology, asset discovery and unseen task generalization remain unmeasured by
this batch.

The evaluator checks the actual response against independent expected geometry at
seven scene times, original epochs, complete control definitions, ownership,
duration, renderer/camera options and topology. No model output was repaired.
Numerical correctness is separate from explanatory and perceptual quality.

## Visual comparison and review

The local viewer at `http://127.0.0.1:5369/` exposes all twenty unedited pairs.
It uses the actual returned source on the left and actual returned parameter
values on the right. Missing or wrong-branch source results remain visible as
failures; they are never replaced with handwritten answers. The two unchanged
sources remain rendered, with their failed audit identified. Playback and seeking
share scene time. All twenty cases were opened: fifteen baseline scenes and all
twenty retained scenes reached the native WebGPU ready state; five baselines
showed their recorded failure. Two rendered baselines still failed numerically.

A fresh reviewer saw only five cropped, unlabeled images without arm identities,
timings or audit results: surface and wave pairs at two times, plus the unchanged
Gaussian pair at one time. Surface and waves appeared equivalent between paths,
with visible state changes and no frame-edge clipping. The reviewer independently
noticed the Gaussian difference: one peak remained taller and narrower. Review
also found limited contrast around the surface neck and insufficient labels,
units and legends for a standalone explanation. These are runtime test scenes,
not finished lesson designs. Endpoint samples do not prove continuous smoothness
or absence of transient artifacts. Browser console emitted ResizeObserver loop
notifications during case changes; no additional arm render failure was observed.

## Reproduction and retained evidence

Approved manifest SHA-256:
`dda16e0ce41dee290d057f03299e4b2a31110b3d2c8c636704d9d1eef327380e`.
Configuration SHA-256:
`289c71c8f3e287abd7a5cad6c7de547d81fd39df2eea118e7f6391f075891349`.

Local evidence is retained under `data/realtime-workshop/`:

- `parameter-trial-prepared-01/`: forty frozen public request packets and separate
  evaluator-only oracle.
- `parameter-trial-live-01/`: original reports, stream events, completed/terminal
  calls, exact sent prompts/tools, envelopes, per-attempt runner receipts,
  `analysis.json`, `comparison-v3.json`, browser receipts and screenshots.
- `parameter-trial-evaluated-01/`: all forty numerical outcomes and successful
  sampled frames.
- `analyze-parameter-trial-live-01.ts` and comparison builders: local derivation
  scripts. The first analyzer invocation failed on an import path before any
  evaluation; the corrected invocation performed the evaluation once.

Runner CLI requires explicit execution and a new output directory. Run only with
authorization for the intended requests/destination:

```powershell
./node_modules/bun/bin/bun.exe backend/bench/realtime-media/parameter-trial-run.ts --execute BUNDLE_DIRECTORY NEW_OUTPUT_DIRECTORY
./node_modules/bun/bin/bun.exe backend/bench/retained-parameter-view.ts data/realtime-workshop/parameter-trial-live-01/comparison-v3.json --port=5369
```

The runner verifies all public request/config/tool hashes before opening a runtime
and again before each dispatch, sends the frozen system prompt verbatim, validates
saved provider prompt/tool evidence, and preserves failures without retries. An
independent audit confirmed forty unique scheduled IDs in order and matching
request/envelope/evaluation evidence. The approved top-level manifest hash was
checked immediately before invocation.

Verification: 29 probe tests and 25 runner/evaluator tests passed, zero failures;
strict targeted TypeScript checking passed. Viewer strict TypeScript and isolated
UI-state tests passed, followed by the actual twenty-case browser check above.

## Architectural implication

Prioritize a retained scene with exposed semantic controls and small validated
operations. Let the model select the meaningful change; keep geometry, animation
bindings and timing in reusable code. This batch supports that choice for exposed
parameter edits. It does not justify replacing complex new construction with
parameters, lowering visual detail, or declaring the complete lecture pipeline
finished. Next acceptance work is unseen construction/edit tasks and measured
speech-to-render execution, using the same failure-preserving evaluation approach.

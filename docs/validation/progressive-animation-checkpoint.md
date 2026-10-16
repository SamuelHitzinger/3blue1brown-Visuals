# Progressive animation implementation checkpoint

2026-10-16. Runtime and live-author integration committed in `f490f5f` on `codex/animation-authoring-efficiency`.

## Implemented behavior

- The live author now creates an identifiable object before dependent facts arrive. Unknown velocity remains unknown; a provisional held object does not assert physical rest.
- `motion` adds or changes constant local velocity on an existing entity. The host samples its current pose and anchors motion at publication time. Reversal and stopping preserve position; motion continues beyond the original authored duration.
- `replace` prepares complete native source and atomically replaces one program. Stable entity identities, the original epoch, compatible host overrides/motion, and shared numeric control values survive. Unrelated programs keep running.
- Native JavaScript remains available for custom geometry and topology. The author uses compact parameter/property/motion operations when sufficient, and complete source replacement when structure changes.
- Strict opt-in tool branches, bounded current-motion context, operation history, browser dispatch, and existing speech/deadline guards carry both new operations. The live caller enables them; legacy probe schemas remain unchanged when disabled.
- Prompt guidance distinguishes factual correction from a new physical event, documents round spatial bonds, and asks for placement against existing scene content.

The initial implementation lived in the retained-world/live-lecture path under `backend/bench`. The runtime has since moved to `animlib/live` and is connected to the main lecture screen; see the [main-app integration checkpoint](live-lecture-animation-checkpoint.md). The image-only baseline author is unchanged.

## Model evidence

Two immutable eight-request runs use only past synthetic text and each preceding **actual generated world**. No repaired source or ideal prior scene is injected. One request per step, no automatic retries. Model: `gpt-6-luna`, reasoning off, 10-second timeout. Priority was requested; the provider reported **default** for every response. The adapter also omitted the requested output-token cap.

Latest run (`progressive-model-02`), measured dispatch to valid tool completion:

| Input | Operation | Model time | Local compile/commit |
|---|---|---:|---:|
| Cube identified; attributes unknown | add | 3.979 s | 34.5 ms |
| Velocity sentence incomplete | defer | 3.561 s | — |
| Velocity +0.6 supplied | motion | 2.404 s | 0.69 ms |
| Velocity changes to −0.4 | motion | 3.876 s | 0.20 ms |
| Stop | motion | 1.480 s | 0.17 ms |
| Correct cube to sphere | replace | 2.241 s | 17.1 ms |
| Add 20×20-cell saddle | add | 2.294 s | 26.7 ms |
| Add benzene schematic | add | 4.907 s | 18.9 ms |

Both runs passed their eight partial operation/continuity checks. **This is not eight scientifically or visually correct scenes.** Review of run 01 found an overlapping molecule and flat bond strokes. The prompt and checks were strengthened, preserving the original result. Run 02 fixes those two issues but still draws the three supposed double bonds as radial ticks, perpendicular to the corresponding ring edges, rather than parallel second bonds. The molecule therefore **fails scientific-quality review**. The generated label for A is also unattached and remains at its initial position during motion, despite the attached-label prompt guidance. No further model repair loop was run, and no universal quality claim follows from the timing results.

The saddle and sphere demonstrate native geometry capability; they do not establish arbitrary-subject parity. These are two small sequential runs, not a p95 latency study or a causal speed comparison with baseline. Timings exclude input capture, ASR, network delivery of evidence, GPU preparation, rendering, and presentation. The test world uses a deterministic clock; local commit timings do not include renderer asset preparation.

Compact measurements and explicit audit outcomes: [results](progressive-animation-results.json). Full local evidence: `data/realtime-workshop/progressive-model-01/` and `progressive-model-02/`, including exact prompts, schemas, provider events, submissions, frames, hashes, and failures. These local directories are ignored by Git.

## Runtime and browser verification

- 190 focused Bun tests passed across 16 files: world/protocol, dispatcher/history/context, speech deadlines, prior paired-trial regressions, proof fixtures, and the strengthened molecule checks.
- Strict targeted TypeScript passed for changed runtime integration, tests, model probe, and browser proof.
- Library suite: 1,252 tests passed in sandbox; one Windows junction test was blocked by `EPERM` and passed when rerun outside sandbox. An earlier default-temp run failed Vite module loading; using workspace-local `TEMP`/`TMP` resolved that environment issue.
- Independent runtime review found and verified fixes for retained-time callbacks, implicit normals ownership, and replacement morph conflicts. Regressions were demonstrated failing before the fixes.
- Native WebGPU browser proof completed all six scripted steps: cube creation, late motion after its two-second authored duration, reversal, stop, sphere replacement, and a custom 1,089-vertex surface. The stopped pose remained `x = -1.950` across replacement; world revision reached 7 with three retained programs. Attached label and unrelated reference program remained visible.

Launch the interactive proof:

```powershell
./node_modules/bun/bin/bun.exe backend/bench/progressive-view.ts
```

Open `http://127.0.0.1:5370/`. This page uses scripted inputs and the native runtime; it does not run a model or speech recognition. Screenshot: `data/realtime-workshop/progressive-model-01/browser-proof.png`.

## Remaining limits

Motion currently means constant local velocity. Reactive/attachment-owned positions reject conflicting motion; new motion laws may require source replacement. Native callbacks still clamp at authored duration. Replacement validates sampled-time behavior, not every possible future callback execution.

The retained world still excludes camera/view tracks, audio/input behavior, cross-program attachments, and dynamic GLB animation/skinning/morph playback. Complete baseline capability parity remains unfinished. Partial-transcript capture/delivery was not changed; an object can appear only after its identifying evidence reaches the author and a validated response commits.

Scientific geometry and layout need stronger reusable domain checks: the retained benzene failure is direct evidence. Ambiguous/revised ASR nouns, unseen subject families, broader detail levels, and end-to-end speech-to-visible latency still require evaluation. The implementation does not promise that arbitrary visuals will be correct within ten seconds.

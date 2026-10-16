# Measured speech-to-render latency

2026-10-16. One 24-second paced synthetic-audio run through the actual capture ingestion, ElevenLabs transcription, OpenAI animation service, and main lecture page. No source text, model response, or generated JavaScript was repaired. The test exposes failures; it is not a passing acceptance run.

## Results

The end marker below is the next browser animation-frame opportunity following the first observed successful WebGPU submission for the committed update. This is not a physical monitor presentation measurement. Audio boundaries are the first/last synthetic PCM samples exceeding amplitude 100.

| Spoken event | From phrase start | From phrase end | Outcome |
|---|---:|---:|---|
| Consider a cube | 8.050 s | 7.076 s | Cube rendered and visually observed |
| Move right at one unit per second | 5.221 s | 2.929 s | Motion applied, but exact speed inferred from incomplete consumed transcript |
| Stop the cube | 10.318 s | 9.363 s | Stop applied after cube left viewport; not a successful visible stop |
| Change cube into sphere | — | — | Model deferred; replacement never rendered |

**The ten-second visual-response target is not reliably met.** Stop exceeds ten seconds from phrase onset. A rendered operation is not necessarily a useful visible change; the final canvas was empty because the cube was offscreen. No successful overall latency average is reported for this failed four-event sequence.

## Where time went

Cube creation, measured from phrase end:

| Stage | Time |
|---|---:|
| Wait for audio window to finish | 0.916 s |
| Local upload, transcription, source persistence | 0.658 s |
| Wait for animation request | 0.416 s |
| Animation request | 5.028 s |
| Response through next browser frame opportunity | 0.058 s |
| Total | 7.076 s |

Stop: 0.942 s window wait + 0.519 s upload/transcription/source + 2.538 s request wait + 5.354 s animation request + 0.009 s browser = 9.363 s after phrase end. The request wait includes an earlier model decision on the incorrect partial ASR text `Stop the queue`, then polling delay.

All 23 transcription requests completed; 14 returned empty text for silence. Transcription alone ranged 0.187–0.922 s, median 0.474 s. Nine nonempty sources were appended in capture order. No upload failure occurred. Replay release lateness was 0–3 ms. Browser and server clock observations agreed within about 1.4 ms; the frontend records wall clock and monotonic time separately.

## Functional failures retained

1. Motion consumed `The cube moves right` and `The cube moves right at one unit per`. It set velocity to 1 unit/s before the complete `At one unit per second` source entered its request snapshot. The output happened to match the later evidence, but this is not a grounded exact-speed success.
2. The cube moved beyond the current view before stop finished. Runtime submission timings therefore do not prove visible stopping. The saved moving screenshot already shows clipping at the right edge; the final screenshot is blank.
3. The model deferred sphere replacement despite complete source text, claiming missing measured transcript timing. The main adapter explicitly permits null speech anchors for this input. This is a model/contract interpretation failure, not missing audio evidence.

## Scope and reproducibility

The run reproduces the production two-second audio windows with one-second overlap, serial uploads, capture ingestion, actual transcription, source-driven model requests, and native rendering. It uses local WAV replay, excluding phone network latency, microphone hardware, MediaRecorder encoding, and physical display scanout. Notes synthesis is disabled in the isolated database, so notes-panel configuration errors are expected. Initial live renderer setup occurred before the audio clock began. This small synthetic run does not establish p95 latency, complex-scene performance, or real-classroom recognition accuracy.

Model: `gpt-6-luna`, reasoning off, ten-second request deadline, no automatic retries. Priority was requested; all six provider receipts report actual tier `default`.

Reproduction tools:

- `backend/bench/create-live-latency-audio.ps1`: offline Windows voice to four synthetic WAV phrases; requires Windows PowerShell and Microsoft Zira Desktop.
- `backend/bench/prepare-live-latency-audio.mjs`: full track, explicit phrase boundaries, and 23 overlapping windows.
- `backend/bench/live-app-latency.ts`: isolated real app/capture service on port 5371. Supply a new evidence directory and the generated manifest. Load the existing backend environment; never print its secrets.
- Open its lecture URL with `?liveTiming=1`, click Start live animation, then POST all manifest clip IDs to `/__latency/start` with matching local Origin. No provider call starts before evidence arrives.
- Collect console records beginning `LIVE_ANIMATION_TIMING ` into `browser-timing.json`, then run `backend/bench/summarize-live-latency.mjs` on the evidence directory. No hidden browser state was inspected.

Local evidence: `data/realtime-workshop/live-latency-audio-01/` and `data/realtime-workshop/live-latency-01/`. Includes exact audio, source timestamps, transcripts, provider requests/replies, browser timestamps, `first-visible.png`, and `final-screen.png`. Those folders are ignored by Git. Compact results are tracked in [live-lecture-latency-results.json](live-lecture-latency-results.json).

Verification: app build passed; seven focused frontend tests passed, including timing correlation/deduplication and retained cancellation/continuity checks. Harness strict TypeScript passed. Two independent reviews agreed on timing arithmetic, incomplete evidence, missing replacement, and offscreen stop. No functional repair was applied during this measurement run.

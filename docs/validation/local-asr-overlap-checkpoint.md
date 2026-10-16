# Past-context ASR overlap checkpoint — 2026-10-16

Rolling eight-second audio, decoded every four seconds, repaired one observed English boundary phrase at the following update. It did not remove all English errors and did not establish better German accuracy. This is a local paired recognition experiment, not stable transcript reconciliation or a completed audio-to-animation pipeline.

## Controlled probe

`backend/bench/realtime-asr-overlap-probe.ts` reuses `openPcmWav`, `pacePcm`, `WorkerLineReader`, and the unchanged `local-asr.py stream` worker. It changes neither the production producer nor decoder settings.

- Sources: the existing German and MIT English mono 16 kHz PCM16 clips, source time 885–905 seconds. No new media or weights downloaded.
- Decoder: pinned local multilingual base revision `ebe41f70d5b6dfa9166e2c581c45c9c0cfc57b66`, CPU int8, eight threads, one worker, beam size 1, temperature 0, word timestamps, no VAD, no previous-text conditioning, no prompt. All four model-package files matched their earlier download hashes in a post-run check.
- Each source has two 20-second runs. At every four-second endpoint, one worker processes both arms serially. Independent-first and rolling-first runs counterbalance processing order. No competing ASR workers run concurrently.
- Independent arm receives only the latest four seconds. Rolling arm receives the previous released chunk plus the current released chunk, at most eight seconds. Both arms receive identical four-second input at the first endpoint.
- `pacePcm` reads each new chunk only after its source endpoint. The rolling buffer contains previously released samples; it never reads future PCM. All 20 actual releases and 40 inference sends passed the no-early-read/send checks.
- Each run releases 20 seconds of unique source audio and decodes 56 seconds across both arms: 20 independent plus 36 rolling. The unchanged worker accepts at most ten chunks and 56 decoded seconds. A 90-second host timeout bounds each run.
- Raw PCM, raw transcript/word estimates, source spans, recognizer settings, worker clock receipts, host events, and failure evidence remain local. No transcript corrections, reference text, or semantic reconciliation feed the decoder. Python retains its offline flags and network audit guard. Provider requests: zero.

Evidence root: `data/realtime-workshop/asr-overlap-paired-01`. Each of four run directories contains `result.json`, `host-events.ndjson`, and immutable `worker/chunk-*/{audio.pcm,input.json,trial.json,receipt.json}`. Root `metrics.json` and `provenance-check.json` record aggregate checks; `local-asr-overlap-results.json` preserves a sanitized tracked copy. All 40 PCM hashes matched their input receipts; all reported word spans fell within their input windows. Recognized text matched exactly across the two orderings for both sources. This repeatability does not prove correctness.

## Measured cost

Warm inference values exclude the first endpoint from both arms; each row contains eight observations, four subsequent endpoints in each ordering. Inference timing includes float conversion and exhausting the lazy transcription/word-alignment output. It excludes collection, initial model loading, and host transport.

| Source | Arm | Median inference ms | Range ms |
| --- | --- | ---: | ---: |
| MIT English | Independent four seconds | 214.6 | 209.7–220.4 |
| MIT English | Rolling eight seconds | 232.8 | 226.4–248.5 |
| German | Independent four seconds | 221.3 | 214.5–247.7 |
| German | Rolling eight seconds | 248.9 | 231.8–268.9 |

Across warm paired trials, observed source-endpoint-to-host-receipt spans 215.2–527.7 ms. This includes serial processing of the other arm when applicable. It is not an estimate of single-arm deployment latency. Adding four seconds yields elapsed time from the start of the newest collection interval, not a bound on semantic correction or final animation response. Python and host clocks remain separate; only host timestamps establish receipt availability.

## Actual boundary behavior

At source endpoint 901, independent recognition returns `software`; rolling recognition returns `soft`. Both remain incorrect against the existing public caption check. At endpoint 905, rolling input 897–905 returns `solved this problem`. Thus the repair requires the next four-second update; it cannot be backdated to endpoint 901 or the estimated word time.

The recovered word's model-estimated interval is 900.72–900.98, but its result becomes available after endpoint 905 plus 231.5–455.4 ms observed host delay, depending on processing order. The same rolling output still substitutes `naturally` where the existing official captions say `actually`. The earlier `Professor D` substitution and `square` versus `squared` error also remain. The public caption source and its immutable hash are documented in `local-asr-checkpoint.md`; captions were not supplied to this probe.

German rolling output remains visibly fragmented and changes some previously recognized phrasing unfavorably. Exact private speech is retained only in ignored evidence, not this tracked report. Without a human reference transcript, this experiment cannot establish German word error rate or a net accuracy gain.

## Architecture implication and limits

Past audio context is cheap enough to investigate further on this machine, but overlapping transcript text must not be appended directly: earlier words recur and can change. A future reconciler needs provenance-preserving tentative/revised speech records and explicit availability times. This experiment implements none of that and does not grant either arm authority to commit scientific meaning.

Two short passages, one model, one CPU configuration, and two orderings do not establish general subject/language performance. No WER, timestamp calibration, live microphone capture, provider generation, world mutation, rendered result, or ten-second end-to-end success is measured.

## Validation and reproduction

Three focused tests, 13 assertions, cover exact current/past PCM composition, the first-endpoint control, and malformed/noncontiguous context rejection. Those tests plus the unchanged producer suite passed: ten tests, 44 assertions. Targeted strict TypeScript checking passed.

```powershell
./node_modules/.bin/bun.cmd test ./backend/bench/realtime-asr-overlap-probe.test.ts
./node_modules/.bin/bun.cmd backend/bench/realtime-asr-overlap-probe.ts data/realtime-workshop/NEW-ASR-OVERLAP-RUN
```

Use a new output directory. The probe freezes its own source before starting. Aggregate analysis was performed afterward; raw trials remain the primary evidence.

# Paced recorded-media ingestion — 2026-10-16

`backend/bench/realtime-media-stream.ts` now releases actual PCM from a local WAV
on a fixed source clock to the long-lived local ASR worker. A real 20-second
public MIT run delivered five four-second windows and received five measured
recognition results. This is a paced recorded-source integration probe, not
microphone capture, external model authoring, world publication or visible-frame
acceptance.

## Run and protocol

The CLI requires explicit source, clock offset, Python runtime, local model and
new output directory. The parent of the output directory must already exist.

```powershell
.\node_modules\.bin\bun.cmd backend/bench/realtime-media-stream.ts run --audio=data/realtime-workshop/media/mit-oscillations/t0885-0905.wav --source-id=public-mit-oscillations --source-offset=885 --python=C:/Users/samue/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe --model-path=.tmp/realtime-media/models/models--Systran--faster-whisper-base/snapshots/ebe41f70d5b6dfa9166e2c581c45c9c0cfc57b66 --out=data/realtime-workshop/asr/NEW-PACED-RUN --duration-seconds=20
```

Duration must be a multiple of four seconds, from 4 through 60, and fit within
the file. `source-offset` maps the beginning of that file to lecture time; it
does not seek within the WAV. Language defaults to `en`; use `--language=de`
or another supported two/three-letter code for a different source. Only local
ASR runs; nothing uploads audio or transcript.

The producer validates RIFF/WAVE chunk boundaries and exact file size, requires
one PCM data chunk, and accepts only mono 16 kHz signed PCM16. Format headers are
read before startup, while PCM remains unread. It skips other RIFF chunks by
their declared bounded offsets, caps file size at 64 MiB and chunk count at 256,
and rechecks file size/modification time around each bounded PCM read. Each
released PCM chunk has its own SHA-256. Final `releasedPcmSha256` covers only
successfully written PCM, not the WAV header or unread future audio.

The worker loads once, then emits `ready`. Only then does the host establish a
source epoch. The host waits until epoch + 4, 8, 12, ... seconds before reading
and sending each corresponding chunk. No cached transcript or precomputed
recognition output is used. Late processing does not move these deadlines.

The producer exports `runPacedStream(options)` with an `AbortSignal` and a
synchronous `onEvent` callback. It also writes each event to `events.ndjson` and
emits NDJSON on CLI stdout. Principal events are:

- `ready`: raw Python startup receipt and observed host receipt time.
- `source-clock`: source ID, source origin in milliseconds, host monotonic
  origin, and rate one.
- `source-release`: identity, source window, scheduled endpoint, actual PCM read
  start, pipe-dispatch start, release lag and exact PCM hash.
- `source-sent`: successful completion of the pipe write.
- `inference-start`: host observation of the worker's start event; raw Python
  fields are retained under `python`.
- `trial`: raw Python trial/receipt plus the host availability bracket below.
- `backpressure`, `worker-error`, `error`, `shutdown-request`, `worker-complete`
  and `closed`: lifecycle/failed-attempt evidence.

There are at most two outstanding chunks. At that limit the producer records
backpressure and waits for one result before reading another window. The source
clock continues; any resulting delay remains visible in `releaseLagMs`. Pipe
writes are awaited, output lines are bounded to 1 MiB, total worker stdout to
32 MiB and retained stderr to 64 KiB. The host never silently discards an old
chunk to make a newer run look faster.

The default ready timeout is 30 seconds and per-chunk timeout is 10 seconds from
pipe-dispatch start. Both have explicit CLI overrides. A separate absolute host
deadline bounds startup + source duration + one final trial allowance + five
seconds for closure. Timeout, input/output failure, malformed worker output or
external abort kills the Python process. The result records `killRequested`,
`workerClosed` and its exit status; a failed kill acknowledgement must not be
reported as a successfully stopped worker. SIGINT/SIGTERM use the same abort
path. Normal shutdown waits for all results, sends the worker's shutdown message
and checks successful completion/exit.

## Timing and MediaReplay handoff

Each host run and Python worker has a distinct clock-domain ID. All source
deadlines and host receipts use host `performance.now()` milliseconds. Python
`perf_counter` timestamps are kept unchanged. There is no cross-process absolute
timestamp subtraction or fabricated clock calibration.

A `trial` event includes:

```json
{
  "availability": {
    "kind": "observed-host-bracket",
    "chunkSentAtMs": 1234,
    "trialReceivedAtMs": 1510
  },
  "python": {
    "trial": "the actual LocalAsrTrial object",
    "receipt": "the unchanged Python receipt",
    "trialRef": "the retained trial JSON path"
  }
}
```

The numbers above illustrate field names, not a measurement. `chunkSentAtMs`
is the host's dispatch-start boundary before event persistence and pipe write;
it is deliberately conservative, not exact worker receipt or inference start.
`trialReceivedAtMs` is when the host parses the complete trial line, after the
worker has persisted and emitted it. The host verifies that this bracket covers
the worker's measured inference duration, and that the source window/hash and
worker receipt identity match the submitted chunk. Worker absolute times are
used only for ordering and duration checks inside their own domain.

The existing `MediaReplay` adapter accepts this exact availability kind. Map
`source-clock.sourceStartMs` and `monotonicStartMs` to its `sourceClocks`, and feed
the trial, raw trial reference, source ID, chunk ID and a version of one to
`ingestAsrTrial`. A future overlapping-recognition reconciler must explicitly
decide evidence identity/version; this producer does not call each successive
chunk a correction of the previous one.

ASR availability is actual host receipt. Raw endpoint-to-receipt time is also
recorded, but the earliest sample of each chunk was released from the source
clock four seconds earlier. Neither of those metrics includes a subsequent
authoring request or browser-visible explanation.

## Observed public run

Run `data/realtime-workshop/asr/mit-paced-stream-base-01` uses the already-local
public MIT clip from source 885–905 seconds and the existing pinned multilingual
base model, CPU int8, eight threads and beam one. Import was 236.93 ms and model
load 213.17 ms. Host source epoch began only after worker readiness.

| Source window (s) | Release lag (ms) | Worker inference (ms) | Host window endpoint to trial receipt (ms) |
| --- | ---: | ---: | ---: |
| 885–889 | 1.38 | 263.16 | 268.38 |
| 889–893 | 0.77 | 214.98 | 219.58 |
| 893–897 | 0.84 | 215.12 | 219.82 |
| 897–901 | 1.28 | 210.31 | 214.73 |
| 901–905 | 0.67 | 212.89 | 218.27 |

All five release/read-start times were at or after their fixed source endpoint.
The run wrote 640,000 PCM bytes and exited successfully. No future PCM was sent,
no official caption or full-clip transcript entered recognition, and no source
text was corrected for the report. The known hard-window transcription errors
remain in exact local trial artifacts. This single run is not a reliability or
latency distribution.

`bridge-check.json` in that run subsequently fed the five **recorded observed
receipts** into `MediaReplay`. All validated, and each evidence record remained
hidden until its own host receipt time. This is a retrospective adapter contract
check, explicitly not a claim that a model/world/render pipeline ran live.

Three separate fault-injection runs are retained:

- `mit-paced-stream-timeout-01`: a deliberate 100 ms startup timeout failed
  before any source epoch or PCM release. It exposed an unnecessary three-second
  timer that kept the CLI alive after worker exit; the timer is now cleared.
- `mit-paced-stream-timeout-02`: repeated the 100 ms startup timeout after that
  fix. Worker exit is `SIGKILL`, `workerClosed=true`, zero PCM, and the retained
  host outcome finished about 114 ms after host start.
- `mit-paced-stream-abort-01`: external abort immediately after worker readiness.
  Worker exit is `SIGKILL`, `workerClosed=true`, zero PCM, with no first-window
  release. This validates the real process abort path while source pacing waits.

No failed run was overwritten or folded into successful content evidence.
Successful run 01 predates the later cleanup/exit-detail and producer-source
snapshot additions. Current runs additionally save `producer-source.ts` and its
SHA-256 in `started.json`; the worker independently retains its source hash.

## Focused verification and remaining work

Seven Bun tests (31 assertions) cover bounded WAV parsing, unsupported/truncated
formats, exact source-endpoint gating, late work without deadline rebasing,
abort before PCM reads, invalid duration/early wakeup rejection, and the two
cancellation regressions below. Targeted
strict TypeScript checking passes. These deterministic tests and the real
public smoke address different boundaries; no synthetic transcript counts as a
successful source run.

Independent review found two cancellation gaps after the recorded smoke:

- An external abort during the initial asynchronous output-directory creation
  could occur before listener registration and be lost. The regression aborts
  immediately after calling `runPacedStream`, while that first await is pending.
  Before the fix it attempted to spawn the deliberately nonexistent worker;
  afterward it retains the original abort reason, emits only `error`/`closed`,
  writes a failed result, and starts no worker or PCM read. Registration now
  rechecks an already-aborted external signal, and setup rechecks the internal
  signal before source work and immediately before process spawn.
- An `inference-start` callback could abort while a complete `trial` already
  occupied the same stdout buffer. The existing bounded line-framing code now
  lives in the production-used `WorkerLineReader`, so a test can deliver that
  exact two-message buffer without a model or a special runtime option. Before
  the fix both messages reached the consumer; afterward the first callback's
  cancellation throws and the trial never reaches it, including on later input.
  Consumption checks cancellation at each line, and the world-facing trial
  publication/acceptance path also checks the internal signal before publishing
  and before incrementing accepted counts. Lifecycle failure/closed receipts
  remain writable after cancellation.

Both regressions were observed failing before their fixes and passing afterward.
The earlier successful public smoke remains unchanged; it does not retrospectively
test these cancellation cases.

The next join is a source-grounded model request consuming arriving packets,
then an atomic retained-world transaction and browser pixel observation. Keep
its source/model/world clocks and cancellation connected to this evidence.
Private lecture audio/transcripts remain unauthorized for external model upload.

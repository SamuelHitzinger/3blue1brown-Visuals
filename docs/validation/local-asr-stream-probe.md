# Local ASR stdin receiver — 2026-10-16

`backend/bench/realtime-media/local-asr.py stream` now loads one local recognizer
and accepts bounded PCM chunks over stdin. It preserves the existing `run`,
`download` and `self-test` commands. This is a benchmark ingestion adapter, not a
complete live lecture pipeline or a speed/accuracy acceptance claim.

## Protocol

Send UTF-8 NDJSON with a newline after every message. One chunk has exactly these
fields:

```json
{"type":"chunk","id":"mit-0","sourceId":"public-mit-oscillations","sourceStartSec":893,"sourceEndSec":897,"pcm16Base64":"BASE64_PCM_BYTES"}
```

The audio is mono, 16,000 Hz, signed 16-bit little-endian PCM, without a WAV
header. Bytes must exactly match the declared positive source duration to the
sample-count tolerance (1e-7 seconds). Maximum chunk duration is eight seconds.
Chunk/source IDs are bounded identifiers, never paths. IDs must be unique for
the entire receiver process, including across source IDs. Source windows may
overlap when chunk IDs differ; this receiver does not reconcile overlapping
words or silently treat them as corrected stable text.

The receiver rejects unknown/missing fields, duplicate JSON members, nonfinite
numbers, invalid IDs, malformed base64, odd byte counts, mismatched duration,
duplicate chunk IDs and exceeded budgets before that chunk reaches inference.
A malformed message terminates the stream with an error; it is not skipped.
No chunk field can ask the receiver to open a caller-supplied audio filename.
The trusted CLI supplies the already-local model directory and output directory.

Output messages are:

1. `ready`: model/import durations, settings, limits and unique clock domain.
2. `inference-start`: chunk identity and observed process timestamps.
3. `trial`: the existing `LocalAsrTrial` field shape, plus `receipt`, `trialRef`
   and PCM SHA-256. Actual segments and estimated word times are preserved.
4. `complete` or `error`: final status, counts and completion timestamp.

Send `{"type":"shutdown"}` to finish, or close stdin. Explicit shutdown exits
even if the producer keeps stdin open. Shutdown is consumed between chunks;
it cannot interrupt an already-running native inference. Stdout is protocol
data and is flushed after every message. Unicode is preserved through ASCII JSON
escapes, so output remains valid UTF-8 JSON even with Windows legacy stdout
encoding. Consumers must continue draining it.

Example launch from repository root:

```powershell
$python = 'C:/Users/samue/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe'
& $python -B backend/bench/realtime-media/local-asr.py stream --model-path=.tmp/realtime-media/models/models--Systran--faster-whisper-base/snapshots/ebe41f70d5b6dfa9166e2c581c45c9c0cfc57b66 --out=data/realtime-workshop/asr/NEW-STREAM --language=en
```

A host should start the process with pipes, wait for `ready`, send an actual
available chunk, and consume `inference-start` and `trial`. Repeat in the same
process. Pipe construction/pacing belongs to that host, not this command.

## Bounds and artifacts

Defaults are 120 chunks, 480 cumulative audio seconds, 30 seconds without
available input, and a 600-second session. CLI maxima are 512 chunks, 4,096 audio
seconds, 300 idle seconds and 3,600 session seconds. The line ceiling is the
eight-second base64 size plus 2,048 bytes of envelope allowance. The reader uses
64 KiB blocks, a one-line queue and bounded pending bytes; stdin backpressure
prevents an unbounded in-memory arrival queue.

Idle/session checks occur while waiting and between operations. A session that
expires during recognition retains the measured result as evidence but emits
an error rather than an accepted `trial` event. These are **not hard native
inference or blocked-stdout deadlines**. The enclosing host must terminate the
process to interrupt a stuck inference, enforce its own absolute end-to-end
deadline, or cancel an active chunk. A killed process may leave `started.json`
without a completion receipt; never infer success from that artifact.

The output directory must be new. Files use exclusive creation. Each accepted
chunk gets `chunk-NNNN/input.json` (metadata/hash, no duplicated base64),
`audio.pcm`, `started.json`, `trial.json` and `receipt.json`. A failure after
input persistence adds `failure.json`; no fabricated successful trial is made
for a recognizer exception. Stream `started.json`, `ready.json` and `result.json`
retain settings/startup/final outcome. Protocol errors expose fixed codes and
exception types, not raw exception messages containing source text.

Offline Hugging Face flags, `local_files_only=True`, and the existing socket
audit guard apply to stream inference. There is no download fallback or remote
transcription endpoint. Inputs and recognition artifacts can be sensitive;
retain them only in the ignored local run directory.

## Timing boundary

Every process gets a `python-perf-counter:UUID` clock-domain identifier. Values
are Python `time.perf_counter()` milliseconds, not Unix time or browser
`performance.now()`. Receipt fields distinguish:

- `receivedAtMs`: the reader observed a complete input line, before its bounded
  queue wait. This is not microphone capture time.
- `dequeuedAtMs`: the processing loop received that line.
- `inferenceStartedAtMs`: measurement begins before the start receipt/event and
  recognizer call. The measured interval includes writing/flushing that small
  start receipt, PCM normalization, recognition and exhausting lazy word output.
- `inferenceCompletedAtMs`: measured after segment/word collection. Final
  artifact persistence and final stdout delivery follow this timestamp.

`trial.inferenceMs` equals completion minus start in this same domain. The host
should also stamp its own dispatch and receipt, account for transport, and
calibrate clock offsets with uncertainty before correlating absolute times.
Direct subtraction across browser/server/Python clocks is invalid.

`availableAfterSourceSec` is the declared source-window endpoint, not proof the
producer waited for it. This command receives only submitted bytes but cannot
prove their capture history or enforce wall-paced source playout. The later
`MediaReplay` adapter must use genuinely observed, clock-mapped availability,
retain that distinction from measured-duration replay, and apply its own timing
validation to the uncorrected ASR words.

## Verification and actual public smoke

Fifteen standard-library tests in
`backend/bench/realtime-media/test_local_asr_stream.py` use an injected fake
recognizer, not model packages. They cover multiple chunks, measured word/source
offsets, duplicate identity, invalid inputs before inference, total budgets,
EOF/shutdown, overlapping windows, line bounds, idle timeout, safe failure
artifacts, duplicate JSON keys, exclusive output writes and session expiry
without publishing a late trial. A subprocess test forces cp1252 stdout while
round-tripping minus, accented and Greek characters through UTF-8 JSON decoding.
Two further tests simulate persistence crossing the session deadline before
recognizer entry and before trial publication. These regressions came from an
independent code review; current-clock checks now run after those operations,
rather than trusting a timestamp captured before persistence. Existing `self-test` also passed its offset
and network-denial checks.

Two fresh real runs used only already-local public MIT audio and the existing
pinned base model. Both sent source windows 893–897 and 897–901 seconds from
`data/realtime-workshop/media/mit-oscillations/t0885-0905.wav`, waited for each
result, then sent shutdown while leaving stdin open. CPU int8, eight threads,
one model worker, beam size one; no downloads or uploads.

| Run | Import ms | Model load ms | First chunk ms | Second chunk ms |
| --- | ---: | ---: | ---: | ---: |
| `mit-stream-base-cpu-01` | 1432.41 | 247.64 | 320.90 | 217.39 |
| `mit-stream-base-cpu-02` | 239.37 | 205.21 | 263.53 | 196.29 |

The first chunk in each process is labeled cold inference after model loading;
the second reuses the loaded recognizer. These are not two warm-inference samples.
Run 02 also verifies the explicit reader/dequeue timestamp ordering added after
run 01. Both processes exited successfully without EOF being required. Exact
receipts, source hashes, startup metadata and host observations are under
`data/realtime-workshop/asr/<run>/`; earlier evidence was not overwritten.

The first window recognizes `that is equal to minus omega square x.`; the second
still recognizes `Okay, so we have software`. This preserves the known window
boundary error rather than substituting a better transcript. These runs are
sequential receiver smoke tests with **no source pacing**. They exclude capture
window accumulation, external model authoring, world publication and browser
presentation, and do not measure an end-to-end ten-second success rate.

Next, attach a paced public-media producer and forward the observed trials to
the existing media scheduler; do not feed saved smoke results as if they had
just been recognized. Private user audio/transcripts remain unauthorized for
external model upload.

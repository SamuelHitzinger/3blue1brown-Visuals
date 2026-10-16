# Next retained-world ingestion probe

Audit: 2026-10-16, branch `codex/animation-authoring-efficiency`, HEAD `4c21005`.
This report is based on current source, not a new inference or timing run. No
media was uploaded, no model request was made, and no implementation was changed.

## Decision

Join the existing causal media adapter, strict submission probe, and retained
browser world in **one bounded public-media run**. Deliver real raw lecture
windows incrementally, run local recognition after each window arrives, and let
one source-grounded model request choose an existing native world operation.
Keep the same world and renderer alive through subsequent arrivals. Record both
renderer submission and independently observed browser pixels for each revision.

The smallest honest experiment is a causally paced public-media ingestion run,
not a prerecorded generated animation, cached transcript, predetermined world
patch, or synthetic final scene. It establishes the integration boundary; it
does not establish arbitrary-subject reliability, microphone capture latency,
full-motion quality parity, or physical display presentation.

## What already connects, and what does not

| Stage | Current implementation | Boundary still missing |
| --- | --- | --- |
| Real media capture | `frontend/app/src/captureEngine.ts:264` records complete two-second audio windows with overlap handling. `backend/src/lecture-capture.ts` saves/extracts captures into lecture sources. | This production path feeds notes, not `MediaReplay` or `LiveWorld`. Some UI copy still says 15 seconds; the current recorder source says two seconds. Do not use that copy as the measured cadence. |
| Production recognition | `backend/src/lecture-transcription.ts:19` calls ElevenLabs or Deepgram and returns text. `backend/src/lecture-media.ts` also invokes a model for photo extraction. | Not local ASR; no measured word records for this experiment. Routing private audio here would violate the present authorization. |
| ChatGPT Live bridge | `backend/src/lecture-live-bridge.ts:95` exposes stored frames and accepts speech-note batches. Its response explicitly says speech is not a continuous verified transcript. | Tool-supplied speech notes and on-demand photos are not an automatic raw stream into the world. |
| Local recognition | `backend/bench/realtime-media/local-asr.py` has offline network guards, pinned local models, word timings, and trial receipts. | `run` reads the whole WAV and processes windows as fast as possible. It is not a wall-paced producer or a long-lived chunk receiver. Replaying old trial durations is not observed inference. |
| Causal scheduling | `backend/bench/realtime-media/events.ts:108` activates only available evidence, cancels dependent work after revisions, preserves unrelated queued changes, and carries individual deadlines. `replay.ts:92` accepts measured ASR; `replay.ts:121` produces packets with base world revision and abort signal. | No timers, raw capture, frame resolution, model calls, or semantic grouping. Current `MediaReplay` consumers are tests. |
| Structured inference | `backend/bench/realtime-tool-probe.ts:24` provides strict scene/brief schemas; `:65` requires one completed call matching a successful terminal response. It records model timing, requested/actual tier, exact source, and failures. | CLI `main` has a timeout signal only (`:192`), not the media plan's external cancellation. It supports scene/brief, not a retained `WorldPatch` result. |
| Atomic retained state | `backend/bench/realtime-world/world.ts:162` compiles/prepares an added program, checks signal/revision, runs a synchronous publication guard, then publishes without awaiting. `apply` preserves untouched properties and similarly publishes atomically. | No atomic combined add-and-edit operation, cross-program binding, or arbitrary program replacement. Already-published semantics are not automatically repaired when source evidence changes. |
| Causal world integration | `backend/bench/realtime-media/world-integration.test.ts` connects real QuickJS compilation to media cancellation during preparation and immediately before publication. | Handwritten source and injected submission time; no model, actual recognition, browser or GPU timing. |
| Browser world | `backend/bench/realtime-world-view.ts` and `realtime-world-view/main.ts` retain programs and render continuously. | Starts from a form, invokes the older text-output `realtime-model-probe.ts`, and neither consumes packets nor connects cancellation/deadlines to inference. |
| Rendering | `shared/animlib/src/renderer.ts:433` renders via WebGPU/WebGL2; WebGPU submits at `:538`. | `render()` returns void and can early-return. Current browser timing resolves after the call, not after verified compositor pixels. There is no presentation receipt API. |
| Assets and speech cues | `realtime-media/asset-index.ts` indexes/loads bounded verified local assets; `timing.ts:40` resolves specified cues from measured words. | Asset inventory is not semantic asset selection. Cue arithmetic does not select useful phrases or automatically align a new explanation to continuing speech. Neither is wired into the browser ingestion path. |

Current direct-source and complexity results already reject an inference-speed
victory: see `realtime-direct-source-checkpoint.md`,
`complexity-screen-checkpoint.md`, and `local-asr-checkpoint.md`. Short model
responses can be invalid or pedagogically poor. The retained world is a useful
execution substrate, not evidence that the explanation is meaningful.

## Smallest concrete run

Use the already-local public MIT clip
`data/realtime-workshop/media/mit-oscillations/t0885-0905.wav` and corresponding
public frames. The producer releases PCM chunks and frames at source speed from
885 seconds onward. The recognizer and model receive only bytes released so far;
never supply the complete transcript, official captions, future frame, causal
brief, or desired final animation. Keep provenance/hashes and each release time.
Label the result **paced recorded-source ingestion**, not live camera/microphone.

1. Warm the existing renderer, compiler runtime, local ASR worker and model
   authentication before source playout. Record startup costs separately. Extend
   `local-asr.py` with a bounded chunk-input mode retaining the same offline
   guards and trial shape; do not run its existing whole-file batch and pretend
   those recognition times happened live. Begin with measured four-second
   past-only windows. Preserve observed start/completion, raw words and errors.
2. Instantiate one `MediaReplay` and one `LiveWorld` in the browser experiment.
   Feed newly available trial records and opaque public frame references through
   their existing ingest methods. Keep a small explicit context-ID set and an
   evidence-to-published-entity ledger. That ledger is needed to target corrections
   to already-published objects; world revision alone is not semantic provenance.
3. Factor the existing strict request body in `realtime-tool-probe.ts` into a
   reusable cancellable function. Preserve the CLI, exact-output acceptance,
   actual-tier metadata, immutable evidence directories and no-repair behavior.
   Use a strict one-operation envelope selecting **add native program** or
   **apply existing WorldPatch**, rather than a new visual language. Validate
   with the existing world/compiler. One response cannot claim an atomic
   add-plus-patch transaction: the world has no such API today.
4. Assemble the prompt from the packet, current sampled entities, their retained
   meanings/ownership, and resolved public images. Adapt the source-grounded
   instructions in `realtime-media/causal-prompts.ts`; remove its standalone
   eight-second scene recipe for edits. Preserve source uncertainty and demand
   a visible causal operation. Do not preselect subject-specific shapes or
   operations in the host. Keep full native authoring available for new geometry.
5. Run at most one inference transaction at a time for this first join, while
   continuing to ingest and activate arrivals. Carry `planId`, evidence versions,
   and the captured base world revision through request, response and commit.
   Pass the same cancellation chain through inference, compilation and resource
   preparation. Immediately before publication, synchronously activate queued
   arrivals, check the effective deadline, and let the existing world recheck
   signal/base revision. Never substitute a newer revision into stale output.
6. Continue the browser's existing sampling/render loop. Preserve the prior
   world on candidate failure. Require multiple evidence-triggered submissions
   in one world, with at least one later update of an existing entity and visible
   continuation of an unrelated earlier motion. If the source/model does not
   yield these outcomes, record that failure rather than inject a passing edit.

The public 20-second clip is the minimum wiring run, not a meaningful sample
size. A second public subject and a longer session follow only after this join
works. Existing asset resolution can be added when an incoming claim actually
requires it; it is not necessary to introduce assets merely to test transport.

## Clocks, deadlines, and visible evidence

Use one declared monotonic clock domain for scheduler/world receipts. With the
world in the browser, record source release, packet receipt, request dispatch,
response receipt, commit and render in browser `performance.now()` milliseconds
(world methods use seconds). Server/Python clocks have different origins:
retain their durations and calibrate offsets with measured round-trip bounds
before using their absolute timestamps. Report uncertainty; do not directly
subtract `performance.now()` values from different processes. Browser receipt is
a conservative observed availability boundary if exact cross-process completion
cannot be mapped. Do not label a derived duration as observed completion.

Keep a per-event timeline: source span, raw window start/end release, ASR
start/end, transport receipt, availability, plan dispatch, model first event,
completed tool call, provider terminal, candidate receipt, compile, resource
preparation, atomic commit, first renderer submission, and first browser pixel
observation. Preserve source/version/plan/revision/hash correlation throughout.

Two metrics are required:

- **Available evidence to visible result:** use every changed event's original
  obligation, not merely the latest event/context. `allChangesWithinDeadline`
  matters; `withinDeadline` alone can hide an older missed obligation.
- **Raw source to visible result:** include window accumulation, recognition,
  transport and queueing. Report from the first and last relevant raw sample;
  word boundaries are ASR estimates. The scheduler currently starts ASR deadlines
  after recognition, so its ten-second flag alone cannot establish this metric.

Set the attempt's timeout from the earliest effective remaining obligation,
including the chosen raw-source bound; do not grant another ten seconds at model
dispatch, retry, or commit. `advance()` currently cancels revisions but does not
expire requests. Deadline enforcement must therefore be wired explicitly.
`fail()` requeues changes, so an expired event also needs an explicit terminal
uncovered outcome/retirement policy; otherwise repeatedly failing its expired
plan can starve later arrivals. Add that narrow scheduler lifecycle operation
with a focused test if needed, not a second scheduler. Keep cancelled, failed,
expired and uncovered events in the denominator.

Keep `MediaReplay.commit(...render-submitted...)` truthful: call it with the
actual render-submission timestamp, not a later screenshot timestamp. Persist a
separate presentation-evidence record linked to that revision. A post-render
`requestAnimationFrame`, even two callbacks, is only a rendering opportunity.
GPU queue completion is not compositor or monitor presentation either.

For this probe, use browser compositor screenshot/screencast evidence with a
revision/frame marker outside the explanatory canvas, timestamps and decoded
pixels. Require the correlated canvas to show the new operation; a changed
marker alone does not qualify. Capture at a declared cadence and report the
interval from the last absent to first observed frame, plus capture overhead.
This gives a browser-visible observation bound, not the exact physical display
time. Leave `hardwarePresentedAtMs` null. If only `render()` timing is available,
report the presentation stage as missing and do not claim end-to-visible success.

The first nonempty frame may be setup while the causal operation happens later.
Retain a timed browser clip and separately identify **first meaningful operation**
and **completed explanation**. A label or an empty setup cannot satisfy the
meaningful-result threshold. Native compile success and changed pixels cannot
automatically certify that meaning; review the source evidence and motion.

## Acceptance and failure probes

Before paid runs, use focused contract tests for cancellation during inference,
compilation and preparation; correction activated at publication; stale base
revision; absolute expiry and no retry spin; request disconnect; and browser
render failure/hidden-tab/no-pixel acknowledgement. Existing tests cover only
some of these joins. Fault injection is labeled separately from natural source
recognition and cannot count as scientific content success.

During the public run, preserve every actual ASR correction, overlapping arrival,
failed output and deadline miss. If natural recognition produces no correction,
the run has not exercised real correction handling. A deterministic correction
test is supplementary. After an already-published correction, demand a new
source-grounded transaction targeting affected entities; cancellation cannot
retroactively repair a published claim.

A passing integration receipt requires causal input visibility, accepted exact
model output, atomic correct-revision publication, observed changed browser
pixels, retained unrelated state/motion, and an honestly measured deadline.
Quality acceptance additionally requires a blind review against a matched
baseline given the same available evidence and claim scope, at normal playback
speed and the same viewport. Review causal explanation, factual support,
identity/relationship continuity, geometry, occlusion, labels and timing. A
baseline authored later is useful for quality comparison but must not be counted
as a live timing baseline.

Stop the initial experiment at its declared source duration and evidence budget.
Report the distribution and all misses; do not infer p95, arbitrary-subject
coverage or baseline parity from this small run. World limits (32 programs,
2,000 lifetime IDs by default), time callbacks stopping at authored duration,
fixed first-program camera, missing cross-program relations and lack of atomic
replacement remain explicit longer-session/product gaps.

## Authorization boundary

Public local source media may enter the real inference experiment. Private user
audio and its local transcript must stay local; the previously approved single
private frame does not authorize a private lecture stream. Keep raw source,
transcripts, exact prompts and browser evidence in ignored run directories.
Only sanitized metrics and conclusions belong in tracked validation reports.

Recommended next implementation is this join in the existing bench files, with
the local chunk receiver and narrow strict-operation/cancellation additions.
Do not start another animation framework, descriptor language, prerecorded
lesson pipeline, or production lecture migration to answer this integration
question.

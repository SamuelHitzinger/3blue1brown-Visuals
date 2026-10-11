# Progressive interactive video delivery

The default Pi pipeline writes storyline Markdown with spoken narration and a visual
brief for every scene. ElevenLabs supplies audio and character alignment, from which
the server derives word timings. Each scene agent receives those timings, the animlib
API, and the evaluated end-state of the preceding scene. See [Pi setup](agents.md).
Set `VIDEO_GENERATOR=simulated` explicitly for three scenes with a diagnostic test tone.

The workspace uploads PDF, DOCX, UTF-8 text, Markdown, PNG, JPEG, and WebP files.
Original bytes are stored in SQLite before the server accepts the job. The durable
worker extracts document text on the server and passes photos to the script model
as image attachments. Scanned PDFs without selectable text need photos or pasted text.

## Contract and ownership

`shared/video/contract.ts` defines the versioned manifest and request types.
`POST /api/videos` accepts `{title, topic, documents: [{name, text}]}` with an
`Idempotency-Key` header, returning HTTP 202 and a stable manifest. Reusing the key
with different input returns 409.
Alternatively send multipart form data: `request` contains that JSON and repeated
`files` fields contain the original files. The app imposes no file-count, file-size,
total-upload-size, source-text-size, or PDF page-count limits. File hashes are part
of idempotency identity.

POST and DELETE validate the browser's origin. Behind the production gateway, set
`NARRATION_PUBLIC_ORIGIN=https://11.hackathon.ethz.ch` to the exact public browser
origin, without a trailing slash. Video and narration writes share this setting,
so internal HTTP forwarding or a rewritten host does not reject legitimate requests.
Without the setting, the expected origin uses `X-Forwarded-Proto` (or the request
scheme) and the request URL's host. Cross-site requests remain rejected.

`GET /api/videos` lists all saved jobs for the shared user. `GET /api/videos/:id`
returns a snapshot. `GET /api/videos/:id/events` sends named `manifest` SSE events
with monotonically increasing revision IDs. Every event is a full snapshot:
reconnections receive current state regardless of Last-Event-ID, and clients
ignore revisions already applied. Heartbeats keep idle connections alive;
terminal manifests close the stream. Disconnecting a viewer does not cancel work.

Scene order is contiguous and published scenes are immutable. Audio bytes and
scene metadata commit in the same SQLite transaction before notification. Audio
URLs address the same stored scenes. There are no browser sessions or separate
accounts: all visitors share one application user, and existing jobs created under
older session identities remain visible.

`DELETE /api/videos/:id` removes the video, its stored audio, and its original uploads
atomically. It aborts active scene generation and sends a terminal `deleted` event to
subscribers. Deletion during compilation cannot republish the removed video. Internal
agent/narration caches remain on disk for stage reuse; deletion removes the video
and its assets from the library and database. The dashboard refreshes job status and
removes videos deleted by another viewer.

## Generation and persistence

`VideoService` runs durable jobs concurrently in one Bun process, with no app-level
cap on active videos. Separate videos and narration jobs progress independently;
provider rate limits still apply. Startup resumes all queued or generating jobs at
their first unpublished scene. `VIDEO_DB_PATH` defaults to
`data/videos.sqlite`; deployment sets it outside release directories. Run only one
worker against this database. Multiple workers require leases/claims before use.
Back up the SQLite database using a SQLite-aware backup procedure.

The `Generator` interface receives the persisted request, next scene index, and
job context (shared owner, previous frame, image attachments, and cancellation signal). It returns source,
duration, narration, visual description, word timings, captions, an audio ID and WAV bytes, or null when complete. Pi persists
completed scripts and scenes separately and reuses the narration service cache. The service compiles and validates scenes with
`animlib/core` before publication. Narration publishes each completed scene's audio and timing packet atomically to
disk. Scene generation starts from the first ready packet while later speech continues;
it does not wait for the combined narration WAV. Code agents run one scene at a time per video.
Interrupted narration for a resumed video is retried automatically using saved chunks;
a speech request interrupted before its result was saved may be billed again.
Provider failures persist a terminal failure
while retaining available scenes. Retry/resume of failed provider jobs,
retention policies, quotas, distributed queues and object storage are future work.

## Playback and interactivity

Both existing local demos and server videos use `LessonPlayback` and animlib.
Server manifests append one prepared scene at a time, so loading later assets
does not prevent the first scene from becoming playable. Audio still downloads
and decodes per scene, not incrementally within a scene. Generated videos initially
wait for Play so the browser can unlock audio directly in a user gesture.

Appending compiles/prepares only the new suffix and leaves the active clock running.
Scene source is delivered, rather than only a compiled default timeline, because
sliders and toggles can change scene geometry and downstream handoffs. The existing
bounded QuickJS worker recompiles interactive changes locally; frame evaluation
and GPU rendering remain client-side. WebGPU is preferred, with automatic WebGL2
fallback when the API, adapter, device or initialization is unavailable. Both
backends use the same evaluated frames and prepared geometry. Published source itself never changes.
Providers should keep duration and narration meaningful across allowed controls.

At the available edge, the adapter preserves play/pause intent and shows buffering.
New content resumes at the next scene boundary; a user pause or open overlay prevents
resumption. Only a terminal manifest turns the available edge into the lesson end.
Seeking is limited to prepared content. Generation failures and connection messages
are separate from playback errors so available content remains usable.

## Development

Run `npm run backend:dev` on port 8080 and optionally `npm run app:dev` for Vite,
which proxies `/api`. Run `npm test`, `npm run app:test`, `npm run backend:test`,
`npm run backend:typecheck`, and `npm run app:build` for validation.

Tests cover idempotency, shared ownership, durable uploads and extraction, deletion, early scene delivery, atomic publication, snapshot reconnection,
restart recovery, append continuity, control propagation, buffering, pause intent,
duplicate delivery, and partial generation failure. No startup latency target has
been set; fixture delays are not estimates of real generation performance.

## Renderer fallback and verification

WebGL2 preserves scene colors, triangulated text/LaTeX, 2D/3D geometry, lighting,
procedural textures, configurable materials (metalness, roughness, highlights,
and emission), transparency, regional cameras and orbit controls. Playback, source recompilation,
handoffs, audio clocks and progressive append are shared above the rendering layer.
A canvas context type is permanent: failed WebGPU surfaces are replaced, with
controls and resize observation rebound. The React player mounts an imperative
canvas inside a full-viewport host so replacement and disposal are safe.
WebGPU device loss attempts WebGL2 recovery; WebGL context loss pauses playback
and audio. Restoration rebuilds GPU resources, redraws, and permits explicit resume.

`npm test` includes forced fallback/lifetime tests; these do not establish visual
correctness. To run automated real-browser rendering checks, start
`npm --workspace animlib run dev -- --port 5178 --strictPort`, open
`http://localhost:5178/webgl-test.html`, and click **Run browser tests**.
The page forces WebGPU unavailable locally, compiles real GLSL, reads actual pixels,
and reports every assertion. Automation can await `window.webglTests` and inspect
`window.webglResult.failed`. It exercises all demos and six lesson themes, depth,
transparency, viewport clipping, text/LaTeX morphs, orbit, portrait/DPR resizing,
native sliders/toggles, seeking, append continuity, handoffs, real WAV audio-clock
synchronization, context replacement, restoration and disposal.
The separate `npm --workspace animlib run test:gpu` suite checks real native WebGPU.
WebGL antialiasing depends on the browser/context; edge pixels can differ between
backends. This does not change authored colors or scene/timeline semantics.

## Contextual scene requests

Right-click a lesson's drawing surface to pause at that moment and request an
explanation or an interactive exploration. Submit with Enter or the arrow button.
The request captures the scene ID, scene-local time, click position relative to the
canvas, displayed frame, effective camera, and control values. Generation receives
that context together with the selected scene's authoritative source/narration and
original lesson material. For browser-local samples, the browser supplies the sample
scene source. Empty or ambiguous regions are interpreted using the surrounding
concept, rather than assuming an exact object hit.

`POST /api/videos/:lessonId/scene-requests` accepts `{question, context, localScene?}`
with an `Idempotency-Key`, returning HTTP 202 and `{id, afterSceneId, question, video}`.
Requests are limited to 2,000 characters and the complete JSON body to 1 MB. GET on
the same URL restores the ordered requests and current job snapshots. Each child
job uses the existing durable generation queue, narration, audio endpoints, and
manifest SSE stream. Each request produces at most one scene and does not create
another library card or thumbnail. Insertion-specific authoring guidance sets no
duration or word-count target. The original video manifest remains unchanged; playback composes
its timeline with the saved additions. Deleting a server video deletes its additions
and their assets too. Like the existing library, additions are shared across visitors.
Already-open viewers restore other visitors' additions when reopening the lesson.

Scenes are inserted after the selected scene, including when the selected scene is
itself an addition. Playback holds the selected scene's final frame if the next
requested scene is still generating or preparing, before the original continuation
or its audio starts. Multiple requests keep their insertion order; playback waits
at each pending insertion point as needed. Playback resumes automatically when ready,
unless the user has paused or opened an overlay. Seeking away cancels that automatic
jump. Users can also choose **Play added scenes**. Current position and playback
intent are preserved when scenes are inserted elsewhere in the timeline.
A source's optional `handoffFrom` names an earlier scene (or null for an independent
start), preserving the original continuation's object state when another sequence
is inserted between scenes. `audioId` binds each generated scene to its own asset
namespace. Interactive control changes still propagate within their original group.
Generation or preparation failures leave the original lesson available.

The Pi pipeline interprets the request and authors the actual explanation/toy.
`VIDEO_GENERATOR=simulated` exercises the complete flow with the existing diagnostic
slider scenes and test tone; it does not interpret the request or generate speech.

## Generation token usage

`VideoManifest.tokenUsage` is optional for compatibility with existing and simulated
jobs. `inputTokens`, `outputTokens`, and `totalTokens` are cumulative provider-reported
model usage. Cached input is included once. `estimatedOutputTokens` separately tracks
provisional output usage. A model request starts its estimate immediately, before response
headers or visible output arrive, and advances it every 500 ms while the request is active.
This uses a heuristic of 20 tokens per second, bounded by the model's output limit;
streamed text, reasoning summaries, and tool arguments also establish a lower bound at
roughly four characters per token. These are activity-based estimates, not measured hidden
reasoning tokens. The UI displays the sum in the DynaPuff title font with a small “tokens”
label below and a visible `~` while estimates remain. Digits roll upward as usage increases
(downward for confirmed corrections), with immediate updates when reduced motion is requested.
The counter appears only before the first playable scene and stays hidden during playback
and later buffering. The tooltip and accessible label also identify estimates.
Provider-reported usage replaces each response's estimate,
including hidden reasoning and input; this can adjust the number downward.

Pi generation uses one request-scoped tracker for planning, review, scene, and thumbnail
calls, including retries. The heartbeat stops on response completion, error, cancellation,
and session disposal, so queued jobs, validation, and speech synthesis do not invent
ongoing model activity. Confirmed responses publish immediately. Totals are stored in
SQLite and sent in authoritative SSE snapshots, including the final success/failure
snapshot. Reconnects do not add totals again. Interrupted responses retain their
unconfirmed estimate when usage is unavailable.
Speech synthesis is excluded because it does not report model token usage.

Below the count, an `≈` symbol and small grey glasses with animated blue water show an
illustrative water comparison, without a visible caption. Each glass represents 250 mL.
The reference is [Mistral's July 2025 Le Chat lifecycle study](https://mistral.ai/news/our-contribution-to-a-global-environmental-standard-for-ai/),
which reports 45 mL per 400-token response. We scale that reference linearly by confirmed
plus provisional **output** tokens; input/cache tokens are excluded. This extrapolation
is a visual comparison, not measured water consumption for the generation's model or
datacenter. The tooltip and accessible label make that limitation explicit. The glasses
hide together with the count once the first scene is playable, and reduced motion
disables the sketch/wave/fill animations.

## Subtitle-only videos

Set `narrationMode: "subtitles"` in a video request to bypass speech synthesis.
The saved script supplies short caption cues with deterministic reading-time
estimates (2.5 words/second or 15 characters/second, whichever is slower, with
explicit script pauses retained). These are not provider speech alignments.
A silent PCM/WAV track retains the existing player clock; no ElevenLabs calls
are made. Scene validation and visual verification/repair remain enabled.

Subtitle-mode manifests enable captions by default. Captions also work for
existing narrated videos when the user enables CC. Cues track scene-local times
through global seeking and streaming scene appends; the canvas reserves a lower
band so captions do not cover visual content. Existing speech mode is unchanged.

The resumed RNA job keeps its already-published first scene and original cue
schedule; only that scene's audio bytes were replaced with silence. New scenes
use the subtitle reading schedule. Original job metadata/audio were backed up
locally before conversion. Mode changes require explicit job migration; they
are not an automatic fallback on provider errors.

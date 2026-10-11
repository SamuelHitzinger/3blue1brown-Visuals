# Pi agents

The backend uses pinned Pi 1.1.0 to write a lesson plan and storyline Markdown in
one JSON response, reviews it in a separate editorial conversation, then writes animlib scene JavaScript. The host sends only the approved script
to ElevenLabs, then gives each scene agent its narration timing, the lesson plan,
and the authoring sections extracted verbatim from the animlib API reference. Each task gets a separate
conversation with host validation/submission tools and the pinned `pi-web-access`
extension. Built-in shell/file tools, discovered extensions, skills, and local
instructions are disabled. Scene validation uses
the existing QuickJS compiler with memory and execution limits.

Prompt ownership, shared policies, assembly order, validation boundaries, and saved-job
compatibility are described in [instruction architecture](instruction-architecture.md).
That map is the maintainer entry point; runtime prompts live in `backend/prompts/`.

The scene and thumbnail runners share the configured login. Pi persists subscription refreshes with file
locking. The host saves scripts, narration IDs, and validated scene sources per
video under `AGENT_DATA_DIR`; completed stages are reused on restart. `lesson.json`
is the authoritative versioned plan/script envelope; `script.md` is a readable
export. Videos with an older saved `script.md` resume without a new planning call.
Each completed narration scene becomes available immediately; scene code generation
overlaps later speech. Code agents run sequentially with the previous scene’s evaluated
end-state. Scenes are published progressively with audio, word timings, and captions.

## Web research

`npm ci` installs `pi-web-access` 0.38.0. The backend loads that package explicitly
for every Pi conversation; no separate CLI installation or extension discovery is
needed. On models that support adding tools during a conversation, `web_enable`
activates `web_search`, `fetch_content`, `get_search_content`, and `source_check`.
Other models receive the research tools immediately. Web access also works in
validated-reference and submission modes; `submit_output` must still be called
alone when finishing a task.

Search works without extra API keys through Exa MCP. The extension can also reuse
the session's supported OpenAI/ChatGPT authentication or use configured search
providers. Optional provider settings go in `web-search.json` under an explicitly
set `PI_CODING_AGENT_DIR`; when unset, the extension uses Pi's own default config
location (`~/.pi/agent`, with legacy/XDG fallbacks), independently of Aha's
credential-directory default. For a headless backend, keep `workflow` at `none`
(the package default) to return source-linked results without a curator browser
or summary model call. Restart the backend after changing extension settings.

Fetched pages and search results are reference material, and research failures
are returned to the agent for handling. The extension can clone GitHub repositories
and process local videos; it maintains its own private result cache. Its session
shutdown hooks run after each conversation, including failures and cancellation,
to release results and stop pending background fetches.

## Scene generation speed

Set `AGENT_SCENE_OUTPUT_MODE=validated-reference` to let a scene agent finish
with the ID returned by a successful `validate_output` call. The host retrieves
that exact source and validates it again. The model can still inspect validation
results and revise its candidate before finishing; the planning and editorial
review calls are unchanged. This avoids generating the same scene code again
in the final response. The default is `text`; set it explicitly to roll back.

The three-topic benchmark measured about 26% less scene-generation time across
two rounds with Astra/high and unchanged narration, scene plans, and full API
reference. This is a small empirical comparison, not a guarantee of identical
generations or universal quality preservation. See [benchmark results](scene-speed-results.md)
for variants, rejected outputs, saved animations, and limitations.

## Planning and scene quality

### Generated thumbnails

New Pi videos generate a thumbnail alongside script/scene work, using a separate
Pi conversation with `THUMBNAIL_MODEL=gpt-6.1-sol` and low reasoning. It uses the
same `AGENT_PROVIDER`, auth mode and credential directory as other backend AI.
The task receives the title, bounded topic/document excerpts and uploaded images,
plus `backend/prompts/thumbnail.md` and six actual SVG examples exported from
`frontend/app/src/Artwork.tsx`. Keep those examples and the style guide aligned
when the app's artwork changes.

The validator accepts only bounded paths/groups, monochrome paints and simple
transforms, then converts the SVG to typed path geometry. The manifest persists
that geometry and thumbnail status in SQLite. React renders explicit path elements
with the app's ink colors; it never injects model-authored markup. Existing artwork
remains visible while generation runs or if it fails. Thumbnail failures do not
fail the video. Scenes stream while the thumbnail is pending; the final video
status waits for both. Deletion/shutdown cancels both tasks. An interrupted
thumbnail resumes with its video; a saved thumbnail is reused. Completed older
videos and simulated videos retain their existing artwork.

To try six varied topics without generating narration, run:

```sh
npm run agents:thumbnails
# Or one custom topic:
npm run agents:thumbnails -- "Recursion" "A smaller version of the same problem, ending at a base case."
```

This uses the production Pi task and consumes model usage. Prompts, raw SVGs,
normalized geometry and timings are saved privately under
`AGENT_DATA_DIR/thumbnail-trials/TIMESTAMP/`. No videos are added to the library.

### Lesson planning

`backend/prompts/guidance.md` contains compact explanation guidance adapted from
PR #19. Requested audience, scene count, duration, and pause preferences take
priority over defaults. Explicit thinking pauses need natural spoken invitations;
visual holds do not require scripted silence.

The planner receives `guidance.md` and the code-owned planning contract. The
editorial reviewer receives those rules plus `story-review.md`. Compact visual
cohesion and reusable-object requirements live in guidance; the planner describes
what must be shown and why, leaving exact API choices to the scene author.
`capabilities.md`, `viewing-mode.md`, and `animation-quality.md` are not loaded.
Scene authors receive `scene-craft.md`, including interaction policy, and selected
authoring sections of the current animlib reference.

Planning and scene craft adapt the useful parts of PR #21 into the existing calls.
The plan records the audience/prerequisites, central question, learning goal,
key insight, running example, misconceptions, and shared entity/color meanings.
Each scene records its purpose, why it comes here, ordered key points, qualitative
visuals, intended end picture, carry/cleanup IDs, source references, and up to two
useful interactions. A complete outline and adjacent scene plans go to every
scene agent, including while later narration is still being synthesized.

For reusable objects, the planner describes later uses and lasting relationships
in the shared entity `meaning`, with construction needs in the introducing
scene's `visualDescription` and continuing structure in `endsWith`/`carry`.
This uses the existing plan schema. The outline contains titles and purposes;
only the current, previous, and next scene plans are sent in full. Recording
later uses in the shared entity registry makes requirements several scenes away
available when the object is first built. The planner states what must remain
connected or constant; the scene author selects bindings, rigid groups, or joint
rotations using the API reference's method-selection guidance. This prepares the
representation without revealing later results early.

Bindings are scene-local: the evaluated frame carries element geometry and
transforms, not `connect`, `attach`, or behavior declarations. Scene authors must
re-establish those relationships on the carried IDs. A connector keeps endpoints
attached but does not constrain their distance. The planner and rendered-review
guidance check these requirements; current compiler/plan validation does not
automatically prove connectivity throughout motion or constant segment lengths.
These prompt changes affect newly generated stages; saved scenes are reused and
are not repaired automatically.

The host validates scene/beat correspondence, source filenames, palette tokens,
and consistent entity/control declarations before submitting paid speech. PDF
extraction retains `[Page N]` markers; references are planner assertions to review,
not independently verified citations. Document content remains untrusted lesson
material. Planning never supplies acoustic timestamps or fixed scene durations.

New lessons receive an editorial review before paid speech, adapting the useful
review prompt from PR #25. The reviewer sees the full request/sources, the same
source images, the plan, and parsed speech in order. It checks examples, factual
claims, missing reasoning, pause/reveal order, requested scope and language, and
agreement between neighboring scripts and plans. Visual plans remain valid in
nonspoken metadata. Unreadable or missing source details must not be invented;
the explanation need not force every topic into a puzzle or mathematical derivation.

Material errors trigger a fresh authoring conversation that repairs the script
and plan together; cosmetic warnings do not trigger a rewrite. Up to 50
draft/review pairs are allowed. Exhaustion stops before speech submission and keeps saved progress. Reviews
record concrete checks but do not constitute independent fact verification.
This adds one model call before TTS for a passing first draft, plus calls for
necessary repairs. It does not gate individual scene streaming once speech starts.

An editorial checkpoint resumes the latest draft and repair findings in its private
`editorial/RUN_UUID/` directory. The last three draft/review pairs are retained.
Only an approved lesson is committed as `lesson.json`; its `editorialReview`
links the run UUID, pair number and SHA-256 of the exact saved draft. Existing
lesson envelopes and legacy Markdown resume without rewriting speech identities.

An evaluated previous frame at default controls is authoritative for generation;
planned end descriptions do not replace it. Compiled output must keep declared
carry entities, clean up declared temporary entities, and declare exactly the
planned control IDs/types. This checks declared structure, not mathematical or
perceptual correctness. Scene craft guidance asks the author to inspect clutter,
legibility, motion, causal teaching, and reveal order. Screen layout and pacing remain topic-dependent and bounded by real
audio timing.

For debugging, private job folders save `storyline.prompt.md`, each
`scene-N.prompt.md`, the captured canonical `scene-N.input.json`, and up to twenty failed validation messages per scene in
`scene-N.diagnostics.json`. Compiler codes, line/column locations and hints reach
the agent's validation tool and repair turns. Repairs must preserve established
facts, IDs, inherited state and measured audio timing. These files contain lesson
material and source; keep the existing private job-directory permissions.

### Scene inspection before submission

Scene authors have two nonterminal tools. `inspect_scene` checks up to 24 local
timestamps for text/LaTeX glyph collisions, paint outside its view, and potentially
undersized text at 960×540. It can also return unclipped bounds for up to 20 named
objects, including hidden paint for layout. Default overlap checks skip moving
text; `includeAnimating` includes it. These are advisory warnings: entrances,
exits, and intentional overlaps are not automatic validation failures. Reports
cap warning output at 60 and automatic bounds checks at 200 elements per frame;
`truncated` indicates incomplete reporting. Expensive inspection runs in a worker
with a 15-second timeout and cancellation.

`preview_scene` renders up to six PNG frames at requested local times, or samples
timeline boundaries and transition midpoints. It returns image content directly
to the author, with timestamps. `focusObjectId` requests a padded crop. The author
is prompted to inspect, preview, repair concrete defects, and verify a repair;
limits are four inspection calls and two preview batches per scene-agent run,
including provider retries. Calls that fail consume that budget. These limits
bound tool work; use of the tools is prompted, not a new submission requirement.

Both tools accept either complete `output` or a `candidateId` returned by a prior
check. Sources must pass the existing narration/plan validator first. Successful
`validate_output` calls now return candidate IDs for scene tasks in text mode too;
text-mode completion still returns source. Validated-reference completion can
select candidates from inspection without retransmitting the source. Planning,
editorial review and thumbnail conversations do not receive these tools.

The host reuses validated compilation, samples the actual inherited frame and
default controls, and reevaluates time-dependent bindings at each timestamp.
Generated code executes only in the existing QuickJS sandbox. A warm, serial
Chromium worker uses animlib's production WebGL2 renderer with SwiftShader;
only validated scene/frame data enters its isolated browser context. Requests
from the page are blocked, and no audio is loaded. Batches have no overall
execution deadline, and browser commands have no time limit. Chromium startup
retains its 15-second timeout. At most four batches may be active/queued.
Active cancellation terminates and discards the browser process without waiting
for a browser response; the next batch launches a replacement. Shutdown also
terminates the browser. Queued cancellation does not interrupt another batch.

`npm run build` also bundles the trusted browser renderer. Docker installs
Chromium; the release smoke test renders frames and checks actual colored pixels,
seeking and cropping under the deployed Compose restrictions. The container uses
`SCENE_PREVIEW_NO_SANDBOX=1` because its existing dropped capabilities and
`no-new-privileges` disallow a nested Chromium sandbox. It remains an unprivileged,
read-only container; `/tmp` has a 512 MiB limit for Chromium's profile/shared data.
Do not load arbitrary pages or generated JavaScript into this browser.

Locally, install Chromium and set `SCENE_PREVIEW_CHROMIUM` to its executable
(default `/usr/bin/chromium`). Keep Chromium's sandbox enabled where supported.
Set `SCENE_PREVIEW=0` to expose only analytical inspection. Missing Chromium or a
render failure returns a tool error; the author may finish using analytical
feedback. Private `scene-inspection/SCENE_INDEX-RUN_UUID/` job folders preserve
inspected sources, reports, preview PNGs, sample times, and elapsed milliseconds.
Structured logs contain counts/timing, not source or images.

Still samples cannot certify continuous motion, occlusion, control extremes, or
audio synchronization. Bounds are not a visibility test, and small-text warnings
are heuristic. These checks do not rewrite existing saved scenes. Quality and
end-to-end latency gains still require comparing generated lessons; the smoke
test measures rendering correctness and overhead only.

### Rendered verification and repair

New scenes use `scene-verify.md` to inspect rendered evidence before publication.
A failed verification invokes `scene-repair.md`, followed by validation, rendering
and another verification, for up to 50 rounds. Three invalid patch attempts fall
back to a complete scene replacement; it must still render and pass review.
Compiler failures trigger simplification within the existing resource limits.
Checkpoints retain the current candidate; rendered evidence keeps the last three rounds. Both tasks inherit the scene
author's assembled prompt. They do not append a separate animation-quality policy.
The optional `agents:review` command and its `scene-review.md` prompt are retired;
historical review artifacts remain readable files.

## Local setup

Use Node >=22.19 for npm tooling; the repository supplies Bun 1.4.2.

1. Run `npm ci`.
2. Copy `backend/.env.example` to `backend/.env.local` and configure ElevenLabs.
3. Keep `AGENT_AUTH_MODE=subscription` and run `npm run agents:login`.
4. Open the printed URL, complete **Sign in with ChatGPT**, and, if needed, paste
   the final redirect URL into the terminal. The app identifies itself as
   **Aha Demo <host-id prefix>**. Verify that registration in ChatGPT Settings.
5. Run `npm run agents:check`. This makes a small real inference request and
   consumes some account usage. `npm run agents:status` only checks local config.
6. With `VIDEO_GENERATOR=pi`, run `npm run backend:dev` and create a video normally.

These npm commands run from `backend/`, so Bun reads the same `.env.local` for
login and the server. Credentials default to `~/.aha/pi/auth.json`, outside the
checkout. To override this, use the same absolute `PI_CODING_AGENT_DIR` for every
command. Each developer logs in separately. A persistent `host-id` identifies
each installation. Pi is the default. Set `VIDEO_GENERATOR=simulated` explicitly to use the existing
simulated generator. Queued simulated jobs retain that generator after enabling Pi.
Login refuses to overwrite a saved registration: stop the backend and log out
before logging in again, so an old remote session is not left behind.

## Reuse an existing local Pi login

If this machine is already logged into Pi using its `openai-codex` provider,
set these values in the ignored `backend/.env.local`:

```dotenv
AGENT_AUTH_MODE=subscription
AGENT_PROVIDER=openai-codex
PI_CODING_AGENT_DIR=/home/your-user/.pi/agent
```

The backend uses Pi's supported provider and the original credential file directly,
including its locked refresh handling. It does not copy tokens or fall back to an
OpenAI API key. Run `npm run agents:status` and `npm run agents:check` to verify this
configuration. Aha's login/logout commands do not replace or remove a shared Pi
registration; manage that login through Pi or ChatGPT Settings.

`AGENT_PROVIDER` defaults to `openai` for new Aha registrations. API-key mode uses
that provider. Select an ElevenLabs voice available in the account owning the
configured key; the example Alexander voice may belong to a different account.

## Switch to an API key

Set the following server-only configuration, restart, and run `agents:check`:

```dotenv
AGENT_AUTH_MODE=api-key
OPENAI_API_KEY=your-key
```

API-key mode holds the key in memory and ignores saved OAuth credentials.
Subscription mode requires OAuth and cannot fall back to an API key. Changing
modes does not revoke the previous subscription registration.

`AGENT_MODEL` defaults to `gpt-6-astra` and `AGENT_THINKING` to `high`.
Agent tasks have no wall-clock timeout, so thinking, validation repairs, and
final output can finish. The former `AGENT_TIMEOUT_MS` setting is ignored.
Deleting a video or shutting down the server still cancels its active agent.
The model must exist in the pinned catalog and be available to your account;
`agents:check` verifies inference. Each conversation allows twelve agent turns
and three final-output validation attempts. The host retries recognizable network
failures, interrupted streams, temporary throttling, and transient provider errors
up to twice, with exponential backoff and jitter (about one and two seconds).
Each retry uses a fresh conversation with the same request and image attachments;
partial failed output is discarded. Cancellation interrupts requests and backoff.
At the video-job level, provider, authentication, quota and infrastructure failures
remain recoverable with cancellable exponential backoff (5 seconds to 5 minutes;
authentication/quota starts at 60 seconds). Invalid or truncated model output is
retried in fresh conversations with validation feedback, up to 50 attempts. Pi's own provider retries and automatic
compaction remain disabled so retry budgets do not multiply.

Structured `agent.retrying`, `agent.recovered`, and `agent.failed` logs correlate
each invocation with an `agentRunId`, video/stage/scene identifiers when available,
the provider attempt, and safe failure category/HTTP status. Raw provider errors,
headers, tokens, prompts, and lesson contents are excluded. Operator instructions
remain in CLI errors; video manifests and events use fixed user-facing messages
with a reminder that already published scenes remain watchable. Stored failures
from older versions are sanitized on read too.

## Demo server

Compose mounts a private persistent directory at `/data/agents`. Its `pi/`
subdirectory holds credentials/host identity, and `jobs/` holds generated work.
On the VM it defaults to `/srv/apps/3yellow3white-actions/agents`. Override it
using `AGENT_STATE_DIR` in the existing runtime environment file. Deployment
creates it for `deploy` with mode 700, outside releases. Compose manages the
container's `PI_CODING_AGENT_DIR` and `AGENT_DATA_DIR` values.

Set `VIDEO_GENERATOR=pi`, `AGENT_AUTH_MODE=subscription`, model settings and the
existing ElevenLabs configuration in the VM runtime environment. After deploying:

```sh
cd /srv/apps/3yellow3white-actions/docker-current
sudo docker compose -p 3yellow3white --env-file compose.env exec app bun backend/src/agents/cli.ts login
sudo docker compose -p 3yellow3white --env-file compose.env exec app bun backend/src/agents/cli.ts check
```

Login needs an interactive terminal. Open its URL on your computer and paste the
final redirect URL when asked; Docker needs no exposed OAuth callback port.
Give the VM its own login and host identity. Avoid concurrently using a copied
refresh token on both laptop and server. Credentials stay out of images and CI.

## End the demo

Disconnect the VM's **Aha Demo <host-id prefix>** in ChatGPT Settings from your browser, even if
you have lost VM access. Confirm that you can identify the registration during
setup and test disconnect/reconnect before relying on it. Disconnecting a shared
registration may affect other installations; do not assume instantaneous cutoff
of already-issued access tokens.

For local cleanup, stop the backend and run `npm run agents:logout`. It calls
OpenAI's discovered revocation endpoint and requires success before deleting the
saved credential. On failure it retains the credential and directs you to
ChatGPT Settings. The host ID is retained. Deleting `auth.json` or Pi's local
logout alone does not prove remote revocation. Revoke API keys separately.

On the VM, stop generation first and use the same persistent mount:

```sh
sudo docker compose -p 3yellow3white --env-file compose.env stop
sudo docker compose -p 3yellow3white --env-file compose.env run --rm --no-deps app backend/src/agents/cli.ts logout
```

Revocation does not erase documents, scripts, audio, or scenes on the VM.

## Failures and verification

The server writes JSON lines to stdout (progress) and stderr (warnings/errors).
Filter by `videoId` to follow a video from `video.queued` through source extraction,
script drafting/review, narration waits, scene generation, and publication to
`video.completed` or `video.failed`. Narration-stage records link `videoId` with
`narrationId`; use that ID for speech chunk, cache reuse, and narration failures.
Slow stages emit `stage.running` every 30 seconds with `elapsedMs`; this means
the operation is still pending, not that its provider has confirmed progress.
Scene indexes are zero-based; draft/review attempts are one-based. Resumed job
elapsed times cover the current run only. Logs omit lesson text, uploaded file
names, credentials, provider response bodies, and raw exception messages.
Logging changes take effect when the backend restarts; they cannot add progress
events to an already-running process.

Video jobs preserve completed scenes and retry service failures automatically.
Narration stays required for speech-mode videos: failed/interrupted narration is
retried using cached successful chunks, never replaced with subtitles. The last
unsaved speech request may be billed again. Deletion cancels retries; shutdown
preserves checkpoints and retry scheduling. Reaching a 50-round review/output
cap stops the job with a clear message and saved progress. Historical failed
jobs are not automatically resubmitted. The player displays recovery status.

Backend tests exercise real Pi sessions with an injected model stream and fake
speech. They cover auth isolation, revocation failure, tool restrictions,
validation repair, cancellation, audio IDs, and reuse of saved generation.
They also check that repeated tool calls stop at the turn limit.
Container smoke tests import Pi under Bun and verify persistent state across
replacement, without external inference or speech calls.

References: [Pi SDK](https://pi.dev/docs/latest/sdk),
[OpenAI revocation](https://developers.openai.com/siwc/token-sharing-open-source/profiles-and-sessions),
[VM credentials](https://developers.openai.com/siwc/token-sharing-open-source/self-hosted-vms).

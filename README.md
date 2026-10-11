# Aha! — VISCon Hackathon

Aha! is a React and Vite prototype for turning course material into short visual lesson previews. The Plan page shows a compact colour-coded curriculum and a separate plan for each subject. It reads PDF, Word, text, or Markdown files in the browser, groups them into chapters and video topics, and sends selected topics to the workspace composer. The library, player, light and dark themes, and creation flow are interactive demos. New previews use a persistent server job and progressively delivered interactive scenes. The Pi agent pipeline generates scripts and scene code with word-aligned ElevenLabs narration.

## Repository layout

```text
frontend/app/      React source, styles, and plan tests
frontend/site/     Built Aha! site served by Bun
backend/src/       Bun HTTP API and frontend routes
shared/animlib/     Shared scene compiler, evaluator, WebGPU/WebGL2 player, and demo
shared/video/      Versioned progressive video delivery contract
```

The built frontend is checked in so the backend can serve it directly. Use Node.js
22.19 or newer for the existing npm/Vite tooling. `npm ci` also installs a pinned
[Bun](https://bun.sh/docs) runtime for the backend commands, so a global Bun install
is optional. Dependencies are managed with npm and the checked-in package locks.
To update the site after editing the React source:

```sh
npm ci
npm ci --prefix frontend/app
npm run app:test
npm run app:build
```

For a live frontend development server, run `npm run app:dev`. The source app's [README](frontend/app/README.md) describes its screens and current integration points.

Lesson playback uses animlib's clock and a full-viewport canvas, preferring WebGPU
with automatic WebGL2 fallback. The app's controls drive play, pause, seeking,
and replay; opening navigation or a dialog pauses the animation. Existing sample
lessons play locally. New previews persist on the server and deliver interactive
scenes and audio progressively. Enable real generation using the [Pi agent setup](docs/agents.md),
or explicitly set `VIDEO_GENERATOR=simulated` for scenes with a test tone. See [video delivery](docs/video-delivery.md).

## Run the combined app

Visitor sign-in is provided by the VIScon reverse proxy using `X-User-Id` and
`X-User-Name`. Aha displays that identity without a separate login. See
[proxy identity, local development, and deployment requirements](docs/authentication.md).

```sh
npm ci
npm run backend:dev
```

Open <http://localhost:8080>. Direct visits to `/library`, `/plan`, `/plan/:subject`, `/settings`, and `/watch/:id` also load the app. Existing `/api/hello`, `/api/me`, and `/healthz` endpoints remain available. The Plan page reads material locally and saves chapters and source text in local storage. Creating a video uploads original documents and photos to the server alongside typed text. Files, jobs, scene code, word timings, and audio persist in SQLite. All visitors share one library; videos can be deleted there.

For deployment, run `npm run backend:start` instead of the previous Uvicorn
command. The default bind address is `0.0.0.0:8080`; override it with `HOST` and
`PORT`. Both backend commands build the shared library first. Run
`npm run backend:test` for shared scene evaluation tests, and
`npm run backend:typecheck` to check the backend's TypeScript.

The animation library remains a separate npm workspace. From the repository root, `npm ci` installs it, and the existing `npm run dev`, `npm test`, and `npm run build` scripts operate on that library. See its [README](shared/animlib/README.md).
The library supports shaded solids, swept tubes, sampled function/parametric
surfaces, procedural textures, and configurable metalness, roughness, highlights,
and emission. The [capability brief](shared/animlib/docs/capabilities.md) and
[API reference](shared/animlib/docs/reference.md) describe current behavior and limits.
Static GLB models can include embedded image textures, UV maps, material factors,
and named parts. Scene agents can publish downloaded or generated models using
`publish_model`; clients receive asset manifests and fetch immutable GLBs separately.
Container model storage lives in `/data/videos/models` on the existing video volume.

Browser code imports the player from `animlib`; the Bun backend and other Node
consumers can import scene compilation and state evaluation from `animlib/core`
without loading the renderer. See the library's
[shared evaluation example](shared/animlib/README.md#shared-scene-evaluation).
The video queue uses Pi script/scene agents by default, with
ElevenLabs; see [local/VM authentication and remote logout](docs/agents.md).
The backend also normalizes AI-written storyline Markdown through `/api/narrations` (including
common label, formatting, pause, and table variations), generates
ElevenLabs narration with word timings and explicit pauses, and provides a
validated scene-agent handoff. See [narration setup and contracts](docs/narration.md).
The storyline writer receives `backend/prompts/guidance.md`; its **Output contract**
specifies the Markdown handoff. `buildStorylineMessages` also loads the shared
viewing-mode policy and animation capabilities.

## Automatic deployment

GitHub Actions builds and tests pull requests, including Docker startup, shutdown,
and persistence checks, then deploys successful `main` updates over SSH. The app
runs in a non-root Docker Compose container with persistent SQLite, narration,
and agent-state bind mounts. Candidate images are tested before replacing production; failed activation
restores the previous container or legacy systemd service. See
[deployment setup, container commands, and recovery](docs/deployment.md).

The Courses page stages files and pasted notes until the top-right **Add** button is
clicked. Selected files remain visible and removable in the drop area, and both
input tabs preserve their contents. Add always sends the combined material to AI,
then saves topics containing individual 2–5 minute video lessons. Switching courses
closes the previous panel; clicking the selected course closes it.

`POST /api/study-plans` accepts multipart files plus notes, or the existing JSON
text-document request. It reads PDF (including scans), DOCX, PPTX, XLSX,
OpenDocument, screenshots/images (PNG, JPEG, WebP, GIF, BMP, AVIF), and UTF-8 text
such as Markdown, CSV, code, and subtitles. Screenshots can also be pasted directly
into the upload area or notes field; short readable formulas are accepted.
Audio/video recordings use ElevenLabs Scribe transcription with the server's
`ELEVENLABS_API_KEY`. Unsupported binary formats return an actionable error.
Uploads have no app-enforced file-count, file-size, total-size, extracted-text,
or PDF page-count limits, including scanned pages.

Classification uses the existing Pi login, defaulting to `gpt-6.1-sol`; set
`STUDY_PLAN_MODEL=gpt-6-astra` to use Astra. The frontend requests background
processing with `Prefer: respond-async`: POST returns a job ID immediately after
upload, GET `/api/study-plans/:id` polls reading/planning progress and the result,
and DELETE cancels it. This avoids gateway timeouts during long model calls.
Jobs run for up to ten minutes with two concurrent requests per server; results
are available for fifteen minutes, with at most twenty jobs retained in memory.
Jobs are scoped to the proxy user and expire on server restart. Legacy clients
without the preference still receive a synchronous response. AI is required; missing credentials,
processing errors, and cancellation leave the staged files and notes available to
retry. The local preview needs `npm run agents:login` before real inference.
Saved plans and source names remain in browser storage; raw files remain in memory
only until submission or navigation. Condensed notes and references are
model-authored, and the extracted original material is retained in the saved plan.

Instruction ownership and prompt assembly are documented in
[instruction architecture](docs/instruction-architecture.md). Teaching guidance,
viewing-mode rules, scene craft, and API semantics each have one canonical source.
The course planner loads `topics-system.md` and `topics-format.md`, appends grouping
and duration requirements, and validates up to 40 lessons and their 2–5 minute
estimates. Existing saved plans remain readable; completed generation artifacts
are reused rather than rewritten when prompts change.

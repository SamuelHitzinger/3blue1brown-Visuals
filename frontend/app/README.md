# Aha!

A React and Vite frontend for turning learning material into visual explanations. Served by the Bun backend and integrated with the shared animlib player. Server generation delivers narrated animlib scenes progressively.

```sh
cd ../..
npm ci
npm ci --prefix frontend/app
npm run app:dev
npm run app:build
npm run app:test
```

## Screens and interactions

- Workspace: `/`, a small Interactive checkbox in the active input widget’s top-right corner. Unchecked means Classic; the selection is independent of the input card and is saved with the lesson. Three overlapping coloured input cards: Drag & drop, Text & file, and Photos. Side cards reveal further on hover or keyboard focus; click or tap brings a mode to the front. Each mode keeps its own inputs, and only the active mode is submitted. Photos supports image selection and an on-demand camera with capture, cancellation, permission-error handling, and stream cleanup. File selection has no app-enforced count or size limits. Creation submits an idempotent server job and opens its player while scenes arrive. Original photos are uploaded to the backend for source extraction and lesson generation.
- Library: a separate `/library` page reached from the workspace or navigation drawer. Includes saved previews under their subject or My ideas, subject filters, search, sorting, bookmarks, generation status, and deletion. All visitors share one server library.
- Courses: `/courses` (legacy `/plan` links still work). A left-hand course list sits beside a two-by-two video grid. Up to three video slots show actual recent playback in the listed course’s colour; the fourth plus tile opens Workspace. Add course appears below the list with a name and colour form. A delete button at the bottom of the selected course, above the footer, confirms removal of the course and its material while keeping videos in Library. Clicking a course expands one animated layer of rounded, course-coloured topic rows directly below it, without scrolling away. There are no connector lines or nested subtopic rows. Selecting a topic opens its detailed section below. Empty courses show just a plus in the course list, while the AI material upload remains visible below whenever the selected course has no lessons, including courses with no topics. Inline name forms add topics; Enter saves and Escape cancels. Each topic has a small trash control with inline confirmation. Deleting a topic removes it and its lessons from the course, persists across reloads, and leaves Library videos untouched. The course-level plus also offers material upload. Courses, manual topics, and playback order persist locally; existing material upload and topic-to-video flows remain available. Material appears as topics containing short lessons with estimated durations. Each topic ends with a New video slot: enter a title to add a lesson card, then use Make me a video to generate it. Lesson cards can be deleted with inline confirmation. While generation runs, the card shows Generating; once the video completes, its source lesson is removed from Courses and the video stays in Library. Failed or cancelled generation keeps the lesson available. There is no manual done state. Library keeps its existing subject-list styling and only shows subjects that have videos; empty courses remain on Courses.
- Settings: `/settings`, light and dark appearance cards. Dark mode uses a pure-black page background.
- Navigation: a left drawer with workspace, library, Courses, and creation links at the top; a quick Light/Dark switch stays at the bottom.
- Player: `/watch/:id`, full-viewport animlib WebGPU/WebGL2 lesson canvas, play/pause, scrubbing, keyboard shortcuts, replay, and fullscreen. The canvas is white in light mode and black in dark mode, with contrasting menu and playback controls on transparent backgrounds and no title/subtitle panel. The bold progress bar fills over a grey unplayed track. Theme changes recolor the existing renderer while preserving playback position and scene interactions. Navigation and dialogs temporarily pause playback. The scrubber and timer follow animlib's timeline. Both renderers support shaded meshes, sampled surfaces, procedural textures and configurable materials; see the [animlib reference](../../shared/animlib/docs/reference.md).
- Light is the initial theme. Theme preference and curriculum context are stored locally; generated video jobs are saved on the server. Dark mode uses darker versions of each pastel.

## Integration points

- `src/GenerationProgress.tsx`: generation shows a live number in the DynaPuff title font with a small “tokens” label below until the first scene becomes playable, then hides it throughout playback and later buffering. Digits roll upward as usage increases and downward for confirmed corrections; reduced motion shows updates immediately. Server manifest snapshots provide cumulative model usage, including planning, reviews, scene work, and thumbnail calls. During active model calls, the server sends an activity-based estimate every 500 ms, including silent reasoning before any output arrives. A visible `~`, tooltip, and accessible label identify estimates; provider-reported usage replaces each response's estimate and can reconcile the count downward. The heartbeat stops when the model request ends. Below the counter, `GenerationWater.tsx` draws minimal grey glasses with blue water and an ≈ symbol. Each glass is a 250 mL illustrative comparison, scaled from Mistral’s published 45 mL per 400 output-token response; the tooltip identifies the comparison as unmeasured for this model. Input tokens are excluded. Legacy jobs without usage show a waiting state. Speech synthesis usage is not measured in model tokens.

- `src/CanvasQuestion.tsx`: right-click the canvas to open a compact input and black circular send icon; successive questions cycle through the widget colours. The draft retains the lesson, timestamp, pixel and normalized location, and detached scene frame locally. Playback pauses while the input is open. Escape or clicking outside dismisses it. Sending is disabled; no question API is called.

- `videoMode: 'classic' | 'interactive'`: the selected viewing experience, separate from the input method. The repository frontend sends it in JSON and multipart creation requests and preserves it in browser-local lesson metadata across library refreshes. The standalone prototype saves it on its sample lesson. The backend validates and persists the preference and supplies it to planning, review, and scene generation. New Classic lessons reject lesson controls and camera orbit; Interactive lessons can use planned controls. Requests without a mode default to Classic. See the [shared viewing-mode policy](../../backend/prompts/viewing-mode.md) and [instruction architecture](../../docs/instruction-architecture.md) for saved-job compatibility.

- `src/WorkspacePage.tsx` → `createVideo`: reads documents from the active input mode and submits topic/source text through `src/videos.ts`. No subject selection or course setup is required. The player opens immediately while generation continues on the server. Curriculum subject, chapter, and source metadata remain attached across library refreshes.
- `src/courses.ts` and `src/CoursesPage.tsx`: default subjects from `curriculum.ts`, the active course list under `aha-courses-v1` (version 2 preserves deleted defaults and migrates version 1 custom courses), and actual playback history under `aha-recent-playback-v1`. The timetable is no longer displayed. English Linear algebra videos map to the listed Lineare Algebra course.
- `src/CourseOutline.tsx`, `src/SubjectPlan.tsx`, `src/LessonGrid.tsx`, and `src/subjectPlans.ts`: single-level sidebar topic lists, manually added topics, per-subject material uploads, additive chapter outlines, and local persistence under `aha-subject-plans-v1`. Older saved plans migrate into matching subjects. Original source text is retained for topic video requests.
- `src/plan.ts`: local, deterministic chapter and segment suggestions. It uses headings and source text, not an AI service. Long sections split at sentence boundaries where possible, targeting at most four minutes at 140 source words per minute. Actual video durations will depend on the explanation engine.
- `src/documentReader.ts`: lazily loaded PDF.js and Mammoth readers. PDF/Word content is read on-device; scanned PDFs require a readable text layer. File sizes and PDF page counts have no app-enforced limits.
- `src/LessonPlayer.tsx`: mounts and disposes animlib, subscribes to server manifests or loads local sample scenes, and connects controls to `src/lessonPlayback.ts`. Animlib owns the playback clock, buffering, and pause intent. WebGPU is preferred with automatic WebGL2 fallback. The canvas is mounted imperatively so recovery can replace a locked drawing surface safely.
- `src/lessonScenes.ts`: local sample `SceneSource[]` for older local previews and test fixtures. Server previews use progressively delivered source and audio through the same player.
- `src/data.ts`: the `Lesson` interface and topic-to-artwork mapping. `videoId` links server-backed lessons to their manifests; `source` retains local curriculum context.
- `src/Artwork.tsx`: reusable educational SVG diagrams for thumbnail fallbacks. The six SVG style examples remain in `backend/prompts/thumbnail-examples.json` for icon generation.
- `src/styles.css`, `src/interface.css`, `src/workspace.css`, and `src/plan.css`: shared component styles, the rounded pastel interface, responsive layouts, and reduced-motion support.

Workspace submits original documents and photos using multipart uploads alongside typed text.
The backend persists them before accepting a video and handles extraction, script generation,
ElevenLabs speech/alignment, and sequential animlib code generation. Ready scenes stream to the
player while later scenes continue, even after navigation away. The library refreshes server jobs
and supports deletion. Pi generation is the default; `VIDEO_GENERATOR=simulated` provides an
explicit diagnostic fixture. Course topics and extracted source text still use browser local
storage. See [video delivery](../../docs/video-delivery.md), [agent setup](../../docs/agents.md),
and [narration](../../docs/narration.md).


Course uploads now stage files and pasted text together. The top-right Add button
calls `/api/study-plans` once, always using AI, and stores the returned topics and
video-sized lessons. File names, sizes, and remove buttons remain in the drop area
while staged or processing. Input tabs remain selectable during processing;
cancel and failure retain the material for retry. Course material and delete
controls use distinct React keys so switching courses unmounts the old panel.
See the root README for supported formats, limits, and `STUDY_PLAN_MODEL`.

# Course notebooks and continuous lecture notes

Use existing course definitions and durable lecture service. `/lectures` becomes
the Notes dashboard: choose a course, then its ordered lectures. A course can be
created with the existing course store; lectures can be added, renamed, reordered,
deleted, and opened. Unassigned and missing-course lectures remain accessible.

Each lecture is one centered continuous reading document, with concise AI sections
and visuals embedded within the related section. No separate selected-concept
viewer. A slim sticky section rail offers labelled keyboard-accessible jump links
and highlights the visible section. Mobile uses a compact section control.
Capture, source input and source history live in a collapsible utility panel.

Durable additive contracts: optional `position` on lecture/session summaries;
optional `noteEdits: Record<string,string>` (`summary`, `section:<id>` keys) on
session; optional `sectionId` on concepts. Existing records remain readable.
POST `/api/lectures/reorder` accepts `{courseId?:string, lectureIds:string[]}` and
transactionally reorders exactly the caller's current lectures in that course.
PATCH supports partial noteEdits values (null resets an edit), title, personalNotes.
Edits remain distinct from AI notes and survive incremental synthesis. Bound all
inputs, preserve ownership/origin checks and reject stale/incomplete reorder sets.

AI preserves section IDs and assigns each concept to a section. Older notes use
deterministic source-overlap placement, so every concept appears once. Inline
players mount near the viewport and release resources offscreen; capture refresh,
citations, stale/failed visual states and retry remain available. Source citations
belong to AI text; edited sections visibly identify user edits.

Visual direction: quiet warm paper surface, restrained course colors, spacious
reading rhythm, compact actions. Document—not dashboard cards—owns lecture view.
One page scroll; visual controls stay inside their figure. No actual PDF needed.

Verification: persisted ordering and authorization, edit preservation under AI
refresh/restart, section assignment/fallback/export, frontend tests and builds,
browser verification on desktop/mobile including real inline visualization.

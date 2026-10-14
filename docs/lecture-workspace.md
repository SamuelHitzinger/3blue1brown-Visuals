# Lecture workspace

Aha has two workflows: authored interactive videos and incremental lecture notes
with private concept visualizations. The home page opens either workflow; existing
courses, library, watch links, and video generation remain available.

## Use

1. Open Lectures and create a titled session.
2. Add a passage from the lecture. Each passage is saved before AI work starts.
3. Read organized notes, follow citations back to source passages, and inspect
   open questions. Add personal notes separately; AI updates never overwrite them.
4. The first new concept receives an automatic visualization. Request others from
   their concept cards. Replay or manipulate completed scenes while later material
   is processed. A stale marker distinguishes earlier-source visualizations.
5. Export notes as Markdown or return later to continue the session.

For automatic photos and audio, follow the [iPhone capture setup](phone-capture.md).
Pair Safari to one lecture through private HTTPS. Captures become immutable text
sources with timestamps and media provenance, then use the same notes and visual
pipeline. Keep Safari visible while recording.

## Runtime and data

Use `VIDEO_GENERATOR=pi` and the existing Pi model authentication. Notes default to
`LECTURE_MODEL=gpt-6.1-sol`; visual authors use `AGENT_MODEL`. Lecture visuals are
silent, so no ElevenLabs key is needed. The renderer required by video quality
review is also required by lecture visualizations. If it is unavailable, sources
and notes remain saved, but unreviewed visuals are not published.

`LECTURE_DB_PATH` defaults to `lectures.sqlite` beside `VIDEO_DB_PATH`, so the
existing production video-data volume also persists lectures. Include this file
and its WAL in consistent SQLite backups. Temporary private generation artifacts
under `AGENT_DATA_DIR/lectures` are removed when each job ends; public scientific
model assets use the existing model store. A lecture never enters the shared
video library automatically.

Graceful shutdown allows up to five seconds for canceled providers to settle and
remove their temporary files. A hard kill or crashed process can leave job
artifacts; include that private directory in operational retention and cleanup.

Authenticated lecture sessions are scoped to the trusted proxy user ID. As with
the existing application, production must run behind the trusted identity proxy.
Without proxy identity, local users share one anonymous lecture workspace; this
is not a substitute for independent authenticated accounts.

## API and extension boundary

All responses use private, non-cacheable snapshots. Creation and source appends
use `Idempotency-Key`; reusing a key with different content is a conflict.

- `GET/POST /api/lectures`: list summaries or create `{title, courseId?}`.
- `GET/PATCH/DELETE /api/lectures/:id`: read, edit `{title?, personalNotes?}`, delete.
- `POST /api/lectures/:id/sources`: append `{kind:'text', text}`.
- `POST /api/lectures/:id/synthesize`: retry/rebuild notes from saved material.
- `POST /api/lectures/:id/concepts/:conceptId/visualize`: request/retry a concept.

Poll snapshots while a lecture is visible, even when idle, to receive phone
additions. `revision`
orders all mutations; `sourceRevision` orders source additions;
`synthesizedRevision` records the exact source snapshot behind generated notes.
User edits do not falsely invalidate generated scenes. Source IDs are immutable;
catalog IDs describe authoring references and cannot substitute for citations.

## Quality and limits

Notes use validated structured output, known source IDs, preserved notation,
explicit uncertainty, and a small repair budget. Model citation assertions still
need human judgment: valid IDs do not prove a claim follows from its passage.

Visualizations use the existing animlib reference, scene craft, compiler,
readability checks, inspection/preview tools, and independent rendered review.
They explain one relationship in a 12-second scene with a held result and useful
interaction. A bounded three-round review may fail rather than lower quality.
The standalone [authoring guide](../backend/prompts/lecture-visual.md) requires a
visible construction for each claim. Spatial scenes also require a
geometry-targeted orbitable view. The small animlib
[navigation guide](../shared/animlib/catalog/navigation.md) routes every relevant
model stage into selected catalog records without injecting the growing library.
Resources currently available to lecture model publication are bundled molecular
fixtures and public PDB structures. Other catalog resources state their host
preparation requirements; catalog presence does not make them runtime assets.

The catalog keeps retrieval bounded as entries grow. It preserves current quality
gates; neither a universal quality match nor a generation-speed improvement is
implied without comparing rendered results and measured latency.

Local model verification on 2026-10-14 used an invented lecture about the shear
`T(x,y,z)=(x+z,y,z)`. Grounded notes took 17.3 seconds; a 12-second interactive
visualization with horizontal-slice and height evidence took 301.4 seconds,
including rendered review. The author retrieved three catalog records. These
are one-run measurements, not latency guarantees: notes update incrementally,
while quality-reviewed visualizations finish in the background.

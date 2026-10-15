# Lecture workspace

Aha has two workflows: authored interactive videos and incremental lecture notes
with private concept visualizations. The home page opens either workflow; existing
courses, library, watch links, and video generation remain available.

## Use

1. Open Lectures and create a titled session.
2. Pair a phone for photos/audio, or append lecture text. Input is saved before AI work starts.
3. Read compact fragments, formulas, and sketches. Assigned problems appear in
   Questions; transcripts stay out of the notebook. Personal edits remain attached.
   Related lines share small subheadings. Equations use mathematical typesetting,
   relationships use arrow lines, and conditions/caveats remain visually distinct.
4. Static sketches render with notes. The first new dynamic concept receives an
   automatic visualization; request others from their concept cards. Completed
   scenes remain available while later material is processed.
5. Set simple language, concision, and visual-density preferences below the notebook.

For automatic photos and audio, follow the [iPhone capture setup](phone-capture.md).
Pair Safari to one lecture through private HTTPS. Captures become immutable text
sources with timestamps and media provenance, then use the same notes and visual
pipeline. Keep Safari visible while recording.

Visuals prefer faithful redraws of diagrams shown in the lecture: preserve supported
labels, arrows, spatial relationships, and notation. The notes orchestrator may
choose a different representation when it explains the same evidence more clearly.
Photo extraction records compact diagram evidence in its existing model call.
Incremental notes receive bounded references to earlier cited visual evidence,
without resending the entire transcript.

Especially useful readable photo details can appear as small crops beside the
relevant notes. The extractor proposes a tight crop; the notes orchestrator chooses
whether it adds enough value to include. Only validated cropped JPEGs are retained
after successful processing, served through the lecture owner's access boundary.
Older successful captures whose image bytes were already removed cannot gain photo
snippets retroactively. Existing notes and personal edits remain compatible.
Readable classroom diagrams, annotated equations and worked steps qualify as
useful crops; they need not contain detail impossible to redraw. Up to six distinct
crops can appear, one per section, alongside related notation or a complementary
sketch. New photos use these selection rules; discarded older pixels cannot be
recovered.

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

Poll snapshots every 500 ms while a lecture is visible, even when idle, to receive phone
additions. Owner-checked ETags return 304 for unchanged snapshots so this does not
retransmit the growing source history every tick. `revision`
orders all mutations; `sourceRevision` orders source additions;
`synthesizedRevision` records the exact source snapshot behind generated notes.
User edits do not falsely invalidate generated scenes. Source IDs are immutable;
catalog IDs describe authoring references and cannot substitute for citations.

## Quality and limits

Notes use validated structured output, known source IDs, preserved notation,
explicit uncertainty, and a small repair budget. Model citation assertions still
need human judgment: valid IDs do not prove a claim follows from its passage.

Notes use one validated submission rather than asking the model to repeat the
complete output after validation. Static diagrams do not require an animation
prompt. Stage logs separate photo/audio extraction from note generation; model
metrics include elapsed time, provider calls, and validation failures without
logging lecture content. These reduce avoidable work but do not guarantee a fixed
update time.

Live capture uses complete two-second audio files started every second;
the one-second overlap protects words at clip boundaries. At most two encoders
run at once, with sequential two-second files on devices that reject concurrent
encoders. Slow local saves suppress additional overlaps, and stopping drains both
final clips. Photos are sampled every five seconds by default.
Audio/photo uploads have independent serial lanes and retry backoff;
four extraction workers, at most one active photo, and pending-photo quotas leave
capacity for speech even when two transcription requests stall. Two unsent
phone photos pause further photo sampling while audio continues. Already captured
material remains durable; the 40 MiB phone and 64 MiB server byte limits remain.
Shorter clips have proportionally larger item budgets (240 phone items, 16,000
server captures and 12,000 sources per lecture; source text still capped at 250k).

Live Sol 6.1 updates use minimal reasoning and a 150 ms scheduling delay; full
rewrites and photo extraction retain medium reasoning. Up to three preceding
audio fragments (800 characters each) supply sentence continuity across clip
boundaries. Advanced visual authoring/review settings remain separate.
An opaque per-lecture cache identity lets the provider reuse prompt caches and
connections. Every update still starts with a fresh, explicitly supplied context;
unrelated lectures have different identities. The pinned SDK expires idle reused
connections after five minutes.

Production notes remain serial per lecture: a real browser comparison measured
10.6 seconds per changed note/sketch with serial updates versus 12.7 seconds with
competing updates. The optional `liveSynthesisConcurrency: 2` strategy is disabled
by default. When enabled, the first validated result cancels other candidates
based on old notes, and remaining sources restart from its published baseline.
Full rewrites always remain serial. The global notes/visual worker limit is three,
with at most one advanced visual job. Overlapping audio increases transcription
traffic; durable retries retain their existing limits.

The full capture benchmark measured 10.4 seconds for text updates and 11.1 seconds
for basic sketch updates (10.6 seconds combined; 17.1-second maximum). It used a
110-second synthetic vector lesson, real browser audio/JPEG capture, configured
transcription, Sol 6.1, and actual DOM rendering. All 112 uploads succeeded without
429 retries. Timing starts at the newest cited capture's start, including recording,
upload, extraction, notes and display. This is a local-network measurement, not a
phone/Tailscale guarantee; the below-ten-second combined target is not yet met.

Incremental updates prefer sparse patches: omitted sections, concepts, questions
and metadata survive exactly; explicit removals are validated. Compact point and
basic-sketch tuples reduce generated JSON without changing the stored schema.
Notes submit native JSON objects through the validation tool, avoiding a second
layer of JSON string encoding; legacy string submission remains supported.
Incremental updates can also reference unchanged sections and concepts by ID. The host
expands them to exact prior content before running the same full validator;
changed items and full refreshes still require complete content. Short model-only
source aliases reduce repeated UUID output, then resolve to durable source IDs.
Neither optimization changes saved notes, citations, diagrams, or API responses.
Changed sections can also append just new lines or reuse prior line indices when
reordering/replacing a subset. The host expands and validates the complete result
before publishing. Live updates preserve unchanged formatting; explicit refreshes
reorganize the whole notebook. The production coalescing delay is 150 ms.
Photo extraction now finishes with one validated submission as well.

Dynamic visual jobs start with cited source chunks and their immediate neighbors;
the full lecture remains available through paginated reference retrieval. Advanced
API sections also remain available on demand. Up to two complete local catalog
entries are prefetched to avoid model round trips; they are optional construction
references, never lecture evidence. An inspected scene can be submitted by its
candidate ID, with final validation and independent rendered review still required.
Lecture visual drafts use medium reasoning; rendered review and visual repairs
retain the configured visual runner's reasoning level (high by default).

Synthetic local benchmarks on 2026-10-15 measured two incremental notes runs per
variant: 19.5 seconds average before, 6.0 seconds after, with unchanged facts and
diagrams retained. A vector-scaling animation took 84.4 seconds before and
46.8/44.4 seconds after, including high-reasoning rendered review; both new runs
passed without repairs. These narrow examples do not predict full-refresh or
complex-scene latency. Smaller visual context alone reduced input tokens but did
not reduce measured wall time; medium draft reasoning supplied the observed gain.

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

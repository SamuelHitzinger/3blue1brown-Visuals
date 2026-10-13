# Lecture workspace and visualization catalog

## Intent and scope

Develop on `codex/lecture-visual-catalog` from `SamuelHitzinger/3blue1brown-Visuals/main` (8a399b5). Preserve existing interactive video generation, playback, courses, and quality gates. Add a second workspace for incrementally received lecture material, grounded notes, and private animated concept explanations. Photo/audio capture is deferred; immutable text chunks exercise the same ingestion boundary future adapters will use.

The existing website retains its visual identity but gains an overview, dedicated video composer, lecture workspace, and browsable visualization catalog. No new rendering engine, model provider, or product dependency is needed.

## Catalog

Place the catalog inside `shared/animlib/catalog`, separate from runtime asset validation. Three tiers: resources (specific assets, datasets, sources), techniques (reusable domain representations), foundations (general explanatory skills and quality). A versioned index contains stable IDs, descriptions, domains, tags, related IDs, readiness, and document paths. Documents record inputs, sources/provenance, preparation, limits, and verification requirements. Initial coverage maps to actual molecular assets, spatial algebra, graphs, sampled data, and approved geometry-led style.

Models receive compact navigation instructions plus bounded search/read tools. Those tools resolve allowlisted catalog IDs, never arbitrary paths. Planning, authoring, review, and repair retain current instruction content and validators. Catalog references are separate from lecture/source citations. Listing an asset is not evidence that it is loaded or visually approved. Existing exact-source and molecular publication paths remain authoritative. Search has bounded responses and pagination; dependency traversal is bounded and cycle-safe. Growing the library does not grow every prompt.

## Lecture workflow

Create a titled session, append text chunks, and return immediately after durable storage. A bounded background worker synthesizes structured notes with source IDs, concepts, and open questions. Store source revision and synthesized revision separately; append during generation triggers another pass without losing data. Preserve last successful notes on failure; expose retry. Keep user-written personal notes separate from generated notes. Poll snapshots while work is pending.

Each concept includes a causal visualization brief and optional catalog IDs. Generate the first new concept automatically, with further concepts on demand. Standalone silent animlib scenes use existing scene craft/reference, compiler, scene inspection, previews, and visual quality review. Store scene source privately with its source revision; show stale state when sources advance. No lecture text is published into the shared video library automatically.

SQLite persistence uses a database beside `VIDEO_DB_PATH` unless `LECTURE_DB_PATH` overrides it. Identity follows trusted proxy headers; anonymous local use is a shared local workspace. API mutations enforce same-origin policy. Idempotent creation/appends, bounded inputs, sanitized errors, cancellation, restart recovery, and late-result protection are required. Missing model credentials produce an honest error while source material remains saved.

## Website

`/` presents two primary workspaces and recent work. `/videos/new` retains the current video composer. `/lectures` lists sessions; `/lectures/:id` presents source input/history, generated notes with navigable citations, editable personal notes, and embedded concept visualizations with playback. `/catalog` searches Resources, Techniques, and Foundations and shows actionable details/provenance. Keep all existing routes and register new backend deep links. Use existing theme tokens, responsive layouts, accessible controls, and explicit loading/empty/error states. Future camera/microphone capture is clearly marked unavailable.

## Verification and quality claim

Tests cover catalog integrity/bounded lookup, actual runtime tool exposure and all pipeline stages; lecture durability, ownership, idempotency, concurrent updates, cancellation/recovery, citation validation, generation failure, and route contracts; frontend client requests, revision handling, export, and playback integration. Run existing build, typechecks, frontend/backend/animlib suites and browser checks. Review a rendered representative scene separately from code correctness. Preserving gates is not proof of universally equal generated quality or faster generation: report measured evidence and remaining uncertainty.

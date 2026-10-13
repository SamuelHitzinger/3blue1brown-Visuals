# Lecture workspace and visualization catalog implementation plan

**Goal:** Extend Aha with durable lecture notes and private visual explanations, backed by a scalable three-tier animlib catalog.

**Architecture:** Shared versioned contracts; a file-backed catalog with bounded agent tools; SQLite lecture jobs with revision-safe workers; existing React application and animlib renderer. Preserve the current video generation path and quality gates.

**Tech stack:** TypeScript, Bun/SQLite, React/Vite, Pi AgentRunner, animlib.

**Spec:** `docs/superpowers/specs/2026-10-14-lecture-visual-catalog-design.md`.

## Constraints and review focus

- Branch `codex/lecture-visual-catalog`, upstream `visuals`; no changes to unrelated local files.
- No photo/audio capture yet. Input boundary is immutable text chunks.
- No automatic publication of private lecture material to shared videos.
- Bounded search, context, workers, retries; do not remove existing generation guidance or checks.
- Tests must cover stale asynchronous responses, append during synthesis, source/citation mismatch, missing credentials, and inaccessible catalog resources.

## Tasks

- [x] Catalog: add versioned manifest/documents under `shared/animlib/catalog`; host search/read API and runtime tools; connect planner, author, reviewer, repairs; add integrity and integration tests. Own catalog-related files and prompt additions.
- [x] Lecture service: consume `shared/lecture.ts`; implement `LectureService(dbPath, synthesize?, {visualize?, concurrency?})`, owner-scoped API, SQLite queue/recovery, generated/personal notes separation, per-concept visualization jobs. Implement grounded synthesis in `backend/src/agents/lecture.ts`; test with injected runners and real SQLite.
- [x] Website: overview, dedicated composer, lecture list/detail, catalog browser; shared API client, source citations, private embedded playback, personal notes and Markdown export, responsive navigation. Preserve existing course/video behavior. Test client/revision/export behavior.
- [x] Integration: wire service lifecycle and routes, implement standalone scene generation using existing review/inspection, configure environment documentation and deployment persistence.
- [x] Verification: build and typecheck; complete existing suites with environment-safe temporary directories; browser checks at desktop/mobile; independently review diff and representative animation. Fix substantive defects, then commit and push only task files.

## Shared interfaces

`shared/lecture.ts` is authoritative. GET/POST `/api/lectures`; GET/PATCH/DELETE `/api/lectures/:id`; POST `/:id/sources` body `{text,kind:'text'}` with `Idempotency-Key`; POST `/:id/synthesize`; POST `/:id/concepts/:conceptId/visualize`. GET list returns `LectureSummary[]`; all successful mutations except DELETE return `LectureSession`. PATCH accepts `title`, `personalNotes`; absent fields remain unchanged. Backend catalog endpoints: GET `/api/visualization-catalog?query=&tier=&offset=&limit=` returns `{entries,total,offset,limit}`; GET `/api/visualization-catalog/:id` returns entry plus `content`. Catalog agent will supply shared public types.

## Progress

- Discovery complete on both upstreams; final base is `visuals/main` 8a399b5. Branch published to requested repository.
- Root build passed before changes. Initial baseline tests hit sandbox temporary-file ENOENT/EPERM; rerun with an explicit workspace temporary directory before judging regressions.
- Backend: 370 tests passed. Frontend: 100 tests passed. Animlib: 1,131 tests passed. Builds and TypeScript checks passed.
- Browser QA covered desktop and 390-pixel layouts, lecture creation/source input, citations, persistence of personal notes, interactive playback, navigation, catalog filtering, and safe links to source documents.
- Independent review caught missing runtime catalog packaging and interrupted provider cleanup; both fixed and covered by checks. Full Docker image smoke awaits a running Docker daemon.
- Live notes and visualization generation completed with the configured providers. The first sample prompted a stronger standalone causal-construction contract; the revised sample shows matching horizontal slices and height evidence, with verified geometry-targeted rotation and paused timeline seeking in the browser.
- Independent visual inspection initially suspected disappearing labels. Two separate decoded-pixel checks disproved that observation: static label regions are byte-identical across sampled motion and hold frames in both aspects, including the suspected frames. Retained and reference rendering differ by at most one channel unit. No renderer change was warranted. The revised scene passes the sampled reasoning/style checks; this does not certify all future generated scenes.

# Prepared scientific assets implementation plan

> Use subagent-driven-development for independent implementation/review tasks.

**Goal:** Reuse expensive scientific preparation while preserving exact identity,
scientific limits and rendered quality.
**Architecture:** Immutable prepared binaries, bounded catalog documents and
explicit mathematical motion recipes share existing model publication/renderer.
**Stack:** TypeScript, Bun, animlib, existing SQLite/GLB/native renderer tooling.
**Spec:** ../specs/2026-10-14-prepared-scientific-assets-design.md

## Tasks and ownership

- [x] Persistent preparation cache: new backend/src/prepared-artifacts.ts and
  tests. Inputs namespace/version/JSON identity, async producer returning bytes
  and JSON context. Bounded immutable content store, hash-verified read, atomic
  manifest write, cancellation-isolated concurrent callers. Test restart,
  corruption, cache key changes, byte limits and interrupted writers.
- [x] Molecular route: backend/src/molecular-models.ts and tool callers. Refactor
  input preparation so source plus CCD hashes enter cache key before building.
  Add explicit mixed/backbone option, preserve default output. Test input selection,
  gaps, unsupported claims/inputs and both pipelines. Benchmark public large source.
- [x] Rigid motion: shared/animlib/src/scientific-state-types.ts and
  scientific-state.ts, docs, recipe and tests. Test exact renderer rotation order,
  pivot compensation, distance preservation, random seeks and actual scene VM.
- [x] Catalog storage/contracts: catalog types/metadata/guidance, bounded cache in
  backend/src/visualization-catalog.ts; keep navigation and detail budgets stable.
  Add runnable motion recipe to existing reference tool. Test full detail and
  limits, compatibility and retrieved contracts.
- [x] Native proof: real deposited large molecule, exact selected representation,
  explicit illustrative rigid motion; source, style contract, frames and MP4.
  Independent scientific/visual review. Benchmark cold/warm preparation and VM.
- [x] Integration: all relevant suites, builds, docs, review, commit/push.

## Review focus

Wrong chain/representation reuse; dictionary changes; canceled concurrent caller;
corrupt cache metadata; motion that breaks part identity or implies measured data.
No unverified asset substitution and no automatic resolution reduction.

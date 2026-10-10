# Prepared asset registry and static model reuse

Branch `amilibsam`; root serializes commits. Read `asset-architecture.md`,
`infrastructure-review.md`, `design.md`, and existing renderer/sequence contracts.
Implement the first real asset slice, not another proposal. User explicitly
requires efficient reuse of existing assets, textures and model libraries.

## Scope and ownership

Own focused new asset types/validation/registry/resolver modules, tests, native
prepared model fixture and host loader/tooling. Pin concrete interfaces early.
Path engine currently owns shared compiler/runtime/types/reactive/timeline/core
and render-geometry files. Coordinate directly; build independent modules first,
then agree a serialized shared-file handoff before integration. Do not silently
compete for those files. Root will assign image shaders and converter follow-up.

Deliver source-length-independent immutable model reuse via host registry,
descriptor-only compilation, `s.model`, stable geometry references, normal
sequence/player/offline rendering, and bounded storage/lifetimes. Do not inline
the model into QuickJS or every Frame. Referenced vertices/triangles participate
in existing budgets, including repeated instances. No budget increases without
measurements and root agreement. Preserve inline geometry and audio APIs.

## Resolved review points

- Version 1 image storage is RGBA8 with explicit host `source` color policy;
  palette-indexed image storage is deferred and rejected. Scene code cannot
  authorize source colors. Existing scene color tokens stay unchanged. Pin image
  descriptor shapes for next renderer slice; do not claim image support until
  both backends render it.
- One narrow read-only `asset-geometry` resolver must serve retained geometry,
  CPU fallback, bounds, validation, clipping, shadows and transparent sorting.
  Back it with a held host lease; raw mutable registry arrays stay private.
  Do not expand arrays back into Frames or make backend-specific model copies.

## Requirements

Use content identity, stable part IDs, explicit provenance/license/source and
native validated geometry. Freeze/clone public input; prevent mutation by caller.
Acquire/release references transactionally. Failed compilation/preparation or
canceled export cannot leak leases or invalidate another active player. Avoid
global caches. Start bounded and simple; unnecessary eviction policy may be
deferred if immutable caller-owned registry plus bounded leases suffices.

Support static model groups and ordinary transforms, opacity, keep/remove,
layers/views and handoff. Explicitly reject deformation/topology morphs of asset
references in this slice. Validate descriptors again against live registry on
host preparation. Missing/stale references fail visibly before scene playback.
Source can access bounds/parts descriptors only, with no bytes/network access.

Package loader must validate content hashes, exact byte lengths, finite
coordinates, triangle indices, normals and counts, overflow, duplicate IDs,
aggregate memory and source provenance. Resolve package paths inside package root
before reads; reject escapes and unresolved dependencies. Do not silently supply
missing units or license. Use a small permitted fixture with recorded origin;
synthetic fixtures are useful for tests but final reuse proof needs a real
externally sourced permitted model. Converter is next slice, so a documented
one-time preparation script is acceptable if faithful and reproducible.

## Verification

Failure-first tests for validation, immutable identity, repeated model memory,
descriptor payload size independent of vertex arrays, ordinary compilation and
reverse sampling, transactional replacement/disposal and failed preparation.
Render native original model proof through production export, inspect actual
frames. Exercise CPU fallback as well as retained path. Record counts, compile
time, payload bytes and allocation/upload behavior with honest benchmark limits.
Typecheck/build/focused tests, then coordinated broader suite. Existing baseline
GPU failures remain recorded separately. No lowering checks to make tests pass.

Write `assets-implementation.md` with pinned interfaces and progress, then
`assets-report.md` with actual delivered behavior, output paths and remaining
image/converter work. Independent reviewer follows implementation.

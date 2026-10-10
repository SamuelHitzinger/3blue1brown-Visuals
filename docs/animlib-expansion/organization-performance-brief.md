# Library organization and measured optimization

Read design/plan, completed reports, and current code. User explicitly requested
dedicated organization/optimization agents so additions stay manageable. Own
documentation and benchmark fixtures first; coordinate production changes against
active asset/image/path/domain owners. Stay amilibsam, root commits, Astra/high.

## Maintainability

Review public API coherence, module boundaries, self-contained QuickJS factories,
host-only import/preparation versus scene-only authoring, resource ownership and
artist style separation. Document efficient recommended workflows with runnable
sources. Update animlib README and focused guide(s); keep operational research
ledger separate from public user documentation. Avoid exposing internal compiler
details in ordinary author workflows unless necessary to choose scale/quality.
Also update `docs/reference.md` and `docs/capabilities.md`: those are supplied to
scene-generation and storyboard agents. README currently says domain helpers
belong outside the library and that image textures do not exist; replace stale
claims only after the corresponding integrated capability is verified.

Consolidate demonstrated duplication narrowly. Do not reformat the entire old
library or create a parallel framework. Identify new modules with dense unreadable
implementation and make targeted readability improvements only after tests bracket
them. Preserve actual behavior. Add capability/limit table with explicit supported
format subsets and source-fidelity limitations; no pretend full glTF/PBR/physics.

## Measurements

Reproduce original CPU-stub benchmark once final integration settles, then add
real representative model reuse, molecular geometry/retained motion and dense
path fixtures. Measure compile/prepare, payload size, median/p95 CPU time, actual
GPU uploads/draws and memory where supported, direct/reverse seeks, multiple
players and disposal. Distinguish CPU preparation from GPU frame rate. Record
hardware/backend and data sizes. Warm-up appropriately; compare like-for-like.

Investigate actual bottlenecks before changing code. Examples to check: repeated
geometry hashing/cloning of immutable models, per-frame molecular rebuilding,
duplicate sphere templates, transparent sorting, path fragment allocation,
resource retention across renderer loss. Existing caps cannot be bypassed merely
to improve a benchmark. Show correctness/pixel parity after each optimization.

Write organization-performance-report.md with before/after evidence and exact
limits. Root schedules fresh architecture/code review and separate visual review;
your measurements are not reference-style acceptance.

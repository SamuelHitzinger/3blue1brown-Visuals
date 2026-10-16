# Cross-subject and visual-detail evaluation matrix

2026-10-16. **Planning evidence; the cases below are not completed trials.**
This extends the [workshop evaluation](realtime-workshop-evaluation.md) and
[complexity protocol](complexity-matrix-protocol.md). It does not replace the
[mid-session inventory implementation](live-model-inventory-design.md) or claim
that resource registration proves suitable asset selection or explanation quality.

## Independent axes

Record subject reasoning, visual detail and change workload separately. A simple
2D line, a complete detailed organic molecule and a curved 3D surface each need
their own acceptance evidence. More triangles do not imply harder reasoning;
faster line plots cannot compensate for a failed molecule or surface.

Within each controlled detail pair, freeze the same data, claim, entities,
relationships, camera, motion, labels, duration and reading hold. Change only the
declared rendering detail. Removing atoms, bonds, annotations or inference steps
is a different coverage contract, not a speed optimization. Cases that change
content density or reasoning are separate strata rather than detail-only pairs.

## Concrete next cases

Every row includes initial creation, a retained edit and an evidence correction.
For each, define source-grounded invariants before generation. Unfrozen external
sources below are proposed fixtures requiring verification before execution.

| ID / subject | Required construction and operation | Detail axis | Checks and current evidence boundary |
| --- | --- | --- | --- |
| A / algebra | Straight line with attached rise/run; move the input, then correct slope | Sparse 2D control; a two-line comparison is a separate denser-content stratum | Coordinate/scale correctness, quantities remain attached. Prior simple/two-line model screen exists; new causal edits remain untested. |
| B / measured data | Unseen supplied series; compare values at shared input, then correct one datum | Sparse versus dense data is an explicit content-density stress test, not a pure tessellation comparison | Preserve exact values, units and unchanged samples/scales. New data holdout; no prior result claimed. |
| C / multivariable calculus | Saddle with moving plane, fixed comparison trace and local labels; correct a coefficient | 10/20/40 cells per axis, same equation and slice operation | True curved 3D mesh, analytic trace correctness, approximation error, occlusion and label attachment. Known saddle is a development control. |
| D / organic chemistry | Full caffeine conformer; identify group, reveal prescribed detail, rigidly rotate and translate | Atom mesh detail 0/1/2; all 24 atoms and 25 bonds remain in every arm | Exact supplied coordinates, elements, bond orders/endpoints and distance preservation. Known caffeine is a development control, not evidence for reactions or other molecules. |
| E / probability | Two normalized densities on shared axes; move interval, change a parameter, correct an annotation | Curve sampling varied with identical distributions and intervals | Normalization, labels track actual parameters, shared scale and probability meaning. Prior screen had label/compile failures; no passing retained-edit claim. |
| F / wave physics | Two signed inputs plus their sum; change phase and correct one amplitude | Curve sampling varied; retain both inputs and signed-vector operation | Sum correct throughout motion, negative contribution visible, no clipping. Prior screen is sampled model evidence only. |
| G / mechanics and circuits | Source-grounded force construction from required German lecture; separately, unseen RC charging with linked circuit/curve | Sparse force/circuit construction and denser linked views are distinct coverage contracts | Signs, units, constraints and causal response; verify exact lecture intervals/equations first. MIT joined-run transport does not cover the German lecture or RC circuit. |
| H / unseen 3D surface | New verified parametric surface with contour or tangent operation, then parameter correction | Coarse/detailed mesh; identical parameterization and operation | Geometric relation, numerical tolerance, depth and attached labels across navigation. Geometry holdout; saddle success cannot qualify it. |
| I / unseen organic structure | New verified complete organic conformer; locate functional group, rotate, then correct group identity | Medium/high atom tessellation with identical complete topology | Identity, source/conformer limitations, topology, group membership and readable spatial relationships. Data/molecule holdout; caffeine and 4YLN do not qualify it. |
| J / imported scientific asset | Newly introduced static GLB plus plausible distractor; select correct asset, locate a named part, transform and reuse | Detailed imported geometry retained intact; record parts/triangles/texture budgets | Scientific provenance and suitability, correct part mapping, intact unrelated motion, cold admission and warm reuse. Existing 4YLN proof is a handwritten runtime control. |

Add an unrelated qualitative lecture holdout, such as chronology with explicit
uncertainty, before any broad subject-generalization claim. Merely changing a
coefficient or renaming caffeine is not an unseen subject. Freeze the candidate
before revealing holdout wording, source intervals, data and asset identities.
Once a holdout informs tuning, relabel it development evidence and replace it.

## Paired native runs and cache conditions

For every selected row/detail level, compare a task-matched established native
pipeline baseline with the candidate using identical input boundaries, required
coverage, carried state, assets and viewport. Freeze source/prompt/runtime hashes,
model settings, actual service tier and the intended experimental difference.
Counterbalance arm order; retain failures and pipeline repairs with their time.
No manual improvement of just one arm or scenario-specific precomputed answer.

Asset-dependent cells require separate paired conditions:

- **Cold:** fresh world/ModelStore and unprepared required asset; inventory build,
  selection, admission, byte loading, decode and renderer preparation are timed
  whenever they occur after the obligation starts. Disclose OS/disk caches and
  generic startup preloading; do not call a fresh decode a cold network retrieval.
- **Warm:** same exact asset already admitted, decoded and prepared in a running
  world; perform the matched retained edit and verify geometry reuse.
- **New mid-session asset:** start with unrelated active motion and no target ID;
  introduce/register it after the obligation begins, then select, prepare and use
  it. Repeat with an invalid/conflicting asset and a correction during preparation.

For native constructions without external assets, label asset cold/warm `N/A`
and record fresh construction versus retained edit separately. Do not invent
retrieval work to populate a matrix cell. Preserve camera, world/renderer instance,
prior animation clocks and original deadline across inventory changes.

## Independent acceptance gates

Use the exact native artifact at 1280×720 and 960×720, semantic milestones and
transition interiors, plus continuous production-player motion and requested
navigation/interaction. Randomize opaque A/B packages and withhold author identity,
timing and desired winner from fresh independent reviewers. Freeze verdicts before
unblinding. Numerical invariants supplement rendered evidence; neither substitutes
for the other.

Record each gate separately as `ready`, `revise` or `unverified`:

| Gate | Required pass evidence |
| --- | --- |
| Semantic correctness and coverage | Source-faithful claim, complete obligations, correct equations/topology/provenance and visible operation supporting the inference; no unsupported mechanism. |
| Visual readability | Legible local labels, meaningful depth, preserved detail, no consequential clipping/occlusion/overlap through motion at both widths. |
| Reference style | Persistent objects, purposeful transformations, locally connected annotations and reading holds; task-appropriate parity with approved reference style. |
| Technical delivery | Complete usable playback and controls, correct retained state, no stale revision or broken attachments; speech synchronization when requested. |
| End-to-end latency | Complete usable accepted revision observed within `t6 - t0 <= 10,000 ms`, with timing uncertainty recorded. |

Use the workshop's frozen `t0`: the last input needed to determine the operation
becomes available to the client. Record the source interval start and capture
cadence too. Include ASR, queueing, retrieval, inference, retries/repair, validation,
resource preparation and publication after `t0`. Corrections and new context do
not silently renew an existing obligation's deadline. Record world commit and
renderer submission separately from browser observation; neither proves hardware
presentation. Unknown presentation timing leaves the strict delivery claim
unverified. A title, placeholder, static substitute or fast deferral fails coverage.

Report animation endpoint separately: a deliberately paced explanation may last
longer than ten seconds if its complete usable motion is ready within the budget.
No failed/unverified quality gate can be averaged into a pass. Report combined
timely-and-correct-and-quality-accepted outcomes per subject, detail, operation and
cache state, including all failures. Predeclare repetitions and justify any tail
latency/reliability claim; single runs or repeated easy cases do not establish p95
or arbitrary-subject guarantees.

## Existing evidence mapped without expanding its scope

| Evidence | Established | Still missing |
| --- | --- | --- |
| [Eight-case model screen](complexity-screen-checkpoint.md) | Algebra, saddle calculus, probability, waves, caffeine; exact native samples and preserved failures | Reliable helper uptake, full motion approval, causal lecture input, end-to-end deadline and unseen-subject results |
| [Controlled detail](controlled-detail-checkpoint.md) | Same-content saddle/caffeine low/high mesh comparisons; 41 state samples and offline movies | New model trials, independent continuous-motion review, live latency; prepared prospective instructions remain not-run |
| [Manual quality recovery](quality-revision-checkpoint-2026-10-16.md) | Revised detailed saddle/caffeine sampled reasoning/readability/style judged ready without geometry reduction | One-shot authoring speed, full-motion parity, reactions, other molecules or general lecture quality |
| [Joined lecture run](lecture-join-checkpoint.md) | One MIT interval connected causal input, ASR, model, retained world and observed browser pixels | Explanatory quality failed; no successful edits, asset selection or matched causal quality baseline |
| [Static asset integration](lecture-static-assets-checkpoint.md) | Handwritten 4YLN, 90,004 triangles, local load and retained translation with one shared model read | Model selection, semantic suitability, new-asset arrival, live deadline, quality parity or animated clips |
| [Local asset index](realtime-local-asset-index-2026-10-16.md) | Bounded lexical lookup and exact static payload/provenance loading | Semantic retrieval/general asset discovery; installed corpus has no animation clips |
| [Inventory design](live-model-inventory-design.md) | Contract and implementation plan for append-only admission | No cross-subject or end-to-end quality result follows from this design or its unit tests |
| [Late model admission proof](live-model-inventory-checkpoint.md) | Empty inventory to local 1CRN, 10,784 intact triangles, retained graph/surface/motion, one decoded geometry read, offline pixel checks | Automatic retrieval, semantic suitability, model authoring, full-motion quality, same live renderer and lecture-to-display latency |

The next workshop evidence must fill the missing cells with paired native outputs,
source-grounded audits, independent review and causal timing. This document adds
no provider run, download, benchmark measurement or acceptance result.

# Real-time lecture animation R&D

## Objective and authority

The user requests an ongoing, delegated R&D workshop for a single flowing visual
world driven by incoming lecture video, speech and instructions. New constructions
and manipulations must be ready within **10 seconds**; the user increased the
original five-second limit on 2026-10-16. Five seconds remains a diagnostic only.
Visual and animation quality must be very similar to or better than the baseline,
as judged by fresh critical reviewers. This document records the authorized R&D
direction, not a claim that the objective is met or that an architecture is final.

The user permits any models in fast mode and requests both the supplied local
lecture and other online media as tests. Continue on
`codex/animation-authoring-efficiency`; commit and push to `visuals` regularly.

## Requirements that remain binding

- Respond to new evidence, corrections and parameter changes in one persistent
  world. Preserve meaningful entities, camera, context and relationships.
- Support arbitrary subjects with procedural geometry, data and resource access.
  Shared primitives, typography and routine styles are allowed; a growing library
  of subject-specific answer templates is not the solution.
- Measure capture/evidence availability through complete, usable presented output.
  Text arrival, first pixels and headless compilation are separate diagnostics.
- Include transcription, interpretation, queuing, asset loading, validation and
  repairs in the appropriate end-to-end latency. A later repair cannot erase a miss.
- Reject malformed or stale updates atomically. Continue the last valid visual
  state; do not execute partial JavaScript or grant generated code host access.
- Compare equal coverage and explanation depth. Missing objects, causal operations,
  labels or interactions are failures, even when the result arrives quickly.
- Require actual motion and interaction evidence, not just attractive stills.

## Current evidence

The lecture path is batch-oriented: completed audio clip -> transcript -> notes
synthesis -> one selected concept -> complete 12-second scene -> rendered review
-> polling -> remounted player. Camera sampling can delay input ten seconds.
`AgentRunner.run` returns a complete string; the player replaces whole scenes and
resets playback. Reactive bindings update existing geometry but cannot create
new objects. These constraints are architectural, not prompt wording problems.

The inherited animation-efficiency work reduced some complete-lesson generation
times, but its representative runs still took minutes. It establishes reusable
compiler, geometry, asset and review capabilities, not real-time acceptance.

## Approaches under test

1. **Short native code:** retain animlib's full procedural expressiveness and
   sandbox. Ask only for the new operation. Risk: repeated world reconstruction
   and whole-source completion can dominate complex changes.
2. **Generic operation stream:** stable IDs with create/update/animate/remove,
   bounded numeric/data payloads, atomic transaction boundaries. Risk: expanded
   JSON and a fixed operation vocabulary can cost more tokens and limit geometry.
3. **Hybrid (working preference):** generic edits plus small sandboxed procedural
   definitions for novel constructions. Host owns timing, stable state, styles,
   resource resolution and transactions. The model owns the explanation and novel
   geometry. Promote this only after measured comparison.

Do not rewrite the renderer or switch engines without evidence that it is the
bottleneck. Native rendering remains the baseline for visual comparisons.

## Proposed boundaries

`timestamped evidence -> direct visual interpretation/authoring -> complete bounded
transaction -> validation and preparation -> persistent world commit -> presentation
receipt`. Notebook synthesis runs concurrently rather than gating visual output.

The model receives a compact committed-world summary and relevant evidence, not
the entire lecture history. Every response references its base revision and source
evidence. A newer correction supersedes stale work. Queue and coalescing behavior
must preserve unrelated teaching operations rather than dropping all but the last.

Transactions compile independently while the existing world continues playing.
New work starts from the current displayed state, not the previous scene's future
endpoint. Unaffected animations and bindings must keep advancing. Snapshot handoff
alone does not solve this: replacing it can freeze ongoing motion or introduce a
compile-time pose jump. This is an explicit runtime design/test requirement.

Immediate checks cover syntax, bounds, dependencies, referential integrity and
runtime preparation. Continuous visual review may run asynchronously for research,
but timely-quality acceptance still judges the first delivered complete revision.
Retrospective review is not permission to count a defective early version as ready.

## Experiment sequence

1. Measure model-only latency for matched generic create/edit instructions in
   native code and operations. Record requested, sent and returned service tier;
   never infer priority processing from a request flag.
2. Measure true process-cold and warm native compile/evaluate/update paths. Prove
   geometry exists and changes. Label CPU-only results precisely.
3. Lower actual model outputs and render them. Record failures and omissions.
   Compare with task-matched baseline and the approved explanatory style.
4. Build a persistent-world experiment with mid-motion updates, corrections,
   malformed/stale transactions, interruption, and long-session resource bounds.
5. Connect timestamped real-media inputs and measure actual browser presentation.
   Expand into held-out cross-subject trials and fresh blind review.

Detailed acceptance protocol: `docs/validation/realtime-workshop-evaluation.md`.
No intermediate experiment completes the full objective.

## Initial media

- User-supplied local MP4: `SMP_ML_E12_20201130_101300_S1R1.mp4`.
  Inspected metadata: 1:57:59.76, 1280x720, 25 fps, AAC stereo. Sampled frames
  show German mechanics, statics/friction and spatial support-force constructions.
  Keep the raw lecture and extracts in ignored local data; no public upload.
- [MIT 8.03SC lecture 1](https://ocw.mit.edu/courses/8-03sc-physics-iii-vibrations-and-waves-fall-2016/resources/lecture-1-video/).
- [MIT 7.016 lecture 4](https://ocw.mit.edu/courses/7-016-introductory-biology-fall-2018/resources/lecture-4-enzymes-and-metabolism/).
  These official pages provide downloadable CC BY-NC-SA course media. Preserve
  source URLs, local hashes, excerpt times and attribution in local manifests.

## External guidance used

OpenAI's [latency guidance](https://developers.openai.com/api/docs/guides/latency-optimization)
supports reducing output syntax and sequential calls; it does not prove this
application's performance. [Fast mode documentation](https://developers.openai.com/api/docs/guides/fast-mode)
states that returned `service_tier` identifies actual processing tier. Local
measurements and rendered evidence determine our architecture and acceptance.

# Real-time workshop checkpoint — 2026-10-16

User acceptance deadline is now **10 seconds**, with five seconds retained only
as a diagnostic. The overall goal remains open. All measurements below are
exploratory, small-sample results, not acceptance estimates.

## Findings

- Twelve Luna text probes: eleven provider completions in 1.25–4.59 seconds;
  one runaway response aborted at 90 seconds. The failed response kept emitting
  duplicated output and whitespace. It was not an idle local wait.
- Across eighteen text/image runs, exact-output verification found seventeen
  provider completions, nine executable outputs, and eight sampled semantic
  passes. Six failed parsing/protocol validation; three were unverified because
  of provider failure or a failed creation dependency. One executable output
  omitted the requested reveal animation.
- Four additional Sol61 cube/curve creations passed the sampled state checks.
  These are included in the eighteen-run count, not an independent validation set.
- Warm native compilation was approximately 12 ms; reactive updates below
  0.2 ms. Replacing an eight-scene history cost approximately 104–110 ms.
- Both initial MIT-image responses failed exact-source parsing. A subsequent
  approved local lecture-frame request completed in 14.46 seconds, exceeding
  the target before compilation or presentation.
- Every completed provider response reported the default service tier despite
  requested priority. No run proves fast-mode entitlement.

## Persistent world

The experimental world keeps sandbox programs and their clocks alive. New
programs own disjoint IDs; property edits override only requested properties.
Fourteen QuickJS tests cover continuity, current-pose transitions, stale updates,
failed preparation, atomic rollback, resource limits and disposal.

Browser prototype measurements include request, process startup, model response,
compilation, resource preparation and first renderer submission:

| Request | First render submission | Outcome |
| --- | ---: | --- |
| Create rotating cube and label | 2.72 s | Submitted; visible cube confirmed |
| Move cube and change fill | 1.76 s | Submitted; retained rotation |
| Add procedural sine wave and marker | — | Failed: unquoted YELLOW identifier; previous world retained |

These are **render-submission timestamps**, not hardware presentation timestamps.
They exclude lecture capture/transcription and do not establish scientific
correctness or visual parity. The detached label after moving its cube also
illustrates why successful property execution is not a quality verdict.

## Rendering and evidence

Unicode numeric scripts such as `²` originally caused a bundled-font exception.
The renderer now typesets them through its existing TeX script layout. Original
failed evidence remains intact; rerenders use new directories. An apparent blank
operation-render preview was investigated: its final PNG and native-JS final
PNG are byte-identical. It was not a lowering mismatch.

Ignored local evidence lives under `data/realtime-workshop/`. Exact prompts,
source hashes, response events, failure outcomes, source media hashes and new
render directories are retained. Raw private media is not committed.

## Next acceptance work

Connect timestamped media ingestion, bounded reliable submissions, automatic
speech alignment and asset resolution to the persistent world. Test novel
cross-subject geometry, corrections, concurrent arrivals and long sessions.
Obtain fresh blind quality review against matched baselines with motion proof.
Do not infer end-to-end success from these component probes.

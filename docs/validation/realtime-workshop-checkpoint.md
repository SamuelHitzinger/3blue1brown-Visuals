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
| Create cube plus procedural wave after clarifying color-string syntax | 3.95 s | Submitted; cube, wave and marker visible |

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

A fresh critic inspected the local mechanics candidate without model or latency
information and rated it **4/10, revise**. It reproduced the equal-reaction
conclusion without explaining symmetry or moments; missing hidden-member cues
made the support plane ambiguous, and labels collided with geometry. There was
no matched baseline animation in this review, so it establishes no parity claim.
The source frame was uploaded only after the user's explicit OpenAI approval.

Ignored local evidence lives under `data/realtime-workshop/`. Exact prompts,
source hashes, response events, failure outcomes, source media hashes and new
render directories are retained. Raw private media is not committed.

## Structured submission and local speech checkpoint

The next probe uses one forced strict tool submission, separating commentary from
source. It records both completed tool arguments and provider termination; source
is accepted only after they agree. This removes text/code parsing ambiguity, not
JavaScript or scientific errors. The renderer verifies exact accepted source
hashes before compilation, without repair.

A matched MIT restoring-acceleration pair shares one model-generated causal brief,
public source frame, past-only public ASR excerpt, model settings and visual timing.
The first pair failed because the supplied API prompt incorrectly advertised
`GRAY`; the native palette requires `GREY`. Both failures remain immutable. The
corrected second pair compiles and renders unchanged for eight seconds.

| Stage | Baseline | Helper-guided candidate |
| --- | ---: | ---: |
| Shared causal brief, provider termination | 5.233 s | 5.233 s |
| Authoring, provider termination | 8.524 s | 8.342 s |
| Sum of model stages | 13.758 s | 13.576 s |
| Offline compile | 40.6 ms | 15.2 ms |

The 182 ms authoring gap is a single observation, not established speedup. Neither
output used compose/schedule; both used native time callbacks. Model-stage sums
exclude ingestion, orchestration gaps, rendering and presentation, and both exceed
ten seconds. Priority was requested; actual service tier remained default.
Evidence: `data/realtime-workshop/tool-probes/mit-{baseline,compact}-02` and
`mit-causal-brief-01`; native renders at `rendered/2026-10-15T23-26-00.764Z`.

Local CPU speech recognition now has measured past-only four-second windows;
see [local ASR checkpoint](local-asr-checkpoint.md). Actual public speech phrase
resolution produced source times 894.12–896.72 seconds in approximately 0.9 ms.
Phrase selection was manual in this probe; timestamp arithmetic was automatic.
ASR accuracy and overlapping-window stabilization remain unresolved. No private
audio or transcript was uploaded or included in tracked documentation.

The timestamped evidence scheduler prevents future-frame leakage, cancels work
whose evidence is corrected, preserves unrelated changes, and retains each changed
event's deadline. Earlier contradictory duplicate-arrival timestamps reject rather
than silently extending latency budgets. It remains an isolated component, not
an integrated live ingestion pipeline.

The persistent world now resolves internal attachment/connector bindings after
host property edits. Regression tests cover moving labels, retained rotation,
collapsed connector recovery, missing sources, and atomic rejection of writes to
binding-owned properties. Cross-program bindings remain unsupported. Forty-nine
focused tests and strict TypeScript checking passed for this checkpoint. Native
rendering and component tests still do not establish visual parity.

## Remaining acceptance work

Connect timestamped media ingestion, bounded reliable submissions, automatic
speech alignment and asset resolution to the persistent world. Test novel
cross-subject geometry, corrections, concurrent arrivals and long sessions.
Obtain fresh blind quality review against matched baselines with motion proof.
Do not infer end-to-end success from these component probes.

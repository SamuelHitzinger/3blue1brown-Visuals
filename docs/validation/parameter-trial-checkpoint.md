# Parameter trial preparation and speech integration checkpoint

2026-10-16. Forty requests prepared locally; zero sent. This checkpoint adds an
offline experiment harness and integration tests, not new production behavior or
a measured model speedup. The deadline remains ten seconds.

## Subject and visual-detail coverage

The ten development cases span five subjects, each at two rendering detail levels:

| Subject | Low / high detail | Requested retained change |
| --- | --- | --- |
| Algebra | Line sampled at 17 / 129 points | Increase slope by 0.75 |
| Wave physics | Three curves at 33 / 129 points each | Increase phase by 0.9 radians |
| Probability | Two density curves at 33 / 129 points each | Increase standard deviation by 0.55 |
| Multivariable calculus | Saddle with 121 / 1,681 vertices, 200 / 3,200 triangles | Double curvature |
| Organic molecule display | Caffeine atom meshes with 192 / 3,072 triangles total | Increase rigid rotation by 0.5 radians |

Both molecular levels retain all 24 atoms, 25 bonds and 29 bond strokes. Rotation
is a display operation on a computed conformer, not molecular dynamics. These
cases test one numeric change per scene; they do not establish unseen-subject
generalization, initial creation, complex reasoning or imported-asset performance.
The broader [evaluation matrix](cross-subject-visual-matrix.md) keeps those axes
and future holdouts separate. No averaging away a failed detailed 3D case.

## Prepared paired experiment

`backend/bench/realtime-media/parameter-trial.ts` exports
`prepareParameterTrials`, `trialSchedule` and `evaluateParameterTrials`. It has
no provider execution path. Preparation uses a new output directory, writes files
once, and counterbalances arm order within each case across two repeats.

Both arms receive identical initial source, compiled current summary, task and
scene time, with the same system instruction and strict tool schema. Only the
assigned action differs. The candidate emits a retained parameter transaction;
the baseline emits complete source for a fresh reconstruction evaluated at the
original epoch. **The baseline is not live source replacement:** that atomic
operation is not currently exposed by LiveWorld.

Prepared local bundle: `data/realtime-workshop/parameter-trial-prepared-01/`.
Seed: `20261016`; ten cases × two repeats × two arms = **40 attempts**.
Requested settings: `gpt-6-luna`, thinking `off`, priority tier, 2,048 output tokens,
10,000 ms timeout. Forwarding, actual tier and output-limit enforcement are not
established by preparation; see the [adapter audit](animation-latency-audit-2026-10-16.md).

- Manifest SHA-256: `dda16e0ce41dee290d057f03299e4b2a31110b3d2c8c636704d9d1eef327380e`.
- Configuration SHA-256: `289c71c8f3e287abd7a5cad6c7de547d81fd39df2eea118e7f6391f075891349`.
- Evaluator oracle SHA-256: `a4c77418bc5c2590cf311438c706dec7663c7171ea4f4b1f969771788d243b04`.
- Each attempt's three request files total 9,912–16,934 bytes; all forty total
  457,624 bytes. These are local pretty-printed file sizes, not wire payloads or tokens.

`evaluator-oracle.json` stays evaluator-only: expected sources, values and private
sample times are absent from request files. Never upload the oracle as evidence.
Evaluation retains every scheduled attempt, including missing or invalid output.
It checks request integrity, complete/terminal tool agreement, revision, operation,
parameter interpretation, unchanged controls/duration/camera/render options,
original epoch, native geometry and analytic invariants at seven times. Each arm
is checked independently against expected results, not merely against its pair.
Raw supplied output is retained even when request integrity fails.

Saved receipt envelopes are caller-supplied, not authenticated provider identity.
`localEvaluationMs` includes compilation, I/O and audit work; it is neither model
latency nor retained-operation time. Use these APIs serially because their native
compiler fallback temporarily selects a process-wide Worker setting.

## Connected speech proof

`parameter-speech-integration.test.ts` joins speech evidence, replay scheduling,
evidence selection, deadline calculation, strict submission acceptance, phrase
anchor finalization, real world commit and committed-context journaling across
all ten cases. A nonzero source offset of 885 seconds and scene epoch of one
second catch clock-origin errors. Negative cases cover corrections during
publication, the original phrase deadline, unchanged values and changed evidence.

The transcript, tool output, host clocks and renderer receipt are synthetic.
These tests do not run ASR inference, a model, browser transport, private browser
publication guards, GPU rendering or hardware presentation. They verify connected
transaction behavior and geometry preservation, not semantic interpretation or
audio/visual synchronization quality.

## Verification and remaining acceptance

Focused root verification: **33 tests passed, 0 failed, 1,225 assertions** across
the trial and speech-integration suites. Strict targeted TypeScript checking and
`git diff --check` passed. Independent review found and closed preservation and
receipt-validation false passes before the final run.

The existing side-by-side viewer remains a handwritten native control comparison.
Actual model trials, continuous rendered review, blinded independent quality
verdicts and source-to-visible timing remain unverified. Library research suggests
[named timing cues and explicit asset readiness stages](animation-library-mechanisms-2026-10-16.md)
as later experiments, without migrating renderers or substituting subject templates.

Automatic approval review previously rejected exporting generated JavaScript and
project scene state to OpenAI because the approved single-frame upload did not
clearly cover those payloads. Broader export approval remains pending, as recorded
in the [committed-context checkpoint](committed-context-checkpoint.md). This bundle
was prepared without provider calls or uploads.

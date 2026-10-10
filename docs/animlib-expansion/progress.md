# Expansion ledger — plan: docs/animlib-expansion/plan.md

## Baseline

- Branch `amilibsam`, commit `2b666eb`, initially clean.
- `npm run typecheck --workspace animlib`: pass.
- `npm run build --workspace animlib`: pass.
- `npm run test --workspace animlib -- --reporter=dot`: 37 files, 664 tests pass.
- Default Windows sandbox temporary path caused ENOENT before test execution.
  Set process-local TEMP and TMP to the existing workspace directory
  `C:\Users\samue\Stuff\3yellow3white\data\animlib-expansion\tmp` for verification.
  No production or test configuration changed to address this environment issue.

## Active wave

| Agent | Model / effort | Ownership | Status |
|---|---|---|---|
| molecular_builder | gpt-6-astra / high | molecular-backbone modules, tests, proof | core tests pass, proof in progress |
| math_builder | gpt-6-astra / high | diagrams modules, tests, proofs | core tests pass, integration regressions pending |
| path_engine | gpt-6-astra / high | shared path engine and helper integration | implementing pinned APIs |
| root | orchestrator | design, plan, progress, integration | reference coverage and next asset wave |

## Decisions

- User authorization includes sustained implementation and independent iteration;
  additional routine design approvals would obstruct the requested orchestration.
- Keep shared branch and assign distinct owned files; serialize commits at root.
- Investigators record supported observations and limits rather than invent fidelity.
- User clarified channel identity: Visually Explained (linked channel) only.
- Planning baseline committed locally as `6415bfa`; .git required sandbox
  escalation, which automatic approval accepted. No remote operation performed.
- Initial CPU geometry benchmark (30 frames, GPU calls mocked): linear algebra
  median/p95 1.49/3.53 ms; organic chemistry 0.20/0.76 ms; sorting 0.12/0.53 ms;
  interactive views 0.26/0.41 ms. These are diagnostic host measurements only.

## Preflight boundaries

| Pair / task | Shared interface | Resolution |
|---|---|---|
| Reference workers | evidence/report schema only | Separate files and browser tabs. |
| Asset / domain workers | native geometry and scene input | Pin interfaces in follow-up briefs before code. |
| Domain / export workers | absolute-time scene evaluation | Export must use production retained evaluation. |
| Implementation / evaluator | original source, renders, reference evidence | Separate author and visual reviewer. |

Infrastructure export repair is complete and independently reviewed. Domain
helpers remain pending integrated rendering and independent acceptance. Broad
reference coverage and artist fidelity remain open; no whole-library parity claim.

## Native GPU baseline

`npm run test:gpu --workspace animlib` before implementation: 143 pass, 4 fail.

- Two recovery cases force Vulkan and fail because Vulkan adapter is unavailable.
- Material/texture retained-versus-rebuilt pixel equality fails at control 0.1,
  time 1.5 in `gpu.smoke.ts:376`.
- Identical translucent arrow3D morph pixel equality fails at opacity 0.45,
  time 1.000001 in `gpu.smoke.ts:715`.
- Default native adapter works; external-sandbox adapter probe also succeeds.
  These are baseline findings, not introduced by expansion. Assign focused GPU
  diagnosis before final integrated acceptance.

## First research handoff

- math_algorithm_reference completed initial report. Dense local Euler samples,
  targeted creator screenshots/playback, explicit sparse-coverage limits. Broader
  creator motion coverage remains outstanding.
- infrastructure started: `infrastructure-brief.md`. Sampling API agreed:
  `withOfflineScene(source, input, use, limits?)`, sampler has `scene` and
  `sample(time = scene.duration): Frame`; scope includes asset architecture audit.

## Implementation and review handoff

- `85be910`: initial reference reports and implementation boundaries committed.
- `be2755a`: native exporters now evaluate retained absolute-time motion through
  scoped `withOfflineScene`; six regressions, total 670 tests passed at that
  snapshot, typecheck/build passed. Native three-frame and 24-frame video proof.
- Independent infrastructure reviewer: spec ready, code quality ready, no
  blocking findings; viewed both native sheets and all 24 decoded MP4 frames.
  Asset proposal needs explicit image storage and shared geometry resolver
  contracts before implementation. See `infrastructure-review.md`.
- Molecular source report completed. Sticks, sequence-colored beads, folded
  sticks and smooth surface are observed in Protein Folding; ribbons are inferred
  extension only. Transcription and Nucleus remain separate cinematic styles.
- Math/graph/collection host helpers and molecular ordered-backbone/kinematic
  helpers now exist in disjoint modules. Production API and moving connector
  midpoint regressions intentionally await path_engine integration.
- Root extended transcription evidence with complete, decoded readyState=4
  frames at 2 fps from 94.033 seconds onward. Initial seek-slider captures with
  clipped frames were excluded; player-container frame stepping fixes framing.
- Follow-up completed sampled transcription chronology: 329 valid complete frames
  at nominal 2 fps across 0–163.533 s; all contact sheets viewed, final unready
  sample excluded. Whole-sequence requirements in `transcription-motion-supplement.md`.
- Public domain scene APIs installed by path_engine; root build and molecular
  `--integrated` generation passed. Re-rendered 28 molecular frames and 240-frame
  MP4 through public methods. Three math proofs rendered at both aspect ratios,
  plus native 30 fps MP4s (shear195, graph210, collection120 frames).
  Initial root QA found literal `quad` in graph label; independent domain review
  also identified numerical/immutability/orientation issues. Acceptance pending.
- All commits remain local on `amilibsam`; no push or merge.

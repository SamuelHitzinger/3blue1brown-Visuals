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
| molecular_reference | gpt-6-astra / high | molecular-reference.md | inspecting supplied videos |
| math_algorithm_reference | gpt-6-astra / high | math-algorithm-reference.md | inspecting 3Blue1Brown / Reducible |
| neuroscience_quantum_reference | gpt-6-astra / high | neuroscience-quantum-reference.md | inspecting Artem / linked channel |
| root | orchestrator | design, plan, progress, integration | baseline and architecture audit |

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

No implementation task is complete yet.

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

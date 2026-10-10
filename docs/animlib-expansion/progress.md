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
- Optional channel-identity clarification sent; supplied URL remains primary evidence.

## Preflight boundaries

| Pair / task | Shared interface | Resolution |
|---|---|---|
| Reference workers | evidence/report schema only | Separate files and browser tabs. |
| Asset / domain workers | native geometry and scene input | Pin interfaces in follow-up briefs before code. |
| Domain / export workers | absolute-time scene evaluation | Export must use production retained evaluation. |
| Implementation / evaluator | original source, renders, reference evidence | Separate author and visual reviewer. |

No implementation task is complete yet.

# Blinded visual reviewer detection experiment

Status: implementation and pure checks only. No native rendering or model calls have been run by this worker. Freeze the manifest after the pending production sampler changes and before the first experiment call; retain failures and disagreements.

`backend/bench/review-detection.ts` separates real visual judgment from the scripted gate and sampling benchmark. It uses the production native renderer and `PiAgentRunner`. The experiment has two predeclared matched pairs and eight independent conversations:

| Pair | Clean control | Seeded defect | Purpose |
| --- | --- | --- | --- |
| Visibility | Two labeled disks remain visible and separate during a small excursion | Yellow B and its label leave the viewport during 6.23–6.31 seconds, then return | A short interval that the inherited sampler can miss |
| Count | Two disks with `Total = 2` | The same disks with `Total = 3` | An obvious persistent error, independent of short-transition coverage |

Each scene receives both evidence strategies: frozen 12-sample algorithm from checkpoint `6d9798e`, with contact sheets only; current risk-prioritized sampling, with contact sheets plus selected native frames. The same renderer produces both viewport sizes. This compares the combined evidence strategy, not the isolated effect of resolution or timestamps.

Reviewer input contains only visual intent, duration, images and their timestamp map. It excludes scene source, fixture/condition names, truth labels, arm names, seed intervals and sampling risk reasons. Each call has a fresh conversation, identical model/configuration and identical assessment instructions. Fixed ordering is saved before any result and reverses arm ordering in the second pair. No output validation feedback, repair, protocol retry, or provider retry is permitted; malformed answers and provider failures remain failed cells. A three-minute deadline bounds each model call.

Run from repository root, after other timed generation work finishes:

```powershell
node_modules/.bin/bun.cmd --env-file=backend/.env.local backend/bench/review-detection.ts freeze data/animation-efficiency/review-detection/trial1
node_modules/.bin/bun.cmd --env-file=backend/.env.local backend/bench/review-detection.ts run data/animation-efficiency/review-detection/trial1
```

`freeze` compiles the four scenes and saves sources, exact sampling plans, truth, fixed order, model/settings and hashes of relevant benchmark/runtime/renderer code. It does not render or call a model. Existing directories cannot be replaced. `run` refuses changed code, sources, settings or an existing `run-started.json`; interrupted or failed experiments cannot silently resume or overwrite earlier outcomes. Use a clearly new trial directory for a deliberate repeat and report both trials.

Every cell retains native evidence, exact model input, selected-image and native-frame hashes, completed raw output (including malformed answers), parsed findings, model metrics, elapsed time and errors. The production runner does not expose incomplete streamed text after a provider failure; those cells retain its failure and usage metrics, not a fabricated answer. The summary reports raw clean-control rejection and seeded-scene rejection counts, never labels any rejection as confirmed seed detection. Human adjudication must check each finding, its timestamp and the corresponding saved native frame. A seeded-scene rejection for an unrelated complaint is not successful detection. A clean-control rejection is a potential false positive until pixels and invariant are checked. Record baseline/candidate disagreements even if they contradict expectations.

Pure validation before the production sampler refinement: strict TypeScript check of this benchmark passed; all four sources compiled. Both visibility variants produced identical timing plans, with inherited sampling missing the 6.23–6.31 second interval and current sampling including 6.25 and 6.29 seconds. Count variants produced identical plans. These are sampling facts, not renderer or model results; the saved execution manifest will reflect the final sampler.

This is an eight-response smoke experiment. Fixtures deliberately probe a known sampling weakness and an obvious count mismatch; they do not estimate general accuracy, establish scientific-scene correctness, or certify motion, interaction, acoustic synchronization, or full production prompt quality. Baseline approval can be evidence-consistent when its frames never show the brief defect. No fixture may be changed or dropped after observing model responses merely to improve reported scores.

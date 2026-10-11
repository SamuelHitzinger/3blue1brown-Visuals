# Dimensional prompt evaluation

Each case starts from a fresh request and UUID, enters the production
`createPiGenerator`/`PiAgentRunner` flow, and completes all planned scenes. No saved
lesson, narration fixture, or hand-authored scene is seeded. Stages include draft,
editorial review/repair, supported subtitle reading-time generation, scene authoring,
compiler validation and analytical inspection, native WebGPU frame review, and the
normal bounded visual repair. Generated scene source is never edited by the harness.

The production subtitle mode deliberately avoids paid speech. Optional Chromium
author preview is disabled identically in every run; native WebGPU final review is
enabled. This is the complete content-generation pipeline, excluding the library's
HTTP/storage wrapper and separate decorative thumbnail task.

Run from the repository's `backend` directory so Bun loads its existing `.env.local`:

```powershell
..\node_modules\.bin\bun.cmd ..\research\dimensional-prompt-eval\run.ts --strategy baseline --case sine
..\node_modules\.bin\bun.cmd ..\research\dimensional-prompt-eval\run.ts --strategy routing --case saddle
```

Use `--dry-run` to validate settings and snapshots without calling the model.
Cases are `sine`, `saddle`, and `enzyme`. `--strategy-dir ABSOLUTE_PATH` overrides
the default `research/dimensional-prompt-eval/STRATEGY` location. Replacement files
use the original prompt filename directly in that folder, or in its `prompts/`
subfolder. The optional `planning-contract.txt` replaces exported
`PLANNING_CONTRACT`. Missing replacements retain the frozen baseline.

`baseline/` captures the dirty working-tree prompts present when this experiment
began, plus the exact planning contract and shared capability/API guides. Strategies
replace exact original prompt fragments in a single pass at the runner boundary.
Production prompt files stay unchanged. Each job checks the live assembly file
hashes before every call and on completion. Changing runtime prompts during a job
fails the experiment rather than silently mixing conditions.

Per-task `effective.json`, `.system.txt`, `.user.txt`, and `.completion.txt` files
are the authoritative prompt evidence. The generator's own `*.prompt.md` and
`*.instructions.json` files were written before the isolated replacement and reflect
the original assembly. Effective metadata records every matched fragment and hashes
the system, user, runtime completion, and image inputs. The wrapper leaves tool
definitions, compiler contracts, output validators, rendering, and retry policy intact.

Every strategy uses `gpt-6-astra` at high reasoning, validated-reference scene output,
host timing, and a 35-minute timeout. The request asks for one 35–45-second scene;
the harness completes up to three scenes if the planner does not honor that request
and records the violation. Run at most two jobs concurrently. Normal success needs
four model tasks; production editorial/visual repair and provider retries can add
more. A previous full 20-second peptide example took approximately 8.5 minutes;
this is a planning reference, not a prediction for these cases.

Small `STRATEGY-CASE.result.json` summaries remain beside this file. New raw runs,
effective prompts, source, inspection artifacts, rendered PNGs and complete metrics
go to ignored `data/dimensional-prompt-eval/runs/`. Each run also stores its immutable
result, avoiding loss when another repetition updates the convenient summary.

`matrix.ts` schedules the fixed nine-case comparison with at most two concurrent
jobs and stops scheduling on infrastructure/authentication failures. This host needs
normal access to the Pi credential-store lock outside the checkout; restricted
sandbox attempts fail before a provider stream. The two original zero-token
authentication failures remain in their raw UUID directories. The approved run uses
the existing credential; it does not log in, log out, copy or print secrets.

Stage metrics include elapsed time, provider calls, input/output/reasoning/cache
tokens, validation attempts, analytical/preview calls, and asset publication effort.
These are measured usage totals, not dollar cost. Subscription availability is
checked locally with `npm run agents:status`; only an actual model call verifies
remote inference. The baseline snapshot pins provider and common model settings.

The harness typechecks independently, and `prompt-substitution.test.ts` verifies
single-pass substitution, exact escaping, unchanged host text, and ambiguity rejection.
Final acceptance must also inspect actual rendered frames, spatial mechanisms,
interactive controls, representation choice, and failed trials. A passed visual gate
alone does not establish scientific or teaching quality.

Formal comparison runs from the isolated `codex/dimensional-prompt-eval` worktree.
`formal-experiment.json` identifies the branch/revision, exact test-case file and
frozen runtime snapshot. All nine formal trials use fresh UUIDs. The three earlier
shared-checkout trials and their reports are archived in `history/original-checkout`
and excluded from the formal comparison: another checkout task rebuilt runtime files
during that preliminary batch. Native QuickJS execution-limit failures are retained
as generated-source delivery failures; the queue continues without bypassing the gate.
Other renderer, authentication, quota, or provenance failures stop scheduling.

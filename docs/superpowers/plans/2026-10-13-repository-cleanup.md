# Repository cleanup plan and audit

Goal: reduce stale branch references and build-context clutter without changing the main pipeline.

Scope: user requested careful cleanup, then explicitly required all previous videos, useful logs, and documentation to remain. No runtime code, prompts, dependencies, demo assets, deployment scripts, saved lessons, credentials, or evidence will be deleted.

## Tasks

- [x] Fetch both remotes and inspect branch ancestry, worktree attachments, running apps, Docker inputs, and evidence references.
- [x] Baseline: `npm run build` passes at `2618a0b6e6df8f104200015f77a4f9adbc6baaa3`.
- [x] Add Git ignores for future local logs, TypeScript build caches, and delivery exports; existing tracked evidence remains tracked.
- [x] Exclude repository-only evidence and scratch directories from Docker context. Preserve every Docker COPY input, including nested animlib documentation and scientific fixtures.
- [x] Delete only inactive branch references whose exact tips are ancestors of fetched `visuals/main`; retain the recovery map below.
- [x] Verify unchanged protected files, ignored-path behavior, Docker build and pipeline smoke, and final branch state.

## Branch recovery map

Every removed tip is reachable from main at `2618a0b6e6df8f104200015f77a4f9adbc6baaa3`. Restore a local name with `git branch NAME SHA`. No Git history rewrite or object pruning.

| Local branch | Tip |
| --- | --- |
| codex/amilibsam-before-main-20261010 | 68d646313efaf004468ff8591f33d2320a310816 |
| codex/amilibsam-before-main-20261011-97cfef6 | 97cfef612233c882561d768993758ed6622e3ca1 |
| codex/dimensional-prompt-eval-main | d83051217a7c885f2b2f77b47103177ca35b2b9c |
| codex/molecular-representation-choice | cb6de1219ab7eb2b94ef029180a4111e2908e88c |
| codex/visual-quality-recovery | 4dc208fea5a8778afa1c1e9d8411c43d00fe3334 |

Removed remote branch: `visuals/codex/visual-quality-recovery`, same tip as the local name above. GitHub returned no open PRs; remote tip was checked immediately before deletion with an exact SHA lease. Remote now has only `main`.

## Deliberately retained

- All previous videos, rendered frames, research, logs, comparison evidence, and documentation, including `.tmp` reproduction helpers referenced by validation reports.
- Every attached worktree, even if merged: some contain unique experiments or serve running apps.
- Branches with unique commits, local `main`, current integration branch, and `amilibsam`.
- All branches in original `justmycode37/3yellow3white` repository. Cleanup of remote branches is scoped to current `SamuelHitzinger/3blue1brown-Visuals` destination.
- `frontend/site`: checked-in build supports the documented direct-start workflow.
- Deployment rollback and old-format compatibility code; these remain functional dependencies.

## Validation results

- `npm run build`: passed before and after cleanup.
- `npm run test --workspace @aha/backend`: 341 passed, 0 failed.
- Docker build `aha-repository-cleanup:20261013`: passed. All application build/runtime layers were cache hits, confirming unchanged Docker inputs; context transfer was 66.99 MB.
- Offline Docker `scripts/smoke-release.ts`: passed, including molecular preparation, asset publication, cache, delivery, scene compilation, and release checks.
- Offline Docker `scripts/smoke-scene-preview.ts`: passed (cold batch 1684 ms, warm crop 402 ms).
- `git diff --exit-code HEAD -- backend frontend shared scenegen scripts research docs/demos docs/validation docs/animlib-expansion`: clean. No tracked file deletions.
- Existing exports and `.tmp/native-label-{before,after}.mjs` reproduction helpers remain present.
- `git check-ignore --no-index`: future scratch logs, TypeScript build caches, and root exports are ignored. Tracked evidence remains tracked.
- Existing local website `/healthz` on port 8081 remains healthy at revision `2618a0b6e6df8f104200015f77a4f9adbc6baaa3`.
- Independent read-only review found no actionable issues; all deleted branch tips were verified ancestors of main.

Logs from this cleanup remain in `data/repository-cleanup/`. No previous videos, logs, documentation, scripts, caches, or worktrees were removed. Only branch references were deleted. Cleanup was initially saved locally on `codex/repository-cleanup`; the user subsequently authorized applying it to main.

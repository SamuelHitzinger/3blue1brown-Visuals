# Combined integration handoff

Target: SamuelHitzinger/3blue1brown-Visuals main. Coordinated with **Add video creation progress estimate** (01a12a2f-e8af-7811-96a3-ba3af6a85763).

Included changes:
- 8522aad: orchestrator chooses molecular detail by teaching purpose; accurate source landmarks; actual-pipeline comparisons and preserved user preferences.
- bf1c6eb: viewport-safe attached labels, correct screen bounds, reduced imported-model playback overhead; comparison evidence in ../molecular-representation-choice/playback-validation.md.
- 167be47: cherry-pick of other chat's e7fad28; audio recovery, insertion refresh, retry preservation, layout and release smoke coverage. Newer prompts/landmarks and deployment opt-in remain intact.
- Final reconciliation updates the worker inspection regression: large offsets on in-view anchors fit; genuinely offscreen anchors still warn. Rebuilt frontend/site includes both branches' production changes.

Combined validation: 1,131 runtime tests; 341 backend tests; 89 frontend tests; six insertion integration tests; runtime/backend TypeScript checks; runtime, preview, frontend and demo builds. Linux Docker release-configuration suites pass 28 tests. Running these Linux path/permission tests directly under Windows is unsupported and failed before rerunning successfully in Linux. Renderer native GPU checks passed 17 tests; independent renderer review passed 88 focused tests with no findings. Other chat's release integration review is recorded in verification.json.

Before main push, run package-release.sh from a clean git archive of the final combined commit. This verifies the actual container, native frames, Chromium preview, HTTP/assets/jobs/audio, nonroot read-only runtime, stop/start, crash recovery, recreation and persistent storage. It uses simulated providers and does not regenerate paid lessons or deploy production.

Safe continuation: start from target main after integration; do not copy the old release worktree over newer prompts or apply landmarks twice. Existing generated scene sources and scientific model hashes remain unchanged. Original release worktree and local QA data remain preserved.

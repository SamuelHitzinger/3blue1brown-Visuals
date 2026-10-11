# Dimensional prompt experiment status

All preserved attempts, including failures and runs outside the selected matrix, are included. Running effort includes completed task metrics only; current task usage arrives when its task finishes. Reported reasoning is a subset of output tokens; null means unavailable, never zero by assumption. Counts are diagnostics from saved endpoint frames, not visual proof; failed scenes may have no final frame. One scene per case does not exercise inter-scene handoff. Subtitle timing does not exercise TTS or acoustic sync.

| Variant / case | Matrix | Status / stage | View | Run seconds | Tasks | Output tokens | Endpoint elements / vertices |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: |
| baseline / enzyme (62deb2d7) | other attempt | failed / draft |  | 0.1 | 1 | — | — |
| baseline / sine (e2bab7f8) | other attempt | failed / draft |  | 0.1 | 1 | — | — |
| baseline / enzyme (aac65662) | selected | running / draft |  | — | 0 | — | — |
| baseline / sine (fbd51d9a) | selected | running / draft |  | — | 0 | — | — |

- baseline/enzyme 62deb2d7-3e26-406a-a7ca-45ebe8c19796: AUTH — Agent authentication failed. Stop the backend, run agents:logout then agents:login, or check the API key if using API-key mode.

- baseline/sine e2bab7f8-caaf-41f3-8053-cc59f91daccd: AUTH — Agent authentication failed. Stop the backend, run agents:logout then agents:login, or check the API key if using API-key mode.

Stage effort, exact view rationale, source locations and diagnostic count caveats are recorded in `summary.json`.

# Local interactive video plugin implementation plan

**Goal:** Prompt-driven local video creation in chat, using the complete existing production pipeline and interactive player.

**Architecture:** A desktop skill calls a small Node CLI. The CLI launches the original Bun backend entry point, submits the original HTTP request contract and reports durable job state. Version 0.2 bundles the original LessonPlayer, renderer, compiler worker and WASM directly in an MCP UI. Scoped tools carry playback data and original follow-up requests; authoritative manifest polling adapts SSE to MCP. A standalone package contains byte-identical backend, prompts, full animation library, fixtures and frontend source. Generation and playback logic stay unchanged. The host controls presentation and runtime permissions.

**Tech stack:** Node 22.19+, repository-pinned Bun, existing npm locks, existing Chromium renderer, local plugin manifest and skill.

## Constraints

- Preserve production generation, narration, inspection, rendered review/repair, interaction, and persistence behavior.
- Default to `backend/src/index.ts`; preserve the optional scenegen wrapper in the package without enabling it.
- Keep credentials outside distributable artifacts. Reuse an explicitly configured existing environment file and its authentication mode; do not copy credentials or change providers.
- Bind the plugin service to loopback. Keep plugin jobs separate from the website database and persistent across restarts/upgrades.
- Keep source files unchanged. Generate a hash inventory for packaged sources/assets and verify it.
- Do not silently disable previews, replace narration with subtitles, or switch to simulated generation when setup fails.

## Work

- [x] Add tests for request/file fidelity, idempotency, local-only URLs, job progress, package inclusion/exclusion and tamper detection.
- [x] Implement the chat CLI: configure, setup, doctor, start, create, status, list, stop and verify. Preserve complete prompts and original uploaded bytes.
- [x] Package the original runtime and full animlib, with a desktop skill, installation metadata, and setup documentation.
- [x] Add local MCP tool/resource for inline interactive delivery; replace blocked loopback frame with direct UI bundle in version 0.2.
- [x] Exercise real backend HTTP generation in an explicitly isolated simulated smoke test, including persistence and player assets. Check interactive playback in a browser.
- [x] Verify exact source parity, build/type checks, review changes, and install/register the local plugin if supported.

## Verification recorded 2026-10-14

- Eight transport, package, lifecycle and MCP protocol tests passed.
- Original library TypeScript build, backend preview build, production frontend build and native renderer smoke passed.
- Repository and installed-package browser smoke passed: original uploads, idempotent retries, SSE, audio transport, restart persistence, authored sliders, seeking, captions, playback and right-click follow-up scene insertion.
- MCP App nested player passed in a secure loopback test host, including ping and playback teardown. An insecure about:blank test host could not load the nested player; the test now uses a real secure-context loopback origin.
- Installed package integrity passed: 1,750 original source files (all 1,544 tracked animlib files included) and 33 built player assets. No existing pipeline source files changed.
- Installed `aha-video@aha-local` version `0.1.0`; configured existing environment file by reference. Production backend started on loopback with simulated mode disabled. Model and narration configuration checks passed; no paid model/TTS generation was submitted.
- Skill frontmatter validated with the installed Node YAML parser. The Python quick validator could not run because its runtime lacks PyYAML.
- Remaining host verification: this already-open chat has not loaded the new MCP tools. Reload plugin/app, then call `show_video` to confirm actual desktop inline presentation and loopback-frame policy. Test-host success does not establish that presentation policy.

## Review focus

1. Installation from a copied package must work without the original checkout.
2. Retried submissions must not create duplicate paid jobs.
3. Unrelated services or stale process IDs must not be stopped.
4. Packaging must include all tracked animation assets but exclude private configuration and job data.
5. Playback must retain actual controls, audio, captions, model assets, progressive scenes and follow-up requests.

## Host failure and repair, 2026-10-14

User confirmed version 0.1 shows “This content is blocked.” Local player responds HTTP 200 with no X-Frame-Options or CSP header; the actual host rejects the nested local frame. Earlier loopback test-host success did not establish host compatibility. Browser automation separately refused nested-frame inspection under its URL policy; no bypass was attempted.

Version 0.2 removes nested frames and browser network requests. Original LessonPlayer and animlib are bundled with fonts and QuickJS WASM. Browser fetch/EventSource calls are adapted to scoped app-only MCP reads and an explicit write tool for follow-up scenes. Worker/WASM bytes remain local. Website navigation becomes a small lesson menu; the interactive player implementation is reused directly.

- Eleven regression tests passed, including exact binary chunk reassembly, bounded binary caching, follow-up context/idempotency fidelity, route rejection and generated chat UI tamper detection.
- Direct UI smoke passed with actual stdio MCP tools, `connect-src 'none'` and `frame-src 'none'`: authored controls, captions, playback advancement, follow-up generation and lifecycle teardown. This test explicitly permits Blob workers and WASM compilation.
- Both original source inventory (1,750 files, including all 1,544 animlib files) and adapter/UI inventory verified.
- Installed `aha-video@aha-local` version 0.2.0. Saved jobs and existing environment-file configuration retained; production backend restarted from upgraded runtime.
- Actual desktop playback remains pending reload: current chat's `check_setup` still executes the old 0.1.0 MCP process. Next test must confirm host Blob worker/WASM/GPU permissions; do not claim actual host playback success from the test host.

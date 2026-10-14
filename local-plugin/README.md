# Aha Video local plugin

This desktop plugin turns a chat prompt and source files into the original interactive Aha videos. It wraps `backend/src/index.ts` and the existing HTTP API. Generation, prompts, agents, ElevenLabs timing and rendered verification/repair are unchanged. A local MCP App bundles the original `LessonPlayer` and animation library directly into the conversation. Browser tabs are an optional fallback.

The package includes the entire tracked `shared/animlib` tree (source, documentation, fixtures, demos, tools and tests), shared video contracts, backend source/prompts, frontend source and a fresh production player build. It also retains `scenegen` as an optional source tool, without enabling its additional rules. No credential files, existing jobs, database, or `node_modules` are distributed.

## Build and install

From the repository, with its existing npm dependencies installed:

```powershell
node local-plugin/scripts/package.mjs
codex plugin marketplace add ./dist/aha-video-local
codex plugin add aha-video@aha-local
```

Packaging refuses to overwrite an existing destination. For an updated package, pass a fresh directory as the positional argument and update the local marketplace source. The generated marketplace can be moved as a whole: all plugin paths inside it are relative.

The CLI prints the installed plugin directory. In the commands below, replace `<plugin>` with that directory (or use `dist/aha-video-local/plugins/aha-video` to run the standalone package directly):

```powershell
node <plugin>/scripts/aha.mjs configure --env-file C:/absolute/path/to/backend/.env.local
node <plugin>/scripts/aha.mjs setup
node <plugin>/scripts/aha.mjs verify
node <plugin>/scripts/aha.mjs doctor
node <plugin>/scripts/aha.mjs start
```

Reload the app/plugin list after setup if the new skill or MCP tools do not appear in an already-open chat. Ask “Use Aha Video to explain …” and attach source material. The skill submits a job, monitors it, and calls `show_video` to attach the original interactive player to chat. No website form is needed. Fullscreen, authored controls, captions and right-click follow-up questions use the original player components.

Version 0.2 removes the localhost iframe, which the actual desktop host blocked in 0.1. The MCP resource has no nested frames or network allowlist. Original player, renderer, worker, QuickJS WASM and fonts are bundled into the UI. Narrowly scoped MCP tools carry saved manifests, audio/model bytes and original follow-up requests. The transport adapter polls authoritative manifests every 1.5 seconds instead of opening browser SSE connections; generation and playback logic are unchanged. The website navigation is replaced with a small lesson menu.

The MCP resource declares inline and fullscreen modes. The host controls presentation, worker/WASM/GPU support and tool permissions. Follow-up scene creation remains a write operation and may require host approval. No public tunnel or hosted site is needed. Installing the plugin does not guarantee every ChatGPT surface supports its runtime; actual host playback must still be verified after reloading an upgraded plugin.

## Runtime requirements and configuration

- Node 22.19+ with npm; setup installs the exact locked dependencies including Bun 1.4.2.
- Local Chromium, Chrome, or Edge for the existing scene preview renderer. Native WebGPU must also work for the existing visual verification renderer. Optional `configure --chromium <absolute-path>` selects the browser executable.
- Existing Aha/Pi authentication and the existing ElevenLabs configuration for narrated videos. Subscription/API authentication mode and model settings come from the selected environment file. No credentials are copied into the package. Login instructions are bundled at `runtime/docs/agents.md`.
- Plugin transport binds to `127.0.0.1:47831`; `configure --port` selects another unused port while stopped.

Configuration and jobs live in `~/.aha/video-plugin`, separate from the website's data. `AHA_VIDEO_HOME` overrides this directory. The configured environment file must remain available. Model/voice settings are preserved; only host, local origin, frontend location and job/cache paths are adapted. `doctor` checks configuration only, without consuming model/TTS usage. `start` refuses incomplete visual setup and simulated mode. Explicit subtitle requests can run without ElevenLabs; narrated requests fail before submission when speech configuration is missing.

The backend remains running after a chat command exits, so playback and generation continue. `stop` stops the verified local process without deleting jobs. On Windows, OS process termination can interrupt an active stage; existing backend checkpoints provide restart recovery. Keep the service running while viewing or generating.

## Request format and commands

Run `node <plugin>/scripts/aha.mjs help` for commands. `create --request <file.json>` accepts:

```json
{
  "idempotencyKey": "one-stable-UUID-per-request",
  "request": { "title": "Lesson", "topic": "Complete prompt", "documents": [] },
  "files": []
}
```

File paths may be absolute or relative to the request file. Retrying with the same key and payload returns the same job. `status --id <id> --wait 30` waits at most 30 seconds and returns a compact progress snapshot. `list` returns saved jobs and player URLs. Neither response dumps source documents or scene code into chat.

## Verification

```powershell
node local-plugin/scripts/build-ui.mjs
node --test local-plugin/tests/*.test.mjs
node local-plugin/tests/smoke.mjs
```

The smoke script uses a fresh temporary state directory and the backend's explicit simulated test mode. It does not call model or speech providers. This verifies transport, files, idempotency, persistence, audio and player delivery; it is not evidence of a new paid generation. Browser checks and native renderer checks are separate.

Add `--browser` to verify controls, seeking, captions, playback and follow-up scene insertion in both the original website and the direct MCP UI. The latter uses actual stdio MCP tool calls with browser network and nested frames disabled. The test host explicitly permits Blob workers and WebAssembly; actual desktop host permissions still require separate verification. MCP tests validate tool discovery, app-only transport tools and empty network/frame CSP lists. The local MCP server uses the SDK and Zod already pinned by the runtime lockfile; it adds no pipeline dependency changes.

Runtime `source-integrity.json` records the repository revision and SHA-256 of every copied source/asset and generated website player asset. A second inventory at the plugin root covers the adapter and generated chat UI bundle. `verify` checks both, including missing or changed chat UI. Model generation remains nondeterministic; unchanged code does not mean a fresh prompt produces byte-identical videos.

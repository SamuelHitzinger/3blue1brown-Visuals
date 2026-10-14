---
name: aha-video
description: Create, monitor, and open local interactive explanatory videos with the original Aha / 3yellow3white pipeline. Use for Aha video requests, source-material-to-video requests using this plugin, or continuing its saved videos. Requires local desktop execution.
---

# Aha interactive videos

Run the packaged engine. The full backend, animation library, prompts, fixtures, and interactive player are included in `../../runtime/` in installed packages. In the development checkout the original repository is the runtime.

The CLI is `../../scripts/aha.mjs` relative to this skill directory. Resolve that path to an absolute path and invoke it with Node. Commands emit JSON. Use the local shell/execution tool available in the chat.

## Setup and configuration

1. Run `node <cli> doctor`. Read its checks; it makes no model or speech calls.
2. If runtime dependencies or builds are missing, run `node <cli> setup`. This uses the bundled npm lock and builds the original library and preview renderer. An existing Node installation (22.19+ with npm) is required. Chromium, Chrome, or Edge must be installed locally.
3. If configuration is missing, reuse the user's existing Aha backend environment file with `node <cli> configure --env-file <absolute-path>`. The file is referenced in place, never included in the plugin. Credentials must not be pasted into chat, command arguments, or generated request files. Use the original backend's login flow if it has no saved login; see `../../runtime/docs/agents.md` in installed packages.
4. Run `node <cli> start`. This launches the unchanged production entry point on loopback. State defaults to `~/.aha/video-plugin`; `AHA_VIDEO_HOME` can select another persistent directory. `configure --port <port>` changes the port while stopped. Do not switch state directories casually: that selects a different library.

The plugin preserves configured model, provider, voice, scene timing, and review policies. Version 0.2 bundles the original player directly into the MCP UI, with MCP tools carrying playback data and follow-up requests; it does not embed localhost. Do not replace Pi with the conversation model, disable scene previews/reviews, switch to simulated generation, or silently use subtitles to work around a failure. `doctor` reports configuration, not verified provider availability.

## Create

Write a UTF-8 JSON request file in a private task/workspace location using normal file tools:

```json
{
  "idempotencyKey": "a-new-UUID-for-this-request",
  "request": {
    "title": "A concise lesson title",
    "topic": "The user's complete prompt, constraints, and preferences",
    "documents": [{ "name": "notes", "text": "Complete supplied source text" }]
  },
  "files": ["/absolute/path/to/original-material.pdf"]
}
```

Pass original supported files (PDF, DOCX, TXT, Markdown, PNG, JPEG, WebP). Preserve complete supplied material; do not substitute a summary. Do not invent unreadable source content. Put audience, language, duration, scene count and teaching preferences in `topic`. Leave `documents` or `files` empty when unused. Add `narrationMode: "subtitles"` inside `request` only when the user requests silent/subtitle-only output.

Call `node <cli> create --request <absolute-json-path>`. Retain the SAME request file and idempotency key after a timeout or interrupted response so retrying retrieves the existing job. Use a new key for a genuinely new or changed request. Do not regenerate scene code or narration outside the engine.

## Follow progress and deliver

- Use `node <cli> status --id <id> --wait 30` for bounded polling. Preserve the job ID across turns; `list` finds saved videos. Report meaningful progress and errors, not repetitive unchanged polls.
- Call this plugin's `show_video` MCP tool with the returned video ID as soon as scenes are playable. It attaches the original interactive player directly to chat, with audio, captions, seeking, controls, 3D navigation when authored, and right-click follow-up scenes. Prefer this embedded result; do not open a browser tab automatically or substitute a screenshot/MP4. The host controls inline versus expanded presentation. If the tool is unavailable after installation, reload the plugin/chat; disclose that limitation rather than claiming an inline player appeared.
- Keep following generation until complete or a concrete external blocker. A returned job ID means queued, not finished. Existing playable scenes may remain available after a failure; report that accurately.
- Deliver the embedded player through `show_video`; offer its local URL only as fallback when embedding fails or the user asks. The player works while the plugin service is running on this computer. Saved jobs survive restart; `start` resumes the service. Do not stop it after delivery unless the user asks.
- `node <cli> stop` stops only the verified plugin service. It preserves saved videos and credentials. Do not delete job state as a repair step.

Use `node <cli> verify` to check packaged source/asset integrity. It checks the included SHA-256 inventory; it does not prove new model generations are identical or validate provider credentials.

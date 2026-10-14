# ChatGPT Live lecture bridge implementation plan

**Goal:** Feed speech material from ChatGPT Live and the same phone camera photos into the existing lecture notes and visualization pipeline.

**Design:** A local MCP plugin connects to a single explicitly selected lecture through an eight-hour revocable capability. It returns recent uploaded photographs as MCP image content and appends labelled speech material idempotently. Existing capture extraction, synthesis, source attribution and visual review remain authoritative. This is a plugin-mediated workflow, not a raw transcript subscription or video stream.

**Platform constraints verified 2026-10-14:** ChatGPT Live supports plugins and still images, not camera video. A local plugin is desktop-only unless connected through a supported remote route. Secure MCP Tunnel supports private stdio servers but requires account setup and a runtime API key. iPhone background ChatGPT voice plus foreground Safari camera requires physical-device testing; desktop voice plus phone camera is the initial independent-device fallback.

**Execution:** Inline on existing codex/lecture-visual-catalog branch. No changes to the unrelated local-plugin directory. No public tunnel, installation or account authorization until the concrete package is ready.

## Work

- [x] Test and implement scoped bridge grants, idempotent speech submissions, bounded recent camera frame retention, expiry/revocation/deletion, and owner-route isolation.
- [x] Wire accepted camera photos to bridge cache; expose bridge only through desktop backend, never through phone gateway.
- [x] Add connection controls and camera-only ChatGPT mode to existing website.
- [x] Build separate MCP plugin, setup CLI, manifest, instructions and private-tunnel runbook; test protocol and image output.
- [x] Run affected backend/frontend tests and typechecks; inspect UI and package. Verify synthetic end-to-end flow without sending invented lecture material into user's real lecture.
- [ ] Complete account-side private tunnel and ChatGPT installation, then verify real Live speech/tool calls and physical iPhone camera coexistence.

## Acceptance and review focus

- A grant can read only its lecture and recent photos captured after opt-in; rotation/revocation removes access and retained frames.
- No remote host, arbitrary URL fetch, file read, lecture deletion or broad owner API in MCP tools.
- Duplicate submissions do not append twice; conflicting reuse is rejected. Speech notes are never labelled lossless transcription.
- Retain at most eight photos per lecture, at most 32 globally, for at most fifteen minutes; expired connections cannot retain new frames.
- Phone camera-only mode never requests microphone. It keeps current zoom/crop behavior and visible foreground requirement.
- Plugin output contains actual image blocks with timestamps, not merely photo descriptions. On-demand pulls and unverified host cadence are clearly disclosed.
- Installation/account linking and iPhone microphone/camera coexistence are separate acceptance gates; code tests do not prove host support.

Sources: https://help.openai.com/en/articles/20001274-chatgpt-voice ; https://developers.openai.com/plugins/build/mcp-server ; https://developers.openai.com/api/docs/guides/secure-mcp-tunnels

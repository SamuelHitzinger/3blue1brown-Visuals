# ChatGPT Live bridge validation — 2026-10-14

Implemented on `codex/lecture-visual-catalog`. No changes to the existing independent `local-plugin/` package.

## Verified

- Backend capability, capture and reader/gateway suite: 31 tests pass. Includes expiry, revocation, owner isolation, input limits, duplicate speech, byte-preserving photo retention and optional bridge-storage failure isolation.
- A phone retry cannot share a photo accepted before opt-in, restore a photo removed by connection replacement, or reset the fifteen-minute retention period. Independent code review found this issue; integration regression tests now cover all three cases.
- Frontend capture suite plus camera preset: 20 tests pass. ChatGPT camera mode disables audio both in controls and in capture-engine options. Its photo sampling interval is fixed to ten seconds, independent of the standard-mode selector. Unchanged views retain the existing suppression and sixty-second refresh; only still photos are uploaded.
- MCP protocol tests: 2 pass with the installed pinned dependencies. Tool image output, pagination, gap reporting, speech arguments and loopback-only networking are exercised.
- Updated plugin suite: 3 tests pass, including reloading the selected connection and rejecting camera/speech calls after a switch until the new lecture context has been read. Existing pre-update processes need one restart to adopt this behavior.
- Production website build passes. Existing bundle-size/browser-external warnings remain.
- A real stdio MCP client connected to a separate local HTTP backend with a synthetic lecture. A synthetic JPEG passed through production capture acceptance, reached the MCP client byte-for-byte unchanged, and a speech tool call appended one source. Retrying appended no second speech source. The synthetic note synthesizer reached source revision 2 / coverage 2. No model provider or actual ChatGPT Live session was involved.
- Website connection panel inspected in the browser with synthetic data. Screenshot: `chatgpt-live-bridge/connection-panel.png`.

## Not yet verified / activation

- Completed: actual personal ChatGPT plugin installation and private tunnel setup. The plugin detail page shows Connected and Try in chat. Plugin ID: `plugin_asdk_app_6acf68f9432c8191815e45b1cb7b949b`. The tunnel forwarded MCP discovery traffic during connection without logged errors. Screenshot: `chatgpt-live-bridge/chatgpt-connected.png`.
- Whether Live calls the tools reliably at lecture pauses and whether Live consumes returned camera images on this account.
- Same-iPhone background voice with foreground Safari camera. Desktop voice plus phone camera is the initial fallback.
- Raw ChatGPT audio/transcript streaming and native Live camera video are not implemented or claimed. Current official documentation exposes neither as this plugin's input.
- The user explicitly approved the real mechanics lecture connection for eight hours. Its scoped capability was created and verified through a read-only context request; it expires at 2026-10-14 18:31:37 UTC (20:31:37 Zurich). Connection credentials are stored only in the ignored local plugin configuration. This grants local bridge access; it does not install the plugin in ChatGPT.
- Account sign-in and explicitly approved private tunnel creation completed. Tunnel `tunnel_6acf5d4308108191a9c8df803804129d` is associated with the Personal organization and selected ChatGPT workspace. Official Windows tunnel-client v0.0.16 was downloaded and its release digest verified. A local stdio profile targets this plugin on health port 8183.
- The user created the one-day Tunnels Read + Use runtime key and ran the secure-entry helper. A normal-host status check confirms the managed runtime is running, healthy and ready on loopback port 8183. The first sandboxed check could not inspect the host process/health endpoint and incorrectly appeared stopped; no restart was needed. The key stays in the child environment, not source/config files. A real ChatGPT Live conversation/tool call remains unverified.
- A real local stdio client listed all three configured tools and successfully read the selected mechanics lecture context with the expected expiry. No speech sources were appended. The user approved the final ChatGPT connection and its Connected state was verified. No additional OAuth is configured for the stdio bridge; OpenAI's private tunnel account/workspace authorization remains in force.

## Real lecture preparation — Informatik

Reused the user's existing empty `Exersice 5` lecture (`bd8ad008-85ff-416c-ab00-f7f78ed0c9ee`) in Informatik. The explicitly requested eight-hour connection was saved privately and verified through the local bridge; it expires 2026-10-14 20:19:13 UTC (22:19:13 Zurich). The old mechanics grant was revoked to prevent misrouting new speech. Existing phone pairing and reader link were preserved. One tunnel restart is pending to load the updated plugin and new connection; secure-entry script now checks the key, stops the previous managed runtime, and restarts it. No real lecture content has been invented or appended for testing.

Update 2026-10-14 12:23 UTC: user restarted with a replacement runtime key. Normal-host status confirms running/healthy/ready. The actual connected ChatGPT MCP tool successfully read `Exersice 5`, source revision 0, status idle and the expected expiry. This verifies the cloud-to-PC route and new lecture selection. Live microphone capture, real phone image inspection and generated notes still require the physical-device trial.

## Existing full-lecture replay result (separate task)

Slide-only replay reached the end of the 1:57:59.76 source video. Accepted 204 captures across both initial audio run and slide-only continuation; 156 processed, 6 skipped, 42 failed, 0 pending. Saved source revision 156; final note synthesis failed and covers revision 12. Two visual sources are marked ready. This is **not** a successful full-lecture note-generation test. Earlier audio failures include exhausted ElevenLabs quota. Failed recordings remain available; these plugin changes do not retry, erase or conceal them.

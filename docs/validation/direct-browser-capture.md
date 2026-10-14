# Direct browser capture validation — 2026-10-14

Branch: `codex/lecture-visual-catalog`.

## Delivered

- Direct recording is the recommended mode, using the existing QR pairing and
  private HTTPS receiver. Audio is captured in complete 15-second files; photos
  default to 15 seconds with a 10-second option and unchanged-view suppression.
- The next audio window starts before waiting for local persistence. A ten-second
  save watchdog pauses visibly and retains final clips if storage stalls.
- Existing IndexedDB persistence, stable upload IDs, backoff and final-clip
  retention remain active. Newly acknowledged uploads invalidate older status
  snapshots until a fresh poll confirms processing.
- Phone and desktop display extraction failures and notes progress. The phone
  also displays local upload backlog and stale connection state. Notes age is
  measured from the oldest extracted source awaiting synthesis, excluding earlier
  recording/upload/transcription delays.
- Direct transcription supports ElevenLabs (existing default) and explicitly
  configured Deepgram. Temporary failures retry at most three times within a
  45-second request deadline; key and credits failures remain actionable and
  preserve audio. No automatic provider switching or browser-visible keys.
- Incremental note updates send previous cited notes and a bounded new-source
  batch. Continuous arrivals cannot extend the batching window indefinitely.
  Successful batches alone advance coverage; failures preserve notes and sources.

## Verification

- Backend full suite: **452 passed, 0 failed**.
- Frontend full suite: **154 passed, 0 failed**.
- Backend typecheck and production frontend build passed.
- Existing build warnings: browser-externalized Node modules and large chunks.
- Windows sandbox blocked file realpath/atomic rename operations in the first
  build/full-backend attempt. Both passed outside that sandbox; no product code
  was changed to bypass those restrictions.
- Independent review identified slow-persistence recording gaps, asynchronous
  encoder-start failure, and stale desktop status. All three were fixed; focused
  regressions passed. Browser testing then found and verified the upload/status
  race fix.

## Browser recording and outage recovery

Headless Chromium at 393 × 852 with synthetic camera/microphone, actual production
frontend bundle, production capture and notes services, in-memory databases, and
deterministic extraction/synthesis (no external model calls):

1. Paired through the capture UI and started camera plus microphone.
2. Received a JPEG and complete audio recordings (15,001 ms, 15,003 ms, 6,163 ms).
3. Simulated a network outage. The phone reported the interrupted connection and
   retained two audio clips in IndexedDB.
4. Paused, restored connectivity, and reloaded the page. Both clips uploaded;
   final source revision and synthesized revision both reached **4**.
5. Zero browser page errors and no horizontal overflow.

Screenshots: [recording](direct-browser-capture/recording.png),
[offline](direct-browser-capture/offline.png),
[recovered](direct-browser-capture/recovered.png).

Repeat from the repository root after `npm run app:build`:

```powershell
.\node_modules\.bin\bun.cmd scripts/verify-direct-capture.ts "C:\path\to\chrome.exe"
```

The harness uses a loopback server and maps its capture requests to the configured
synthetic HTTPS origin. It does not test the physical phone or private tunnel.

## Remaining device validation

An iPhone/Safari and Android/Chrome lecture trial remains necessary for microphone
quality, battery/thermal behavior, interruptions, and actual model latency. API
contracts and retries were tested with synthetic responses; no live provider
credits or transcription quality were verified. Browser page must stay visible
and unlocked. This is short-file audio plus still photos, not full video recording
or sample-perfect continuous audio. Restart the running backend and refresh the
capture page to load these changes.

Provider references: [Deepgram file transcription](https://developers.deepgram.com/reference/speech-to-text/listen-pre-recorded)
and [ElevenLabs transcription](https://elevenlabs.io/docs/api-reference/speech-to-text/convert).

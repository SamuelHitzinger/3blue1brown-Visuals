# Capture a lecture directly from a phone or browser

Your phone runs a capture page in Safari or Chrome. It sends slide photos and complete
audio clips to the computer, which extracts text, updates cited lecture notes,
and creates reviewed visual explanations using the existing animation catalog.

## Start

1. Install Tailscale on the computer and iPhone, sign both into the same account,
   and connect both devices. Private Tailscale Serve supplies trusted HTTPS.
2. Configure the existing server AI connection. Photos and notes use that
   connection; audio uses `ELEVENLABS_API_KEY` in `backend/.env.local` by default.
   Alternatively set `LECTURE_TRANSCRIPTION_PROVIDER=deepgram` and `DEEPGRAM_API_KEY`.
   Keys stay on the server. No ChatGPT Live session or plugin is needed.
3. From the repository root, run `npm install`,
   `npm --prefix frontend/app install`, then `npm run phone:start`.
4. Open `http://127.0.0.1:8080/lectures`, create or open a lecture, and choose
   **Pair a phone** in **Connect your phone**. Scan its QR code with the iPhone
   and open the link in Safari.
5. Tap **Start capture** and allow camera and microphone access. Point the rear
   camera at the slides or board. Keep Safari visible and the phone unlocked.
6. Leave that lecture open on the computer. Its continuous notes page updates
   automatically as material is processed; visual explanations appear inline.
   No second device or reader link is needed for this computer-only flow.

The launcher builds the app and renderer, binds the desktop to loopback, and
forwards only the restricted capture listener through private Tailscale Serve.
It does not use public Funnel. Tailscale may first require HTTPS to be enabled
for your account; follow its setup link if shown. Leave the command running.
Ctrl+C stops the session. Pairing expires after ten minutes before connection;
an accepted device connection lasts four hours. Desktop **Disconnect** revokes it.

If a port is busy, choose different ports, for example:

```sh
npm run phone:start -- --port 8090 --capture-port 8091 --https-port 8444
```

Existing Tailscale configuration is preserved. A conflicting HTTPS port causes
an error. For an existing trusted HTTPS reverse proxy, use
`--origin https://your-capture-host` and forward it **only** to the capture port,
default `127.0.0.1:8081`. Never forward the unrestricted anonymous desktop API.

## During a lecture

The phone is a camera controller: use the zoom slider or presets to frame the
board, **Take photo** to capture an important change immediately, and the fixed
**Pause** / **Resume capture** button to stop or continue. Zoom affects both the
preview and the saved photograph. Supported camera zoom is preferred; otherwise
the page labels it **Digital crop**. Cropped photos are not artificially enlarged.
Audio, photo interval, and privacy details are under **Capture settings & privacy**;
upload progress can be expanded separately. Errors remain visible.

Audio is recorded as complete clips of about 15 seconds. Photos default to every
15 seconds, with 10-, 30- and 60-second options. Substantially unchanged frames are
suppressed, with periodic refreshes so small board changes are not skipped
indefinitely. Pausing flushes the final audio clip. Switching apps, locking the
phone, losing a media device, or reaching queue capacity pauses capture visibly.
Return to Safari and tap **Resume capture**. Screen wake lock helps when available
but does not enable background recording.

The next audio clip starts before the previous clip waits for local storage.
If saving stalls for ten seconds, capture pauses visibly and retains the final
clips instead of silently leaving the microphone idle. This is short-file
capture, not a WebRTC stream or a promise of sample-perfect audio boundaries.

Phone uploads use a bounded IndexedDB queue, stable item IDs, and automatic
retries. Keep the capture tab open until its pending count reaches zero. If
storage fails, final material is held in memory and the page warns you not to
close it. Reopening the capture page restores its device connection and pending
uploads while the pairing remains valid. The bounded device token is kept in
same-origin browser storage until expiry or revocation. Re-pairing does not
silently transfer unsent material from an old pairing; the page reports retained
items belonging to the previous connection.

Server acceptance means the media is durably queued. **Text saved** means its
extracted source is available to the lecture; note generation may still be in
progress. Desktop refreshes automatically, including sessions previously idle.
Notes preserve photo/audio provenance and capture times. Personal notes stay
separate from AI updates. Visuals retain the existing compiler, readability,
rendered review, and catalog selection gates. Expect incremental notes in tens
of seconds and complex reviewed visuals in minutes, depending on provider load.

The phone shows local upload backlog, server processing, notes coverage, and the
age of the oldest extracted source still waiting for notes. This age excludes
capture/upload/transcription time and is not end-to-end latency. Failed capture,
failed notes, and stale status remain visible. Failed notes can be retried from
the lecture page. Transcription retries temporary failures up to three times;
key/credits errors explain what to fix before retrying saved audio. Providers
never switch automatically. Optional `LECTURE_TRANSCRIPTION_LANGUAGE` uses the
selected provider's language code; leaving it unset enables automatic detection.

Notes use bounded batches (up to 12 new sources and normally 24,000 characters;
a single larger source is processed intact) plus previous cited notes. Earlier
raw sources remain stored for reference. Successful batches advance coverage;
failed batches retain earlier notes and stop until a retry or new source arrives.
The three-second batching window is not extended by continuous arrivals.

## Read on another screen

For an iPad or another computer later, connect that device to the same Tailscale
account. In the desktop lecture, expand **Open live notes** and create a reader
link. Scan its QR code or open the link on the reading device. This is a separate,
read-only page: continuous notes, section navigation, and the same inline players.
It checks for updates about every two seconds, preserves the current reading
position, and keeps the last notes visible while reconnecting.

Reader links expire after eight hours. Creating a replacement or choosing
**Revoke reader link** invalidates the old link. Anyone with the link and network access
can read that lecture's generated and personal notes and visualizations; they
cannot edit it, upload media, or browse other lectures. Raw captured sources are
not included. The token travels in a URL fragment, is removed from the address
bar, and is kept in that reading tab's session storage. The server stores only
its hash. Imported model downloads require the same lecture-scoped access.

## Data and limits

Photos go to the configured AI provider with web tools disabled. Audio goes to
ElevenLabs Scribe. Start capture only with permission to record the lecture.
This feature is not a full recording archive: successful raw media is removed
from active capture records after its text is saved, and empty media is skipped.
Failed items retain bytes for retry. Deleting a lecture removes its associated
capture records and cancels processing. SQLite journals, backups, and browser
storage can retain older bytes; this is not a secure-erasure guarantee.

The phone queue allows 30 items / 40 MiB, reserving capacity for final recordings.
The server accepts JPEGs up to 2,000,000 bytes and complete supported audio clips
up to 5,000,000 bytes, with a reported duration at most 45 seconds. The capture
page stops each recorder after 20 seconds; the server validates container
signatures and reported duration, but does not independently decode duration.
It caps pending work at 12 items per lecture,
48 globally, and stored raw media at 64 MiB. Capacity errors retry after backoff.
A lecture accepts 1,200 text sources and 250,000 total source characters; start
another session when full. Failed processing can be retried from either device.

`CAPTURE_DB_PATH` defaults to `lecture-capture.sqlite` beside the lecture database.
Persist it and back it up consistently with the lecture database, including WAL
state. Pairing secrets and device tokens are stored only as server-side hashes.
Device access permits capture status and uploads for one lecture; it does not
permit reading notes, listing lectures, editing, or deleting them.

## Platform references

- [Safari capture requires a secure context and permission](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)
- [Complete MediaRecorder recordings and timeslice behavior](https://www.w3.org/TR/mediastream-recording/)
- [Screen wake lock lifetime](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API)
- [Private Tailscale Serve](https://tailscale.com/docs/reference/tailscale-cli/serve)
- [ElevenLabs transcription](https://elevenlabs.io/docs/api-reference/speech-to-text/convert)

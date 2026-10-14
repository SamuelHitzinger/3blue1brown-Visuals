# Phone capture for live lectures

## Intent and scope

User wants their iPhone to connect to the computer running Aha, automatically
take lecture photos and record speech, then produce incremental notes and
visual explanations. Continue the existing feature branch and both workflows.
Target iPhone Safari first. Capture is foreground-only, requires explicit Start
and OS camera/microphone permission, and pauses visibly when backgrounded.
Reviewed visual generation remains asynchronous and can take minutes.

## Connection and authorization

The desktop lecture page creates a one-use, ten-minute pairing secret. A locally
generated QR/link carries it in the URL fragment, never query parameters. Phone
exchanges it for a four-hour upload/status-only device token; server stores only
hashes. Desktop can revoke the pairing. Neither secret grants lecture reads,
personal-note access, deletion, or general app identity. Origin checks, bounded
requests, device expiry, and revocation are enforced at every mutation.

Computer already has Tailscale. A dedicated loopback capture listener serves
only `/capture`, public static assets, health, and `/api/capture/*`. Tailscale
Serve provides private trusted HTTPS to this listener; general application APIs
remain unavailable through it. An already trusted deployment may use the same
origin instead. Never weaken browser certificate checks or expose the anonymous
desktop backend as a substitute for phone pairing.

## Capture and ingestion

After Start, retain one camera/microphone stream. Rear-camera preview is inline.
Take bounded JPEGs every 30 seconds (configurable); suppress substantially
unchanged images. Record complete audio-only MediaRecorder clips of about 20
seconds, collecting every blob through stop before the next recorder starts.
Do not treat arbitrary timeslice blobs as standalone audio files. Report actual
capture times and duration, and flush the final clip on pause/stop.

IndexedDB retains bounded pending uploads and stable client IDs. Only one upload
is in flight. Delete local bytes only after durable server acceptance. Retry
transient failures with backoff; stop visibly on permission, revocation, or queue
capacity errors. Do not silently discard audio. Request screen wake lock as a
best-effort aid, not a guarantee of background operation.

Server stores each accepted bounded media item in a durable queue before 202,
with immutable metadata/digest and idempotency conflict detection. Separate
bounded ingestion workers use existing image extraction and ElevenLabs Scribe.
Private image extraction has external web tools disabled. Silence/unreadable
frames are skipped visibly. Failures retain retryable media; successful media
bytes are removed after their immutable text source is saved. Display this
retention behavior and configured provider use before Start.

## Notes, visuals, and source provenance

Normalize media into existing immutable text sources, with optional photo/audio
provenance, device sequence, capture timestamp, and duration. Existing citations
continue to use source IDs. Notes receive capture provenance so upload order is
not mistaken for lecture chronology. Short debounce coalesces bursts; notes
retain capacity while a visual renders. Increase bounded source-count capacity
for a complete lecture while preserving the total-text ceiling.

Desktop polls visible lecture sessions even when its last snapshot was idle,
so phone additions appear automatically. Pairing status shows receipt,
extraction backlog, failures, and last photo/audio. Existing notes stay readable
and personal edits stay separate. Existing visual quality gates remain intact.

## Acceptance

Test pairing scope, ownership, one-time exchange, expiry/revoke, origins,
streaming byte limits, durable retries/restart, media idempotency, source
provenance, silence, deletion, cancellation, queue bounds, notes fairness, and
idle-desktop updates. Test complete recording segments, final flush, queue replay,
foreground pause, late permission cleanup, and restrictive gateway routing.
Run production builds and existing suites. Validate phone layout in browser,
test extraction with synthetic media, and report real-device checks separately:
this agent cannot tap the user's iPhone or grant its OS permissions.

## Sources

- https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia
- https://www.w3.org/TR/mediastream-recording/
- https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API
- https://tailscale.com/docs/reference/tailscale-cli/serve
- https://elevenlabs.io/docs/api-reference/speech-to-text/convert

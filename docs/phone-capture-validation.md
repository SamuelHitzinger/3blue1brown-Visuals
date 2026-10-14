# Phone capture validation — 2026-10-14

Branch: `codex/lecture-visual-catalog`. Validation used synthetic material only.

## Automated checks

- Backend TypeScript compilation passed.
- Backend: 411 tests passed, including pairing scope, expiry, revocation during
  upload, streaming limits, restart recovery, cancellation, media validation,
  source provenance, notes scheduling, and real route/gateway integration.
- Frontend: 115 tests passed, including complete audio windows/final data,
  lost-response claim replay, durable credentials, queue retries and overflow,
  periodic photo refresh, and desktop refresh from an idle lecture.
- Startup: 2 tests passed for trusted origins, port validation, existing Serve
  configuration, and preventing accidental public Funnel reuse.
- Production frontend build passed. Existing large-chunk warning remains.

Windows native fixture and renderer checks required normal filesystem access;
the restricted sandbox rejects their existing realpath/pipe operations.

## Live provider and browser check

Generated a JPEG containing `T(x,y)=(x+y,y)`, its matrix and area statement, plus
offline synthetic speech describing that shear. Uploaded both through the real
device claim and multipart ingestion routes. No microphone or camera was opened
on the computer.

- Audio became a faithful immutable source about 1.6 seconds after upload.
- Photo became a faithful immutable source about 21.1 seconds after upload.
- Notes reached source revision 2 with citations to both sources.
- An automatic 12-second shear scene reached `ready` after compiler and rendered
  quality review. The complete photo/audio-to-notes-and-visual result was present
  about 204 seconds after upload. This is one check, not a latency guarantee.
- Catalog references: `coordinate-maps-2d`, `geometry-led-explanation`.
- The scene started from the first source while the photo was still processing.
  The desktop correctly marks it as reflecting earlier material and offers
  **Update visual** after the later notes revision.
- Desktop playback and the final area-preserving geometry were inspected.
- At a 390-by-844 viewport, capture controls fit with no horizontal overflow.
  Closing and reopening the capture tab restored the active pairing.
- Browser capture page reported no console errors or warnings.

The existing lecture player has a separate mobile limitation: screen-space
labels retain CSS-pixel font sizes while world geometry shrinks, so this test
scene's right-hand labels clip in a narrow lecture view. The phone capture page
does not embed that player. Desktop visualization is intact. Keeping a consistent
16:10 stage avoids an additional aspect-ratio change, but does not solve fixed
pixel typography; that requires scene-authoring or renderer work.

Phone-page UI checks used a temporary loopback-only proxy while account HTTPS
setup was pending. It was not exposed through Tailscale and is not included in
the production launcher. This does not prove actual iPhone hardware behavior.

## Remaining device setup

Tailscale is running on the computer, but private Serve is not enabled for its
account. The launcher printed the account setup link, which was opened for the
user. Enabling that feature requires their account sign-in. iPhone Tailscale
connection, Safari camera/microphone permissions, and real-device background
interruption remain unverified until the user completes those steps.

The app explicitly requires foreground capture. Server media validation bounds
bytes and checks formats; audio duration is client-reported rather than decoded.
Successful raw bytes are removed from live records, not securely erased from
SQLite journals or backups. See [operational setup](phone-capture.md).

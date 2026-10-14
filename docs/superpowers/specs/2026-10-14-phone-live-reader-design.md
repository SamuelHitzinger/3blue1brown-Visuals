# Phone capture with a live second screen

User goal: record from an easy phone camera page with zoom/control, while notes
and inline visuals appear automatically on an iPad or computer.

Reuse the existing lecture pipeline and private Tailscale HTTPS receiver. Phone
capture remains attached to one lecture. Desktop remains the editing surface.
Add a read-only, per-lecture viewer link for the iPad; do not expose the desktop
API through the capture gateway. Viewer credentials are random, stored hashed,
expire after eight hours, can be revoked, and travel in a URL fragment followed
by an Authorization header. Notes refresh without navigating or resetting scroll.

Phone: large camera preview, visible zoom slider/presets, manual snapshot, large
pause/resume control. Keep audio/photo and interval options in a disclosure.
Zoom affects captured images, not only preview. Prefer camera zoom constraints
when supported; provide a clearly labeled digital crop fallback. Preserve the
existing durable upload queue, privacy text, and foreground capture limitation.

iPad: standalone continuous lecture reader, concise notes, inline existing scene
players, section navigation, connection/update state and manual reconnect. No
write controls or lecture management API access. Existing personal edits appear.

Desktop: a prominent 'Open live notes' control creates a reader QR/link, with
revoke control. Source capture remains in its existing panel.

Assumption: iPad uses the same Tailscale account, or computer is the reader.
Live means incremental batch updates after extraction and synthesis, not an
instantaneous word-by-word transcript. No new model or lower-quality rendering.

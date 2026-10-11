# Capability showcase — author handoff

Created 2026-10-11 from the accepted local native films. The generated gallery is
`data/animlib-expansion/showcase/index.html`; the silent reel is `showcase.mp4` in
the same folder. This is a curated media assembly, not a new scene/runtime system.

## Delivered scope

- Eleven complete scenes in accepted order: shear, matrix transport, compact
  queue, logistic residual, events-to-state, projected neural trajectory, repaired
  peptide revision5, transcription revision3, RNA splice/pore revision4 and the
  complete 43-second translation revision4.
- One primary video player with native controls, eleven keyboard-operable chapter
  buttons, playback-following operation/API/reuse/review context, responsive
  navigation, MP4 chapter metadata, WebVTT chapters and JSON provenance/timings.
- Two separate six-second technical examples: image/UV reuse and optical focus.
  They retain their own acceptance/art scope and never enter the primary reel.
- Local poster/previews and copied reading references. Media and direct gallery
  links work when moving the folder. Nested Markdown links and execution of the
  copied generator sources require repository context; this is not a complete
  documentation or runnable-source bundle. The FFconcat audit file records the
  original local input paths and is not a portable rebuild recipe.

## Assembly and verification

`node shared/animlib/tools/build-capability-showcase.mjs` validates each source
SHA-256 against `demo/expansion/showcase-catalog.json` before assembly. Use
`--ffmpeg PATH` or `FFMPEG`; `--output DIR` changes the output folder. The default
binary is the existing local `data/video-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe`.
No dependencies are installed. The exact ignored input films must already exist;
scene generation/rendering is a separate documented workflow. There is no claim
that a fresh clone contains the required media.

Every input is decoded completely with FFmpeg `-xerror` and frame MD5 output.
Timings come from decoded frame counts/timebases, not catalog duration guesses.
Every main input must be silent, 1280×720 and 30 fps. The assembly stream-copies
full films with hard cuts and keeps every decoded frame exactly equal to its
corresponding input frame. No crop, speed change, overlay, new title or narration
is introduced. Both supplemental copies match their reviewed file SHA-256 and
fully decode (144 frames at 24 fps and 180 frames at 30 fps respectively).

The final reel fully decodes to **3,930 frames / 131 seconds / 1280×720 / 30 fps**,
with no audio. All 3,930 decoded-frame MD5 values equal the concatenated input
values. Chapter starts are 0, 6.5, 15, 24, 31, 38.5, 48, 58, 66, 78 and 88 seconds.
The final scene ends at 131 seconds. All eleven muxed chapter titles are verified.

Final reel SHA-256:
`fc187b53bd27e64b80a9ca0ec41f9ab72ba5603b16984c5826465c32160c89f6`.

An independent reviewer found that the first mux retained chapter ranges but
dropped their titles and emitted a QT chapter-track warning. Changing the metadata
mapping from the disabled metadata source to the chapter input repaired both.
The rebuilt decode has all titles, no warning and the same exact frame equality.
The builder now explicitly rejects missing muxed titles. The older reel hash is
superseded; none of the original source films changed.

## Author visual inspection and limits

Before implementation I viewed all three bundled style-baseline images and wrote
the [style contract](showcase-style-contract.md). I personally viewed assembled
native previews for shear (local 3.8 s), matrix (6.7 s), peptide (3.5 s),
transcription (4.8 s), translation (11.1 s), image reuse (3 s) and optical focus
(4 s). I also inspected both ordered boundary sheets, containing the first/last
frame pairs for all eleven chapters. The final sheet's last two cells repeat the
last frame as padding, not additional evidence. Native boundary PNGs are retained.

The construction owns the frame in the main examples; local labels stay attached
to the relevant object, and the complete reading holds survive assembly. The
supplemental artwork is visibly separate. This author inspection establishes
sampled composition/boundary review, not uninterrupted realtime playback. Prior
independent full-duration scene reviews remain the substantive motion/style
acceptance, scoped to the exact source hashes; exact decoded-frame equality
connects their accepted pixels to the reel. Browser QA and independent assembled
artifact review are separate root/reviewer work, not claimed here.

Fresh syntax check passes. Final complete assembly and all hash/decode/frame
equality/title checks pass. No library implementation or source scene was edited.

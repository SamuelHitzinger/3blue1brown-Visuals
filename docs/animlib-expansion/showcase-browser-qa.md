# Showcase browser check

Root checked the repaired generated gallery on 2026-10-11 in the Codex in-app
browser through the existing local Vite server. This is separate from the
[independent media review](showcase-independent-review.md).

- All eleven chapter buttons sought to the expected start within 0.3 seconds of
  playback, changed the operation heading and reference links, and produced no
  media errors. The player reported 131 seconds at 1280×720.
- Both supplemental players loaded and played their six-second 1280×720 media.
  Starting another player paused the previous player.
- Keyboard Enter selected the first chapter; Space paused the native player.
- The normal desktop layout and a temporary 390×844 viewport were inspected.
  Narrow layout kept the player, labels and links within the screen; document
  width was 375 pixels with a 390-pixel viewport, with no horizontal overflow.
  The temporary viewport override was reset afterward.
- Browser warning/error log was empty. The gallery was left open at the first
  chapter as the user-facing deliverable.

This is interaction and sampled layout verification, not a claim of another
complete motion review. Direct file-target existence and exact movie identity
are covered by the independent media review. Nested links inside copied Markdown
require the repository, as the gallery footer states.

# Reducible frontier motion supplement

Source: [A* Search: How Your Map Applications Find Shortest Routes](https://www.youtube.com/watch?v=88I6IidylGc), Uniform Cost Search passage.
Captured 2026-10-11 through normal muted browser playback. No source video was
downloaded or reused as an output asset.

## Capture and independent inspection

`data/animlib-expansion/reducible-complete/insertion-playback/` contains344
complete browser screenshots, their exact `frames.json` metadata, and22 ordered
4×4 contact sheets. Every saved frame reported readyState4, paused:false,
duration976.461s, and a2195×1235 video rectangle at0,0.

Two uninterrupted playback bursts were captured, with a brief pause/resume
between them and no intervening seek:

- `000.jpg`–`239.jpg`:310.286429–318.551803s, approximately29 samples/second.
- `240.jpg`–`343.jpg`:318.937894–335.882646s, approximately6 samples/second.

The gap between bursts is not claimed as inspected motion. Screenshots have
irregular cadence and may repeat source frames; this is not an every-encoded-
frame claim. Normal YouTube ads appeared during earlier seeking; they were
skipped through the visible Skip control and excluded from saved evidence.

Independent `motion_visual_reviewer` viewed all22 sheets/all344 samples. Its
comparison is recorded in `motion-visual-review.md`. Root collected this new
evidence after the reviewer correctly identified the older nominal1fps samples
as insufficient to establish insertion easing.

## Observed choreography and consequence

Four new records fade into the existing stack near321s. Around329.2–329.7s the
top record shifts right and fades while lower records slide upward. Around
331.3–332.0s a distinct cheaper-route record enters while lower records shift;
another extraction occurs near333.4–334.2s. Route, cost and destination remain
one card throughout. Short vertical shifts, brief lateral extraction and pauses
between algorithm operations carry the motion.

The reviewed native frontier revision2 matches the compact three-band record
language and preserves candidate identity/cost correctly. Its longer separated
lanes demonstrate a general collision-free permutation, with more lateral travel
and simultaneous crossing than this source passage. That is a concrete remaining
choreography difference, not an absence of temporal evidence. A source-like
insertion/extraction recipe should compose explicit visibility, compact slot
shifts and a single extracted record; it must not silently change candidate
costs or collapse two routes to the same destination into one identity.

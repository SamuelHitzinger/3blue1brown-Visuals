# Matched derivative comparison

Run from the repository root:

```powershell
$env:COMPARISON_PORT = '5362'
node_modules/.bin/bun.cmd backend/bench/animation-comparison-view.ts
```

Open the printed localhost URL. Play, pause, scrub, change speed, or focus either
animation. Both sides use one narration clock. Each canvas retains its original
1280×720 viewport inside a scaled iframe, so resizing the comparison does not
change scene layout.

Inputs are the approved trial 2 baseline and trial 3 improved derivative runs,
plus their shared frozen narration. Startup checks fixture identity, narration
hashes, source hashes, and approval receipts. Scene sources are replayed without
edits or regeneration. The baseline uses its frozen animlib build; the improved
run uses the current animlib build. Keep the benchmark data and baseline snapshot
described in `docs/validation/animation-efficiency-2026-10-15.md` available locally.
No generation or TTS requests are made.

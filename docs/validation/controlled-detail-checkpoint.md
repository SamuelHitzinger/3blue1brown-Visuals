# Controlled visual detail checkpoint

2026-10-16. Two retrospective native comparisons now isolate mesh detail while
preserving the existing explanation. They use saved model-authored baselines,
with one deterministic source substitution each. **These are detail-sensitivity
tests, not new model trials or baseline-versus-optimized speed results.**

Subsequent [quality-recovery comparisons](quality-revision-checkpoint-2026-10-16.md)
repair presentation defects in the high-detail originals without lowering detail.
Their new sampled-frame verdict does not replace this historical detail test or
establish a generation speedup.

## What actually ran

| Construction | Lower detail | Higher detail | Preserved in both |
| --- | --- | --- | --- |
| Moving saddle slice | 10×10 cells; 121 vertices, 200 triangles | 40×40 cells; 1,681 vertices, 3,200 triangles | Same 15 entities, analytic traces, plane, labels, camera and motion |
| Full caffeine conformer | 24 atom meshes; 144 vertices, 192 triangles | 24 atom meshes; 1,584 vertices, 3,072 triangles | Same 94 entities, 24 atoms, 25 bonds/29 strokes, reveal, rotation, labels and camera |

Molecule counts exclude the unchanged legend meshes. Both variants retain the
same PubChem coordinates and bond orders; lowering detail removes no atoms or
bonds. The only molecular source change is the atom constructor's `detail:2`
to `detail:0`. The only surface source change is the two grid segment counts.
Source receipts are validated by the existing probe loader; the molecular host
data SHA-256 is checked before compilation.

At 41 samples from 0 to 8 seconds, all camera and element state outside the
declared mesh arrays match exactly. The slice points satisfy the analytic
equation with zero observed error. Their maximum sampled vertical gap from the
actual triangulated mesh is **0.012 world units** at low detail and **0.0008** at
high detail. This measures discretization error separately from analytic trace
correctness. It is neither an all-points bound nor a geometric distance normal
to the surface.

Native WebGPU renders provide three sample times at two viewport sizes. Separate
side-by-side MP4s contain the entire eight-second construction at 24 fps,
2560×720, with a two-second final hold and no audio. FFmpeg decoded both files
successfully: 192 frames each. Rendering/encoding occurred offline; its time is
not model latency, live ingestion latency or browser presentation timing.

Ignored artifacts: `data/realtime-workshop/controlled-detail-local-01/` contains
exact sources, the frozen audit, native PNGs, numerical results and render workers.
The surface movie is `surface-detailed/detail-side-by-side.mp4`; the molecule
movie is `caffeine-full/detail-side-by-side-v2.mp4`. The first export worker
completed the surface then failed by reusing a GPU device owned and destroyed by
the disposed renderer. A fresh process exported the molecule without changing
its scene. The failed intermediate output remains preserved.

[Sanitized numerical and media results](controlled-detail-local-results-2026-10-16.json)
retain source/movie hashes, exact detail counts and review scope.

## Fresh blind review

Reviewer `/root/detail_blind_review` inspected neutral A/B sheets, four native
individual frames and all three skill reference images. Source, settings,
timings and detail labels were withheld. Surface A was high detail; molecule B
was high detail. The reviewer did not review full-motion playback.

- Higher-detail surface has a smoother silhouette. Both preserve the visible
  plane/trace operation, but both need a larger construction and a clearer,
  higher-contrast blue trace label.
- Higher-detail molecule has round shaded atoms and clearer depth cues; the
  lower-detail atoms look faceted. Both need chemical subscripts, more clearance
  around the right methyl group, and a local annotation during hydrogen reveal.
- Both comparisons receive **revise** for readability and reference style.
  Sampled operations are visible; overall scientific reasoning and full-motion
  technical quality remain unverified by this visual review.

Mesh density is therefore a real visual-quality variable. Removing detail cannot
be counted as a successful optimization merely because topology survives. The
existing baselines also have absolute presentation defects; relative parity
alone cannot make those defects pass the requested style gate.

## Prospective controlled fixtures

`backend/bench/realtime-complexity-fixtures/detail-pairs.ts` defines separate
matched contracts for parabola sampling, saddle mesh resolution and full-caffeine
sphere detail. Within each pair, data, inference, camera, motion, duration and
reading hold are identical. Validation rejects confounded instructions/contracts
and invalid detail settings. It validates the experimental design, not model
outputs or rendered scientific correctness.

These new contracts differ from the retrospective sources above: for example,
the prospective molecule keeps all hydrogens visible from the start, while the
retrospective baseline reveals them. Their results must not be pooled. No new
model trial has run. Each detail level still needs matched authoring arms,
end-to-end timing, independent motion review and unseen-subject validation under
the [broader protocol](complexity-matrix-protocol.md).

Six instruction files were prepared locally under
`data/realtime-workshop/controlled-detail-instructions-01/`; their
[manifest](controlled-detail-instructions-2026-10-16.json) records prompt hashes
and `generationStatus: not-run`. Their preparation made zero network requests.

Focused verification passed **10 tests / 83 assertions** across the new detail
fixtures, existing chemistry preparation and matrix utilities. Targeted strict
TypeScript checking passed. Broader agent-run suites encountered sandbox
temporary-file/junction failures and backend pipeline timeouts; the latter run
was stopped. No broad-suite pass is claimed.

```powershell
.\node_modules\.bin\bun.cmd test backend/bench/realtime-complexity-fixtures/detail-pairs.test.ts backend/bench/realtime-complexity-fixtures/prepare.test.ts backend/bench/realtime-complexity-matrix.test.ts
```

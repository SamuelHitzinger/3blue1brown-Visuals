# Scientific graphing: unified visual revision

The current candidate uses the [unified visual contract](unified-3b1b-direction.md)
and [scene contract](science-3b1b-style-contract.md). Source motion remains the
starting point: Visually Explained's selected observation → prediction → residual
→ squared error, and Artem's event → rate → state and trace → projected trajectory.
Near-black backgrounds, restrained semantic colors, fine mathematical scaffolds
and local serif/math labels replace the older source-specific presentation.

## Reusable implementation

`shared/animlib/demo/expansion/science-3b1b.mjs` generates three standalone scene
sources and manifests. `logistic-residual-3b1b.js` uses the existing coordinate-plane,
mapped-curve, reactive geometry, numeric and label APIs. The other two candidates
retain their existing sampled-data mechanics, changing only palette and math font
variants. No new runtime preset or science API is needed for these changes.

The logistic scene drives its curve, selected prediction and residual from the
same `p = sigma(w*x - 2)` calculation. The observed point stays fixed at `(2,1)`;
`w` changes from .6 to 1.4. The final squared error rounds to .096. The initial
curve remains dimly visible, and a reading hold follows the consequence.

## Author verification, 2026-10-11

Root inspected all 26 ordered 8fps contact sheets across both output aspects:
112 logistic, 120 event/state and 152 trajectory samples, 384 actual images total.
Black padding in the last sheets is not counted. Root also inspected native
960×720 midpoint/final frames, including the repaired logistic label clearances.
The full durations were covered; this was not a thumbnail-only check. All six
silent H.264/yuv420p 30fps films fully decoded without errors:

| Scene | Duration | Frames per aspect |
| --- | ---: | ---: |
| Logistic residual | 7s | 210 |
| Event/rate/state | 7.5s | 225 |
| Projected neural trajectory | 9.5s | 285 |

`tools/verify-science-3b1b.mjs` passed 211 logistic poses, checking every sampled
curve point, numeric parameter, selected prediction, observed point and residual.
Maximum numeric error was 1.7763568394002505e-15. It also compared 226 event/state
and 286 trajectory poses against the earlier sources: geometry, transforms,
numbers and timing remained exact after normalizing only the intended math font
change. All three scenes passed full reverse-seek equality and byte-identical
repeat native frames in both aspects. Results are in
`data/animlib-expansion/science-3b1b/verification.json`.

The 14-entry `frozen-hashes.json` in that directory pins generated scenes,
manifests, films and the two authored entry points. Film SHA-256 identities:

| Scene/aspect | SHA-256 |
| --- | --- |
| Logistic 16:9 | `47274a1fdcab7693ee0abedc42e69791fd2df11b3038bc0d7b8189dcb82d45c5` |
| Logistic 4:3 | `4d2d24f16ee508a4353952e3bc525a879d38bb56e827c0422e89b7f072f4b572` |
| Event/state 16:9 | `eaae5d5c0e7aa5a6c5d24e29a650e88c712d3a0493dc64ffd51a156b21535c9b` |
| Event/state 4:3 | `f8d006fe49f2031a1e4c32a6f95093dcb24e9cf256cbf19915e8c754205ad762` |
| Trajectory 16:9 | `3f91942fe841fab606c384a1f672ad9da6e859a12a7f18da1ed203330d325934` |
| Trajectory 4:3 | `80e48869c81be5ab4f6facc4f8a3650bd8e1cb87b238a0bfde79bd15a3da3c76` |

[Independent style/motion review](science-3b1b-independent-review.md) accepted all
three candidates on reasoning, readability, current style and technical gates.
These synthetic examples
do not establish recovered neural manifolds, model-training behavior or
channel-wide visual equivalence. The library CPU suite at the preceding code
checkpoint passed 972 tests in 87 files; these scene changes additionally passed
the dedicated correspondence audit above.

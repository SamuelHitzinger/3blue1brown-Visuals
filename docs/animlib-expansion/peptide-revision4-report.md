# Peptide revision 4 handoff

Frozen for independent review. Revision 3 remains unchanged. The accepted staged
coil formation, hold, packing and exact compact endpoint remain the same; this
revision addresses the independent surface-color and shading findings.

The new host-only `createMolecularEnvelopeParts` extracts a finer complete contour
and partitions it without changing shared coordinates/normals or dropping faces.
Its existing single-mesh sibling retains exact defaults and old budgets. The new
preparation bounds do not increase renderer, asset, scene or VM limits. Ten focused
envelope tests pass, including old deposited-model reproduction, whole-face
coverage, exact unsplit parity, shared-boundary normals and budget rejection.

The final original asset uses sigma 1.2, isovalue 1.05, resolution 56 and six
smoothing cycles: 26,916 shared vertices and 53,868 triangles across five parts.
Its display normals evaluate the analytic Gaussian density gradient at the final
smoothed vertices. A continuous Gaussian-weighted sequence field replaces hard
nearest-atom color ownership. The same source palette and unchanged 414-atom
endpoint remain attached in provenance. The recessed blue region is retained.
Surface/image decoded memory is 17,787,392 bytes; the old bead asset is reused.

Root personally viewed all ten final MP4-derived 8fps ordered sheets, **160 sampled
full compositions** across both complete ten-second films, and native final-surface
views at 8.4/9.5 seconds in both aspects. Source native Protein Folding frame110
and frozen revision3 were compared directly. The previous stepped red/yellow
boundary and angular highlight patches are visibly softened. This is a sampled
motion review, not a claim to inspect every encoded frame or a reference-style
approval. Independent evaluation remains required.

The scene also clamps only its expensive pose/geometry cache key at seven seconds,
after the authored pose settles. Visibility and camera clocks retain real time.
The organization agent's isolated interleaved benchmark checks **309 exact full
frame comparisons at 103 distinct times**, including adjacent-double boundaries
and reverse seeks. Held-phase evaluation plus JSON serialization medians improve
from 73.90/74.85ms to 51.10/51.80ms; moving-phase medians stay 72.96/73.06ms. These
are local CPU measurements, not GPU/render timings or an interactive guarantee.
Root inspected the full benchmark and applied only its verified cache transform
to the new revision generator. Pins and leases return to zero.

Full CPU suite snapshot: **962 tests passed** with four workers. An earlier
unrestricted run had 961 passes and one neural-proof compile interruption under
the unchanged 200ms VM wall-clock limit; its isolated rerun passed, followed by
the complete four-worker run. No timeout or production budget was increased.

Both silent H.264/yuv420p films are 30fps, 300 frames and ten seconds; complete
FFmpeg decodes succeed. Under `data/animlib-expansion/biological-motion-revision4/`:

| File | SHA-256 |
|---|---|
| `peptide-16x9.mp4`,1280×720 | `67e93602d8eda967d3290d5e341ee7fe543adf01e27bd19c22d6ed669c125fb7` |
| `peptide-4x3.mp4`,960×720 | `9c5d4c245ad4b32c65501ada12d32c88dc087a65f3b525382d7258d4f12fa083` |

`frozen-hashes.json` records 33 film/source/package/blob/preparation entries.
`peptide-frames/frames.json` indexes full native stills. Reproduction and limits
are in `shared/animlib/fixtures/biological/peptide-surface-revision4/README.md` and
`shared/animlib/docs/molecular-envelope-parts.md`. Earlier prototype parameters
were rejected after native inspection before the final films; only final package
dependencies remain in the new asset directory.

This remains an illustrative peptide and authored folding operation. It does not
claim physical folding, solvent exclusion, measured chemistry, collision freedom
or completion of the full reference-fidelity goal.

# Expansion proof index

Run from repository root after `npm run build --workspace animlib`. These are
original native scenes; reference footage is inspection evidence, not an output
asset. Acceptance below is for a specific representative operation and film,
not whole-channel or nearly-identical sequence fidelity.

| Proof | Entry point | Authored contract / palette |
| --- | --- | --- |
| Shear, graph relaxation, equal-value swap | `shear-manifest.json`, `graph-relaxation-manifest.json`, `collection-swap-manifest.json` | [Math/algorithm contracts](math-style-contract.md); graph palette in its manifest |
| Column copies → sum → row arithmetic | `matrix-transport-manifest.json` | [Matrix/frontier contract](matrix-frontier-style-contract.md); teal/orange math roles |
| Frontier insertion/reorder | `frontier-reorder-manifest.json` | Same contract; separate Reducible purple/sans/ring palette in manifest |
| Event rates and logistic residual | `node shared/animlib/demo/expansion/science-proofs.mjs` | [Science contracts](science-style-contract.md); `artem-state-palette.json`, `logistic-residual-palette.json` |
| Trace → projected trajectory | `node shared/animlib/demo/expansion/neural-trajectory-proof.mjs` | [Neural contract](../../../../docs/animlib-expansion/neural-trajectory-style-contract.md); Artem palette plus explicit time-color trail |
| Deposited 1CRN / original transcription setup | `node shared/animlib/demo/expansion/biological-proofs.mjs` | [Biological contract](biological-style-contract.md); sequence bands and distinct DNA/RNA roles |
| Idealized peptide torsions → compaction | `node shared/animlib/demo/expansion/peptide-motion-proof.mjs` | Same biological contract, original ALA/SER/VAL fixture; separate from 1CRN |
| RNA arrival rotation and emergence | `node shared/animlib/demo/expansion/transcription-motion-proof.mjs` | Same biological contract; schematic channel and persistent triplet |
| Advancing transcription and optical focus | `node shared/animlib/demo/expansion/transcription-cycle-proof.mjs` | [Cycle contract](../../../../docs/animlib-expansion/transcription-cycle-style-contract.md); independent review requires further active-site visibility and art-direction work |
| Splice and pore transport | `node shared/animlib/demo/expansion/rna-processing-proof.mjs` | [Processing contract](../../../../docs/animlib-expansion/rna-processing-style-contract.md); source loop formation and cellular setting remain in revision |
| Optical rack focus | `node shared/animlib/demo/expansion/depth-focus-proof.mjs` | [Focus contract](../../../../docs/animlib-expansion/depth-focus-style-contract.md); same geometry with near/far focus and sharp annotations |
| Host model/image reuse | `image-assets-manifest.json`; `node shared/animlib/tools/prove-image-rendering.mjs data/animlib-expansion/image-proof` | Source-color permission is a host policy, not an artist palette default |

Manifest scenes render with the common exporter, for example:

```sh
node shared/animlib/tools/render-video.mjs --manifest shared/animlib/demo/expansion/matrix-transport-manifest.json --output data/animlib-expansion/matrix-transport-new.mp4 --ffmpeg data/video-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe --width 1280 --height 720 --fps 30
```

Use `FFMPEG` for a different local binary in the complete science/neural runners.
The biological generators write scene source, frame input JSON, manifests and
CPU measurements; they do **not** render films themselves. For example, after the
peptide generator:

```sh
node shared/animlib/tools/render-frames.mjs data/animlib-expansion/biological-motion-revision2/peptide-frames.json
node shared/animlib/tools/render-video.mjs --manifest data/animlib-expansion/biological-motion-revision2/peptide-manifest.json --output data/animlib-expansion/biological-motion-revision2/peptide-new.mp4 --ffmpeg data/video-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe --width 1280 --height 720 --fps 30
node shared/animlib/tools/benchmark-motion-peptide.mjs data/animlib-expansion/performance/motion --gpu
```

Repeat native frames at 960×720 (the frame runner produces both aspects). Keep
reviewed media when creating a new candidate. Encoded video hashes can change
between exports; compare the actual candidate against its review record.

## Reviewed artifacts and open limits

Paths below are relative to repository root. The independent
[motion review](../../../../docs/animlib-expansion/motion-visual-review.md) is the
authority for these exact releases:

| Artifact | SHA-256 | Reviewed scope |
| --- | --- | --- |
| `data/animlib-expansion/matrix-frontier/matrix-transport/film.mp4` | `e8d14f1c500e209eddaf106fae7a009ba6d07e0aa4ec5d1cac0821cd323c8310` | Column-to-sum-to-row reasoning, readability, reference operation and technical delivery ready |
| `data/animlib-expansion/frontier-revision2/film.mp4` | `c18226864f3a105714874f3f9e0bad261e3be56e53d017bea9852543d0fb2415` | Representative insertion/reorder ready; exact subsecond source easing remains unverified |
| `data/animlib-expansion/neural-proof-r2/film.mp4` | `89b32212ef7108b56085f6d792e45919697901077e3323af54723c5716153ba2` | Representative synthetic projection ready; different data/path, timing and camera from source |

The [round-2 review](../../../../docs/animlib-expansion/visual-evaluation-round2.md)
records bounded shear, final repaired graph, logistic and optimized Artem passes;
their exact export hashes are in
`data/animlib-expansion/revision2/evaluated-film-hashes.json`.
Historical first-release neural/frontier films were superseded, not accepted
as final source-style matches. The [biological motion report](../../../../docs/animlib-expansion/biological-motion-report.md)
records author verification; independent motion acceptance remains a separate
gate. See the latest biological review before treating those films as accepted.

Native MSAA can produce tiny pixel differences; exact CPU stream parity does
not close that GPU issue. No film claims physical folding dynamics, recovered
neural manifolds, atomistic RNA chemistry or arbitrary-font support. Public
helpers remain style-neutral; do not replace these separate artist contracts
with one shared presentation template.

## Provenance and reusable API guides

The [biological fixture README](../../fixtures/biological/README.md) identifies
1CRN selection, CC0 archive/CCD sources, source locks and schematic derivatives.
The [peptide README](../../fixtures/biological/illustrative-peptide/README.md)
pins original templates, geometry assumptions and endpoint envelope provenance.
Other prepared model/image packages carry source/license/converter metadata;
see [asset import](../../docs/assets-import.md). Source-reference observations
live in repository `docs/animlib-expansion/*reference*.md`; those observations
do not authorize copying source pixels or third-party models.

Reusable authoring: [helpers/assets](../../docs/helpers-and-assets.md),
[sampled state](../../docs/sampled-state.md),
[formula and collection identity transport](../../docs/identity-transport.md).
Measured motion costs and exact optimization checks:
[motion performance report](../../../../docs/animlib-expansion/motion-performance-report.md).

# Expansion proof index

Watch the [capability showcase](../../docs/showcase.md) for the current reviewed
operations, then use the commands below to author or regenerate individual scenes.

**Current direction:** 3Blue1Brown art and graphing with motion techniques drawn
from all reference channels. The [unified contract](../../../../docs/animlib-expansion/unified-3b1b-direction.md)
supersedes historical source-art targets below. Start with the current examples
in the next table. Historical assets and scenes remain available for reuse and
motion research; their older presentation is not the current default.

Run from repository root after `npm run build --workspace animlib`. These are
original native scenes; reference footage is inspection evidence, not an output
asset. Acceptance below is for a specific representative operation and film,
not whole-channel or nearly-identical sequence fidelity.

The [coverage and evidence index](../../docs/expansion-index.md) connects these
entry points to public APIs, motion research, fixture provenance and
current independent decisions. Historical films remain evidence; a newer
candidate is not automatically accepted.

## Current mathematical visual examples

All commands run from repository root. Build once with
`npm run build --workspace animlib`, then run the desired generator with Node.
These generators use versioned source/input files and require no old exported
films. They write sources/manifests/frame requests, not encoded films.

| Operation | Generator under `shared/animlib/demo/expansion/` | Output under `data/animlib-expansion/` | Independent review |
| --- | --- | --- | --- |
| Supplied vibration modes → geometric displacement sum | `coupled-modes-proof.mjs` | Defaults to `.tmp/interdisciplinary-proof/` (override with first argument); source, metrics and native frames | [Native proof ready](../../../../docs/animlib-expansion/interdisciplinary-independent-review.md); encoded film unverified |
| Compact graph frontier | `compact-frontier-3b1b.mjs` | `compact-frontier-3b1b/manifest.json`, `frames.json` | [Ready](../../../../docs/animlib-expansion/compact-frontier-3b1b-independent-review.md) |
| Logistic residual; event/rate/state; projected trajectory | `science-3b1b.mjs` | `science-3b1b/{logistic-residual,artem-state,neural-trajectory}/manifest.json`, `frames-input.json` | [All three ready](../../../../docs/animlib-expansion/science-3b1b-independent-review.md) |
| Local coil formation → hold → packing | `peptide-3b1b-revision5.mjs` | `peptide-3b1b-revision5/peptide-manifest.json`, `peptide-frames.json` | [Ready](../../../../docs/animlib-expansion/peptide-3b1b-revision5-independent-review.md) |
| Repeated transcription and RNA emergence | `transcription-cycle-revision3.mjs` | `transcription-cycle-revision3/cycle-manifest.json`, `cycle-frames.json` | [Ready](../../../../docs/animlib-expansion/transcription-cycle-revision3-independent-review.md) |
| RNA formation/cut/join and pore passage | `rna-processing-3b1b-revision4-proof.mjs` | `rna-processing-3b1b-revision4/{splice,pore}-manifest.json`, `{splice,pore}-frames.json` | [Both ready](../../../../docs/animlib-expansion/rna-processing-3b1b-revision4-independent-review.md) |
| Complete translation assembly → growth → release | `translation-3b1b-revision4-proof.mjs` | `translation-3b1b-revision4/translation-manifest.json`, `translation-frames.json` | [Ready](../../../../docs/animlib-expansion/translation-3b1b-revision4-independent-review.md) |

The existing `shear-manifest.json` and `matrix-transport-manifest.json` also use
the current mathematical language and retain their accepted operation reviews.
See [explanatory motion](../../docs/explanatory-motion.md) for helper selection,
identity and time handling, palette roles and asset reuse.

## Historical research and optional assets

| Proof | Entry point | Authored contract / palette |
| --- | --- | --- |
| Shear, graph relaxation, equal-value swap | `shear-manifest.json`, `graph-relaxation-manifest.json`, `collection-swap-manifest.json` | [Math/algorithm contracts](math-style-contract.md); graph palette in its manifest |
| Column copies → sum → row arithmetic | `matrix-transport-manifest.json` | [Matrix/frontier contract](matrix-frontier-style-contract.md); teal/orange math roles |
| Frontier insertion/reorder | `frontier-reorder-manifest.json` | Same contract; separate Reducible purple/sans/ring palette in manifest |
| Compact frontier insertion/extraction | `compact-frontier-manifest.json` | [Source choreography](../../../../docs/animlib-expansion/reducible-motion-supplement.md); .65s contiguous shifts and lateral fades, bounded motion accepted |
| Event rates and logistic residual | `node shared/animlib/demo/expansion/science-proofs.mjs` | [Science contracts](science-style-contract.md); `artem-state-palette.json`, `logistic-residual-palette.json` |
| Trace → projected trajectory | `node shared/animlib/demo/expansion/neural-trajectory-proof.mjs` | [Neural contract](../../../../docs/animlib-expansion/neural-trajectory-style-contract.md); Artem palette plus explicit time-color trail |
| Deposited 1CRN / original transcription setup | `node shared/animlib/demo/expansion/biological-proofs.mjs` | [Biological contract](biological-style-contract.md); sequence bands and distinct DNA/RNA roles |
| Idealized peptide torsions → compaction | `node shared/animlib/demo/expansion/peptide-motion-proof.mjs` | Same biological contract, original ALA/SER/VAL fixture; separate from 1CRN |
| Held side-view coils → cached smooth envelope | `node shared/animlib/demo/expansion/peptide-staged-proof.mjs` | [Independent revision-3 review](../../../../docs/animlib-expansion/peptide-revision3-independent-review.md): staging/readability ready; surface reference style requires revision |
| Finer continuous-color peptide surface | `node shared/animlib/demo/expansion/peptide-surface-revision4-proof.mjs` | [Independent revision-4 review](../../../../docs/animlib-expansion/peptide-revision4-independent-review.md); bounded motion, multipart API and cache optimization accepted |
| RNA arrival rotation and emergence | `node shared/animlib/demo/expansion/transcription-motion-proof.mjs` | Same biological contract; schematic channel and persistent triplet |
| Advancing transcription and optical focus | `node shared/animlib/demo/expansion/transcription-cycle-proof.mjs` | [Cycle contract](../../../../docs/animlib-expansion/transcription-cycle-style-contract.md); independent review requires further active-site visibility and art-direction work |
| Exposed multi-cycle transcription and curved RNA | `node shared/animlib/demo/expansion/transcription-cycle-revision2.mjs` | [Independent revision-2 review](../../../../docs/animlib-expansion/transcription-cycle-revision2-independent-review.md): reasoning/readability ready; machinery/anatomy/environment style requires revision |
| Splice and pore transport | `node shared/animlib/demo/expansion/rna-processing-proof.mjs` | [Processing contract](../../../../docs/animlib-expansion/rna-processing-style-contract.md); source loop formation and cellular setting remain in revision |
| Pre-cut loop formation and cellular pore transport | `node shared/animlib/demo/expansion/rna-processing-revision2-proof.mjs splice` or `pore` | [Independent revision-2 review](../../../../docs/animlib-expansion/rna-processing-revision2-independent-review.md): reasoning/technical ready; pore-label readability and cellular rendering require revision |
| Translation assembly → elongation → release | `node shared/animlib/demo/expansion/translation-proof.mjs` | [Independent review](../../../../docs/animlib-expansion/translation-independent-review.md): bounded mechanism/readability ready; reference style requires revision |
| Adaptor close-up → oblique transfer | `node shared/animlib/demo/expansion/translation-revision3-proof.mjs` | [Revision-3 review](../../../../docs/animlib-expansion/translation-revision3-independent-review.md) accepts bounded motion; historical art, not replacement acceptance for the full film |
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

## Reproduce current candidates

Preparation and scene generation write their declared output directories. Run
them only when creating the intended candidate; preserve frozen packages,
generated source and reviewed films before regeneration. Rendering an existing
manifest to a new output filename leaves its source evidence intact.

For example, generate and render the current graph proof:

```sh
node shared/animlib/demo/expansion/compact-frontier-3b1b.mjs
node shared/animlib/tools/render-frames.mjs data/animlib-expansion/compact-frontier-3b1b/frames.json
node shared/animlib/tools/render-video.mjs --manifest data/animlib-expansion/compact-frontier-3b1b/manifest.json --output data/animlib-expansion/compact-frontier-3b1b/new-16x9.mp4 --ffmpeg data/video-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe --width 1280 --height 720 --fps 30
```

Use the same renderer with each generated manifest from the current table.
For 4:3 use `--width 960 --height 720` and a different output filename. The frame
runner emits both aspects. Supply your installed FFmpeg path on another machine;
the example binary path belongs to this local evidence workspace.

Current proof audits are `tools/verify-science-3b1b.mjs`,
`verify-peptide-3b1b-revision5.mjs`, `verify-transcription-revision3.mjs`,
`verify-rna-processing-3b1b-revision4.mjs`, and
`verify-translation-3b1b-revision4.mjs`. They consume generated proof inputs and,
where indicated by the script, rendered native frames or films/contact sheets.
They do not replace whole-motion visual review. Peptide and transcription keep
historical-film preservation checks under the explicit `--check-archives` flag;
normal geometry/identity checks need only the current candidate.

### Optional historical preparation chains

These older proofs retain their source-specific visual presentation. The staged
peptide generator uses versioned rig/staging/polished packages; run it before the
revision-4 surface generator when reconstructing that optional chain from a fresh
checkout. No historical film is required to generate either scene.

| Candidate | Preparation and generation after build | Generated manifest / frame request under `data/animlib-expansion/` |
| --- | --- | --- |
| Peptide staged revision 3 | `node shared/animlib/demo/expansion/peptide-staged-proof.mjs` (requires existing illustrative rig, polished assets and staging) | `biological-motion-revision3/peptide-manifest.json`, `peptide-frames.json` |
| Peptide surface revision 4 | `node shared/animlib/tools/prepare-peptide-surface-revision4.mjs`, then `node shared/animlib/demo/expansion/peptide-surface-revision4-proof.mjs` (requires preserved revision-3 source/manifest) | `biological-motion-revision4/peptide-manifest.json`, `peptide-frames.json` |
| Transcription revision 2 | `node shared/animlib/tools/prepare-transcription-revision2-assets.mjs`, then `node shared/animlib/demo/expansion/transcription-cycle-revision2.mjs` | `transcription-cycle-revision2/cycle-manifest.json`, `cycle-frames.json` |
| RNA processing revision 2 | `node shared/animlib/tools/prepare-rna-processing-revision2-assets.mjs`, then `node shared/animlib/demo/expansion/rna-processing-revision2-proof.mjs splice` and the same command with `pore`; requires transcription revision-2 context packages | `rna-processing-revision2/splice-manifest.json`, `splice-frames.json`; `rna-processing-revision2/pore-cut/pore-manifest.json`, `pore-frames.json` |
| Translation revision 3 | `node shared/animlib/tools/prepare-translation-revision3-assets.mjs`, then `node shared/animlib/demo/expansion/translation-revision3-proof.mjs` | `translation-revision3-proof/manifest.json`, `frames.json` |

For example, render an existing transcription revision-2 candidate without
overwriting its reviewed film:

```sh
node shared/animlib/tools/render-frames.mjs data/animlib-expansion/transcription-cycle-revision2/cycle-frames.json
node shared/animlib/tools/render-video.mjs --manifest data/animlib-expansion/transcription-cycle-revision2/cycle-manifest.json --output data/animlib-expansion/transcription-cycle-revision2/cycle-new-16x9.mp4 --ffmpeg data/video-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe --width 1280 --height 720 --fps 30
node shared/animlib/tools/render-video.mjs --manifest data/animlib-expansion/transcription-cycle-revision2/cycle-manifest.json --output data/animlib-expansion/transcription-cycle-revision2/cycle-new-4x3.mp4 --ffmpeg data/video-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe --width 960 --height 720 --fps 30
node shared/animlib/tools/verify-transcription-revision2.mjs
node shared/animlib/tools/verify-rna-processing-revision2.mjs
```

The two verification scripts check their own existing proof inputs; they do not
grant visual acceptance. Whole-duration ordered motion inspection, selected
native frames in both aspects, full media decoding and independent style review
remain separate evidence.

## Reviewed artifacts and open limits

Paths below are relative to repository root. The independent
[motion review](../../../../docs/animlib-expansion/motion-visual-review.md) is the
authority for these exact releases:

| Artifact | SHA-256 | Reviewed scope |
| --- | --- | --- |
| `data/animlib-expansion/matrix-frontier/matrix-transport/film.mp4` | `e8d14f1c500e209eddaf106fae7a009ba6d07e0aa4ec5d1cac0821cd323c8310` | Column-to-sum-to-row reasoning, readability, reference operation and technical delivery ready |
| `data/animlib-expansion/frontier-revision2/film.mp4` | `c18226864f3a105714874f3f9e0bad261e3be56e53d017bea9852543d0fb2415` | Representative general insertion/reorder ready; separate current compact-frontier proof has its own independent review |
| `data/animlib-expansion/neural-proof-r2/film.mp4` | `89b32212ef7108b56085f6d792e45919697901077e3323af54723c5716153ba2` | Representative synthetic projection ready; different data/path, timing and camera from source |

The [round-2 review](../../../../docs/animlib-expansion/visual-evaluation-round2.md)
records bounded shear, final repaired graph, logistic and optimized Artem passes;
their exact export hashes are in
`data/animlib-expansion/revision2/evaluated-film-hashes.json`.
Historical first-release neural/frontier films were superseded, not accepted
as final source-style matches. The [biological motion report](../../../../docs/animlib-expansion/biological-motion-report.md)
records author verification. Later independent peptide revision-3 and
transcription revision-2 reviews accept their bounded mechanisms/readability,
while keeping reference style open. See the [current acceptance table](../../docs/expansion-index.md#latest-independent-acceptance-and-current-candidates)
before treating a biological candidate as accepted.

Native MSAA can produce tiny pixel differences; exact CPU stream parity does
not close that GPU issue. No film claims physical folding dynamics, recovered
neural manifolds, atomistic RNA chemistry or arbitrary-font support. Public
helpers remain style-neutral. Current scenes share mathematical visual principles,
not one fixed presentation template; historical artist contracts remain research.

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

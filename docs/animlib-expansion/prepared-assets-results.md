# Prepared scientific assets: structure and measured proof

## Storage and retrieval

The catalog remains an editable three-tier system: specific resources, reusable
techniques, and general foundations. Small manifest shards contain searchable
metadata and bounded reuse contracts; detailed Markdown and runnable recipes load
only when requested. Molecular contracts name applicable/excluded claims, required
inputs, preparation route, motion limits and fallback construction. Discovery is
not a scientific approval. A 128-entry/1 MiB document LRU rechecks containment and
file signatures; full detail, provenance and model-response budgets are preserved.

Prepared molecular geometry lives outside catalog documents, prompts and scene VM:

1. Raw PDB/CCD downloads retain source hashes in `MOLECULAR_MODEL_CACHE_DIR`
   (default `data/molecular-model-cache`).
2. `prepared/` holds immutable GLBs and identity-bound context envelopes, addressed
   through atomic manifests. Keys include converter version, accession, exact
   chains, source hash, CCD hashes and explicit representation. Corrupt/incomplete
   entries rebuild. Reads and resident memory are bounded; callers receive copies.
   Canceling one waiter cannot cancel another caller's shared preparation.
3. Published geometry is shared by GLB SHA in `MODEL_ASSET_DIR` (default
   `data/models`). Scientific publication references preserve their own immutable
   context even when two representations happen to produce identical geometry.

Persistent disk artifacts are retained; there is no automatic disk quota or
garbage collector. Raw source caches do not claim automatic upstream refresh.
New converter versions and changed input hashes cannot reuse an old preparation.

## Scientific control

`publish_model({pdbId, pdbChains?, pdbRepresentation?})` is available in both video
and lecture pipelines. `mixed` remains the default: protein CA traces and nucleotide
heavy atoms with CCD-derived bonds. Explicit `backbone` retains every selected
deposited CA/P anchor with gap-aware traces; it supports whole-complex spatial
questions, not atomic contacts. There is no automatic reduction to fit a budget.

`s.rigidMotion` supplies deterministic pivoted translation/rotation, named-subunit
control and matching landmark transforms without rebuilding geometry. Arbitrary
seeks reproduce the same state. Keyframes require illustrative/supplied provenance.
This is not an MD solver: flexing, folding, chemistry, measured trajectories and
biological assembly transforms still require appropriate data/builders. An
unsuitable cached asset must be replaced or composed from suitable resources.

## Measured 1JJ2 proof (2026-10-14)

Source: [RCSB 1JJ2](https://www.rcsb.org/structure/1JJ2), deposited large ribosomal
subunit. This is not a complete functional ribosome. The explicit backbone includes
6,567 retained CA/P anchors across 30 chains, 31 model parts and 78,276 triangles.
No anchor subsampling. GLB size: 2,842,928 bytes.

| Operation | Observed time |
|---|---:|
| Prepare geometry with raw sources already cached, converter v4 | 626 ms |
| Reuse persisted preparation in a fresh process | 146 ms |
| Subsequent prepared-memory reuse, including source verification | 89–94 ms |
| Final publication, including immutable 10.5 MiB scientific provenance | 437 ms |
| Compile original proof scene | 74 ms |
| Sample 181 scene states | 90 ms total |

Persistent preparation was approximately 4.3× faster than rebuilding from cached
raw sources in this run. These are single-machine observations, not latency SLAs,
GPU FPS, or end-to-end AI/video generation speedups. Model publication, LLM work,
native rendering and mandatory review remain separate costs.

Geometry SHA-256 before/after reuse:
`eb548749ef0ab020f09be846855ba03d7d25610f9ce0eb5828c132bb80b2f4fa`.
Source SHA-256:
`f3eeb133fedd51dfb3d98b50c338c76bb1e7c5474416744eccd8862a7b7308bb`.
Default 1CRN mixed output also matches pre-change commit `fccafee` byte-for-byte:
`07de0790d2660c441c9cad272c71f8549b20becd31bb7fccd8f38abfe088ba17`.

The native proof moves L2 illustratively, retaining a 38.215 Å distance between
two deposited CA sites. It shows labelled 38.2 Å, preserves shared coordinates,
and holds both endpoints. Other chains remain as subdued spatial context.
Independent review inspected 24 decoded samples at 4 fps plus full-size 16:9 and
4:3 frames. A visibility revision made both site markers explicit. Final verdicts:
reasoning, readability, reference style and technical delivery all ready within
this capability-proof scope. Continuous 30 fps playback was not independently
inspected. Full MP4 decoding passed: silent H.264, 1280×720, 30 fps, 180 frames, 6 s.
Final scientific-publication identity changes reproduced all reviewed PNG hashes.

Verification: 1,154 animation tests and 423 backend tests passed. Animlib and
backend type checks passed; frontend production build passed. Independent code
review's provenance-aliasing and resource-contract findings were corrected and
re-reviewed. Compiler, geometry budgets and mandatory native review remain intact.

## Reproduction

From repository root after installing dependencies:

```powershell
npm run build
.\node_modules\.bin\bun.cmd backend/scripts/benchmark-prepared-molecules.ts .tmp/prepared-assets-proof/large 1JJ2 backbone
# Run the same command again in a new process to measure persistent reuse.
.\node_modules\.bin\bun.cmd backend/scripts/prepared-molecular-proof.ts .tmp/prepared-assets-proof/large
node shared/animlib/tools/render-video.mjs --manifest .tmp/prepared-assets-proof/large/manifest.json --output .tmp/prepared-assets-proof/large/rigid-l2.mp4 --ffmpeg C:/path/to/ffmpeg.exe --width 1280 --height 720 --fps 30
```

Benchmark output includes publication cost separately. Native rendering requires
the existing WebGPU runtime/GPU. The local proof and benchmark JSON files are
generated artifacts; source scripts and this report are versioned.

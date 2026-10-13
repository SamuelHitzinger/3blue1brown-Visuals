# Interdisciplinary authoring and retrieval results

Measured locally on Windows, 2026-10-14. This continuation expands the existing
animation library and authoring pipeline; it does not add another renderer or
relax scientific, scene, or rendered-review checks.

## Delivered scope

- Catalog grows from 15 to 31 records: 14 discipline techniques and two
  reference-only data sources. Techniques cover fields, waves, mechanical modes,
  dynamical systems, signals, optics, circuits, elastic deformation, probability,
  reactions/transport, ecology, orbital motion, terrain, and neural event rates.
- Four bounded scientific-state constructors serve both hosts and the actual
  scene VM: `modalState`, `conservativeTransport`, `complexInterference`, and
  `eventRates`. They compute supplied mathematical models; they do not infer
  measurements or solve arbitrary mechanics, chemistry, or quantum systems.
- Stable IDs, normalized token postings, alias/plural matching, and domain /
  readiness filters support discovery. Model search replies contain compact
  summaries under 12,000 UTF-8 JSON bytes; details retain complete scientific
  limits under 28,000 bytes. HTTP clients still receive full metadata.
- Worked examples move to immutable, bounded reference tools shared by
  authoring, independent review, repair, and regeneration. Core API, scientific
  signatures, craft guidance, delivery contracts, and quality gates stay injected.
- Lecture authors can submit an inspected candidate ID rather than repeat its
  full source. A four-entry per-job validation cache invalidates with model asset
  changes; failed checks and aborted work are never reused. Logs report aggregate
  usage/timing without lecture text or generated source.

Catalog readiness means a supported construction or documented source route.
JPL Horizons and USGS elevation records are reference-only: no downloader,
parser, or prepared scientific dataset is implied. The four runnable seeds are
starting constructions, not approved complete explanations.

## Context and retrieval measurements

`bun backend/scripts/benchmark-authoring-context.ts` reconstructs every section
through 1,000-character pages and checks exact equality without model requests.

| Current reference measure | Characters |
| --- | ---: |
| Complete authoring API with embedded worked examples | 191,606 |
| Injected API with recipe indexes | 129,196 |
| Removed from every author prompt | 62,410 (32.57%) |
| Verbatim content available across 27 on-demand sections | 79,187 |

Both API variants include the new scientific signatures. The compact loader
also indexes the standalone scientific guide and four canonical JavaScript seeds,
which were not embedded in the complete baseline. Character reduction is not a
tokenizer measurement or a claim about model latency. Reference hashes keep
same-size documentation edits visible to instruction fingerprints.

`bun backend/scripts/benchmark-catalog.ts` expands the 31 real metadata records
into 10,000 synthetic records. One local run built the index in 202.34 ms with
approximately 39.95 MB additional heap. Process RSS increased approximately
128.54 MB; these observations are not production capacity guarantees.

| Query | Matches | Indexed median | Previous scan median |
| --- | ---: | ---: | ---: |
| Unique synthetic topic | 1 | 0.0068 ms | 3.4464 ms |
| Wave interference | 322 | 0.0772 ms | 3.8145 ms |
| Physics | 3,226 | 0.3985 ms | 3.5853 ms |
| No match | 0 | 0.0015 ms | 3.5057 ms |

The corpus is repeated synthetic metadata, not 10,000 scientific recipes.
Ranking now uses term coverage and explicit aliases rather than substring OR
matching, so result sets can differ. File I/O, model calls, rendering, and visual
review are excluded. Broad queries still scale with matched postings; bounded
responses alone do not make index memory or construction constant.

## Scientific preparation and playback costs

After `npm run build --workspace animlib`, run
`node shared/animlib/tools/benchmark-scientific-state.mjs`. Node v24.15.0 on this
Windows host reported these warm medians across five rounds:

| Construction | Prepare once | Repeated evaluation |
| --- | ---: | ---: |
| Modal state, 16 modes × 32 coordinates | 0.01774 ms | 0.002372 ms |
| Transport, 32 nodes / 128 edges / 128 steps | 0.05432 ms | Step 64: 0.000949 ms |
| Complex interference, 32 waves | 0.01696 ms | 0.001206 ms |
| Event rates, 8 channels × 40 events × 321 times | 0.68510 ms | Stored sample: 0.00009375 ms |

Replaying transport to step 64 cost 0.02205 ms (~23× the prepared lookup).
Reconvolving event rates at an exact sample knot cost 0.002137 ms (~23× the
prepared sample). Off-knot sampled-state interpolation is not mathematically
identical to reevaluating a Gaussian estimate, so that comparison deliberately
uses exact knots. These are CPU microbenchmarks, not GPU FPS or generation times.

## Original rendered proof

Run `node shared/animlib/demo/expansion/coupled-modes-proof.mjs [output-directory]`.
The default destination is `.tmp/interdisciplinary-proof`. The script validates
the scene, checks settled text overlap, samples forward and backward, and uses
the production native WebGPU renderer at both 1280×720 and 960×720.

The eight-second original coupled-mode construction has 71 elements and 4,141
source characters. Its SHA-256 is
`79307e58f1eccf3b2a12283c293c81727563931ce409be5d0d1dee0e7c23b8eb`.
One local run measured 60.25 ms cold compilation and 22.50–24.45 ms subsequent
compilations. Three 241-frame CPU sampling passes took 413–430 ms. Twenty-four
native frames were rendered; these sample timings do not measure rendering FPS.

Tests verify modal displacement addition, spring attachment, repeated and reverse
seeks, and the supplied oscillator model's energy invariant. The proof visually
explains component addition, not an energy derivation. Independent inspection of
actual approved reference images and native frames passed all four gates within
the [review's stated scope](interdisciplinary-independent-review.md). Final encoded
movie delivery and uninterrupted full-motion reference similarity remain unverified.

## Verification and practical limits

The final complete suites passed: **1,148 animlib tests, 387 backend tests,
and 100 frontend tests**. Both TypeScript checks and the production application
build passed. The Windows filesystem sandbox caused Vite `realpath` EPERM on
an existing file; the unchanged build passed with normal local filesystem access.
The existing large-chunk bundle warning remains.

The numerical helpers have invariant, mutation-isolation, work-limit, actual-VM,
recipe-compilation, and seek tests. Catalog tests cover real interdisciplinary
queries, aliases, IDs, links, filter validation, byte-budget pagination, and
scientific limitations. Reference tests prove exact reconstruction, unknown-ID
rejection, bounded windows, fenced headings, snapshot fingerprints, and tool
propagation through the existing pipeline. Independent code review found no
blocking defects in the completed expansion.

These checks establish the delivered scope. They do not guarantee every future
generated film will match a reviewed example. Existing independent rendered
review and repair remain mandatory, and large external data still requires
explicit host preparation with provenance.

## Live generation timing check

One real configured OpenAI Codex `gpt-6-astra` run used the same synthetic
volume-preserving shear request as the preceding baseline, not private lecture
material. The complete authoring/native-render/review path took **318.22 seconds**
versus the prior **301.4-second** sample. This comparison does **not** demonstrate
an end-to-end speedup; one stochastic run cannot separate provider latency,
scene complexity, and revision decisions.

Authoring took 300.61 seconds over eight provider calls (292.32 seconds provider
time). Reported author usage was 60,768 input tokens, 293,120 cache-read tokens,
and 13,474 output tokens. Four candidate validation attempts included one failed
check before success. The final response was a 29-character candidate reference;
its cached final validation took 0.0102 ms. Independent native visual review then
approved the 12-second scene in one round, taking 15.12 seconds. Scene source
SHA-256: `81c4368f5bec57d6f670247c5cd7fc6d4c93085662fb8dde0a0a455f842bcec1`.

This live process started before the additional five standalone scientific
reference entries were wired into the loader. It exercised compact existing
recipes, catalog navigation, validated-reference completion, caching, and the
unchanged mandatory native review. The final 27-section loader was independently
verified by exact retrieval tests and the context benchmark above. Current limits:
model authoring and revisions remain the dominant delay; faster scientific
preparation and a smaller prompt alone do not make live visual authoring instant.

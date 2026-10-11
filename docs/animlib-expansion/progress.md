# Expansion ledger — plan: docs/animlib-expansion/plan.md

## Baseline

- Branch `amilibsam`, commit `2b666eb`, initially clean.
- `npm run typecheck --workspace animlib`: pass.
- `npm run build --workspace animlib`: pass.
- `npm run test --workspace animlib -- --reporter=dot`: 37 files, 664 tests pass.
- Default Windows sandbox temporary path caused ENOENT before test execution.
  Set process-local TEMP and TMP to the existing workspace directory
  `C:\Users\samue\Stuff\3yellow3white\data\animlib-expansion\tmp` for verification.
  No production or test configuration changed to address this environment issue.

## Active wave

| Agent | Model / effort | Ownership | Status |
|---|---|---|---|
| molecular_builder | gpt-6-astra / high | peptide torsion poses, RNA emergence and biological motion proofs | motion implementation and native proofs |
| math_frontier_builder | gpt-6-astra / high | matrix term transport, identity-preserving frontier permutations | native proofs and author verification |
| neural_trajectory_builder | gpt-6-astra / high | sampled state and linked traces/vector/spatial trajectory | native proof and author verification |
| root | orchestrator | design, source evidence, integration, review scheduling | independent input audits and next review wave |

## Decisions

- User authorization includes sustained implementation and independent iteration;
  additional routine design approvals would obstruct the requested orchestration.
- Keep shared branch and assign distinct owned files; serialize commits at root.
- Investigators record supported observations and limits rather than invent fidelity.
- User clarified channel identity: Visually Explained (linked channel) only.
- Planning baseline committed locally as `6415bfa`; .git required sandbox
  escalation, which automatic approval accepted. No remote operation performed.
- Initial CPU geometry benchmark (30 frames, GPU calls mocked): linear algebra
  median/p95 1.49/3.53 ms; organic chemistry 0.20/0.76 ms; sorting 0.12/0.53 ms;
  interactive views 0.26/0.41 ms. These are diagnostic host measurements only.

## Preflight boundaries

| Pair / task | Shared interface | Resolution |
|---|---|---|
| Reference workers | evidence/report schema only | Separate files and browser tabs. |
| Asset / domain workers | native geometry and scene input | Pin interfaces in follow-up briefs before code. |
| Domain / export workers | absolute-time scene evaluation | Export must use production retained evaluation. |
| Implementation / evaluator | original source, renders, reference evidence | Separate author and visual reviewer. |

Infrastructure export repair is complete and independently reviewed. Domain
helpers remain pending integrated rendering and independent acceptance. Broad
reference coverage and artist fidelity remain open; no whole-library parity claim.

## Native GPU baseline

`npm run test:gpu --workspace animlib` before implementation: 143 pass, 4 fail.

- Two recovery cases force Vulkan and fail because Vulkan adapter is unavailable.
- Material/texture retained-versus-rebuilt pixel equality fails at control 0.1,
  time 1.5 in `gpu.smoke.ts:376`.
- Identical translucent arrow3D morph pixel equality fails at opacity 0.45,
  time 1.000001 in `gpu.smoke.ts:715`.
- Default native adapter works; external-sandbox adapter probe also succeeds.
  These are baseline findings, not introduced by expansion. Assign focused GPU
  diagnosis before final integrated acceptance.

## First research handoff

- math_algorithm_reference completed initial report. Dense local Euler samples,
  targeted creator screenshots/playback, explicit sparse-coverage limits. Broader
  creator motion coverage remains outstanding.
- infrastructure started: `infrastructure-brief.md`. Sampling API agreed:
  `withOfflineScene(source, input, use, limits?)`, sampler has `scene` and
  `sample(time = scene.duration): Frame`; scope includes asset architecture audit.

## Implementation and review handoff

- `85be910`: initial reference reports and implementation boundaries committed.
- `be2755a`: native exporters now evaluate retained absolute-time motion through
  scoped `withOfflineScene`; six regressions, total 670 tests passed at that
  snapshot, typecheck/build passed. Native three-frame and 24-frame video proof.
- Independent infrastructure reviewer: spec ready, code quality ready, no
  blocking findings; viewed both native sheets and all 24 decoded MP4 frames.
  Asset proposal needs explicit image storage and shared geometry resolver
  contracts before implementation. See `infrastructure-review.md`.
- Molecular source report completed. Sticks, sequence-colored beads, folded
  sticks and smooth surface are observed in Protein Folding; ribbons are inferred
  extension only. Transcription and Nucleus remain separate cinematic styles.
- Math/graph/collection host helpers and molecular ordered-backbone/kinematic
  helpers now exist in disjoint modules. Production API and moving connector
  midpoint regressions intentionally await path_engine integration.
- Root extended transcription evidence with complete, decoded readyState=4
  frames at 2 fps from 94.033 seconds onward. Initial seek-slider captures with
  clipped frames were excluded; player-container frame stepping fixes framing.
- Follow-up completed sampled transcription chronology: 329 valid complete frames
  at nominal 2 fps across 0–163.533 s; all contact sheets viewed, final unready
  sample excluded. Whole-sequence requirements in `transcription-motion-supplement.md`.
- Public domain scene APIs installed by path_engine; root build and molecular
  `--integrated` generation passed. Re-rendered 28 molecular frames and 240-frame
  MP4 through public methods. Three math proofs rendered at both aspect ratios,
  plus native 30 fps MP4s (shear195, graph210, collection120 frames).
  Initial root QA found literal `quad` in graph label; independent domain review
  also identified numerical/immutability/orientation issues. Acceptance pending.
- All commits remain local on `amilibsam`; no push or merge.

## Candidate snapshot and next wave

- `3370559` freezes the reviewed-candidate input before image work: public
  math/graph/collection/molecular helpers, retained path points, stroke reveals
  and dashes, explicit line midpoint attachment, immutable model registry and
  prepared native asset packages. Root typecheck/build passed at that snapshot;
  repair worker's full suite passed759/759 tests across50 files.
- Separate repair worker addressed all six domain review findings, plus added
  bounded bead detail and private template reuse. Independent rereview is active;
  author tests are not acceptance.
- Eight licensed Suzanne instances render from315 characters of scene code.
  Instrumented GPU submission shares one mesh upload and one draw; these are
  upload/draw counts, not a measured frame rate. Geometry-only source limitations
  remain explicit. Actual RGBA8 images and UV0 support are active work.
- Science author delivered distinct Artem and Visually Explained proof clips,
 7.5s and7s, with custom palettes, two numerical correctness tests, both-aspect
  native frames and87 inspected decoded motion samples. Root has not yet assigned
  independent visual acceptance. Native exporters now accept optional palettes.
- Current ownership: image_texture_builder owns image types, registry/compiler,
  rendering and image-package integration; assets_builder owns offline PNG/glTF
  conversion and licensed textured fixture; domain_reviewer reviews committed
  `3370559` without editing current shared files. Root serializes integration.
- Root GPU diagnostic establishes CPU frame and streamed draw-item equality for
  all27 combinations in three failing reactive fixtures. Repeated identical
  native GPU renders can still differ by a few color-channel values; duplicate
  readback without another draw is exact. This narrows the issue but does not
  identify the cause or justify loosening assertions. Dedicated diagnosis remains
  required; see its brief and ignored probe artifacts.
- Still pending: scientific deposited-structure reuse, nucleic mechanism helpers,
  fuller source-motion inspection, organization/performance work, GPU failure
  resolution, independent direct visual comparisons and evaluator-driven repairs.

## Image/scientific checkpoint and independent visual revisions

- `8724349` is a local `amilibsam` checkpoint: immutable image assets, UV0,
  native/WebGL samplers, bounded offline glTF/PNG preparation, source-color
  policy, scientific structure importer and pure DNA/RNA helpers. Active biology
  fixtures/proofs and organization edits were deliberately left for the next
  review. No push or merge.
- Both asset blockers from the independent3370559 review are repaired: dense
  tuple validation and decoded aggregate preflight before blob reads. A second
  independent reviewer also found/fixed previous-frame image-cache eviction
  under budget pressure. All current-frame images remain protected by the cap.
- Integrated unit suite passes841/841 in64 files with `--maxWorkers=4`;
  typecheck/build pass. Default worker contention interrupted an Artem compile
  at the existing200ms wall deadline. Runtime budgets were not increased.
- Independent native image test and four native recovery/budget checks pass.
  Root independently reran real WebGL image/recovery harness after cache repair:
 12/12 pass, including source RGB, alpha, sampling/wrapping and restoration.
  Evidence: `data/animlib-expansion/image-proof/webgl-independent-results.json`.
- Two native exact pixel-parity assertions still fail. Repeated identical frame
  renders vary slightly inside multisample rendering before resolve;1x diagnostic
  renders were stable. No production sample-count change or assertion relaxation
  was made. See `gpu-asset-review.md`; broader GPU parity is not approved.
- Root completed nominal1fps Nucleus and Protein chronology review, plus actual
  continuous playback capture of RNA growth and protein folding. Supplements
  record valid framing, exact intervals, sample limits and independent asset
  provenance. For source comparisons, root supplied29 full Artem frames,51 valid
  Reducible frames and22 full Visually Explained frames.
- Independent visual round1 inspected all seven native films across their full
  duration through ordered6fps frames and both-aspect native keyframes. Bounded
  Artem rate/vector, duplicate-value identity and texture-orientation gates pass.
  Shear, graph and residual-emphasis fixes were implemented and rendered into
  `data/animlib-expansion/revision2`. Round2 remains active; graph4:3 layout repairs
  are in progress. Schematic molecular fidelity remains insufficient.
- Current three active subagents: molecular_builder (deposited structure and
  transcription proof), visual_evaluator (independent round2),
  organization_performance (public documentation, reuse benchmarks and measured
  Artem source optimization). Root keeps all slots occupied and serializes Git.
- Remaining representative capability proofs include matrix/formula term
  transport, multi-candidate frontier reordering, neural traces to spatial
  trajectories and higher-density molecular/local folding/cinematic mechanisms.
  Passing bounded proofs does not constitute broad near-identical fidelity.

## Scientific fixture checkpoint and deeper motion wave

- `f1a86b5` checkpoints licensed biological fixtures, source-motion supplements,
  independent visual round2, revised proofs, and measured source/asset reuse
  optimizations. The branch remains `amilibsam`; all commits are local.
- Independent round2 accepted the bounded shear, discrete graph relaxation,
  residual-emphasis, and optimized Artem rate/vector proofs. Graph layout
  repairs were rerendered and checked at both aspect ratios. These verdicts
  apply to the reviewed clips, not entire channels or unimplemented mechanisms.
- Independent biological review accepted the current deposited-structure
  correspondence and schematic incorporation correctness/readability. Reference
  motion remains revise: local coil formation and global compaction, rotating
  arrivals, RNA emergence, relative machinery travel, and closer triplet framing
  require new proofs. See `biological-evaluation-round1.md`.
- Source review expanded with75 complete matrix frames at nominal1fps across
  248.999991–322.999852s and41 complete neural-trajectory frames across
  260–299.999912s. Root viewed all ordered sheets. Actual uninterrupted playback
  additionally supplied94 matrix samples at297.109278–311.022985s and178 neural
  samples at264.025364–290.096063s. All those playback samples were full-frame,
  readyState4 and playing; assigned authors inspect and document dense coverage.
- Current workers are all Astra/high. The runtime supports root plus three
  simultaneous subagents; freed slots are immediately reassigned to independent
  technical review, direct visual comparison, or the next evidenced capability.
- New motion APIs are not accepted solely on author tests. Root found sparse
  time-array validation in sampled state and sparse permutation atomicity in
  collections; workers received concrete regression cases before release.
- A prior report of missing static movie glyphs was retracted after identical
  file hashes displayed differently and raw decoded-frame comparisons showed no
  corresponding large pixel loss. Suspected image-display artifacts must be
  separated from actual encoded-frame changes before renderer fixes.
- Full reference fidelity remains open. Nucleus environment/focus, splicing,
  pore transit, and translation have explicit evidence but are not yet accepted
  library capabilities. The two native exact GPU pixel-parity failures also
  remain recorded; no assertion or production sample-count weakening is approved.
- Root integrated run at02:04:49 passes868/868 tests across69 files with two
  workers and the normal production VM limits. Typecheck/build also pass at
  that snapshot. Later scene revisions retain their focused semantic checks.
- New matrix transport passed all four independent visual gates. Neural proof
  requires closer source composition, temporal path color and a stronger orbit;
  its author is repairing those choices. Frontier revision2 now passes its
  bounded record-layout comparison after compact three-band cards, a second
  separator and sans fixed-cost text were rendered at both aspects. Exact source
  reorder easing still needs denser source evidence.
- Root repaired group ownership and failed-construction parent reservation:
  foreign handles with colliding IDs, duplicate children, and later validation
  failures now reject before reserving child membership. Three regression cases
  failed first; persistent handles and focused compiler/asset/collection suites
  passed after the repair. Independent code review remains required.

## Independent motion repairs and processing wave

- `2dc0248` is a local `amilibsam` checkpoint containing only the independently
  reviewed normal-preparation optimization and its work-count regressions.
  Root's fresh focused check passes 18/18. The paired CPU preparation measurement
  was 34.54 to 31.62 ms; independent review confirmed exact packed output and
  eliminated work, but timing varies under concurrent load. No push or merge.
- Independent review accepted the matrix transport, frontier revision2, and
  final neural trajectory revision2 bounded clips. Dense Reducible playback
  additionally establishes compact queue insertion/pop choreography, which
  still differs from the general separated-lane reorder demonstration.
- Collection preflight now covers current-scene handles, every generated ID,
  and element budgets before wrapping. Independent review found one remaining
  sparse-entry case; three failure-first regressions and dense input capture
  repair it. Root reviewed that narrow diff and reran the relevant recovery
  tests. The repair review reports 47/47 focused checks and 4,902 valid RNA poses.
- RNA emergence uses analytic whole-schedule fold rejection. Its terminal
  nucleotide retains the docked frame during pure translation, eliminating an
  onset snap. Default output, positions, links, and nonterminal geometry retain
  exact sampled compatibility; the terminal plate was deliberately rerendered.
- Four revised biology films are frozen with hashes in
  `biological-revision2-report.md`. Independent direct comparison is active.
  Bright peptide backbone staging and rounded nucleotide anatomy improve the
  earlier proofs; full source-style fidelity remains unapproved.
- Root captured 179 full-frame playing samples for splicing/pore export and
  486 for translation assembly through release. Coverage, pause/resume gap,
  observations, and source-driven acceptance are recorded in
  `nucleus-processing-motion-supplement.md`.
- New processing helpers are in active development: deterministic fragment
  cut/closure/join and exact polyline arc-distance transport through an aperture.
  Root wired their host/public QuickJS APIs with three failure-first integration
  checks. Their authored geometry tests do not replace pending independent
  technical and visual review.
- Root integrated snapshot at 02:35:35 passes **905/905 tests in 74 files** with
  two workers and normal host access for fixture realpaths. Typecheck and build
  pass at that snapshot. Existing native MSAA parity failures remain separate;
  this is not a whole-GPU-suite pass.
- Active Astra/high workers: molecular_builder (new moving reaction window),
  rna_processing_builder (splicing/pore helpers and proofs), and
  biology_revision_visual_reviewer (four frozen film comparisons). Root handles
  shared API integration and keeps the three available worker slots occupied.
- Next source-backed gaps: moving active chemistry, stronger organic/focus
  presentation, translation attachment/transfer cycles, cell-scale staging,
  and the remaining compact queue choreography. Goal remains active.

## Source-driven revisions and optical focus

- Runtime permits three concurrent subagents plus root. All worker launches use
  `gpt-6-astra` with high reasoning, as requested. Freed slots immediately move
  to independent review or the next implementation; no main-branch work or push.
- Root integrated moving-transcription and translation factories into core,
  public types, host scenes and retained QuickJS callbacks. Each integration had
  three missing-API failures before wiring, then passed host/VM and reverse seeks.
- Independent RNA processing review viewed all twelve source sheets, sixteen
  candidate sheets and native frames. It found a finite-radius aperture defect:
  centerline-only clipping allowed spheres to hit a membrane face. The repaired
  preflight expands the slab by chain radius and bounds radial distance at both
  clipped endpoints. Root independently checked the sufficiency argument and
  reran all eleven processing/integration checks. Broader cellular staging and
  visible pre-cut loop formation remain in revision.
- Independent transcription review viewed all sixteen baseline/focus sheets and
  native frames. It found exact event-time inconsistencies from subtract/divide
  rounding. Direct comparisons against declared arrival/docking times now define
  visibility, incorporated edges and completion; root reviewed the patch and
  reran eleven focused checks including adjacent representable times. Frozen
  media predates this boundary correction and is retained as historical evidence.
  Active-site occlusion and rigid whole-RNA rotation remain visual failures.
- Real aperture accumulation now works in native WebGPU and browser WebGPU/WebGL2,
  with animated focus distance, 8/16/32 samples, unchanged zero-aperture path,
  sharp annotations and bounded resources. Independent optical/technical review
  is active. Author's complete native suite is 146/148: only the two recorded
  baseline exact-MSAA parity failures remain. No assertions were relaxed.
- Translation's first complete proof covers assembly, three mapped additions,
  A/P transfer, advance, stop, release and separation. The author is extending its
  original subunit/tunnel geometry and mapped product before independent review;
  its first sparse schematic proof is not accepted as Nucleus fidelity.
- Root's peptide revision uses offline inverse kinematics to keep four helix
  blocks side-visible, reusable instanced bead geometry, and a subdivided envelope
  derived from the unchanged compact endpoint. Meaningful pose checks caught
  loop-joint warm-start resets between keyframes; preserving those controls and
  denser early sampling repairs the transient twist. At 03:05 the three peptide
  checks plus eleven transcription checks pass. Film revision remains active.
- Current active roles: depth-focus independent reviewer, translation builder,
  RNA processing revision builder; root handles peptide and integration. These
  statuses supersede the preceding historical worker list. Full reference
  fidelity and the overall goal remain open.
- Root's 03:09:36 integrated snapshot passes **940/940 tests in 81 files**,
  followed by typecheck and build. This includes three still-active peptide
  staging checks outside the stable-foundation checkpoint. Independent focus
  review now accepts its bounded optical feature and diagnostic; biological
  mechanism/art-direction revisions remain separate open gates.

## Current revision checkpoint

- `ab5f34d` commits the tested scientific primitives, native assets, public API,
  documentation and independent optical review on `amilibsam`. No push or merge.
- All three worker slots remain filled with Astra/high: translation author,
  RNA processing revision author, transcription visual revision author. Root
  handles peptide, integration and review scheduling.
- Peptide revision 3 is frozen for independent review: two 10s/300-frame films,
  complete decodes, 160 ordered samples viewed, and both-aspect native inspection.
  `peptide-revision3-report.md` records hashes, reproduction and limits. Its tests
  preserve bonds, side-visible formation and the original compact endpoint.
- Processing formation and fixed-frame transcription extrusion are active code
  changes beyond the preceding 940-test snapshot. They need fresh focused and
  integrated verification and independent source comparison before acceptance.

## User-directed visual unification, 2026-10-11

- The user now prioritizes **3Blue1Brown art and graphing style**, with the other
  channels informing motion and animation techniques. This supersedes separate
  source-art replication gates; historical media/reviews remain intact. See
  `unified-3b1b-direction.md` for the current evaluation contract.
- All active agents were redirected. Transcription and RNA processing now build
  clean geometry-led proofs; realistic assets remain optional library capability.
  Root is restyling the accepted compact queue choreography to the same language.
- The latest complete CPU snapshot passed **962/962 tests with four workers**.
  One preceding unrestricted run hit the unchanged 200ms VM wall-clock compile
  budget under concurrent work; isolated and complete bounded-worker reruns pass.
- Independent translation review found and reproduced exact-event rounding bugs.
  Absolute event comparisons now drive flags and phases. All22 translation tests,
  including independent adjacent-double host/VM, continuity and reverse checks,
  pass; typecheck/build pass. Frozen pre-repair media stays historical.
- Peptide revision4 adds bounded host-only multipart envelopes, continuous surface
  coloring and a verified held-pose cache optimization; independent technical
  review is finishing. Its prior source-art goal is no longer the default target.

- 04:03 integrated checkpoint: **972/972 tests in 87 files**, four workers;
  typecheck and build pass. Peptide revision-4 independent technical/motion review
  is complete, including legacy equivalence, shared part attributes and cache
  parity. New compact-frontier, transcription and RNA clean visual films are
  frozen for independent comparison. Authors continue unified translation and
  peptide proofs while the reviewer evaluates those three handoffs.

## Unified visual closure and reproducibility

- `63c9472` commits compact queues, bounded multipart preparation and the tested
  processing/transcription/translation refinements on `amilibsam`. No push or merge.
- Independent reviewers accept all current compact-frontier, three scientific
  plots, peptide, transcription, two RNA processing and complete 43-second
  translation proofs. Together with the prior mathematical shear and matrix
  proofs, eleven representative scenes pass the current visual direction.
  `final-visual-coverage.md` distinguishes directly inspected and inherited
  independent evidence; all claims retain their explicit operation boundaries.
- Peptide review found and repaired a small camera-height drift during the fixed
  hold. Fresh films, native frames and all ordered sheets passed reinspection.
  Translation passed full-film inspection, 1413 independently sampled times,
  22 focused tests and both complete 1290-frame decodes.
- Six current generators reproduced in an isolated empty generated-data workspace.
  All 20 generated scene and manifest files were byte-identical to the frozen
  candidates. RNA/transcription now use versioned inputs; old film-preservation
  checks are explicit `--check-archives` options. No current generator needs an
  old exported film. Detailed reproduction evidence is in the capability audit.
- Metadata audit found 44 unique native biological packages and 803 valid binary
  references, with declared sizes and fixture-root containment intact. This is
  a metadata/path audit, not a new geometry decode or comprehensive hash audit.
- Public navigation now leads to the unified mathematical examples and reusable
  motion guide. Historical realistic assets remain optional and clearly labeled.
  Final checkpoint includes new source, inputs, preparation tools, fixtures and
  independent reports so these paths remain reproducible from repository files.

- `d272ffd` saves that reviewed source, asset, input and evidence checkpoint:
  716 files, still on `amilibsam`, with no push or merge. The independent final
  library and visual reviewers accept the documented scope. Post-checkpoint
  integration verifies tracked prerequisites and records final navigation status.

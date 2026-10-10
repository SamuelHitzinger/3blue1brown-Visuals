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
| molecular_builder | gpt-6-astra / high | molecular-backbone modules, tests, proof | core tests pass, proof in progress |
| math_builder | gpt-6-astra / high | diagrams modules, tests, proofs | core tests pass, integration regressions pending |
| path_engine | gpt-6-astra / high | shared path engine and helper integration | implementing pinned APIs |
| root | orchestrator | design, plan, progress, integration | reference coverage and next asset wave |

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

# Animation authoring efficiency

## Authorized outcome

The user requested implementation and continued benchmark-driven improvement of all five architecture goals, using subagent swarms: less repetitive and error-prone scene JavaScript; fast asset, motion and data reuse; automatic speech/animation scheduling; a strong first visual review instead of long repair loops; and focused scene/style prompts. Keep the full goal active until production integration and representative rendered evidence support all five goals.

The user subsequently required a new branch from the latest lecture visual catalog and regular commits/pushes. Branch `codex/animation-authoring-efficiency` starts from fetched `visuals/codex/lecture-visual-catalog` at `fba95bd`. Commit `6d9798e` separately checkpoints inherited lecture changes. Push milestones to `visuals`.

## Architecture

Retain animlib, its scene VM, custom JavaScript and existing scene formats. Add an additive hybrid authoring layer: reusable compositions and named chronological operations lower to existing sequential timeline operations. A compact host-owned scene brief connects plan, entities, narration, assets and evidence. Authors choose geometry and explanatory operations; host computes exact timing and common bookkeeping.

The same scene/object/cue identities must survive planning, scheduling, rendered evidence and repair. Preserve measured narration and saved jobs. Reject infeasible schedules with useful diagnostics rather than silently shortening motion or changing audio.

## Workstreams and contracts

### A. Authoring and timing

Add `s.compose` for named parts with scoped IDs, an ordinary group, addressable handles and custom constructor escape hatches. Add `s.schedule` to resolve chronological action windows against host narration, insert waits, run concurrent actions within a window and finish at the measured duration. Preserve direct s.play/s.wait use. Reject backwards/overlapping windows rather than changing authored start states. Preserve absolute-time seek determinism and existing carry semantics.

Extend host timing with immutable utterance/pause/named-cue accessors. Add an optional planned `speechCues` array with stable id, exact spoken phrase, optional occurrence and utteranceId. Resolve phrases to measured word spans before authoring; repeated ambiguous phrases, unknown cues and bad matches must fail visibly. Punctuation/case normalization must not merge distinct numeric/word meaning. The author refers to a named cue, not manually copied timestamps. Legacy plans without cues remain valid.

### B. Resource resolution

Extend existing catalog, rather than duplicate it. Exact required capability filters must never return incompatible items. Return bounded usable resolution packets with ready/preparation/input/unsupported status, real package references, provenance, limitations and required inputs. Existing scientific construction seeds remain retrievable, versioned code/data; they are not measured simulations. Existing prepared artifact cache remains canonical. Reuse bundled conversion bytes by content identity. Resolve supported molecular preparation through existing publish callback, so successful references really belong to the current job.

Static glTF support does not imply skeletal clips or morph targets. Explicitly report unsupported animated assets. External data reference records do not become ready data until a real host ingestion route exists. Add further routes based on benchmark evidence, not fabricated URLs or source claims.

### C. Visual verification

Normal path: one comprehensive verification; if rejected, one targeted repair and verification. Default maximum two visual reviews. No repair after final rejection. Bound malformed protocol retries independently and terminate exhausted visual work with RECOVERY_EXHAUSTED so durable recovery cannot restart forever. Preserve exact-source approval and mandatory rendered verification.

Choose evidence from operation boundaries/interiors, camera risk, holds, prior defects and global coverage. Bound samples at 16; explicitly communicate partial coverage. Include selected native frames in addition to contact sheets for fine detail. Retain both delivery aspect ratios. Detect repeated source cycles and repeated demonstrated findings conservatively for larger explicit caller budgets. Never infer a pass from missing evidence.

### D. Focused instruction assembly

Derive one compact scene brief from approved plan and measured packet: claim, visible operation, stable objects/color roles, named speech anchors, end state, carry/cleanup, interactions and source limits. Author/reviewer consume the same brief. Keep actual previousFrame authoritative.

Keep core API and style contracts available; select relevant advanced API sections from actual scene needs and retain bounded lookup for every deferred section. Preserve exact content and fingerprints; unknown needs fall back to full context. Avoid keyword-only deletion of requirements. No rule that shorter prompts alone constitute improvement.

### E. Measurement and improvement

Keep raw failures and outcomes. Benchmark code/source versions, fixtures and settings. Baselines must precede candidate mutations where causal comparison needs them. Deterministic equivalence tests are not visual quality evidence. Mocked reviewers prove control flow, not defect detection.

| Goal | Initial acceptance target | Evidence |
| --- | --- | --- |
| Less JS | At least 30% reduction in timing/composition boilerplate on three equivalent fixtures; no changed sampled frames | Paired source fixtures, byte/expression counts, compile/seek comparison |
| Resource reuse | Zero falsely compatible results; top-3 covers all supported curated intents; repeated/concurrent preparation runs producer once | Actual catalog queries, statuses, hashes and producer counts; cold/warm p50/p95 |
| Speech matching | All declared anchors resolve to exact measured spans; no manual timestamp arithmetic in new schedule fixtures; reject ambiguity and impossible windows | Repeated words, pauses, reveals, retiming, overlap, duration and handoff tests |
| Review efficiency | Clean candidate one review; corrected candidate at most two; no publication on exhausted rejection; seeded risk interiors covered | Host protocol tests plus independent native-frame/reviewer benchmark |
| Prompt efficiency | At least 25% smaller selected API context on applicable 2D cases with all required APIs preserved/retrievable; no weakened quality contracts | Assembly tests and paired model generation with frozen narration |
| Overall | Representative generated scenes preserve visual reasoning while reducing time to approved scene and output tokens | At least three domains, fixed input/settings, raw per-run metrics, native render inspection |

Targets are experiment gates, not assertions of achieved speedups. If a target fails, record it, improve the relevant layer and rerun. Include both matched examples and a holdout scene. Novel geometry must remain possible and tested. A small successful mock benchmark does not complete the goal.

## Safety of integration

Root owns generator/planning/brief integration and commits. Workers have nonoverlapping ownership and do not stage or commit other work. Preserve existing auth, source access controls, runtime restrictions, asset provenance and publication rules. Never embed secrets or large geometry in prompts/source. Tests use explicit paths and local TEMP/TMP on Windows. No destructive cleanup or dependency upgrades are required.

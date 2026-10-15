# Composition and semantic scheduling — Task 1

Date: 2026-10-15. Branch: `codex/animation-authoring-efficiency`, based on inherited checkpoint `6d9798e`. Worker did not commit. Initial implementation left generator/planning/handoff integration to root; the later terminal-recovery correction below explicitly includes generator ownership.

## Implemented contract

- `s.compose(prefix, parts)` returns an ordinary group plus `get(localName)`. Primitive descriptors use scoped IDs; custom constructors receive the real scene context and exact scoped ID and must return an owned, unparented handle with that ID. Existing group, view, animation and carry rules remain authoritative. No layout or geometry is inferred.
- `s.schedule(packet, operations)` accepts full named spans (`cue:'id'`) or explicit word/utterance/pause/named-cue anchors. It resolves all windows first, rejects ambiguous timing inputs, negative/backwards/overlapping windows, pause changes, violated `notBefore` guards and durations past narration, then lowers to existing `play` and `wait`. Concurrent changes belong in one operation. The final hold reaches measured duration; direct timeline calls can precede the schedule. Returned windows are frozen.
- `SpeechCue` is `{id,phrase,occurrence?,utteranceId?}`. `occurrence` is one-based after optional utterance filtering. `resolveSpeechCues(scene,cues)` returns a record of `{id,phrase,utteranceId,wordIds,startSec,endSec}`. Matches are contiguous within one utterance; ambiguity and absent phrases fail.
- `validateSpeechCuePhrases(utterances,cues)` uses the same tokenizer before speech synthesis. Case/sentence punctuation normalize; signs, decimals, digit grouping, operators, apostrophes, alphanumeric words and superscripts retain distinctions. A late regression caught partial `H2O`/`x²`/`1e3` matching and was fixed after observing the failing test.
- `attachTimingPrelude` accepts `speechCues` or pre-resolved `resolvedCues`, verifies supplied spans against the actual words, and embeds frozen words/utterances/pauses/cues maps and throwing accessors. Existing word `start`/`end` APIs remain compatible. Saved output is standalone.
- Shared types are exported through animlib's existing type surface. Native and QuickJS installation use the same self-contained authoring factory. The reference addition stays inside the existing Local timing section.

Root integration:

```ts
const resolvedCues = resolveSpeechCues(input.scene, plan.speechCues ?? []);
const source = attachTimingPrelude(rawSource, {...input, resolvedCues});
// Planning first calls validateSpeechCuePhrases(parsedSpeechBlocks, plan.speechCues).
```

## Verification

Tests were written and observed failing before the corresponding implementations. Missing API failures established the first red state; cue shorthand and compound-word matching each had separate failing regressions.

All Windows test commands set `TEMP` and `TMP` to the existing `backend/.tmp` directory. Explicit Bun paths prevent accidental discovery in historical data trees.

| Check | Observed result |
| --- | --- |
| `npm run test --workspace animlib -- test/authoring.test.ts test/authoring-recipes.test.ts test/diagrams-production.test.ts test/compiler-bootstrap.test.ts test/runtime-group-ownership.test.ts` | 40 tests passed, 5 files |
| `bun test ./backend/test/speech-cues.test.ts ./backend/test/timing-prelude.test.ts` | 9 tests passed before the additional compound-word regression |
| `bun test ./backend/test/speech-cues.test.ts --test-name-pattern 'alphanumeric\|pre-speech\|resolves punctuation\|requires explicit'` | Final tokenizer regression: 4 passed, 1 filtered out |
| `npm run typecheck --workspace animlib` | Passed before the subsequent cue-shorthand addition; root should include final combined typecheck |
| Backend typecheck during parallel implementation | Failed only in in-progress resource/review ownership files; no Task 1 diagnostics. Not claimed as passing. |

The authoring tests exercise real native and VM builds, custom parts, invalid IDs, exact action windows, concurrent actions, explicit pause/reveal guards, inherited groups, missing cues, backwards sampling, and preflight before timeline mutation. The speech tests exercise repeated phrases, utterance scoping, numeric distinctions, measured retiming and nested immutability. Older word accessor tests still pass.

A complete suite run was deliberately deferred at root's request while model benchmark timing was active. No full-suite pass is claimed. Initial discovery tests without local TEMP/TMP encountered sandbox `EPERM`/`ENOENT`; the local-temp focused tests above replaced those environment-limited observations.

## Paired deterministic benchmark

Run `bun ./backend/bench/authoring-efficiency.ts`. The module also exports `runAuthoringEfficiencyBenchmark()` for aggregation. Source pairs and raw results are in `animation-authoring-benchmark/`, including SHA-256 hashes, fixed timing, all compile samples, and evaluated sample times.

The three miniature fixtures cover a search comparison, a local-change curve and schematic transport. Synthetic fixed narration isolates authoring cost; these fixtures are not measured speech, full teaching explanations, or evidence of visual quality. Both variants use the current runtime. The handwritten control uses a compact shared cursor helper rather than deliberately repeated timing code. Geometry and action expressions are identical. A baseline/candidate pair compiles identically and samples identically at boundaries, interiors, forward and backward times.

| Fixture | Total source bytes, control → candidate | Timing bytes | Timing/composition boilerplate reduction | Compile p50 ms, control → candidate |
| --- | ---: | ---: | ---: | ---: |
| Binary search | 1021 → 770 | 518 → 249 | 36.2% | 13.17 → 13.32 |
| Derivative | 1053 → 805 | 536 → 267 | 36.3% | 13.18 → 13.12 |
| Molecular transport | 1034 → 774 | 520 → 251 | 36.9% | 13.15 → 12.88 |

All three meet the 30% **boilerplate** target. Total source reduction is 23.6–25.1%, not 30%. Boilerplate excludes identical geometry-property and action-expression bytes; raw whole-source, composition and timing counts are all retained. Composition descriptors alone are slightly larger in these small scenes. Their benefit is scoped identity, ownership and reusable construction, while scheduling supplies the measured byte reduction. Candidate timing contains zero manual timestamp arithmetic; the compact baseline helper contains three expressions. Eight alternating compile trials per variant show no material compilation speed claim.

## Limits and follow-up evidence

This establishes deterministic authoring/state equivalence and explicit timing contracts. It does not establish acoustic alignment, improved generated-scene quality, better model output tokens, or end-to-end latency. Root owns those paired production/model/native-render benchmarks and independent review. `notBefore` enforces a supplied semantic guard; the scheduler cannot infer that arbitrary custom JavaScript depicts an answer. Custom JavaScript remains available and retains the existing analytical/rendered review requirements. Independent operations with overlapping windows must be combined or authored directly; the scheduler does not introduce a second timeline engine.

## Independent review correction: production numeric alignment

The independent review found a real integration gap: `alignWords` intentionally omits signs and splits decimal/grouping punctuation. Resolving from its word texts alone therefore rejected prevalidated cues such as `-1`, `1.5`, `1,000` and `50%`. The initial synthetic-word fixtures did not expose this behavior.

The correction preserves canonical alignment and saved word IDs/times. Cue matching now tokenizes authoritative `utterance.spokenText`, retaining semantic punctuation, and reconstructs exact monotone word-to-text spans. It requires every lexical character to be covered by a measured word and uses string offsets reconstructed from exact word text; provider `characterRange` array indices are never misinterpreted as UTF-16 offsets. Source text is a fallback only when `spokenText` is absent and the full mapping is exact. A provider-expanded phrase such as `sixty four` is not replaced by source spelling `64`. Partial timed words and missing, reordered or unmatched text fail rather than guessing an alignment.

Three new integration regressions were observed failing before this correction. They call the actual production `alignWords` on text containing an astral character, signs, decimals, digit grouping, percentages, hyphenated/alphanumeric compounds and repeated negative spans. They verify exact measured word IDs/times, rejection of punctuation-flattened partial matches, repeated-phrase occurrence selection, authoritative spoken-text precedence, and valid/invalid source fallbacks.

Fresh verification after the correction: `bun test ./backend/test/speech-cues.test.ts ./backend/test/timing-prelude.test.ts` with local `TEMP`/`TMP` passed **13 tests, 75 assertions**. Only `timing-prelude.ts`, the focused cue test file, and this report changed for the correction; canonical alignment generation remains unchanged.

## Whole-branch review correction: terminal cue resolution

The review found that a correct exact-match rejection could enter unbounded outer recovery: the approved source cue `64` passes planning validation, but measured provider speech `sixty four` cannot resolve that cue. Both cached inputs are immutable during scene generation, so repeating the author cannot repair this mismatch.

The generator now catches only the speech-cue resolver call and throws `AgentError('RECOVERY_EXHAUSTED', ..., {retryable:false})`, preserving the original error as `cause`. It writes `scene-N.speech-cue-error.json` with the scene/package/script identity and exact diagnostic. Unrelated narration, authoring and persistence errors retain their own handling. It never guesses a replacement anchor or edits cached narration.

The new integration regression calls the real generator with a saved approved plan, cached narration built with production `alignWords`, and the durable SQLite-backed `VideoService`. It first failed with the old `generating` recovery state. After the fix it proves one generator invocation, zero author calls or recovery waits, a terminal persisted failure, retained private diagnostics, sanitized public error text, and no restart after reopening the database.

Focused verification with workspace-local `TEMP`/`TMP`: `bun test ./backend/test/scene-timing.test.ts --test-name-pattern 'immutable narration cue mismatch'` passed **1 test, 13 assertions**; the existing `--test-name-pattern 'planned semantic cues'` successful generation case passed **1 test, 9 assertions**. No broad suite or benchmark was run during the active live timing window.

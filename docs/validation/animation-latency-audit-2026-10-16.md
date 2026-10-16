# Animation latency audit — 2026-10-16

Read-only audit of saved provider receipts and event streams. No new provider calls were made. **Completing the source/tool arguments is the largest measured stage in the original complexity screen.** Compilation and the final provider-terminal tail are much smaller. This identifies a stage to test; it does not isolate model computation from network/streaming time or prove that reducing source bytes causes a speedup.

## Measured stages

The original `data/realtime-workshop/complexity-matrix/screen-01` contains sixteen single-attempt submissions across eight tasks, using `gpt-6.1-sol` with low reasoning. Measurements below derive from each arm's `result.json` and adjacent `events.json`.

| Statistic across sixteen attempts | Median |
| --- | ---: |
| Dispatch → first observable tool-argument chunk | 4.345 s |
| First argument chunk → completed valid tool call | 9.016 s |
| Dispatch → completed valid tool call | 12.402 s |
| Completed tool call → provider terminal event | 25.93 ms |

These are **separate, nonadditive medians**, not a decomposition of one representative request. The argument-stream stage accounted for a median 67.2% of completed-tool latency when calculating each request's ratio first. Input tokens ranged from 1,481–2,411, output tokens from 675–1,591, and reported reasoning tokens from 0–276.

`toolcall_delta` with positive `chars` identifies the first observable argument chunk. It is **not true time to first token (TTFT)**: the receipts do not provide a dedicated TTFT field, and hidden reasoning can precede argument emission. Stream `start` is not a first-token measurement either. The recorded interval includes streaming and transport; it is not a pure decoding benchmark.

The original exact-source render report, `screen-01/renders-2026-10-15T23-57-56.240Z/result.json`, records successful compilation at **18.1–70.7 ms**. Thirteen of sixteen sources rendered; three failed compilation. This offline compilation measurement excludes live presentation and is not an end-to-end latency result.

## Actual creation and retained-edit observations

| Trial | Input / output / reasoning tokens | First argument | Completed tool | Provider terminal | Recorded quality |
| --- | ---: | ---: | ---: | ---: | --- |
| Sol full-caffeine creation | 2,202 / 971 / 173 | 4.729 s | 12.371 s | 12.516 s | Sampled-ready |
| Luna full-caffeine creation | 2,217 / 1,007 / 0 | 0.656 s | 7.614 s | 7.646 s | Failed: six-second duration and missing intended hydrogen reveal |
| Luna retained caffeine translation | 1,134 / 67 / 0 | 1.539 s | 1.859 s | 1.881 s | Sampled review passed; detailed geometry preserved |
| Luna joined-lecture plan 3 addition | 2,660 / 175 / 0 | 0.681 s | 1.920 s | 1.956 s | Failed explanatory quality |

Exact receipt paths, relative to the repository root:

- `data/realtime-workshop/complexity-matrix/screen-01/caffeine-full/baseline/result.json`
- `data/realtime-workshop/complexity-matrix/luna-screen-01/caffeine-full/baseline/result.json`
- `data/realtime-workshop/retained-complex-edit-probe-01/live-02/provider/result.json`
- `data/realtime-workshop/retained-complex-edit-probe-01/live-02/result.json`
- `data/realtime-workshop/lecture-join/d9d30bcb-a22a-4faf-9724-bd7a49ef563e/plan-3/provider/result.json`

Each provider receipt has an adjacent `events.json`. The retained-world receipt records **2.032 ms** native application and **1.900 s** from request entry to world commit. This was a position `WorldPatch` on an already-authored molecule, **not the new retained-parameter API**. Its separately rendered sampled review preserved all 24 atoms, 25 bonds, 29 bond strokes and fixed annotations. The seed required a declared camera-action adaptation. No browser-visible timing was measured. The earlier `live-01` receipt records a local credential-lock failure before observable payload construction; its 1.76 ms error is not provider latency.

These creation/edit observations are **not a paired causal speed comparison**. Their requested work, prompts and starting state differ; the Sol comparison also changes model and reasoning configuration. They support testing compact retained operations, not a claimed speedup ratio.

## Configuration and quality limits

All **forty successful provider receipts inspected** requested priority and reported actual tier **default**, with **zero cache-read tokens**: sixteen original complexity attempts, eight Luna complexity attempts, nine direct-source/brief/tool probes, one retained edit and six joined-lecture decisions. Thus neither actual priority service nor cache acceleration is demonstrated by this evidence. Failed local attempts are excluded from this configuration count.

Local adapter follow-up: the installed Pi 1.1.0 Codex adapter forwards
`serviceTier` as `service_tier` before the probe's inspected payload is serialized.
The probe reads raw provider events, before the adapter's separate pricing helper
maps a reported `default` tier back to requested `priority`/`flex`. That pricing
fallback is not evidence of delivered priority service. No forwarding defect was
found. The public [Fast mode guide](https://developers.openai.com/api/docs/guides/fast-mode)
says `priority` and `fast` request the same supported mode and that response tier
identifies delivery; it also documents possible downgrades. These API docs do not
establish why this subscription-backed Codex route reported default. Do not infer
account eligibility, a downgrade cause or a speed multiplier from these receipts.

The same installed Codex request builder does not emit `max_output_tokens` from
the supplied `maxTokens`; the retained-edit receipt records
`payloadSent.maxOutputTokens: null`. Therefore `maxTokensRequested` is a requested
setting, not an enforced output ceiling on this route. Timeouts, schema validation
and complete-response acceptance remain separate controls. No adapter, account
setting or dependency was changed during this inspection.

The faster Luna complexity screen completed seven of eight provider responses within ten seconds, but only the simple line passed sampled visual review. The direct-source physics and biology attempts also failed technical or explanatory acceptance despite shorter model times. The joined lecture produced five deferrals and one static addition, with no edits; fast decisions did not provide meaningful animation coverage. Short output is not a quality gate.

Existing reviews retain those distinctions: [original complexity screen](complexity-screen-checkpoint.md), [faster configuration screen](fast-config-screen-2026-10-16.md), [direct-source attempts](realtime-direct-source-checkpoint.md), [retained edit](retained-complex-edit-probe.md), and [joined lecture](lecture-join-checkpoint.md). These are sampled reviews, not blanket full-motion approval. None of the model-only timings establishes the complete ten-second input-to-useful-animation goal.

## Next experiment: parameter update versus complete-source replacement

Run a paired model experiment on the existing ten deterministic cases: sparse/dense slope, low/high-sampling wave superposition, low/high-sampling Gaussian density, 10/40-subdivision saddle, and low/high sphere-detail caffeine with all atoms and bonds retained. Begin each pair from the same reviewed native construction and request the same change. Both arms receive equivalent evidence, exact current parameter values and bounded ownership/dependency information, with the same model and reasoning settings.

- **Candidate:** emit only the retained program ID and changed numeric parameter values through a strict transaction.
- **Baseline:** emit complete replacement native source implementing the same requested change and preserving all other content.
- Randomize arm order and repeat pairs; retain every attempt and actual tier/cache metadata. Do not infer reliability from one attempt or silently repair output.
- Require correct interpretation of the requested change, unchanged unrelated content and topology, comparison with the independently expected native frames, and independent visual review. Preserve causal evidence boundaries; a deferral does not count as delivered animation. Caffeine rotation remains a display operation on a computed conformer, not chemistry or molecular dynamics.
- Measure first observable argument chunk, completed tool, provider terminal, world commit and actual renderer submission separately. Preserve the original input deadline and report failed quality gates independently of latency. Monitor hardware presentation only if actually measured.

The local [cross-subject matrix](cross-subject-visual-matrix.md) and `backend/bench/realtime-media/retained-parameter-proof.ts` provide geometry and state-preservation checks for this experiment. Their deterministic local results do not predict provider latency or establish model interpretation quality. This experiment targets the observed multi-second argument-stream stage while testing whether minimal model output preserves the full construction and requested meaning.

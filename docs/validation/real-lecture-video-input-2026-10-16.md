# Real lecture: paced audio and video input

## Scope

The supplied lecture's 15:00–16:00 excerpt plays locally at 1× beside the actual main-app live animation component. The replay sends two-second audio windows at one-second hops to ElevenLabs and an independently scheduled JPEG every five seconds to the animation author on OpenAI. It does not send the entire video in advance. This is sampled video input, not continuous video inference.

The user approved the audio and frame/transcript destinations, then explicitly requested ongoing video input. Private media, transcripts, provider prompts, and generated scene sources remain under ignored `data/realtime-workshop/` paths.

## Changes

- Capture retains at most eight original JPEGs in memory (at most 2 MB each), scoped to owner, lecture, and arrived photo source. Copies are returned; deletion/close clears them. This is a global cache, without a TTL or persistence across restart.
- Animation requests include the newest already-arrived photo even when queued speech is older. The speech cursor still advances through its original ordered batches. Frame and speech capture times remain distinct; no measured speech anchor is fabricated.
- Benchmark direct-frame mode records a receipt rather than running a caption model first. Original pixels go to the animation author. Normal capture extraction remains unchanged outside this explicit benchmark mode.
- Prompt specifies independent visual evidence, dark-canvas contrast, one readable primary construction, and reuse of existing object identities. Existing source can support edit mechanics but is not evidence of lecture facts.
- Reconstructing source diagrams is explicitly permitted. The author may isolate nodes, reveal forces, introduce illustrative axes, resolve supported components, or rotate supported spatial geometry to explain it. Explanatory motion must not assert unobserved physical motion. Live labels target 0.6–0.7 world units; a 0.3-em letter was only about 8 pixels tall at the tested view size.
- Optional server-only `LECTURE_ANIMATION_MODEL` and `LECTURE_ANIMATION_THINKING` settings allow controlled model comparisons. Defaults remain `gpt-6-luna` and `off`; priority service is requested, not guaranteed.
- Watch view separates transcript, frame receipts, and model decisions. It removes only normalized exact multiword overlap between adjacent overlapping audio windows. ASR revisions and ambiguous single-word repetition remain; original evidence is untouched.
- Native literal text now renders precomposed/decomposed German umlauts. This is not general Unicode coverage; `ß` remains unsupported.

## Preserved trials

| Local evidence directory | Result |
| --- | --- |
| `real-lecture-live-01` | Initial photo/text integration lost useful visual detail; mostly deferred, then unsupported umlaut rendering failed. |
| `real-lecture-live-02` | Actual sampled JPEGs produced truss diagrams. One initial request timed out; manual retry was used. Small crowded labels and lagging frame selection failed visual review. |
| `real-lecture-live-03` | Latest-frame context worked, but generated BLACK geometry was invisible on dark canvas. Two updates followed by repeated deferrals and a provider failure. Preserved without hand-editing generated outputs. |
| `real-lecture-live-04` | Contrast and text size improved, but the author copied two overlapping constructions and produced a static initial scene. Following request timed out; one manual retry also timed out. Label overlap and explanatory animation remain failed acceptance checks. |
| `real-lecture-live-05` | Same corrected prompt with `gpt-6.1-sol`, low reasoning, priority requested. Initial request hit the ten-second deadline; no scene was published. Provider receipt did not confirm priority service. |
| `real-lecture-live-06` | Reproduced initial timeout. Provider began tool output at 1.309 s and was still emitting it at 9.877 s (2,791 characters observed); no completed submission. Request setup was approximately 8 ms. |
| `real-lecture-live-07` | Compact prompt and source budget completed model request in 3.342 s, but shortened prompt omitted the required scene-module wrapper. Compiler rejected the bare body; no scene was published. Wrapper contract was restored before the next trial. |
| `real-lecture-live-08` | First rendered scaffold reached next browser frame opportunity 7.419 s after replay start. Initial model call 7.203 s; following edits 2.402–3.821 s. No timeout in eight requests; final request failed validation because one all-null property entry accompanied otherwise valid edits. The scaffold rendered, but explanatory coverage remained incomplete. |

All directories are beneath `data/realtime-workshop/`; each contains `events.jsonl`, provider receipts, and screenshots. Inputs are in `real-lecture-audio-01/manifest-video.json`. Frames were extracted at exact excerpt times 0, 5, …, 55 seconds, using explicit input seeks. Failed trials are evidence, not successful quality results.

## Verification

- Animation, capture, and watch suites: 51 tests / 205 assertions pass.
- Native text and LaTeX suites: 29 tests pass. First invocation failed because the sandbox temporary directory disappeared; rerun with repository-local TEMP/TMP passed.
- Strict TypeScript check for replay/watch entry points passes.
- Main-app production build passes, including rebuilt native text renderer.

The ten-second end-to-end target, general visual quality, and faithful updates across subjects are not established by these trials. A model response, renderer submission, and physical screen presentation are distinct events. Browser telemetry measures the next frame opportunity, not physical pixel presentation.

The existing native overlap diagnostics can reject candidate text collisions before publication, but they are not wired into this live path. Candidate-only checking would miss collisions with retained programs; automatic repair would also need bounded feedback plumbing. Prompt changes alone did not solve overlapping diagrams. No layout guarantee or automatic repair is claimed.

## Timeout correction

Trace 06 locates the timeout in unfinished output generation, rather than authentication or display. Live requests now use an explicit compact prompt and a 1,600-character source budget, enforced in the submitted strict schema and again before accepting the completed response. Other probe callers retain their previous limits. Each source remains a complete program; large replacements must not be truncated. This favors incremental native construction and small edits. It does not establish parity with arbitrary large baseline programs.

The main-app loop retries only HTTP 504 request failures, at most twice after one-second delays, without advancing its source cursor or publishing partial output. Stop, navigation and hiding cancel the retry. Successful acceptance resets the allowance. Compiler/validation failures and other HTTP statuses still stop explicitly. Each request retains the ten-second deadline; a recovered update can therefore take longer than ten seconds overall.

Fully validated all-null property entries now normalize away instead of rejecting otherwise valid edits. An entirely unchanged edit becomes an explicit defer; invalid fields, duplicate IDs, invalid durations and receipt mismatches still reject. The exact run-08 failing response was replayed through validation successfully, preserving its four meaningful entries.

Verification: probe and animation suites 57 tests / 572 assertions pass; focused live-loop tests 11 pass; production app build passes. Real playback verification is recorded separately from these offline checks.

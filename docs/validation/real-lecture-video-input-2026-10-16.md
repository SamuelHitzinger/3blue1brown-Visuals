# Real lecture: paced audio and video input

## Scope

The supplied lecture's 15:00–16:00 excerpt plays locally at 1× beside the actual main-app live animation component. The replay sends two-second audio windows at one-second hops to ElevenLabs and an independently scheduled JPEG every five seconds to the animation author on OpenAI. It does not send the entire video in advance. This is sampled video input, not continuous video inference.

The user approved the audio and frame/transcript destinations, then explicitly requested ongoing video input. Private media, transcripts, provider prompts, and generated scene sources remain under ignored `data/realtime-workshop/` paths.

## Changes

- Capture retains at most eight original JPEGs in memory (at most 2 MB each), scoped to owner, lecture, and arrived photo source. Copies are returned; deletion/close clears them. This is a global cache, without a TTL or persistence across restart.
- Animation requests include the newest already-arrived photo even when queued speech is older. The speech cursor still advances through its original ordered batches. Frame and speech capture times remain distinct; no measured speech anchor is fabricated.
- Benchmark direct-frame mode records a receipt rather than running a caption model first. Original pixels go to the animation author. Normal capture extraction remains unchanged outside this explicit benchmark mode.
- Prompt specifies independent visual evidence, dark-canvas contrast, one readable primary construction, and reuse of existing object identities. Existing source can support edit mechanics but is not evidence of lecture facts.
- Watch view separates transcript, frame receipts, and model decisions. It removes only normalized exact multiword overlap between adjacent overlapping audio windows. ASR revisions and ambiguous single-word repetition remain; original evidence is untouched.
- Native literal text now renders precomposed/decomposed German umlauts. This is not general Unicode coverage; `ß` remains unsupported.

## Preserved trials

| Local evidence directory | Result |
| --- | --- |
| `real-lecture-live-01` | Initial photo/text integration lost useful visual detail; mostly deferred, then unsupported umlaut rendering failed. |
| `real-lecture-live-02` | Actual sampled JPEGs produced truss diagrams. One initial request timed out; manual retry was used. Small crowded labels and lagging frame selection failed visual review. |
| `real-lecture-live-03` | Latest-frame context worked, but generated BLACK geometry was invisible on dark canvas. Two updates followed by repeated deferrals and a provider failure. Preserved without hand-editing generated outputs. |

All directories are beneath `data/realtime-workshop/`; each contains `events.jsonl`, provider receipts, and screenshots. Inputs are in `real-lecture-audio-01/manifest-video.json`. Frames were extracted at exact excerpt times 0, 5, …, 55 seconds, using explicit input seeks. Failed trials are evidence, not successful quality results.

## Verification

- Animation, capture, and watch suites: 51 tests / 205 assertions pass.
- Native text and LaTeX suites: 29 tests pass. First invocation failed because the sandbox temporary directory disappeared; rerun with repository-local TEMP/TMP passed.
- Strict TypeScript check for replay/watch entry points passes.
- Main-app production build passes, including rebuilt native text renderer.

The ten-second end-to-end target, general visual quality, and faithful updates across subjects are not established by these trials. A model response, renderer submission, and physical screen presentation are distinct events. Browser telemetry measures the next frame opportunity, not physical pixel presentation.

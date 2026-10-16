# Evidence-qualified speech anchors

The joined lecture experiment now preserves measured ASR words through the server ledger and model prompt. An opt-in world submission names its supporting phrase and exact evidence ID/version; the host resolves word IDs and source/host intervals using the existing speech-cue resolver. The model no longer needs to calculate those timestamps. This connects previously isolated cue matching to the retained-world path, but does not yet synchronize animation playback to lecture audio.

## Contract and publication

`runProbe(args, {speechAnchors:true})` adds a strict `speechAnchor` object with `evidenceId`, `version`, `phrase`, `occurrence`, and `utteranceId`. Every field is required. All five null means no speech anchor; otherwise identity/version/phrase are required and occurrence/utteranceId can disambiguate repeated phrases. The installed provider adapter rejects nullable objects, so the tested wire contract uses nullable scalar fields. Legacy probe schemas and results remain unchanged when this option is off.

The joined host enables the contract. Speech-only additions/edits require an exact measured phrase. A null anchor is permitted for deferral or when released frame evidence is available for a frame-only operation; it grants no speech-alignment claim. Phrase relevance remains a model assertion, not something exact string matching proves. Instructions prohibit choosing a later unrelated phrase to disguise latency. Cross-window phrases and missing/ambiguous matches fail rather than receiving estimated timestamps.

Resolved anchors retain evidence ID/version and source ID because local word IDs such as `window.u1.w1` recur in different chunks. They include exact measured source interval, source-clock mapping, minimum supplied word probability, and phrase-end plus ten-second deadline. Probability is retained as recognizer output, not calibrated semantic confidence.

The server keeps its existing source-window deadline and narrows it to the supporting phrase deadline when earlier. It revalidates authoritative ledger versions after inference and after receipt persistence; delayed corrections cannot publish an anchor from a replaced version. The browser narrows and re-arms its attempt timer before preparation/commit and retains the existing publication guard. Its render receipt records phrase-end-to-render-submission lower/upper clock bounds separately from existing chunk/availability metrics. Hardware presentation remains unknown.

Live programs still start at actual commit and edits at actual publication. Backdating a new animation to a historical word would skip its opening operation, so this change does not do that. Automatic multi-action scheduling against buffered audio and scientific relevance verification remain open requirements.

## Evidence

- Regression: source phrase ends at host 2,000 ms; chunk ends at 5,000 ms; render estimate spans 14,490–14,500 ms. Chunk-end delay is 9,500 ms, but phrase-end delay is 12,490–12,500 ms and fails the phrase deadline.
- Tests cover repeated phrases, identical word IDs in different chunks, stale versions, unavailable evidence, nonzero source offset, non-unit playback rate, transcript mismatch, reversed clock bounds, correction during persistence and persistence exhausting the narrowed budget.
- The actual installed Pi adapter accepts the new strict scalar-null contract. An injected runtime exercises the opted-in library request, schema forwarding, trace, terminal acceptance and manifest without network access. This is not a model instruction-following result.
- A separate retrospective handoff probe processed all 40 raw trials from the [paired local ASR experiment](local-asr-overlap-checkpoint.md). It mechanically selected each trial's first utterance and resolved all 40 through the same server/helper path. No raw wording was corrected. The smallest remaining phrase-end budget at ASR receipt was about 4.07 seconds; this measures a selected historical utterance's age, not generation or rendering latency. It is not a semantic operation selection test.

Ignored handoff evidence, frozen probe and raw receipt: `data/realtime-workshop/speech-handoff-local-01/`. The [sanitized handoff results](speech-handoff-local-results-2026-10-16.json) retain raw-result/phrase hashes and measured spans without private German transcript text. Raw ASR comparison evidence remains unchanged.

Root verification passed **53 tests / 392 assertions** across the speech helper, joined host, probe contract, timing adapter, overlap harness and existing paced producer. Targeted strict TypeScript checking passed, including the browser entry point. Independent review caught the stale-ledger race; it was fixed and the reviewer reported no remaining blockers in the timing/correction scope. No browser/provider run of the changed joined host occurred. No broad-suite, hardware-presentation, visual-quality or ten-second end-to-end pass is claimed.

## Next acceptance work

Broader provider payloads remain pending their separate destination approval. Local progress can test transcript reconciliation with explicit correction provenance and measure frame age during retained edits. Once permitted, evaluate whether models select relevant anchors and preserve explanation quality across the [subject/detail matrix](complexity-matrix-protocol.md), with matched motion review and measured browser changes. Existing successful string resolution must not be promoted to successful real-time explanation.

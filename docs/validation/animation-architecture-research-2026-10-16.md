# Fast explanatory animation: architecture decisions

Public-source research, 2026-10-16. Recommendations below are engineering
inferences, not measured performance claims for this repository.

| Approach | Useful existing mechanism | Decision here |
| --- | --- | --- |
| Retained scene and small updates | [Vega's View API](https://vega.github.io/vega/docs/api/view/) separates signal/data changes from evaluation and rendering. [OpenUSD](https://openusd.org/release/intro.html) represents persistent composed scenes. | Keep native JavaScript for novel constructions; expose typed numeric parameters and exact object/asset IDs for subsequent changes. Reusing scene state avoids asking a model to describe unchanged geometry again. No renderer migration justified by these references alone. |
| Early preparation | [OpenAI latency guidance](https://developers.openai.com/api/docs/guides/latency-optimization) discusses output reduction and parallel work. [LiveKit turn tuning](https://docs.livekit.io/agents/logic/turns/tuning/) provides preemptive-generation techniques. | Defer speculative compilation. Existing source screen has only a 25.93 ms median completed-tool-to-terminal gap. The potential overlap is bounded by the smaller of preparation time and that gap. Do not execute partial source or mutate a retained callback before acceptance. |
| Prompt-prefix reuse | [Prompt caching](https://developers.openai.com/api/docs/guides/prompt-caching) reuses matching input prefixes. | Put stable API/style contracts first and changing evidence/state last. Measure actual cache-read tokens and first observable argument latency; current audited runs have zero cache reads. Caching does not eliminate long output decoding. |
| Continuous evidence transport | [Realtime conversations](https://developers.openai.com/api/docs/guides/realtime-conversations) supports audio, images and function calls. [Whisper-Streaming](https://arxiv.org/abs/2307.14743) uses local agreement for streaming transcription. | Consider only after quality-preserving compact edits are measured. The paper's reported 3.3-second latency is its own experiment, not this pipeline. Transcript corrections need versioned evidence and preserved original deadlines. |
| Reliable one-pass review | [Structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs) constrains shape; [streaming responses](https://developers.openai.com/api/docs/guides/streaming-responses) exposes completion events. | Schema validation cannot establish scientific or visual correctness. Combine analytic invariants, asset provenance, sampled native renders and independent motion review. A completed argument stream is not successful provider termination. |

Highest-value next model experiment: identical approved starting scenes and
requested changes, full-source replacement versus retained parameter updates.
Randomize arm order across algebra, waves, probability, curved 3D surfaces and
complete organic molecules, each at low/high visual detail. Preserve entities,
topology, labels, camera, motion and reading hold. Treat reasoning complexity and
visual detail as separate axes; add the unseen-subject/data/asset holdouts defined
in the [matrix](cross-subject-visual-matrix.md) before claiming generality.

The [latency audit](animation-latency-audit-2026-10-16.md) gives the measured reason:
argument streaming dominates the existing source screen. A faster failed visual,
deferral or omitted molecular detail cannot qualify as a speed gain. The current
acceptance deadline is ten seconds, including work after the decisive input arrives.

Asset retrieval should return compact capabilities, exact identities, scientific
constraints and relevant named parts. Keep geometry and complete metadata cached
on the host, rather than copying them into each prompt. Lexical lookup is useful
infrastructure; it does not prove semantic suitability or create missing assets.
Installed clip inventory and playback capability must be reported separately.

No provider calls, uploads, new dependencies or renderer migration were performed
for this research. Paired model trials remain subject to the pending generated
JavaScript/project-state export approval described in the
[checkpoint](committed-context-checkpoint.md#pending-model-comparison-and-broader-acceptance).

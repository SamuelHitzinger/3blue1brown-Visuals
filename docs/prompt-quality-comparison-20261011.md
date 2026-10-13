# Prompt comparison — 11 October 2026

The revised prompts substantially improved RNA scene setting, reduced persistent setup text, and produced usable observation windows before the central answer. Improvement was uneven: RNA copying still carries many base-letter labels, and the final gradient introduction has more annotations than either earlier run. These are comparative observations from generated output, not a claim that a prompt edit guarantees quality.

## Method

Tested three frozen prompt sets on `amilibsam`: baseline commit `3b0a97baaf757063f342002854cb81c89cfb7e96`, first revision, and final revision. The final revision adds a concrete learner task, visible confirming evidence, an attention cue before the answer, and an observation window to lesson guidance and story review. This change followed inspection of the first revision, whose scripts still explained the central result immediately.

Each set received the same two requests: an introductory two-scene RNA transcription lesson with a short sequence example, and two-variable gradient descent for a learner who knows graphs and line slopes, including one numerical update. Requests did not prescribe 3D, sparse notation, or a particular visual solution. Request hashes match across variants. Model and configuration stayed `openai-codex` / `gpt-6-astra` / high reasoning / validated-reference output / host subtitle timing.

The isolated harness calls production `createPiGenerator` and `PiAgentRunner`: fresh lesson and editorial planning, scene authoring, inspection, validation, native WebGPU rendering, visual review, and the normal repair allowance. Generated sources were not manually edited. Baseline source and prompts came from `git archive HEAD`; candidate trees changed only the eight prompt Markdown files. The final eight prompt hashes match the working tree. No active prompt files were temporarily replaced.

Both 1280×720 and 960×720 native frames were reviewed. Optional Chromium author preview was unavailable equally for all variants. Runs used supported subtitles and a silent timing track, without paid speech synthesis. We inspected native contact sheets and dense half-second frame sequences around the key learner tasks. Independent review checked final RNA copying at 4:3, the 3.23-second hold, repaired DNA reclosure and removal of a distracting triangle cage; it also checked the gradient observation sequence from 19.9 to 26.9 seconds. This is not full video playback or a voice-synchronization test.

## Outcomes

| Prompt set | RNA | Gradient descent |
| --- | --- | --- |
| Previous prompts | Complete, two scenes, 52.73 s | Failed native review after repair; no published scenes |
| First revision | Complete, two scenes, 55.07 s | Complete, two scenes, 50.43 s |
| Final revision | Complete, two scenes, 52.94 s | Complete, two scenes, 51.63 s |

The rejected baseline gradient is retained. Its bright tangent patch obscured the equal-distance comparison ring even after the repair changed the source opacity. Its saved native review is the failure evidence; the harness's generic provider error must not be interpreted as an authentication or model outage. No second numerical scene exists for that baseline.

Annotation counts below come from semantic frames sampled every 0.25 s, using opacity greater than 0.1. They count visible text and LaTeX objects, including base letters, numbers, and axis labels. They do not measure pixel area, occlusion, or relevance. Each cell is **peak / mean**. The rejected baseline gradient scene is marked with an asterisk.

| Scene | Previous | First revision | Final revision |
| --- | ---: | ---: | ---: |
| RNA setting and opening | 19 / 13.61 | 2 / 1.54 | 3 / 2.06 |
| RNA copying mechanism | 31 / 28.14 | 29 / 25.20 | 28 / 22.94 |
| Gradient local geometry | 10 / 7.42* | 10 / 6.93 | 12 / 8.47 |
| Gradient numerical example | — | 7 / 4.28 | 6 / 4.38 |

## What changed in the actual renders

**RNA setting and shape.** Baseline planning selected two flat scenes, explicitly citing the short duration. Its context was a cell outline and helix symbol; its enzyme was a broad simple outline. Revision one introduced actual 3D cell/nucleus cutaways, DNA and a channel-shaped enzyme, then flattened the mechanism. However, the enzyme rendered like a purple slab, and the nearly frontal camera weakened depth. The final revision built smoother tube backbones and four asymmetric shaded enzyme domains around a channel; it retained the lobed silhouette when flattening into 2D. This improves recognizable form, but it is a schematic model, not an atomically accurate protein or experimentally sourced structure. Frontal framing still limits depth. A `3d` mode flag alone was not treated as success.

**RNA attention and timing.** Setup clutter fell sharply, from 19 to 3 peak annotations. Mechanism improvement was smaller, from 31 to 28, because the short sequence still carries nucleotide labels. In the final copy scene, the cue “Compare incoming RNA bases with the exposed template” precedes confirmation: two candidate bases settle at 2.433 s and remain unconfirmed until guide lines appear at 5.667 s, an actual **3.23-second observation window**. Pairing notation appears later, after 7.267 s, then retires. This is stronger evidence of guided discovery than the first revision's immediate explanation. Some incidental labels still have short lifetimes, including a final DNA re-pairing label of approximately 0.73 s.

**Gradient form and formalism.** All variants attempted genuine 3D. The first revision used a larger shaded bowl and a separate tangent detail instead of the baseline's small surface plus detached text column. The baseline objective remained visible for 25.884 of 26.134 seconds; the first revision retired it after approximately 8.75 seconds. Its worked update was staged at 5.75–10.5 s, the result at 8.25–10.5 s, then cleared before the value comparison and large-step example. This supports allowing several equations when the example needs them, while retiring them before moving on. Some first-revision slope/gradient labels were too brief (about 0.5–1.25 s), showing that indiscriminate removal is not a sufficient target.

The final introduction contains a genuine 3D surface viewport inside a 2D layout, plus an equal-unit input-plane detail. Native review required a closer, less edge-on tangent view and removal of a text overlap; the repaired view passed. The learner compares equal-length moves and signed shadows for three seconds before the minimum is revealed. The mathematical bridge is more explicit, but its peak annotation count rises to 12 and includes a long plain-text height-change relation. Fewer LaTeX objects therefore does **not** establish lower text clutter.

The final numerical scene passed after native review caught overly aggressive removal: the initial completed update held fully visible for only 0.1 s, and the oversized-step endpoint for only 0.25 s. The ordinary pipeline repair extended those settled holds to approximately **1.45 s** and **1.05 s**, without changing the total duration. Targeted native frames confirm `(1,1) − 0.1(2,4) = (0.8,0.6)`, the height change `3 → 1.36`, and the alternative endpoint `(-0.2,-1.4)` with `3.96 > 3`. The objective retires after approximately three seconds; the main calculation clears before the height comparison, which clears before the oversized-step demonstration. Peak annotation count drops from 7 to 6 compared with revision one, but mean occupancy rises slightly. The model occupies a smaller left-hand area with substantial unused space, and the original slope labels remain brief; this is not an unqualified visual improvement over revision one.

## Evidence and limits

- [Three-way RNA native-frame comparison](../data/prompt-quality-comparison-20261011/rna-baseline-vs-candidate-vs-candidate-v2.png) pairs setting, opening, and copying phases; [frame provenance](../data/prompt-quality-comparison-20261011/rna-baseline-vs-candidate-vs-candidate-v2.frames.json) records actual source images and timestamps.
- [Three-way gradient comparison](../data/prompt-quality-comparison-20261011/gradient-baseline-vs-candidate-vs-candidate-v2.png) marks the rejected baseline and missing baseline example explicitly. [Final numerical proof frames](../data/prompt-quality-comparison-20261011/candidate-v2-gradient-numerical-proof/1280x720-sheet-0.png) show the completed update, height comparison and oversized-step counterexample at their actual reading holds.
- [Harness](../data/prompt-quality-comparison-20261011/run.ts), [hash/configuration audit](../data/prompt-quality-comparison-20261011/audit.json), and [semantic analyzer](../data/prompt-quality-comparison-20261011/analyze.ts) preserve the comparison method. The variant/topic `.result.json` and `.analysis.json` files collectively preserve original scene source, request/prompt hashes, timings, task metrics, and annotation lifetimes. Job directories preserve plans, prompts, native renders and review decisions.
- [Dense RNA opening frames](../data/prompt-quality-comparison-20261011/candidate-v2-rna-opening-proof/) and [gradient observation frames](../data/prompt-quality-comparison-20261011/candidate-v2-gradient-observation-proof/) supplement sampled keyframes.
- Earlier saved `m9-spatial-prompts` RNA output was also inspected: it already had a 3D setting, but its copying scene used bead/line geometry and a simpler enzyme outline. Its different request and reused planning make it historical context, not a matched control; its counts were not pooled with this experiment.

This is one stochastic run per topic per prompt set, with normal in-pipeline repairs, not a statistical benchmark. Different generated scripts and durations mean phases are compared by teaching purpose rather than identical timestamps. Whole-scene annotation counts include meaningful base letters, and semantic samples cannot establish visual quality without rendered inspection. Sparse contact sheets may miss transient defects; dense sequences improve coverage only around inspected transitions. The baseline gradient failure prevents a complete matched numerical-scene comparison. Native rendering was tested, but no exported video, audio, or speech alignment is claimed.

Focused backend verification supplied by the main task: **84 tests passed, 0 failed, 696 assertions; backend typecheck passed**. [Test log](../data/prompt-quality-comparison-20261011/verification-tests.log). These checks validate prompt loading and pipeline contracts, not animation pedagogy. Large experimental artifacts remain under ignored `data/`; this report is the tracked record.

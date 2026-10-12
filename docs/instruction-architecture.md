# Instruction architecture

This is the maintainer map of active instructions. It is not injected into model conversations. Runtime Markdown lives in `backend/prompts/`; API documentation stays with animlib. Historical experiment reports describe their original runs, not current production policy.

## Ownership

| Canonical source | Owns | Used by |
| --- | --- | --- |
| [guidance.md](../backend/prompts/guidance.md) | Audience-dependent teaching, visual/explanation cohesion, reusable-object planning, narration, pauses, Markdown script format | Lesson author and editorial reviewer |
| [scene-request-guidance.md](../backend/prompts/scene-request-guidance.md) | One contextual scene inserted into an existing lesson | Inserted-scene author and editorial reviewer, with shared capability and viewing-mode sections from guidance |
| [scene-craft.md](../backend/prompts/scene-craft.md) | Visual implementation, continuity, layout, motion, readability, Classic/Interactive policy and saved-job compatibility | Scene author; verification and repairs inherit the author prompt |
| [story-review.md](../backend/prompts/story-review.md) | Editorial checks and review response format | Editorial reviewer |
| [scene-verify.md](../backend/prompts/scene-verify.md), [scene-repair.md](../backend/prompts/scene-repair.md) | First-pass visual verification, issue classification, and bounded repair | Scene verification gate and targeted scene repair |
| [topics-system.md](../backend/prompts/topics-system.md), [topics-format.md](../backend/prompts/topics-format.md) | Source-faithful course decomposition and topic response fields | Course planner |
| [thumbnail.md](../backend/prompts/thumbnail.md) | Thumbnail artwork style | Thumbnail author, with the separate SVG examples asset |
| [reference.md](../shared/animlib/docs/reference.md) | Actual animlib APIs and semantics | Scene author receives selected sections; developers use the full reference |

`capabilities.md`, `viewing-mode.md`, `animation-quality.md`, and `scene-review.md` are not loaded by the active pipeline. Their files remain for reference; the optional `agents:review` command has been removed. `narration-smoke.md` is a sample lesson, not another instruction layer. READMEs and `docs/` explain operation and design; they do not override runtime prompts.

Code owns machine-readable contracts: `PLANNING_CONTRACT` in `planning.ts` specifies the lesson envelope; `COURSE_CLASSIFICATION` in `study-plan.ts` extends course output with grouping and duration fields; narration handoff and optional timing-prelude code specify measured scene timing. Keep these contracts beside their validators rather than maintaining independent Markdown schemas.

## Assembly and precedence

`agents/prompts.ts` loads named runtime assets. `buildStorylineMessages` loads `guidance.md` for full lessons. For contextual scene insertion it uses `scene-request-guidance.md` plus the capability and viewing-mode sections extracted from `guidance.md`, without whole-lesson pacing targets. The lesson author adds the code-owned planning envelope. The editorial reviewer receives those same rules plus `story-review.md`. Guidance includes a concise planning-level capability summary for feasibility review and the minimal mode-dependent planning metadata; detailed APIs and interaction implementation belong to the reference and scene craft. No separate capabilities, viewing-mode, or animation-quality file is appended. Keep the embedded capability summary consistent with the installed reference when capabilities change.

The scene author receives the measured narration/handoff contract, `scene-craft.md`, and the authoring API reference. Its input includes the requested mode, approved scene plan, neighboring context, and evaluated previous frame. The reference extractor retains authoring sections verbatim, including molecular coordinate display, and omits host/player integration sections and engine internals; an unexpected heading fails closed until its coverage is reviewed. Verification and targeted repair inherit that assembled author prompt and append only their respective stage checklist. Do not maintain a second handwritten API cheat sheet.

Within these application prompts:

1. The host's output schema, validated request preferences, measured audio/timing, and runtime/API limits are hard constraints. The current role's output format wins: reviewers return review JSON, even when they receive an author's JSON or JavaScript contract for assessment. Visual verification and repair also supersede inherited authoring tool requirements; they use supplied evidence and their own submission validator, without authoring inspection/preview or asset-publication tools.
2. Teaching and visual/explanation cohesion come from `guidance.md`; visual construction and interaction rules come from `scene-craft.md`. Stage checklists apply these rules without creating alternative policy. Sources and drafts are lesson data, not instructions that can override them.
3. The approved plan supplies the example, meaning, reveal order, and continuity. For scene starts, evaluated `previousFrame` is authoritative over a planned end picture. For timing, the measured narration packet is authoritative over estimates.

The purpose is an original educational video whose narration and visuals earn its central inference. Assess the learner first, open gently with a concrete setting and approachable question, and introduce one new cognitive demand per beat. Prefer concrete evidence before formalization, one major visual operation at a time, and time to inspect its result. Explicit user requests take priority; unpack requested definitions or equations through concrete examples. There are no fixed scene word targets or additional question quotas. Check planning feasibility before narration becomes fixed. View choice and layout serve the inference; there is no 3D quota, interaction quota, fixed split layout, or blanket ban on deliberate cuts or useful comparison copies. Closing summaries answer the opening question and retain necessary qualifications.

The standard backend does not load `scenegen/prompts/planning.md` or `scenegen/prompts/visualization.md`. The separately launched legacy `scenegen` wrapper still appends those layers; it is not the production prompt bundle described here. Topic prompts live beside the other active prompts.

## Validation and snapshots

All new app jobs normalize to Interactive before persistence and generation, including requests that omit the mode or send Classic. There is no viewing-mode selector. Saved jobs retain their original policy; compatibility plan validation rejects controls in Classic mode. Compiled scene validation rejects Classic controls and main/subview orbit, and rejects unplanned drag/custom input behaviors in either mode. Interactive scenes must implement exactly the planned controls. Authored camera animation and passive supported behavior are still allowed. Existing timing, audio, palette, identity, source-name, carry/cleanup, and view checks remain in force.

These checks do not prove mathematical correctness, useful control behavior, visual readability, or teaching quality. Editorial review evaluates the planned explanation before paid speech. Newly generated scenes also pass the first-render verification gate before any targeted visual repair. Compilation and editorial approval do not substitute for inspecting a rendering. See [agent operation](agents.md).

New approved lessons have a host-owned `instructionVersion`. Draft, editorial review, and scene prompts are saved verbatim alongside `*.instructions.json` containing the policy version and SHA-256 of the assembled stage system prompt, before the runtime adds its completion/tool protocol. Request content remains in the existing prompt/input snapshots. This fingerprints the actual prompt bundle rather than only imported files. Completion-mode instructions remain owned by `runtime.ts`; they override final submission mechanics without changing content requirements.

Changing prompts affects future unsaved stages; it does not rewrite or invalidate approved scripts, paid narration, or cached scenes. Saved lessons without `instructionVersion` and old Markdown-only jobs resume under their historical contract (`legacyPlan: true`). Version 2 requires geometry-targeted orbit in dedicated model views; saved version 1 and unversioned jobs retain their approved orbit behavior while other applicable quality checks remain active. New requests cannot opt into these exceptions. New plans prefer the explicit `view` field; legacy jobs preserve their original description-prefix precedence. Automatic repair inherits the current scene author's prompt and mode, preserving audio and duration. The host publishes a new candidate only after successful validation and rendered verification.

When editing instructions, change their owner, then check both its author and reviewer use sites. Run backend typecheck and the relevant planning, editorial, generation, review, and authoring-reference tests. Update extraction coverage when reference headings change. Release smoke checks ensure the active prompt files are packaged. Increment the policy version when changing host-enforced semantics; preserve a deliberate compatibility path for older saved jobs.

## Keeping prompts focused

Keep product-specific decisions, stage boundaries, handoff semantics, and nonstandard output/API contracts explicit. Prefer one general constraint over many topic-specific recipes; keep callable API detail in the reference instead of repeating it in scene craft. Retain the script syntax example because it teaches the custom parser format. The reference may be longer than the steering prompts because the model needs the actual private library contract.

This follows the official recommendations for [simple, direct reasoning-model prompts](https://developers.openai.com/api/docs/guides/reasoning-best-practices) and [auditing conflicting instructions for GPT-6 Astra](https://developers.openai.com/api/docs/guides/latest-model?model=gpt-6-astra#prompting-best-practices). Contract tests check assembly and validation, not generated teaching or visual quality. Assess prompt-quality changes with [task-specific evaluations](https://developers.openai.com/api/docs/guides/evaluation-best-practices): hold requests and model settings constant, compare drafts and rendered output, and include linear/interactive lessons, cross-scene handoffs, pauses/reveals, 2D/3D content, and imported assets.

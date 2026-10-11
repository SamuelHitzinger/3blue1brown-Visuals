# Construction-planner hypothesis after isolated baseline enzyme

Research proposal only. No active candidate, production prompt, runtime or generated source was changed, and no inference was run for this investigation.

## Observed failure

Inspected the native repaired opening frame at `data/dimensional-prompt-eval/runs/baseline/enzyme/728cd3db-221a-494d-bfa6-5cde10ab277f/scene-0.visual/1/1280x720-0.png`, the approved plan, both visual reviews and the exact repair. The frame shows a smooth rounded triangular body, a dominant central bowl and pale loops laid over its surface. It provides real depth, but the requested connected multi-domain fold is weakly legible. This still does not establish the quality of every motion interval.

The plan already asks for unequal organic domains, broad connected interfaces, substantial surrounding fold and a pocket between domains. The first native verifier explicitly rejects a triangular shell and single wavy loop. The repair changes lobe functions, increases sampling and adds more ribbon turns; the second verifier approves. Source `scene-0.visual/1/candidate.js:13–22` retains radial upper/lower heightfields organized around one central pocket. The supposed domains modulate that shell's perimeter/height. The ribbon at lines 25–26 follows its upper surface. More tessellation improves smoothness but does not establish visibly separate folded masses.

**Next hypothesis:** the author commits to a convenient construction family before resolving the requested macrostructure, then bounded repair preserves that family. The plan's ambition is present; repeating stronger spatial adjectives is unlikely to isolate this failure. A dedicated construction decision might help, but the existing detailed plan means an extra planner could also simply repeat instructions without improving the image.

## Minimal test through the full generator

Yes: a research runner decorator can add one real, separate `PiAgentRunner.run` conversation before the production scene-author call. Keep `createPiGenerator`, fresh lesson drafting/editorial review, subtitle timing, author tools, native gate, bounded repair and model/thinking settings unchanged. Label the boundary **augmented full pipeline with a construction prepass**, not unchanged production behavior.

1. Intercept only `stage:'scene'` with a scene index, once per fresh scene. Read its already-saved canonical `scene-N.input.json`; use the approved plan/request, meaningful inherited IDs, narration constraints and available asset metadata. The author still gets its complete authoritative packet.
2. Invoke a specialist through a non-intercepted logging helper to avoid recursion. It receives a short geometry-design task and relevant **verbatim installed API sections**, not another hand-written API. No source editing, asset publication, rendering or new runtime tools are needed for this planning task.
3. Return bounded construction JSON, approximately 400–800 tokens: `representation`, `majorPartsAndConnections`, `activeRegion`, `operationAndClearance`, `viewEvidence`, `compileCostRisks`. Specify schematic coordinates/proportions, independent parts, supported constructors and the visible relation they establish. For this request, decide how unequal volumes and broad interfaces remain visible around a local pocket before designing ribbon detail. Reject a radial platter with added loops if it cannot meet that evidence. Do not require this architecture for every subject.
4. Append the validated brief as an implementation proposal to the actual scene-author task. It cannot alter approved narration, timing, planned controls, evidence class or required identities. Keep the output schema bounded and reject unavailable APIs such as vector element scaling.
5. Cache the exact brief by scene index and append it to that scene's verifier and repair inputs too. This is necessary because the generator's original author task remains unchanged when the decorator sends a modified copy; `visual-gate.ts:86,113` would otherwise carry only the original packet. The brief is a criterion to check against rendered evidence, not evidence that construction succeeded.
6. Save helper/effective prompts, output, hashes, tool usage, latency and tokens in the same run provenance. Do not seed a lesson, replace a failed source manually, bypass gates, add repair attempts or exclude helper cost. Native approval and independent shape/style judgment remain separate outcomes.

## Real delegation versus role prose

This prepass is a real host-orchestrated specialist conversation with a separate context. Saying “act as a designer, then checker” in one author prompt remains one conversation. The current scene agent cannot itself call a helper: `AgentTask` has no generic extra-tool field (`runtime.ts:49–65`), and runtime tool registration explicitly lists validation, publication, inspection, preview and web tools (`runtime.ts:192–259`). Author-initiated delegation would need a new bounded callable runtime tool and is a separate implementation experiment.

## Compare against the cheaper explanation

After the current matrix finishes, compare the winning prompt unchanged, the same prompt with its short construction checklist placed immediately before the task instead of ahead of the long API reference, and that same ordering plus the actual specialist brief. This distinguishes prompt placement/context overload from the value of an additional model conversation. Use fresh, unchanged requests; include a second spatial case and a planar control. Do not gate the helper by subject labels alone.

The specialist adds one agent task and its output to downstream contexts. Savings are possible only if it reduces author revisions or repairs; there is no measured saving yet. This baseline spent 351.6 seconds/12,204 output tokens in scene authoring and 85.3 seconds/2,625 output tokens in repair, within 658.0 seconds total. Measure total cost and independently judged macrostructure before calling the prepass useful. An additional generic plan, or the same shell with more ribbon detail, is a failed hypothesis even if every native gate passes.

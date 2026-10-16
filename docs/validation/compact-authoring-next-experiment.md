# Compact authoring: smallest next experiment

2026-10-16. Read-only source/evidence inspection plus this report. No model calls, implementation changes, generated-scene execution or new visual-quality scores.

**Recommendation: do not add another graphics DSL. Change the authored representation to geometry defined once in local coordinates, attached annotations, and operations over existing handles, using the current `compose` / `schedule` APIs. Keep the existing `{source:string}` submission schema.** A newly invented JSON action schema increased byte counts in a direct comparison. A thin adapter should be considered only after a complete, equivalent rewrite demonstrates material savings; the present evidence does not justify implementing one.

This is a representation experiment rather than another round of generic “be concise” instructions: the independent variable is whether the model constructs reusable entities and expresses their transformation, versus re-emitting geometry and manually synchronized labels. It does not remove the need to infer the correct source-grounded explanation.

## What already exists

| Concern | Reuse and precise boundary |
| --- | --- |
| Named reusable construction | `shared/animlib/src/authoring-types.ts:4` and `authoring.ts:15`: `CompositionPart` is `{kind,props}` **or an arbitrary native factory** `(s,scopedId)=>handle`. `compose` scopes IDs and returns a normal group plus `get(name)`. It does not infer layout. Box is supported through a factory, although absent from descriptor kinds. |
| Generic procedural geometry | Native mesh/path constructors, sampling callbacks, `s.bind` and `s.deform`; `diagrams/coordinates.ts` already has `curve` and a one-time `map` of captured source coordinates. `sampledState` already handles aligned sampled trajectories. Do not replace these with a JSON expression interpreter. |
| Timing and ordered explanation | `authoring.ts:39`: `schedule` accepts measured cues/words/utterances/pauses, sequential weighted steps, reveals and answer guards. It inserts gaps and final hold, rejects overlap/backward windows, and delegates actual actions to native `play`. `runtime.ts:378` journals state for rollback. |
| Label/connector correspondence | `runtime.ts:402` and `bindings.ts`: `attach` owns position with a world-space offset; midpoint anchoring is available for lines/arrows. `connect` owns endpoints and can trim bounds/surfaces. Neither should be approximated with separate label moves or stale point lists. |
| Persistent updates | `backend/bench/realtime-world/world.ts`: new programs retain clocks and own disjoint IDs; patches change selected properties and reapply bindings. There is no cross-program attachment or callback-tween rebase. The composition experiment must respect these limits. |
| Existing experimental transport | `realtime-probe/lower.ts:74` already lowers fully committed NDJSON atomically. It supports seven primitives, add/animate/wait/keep, previous-frame handles and bounds. It deliberately lacks groups, attachments, procedural functions, latex, mesh, morphs and removal. It is **not** a live retained-program bridge. |

Expanding `lower.ts` to duplicate every native feature would create a second authoring language. Its creation whitelist even omits opacity, scale and strokeWidth, and its palette excludes GREY/RED used by the direct scenes. Its tests prove selected lowering/state equivalence; they do not make it suitable for arbitrary lecture geometry.

## Exact four attempts

Read `source.js`, `prompt.json`, `tool.json` / `submission.json`, and `result.json` under `data/realtime-workshop/tool-probes/<name>/`. Timings below are request-to-provider-termination, not visual readiness. All actual service tiers are `default`. Output and reasoning counts are reported separately as recorded; do not add the reasoning column again to provider output without checking provider accounting.

| Attempt | Source UTF-8 bytes | Provider output / reasoning tokens | Provider termination | Findings directly visible in source |
| --- | ---: | ---: | ---: | --- |
| `luna-direct-physics-01` | 2,061 | 802 / 0 | 6.174 s | Invents `{handle,props}` actions; supplies geometry to those fake actions. Widths 2–3 are inappropriate world units. Labels attach to arrow origins rather than explicit midpoints. |
| `sol61-direct-physics-01` | 1,813 | 925 / 222 | 13.709 s | Stronger causal construction: copy displacement, scale, reverse. Repeats morph point lists; widths 1/2/6 are inappropriate world units. Morph descriptors include paint fields, although runtime morph updates `geometry`, not element paint. |
| `luna-direct-physics-02` | 2,441 | 1,034 / 0 | 8.020 s | Correct native action shape, but manually synchronizes eight objects in one move. No attach/connect. Wait/play durations sum to **7 seconds**, contrary to the requested 8. Adds a title and detached equation; motion is a sign comparison rather than the requested performed mapping. |
| `luna-direct-biology-02` | 1,316 | 456 / 0 | 4.365 s | A board, text and underlines; the only explanatory change is underlining. Uncertain source interpretation is repeated as display text. Short output and protocol completion do not establish a useful biological explanation. |

The first pair's captured prompt lacks the later world-unit warning and concrete valid-action example. More importantly, **none of the four captured direct prompts advertises compose/schedule**. Current `directSourceAuthorSystem` appends `nativeAuthorApi`, whereas helper instructions exist only in `compactAuthorSystem` (`causal-prompts.ts:23`). These four attempts therefore do not establish that direct single-call authors ignored advertised composition helpers. The earlier two-stage helper experiment remains separate evidence.

These are source inspections, not independent rendered-image judgments. The apparent paint-in-morph problem follows `runtime.ts`'s action semantics; verify the actual rendered result before reporting its visible color.

## Concrete contract and example

Keep the tool schema exactly `{source:string}`. Inside source, use these **existing** types as the authoring contract:

```ts
parts: Record<string, CompositionPart>
composition = s.compose(prefix, parts)
operations: ScheduledOperation[] // real handle-created actions and reveal handles
s.schedule(hostTimingPacket, operations)
```

No `NamedEffects`, instruction enum, new expression AST, or subject template is needed. Shapes remain open-ended through native factory functions. Common geometry parameters are authored once; transformations act on handles or use current map/deform callbacks. Host cue packets should be injected using the existing narration mechanism rather than regenerated by the model. For the standalone comparison they remain explicitly synthetic 0–1 / 1–6 / 6–8 windows.

Illustrative **synthetic** mapping `v → 2v → −2v`, not a claim that a particular lecture supplies coefficient 2. This is a proposed authoring example, not executed evidence:

```js
export default scene({mode:"2d",end:"hold",orbit:false},s=>{
  const vector=(s,id,stroke,opacity=1)=>s.arrow(id,{
    points:[[0,0],[1,0]],position:[0,1],stroke,opacity
  });
  const c=s.compose("mapping",{
    original:(s,id)=>vector(s,id,"BLUE"),
    copy:(s,id)=>vector(s,id,"TEAL",0),
    originalLabel:{kind:"text",props:{text:"v",fontSize:.3,fill:"BLUE"}},
    scaleLabel:{kind:"text",props:{text:"×2",fontSize:.3,fill:"TEAL",opacity:0}},
    reverseLabel:{kind:"text",props:{text:"×(−1)",fontSize:.3,fill:"YELLOW",opacity:0}}
  });
  const v=c.get("copy"), a=c.get("scaleLabel"), b=c.get("reverseLabel");
  s.attach(c.get("originalLabel"),c.get("original"),{anchor:"midpoint",offset:[0,.4]});
  for(const label of [a,b])s.attach(label,v,{anchor:"midpoint",offset:[0,-.4]});
  s.schedule({durationSec:8,cues:{operation:{startSec:1,endSec:6}}},[
    {id:"map",cue:"operation",ease:"linear",steps:[
      {weight:1,reveal:[v],actions:v.moveTo([0,-1])},
      {weight:2,reveal:[a],actions:v.scaleTo(2)},
      {weight:2,reveal:[b],actions:[a.fadeOut(),
        v.morphTo({kind:"arrow",points:[[0,0],[-1,0]]}),
        v.animate({stroke:"YELLOW"})]}
    ]}
  ]);
  s.keep(c.group);
});
```

The unchanged original survives; the copy is visibly mapped; local geometry is short; labels follow actual midpoint motion; paint is a style action; schedule supplies the final hold. Scale also changes rendered stroke dimensions, so use a native map/deform instead when preserving stroke width matters. This example does not establish optimal pedagogy, collision-free composition or a token reduction versus the full original scene. Do not delete source conditions or scaffolding merely to beat its byte count.

## Measured compression limits

Local in-memory byte accounting used `Buffer.byteLength(source,'utf8')`, and summed the exact lines containing `s.play(`/`s.wait(`. No files were rewritten.

| Attempt | Existing timing/action lines | Trial JSON named-target schedule | Difference before adapter/registry overhead |
| --- | ---: | ---: | ---: |
| Sol physics-01 | 501 bytes | 557 bytes | **+56** |
| Luna physics-02 | 671 bytes | 715 bytes | **+44** |
| Luna biology-02 | 124 bytes | 130 bytes | **+6** |

The rejected trial preserved operation IDs/cues/easing, point data, weights and named targets with `to`, `morph:{id:{geometry}}`, and `reveal`. JSON's repeated keys and required numeric leading zeros erase shorthand gains. This was a byte experiment, not executed equivalence; the biology IDs with spaces would also need renaming for composition's local-ID contract. It rules out a claimed free compression win, not every possible encoding.

A strictly mechanical native refactor of Sol's three repeated arrow morph descriptors into `shape(x)` reduced the complete source from **1,813 to 1,725 bytes: 88 bytes / 4.85%**, retaining even its problematic paint fields for an honest comparison. The three no-reasoning Luna outputs imply 0.346–0.424 recorded output tokens per source byte; applying that crude empirical ratio gives **about 30–37 tokens** saved. This is an estimate, not a model tokenizer result or a latency prediction. Eliminating *all* timing lines would only remove 27–35% of physics source and 9% of biology source, and real scheduling cannot cost zero.

Thus no measured representation change here explains a multi-second improvement. Bindings may increase first-creation tokens while reducing repeated updates and correctness failures over a long lecture. Measure initial construction and subsequent edits separately. Do not infer speedup from byte counts, especially when reasoning/prefill already dominate.

## Invariants for the experiment

1. Preserve evidence, supported claim, assumptions, entities and the visible causal operation across arms. A correct narrowing of unreadable evidence is preferable to an invented detailed scene.
2. Use exact-source compilation without repair. Check full frames and interpolation, not merely geometry hashes. Retain real style, camera, opacity, glyph and hold behavior.
3. Preserve scoped IDs and within-program bindings. Do not write binding-owned positions/endpoints or combine reactive and timeline ownership of one property. Reactive updates must retain topology and finite values.
4. Use native schedule validation/rollback and measured cue guards. No future evidence, manual deadline extension or answer revealed before its supported cue.
5. Keep source/vertex/object/program limits and stale-revision rejection. No new cross-program bindings implied by this proposal; later property patches preserve existing clocks.
6. An operation must remain meaningful at every intermediate frame. Atom identity, connectivity, labels, occlusion, surfaces and vector direction are acceptance items, not decorations to omit for speed.

## Held-out matrix: subject × visual complexity

Use 12 fresh public or rights-cleared source packets, one per cell below, outside the four authoring examples. Compare the existing direct-source arm to the existing-helper representation arm at identical model/settings, packet and timing. Rotate execution order; repeat promising pairs before estimating variability. Include one correction and one retained-world edit per complexity row.

| Complexity stratum | Three concrete held-out subject tasks | Required detail / failure detection |
| --- | --- | --- |
| Simple 2D lines/entities | Linear algebra: projection; mechanics: torque direction; biology: a supported gene→product distinction | 4–8 meaningful entities, one performed comparison/transformation, attached labels. Reject caption-only explanations. |
| Dense 2D relational geometry | Probability: conditioning and retained population; circuits: current split; computing: graph/path update | 15–30 entities, multiple local labels and live connectors, occlusion/collision control, stable identity through reordering. |
| Full 3D organic molecule | Organic chemistry: supplied conformer/torsion change; stereochemistry: chirality under rotation versus reflection; biochemistry: supplied ligand functional group interacting with a site | Supplied atom IDs, element types, bonds/bond order and coordinates; complete 15–40 non-hydrogen-atom structure with scientifically required hydrogens, meaningful depth, preserved connectivity and local labels. No arbitrary replacement by circles, a helix icon or a generic sphere. |
| 3D mathematical/scientific surface | Calculus: tangent plane/normal; electromagnetism: field relative to an equipotential; waves: superposition on a deformed membrane | Procedural surface with explicit domain and sampling, e.g. 32×32 then 64×64 runtime strata; axes only when relevant, normals/contours/occlusion and labels tied to the causal manipulation. No flattening into a 2D line to meet latency. |

For molecule cases, source packets must supply coordinates/identity or an explicitly available asset; otherwise discovering a chemically valid 3D conformer becomes a separate task. Record that asset availability in both arms. A full molecule is a geometry/detail requirement, not permission to invent chemistry. Procedural meshes and custom factories keep these strata within the native representation.

Keep **hand-authored runtime fixtures** separate: replay known-correct 2D, molecular and surface scenes at increasing detail to measure warm compile/resource/frame costs. They establish runtime headroom only. **Model authoring trials** start from source evidence and must independently pass geometry, scientific correctness, motion explanation and ten-second readiness; a handwritten detailed molecule cannot stand in for successful generation.

## Gates and stop criteria

- First offline gate: make complete matched rewrites of at least one scene per stratum, retaining required detail. Reject a new serialization layer unless it yields at least 20% estimated output reduction across the set without greater validation or runtime complexity. The measured named-schedule candidate already fails this gate.
- Authoring gate: record output tokens, reasoning, first complete accepted source, compile/resources, first useful browser frame, complete explanation availability, and actual tier. Include every failure. Compare startup versus retained edits separately.
- Quality gate: blind full-motion review must pass source fidelity, causal explanation, geometric detail, labels/occlusion and identity continuity in **each complexity stratum**. Require no major scientific error; a faster low-detail scene is a failure.
- Stop the compactness direction if savings are marginal, quality regresses, new geometry requires special subject cases, or useful-visual readiness still misses ten seconds in the high-detail strata. If model time dominates while runtime remains small, move to the independent provider/model experiment instead of extending the DSL.

This inspection supports a concrete reuse experiment, not an assertion that `compose` or shorter code solves the deadline. No implementation is proposed until that experiment demonstrates benefit.

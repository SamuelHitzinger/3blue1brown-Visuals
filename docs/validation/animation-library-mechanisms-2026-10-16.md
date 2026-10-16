# Existing animation mechanisms worth borrowing

Official documentation research, 2026-10-16. Integration costs are estimates;
none of these sources measures this repository's model latency or visual quality.

| Library | Useful mechanism | Implication for the retained native pipeline |
| --- | --- | --- |
| Motion Canvas | [Signals](https://motioncanvas.io/docs/signals/) track dependencies and cache computed values. [Time events](https://motioncanvas.io/docs/time-events/) separate named cues/durations from choreography; [audio](https://motioncanvas.io/docs/media/) is configured for the project. | Borrow cue/dependency semantics. Adopting its scene nodes and generator execution would require a broader adapter. Named cues do not recognize speech or automatically align live audio. |
| Remotion | A [frame number](https://www.remotion.dev/docs/idea) drives a React component; a [composition](https://www.remotion.dev/docs/composition) declares dimensions, duration and FPS. [Player](https://www.remotion.dev/docs/player/player) supplies embedded preview and controls. | Useful reference for deterministic seeking and a separate content/metadata contract. React/player adoption has integration cost; video export remains separate work. No demonstrated speed reason to replace the existing native preview. |
| React Three Fiber / Drei | [Reuse and URL caching](https://r3f.docs.pmnd.rs/advanced/scaling-performance), [retaining objects](https://r3f.docs.pmnd.rs/advanced/pitfalls), [GLTF preload](https://drei.docs.pmnd.rs/loaders/gltf-use-gltf), separate [material preparation](https://drei.docs.pmnd.rs/performances/preload), and [instancing](https://drei.docs.pmnd.rs/performances/instances). | Transfer lifetime/preparation/instance-buffer ideas without React migration. Cached bytes are not decoded geometry or warmed GPU resources. Declarative instancing also has CPU overhead; measure rather than assume. |
| GSAP | [Timelines](https://gsap.com/docs/v3/GSAP/Timeline/) compose nested motion, named labels, relative positions and property tweens. | A small timing adapter could operate on existing properties, but host-clock, seeking and transaction semantics still need integration. Labels do not interpret narration. |

Two incremental directions merit experiments after the current parameter trials:

1. Keep named cue times and durations separate from geometry. Resolve them from
   versioned measured speech, then patch timing without regenerating construction.
   Preserve reading holds and explicitly distinguish historical source time from
   actual live commit time. Existing phrase anchors alone do not provide buffered
   audio synchronization or arbitrary timeline retiming.
2. Report asset stages separately: indexed, byte-loaded, decoded and render-ready.
   Reuse exact geometry/materials and instance buffers where native support permits,
   while preserving every scientific entity and its per-instance data. Compare
   cold admission, first renderer submission and warm reuse separately.

Neither direction justifies a renderer migration or subject-specific template
library. The [measured bottleneck](animation-latency-audit-2026-10-16.md) remains
model argument streaming in the original source screen. The immediate experiment
must test compact edits against matched reconstruction outputs, with full detail
and independent correctness/visual gates. Renderer improvements cannot be counted
as model-generation improvements.

No installs, dependency edits, provider calls or uploads were performed for this
research.

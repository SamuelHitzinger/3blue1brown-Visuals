# Independent motion-helper technical review

2026-10-11, shared `amilibsam` working tree after baseline `f1a86b5`.
Read-only implementation review; reviewer changed only this report and ignored
audit artifacts. **Readiness: revise the two failure paths below.** The released
proof scenes pass their focused semantic checks; that does not establish that
all accepted public helper inputs are safe throughout their motion schedules.
Visual/style readiness belongs to the independent visual report.

## Findings

1. **P2 — `shared/animlib/src/diagrams/collections.ts:13` and `:21`: preflight all custom handles before wrapping any item.** The new initial check only validates handle IDs/duplicates. A later handle from another scene, view, or existing parent is rejected only after earlier wrappers, bindings and parent memberships have been created. Catching the error leaves the earlier caller-owned handle permanently parented to a partial collection. The narrow runtime group fix correctly makes one group atomic, but does not make this multi-group operation atomic. Supply internal scene-aware preflight for the complete set before the first constructor call, including generated IDs; preserve ordinary group ownership checks during creation.

   Minimal reproducer inside `buildScene({}, s => { ... })`:

   ```js
   const a = s.circle('a'), b = s.circle('b');
   s.group('existing', [b]);
   try {
     s.collection('q', [
       {id: 'a', value: 1, handle: a},
       {id: 'b', value: 2, handle: b},
     ]);
   } catch {}
   s.group('recovery', [a]); // throws: Element a already has a parent group
   ```

2. **P2 — `shared/animlib/src/nucleic-structures.ts:101–108`: reject unsupported emergence schedules at initialization or construct a continuous supported path.** An allowed tangent exit direction can collapse a desired link and then reverse it. The same static props succeed at time zero but fail at interior playback times. Do not merely remove the frame-reversal exception: normalized positional integration itself flips the link by twice its baseline length across the zero, so suppressing the exception would expose a discontinuity. Preflight the complete time-independent geometry/schedule with an explicit documented restriction, or define a continuous geometric turn before normalization and test it across the degeneracy.

   Exact compact fixture:

   ```js
   const duplex = api.nucleicDuplex({
     axis: Array.from({length: 4}, (_, i) => [i, 0, 0]),
     template: [...'AAAA'].map((base, i) => ({id: 't' + i, base})),
     coding: [...'TTTT'].map((base, i) => ({id: 'c' + i, base})),
     pairs: Array.from({length: 4}, (_, i) => ['t' + i, 'c' + i]),
     templateDirection: '3to5', codingDirection: '5to3',
     initialNormal: [0, 1, 0], radius: .85, backboneRadius: .08,
     twistPerBase: 0, window: {start: 0, end: 3, separation: 1},
   }, 1);
   const props = {
     id: 'rna', duplex,
     bases: [0, 1, 2, 3].map(i => ({id: 'r' + i, base: 'U', templateId: 't' + i})),
     start: 0, secondsPerBase: 1, approachFraction: .75, radius: .07,
     emergence: {direction: [1, 0, 0], distance: 3, delay: 0, duration: 1},
   };
   api.nucleicTranscript(props, 0); // succeeds
   api.nucleicTranscript(props, 2.1369631431053957); // degenerate RNA exit link
   api.nucleicTranscript(props, 2.136964143105396); // RNA emergence frame reversal
   ```

   Middle baseline anchors are approximately `[1,.005,0]` and `[2,.005,0]`,
   separated by exactly 1. At the collapse, the earlier site's exit weight is
   1/3 while the later site's is zero. Immediately before collapse the earlier
   normalized anchor remains at x=1; immediately after, its constructed x would
   be 3. The implementation throws before returning that latter pose. The
   ordinary 0.05-second sweep also fails from 2.15 through 3.35 seconds.

## Independent verification

- Fresh focused source suite: **39/39 tests in 8 files**, 02:13:04 local.
  Includes sampled-state, peptide, nucleic geometry/integration, collections,
  group ownership, matrix/frontier and neural proof semantics.
- Fresh typecheck and production build both pass.
- Fresh ordinary full suite: **867 pass, 2 fail in 69 files / 869 tests**,
  02:14:42 local. Both failures are the known Windows sandbox `realpath` EPERM
  cases in asset-host-preflight and gltf-files. Both pass in a bounded elevated
  rerun at 02:15:40. This is a split verification result, not a claim that the
  sandbox full command passed.
- A separate built-public-API audit verifies `s.previous.get` grouping inside
  QuickJS after a caught duplicate-child failure, retained time bindings, and
  exact forward/reverse seek equality. It also verifies 120 seeded permutations
  of 4–12 entries, both orientations, 101 times each, and zero extra clearance:
  **388,850 pair separation checks pass**.
- Additional malformed sparse value vectors, projection rows and value arrays
  are rejected by sampled-state before any result is returned.
- Independent reproducers and numerical output are retained under ignored
  `data/animlib-expansion/motion-code-review/{audit.mjs,audit.json}`. The audit
  imports the freshly built implementation and intentionally records the two
  findings rather than treating expected failures as passing assertions.

## Reviewed limits

The sampled-state implementation copies captured inputs and returned arrays,
does not interpolate across null intervals, preserves singleton topology, and
applies an explicit bounded 3×N projection. Reorder validates dense complete
permutations and schedule overlap before mutation; its separate lift/translate/
settle phases and same-displacement lanes preserve declared unscaled rectangles.
The construction finding above is separate from reorder scheduling atomicity.

The peptide helper preserves explicit template-side-chain relationships, uses
stable atom/residue identities, constructs prescribed signed torsions and trans
omega, and stays within explicit atom/component/edge budgets. Its tests measure
dihedrals with an independent atan2 formula and all displayed lengths through
101 intermediate poses. The mixed fixture is an original 72-residue,
414-heavy-atom sequence; it is not substituted for deposited 1CRN. Its carbonyl
angle approximation, endpoint search, envelope and absence of physical dynamics
or collision guarantees are disclosed. No additional scientific claim blocker
was found in the reviewed fixture/provenance text.

Default RNA behavior retains the old geometry path when both optional fields
are absent. The tested oblique exit preserves formed lengths and future targets;
incoming rotation settles continuously for those fixtures. The tangent schedule
above remains an unsupported-but-initially-accepted case and needs resolution.

Public type exports, core/index exports, host runtime and serialized QuickJS
factory wiring are aligned. Runtime group ownership now checks actual local
handles with WeakMap identity, duplicate children and all parent memberships
before reserving them. Persistent handles remain supported. No production
implementation, existing GPU assertions, or baseline assets were changed by
this review. Native GPU exact-pixel parity and visual reference fidelity were
not re-evaluated here; their separate documented limitations still apply.

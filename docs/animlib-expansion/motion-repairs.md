# Motion review repairs

2026-10-11. Focused repair of the two findings in
[motion-code-review.md](motion-code-review.md), with an additional terminal-frame
continuity issue exposed by dense numerical regression.

## Collection preflight

The original failure parented the first custom handle before a later handle or
generated ID failed. `SceneContext.validateGroup(children,newIds?)` now exposes a
read-only builder preflight. Ordinary `group` and the collection factory reuse
the same current-scene WeakMap identity, current-view, duplicate/dense child and
unparented-child validation. Planned IDs reuse ordinary constructor syntax,
collision and element-budget validation. Preflight reserves no IDs or parent
memberships.

Both `s.collection` and public `createCollectionBuilders(s)` validate all custom
handles and all wrapper/cell/label IDs before the first constructor. This covers
the reported parent/foreign/view failures, later generated ID collisions and
element-budget exhaustion. It is not a general transaction or rollback promise
for arbitrary custom constructor/binding callbacks.

## RNA whole-schedule geometric preflight

The previous straight-template `+X`, distance 3, duration 1 exit admitted time
zero but normalized a zero link at `2.1369631431053957`, then reversed that link.
Removing the rotation exception would have exposed a position jump. No exception
is suppressed and no implicit bend plane is invented.

For the clamped cubic smoothstep `f`, consecutive weights differ by
`f(u)-f(u-h)` with `h=secondsPerBase/duration`. The maximum difference is 1 for
`h>=1`; otherwise it occurs at `u=(1+h)/2` and equals `h*(3-h*h)/2`.
Thus every desired forward baseline link `L` is exactly on the finite segment
`L-lambda*d`, where `d` is the normalized exit direction and
`0<=lambda<=span=distance*min(1,h)*(3-min(1,h)^2)/2`.

The nearest point to zero uses `lambda=clamp(dot(L,d),0,span)`. Its norm must
exceed `1e-7*max(1,|L|,span)` for numerical conditioning. The cosine between `L`
and `L-lambda*d` is nonincreasing over this interval: its derivative has the
sign of `lambda*(dot(L,d)^2-|L|^2)`, which is nonpositive. Therefore the endpoint
at `span` gives the worst frame angle. Its cosine must exceed `-1+1e-6`, leaving
a numerical margin above the runtime antipodal exception at `-1+1e-7`.

These are analytic, time-independent sufficient conditions, not a sampled
time-grid heuristic. All links are checked on every call before time-dependent
geometry. A failing schedule has the same explicit unsupported-fold error at
initialization, near the old collapse, and after completion. Smaller distance,
longer duration or an adequately oblique direction can satisfy the bounds.
Safe tangent motion remains supported: the fixture succeeds with distance .999,
duration 1 and with distance 3, duration 5.

## Terminal frame continuity

The broader regression also reproduced a terminal-frame jump at `t=3.75` in
the four-site fixture with oblique direction `[1,0,.2]`: over the following
`1e-7` seconds the terminal normal moved by about 1.7243. Positions stayed
continuous. The terminal site used its previous link for frame rotation, but
that link had already bent before the terminal site's own emergence weight
became positive. Gating the entire rotation on that weight caused a snap.

The terminal site has no outgoing link, so its pure exit translation now retains
the docked normal and tangent. All other nucleotide frames still follow their
outgoing links. This fixes the onset without adding a bend-plane convention or
orientation interpolation. It intentionally changes the terminal base plate in
the released motion proof, which is being rerendered by the molecular proof
worker. Incoming rotation and the default without emergence remain unchanged.

## Verification

Failure-first tests reproduced 16 failures before the fixes: all 14 collection
cases and two RNA schedule rejection cases. The terminal-frame continuity test
then failed separately at its own onset before the terminal repair.

- Focused repairs and existing collections/group/nucleic tests: **44/44 in six
  files pass**. Includes public standalone collection factory, host and public
  QuickJS recovery, generated-ID/budget failures, read-only preflight behavior,
  dense critical-time sweeps, whole-range frame continuity, terminal onset,
  formed-link invariants, future targets, default snapshots and reverse seeks.
- Fresh typecheck and production build pass after the final source changes.
- Fresh full suite with `--maxWorkers=2` and a dedicated workspace TEMP:
  **891 pass, 2 fail in 72 files / 893 tests**, 02:25:37 local. The two failures
  are the previously recorded Windows sandbox `realpath` EPERM cases in
  `asset-host-preflight.test.ts` and `gltf-files.test.ts`; a bounded elevated
  rerun of those two files **passes 2/2**, 02:26:09. The ordinary full command
  did not pass. It also printed five existing dist sourcemap warnings.

Before any terminal-frame adjustment, 161 complete transcript results sampled
at 0–8 seconds every .05 seconds matched the released proof exactly after the
two preflight fixes. SHA-256:

- Motion: `5e319e7c023f4536a6f17bcda8ec24ec217d9d485f6882d297c01dd281f67b8c`
- Original default without optional motion:
  `d13fddb13c19ec51d5df7e1957ca3a360e6aa1bf06082cd3ce14a5018b4ac9c7`

After the terminal repair, the full motion result hash intentionally becomes
`bb3872da2ac7d6cb8ed9bfade58139ff5f1edaeaa619d7ca78bbbcaecba6d87e`.
The default hash remains exact. A second hash includes every result field
except the terminal anchor's tip/normal/tangent and its base-plate part; it
explicitly includes the terminal backbone position, all links, all other
anchors and parts, and all metadata. That hash is identical before/after:
`c58c397f22279c85c3295dd5742176422a5c098fb09aca46c5689370d1c180c3`.
Thus the 161-sample compatibility check isolates the deliberate output change
to terminal orientation/plate geometry. Terminal field JSON differs in 41 of
the 161 samples, at 6–8 seconds (including final floating-point differences).

The capture script and before/after JSON are under ignored
`data/animlib-expansion/motion-code-review/repair-compatibility.mjs` and
`compatibility-{before,after}.json`. Source movie parameters and VM limits are
unchanged by these repairs. The 32 MiB memory, 200 ms execution and 1 MiB result
VM limits are retained; no compiler or offline sampler limit was changed.

## Files owned by this repair

- `shared/animlib/src/runtime.ts`
- `shared/animlib/src/types.ts`
- `shared/animlib/src/diagrams/collections.ts`
- `shared/animlib/src/nucleic-structures.ts`
- `shared/animlib/src/nucleic-types.ts`
- `shared/animlib/test/collection-preflight.test.ts`
- `shared/animlib/test/nucleic-emergence-preflight.test.ts`
- `shared/animlib/docs/helpers-and-assets.md` (preflight and scope paragraphs)
- `shared/animlib/docs/reference.md` (`validateGroup` API row)
- This report

# Independent motion repair review

2026-10-11, shared `amilibsam` working tree. **Bounded verdict: release the
collection/group and transcript emergence repairs, including the sparse-entry
follow-up below. No unresolved finding remains in this repair scope.** This is
not a green verdict for the concurrently changing whole workspace or a visual
review of the regenerated movie assets.

## Independent finding and narrow follow-up

The initial repairs still partially parented earlier content for a sparse item
array: `s.collection('q',[{id:'a',value:1,handle:a},,])` skipped the hole during
`map` and `flatMap`, constructed `q/item/a`, then failed in `data.entries()`.
Catching that error left `a` unavailable to `s.group('recovery',[a])`.

The root agent authorized this reviewer to own the narrow follow-up.
`collections.ts` now captures items with `Array.from(input,...)` and rejects a
missing item during the initial validation pass. This happens before handle or
generated-ID preflight, and before any scene mutation. Three new regressions
exercise the scene method, standalone factory and serialized public QuickJS
method; they verify both recovery grouping and reuse of `q/item/a` as a fresh
circle. All three failed before the source edit with “Element a already has a
parent group” (02:29:11 local), then passed (02:29:21). The root agent owns the
independent final diff review of this one-line follow-up.

## Reviewed guarantees

`validateGroup` and ordinary `group` share scene-local WeakMap identity, view,
dense/distinct child, descendant and parent checks. Planned IDs use the same
syntax, collision and total-element budget checks as constructors. The public
method reserves no identity or parent membership. Collections preflight their
complete dense data set, all custom handles and all generated wrapper/cell/label
IDs before construction. Current-scene handles retrieved for persistent
elements work; stale handles from the preceding scene are rejected. The public
types and helper/reference documentation describe these boundaries consistently.
Arbitrary user-provided constructor or binding callback side effects remain
outside the transaction promise.

The emergence bound is analytic over the full schedule. For clamped cubic
smoothstep, adjacent shifted weights differ by at most 1 when the shift is at
least 1, or `h*(3-h*h)/2` otherwise, attained at `(1+h)/2`. Thus each desired link
occupies the stated finite segment. Orthogonal projection onto that segment
gives its actual minimum length. The derivative of its angle cosine has the
sign of `lambda*((L·d)^2-|L|^2)`, so the far endpoint is the worst angle. The
initialization check therefore excludes the former collapse/reversal over all
times, rather than only the tested time grid. The conditioning and angular
margins are tighter than the corresponding runtime singularities.

Nonterminal outgoing-link rotation starts continuously because the earlier
weight begins before its successor. A terminal nucleotide has no outgoing
link; retaining its docked orientation through pure translation removes the
previous gating jump without changing other nucleotide frames. The types and
public helper documentation disclose the terminal orientation rule and the
whole-schedule restriction.

## Fresh evidence

- Six focused source suites: **47/47 pass**, 02:29:21 local. These include all
  repaired host/QuickJS failure recovery, generated IDs/budget, default behavior,
  valid oblique schedules, old critical-time rejection, terminal orientation,
  formed links, future targets and arbitrary/reverse seeks.
- Production build after the sparse follow-up: **passes**, 02:30 local.
- Independent built-API audit: **144 schedules**, 129 accepted and 15 rejected;
  **4,902 accepted poses** across distance `.5`–`100`, duration `1e-5`–`86400`
  and directions from exactly collinear through near-collinear to transverse.
  Every rejected schedule also rejects all inspected later/critical times.
  Accepted poses retain finite frames, fixed future targets, terminal docking
  orientation and exact reverse-seek equality. Maximum formed-link error was
  `6.884e-15`; maximum unit-frame error was `2.351e-10`.
- Independent smoothstep check: 11 shift ratios from `1e-12` to `1e6`, each
  sampled at 20,001 points, never exceeds the analytic maximum. Direct evaluation
  at the maximum agrees to `1e-15`. This check supports, but does not replace,
  the analytic argument above.
- Independent host and public QuickJS persistence/recovery audit passes. It
  covers repeated read-only preflight, sparse and already-parented failures,
  stale-host-handle rejection, persistent current-scene handles, time bindings
  and a nonmonotonic sequence of seeks with exact repeated-frame equality.
- Independent continuity audit: 402 neighboring pose pairs around the original
  collapse time and terminal onset, separated by `1e-9` seconds. Maximum position
  change was `2.157e-8`; maximum normal change was `1.376e-9`.

The audit script and JSON are retained under ignored
`data/animlib-expansion/tmp-motion-repair-review/{audit.mjs,audit.json}`.

## Workspace-wide verification boundary

An earlier fresh typecheck before the concurrent processing work passed. The
latest typecheck and full suite were run after the sparse fix, but an unrelated
new `nucleic-processing.test.ts` was deliberately in its failure-first phase,
importing the not-yet-created `src/nucleic-processing.js`. The root agent
confirmed this concurrent ownership and will rerun global checks when that work
is ready. This reviewer did not alter those files.

The latest ordinary full command finished at 02:30 local with **894 passing and
2 failing tests out of 896**, plus the new processing suite failing to import
(73 files: 70 pass, 3 fail). The two test failures were the existing sandbox
`realpath` EPERM cases in `asset-host-preflight.test.ts` and `gltf-files.test.ts`.
Five existing dist sourcemap warnings were also printed. No new elevated rerun
was performed by this reviewer. Consequently this report does not claim that
the current full command or current workspace typecheck passes.

No branch, commit, push, compiler limit, production molecular geometry or proof
asset was changed by this reviewer. The only implementation follow-up is dense
collection input capture, with its three regression tests and this report.

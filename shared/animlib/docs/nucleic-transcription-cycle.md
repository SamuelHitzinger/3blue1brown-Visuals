# Moving transcription cycle

`createNucleicTranscriptionCycleBuilders().nucleicTranscriptionCycle(props,time)` returns pure data for a bounded illustrative elongation cycle, also available as `s.nucleicTranscriptionCycle` in host and QuickJS scenes. It is separate from the fixed-snapshot `nucleicTranscript` contract. Native molecular batches and prepared nucleotide assets consume the returned anchors.

Supply dense explicit antiparallel template/coding arrays and matching complementary pairs, plus a contiguous complementary RNA mapping. The DNA axis is straight in its local frame and can be rigidly oriented anywhere. `radius`, `pitch`, and `twistPerBase` define its closed shape; `window.halfWidth` and `window.separation` define a moving cosine-squared opening. There are at most 128 DNA pairs and 128 RNA sites. The complete schedule must finish within 86,400 seconds.

The continuous register holds while an incoming base rotates/docks, then translocates smoothly to the next register. The active site interpolates the actual template anchors; RNA docks across from that template at twice `baseReach` along its baseward normal. `activeSite.position` is this RNA docking point; `templatePosition` is the corresponding DNA backbone point. `templateIds` are the interpolation endpoints. At an integer register the first endpoint is the exact selected template site.

DNA transverse radius returns to the closed radius behind/ahead of the compact opening. Local angular increments return to the original twist. Each axial increment is solved from the original strand link length, so both symmetric strands preserve their links exactly. Common axial centering can move exterior sites. No perfect exterior pinning is claimed.

Let `r` be radius, `s` separation, `h` half width, `t` twist and `L` the closed link length. A conservative full-schedule preflight requires

`(s*pi/(2*h))² + (abs(t)*max[0<=a<=1]((r+s*a)*(1-a)))² < L²`.

The maximum is evaluated analytically at the clamped stationary point `(s-r)/(2*s)`. The first term bounds radial change using the window gradient; the second uses `sqrt(r1*r2) <= (r1+r2)/2` and `2*abs(sin(dtheta/2)) <= abs(dtheta)`. This sufficient bound can reject some feasible shapes. It prevents latent mid-motion axial collapse rather than checking only the requested instant.

`exitDirection` and `incomingOffset` use the active frame: axis tangent, baseward normal, then their cross product. Formed RNA lies on a prescribed straight rail, at one declared `rnaLinkLength` per register. The entire rail moves in the same continuous active frame; its link lengths remain fixed. It is not a curved path solver, molecular dynamics or an enzyme structure. The direction cannot be parallel to the base normal, because that would make the displayed nucleotide frame degenerate.

Site `i` becomes visible at the absolute arrival time `start+i*cycleDuration` and incorporates at `start+(i+dockFraction)*cycleDuration`. These discrete states compare the supplied time directly with those event times; they never use an epsilon that could trigger an event early. Rotation and offset settle exactly at docking. Only then is its edge to the previous site returned. Completion means every site is incorporated. Progress clamps at the final mapped register, so post-completion samples do not drift. An optional initial `opening` finishes before the first arrival; otherwise the initial window is already open. Final closure is not currently shown or implied.

The factory is side-effect free and self-contained after TypeScript erasure. Focused regressions cover all strand and formed-RNA links, pair radius/twist closure, identity persistence, incoming docking, exact event timestamps and their adjacent representable values, finite-difference frame/position continuity at every event, conservative rejection, input immutability and reverse seeks. Integration tests cover public host/QuickJS construction and retained callbacks through reverse seeks.

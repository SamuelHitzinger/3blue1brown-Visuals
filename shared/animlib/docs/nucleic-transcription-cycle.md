# Moving transcription cycle

`createNucleicTranscriptionCycleBuilders().nucleicTranscriptionCycle(props,time)` returns pure data for a bounded illustrative elongation cycle, also available as `s.nucleicTranscriptionCycle` in host and QuickJS scenes. It is separate from the fixed-snapshot `nucleicTranscript` contract. Native molecular batches and prepared nucleotide assets consume the returned anchors.

Supply dense explicit antiparallel template/coding arrays and matching complementary pairs, plus a contiguous complementary RNA mapping. The DNA axis is straight in its local frame and can be rigidly oriented anywhere. `radius`, `pitch`, and `twistPerBase` define its closed shape; `window.halfWidth` and `window.separation` define a moving cosine-squared opening. There are at most 128 DNA pairs and 128 RNA sites. The complete schedule must finish within 86,400 seconds.

The continuous register holds while an incoming base rotates/docks, then translocates smoothly to the next register. The active site interpolates the actual template anchors; RNA docks across from that template at twice `baseReach` along its baseward normal. `activeSite.position` is this RNA docking point; `templatePosition` is the corresponding DNA backbone point. `templateIds` are the interpolation endpoints. At an integer register the first endpoint is the exact selected template site.

DNA transverse radius returns to the closed radius behind/ahead of the compact opening. Local angular increments return to the original twist. Each axial increment is solved from the original strand link length, so both symmetric strands preserve their links exactly. Common axial centering can move exterior sites. No perfect exterior pinning is claimed.

Let `r` be radius, `s` separation, `h` half width, `t` twist and `L` the closed link length. A conservative full-schedule preflight requires

`(s*pi/(2*h))² + (abs(t)*max[0<=a<=1]((r+s*a)*(1-a)))² < L²`.

The maximum is evaluated analytically at the clamped stationary point `(s-r)/(2*s)`. The first term bounds radial change using the window gradient; the second uses `sqrt(r1*r2) <= (r1+r2)/2` and `2*abs(sin(dtheta/2)) <= abs(dtheta)`. This sufficient bound can reject some feasible shapes. It prevents latent mid-motion axial collapse rather than checking only the requested instant.

By default, `exitDirection` and `incomingOffset` use the active frame: axis tangent, baseward normal, then their cross product. Formed RNA lies on a prescribed straight rail, at one declared `rnaLinkLength` per register. The entire default rail moves in the continuous active frame; its link lengths remain fixed. The direction cannot be parallel to the base normal, because that would make the displayed nucleotide frame degenerate. Explicit `exitFrame:'active'`, `exitBend:0`, and `window.lockOrientation:false` preserve the default output byte for byte.

For a stable anatomical view, `exitFrame:'axis'` interprets `exitDirection` in the fixed declared axis/normal/binormal basis. Its normalized axial component must have magnitude at least 0.1, ensuring a nondegenerate nucleotide frame throughout the schedule. `incomingOffset` continues to use the active frame. The optional `exitBend` specifies a bounded circular rail in radians per link, with zero producing a straight rail. Nonzero magnitude must be between 1e-6 and 0.3, and `abs(exitBend)*(transcript.length-1)` must not exceed pi/2. Curvature is supported only with the axis exit frame. These bounds cover the entire schedule, including inactive sites.

For signed bend `b`, link length `L`, and continuous register offset `q`, the circular displacement is `R*sin(b*q)` along the stable exit direction and `2*R*sin(b*q/2)^2` along its perpendicular curvature direction, where `R=L/(2*sin(b/2))`. Thus adjacent formed anchors have exactly chord length `L`, rather than an arc-length approximation. An unwrapped angular transition carries the base normal from the paired pose to the fixed exit frame across two links, avoiding zero vectors at antipodal orientations. Incoming position and orientation settle at the exact paired pose before its bond appears.

`window.lockOrientation:true` coherently rotates the entire DNA transverse phase so the active baseward normal stays on the declared anatomical normal. It preserves DNA link lengths and local twist differences, but exterior DNA is not world-anchored: this is a deliberate illustrative rotation of the whole strand. The machine can use a fixed anatomical orientation independently of helical phase. None of these options is molecular dynamics, a general curved-path solver, or a deposited enzyme structure.

Site `i` becomes visible at the absolute arrival time `start+i*cycleDuration` and incorporates at `start+(i+dockFraction)*cycleDuration`. These discrete states compare the supplied time directly with those event times; they never use an epsilon that could trigger an event early. Rotation and offset settle exactly at docking. Only then is its edge to the previous site returned. Completion means every site is incorporated. Progress clamps at the final mapped register, so post-completion samples do not drift. An optional initial `opening` finishes before the first arrival; otherwise the initial window is already open. Final closure is not currently shown or implied.

The factory is side-effect free and self-contained after TypeScript erasure. Focused regressions cover all strand and formed-RNA links, pair radius/twist closure, identity persistence, incoming docking, exact event timestamps and their adjacent representable values, finite-difference frame/position continuity at every event, conservative rejection, input immutability and reverse seeks. Integration tests cover public host/QuickJS construction and retained callbacks through reverse seeks.

The [current mathematical proof](../demo/expansion/transcription-cycle-revision3.mjs)
uses a versioned eight-arrival schedule, sparse native geometry and curved RNA
emergence. Run it from repository root after building animlib, then render its
generated `cycle-manifest.json` or `cycle-frames.json` under
`data/animlib-expansion/transcription-cycle-revision3/`.
[Independent review](../../../docs/animlib-expansion/transcription-cycle-revision3-independent-review.md)
accepts reasoning, readability, current art and media for that bounded operation.

# Independent motion and complete-frame review

Reviewed 2026-10-11. This reviewer made no implementation or Git changes. The
explanation skill, its three baseline images and separate review gate were read
and viewed. These judgments use the actual media, not the authors' readiness
claims. A bounded mechanism pass does not establish the user's broader
nearly-identical source-motion target.

## Exact coverage

Viewed every whole-composition source sample in these ordered sheets:

- Artem `QHj9uVmwA_0`: all 41 nominal one-second captures, 260–300s, in
  `neural-trajectory-complete/sheet-01..03.png`; all 178 actual continuous-playback
  captures, 264.025364–290.096063s, in `growth-playback/sheet-01..06.png`.
- Matrix `kYB8IZa5AuE`: all 75 nominal one-second captures, 249–323s, in
  `matrix-complete/sheet-01..05.png`; all 94 continuous-playback captures,
  297.109278–311.022985s, in `term-playback/sheet-01..06.png`.
- Reducible: all 51 ready captures at nominal 273–327s in
  `reducible-complete/valid-sheet-01..06.png`. Excluded 007/013/035/049 because
  their recorded readyState is 1. This source coverage establishes sequential
  states and composition, not precise subsecond insertion easing.

The playback captures are irregular browser samples, not every encoded source
frame. Source was inspected as ordered full-composition frames, not personally
played in real time by this reviewer. Source pixels were not used in output.

Independently decoded each complete released film to 6fps ordered sheets in
`data/animlib-expansion/motion-visual-review/`, then viewed every resulting sheet:
57 neural samples, 51 matrix samples and 45 frontier samples. Native full frames
at both 1280×720 and 960×720 were inspected: neural indices 0/1/3/4/7/9
(setup/compression/2.4s/3.4s/8.5s/reverse3.4s); matrix 0/3/5/8
(0/3.75/5.5/8.5s); frontier 0/5/7/9 (0/3.9/4.9/7.4s).
This is whole-duration dense sampled motion review, not every-frame inspection.

| Candidate | Independently confirmed SHA-256 | Stream |
|---|---|---|
| Neural first release | `00e3e2893d80dbaa390cabddcc029c13b8192e4aa00668f5c510542f52081e96` | 9.5s, 1280×720, 30fps, silent H.264 |
| Matrix transport | `e8d14f1c500e209eddaf106fae7a009ba6d07e0aa4ec5d1cac0821cd323c8310` | 8.5s, 1280×720, 30fps, silent H.264 |
| Frontier first release | `871476e828d5170c948431bbd110dcd597be96e79edad059e3d8d198a9ebdd74` | 7.5s, 1280×720, 30fps, silent H.264 |

All three full decodes succeeded. Independent neural PNG byte comparison confirms
the supplied 3.4s and reverse3.4s frames are identical at both aspects. Independent
matrix hold ROI comparison across seven decoded samples beginning 7.2s found
maximum channel deltas 3/6/6/6/8/8, with no channel delta above 16 in the
450×590 text region at (200,30). Apparent missing glyphs in the contact-sheet
display are therefore not evidence of real glyph disappearance. Checks are saved
in `motion-visual-review/independent-checks.json`. This does not resolve the known
separate baseline native MSAA nondeterminism or replace root's test-suite audit.

## Separate verdicts

| Candidate | Reasoning | Visual readability | Reference motion/style | Technical delivery |
|---|---|---|---|---|
| Neural first release | ready for explicit synthetic projection | ready | revise | ready |
| Matrix transport | ready | ready | ready for the inspected column-to-sum-to-row operation | ready |
| Frontier first release | ready | ready | revise for near-identical record/style target; exact easing unverified | ready |

These are not averaged. Neural and frontier revisions are requested below. No
judgment about the molecular builder's still-changing output is implied.

## Neural correspondence and necessary revision

At 0–1.6s the same five trace colors, markers and numeric entries remain visible
while the construction compresses horizontally. At 2.4–8.5s the common cursor
advances, numeric entries track the colored trace ordinates, three component
guides meet the white projected point, and the path grows from that point without
visible resets. The endpoint is held for the final second. Local axis labels,
vector brackets and projection formula fit both aspects. The explicit
`p(t)=(f1,f2,f5)/5` and synthetic-rates label avoid claiming a recovered manifold.
The geometry itself establishes a state-to-point mapping without a footer.

The source's 266–290s composition differs materially: short traces occupy the
upper-left region while a large spatial world and trajectory dominate the
lower/right frame. The candidate keeps five full-height traces and a large vector
beside a comparatively small right-side spatial plot. Its smoother, thicker rate
bumps, monochrome purple path, and restrained viewpoint change also differ from
the source's fine irregular traces, evolving purple-to-cyan trajectory and larger
continuous change of viewing direction. These are authoring choices, not necessary
consequences of an explicit projection or native engine.

Requested revision: compress the rows/vector vertically into the upper-left;
give the spatial path most of the right/lower world; thin the rates and retain
their irregular temporal detail; make the orbit clearly reveal depth while
preserving correspondence. Use a clear chronological trail encoding (or a neutral
trail) so it does not appear to mean only the purple f3 component, which is not
one of the selected coordinates. Recheck 2.4–8.5s and both-aspect endpoint after
the change. The builder has received these findings; its new release is pending.

## Matrix transport

The plane owns the frame. Original `(1,-1)` and `(2,1)` columns remain beside their
vectors. From 0.65–2.85s a copied first vector doubles and a copied second vector
travels head-to-tail; the yellow resultant joins the same endpoints. At roughly
3.2–4.3s copied columns travel into the persistent scalar/sum anchors. Around
4.8–5.95s copies supply corresponding rows of arithmetic. The consequence
`(4,-1)` then appears with geometric coordinate guides and holds. Stable colors
and retained originals make the operation reconstructible.

This corresponds directly to the source's retained local columns, copies in the
sum and subsequent row arithmetic. Native endpoints and transport interiors fit
both aspects. The short-lived overlay of copied brackets/row terms during the
morph resolves into clean rows; it is not a permanent collision. No substantive
revision is required for this representative operation.

One optional improvement for broader formula-transport coverage: visibly copy
the scalar 2 into both row products, instead of introducing its row copies while
the original scalar remains stationary. Current arithmetic is still correct and
readable. The proof does not itself demonstrate the source's entire preceding
plane transformation or establish all-formula/channel parity.

## Frontier correspondence and necessary revision

The graph stays fixed as the `1+2=3<7` candidate is considered. Accepted best cost
changes directly 7 to 3, while the old A→C record retains 7. At 3–4.8s all three
route/cost/destination groups travel together through separated lanes; the two C
destinations remain distinguishable by route and cost. The cheaper candidate
settles first and the old record is dimmed/labeled stale. The crossing and final
frames are readable and fit 4:3 without touching the nodes. The purple field,
sans node labels and yellow route emphasis preserve a distinct Reducible family.

For the user's close source-style target, the record construction still needs a
small authoring revision. The source uses compact near-square stacked records
with three distinctly separated route/cost/destination bands and sans/monospaced
content. Native records are substantially wider/squatter, have only the lower
separator, and use serif route/cost glyphs. Compact the records, add the missing
route/cost separator, and use available sans/mono text for all record content.
Retain the existing identity groups and separated crossing lanes. Recheck the
3.9s crossing, 4.9s settled stack and 7.4s hold at both aspects.

Soft source node emphasis versus flat native rings is a secondary fidelity gap;
it must not be presented as an exact visual match. Exact insertion easing remains
unverified because available source evidence here is nominal 1fps. The record
revision can improve the visible match but cannot turn that evidence into a
verified temporal comparison.

## Frontier revision 2 recheck

Independently confirmed the new film SHA-256
`c18226864f3a105714874f3f9e0bad261e3be56e53d017bea9852543d0fb2415`.
The 7.5s, 225-frame, 1280×720, 30fps silent film was decoded completely to
45 samples at 6fps. All four independently generated ordered sheets in
`motion-visual-review/frontier-revision2/` were viewed. Native complete frames
were also viewed at both aspects at 2.2s, 3.9s, 4.9s, 7.49s and reverse 3.9s
(indices 2/6/8/10/11 in `frontier-revision2/`).

The compact near-square records now have all three separated bands and sans
route/cost/destination content. This resolves the requested shape, separator and
typography corrections. Every route and immutable cost remains legible through
the crossing. The settled stack fits with clear separation from graph nodes at
both aspects; the stale record remains identifiable. No new collision or cropping
was observed.

Reasoning, visual readability and technical delivery are **ready**. Reference
composition/style is **ready for this representative insertion/reordering
operation**. The source's soft emphasis and the unverified subsecond source
easing remain explicit limits on a nearly-identical claim. This recheck supersedes
the first frontier release's requested record-style revision, not the broader
source-motion evidence limit.

## Neural revision 2 review

Independently confirmed film SHA-256
`5b442f650e6e4b6a2c692fbcf6c5b1d5062e82416c1531f977ec926575bcebd3`
and decoded/viewed all 57 ordered 6fps samples in five sheets under
`motion-visual-review/neural-r2/`. Viewed full native frames at both aspects,
indices 0/3/5/7/9 (0/2.4/5.45/8.5/reverse3.4s), and directly revisited full
source frames 006 and 020 for composition comparison.

The compact upper-left traces/vector and larger lower/right spatial world resolve
the first release's principal composition issue. The thinner multiscale rates,
purple-to-cyan chronological trail and stronger smooth orbit more closely follow
the inspected source language. The time-color key removes the earlier ambiguity
between trail color and the unused f3 coordinate. Point, guides, numeric entries,
cursor and growing prefix remain visibly coherent through the full sequence;
the final accumulated path holds. These are still explicit synthetic data under
a fixed coordinate selection, not an inferred biological manifold.

One localized readability correction was requested: at 960×720, the f2/5 axis
label contacts the vector's closing bracket at 2.4s and nearly contacts it at
3.4s. Move that label to the right of the axis tip with clear bracket clearance,
then recheck the final film and both-aspect native frames. The rest of this
release needs no new authoring change for the representative mechanism.

The remaining fidelity limit is broader than this correction: source path
geometry/data, axis scale, exact camera schedule and roughly 26-second source
growth differ from this 9.5-second synthetic proof. Those differences must remain
visible in the scope statement; the useful bounded demonstration is not evidence
of nearly-identical whole-channel or full-sequence reproduction.

Final label-corrected release SHA-256:
`89b32212ef7108b56085f6d792e45919697901077e3323af54723c5716153ba2`.
Independently confirmed the hash, decoded and viewed all 57 ordered samples in
`motion-visual-review/neural-r2-final/`, and viewed full native frames at both
aspects at 2.4/3.4/8.5/reverse3.4s. The f2/5 label now clears the bracket and
trajectory. The localized readability finding is resolved. Reasoning, readability,
reference motion/style and technical delivery are **ready for the representative
explicit synthetic projection**. The broader fidelity limits above remain.

## Reducible temporal evidence update

Viewed all 344 full-frame captures in all 22 ordered sheets under
`reducible-complete/insertion-playback/`. The manifest records readyState 4,
playing, 2195×1235: 240 samples from 310.286429–318.551803s, then 104 samples
from 318.937894–335.882646s. There was a pause/resume between bursts, not a seek.
The first burst mostly holds. The second shows four records appearing around
321s, extraction and upward stack movement around 329.24–329.74s, insertion of
a cheaper distinct route around 331.33–331.98s, and another extraction around
333.42–334.25s. Ads are excluded.

This replaces the earlier complete lack of source subsecond evidence. The source
uses compact vertical stack shifts, a short lateral extraction, and long reading
holds. Revision 2 preserves the record mechanism and readable card anatomy, but
uses longer separated sideways lanes and simultaneous crossing. Its bounded
operation remains ready; nearly-identical choreography remains **revise**.
The next direct fidelity proof should use compact insertion/pop travel and source
hold proportions, preserving all distinct route IDs and the stale record.

## Biological motion review

### Exact coverage and delivery

Independently hashed the four released films, decoded each whole duration to
ordered 8fps contact sheets, and personally viewed every sheet: 64 samples per
film, 256 total. Evidence is under `motion-visual-review/peptide-{16x9,4x3}/`
and `transcription-{16x9,4x3}/`, four sheets and decode log per directory.
Each film is 8s, 240 frames, 30fps, silent H.264/yuv420p; aspects are 1280×720
and 960×720. These are dense sampled motion inspections, not a claim that every
encoded frame was individually viewed or that playback was watched in realtime.

| Film | SHA-256 |
|---|---|
| peptide-16x9 | `818635a179a34368da0b4d65061b7a9cfce812825f150440106c78221be0d763` |
| peptide-4x3 | `c002b0a1808c5318f9964cad3b0a9016de895ea4b54e60cbdcec09ecf56d0d93` |
| transcription-16x9 | `7a04a71b281e0986fee7193ada2550171534a1e4f9584322adda25b8dcf3070b` |
| transcription-4x3 | `860d79f1ea671faadd070fdc666fe91f2389a353d17050e81bbb86477eca13a3` |

Also viewed complete native frames at both aspects: peptide 0/2.6/4.7/7.5s
(indices 0/4/7/11); transcription 1.7/4.3/6/7.5s (indices 4/8/10/11).
Thus no readability judgment depends solely on reduced contact-sheet tiles.

Direct source comparison covered:

- Nucleus: all 240 nominal one-second full-frame captures, 0–238.999457s,
  across opening 01–04, transcription 01–03, export 01–03, translation 01–03
  and ending 01–02 sheets. These are paused readyState 4 samples. Also viewed
  all 109 ready/playing growth captures, 115.235881–131.124844s, in all seven
  `growth-playback` sheets.
- Protein Folding: the complete 140-sample chronology, 0–138.999385s, across
  opening/middle/ending sheets, the separate `credits-128-133.png`, and raw
  final frame 139. Late credits were captured in an embedded player rather
  than fullscreen. Also viewed all 127 ready/playing folding captures,
  70.181226–87.092365s, in all eight `folding-playback` sheets.

The one-second chronology establishes full-scene sequence and composition; it
does not resolve subsecond easing outside the separately captured playback
windows. Nucleus and the PyMOL/Ask A Biologist folding presentation remain
separate reference families.

### Peptide verdict

**Reasoning: ready for the explicitly illustrative torsion sequence.** Persistent
rainbow regions survive local bending, compaction and surface reveal. The
surface follows the endpoint shape rather than replacing it with an unrelated
protein. This visual finding does not establish physical folding dynamics,
collision freedom, or scientific validity beyond the stated model.

**Readability: revise.** At 0s in both native aspects, the entire 72-residue chain
is effectively one very thin horizontal line near y=360. Branch detail is
barely distinguishable and most of the frame is unused. The camera later makes
the sticks readable, but the first local coil formation lacks an immediately
legible backbone. At 2.6s, branches compete with the local repeat shape. Text is
legible and there is no whole-object clipping in the inspected native frames.

**Reference motion/style: revise.** The source stages an extended looped chain
across the canvas, changes representation to bright backbone beads before
folding, shows prominent repeated local coils, holds, then compacts and rotates.
The candidate has the broad local-to-global ordering but keeps atom sticks as
the dominant folding representation. Its final envelope is visibly faceted and
less softly lit than the reference. Different amino-acid sequence and exact
terminal geometry are not themselves missing capabilities; readable backbone
emphasis, composition, representation transitions and hold structure are.

Smallest corrective proof: stage a broadly looped extended conformation using
the existing valid torsion model; emphasize a bright bead/tube backbone while
local coils form, retain visible connecting loops, hold the local structure,
then compact it and reveal the same-conformer envelope. Keep side-chain detail
available through a representation transition. Validate both full native
aspects through the early formation interval, not just the final surface.

**Technical delivery: ready for these offline media.** Decodes, dimensions and
hashes are verified. API correctness and runtime budgets belong to the separate
technical review; this verdict does not claim realtime performance.

### Transcription verdict

**Reasoning: revise for the claimed triplet-focus beat.** Incoming bases visibly
rotate, settle and join; prior RNA remains connected and emerges rather than
being discarded. Those bounded operations read coherently. But at 6–7.5s the
caption says “One persistent RNA triplet: U–G–C” while eight RNA bases retain
equal visual weight. No bracket or individual letters identify exactly the
claimed three. Their persistence may be numerically established, but the viewer
cannot verify the correspondence from the picture.

**Readability: revise.** Add an anchored three-base bracket and local U/G/C
letters, then make those three bases the clear close-up subject. The source
focuses on three large foreground bases and suppresses surrounding material;
the candidate retains a large, equally crisp bubble, helix and machinery.
The native 4:3 view makes this competition especially apparent. The labels
themselves remain readable in the inspected files.

**Reference motion/style: revise.** Relative shell motion, rotation on arrival
and continuing RNA exit are useful additions. They still sit inside a fixed,
wide reaction bubble. A moving chemical reaction window is not shown. Flat
extruded base plates, a dark C-shaped shell and empty black surroundings do
not reproduce the Nucleus source's rounded sugar/base anatomy, lit organic
machinery, depth, environmental population and focus changes. The source also
changes scale from the whole complex into its active site. Arbitrary nucleotide
sequence differences are separate from these absent motion/presentation tools.

Smallest local corrective proof: retain the eight-site mechanism, but stage a
whole-complex view followed by a true three-base close-up with identity anchors
and reduced background contrast/focus. Demonstrate rounded molecular anatomy
and depth in that small scene before expanding the whole chronology. A diagram
style alternative can be useful, but cannot pass this source-fidelity gate by
declaring itself schematic.

**Technical delivery: ready for these offline media.** All four biological films
decode and their hashes match the release. The separate technical review must
assess invariants, host/VM parity and budget limits.

## Ranked remaining Nucleus capabilities

The current transcription and peptide proofs do not cover the full 239-second
Nucleus chronology. The following ranks are implementation priorities, not an
average score or permission to close the broader goal after the first item.

1. **Organic close-up staging and focus, then a moving active site.** Reusable
   rounded subunit geometry, depth-aware contrast/focus and camera transitions
   should support whole machinery → active site → identified triplet. Minimum
   proof: several bases rotate/join while RNA exits, the active bubble advances
   and closes behind the machinery, then the same three bases become the
   foreground subject. This addresses the largest visible gap in the existing
   film and supports the source's roughly 80–131s sequence. Add a sparse depth
   environment rather than requiring a whole cell as the first milestone.
2. **Chain split, remove and rejoin with retained identities.** The source's
   roughly 132–149s passage shows enzyme approach, intron emphasis, cutting,
   loop/remnant removal and exon continuity. Minimum reusable proof: one colored
   removable segment between two retained segments, explicit cut endpoints,
   retained ends meeting and forming the replacement connection, and the
   removed segment departing. Merely fading an interval leaves the central
   topological operation unproved. Test reverse seeks, identities and the
   absence of a phantom old bridge throughout the operation.
3. **Flexible chain transport through a visible aperture.** Roughly 150–156s
   shows RNA threading through a nuclear pore and emerging on the other side.
   Minimum proof: a membrane patch, one rounded pore, and one persistent chain
   fed through it with continuous bending and correct near/far occlusion. Use
   two camera views or a smooth move around the pore so “through” is visible.
   Moving a rigid chain beside a ring would not prove transport.
4. **Translation assembly, repeated docking, transfer, advance and release.**
   Roughly 160–224s includes ribosome-subunit assembly, codon/anticodon focus,
   repeated tRNA arrival/exit, increasing peptide length, stop recognition,
   product release and subunit separation. Minimum proof: a short RNA with
   two complete addition cycles and a stop event. Keep codon, tRNA, amino-acid
   and chain identities connected; show the chain transfer and one-register
   advance, then release the same accumulated product. This needs attachment
   changes and coordinated staging, beyond independent objects moving nearby.
5. **Cell-scale environment and connected changes of scale.** The early source
   establishes nucleus/cytoplasm with membrane folds, surrounding organelles,
   selective desaturation and a camera transition to DNA. Minimum proof after
   the molecular operations: a small layered cellular environment, selected
   structure emphasis, and a continuous or motivated cut into a molecular
   scene. This is necessary for full composition coverage but can reuse the
   depth/focus tools from item 1.

Each next release should carry an immutable film hash, both-aspect native frames,
full-duration dense motion samples, and direct source playback around its new
operation. The present one-second samples can guide chronology and shape, but
additional uninterrupted source playback is needed to judge exact cut/rejoin,
pore and translation easing. Completion requires these missing operations and
their composition to pass independently; the existing mathematical and neural
bounded passes do not offset biological revise verdicts.

# Independent biological motion review, revision 2

Reviewed 2026-10-11 after the author explicitly froze all four films, native frames
and assets. This reviewer changed no implementation, production asset, branch or
commit. The explanation-style skill, its three baseline images and review gate
were inspected. The biological sources below determine the visual target; the
Euler baseline is not imposed on molecular material.

## Release verdict

**Do not close the full reference-fidelity target.** The RNA identity/focus
correction passes its bounded improvement gate. The peptide's broad opening,
backbone emphasis and representation sequence improve substantially, but the
local-coil presentation still needs revision. These are independent judgments,
not an average across successful tests or other animation families.

| Film, both aspects | Reasoning | Visual readability | Reference motion/style | Technical delivery |
|---|---|---|---|---|
| Peptide revision 2 | ready for explicitly illustrative torsion motion | revise for coil presentation | revise | ready for inspected offline media |
| RNA revision 2 | ready for bounded rotate/join/emerge and persistent triplet | ready for that bounded operation | revise | ready for inspected offline media |

The reasoning verdict does not certify physical folding, chemical dynamics,
collision freedom, atomically accurate nucleotide anatomy, or a real polymerase.
The technical verdict covers the delivered files; runtime/API correctness and
budgets remain the separate technical review's responsibility.

## Exact evidence and frozen identities

Personally viewed every tile of all sixteen supplied MP4-derived ordered 8fps
sheets in `data/animlib-expansion/biological-motion-revision2/`: sheets 01–04 for
each of peptide-16x9, peptide-4x3, transcription-16x9 and transcription-4x3.
That is **64 sampled full-composition frames per film, 256 total**, covering the
whole eight-second duration. This is dense sampled motion inspection, not
realtime playback or individual inspection of all 960 encoded frames.

Also viewed **24 complete native frames**, without relying on contact-sheet
scale for readability:

- Peptide, both 1280×720 and 960×720: indices 0/3/4/5/7/9/11, corresponding to
  0/1.8/2.6/3.3/4.7/5.9/7.5s, in `peptide-frames/`.
- RNA, both aspects: indices 4/8/9/10/11, corresponding to
  1.7/4.3/5/6/7.5s, in `transcription-frames/`.

Independently decoded and viewed another five complete encoded frames: peptide
at 2.25 and approximately 2.63s in both aspects, and RNA-16x9 at 7.5s. These are
under `data/animlib-expansion/tmp-bio-visual-r2/`, alongside independent complete
decode logs. All four decodes finished successfully at 240 frames. Their stream
metadata confirms 8s, 30fps, H.264/yuv420p, the stated dimensions and no audio
stream. Independent SHA-256 calculations match the author's frozen manifest:

| File | SHA-256 |
|---|---|
| peptide-16x9.mp4 | `951d154c85fc6217c733e0f8da313d17d1af5153f05d8ba11371d1e3a88b7ddc` |
| peptide-4x3.mp4 | `cc889aae2719d9e64820fd40d42dd6d74c7f960cc4cdaaa6b55dcb987bb0d17b` |
| transcription-16x9.mp4 | `ff263d51b333ad6cfbcad055ecf9f9949cf4f9f7b87670efabac2f522d548497` |
| transcription-4x3.mp4 | `79585094790b290c37c5a7cfb5716f23a2beb66c265c654724aa6d28badb34da` |

One initial display of the 7.5s native RNA frame omitted U and some leaders.
Redisplaying the same file showed them, and an independent MP4 decode showed
them too. The native file hash is
`c34213ad218a29cf263cfdd79fbea929c77eebd3d1dd0a71e2c49730bc10536e`.
This is not filed as a renderer or encoded-film defect.

Directly viewed **268 source samples in seventeen ordered sheets**, plus seven
complete source frames:

- [Protein Folding](https://www.youtube.com/watch?v=yZ2aY5lxEGE): all eight
  `protein-chronology/folding-playback/sheet-01..08.jpg`, 127 ready/playing
  browser captures from 70.181226–87.092365s; full chronology frames
  071/079/103/110 (nominal 71/79/103/110s).
- [Nucleus: How Your Body Creates Proteins](https://www.youtube.com/watch?v=LCIkd-WwC7o):
  all seven `nucleus-chronology/growth-playback/sheet-01..07.jpg`, 109
  ready/playing captures from 115.235881–131.124844s; full chronology frames
  119 and 124.
- [Transcription (DNA to mRNA)](https://www.youtube.com/watch?v=_Zyb8bpGMR0):
  `transcription-late/opening/sheet32-64-03.jpg` and `sheet32-64-04.jpg`, all
  32 half-second samples from 47.999883–63.499836s, plus full frame 104
  (approximately 52s).

All these paths are under `data/animlib-expansion/`. Source playback captures
are irregular browser samples, not every encoded source frame. The transcription
half-second samples support sequence/composition comparison but not precise
subsecond easing. No source pixels were used as production assets. The newly
captured splicing/translation directories are outside this current proof's
review scope and are not counted as inspected here.

## Peptide: what changed and what remains

The 0s full frame now uses a broad diagonal chain with turns and a clear rainbow
progression. It no longer collapses into a thin horizontal stroke. CA beads and
their connecting tube make the backbone trackable while side-chain strokes
recede. The same colored regions survive formation, compaction, the branched
stick view at 5.9s, and the envelope at 7.5s. No whole-object clipping was observed
in either aspect. The representation transition visibly follows the compact
object instead of replacing it with an unrelated silhouette. Exact conformer
identity is a quantitative claim addressed by the author's invariant checks,
not something pixels alone can prove.

The remaining local-coil issue is substantive. In the source, separated horizontal
regions curl into repeated, side-visible turns while retaining a comprehensible
overall layout. The source then holds the local structure before global packing.
In the candidate's roughly 0.6–2.5s interval, the chain repeatedly swings between
wide horizontal and narrow vertical projected shapes. Near 2.25s the upper
green/cyan region is small while the orange region is nearly vertical; the view
then enlarges into the held pose. At 2.6/3.3s the orange coil reads largely as a
compact end-on cluster, while other regions read as short loops or zigzags. The
beads are visible, but the intended repeated local secondary structure is less
immediately reconstructible than the source's clear series of turns. This is a
view/staging complaint, not a claim that the torsion implementation has no helices.

Smallest repair: choose connecting-loop torsions and a viewpoint that expose
several turns of each helical block from the side, retain their relative layout
during formation, and smooth the framing so the forming structure remains large.
Hold that unmistakable local-coil state before compaction. Recheck the full
0.6–3.4s interval at both aspects; a larger final frame alone is insufficient.
This need not copy the source's exact protein sequence or coordinates.

Concrete comparison anchors are native index 3 at 1.8s (wide zigzag), independently
decoded 2.25s (narrow vertical composition), native index 4 at 2.6s and index 5
at 3.3s (orange end-on cluster and foreshortened upper coil). Begin the correction
with one fixed formation viewpoint and connecting loops that place the helical
axes approximately across the image rather than toward the camera. Retain
visible connectors and separation between blocks. Limit camera changes during
formation to a gradual framing adjustment, then allow the stronger orbit during
global packing. These are authoring constraints; pixels alone cannot determine
how much of the current projected swing comes from torsions versus camera motion.

The final envelope remains visibly coarser than the source's softly lit surface.
At 7.5s, angular silhouette facets, jagged sequence-color boundaries and a very
flat saturated blue central patch interrupt the otherwise rounded shape. Improve
surface tessellation/normal continuity and lighting/color interpolation while
retaining the same endpoint geometry and residue-color correspondence. Diagnose
the cause before attributing it to the renderer. Recheck the entire 6.25–8s reveal
and orbit against source frame 110, not only a still of the front face.

The angular silhouette and stepped color edges are visible geometry/color-detail
limits in the native 7.5s frames; additional highlights alone cannot remove them.
The muted broad illumination versus the source's soft bright highlights is a
separate material/lighting mismatch. Whether the flat blue patch specifically
comes from coarse normals, color assignment or material settings is unverified
by this visual review and should be diagnosed before a corrective implementation.

Thus broad opening, CA emphasis, preserved colors and sticks-to-envelope staging
pass as improvements. The coil readability correction and the close source-style
gate remain open; changing the scope label to “schematic” would not resolve them.

## RNA: bounded focus correction passes, full style does not

The native 1.7/4.3s views show separate colored base bodies, pale sugar bodies and
orange phosphate bodies. Rotating arrivals, settled additions and an emerging
connected RNA chain remain trackable. The machinery now has rounded volume and
an aperture instead of the earlier dark C-shaped plate. The whole-to-close view
is motivated by the same RNA chain.

By 6s, U/G/C have their own readable letters and leaders, and a bracket groups
exactly those three foreground bases. They remain the dominant subject through
7.5s while surrounding DNA, RNA and machinery lose contrast. Both aspects retain
the triplet, bracket and labels without clipping. Contextual DNA extending beyond
the close-up frame is intentional reframing, not loss of the selected subject.
Across the inspected final samples, continued exit changes the background chain
relationship without a visible triplet reset. The letters, bracket and contrast
change resolve the previous unidentifiable “one triplet” claim.

However, the direct Nucleus comparison still shows a major visual gap. Its
foreground bases and sugar/backbone forms have distinct lobed silhouettes,
bright soft highlights, depth-separated arrivals and readable complementary
pairing in an active-site close-up. Its triplet fills much more of the frame and
is integrated with a luminous, selectively softened molecular environment. The
candidate's gross rounded bodies remain mostly smooth ovoids, and the four
machinery lobes remain generic separate ellipsoidal masses. Its black environment
and sparse distant bodies provide limited depth. Fading contextual objects helps
attention, but is not optical depth-of-field or the source's lighting treatment.

The separate transcription source also visibly retains an enclosing polymerase,
moving incoming material at several depths, and an RNA end bending away from the
template inside the machinery. The candidate's wide fixed bubble and traversing
lobes do not demonstrate an advancing reaction window with DNA closing behind
it. The film still lacks a readable intermediate active-site close-up between
whole machinery and the isolated triplet. These gaps cannot be passed by citing
the new assets' rounded geometry or the scene's illustrative label.

Next proof: carry at least three visible incorporation/translocation cycles
through a moving opening and reclosing duplex, align the machinery to that active
register, retain the growing RNA, then move through the active-site view to the
same identified triplet. Keep the successful anchors/bracket. Improve the local
anatomy silhouettes, contextual scale/depth and soft illumination in that proof;
evaluate actual depth-of-field separately from transparency.

## Ranked remaining repairs

1. **Finish peptide coil legibility.** Expose repeat turns and stabilize their
   projected layout/scale through formation and hold; this is the remaining
   local revision-2 readability failure, rechecked at 0.6–3.4s in both aspects.
2. **Show RNA active-site progression and its close-up.** Opening, docking,
   incorporation, one-register advance and reclosing must be visible in the
   same persistent system; shell travel alone is insufficient.
3. **Close biological surface/depth fidelity gaps.** Refine the peptide envelope
   and RNA/machinery silhouettes, add source-appropriate lighting/environment,
   and implement and demonstrate optical depth-of-field as a distinct capability;
   transparency is not its substitute. The next RNA proof should hold a sharp
   selected triplet while foreground/background molecular geometry softens with
   depth, then change the focus distance during the active-site transition. Keep
   Protein Folding and the two transcription references as separate families.
4. **Cover the remaining source operations with new reviewed proofs.** Splicing
   cut/remove/rejoin, pore threading, translation docking/transfer/advance/release,
   and connected cell-to-molecule staging remain outside these films. This review
   does not independently validate any newly authored processing proof.

Freeze each corrective release under new hashes, inspect its complete sampled
motion and native frames, and compare the corresponding source passage again.
The bounded RNA pass is useful progress; it is not full-chronology approval.

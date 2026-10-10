# Transcription reference: whole-sequence motion inspection

Source: [Transcription (DNA to mRNA)](https://www.youtube.com/watch?v=_Zyb8bpGMR0).
This supplements `molecular-reference.md`; it does not attribute the original
artwork to the uploader. Inspected by root on 2026-10-11.

## Evidence method and limits

Browser full-screen video, paused and stepped through the actual source frames
using the player's frame-step key. Focus `#movie_player`, not the seek slider:
slider focus caused YouTube's grid-peeking mode to clip earlier screenshots.
Those earlier clipped samples are excluded. No reference frames are production
textures, backgrounds or demo assets.

Saved 141 complete-frame screenshots at nominal 2 fps from 94.033310 through
164.033102 seconds, with source time, readyState, frame bounds and file paths in
`data/animlib-expansion/transcription-late/complete/frames.json`. Frames 0–139
report readyState 4 and full video rectangle top 0, height 1235. Final frame140
reports readyState1 and is excluded until recaptured. Root viewed all samples in
nine complete-frame contact sheets (including partial first sheet). Player
controls sometimes overlay the bottom of the source's own subtitle strip.
These are ordered decoded-frame samples, not a claim to continuous real-time
playback or every source frame.

Then sampled 189 complete frames at nominal 2 fps from 0 through 93.999734 s,
all readyState4, full rectangle top0/height1235. Metadata and twelve contact sheets
are in `data/animlib-expansion/transcription-late/opening/`; root viewed every
sample in those sheets. Combined evidence now covers the entire animation at
half-second intervals through 163.533 s, excluding the final unready sample and
last 0.9 seconds. Full-duration sampled chronology is not full-frame-rate motion
verification; faster transitions need denser local review in later comparisons.

## Observed sequence

| Source interval | Complete-frame observation | Reusable requirement |
| --- | --- | --- |
| 0–4 s | Camera advances among softly focused DNA strands, settles on one curved helix, thin white silhouette and DNA label appear. | Curved double helices, depth separation, camera tracking and semantic emphasis. |
| 4–24 s | Gene interval highlighted, then promoter/terminator intervals labeled in place while camera holds. | Stable interval selection and local labels over repeated helix geometry. |
| 25–34 s | Cut to horizontal DNA; irregular purple polymerase descends, turns and docks. Camera pushes into its surface. | Prepared irregular mesh, coordinated position/orientation/camera tracks and contact hold. |
| 35–48 s | Colored nucleotides pass at several depths. Polymerase becomes translucent enough to reveal open DNA bubble; paired helices continue on both sides. | Bounded reusable particles with perspective/occlusion, controlled transparency and coherent unwinding region. |
| 49–62 s | Nucleotides dock sequentially onto lower template; red RNA backbone extends, bends away with 5′ marker. Circular magnified base-pair inset briefly explains correspondence while assembly continues. | Sequence-preserving attachment, growing coherent strand, labeled endpoints, shared data in magnified views. |
| 63–79 s | Wide shot: polymerase travels toward highlighted terminator then rotates away; RNA releases independently; camera tracks RNA. | Motion along path, staged release, identity preserved across close/wide representations. |
| 80–93 s | RNA shifts to red/yellow segment representation; white outlines alternately mark exon and intron intervals. | Semantic representation transition and interval outlines. |
| 94–101 s | Red continuous RNA curve with yellow internal segments, slowly changing framing against blue-purple nuclear background. Long reading hold before mechanism. | Stable segment identities and colors on a coherent bent tube; authored holds independent of camera movement. |
| 101–106 s | Small cyan 5′ cap and green 3′ tail markers appear at opposite ends; local labels briefly identify them. | Semantic chain-end anchors and attached labels; color/size independent of tube subdivision. |
| 108–115 s | Several irregular blue proteins approach distinct chain locations from different directions while camera moves closer. Yellow segment bends into a loop as protein cluster assembles. | Multiple absolute-time tracks, transported tube frames, reusable irregular mesh instances, coordinated camera and object movement. |
| 115–118 s | Thin white circle and local “Spliceosome” label isolate assembled cluster; background stays contextual. | Stable annotation anchor through moving camera, world/screen-space choice, readable brief holds. |
| 118–122 s | Yellow loop separates; red flanks reconnect into continuous chain. Proteins depart along distinct paths. Small white circle and “Excised intron” label follow removed loop. | Explicit identity/topology handoff with no spurious bridge across removed segment; independently moving excised piece and persistent remaining chain. This is staged mechanism, not generic mesh morph. |
| 124–131 s | RNA moves right through a visible pore in blue nuclear boundary into pink cytoplasm. Camera tracks along it, revealing environment and occlusion by membrane. | World-space occlusion and coherent camera tracking through a prepared membrane model; reusable environment geometry and source-colored materials. |
| 132–137 s | Camera approaches RNA, which resolves into a red backbone with distinct colored bases. White outline briefly traces chain silhouette and local mRNA label appears. | Correspondence between low-detail and close-detail representations; sequence-preserving base placement, silhouette emphasis and label attachment. |
| 142–146 s | Circular magnified inset grows around three adjacent bases, with larger G/C/A geometry and Codon label; small source circle remains tied to selected triplet. | Linked magnified view/selection, shared semantic IDs and colors, explicit inset transition. Existing view helpers should be checked before new API. |
| 147–154 s | Genetic-code table fades over environment, stays long enough to read, fades away. | Reusable readable table layout/asset without destructive scene changes; this isolated overlay is not the dominant visual style. |
| 155–162 s | Local AUG start marker appears left, three stop-codon alternatives appear right, both with small outline emphasis; full RNA stays contextual. | Semantic grouped triplets, independent labels and deliberate sequential emphasis. |

## Consequences for implementation

New molecular ordered segments/anchors/explicit bonds support chain identity and
prevent accidental cross-segment links. Fixed-length articulated posing addresses
one bounded class of schematic chain motion, but does not itself implement RNA
splicing or claim a physical trajectory. Add a mechanism proof using explicit
before/after segments and whole-scene reversible time sampling.

The cinematic look also needs reusable organic protein/membrane/environment
assets, source-color textures, controlled depth, lighting and camera motion.
Primitive beads alone do not satisfy this reference. Test environment details
with the asset renderer after model/texture reuse exists. Keep this blue-purple
nucleus/pink cytoplasm treatment separate from PyMOL sequence-color folding and
from Nucleus Medical Media's distinct organic interiors.

Evaluation must inspect approach, contact, topology handoff, departure, camera
transport, detail change and final annotation holds. A single attractive endpoint
cannot establish motion parity.

# Protein Folding: complete chronology and continuous motion supplement

Source: https://www.youtube.com/watch?v=yZ2aY5lxEGE. Inspected through the
YouTube player using normal keyboard seek/frame controls and full-frame CUA
screenshots. Source frames are review evidence only, not reusable library assets.

## Observed coverage

`data/animlib-expansion/protein-chronology/frames.json` records 140 nominal
one-second samples, actual times 0–138.999385s of the 140.001s player duration.
All samples had readyState4. Samples0–133 use the complete fullscreen video;
134–139 use the complete 980×551 player inside the page. Root inspected all
ordered contact sheets, plus a separate128–133 sheet because FFmpeg's input-size
change flushed a partially filled tile. YouTube end cards obscure parts of the
credits near the end; no hidden pixels are claimed inspected.

`folding-playback/frames.json` records127 screenshots during actual uninterrupted
muted playback from70.181226 to87.092365s. All have readyState4 and paused=false,
with complete fullscreen framing. Root inspected all eight ordered sheets.
Capture cadence is irregular (about7.5 samples/second), not every decoded frame.

## Visible operation and resulting requirements

- The opening flattened serpentine protein is a branched atomic stick structure.
  Sequence gradient stays stable across representations; atom side branches must
  not be replaced by a chain joining consecutive atom indices.
- During roughly44–60s, residue letters and then beads replace the atomic view
  progressively. Residue identity and correspondence need explicit mappings.
- During roughly71–81s, local corrugations form coils while the extended chain
  compacts. Local motion and global compaction coexist; broad loop interpolation
  alone does not demonstrate equivalent motion. This is a visual requirement,
  not evidence of a measured molecular-dynamics trajectory.
- Roughly82–106s holds/rotates the compact conformation and restores labels then
  atomic sticks. Representation changes need the same residue/atom anchors.
- Roughly107–122s overlays an irregular colored surface, fades out the sticks,
  and rotates the surface. Atomistic geometry and surface must derive from the
  same conformation, with side-chain density and stable sequence colors.
- Final shrink/reposition and credits introduce no additional molecular topology.

The late credit names DeLano Scientific LLC and describes noncommercial
educational reuse. This does not grant CC0 reuse of film geometry or textures.
The repository's separately sourced deposited structure and CCD data require
their own recorded provenance. No source-video pixels were imported as assets.

The new deposited-structure proof and nucleic mechanism are separate work.
This inspection is not approval of their output, nor channel-wide fidelity.

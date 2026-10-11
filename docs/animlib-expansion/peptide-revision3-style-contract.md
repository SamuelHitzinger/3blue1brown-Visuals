# Peptide revision 3: source comparison contract

Reference: [Protein Folding](https://www.youtube.com/watch?v=yZ2aY5lxEGE), especially
the complete captured local-folding playback near 70–87 seconds and native
chronology frames 071 and 079. Source inspection and earlier failures remain in
`biological-motion-visual-round2.md`. This contract does not import the look of
the mathematical or cellular reference families.

The revision must show an initially broad, sequence-colored chain, four legible
local coils before global packing, and a clear hold in which their sides remain
visible. Camera motion must not supply the apparent local folding. Connecting
loops may reconfigure while atom and residue identity persist. After packing,
the same final coordinates must support CA, atom-stick and smoothly shaded
envelope representations, with a deliberate surface reveal and restrained orbit.
All stages must fit 16:9 and 4:3.

The proof uses an original 72-residue sequence and prescribed phi/psi controls;
the reference's exact protein, residue count and physical mechanism are not
claimed. Numerical gates preserve every displayed bond and compact endpoint.
Style acceptance still requires direct comparison of full native frames and
ordered samples spanning both complete films; these checks cannot be replaced
by topology tests or matching selected endpoints.

Implementation: offline, warm-started loop inverse kinematics for the formation
stage; a held side view; retained unit-sphere CA instances; common rigid framing;
the unchanged original compact endpoint; a subdivided cached display envelope
with a sequence texture. No runtime, geometry, or asset budget is increased.

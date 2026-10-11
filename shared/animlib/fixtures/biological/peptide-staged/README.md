# Side-visible peptide staging

`staging.json` stores an original, offline inverse-kinematic presentation of the
72-residue peptide in `../illustrative-peptide/rig.json`. Its 241 nonuniform
progress samples contain phi/psi angles and diagnostic target errors. It is
authored explanatory motion, not a measured or simulated folding trajectory.

Four 12-residue helical blocks remain side-visible while their local torsions
change. Three intervening eight-residue loops supply 18 controls each, including
their boundary torsions. Damped least squares matches all twelve CA anchors of
each downstream block to a translated, alternately reversed first-block shape.
Keeping loop controls as warm starts avoids discontinuous choices between
equivalent solutions. Progress samples concentrate near the extended pose.

Regenerate from the repository root:

```sh
npm --prefix shared/animlib run build
node shared/animlib/tools/prepare-peptide-staging.mjs
```

`demo/expansion/peptide-staged-pose.mjs` evaluates this schedule at absolute time,
then interpolates to the unchanged original compact endpoint. Every displayed
atom is reconstructed by `peptidePose`; no Cartesian atom interpolation stretches
bonds. A common rigid transform aligns the first helix for presentation.
Packing is a prescribed torsion transition without collision avoidance.
Original staging data and preparation code are dedicated under CC0-1.0; pinned
CCD component provenance remains in the original fixture's README and rig.

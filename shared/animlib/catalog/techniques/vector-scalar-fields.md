# Vector and scalar fields

## Inputs and truth
Supply a field formula or bounded vector samples, coordinate frame, units, domain and singularity mask. For electrostatics, provide potential and its corresponding field; do not invent a potential for an arbitrary vector field. Identify analytic, measured and schematic inputs separately.

## Construction
Start with one probe at a marked point. Draw its vector, then show neighboring probes and the local scalar change that explains its direction. Expand into a sparse lattice only after this relationship is visible. Use native `s.arrow3D` and a scalar-colored `s.surface` or mesh. Derive all arrows, probes and surfaces from the same formula. Explicitly encode whether arrow length is magnitude, clipped magnitude or direction only. A moving particle is a separate trajectory requiring its own equation.

## Fast path and checks
Reuse a fixed lattice and retained `s.bind` updates; build surface topology once. Begin with tens of arrows and a modest surface grid, then inspect occlusion before adding samples. Never solve a field equation inside a per-frame binding. Check zero vectors, singularities, units and numerical values at selected points. When claiming an electrostatic gradient relationship, compare a finite difference of potential with the declared field. Keep meaningful geometry interactive inside its view.

The [surface and field recipe](../../docs/reference.md#surfaces-fields-and-informative-views) gives installed APIs. Request `read_animlib_reference` ID `surfaces-fields-and-informative-views` when available.

## Sources and limits
[OpenStax: equipotential lines](https://openstax.org/books/college-physics/pages/19-4-equipotential-lines) supports the field/equipotential relationship. This method supplies a representation, not a Maxwell, fluid or PDE solver. Sparse arrows and illustrative streamlines do not establish a continuous field solution.

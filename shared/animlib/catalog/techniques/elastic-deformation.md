# Elastic deformation and stress correspondence

## Inputs and truth
Provide undeformed coordinates, displacement field, material assumptions, loads, boundary conditions and any stress/strain data. Keep measured, numerically solved and schematic fields distinct. Displacement alone does not determine stress without a constitutive model.

## Construction
Mark a few material points and a local reference segment before deformation. Apply the same displacement to the surface, reference grid, markers and strain measurement. Use `s.deform` or retained mesh vertices for fixed topology. If showing a supplied stress field, use a stated scalar component or invariant and a fixed scale; colors must not silently change meaning across frames.

The [fixed-topology API](../../docs/reference.md#fixed-topology-deformation-and-scene-time) and [modal-state contract](../../docs/scientific-state.md) cover retained geometry and prescribed vibrations. Mode shapes do not automatically supply stress.

## Fast path and checks
Use a coarse mesh that exposes the relationship; prepare dense solved fields externally. Reuse topology and reference coordinates rather than accumulating frame displacement. Check fixed boundaries, zero load, dimensions, selected strain values and direct seeks. Show deformation exaggeration explicitly. A cutaway needs actual section geometry or clipping evidence, not a surface colored as though it were an interior.

## Sources and limits
[OpenStax: stress, strain and elastic modulus](https://openstax.org/books/university-physics-volume-1/pages/12-3-stress-strain-and-elastic-modulus) supplies elementary relationships. Animlib has no constitutive, finite-element, fracture or contact solver. Fixed-topology deformation cannot create cracks, remesh a failure zone or validate a safety limit.

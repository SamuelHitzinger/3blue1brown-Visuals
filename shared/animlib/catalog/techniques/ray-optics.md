# Ray optics and geometric correspondence

## Inputs and truth
Provide interface geometry, oriented normal, refractive indices, incidence direction and the scale of the example. State the geometric-optics assumptions; wavelength-dependent indices or power fractions require their own data.

## Construction
Establish the incident ray and normal before drawing reflected and transmitted directions. Measure angles from that same normal. For one planar interface, calculate directions in authored bounded JavaScript using the supplied indices and Snell's relation. Handle total internal reflection explicitly instead of clamping an impossible transmitted angle. Attach angle arcs and local labels to the geometry that defines them.

Use `s.path`, `s.line3D`, `s.arrow3D` and retained bindings from the [reference](../../docs/reference.md). A 2D plane of incidence is enough for a planar example; use a real 3D view only when the spatial relationship requires it.

## Fast path and checks
One explicit interface and a few rays teach more quickly than a dense decorative ray bundle. Share one calculation for every path, angle and local equation. Check normal incidence, equal-index media, sign conventions and both sides of the critical angle. Show the reflected branch if discussing energy rather than implying all incident power enters the refracted branch.

## Sources and limits
[OpenStax: refraction](https://openstax.org/books/university-physics-volume-3/pages/1-3-refraction) states the geometric relationship and angle convention. There is no general ray tracer, lens optimizer or optical material database here. Geometric rays do not prove diffraction, polarization, interference or calibrated power.

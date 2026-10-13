# Orbital motion and swept-area reasoning

## Inputs and truth
State the central body, coordinate origin and frame, units, time scale and assumptions. Choose a verified analytic two-body orbit or prepared ephemeris samples. Distinguish illustrative geometry from a specific object's dated position.

## Construction
Derive orbit path, moving body, velocity and swept-area wedges from the same time parameter. Start with the focus and a local radius vector. Mark equal time intervals and construct their swept areas before naming the equal-area relationship. Uniform parameter speed around an ellipse does not produce Keplerian motion.

For prepared states, use [sampled-state](../../docs/sampled-state.md) and preserve source timestamps. The [Horizons source record](../resources/horizons-ephemerides.md) explains upstream requirements. Use true 3D geometry only when inclination or orientation is part of the teaching need.

## Fast path and checks
Reuse one bounded path and a persistent marker. Prepare expensive propagation externally; do not integrate anew for every rendered frame. Check the focus, periapsis/apoapsis, sample frame consistency, time units and area estimates. Use stable spatial scale so camera changes cannot imply varying orbital size. Account for unequal timestamp spacing when measuring areas.

## Sources and limits
[NASA: gravity and Kepler's laws](https://science.nasa.gov/learn/basics-of-space-flight/chapter3-3/) supports orbital and swept-area relationships. The library has no N-body propagator or automatic ephemeris downloader. A two-body illustration does not include perturbations, relativistic effects or mission-grade uncertainties.

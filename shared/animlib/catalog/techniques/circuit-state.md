# Circuit state and charge-flow explanations

## Inputs and truth
Supply circuit topology, component values and units, switch events, initial conditions and an analytic or externally solved state. Drawn wires are not a circuit solver.

## Construction
For a simple series RC charging example, use the supplied resistance, capacitance and source voltage in one analytic calculation. Link capacitor charge, capacitor voltage and current to that same time state. Start at the switch event, show local voltage differences, and then grow the trace. Keep node identity and current direction consistent. Moving markers along wires are illustrative indicators, not literal electron speed.

Use `s.path`, `s.latex` and `s.bind`; for externally solved circuits use [sampled-state](../../docs/sampled-state.md). A layout made from native primitives can retain local charge/voltage annotations without loading a diagramming library.

## Fast path and checks
Use analytic state for a simple circuit and precomputed samples for a larger one. Never integrate circuit equations independently inside each visual binding. Check the initial condition, long-time limit, time constant, sign convention, Kirchhoff relationships and dimensions. At switch boundaries, preserve the relevant physical state instead of easing through an invented intermediate circuit.

## Sources and limits
[OpenStax: RC circuits](https://openstax.org/books/university-physics-volume-2/pages/10-5-rc-circuits) derives the series-RC transient and time constant. No SPICE engine, general topology parser or electromagnetic propagation model is installed. More components require supplied verified solutions, not visually plausible currents.

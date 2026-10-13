# Dynamics and phase portraits

## Inputs and truth
Name the state variables and units, vector field, parameters, initial conditions and time range. Choose an analytic solution, verified external numerical samples or a declared schematic trajectory. Record the numerical method and error estimate when using integrated data.

## Construction
Use a small set of field arrows and one persistent state point. Tie the point's displacement to the local field direction, then grow its path. A companion time trace must use the same samples and current timestamp. With `s.sampledState`, supply an explicit 3-by-N projection and keep missing intervals disconnected. For a supplied oscillatory mode use `s.modalState` and derive both displacement and velocity from it.

Read [sampled-state](../../docs/sampled-state.md), [scientific-state](../../docs/scientific-state.md), or `read_animlib_reference` ID `scientific-traces-and-projected-state`.

## Fast path and checks
Precompute fixed knots outside bindings. Bind marker, trace prefix and tangent to the shared state. Keep the field sparse enough that the trajectory remains legible. Check equilibrium residuals, initial conditions, trajectory derivatives versus the field, units and reverse seeks. Use the same axis scales when comparing parameter cases; a change of camera or normalization must not masquerade as changed dynamics.

## Sources and limits
[MIT: phase portraits](https://www.ocw.mit.edu/courses/18-03sc-differential-equations-fall-2011/pages/unit-iv-first-order-systems/qualitative-behavior-phase-portraits/) describes qualitative trajectory reasoning. Animlib supplies rendering and sample interpolation, not a general ODE solver or stability classifier. Linear interpolation between samples is display interpolation, not an integration scheme. Projection can hide crossings, dimensions and instability.

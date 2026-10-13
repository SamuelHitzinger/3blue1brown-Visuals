# Neural events, rates and projected state

## Inputs and truth
Provide channel-specific event times, sampled timestamps, bandwidth and time units. Distinguish observed spike events from synthetic examples; specify whether an average is over time, repeated trials or neurons.

## Construction
Use `s.eventRates({events, times, bandwidth})` to generate bounded kernel-rate samples. Its output can feed `s.sampledState` with an explicit 3-by-N projection. Show one event's kernel contribution before summing neighboring events into the rate curve. Keep the event raster, trace cursor and projected state aligned to the same timestamp.

The [event-rate recipe](../recipes/event-rates.js) and [scientific-state contract](../../docs/scientific-state.md) give an executable path, kernel definition and bounds. With `read_animlib_reference`, request `scientific-event-rates` and `scientific-state-guide`. Choose a projection only after explaining what each input channel contributes; use the sampled-state missing-data contract if observations are incomplete.

## Fast path and checks
Compute rate samples once per parameter change, not in each frame binding. Restrict the displayed channels and time window before raising sampling density. Check isolated events, empty channels, bandwidth effects and explicit time-unit conversion. Kernel tails near observation boundaries need interpretation; an estimate near the edge is not an extra observed event.

## Sources and limits
[EPFL: mean firing rate](https://neuronaldynamics.epfl.ch/online/Ch7.S2.html) distinguishes averaging definitions; [kernel reconstruction](https://neuronaldynamics.epfl.ch/online/Ch7.S6.html) provides smoothing context. Kernel rates are estimates, not recovered latent states. No spike detection, learned embedding, manifold recovery or causal inference is provided.

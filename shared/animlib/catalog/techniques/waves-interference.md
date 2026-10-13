# Waves and complex interference

## Inputs and truth
Specify each complex amplitude, angular frequency, phase, wave vector, spatial units and time units. State whether the example represents a mathematical complex sum, an optical field or another declared linear wave model.

## Construction
Use `s.complexInterference({waves})`; `at(time, position)` returns individual complex components, their sum and squared magnitude. Start with two component arrows sharing one phase convention. Transport the second head-to-tail, then construct the sum before revealing intensity. Keep the contribution colors across source, vector and spatial trace. At cancellation, show the surviving components even though their sum vanishes.

Adapt the [complete interference recipe](../recipes/complex-interference.js) and [scientific-state contract](../../docs/scientific-state.md). With `read_animlib_reference`, request `scientific-complex-interference` and `scientific-state-guide`. The helper is a scene API, not a network or solver call. Its convention and bounds are part of that contract.

## Fast path and checks
Construct the helper once, reuse fixed-count path samples and evaluate absolute time. Do not compute separate sums for the diagram and readout. Start with two waves and 64 spatial samples; increase only when the claim needs finer structure. Check equal-phase addition, opposite-phase cancellation, phase periodicity and direct versus reverse seeking. Use a shared scale for components and resultant so normalization cannot disguise interference.

## Sources and limits
[MIT: Physics of Waves](https://ocw.mit.edu/courses/8-03sc-physics-iii-vibrations-and-waves-fall-2016/ef731c1b91d77a6db003f6c27e300d25_MIT8_03SCF16_Textbook.pdf) supplies linear-superposition background. Squared amplitude is not automatically calibrated power or normalized quantum probability. No diffraction boundary-value problem, polarization transport or wave-equation solver is provided.

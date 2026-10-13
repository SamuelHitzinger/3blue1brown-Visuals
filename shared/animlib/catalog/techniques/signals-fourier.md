# Signals, Fourier components and reconstruction

## Inputs and truth
Supply the time domain, fundamental frequency, complex coefficients and normalization convention. For measured data, preserve sample rate, window, units and preprocessing; a fitted coefficient set needs its own calculation evidence.

## Construction
A supplied finite Fourier sum can use `s.complexInterference` with wave vectors omitted. Draw individual component phasors, then reveal how each changes the same reconstructed signal. Keep one cursor linking coefficient, rotating component, partial sum and time-domain point. When using both positive and negative frequencies, explicitly state the convention that makes the reconstructed signal real.

Start from the [interference recipe](../recipes/complex-interference.js) and [scientific-state contract](../../docs/scientific-state.md). With `read_animlib_reference`, request `scientific-complex-interference` and `scientific-state-guide`. Existing `s.path`, `s.bind` and `s.sampledState` provide traces and synchronized cursors; no new rendering abstraction is needed.

## Fast path and checks
Use a fixed bounded harmonic list and reuse samples at a declared time spacing. Build static coefficient labels once. Check zero coefficients, phase shifts, known reconstruction points and consistent normalization. Test a simple single harmonic before combining terms. Keep finite-series truncation and discrete-time aliasing visually distinct. Demonstrating a filter requires supplied transfer-function values or verified input/output samples.

## Sources and limits
[MIT: continuous-time Fourier series](https://ocw.mit.edu/courses/res-6-007-signals-and-systems-spring-2011/24eca8c9c36bf5931c022e17fd44dbfc_MITRES_6_007S11_lec07.pdf) documents component reconstruction. Animlib does not perform FFT analysis, coefficient estimation, audio capture or filter design. More drawn harmonics do not establish adequate sampling or experimental fidelity.

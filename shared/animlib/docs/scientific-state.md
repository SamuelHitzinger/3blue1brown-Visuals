# Bounded scientific state

Four small constructors remove repeated mathematical plumbing from scene source.
They produce ordinary values, not geometry or a second scene format. They are
available as `s.modalState`, `s.conservativeTransport`, `s.complexInterference`,
and `s.eventRates` in scene code. Hosts use
`createScientificStateBuilders()` from `animlib/core` with the same signatures.

Construct once outside retained bindings. Reuse the prepared object inside
`s.bind`; do not recreate it for every element or frame. Input arrays are copied
and checked once. `at` returns fresh arrays, so modifying a returned snapshot
does not change future samples. Output remains a pure function of supplied data
and absolute time or discrete step; seeking does not integrate or accumulate state.

These constructors do not infer units, measurements, eigenmodes, causal models,
probability normalization, or scientific provenance. Name those explicitly.
Preserve the normal geometry, rendering, and visual-review limits.

## Modal motion

```js
const motion=s.modalState({
  equilibrium:[-2,2],
  modes:[
    {shape:[1,1],amplitude:.4,angularFrequency:1},
    {shape:[1,-1],amplitude:.4,angularFrequency:2,phase:0},
  ],
});
const {displacement,position,velocity,contributions}=motion.at(time);
```

For coordinate `i`, each mode contributes
`shape[i] * amplitude * cos(angularFrequency * time + phase)`.
`displacement` is their sum; `position` adds `equilibrium` (zero by default).
`velocity` uses the exact derivative of the same modes. Frequencies are angular
frequencies in radians per time unit; `phase` defaults to zero radians.
Mode shapes need not be normalized; their scale combines with amplitude.

This supports supplied vibration modes, acoustic modes, or analogous linear
circuit states. It solves no eigenproblem, coupling equations, damping, contact,
or nonlinear dynamics. A physical claim requires mode shapes and frequencies
consistent with the stated system. The runnable
[modal recipe](../catalog/recipes/modal-state.js) uses two equal masses with
`m=1`, wall springs `k=1`, and coupling `kc=1.5`; its frequencies are 1 and 2.

Limits: 1–32 modes, 1–64 equal-length coordinates. Frequencies must be
nonnegative. Conservative per-coordinate bounds on position and velocity must
not exceed 1,000,000. Each sample costs O(modes × coordinates); no numerical
integration or growing trajectory is retained.

## Conservative transport

```js
const flow=s.conservativeTransport({
  initial:[.8,.2],
  transfers:[
    {id:'a-to-b',from:0,to:1,fraction:.25},
    {id:'b-to-a',from:1,to:0,fraction:.1},
  ],
  steps:5,
});
const {values,flows}=flow.at(2);
```

Indices select compartments. Every transfer fraction applies simultaneously to
its source mass **at the beginning of the step**. The remainder stays at its
source. Outgoing fractions must sum to at most one; fractions and initial masses
are nonnegative. This convention is equivalent to a column-stochastic update
on a column vector. No silent normalization occurs. Self-transfers are rejected;
retention is already implicit. Parallel edges are permitted when IDs differ.

`at(n).values` is the mass after `n` steps. Its `flows` records contain
`{id,from,to,amount}` for the transfer from `n` to `n+1`. The final snapshot has
empty `flows`. Only integer steps in `[0,steps]` are accepted. For an animation,
move these explicit amounts between the endpoints; an interpolated drawing is
not an additional Markov state. See the
[transport recipe](../catalog/recipes/conservative-transport.js).

Use for supplied probability transitions, ecological migration, or conserved
economic stocks. This is a discrete redistribution model, not a continuous-time
solver, population-growth model, prediction, or inferred economic equilibrium.
Mass is conserved to floating-point precision. Initial total must be ≤1,000,000.

Limits: 1–64 compartments, ≤512 edges, 0–256 steps (default 1), unique edge IDs
of 1–64 characters, ≤20,000 stored component slots, and ≤200,000 preparation
operations (`steps * (edges + compartments)`). Preparation computes every step
once. `at` copies one stored row and calculates its edge amounts in
O(compartments + edges); it never reruns preceding steps.

## Complex interference

```js
const waves=s.complexInterference({waves:[
  {amplitude:[1,0]},
  {amplitude:[1,0],waveVector:[2,0,0],angularFrequency:1,phase:0},
]});
const {components,amplitude,intensity}=waves.at(time,[x,y,z]);
```

An amplitude is `[real,imaginary]`. Each component rotates by
`phase + waveVector dot position - angularFrequency * time`; omitted vector,
frequency, phase, and sample position are zero. `amplitude` sums the complex
components. `intensity = real² + imaginary²`: amplitudes combine **before**
squaring. Opposite phases cancel; a common phase leaves intensity unchanged.
Lengths, times, wave numbers, and angular frequencies must use consistent units.

Use for specified coherent optical waves, phasors, or two-path quantum
amplitudes. Intensity is unnormalized: it is not automatically a detection
probability or a probability density with a valid integral. No Schrödinger
equation, polarization, decoherence, many-body system, or spatial propagation
boundary problem is solved. See the
[interference recipe](../catalog/recipes/complex-interference.js).

Limits: 1–64 waves; summed amplitude magnitudes ≤1,000, bounding intensity by
1,000,000 in exact arithmetic. Each sample costs O(waves).

## Event rates

```js
const rates=s.eventRates({
  events:[[.4,.8,1.2],[.7,1.5]],
  times:Array.from({length:121},(_,i)=>i/40),
  bandwidth:.16,
});
const state=s.sampledState({...rates,projection:[[1,0],[0,1],[0,0]]});
```

Each channel supplies event times. The output uses the supplied strictly
increasing sample times and sums Gaussian kernels
`exp(-0.5*((time-event)/bandwidth)²)/(bandwidth*sqrt(2*pi))`.
Bandwidth is the positive standard deviation, in the same units as times;
rates have inverse-time units. Duplicate events count separately, event order
does not matter, and empty channels remain zero. Each kernel integrates to one
over the real line. A finite displayed interval can omit its tails; no edge
correction or renormalization is implied.

The constructor returns independent ordinary `{times,values}` arrays for
`sampledState`, paths, and numeric tracks. There is no second interpolation API:
`sampledState` provides its documented piecewise-linear interpolation between
these knots. Synthetic events must stay labeled synthetic. A bandwidth choice
is an estimation choice, not a measured neural time constant. See the
[event-rate recipe](../catalog/recipes/event-rates.js).

Limits: 1–64 channels, ≤10,000 total events, ≤20,000 output component slots,
and ≤1,000,000 kernel evaluations (`events * sampleTimes`). The conservative
per-channel peak-rate bound must be ≤1,000,000. Preparation costs
O(events × sampleTimes) once; reuse the result instead of convolving per frame.

## Validation, recipes, and measurements

Inputs and sampled times/positions must be finite, with magnitude ≤1,000,000;
the additional bounds above also apply. Sparse, malformed, or mismatched arrays
fail rather than inventing missing measurements. Trigonometric accuracy at
extreme phase arguments remains subject to floating-point arithmetic.
These bounds do not increase the scene VM's existing memory or execution-time
limits. Prepare large measured datasets on the host and select/resample them
with provenance before rendering a bounded scene.

The four recipe files are runnable construction seeds, not complete approved
films or mandatory page layouts. Keep explanatory object identity, show the
causal operation, connect algebra locally, and add a readable endpoint hold.
Compile/seek tests establish implementation behavior; rendered independent
review establishes visual quality only for the exact reviewed candidate.

After building animlib, run
`node shared/animlib/tools/benchmark-scientific-state.mjs` from repository root.
It reports preparation and repeated CPU evaluation separately, including
prepared transport versus recomputing preceding steps. Measurements are local
CPU costs, not GPU frame rates, model latency, or universal speed guarantees.

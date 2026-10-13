# Probability distributions and Bayesian updating

## Inputs and truth
Name the sample space, hypotheses, prior, likelihood and observed evidence. Identify whether the example is supplied measured data or an authored numerical illustration. For a continuous density, declare units and integration range; for masses, supply every outcome used in normalization.

## Construction
Start from the relevant portions of one sample space. Conditioning should visibly select the evidence-compatible region before normalization. For a finite Bayesian example, calculate each unnormalized posterior as prior times likelihood, show these contributions, and then divide by their sum. Preserve hypothesis identity through all stages. Use shared `s.collection` items or native rectangles/paths; density curves can use `s.plane`.

Do not rely on a detached equation or a changing bar height to establish the operation. Show the same selected evidence and normalization denominator geometrically.

## Fast path and checks
Small explicit probability tables are faster and easier to audit than arbitrary simulation. Supply deterministic samples if sampling matters; do not use unseeded randomness during playback. Check nonnegativity, total mass one, zero-evidence cases, posterior normalization and a known hand-worked example. Distinguish density height, interval mass and cumulative probability.

## Sources and limits
[NIST: Bayesian methodology](https://www.itl.nist.gov/div898/handbook/apr/section2/apr1a.htm) supports prior/likelihood/posterior reasoning; [NIST: distributions](https://www.itl.nist.gov/div898/handbook/eda/section3/eda36.htm) explains distributional assumptions. No automatic fitting, posterior sampler or statistical validation is provided. An illustrative distribution does not establish a population claim.

# Reaction stoichiometry and conservative transport

## Inputs and truth
Separate reaction stoichiometry, kinetic assumptions and transported quantity. Choose a conserved basis such as elemental amount or tracer mass; molecule counts can change in a reaction. State units, reservoir boundaries and whether rates are measured, calculated or illustrative.

## Construction
For a closed compartment-transfer example, use `s.conservativeTransport({initial, transfers, steps})`. Each transfer names its source, destination and fraction of the source's current quantity. `at(integerStep)` gives current stocks and outgoing flows; all outgoing fractions from one node must fit its available stock. Show which stock supplies each transfer and where it arrives before presenting the next ledger.

Adapt the [transport recipe](../recipes/conservative-transport.js) and [scientific-state contract](../../docs/scientific-state.md). With `read_animlib_reference`, request `scientific-conservative-transport` and `scientific-state-guide`. For true multi-species reactions, supply validated concentration samples and stoichiometric accounting instead of treating every reaction arrow as this transfer operator.

## Fast path and checks
Precompute bounded discrete states once, reuse their event boundaries and stable transfer IDs. Interpolated visual movement may illustrate transport between states but must not invent continuous chemical kinetics. Check nonnegative stocks, total conserved quantity, per-node balances and the final state's empty outgoing schedule.

## Sources and limits
[OpenStax: reaction rates](https://openstax.org/books/chemistry-2e/pages/12-1-chemical-reaction-rates) relates species rates through stoichiometry; [rate-law limits](https://openstax.org/books/chemistry-2e/pages/12-summary) distinguish experimentally determined kinetics. The helper is not a reaction-network solver and does not infer rate laws, equilibrium or mechanisms.

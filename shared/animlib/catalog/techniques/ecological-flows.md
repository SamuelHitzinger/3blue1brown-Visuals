# Ecological stocks and compartment flows

## Inputs and truth
Choose the tracked quantity, units, reservoirs and boundary. A carbon-stock example, an energy-flow diagram and population migration have different conservation meanings. Provide transfer assumptions or measurements; label illustrative fractions.

## Construction
Use `s.conservativeTransport` for a closed quantity passed among compartments. Keep every stock and transfer ID stable. First follow one transfer from the source's available stock; then construct the receiving stock and show the revised total. External losses need an explicit sink reservoir if using the conservative helper. Birth/death or production/destruction terms need separately supplied states.

The [transport recipe](../recipes/conservative-transport.js) and [scientific-state contract](../../docs/scientific-state.md) define a bounded discrete system. With `read_animlib_reference`, request `scientific-conservative-transport` and `scientific-state-guide`. For a predator-prey or other dynamical model, use verified samples and the phase-portrait technique instead.

## Fast path and checks
Reuse native graph/path shapes and a precomputed stock ledger. Sample only the selected interval and keep units on local quantities. Check every transfer against the source stock, closed-system total, nonnegativity and direct seeking to event boundaries. Avoid continuously easing a discrete population count without explaining the aggregation.

## Sources and limits
[OpenStax: ecology of ecosystems](https://openstax.org/books/biology-2e/pages/46-1-ecology-of-ecosystems) distinguishes ecosystem modeling and flows. This is an accounting visualization, not an ecosystem forecast or empirical calibration. Conserved material does not imply conserved usable energy or constant biological population.

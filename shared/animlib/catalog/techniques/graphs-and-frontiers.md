# Graph search and compact frontiers

Inputs: explicit node positions, nonnegative edge weights, start node, stable node/edge IDs, and stable queue record IDs. The reusable `s.dijkstra` trace supplies events and frontier snapshots; it does not choreograph the explanation automatically.

Use `s.graph` for node/edge emphasis and `s.compactQueue` for insertion/extraction. Use `s.collection` when the operation is a general swap or reorder. Read the [compact queue contract](../../docs/compact-queue.md) and [identity transport guide](../../docs/identity-transport.md) before mixing mechanisms.

Show the candidate path, addition and comparison before accepting a new distance. A discrete graph-cost change is a discrete state change; do not invent fractional algorithm states by tweening accepted costs. Preserve IDs when values tie. Plan motion lanes and clear old helper annotations before moving records through them.

The implementation has bounded graph/collection budgets, unsupported overlapping edge patterns and no automatic collision avoidance. Verify event order, stale entries, accepted predecessors and final costs from the real trace; inspect moving records, queue gaps and local labels at closest approaches. Approved example motion is evidence for its exact representative operation, not all graph sizes or layouts.

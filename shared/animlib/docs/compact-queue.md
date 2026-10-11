# Compact queue transport

`s.compactQueue(id, records, options)` registers a fixed pool of at most 256
records. Each has a unique identity and a string or finite numeric value. Equal
values or destinations remain distinct records. An optional unparented `handle`
keeps a custom route, cost and destination together inside one wrapper.

```js
const queue = s.compactQueue('frontier', [
  { id: 'direct-C', value: 7 },
  { id: 'D', value: 5 },
  { id: 'via-B-C', value: 3 },
], { initialOrder: ['D', 'direct-C'], origin: [-3, 2] });
queue.insert('via-B-C', 0, { start: 1, duration: .65 });
queue.remove('via-B-C', { start: 3, duration: .65 });
s.wait(4);
```

The default orientation is vertical, with width 1.2, height .65 and gap .14.
`orientation:'horizontal'` uses horizontal slots. `initialOrder` is an ordered
subset of registered IDs, defaulting to the input order. Custom content must fit
the declared dimensions. Default cells accept `style` and `fontSize`; custom
handles retain their own appearance. `items` holds persistent wrapper handles,
`data` is frozen copied metadata, and `order` returns a new copy of the final
scheduled order.

`transition(order, {start, duration, entryOffset?, exitOffset?})` changes the
visible subset. Surviving records must preserve their relative order; they share
smoothstep easing between contiguous slots. Arrivals fade from the supplied
offset toward their destination after the first 20% of the transition. Departures
move toward their exit offset and finish fading by 80%. Defaults enter from the
left and exit to the right for vertical queues, with corresponding vertical
offsets for horizontal queues. `insert` and `remove` are convenience operations
on the final scheduled order. Removed identities can be inserted again later.

The helper owns wrapper position and opacity. Style or fade changes for one
record should target its child handle. Authoring transitions does not move the
scene timeline; add `wait` or ordinary plays to cover their time range.

Schedules are absolute, nonoverlapping and ordered, with at most 256 transitions
and end times at most 86,400 seconds. Invalid IDs, sparse orders, nonfinite data,
unrepresentable time intervals or coordinate bounds reject before changing the
schedule. Children are preflighted for ownership and wrapper IDs before creation.
Bindings support arbitrary and reverse seeks. Hidden records remain registered.

This helper does not sort, run a search algorithm or update costs. Create a new
immutable candidate record for a cheaper route. For arbitrary permutations use
`collection.reorder`; compact transport deliberately rejects crossing survivor
orders. Survivor spacing is preserved; arrival/departure fade overlap is authored
choreography, not a general collision-avoidance guarantee.

See `demo/expansion/compact-frontier.js` for a trace-backed Dijkstra example with
short slot shifts, two distinct candidates for C and D, and lateral extraction.

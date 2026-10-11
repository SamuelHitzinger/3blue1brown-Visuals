# Formula copies and collection permutations

Use the existing scene graph and timeline for identity transport. These patterns
are demonstrated by `demo/expansion/matrix-transport.js` and
`demo/expansion/frontier-reorder.js`; they compile in the normal scene sandbox.

## Retained formula sources

Create a second LaTeX handle with the same geometry at the original position,
then move that copy into the next inference. Keep the original visible. A named
part map gives each row or operand a declared destination; repeated numbers do
not establish correspondence automatically.

```js
const column = String.raw`\begin{bmatrix}\animpart{x}{1}\\\animpart{y}{-1}\end{bmatrix}`;
const props = {tex: column, fontSize: .37, fill: 'TEAL', position: [1, -1]};
s.latex('source', props);
const copy = s.latex('operand', props);
s.play(copy.moveTo([-2, 1]), {duration: 1});
s.play(copy.morphTo({
  kind: 'latex', fontSize: .37,
  tex: String.raw`\begin{array}{r}2\cdot\animpart{x}{1}\\2\cdot(\animpart{y}{-1})\end{array}`,
}, {map: {x: 'x', y: 'y'}}), {duration: 1});
```

`anchor` preserves one named part's origin when surrounding content changes.
Use independent ordinary handles for differently colored operands and unchanged
syntax. There is currently **no `partColors` property**; named part mapping and
coloring are separate capabilities. A one-to-one map does not implement arbitrary
split/merge correspondences. A duplicate handle explicitly represents a copy.

## Bounded collection order

`s.collection(id, items, options)` still defaults to horizontal cells. It now
accepts `orientation: 'vertical'` (top to bottom), and optional `item.handle`
for custom content. Content must be an unparented handle from the current scene,
authored around its local origin. The collection wraps it in a normal group
`<collection>/item/<item-id>` and returns that wrapper in `items`.

```js
const candidates = s.collection('frontier', [
  {id: 'direct-C', value: 'C', handle: directRecord},
  {id: 'direct-D', value: 'D', handle: otherRecord},
  {id: 'via-B-C', value: 'C', handle: cheaperRecord},
], {orientation: 'vertical', origin: [-3, 2], width: 1.7, height: 1.15, gap: .26});
candidates.reorder(['via-B-C', 'direct-D', 'direct-C'], {
  start: 3, duration: 2, clearance: .15,
});
```

`reorder` requires a dense complete permutation of all existing IDs, including
hidden entries. It validates IDs and schedule overlap before changing slots or
scheduling motion. Slots describe the final authored order; the retained binding
evaluates the correct intermediate order on arbitrary forward or backward seeks.
It reserves all entries for the interval. Existing `swap` still uses opposing
arcs and retains its horizontal defaults.

Permutation motion lifts entries perpendicular to the collection axis for the
first 20% of its duration, moves along the ordering axis for 60%, then settles for
20%. Each phase uses smoothstep easing. Equal translations share a lane because
their relative spacing cannot change; other translations use different lanes.
Lane spacing is the perpendicular item dimension plus `clearance`. Custom content
must fit the declared width/height, and the author must reserve sufficient free
space for the lanes. Unrotated, unscaled content within those dimensions remains
separated throughout this movement. The helper does not infer glyph bounds or
avoid unrelated geometry elsewhere in the scene.

Insertion/removal visibility is explicit: preallocate at most 256 candidates,
hide unused wrapper groups, reveal them at the algorithm event, then reorder.
Do not use a graph destination ID as a record ID when two candidates reach the
same node. Route, cost and destination belong to a single record group. Keep a
stale candidate's historical cost intact, and update an accepted graph distance
with a zero-duration `countTo` action. Interpolating 7→3 would display costs that
were never accepted by the algorithm.

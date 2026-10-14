# Seekable rigid movement

`s.rigidMotion` applies authored or supplied time-keyed translations and Euler
rotations to immutable prepared geometry. It does not solve dynamics. Use it for
whole-complex orientation or translation and explicitly named rigid subunits.
It cannot explain atom-level flexing, folding, bond-breaking, or measured molecular
dynamics. Supplied transforms need their own scientific evidence and units.

```js
const motion = s.rigidMotion({
  pivot: [0, 0, 0],
  interpolation: 'linear',
  provenance: {kind: 'illustrative', description: 'Authored orientation change'},
  keyframes: [
    {time: 0, translation: [0, 0, 0], rotation: [0, 0, 0]},
    {time: 4, translation: [1, 0, 0], rotation: [0, Math.PI / 2, 0]},
  ],
});
// Each named part must retain its original coordinates and share the model origin.
for (const part of modelParts) s.bind(part, [s.time], t => motion.at(t));
// Prepared model-local landmark follows exactly the same transform.
s.bind(label, [s.time], t => ({position: motion.transformPoint(landmark, t)}));
```

Prepare all model geometry outside the per-frame VM. Load parts at one shared
origin: individually recentering each chain destroys their deposited arrangement.
Apply any display zoom once to a common parent, with identical inherited scale
for labels and landmarks. Pose translations and pivot coordinates use the same
model-local coordinate units as geometry. For independently moving named subunits,
create one explicit controller per subunit and choose each pivot in their shared
coordinate system. Such relative movement is illustrative unless supported by
appropriate supplied transforms; intrapart distances stay fixed.

`at(time)` returns fresh `{position, rotation}` arrays. The renderer applies
rotation about the origin in X, Y, Z order (`Rz Ry Rx`), then adds position.
The helper computes `position = pivot - R(pivot) + translation`, so the pivot
lands at `pivot + translation`. `transformPoint(point, time)` uses precisely the
same operation. Calls are independent of prior samples and work during backward
seeking. Inputs are copied at construction, and returned arrays can be changed
without changing later samples.

Keyframes must strictly increase in time. Between keys, `linear` (default)
interpolates translation and each Euler component directly; `smooth` uses cubic
smoothstep for both. There is no shortest-angle wrapping or quaternion slerp.
For a full turn, supply an explicit `2 * Math.PI` endpoint. Endpoint poses hold
outside the supplied time range; a single keyframe describes a fixed pose.
This interpolation choice makes no claims about physical velocity or forces.

Limits: 1–256 keyframes; exactly three components per vector; all numerical inputs
and sampled times finite with magnitude at most 1,000,000. Pivot compensation and
transformed outputs may exceed individual input magnitudes. Provenance requires
`kind: 'illustrative' | 'supplied'` and a nonempty `description` of at most 2048
characters. `supplied` additionally requires a nonempty `source` with the same
limit (identifier, citation, or prepared-transform file). Retain provenance in the
asset record and visible explanation; declaring supplied provenance is not an
independent validation of that source.

The runnable [rigid-motion recipe](../catalog/recipes/rigid-motion.js) uses fixed
landmarks to show the rigid transform without implying a molecular trajectory.

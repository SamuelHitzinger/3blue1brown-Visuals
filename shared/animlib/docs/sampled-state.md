# Sampled state and projected trajectories

`s.sampledState({times, values, projection})` captures aligned N-component
samples and an explicit 3×N linear projection. It returns ordinary arrays for
the existing paths, markers and time bindings. It does not fit a manifold or
infer missing measurements. The same pure factory is exported as
`createSampledState` from `animlib/core` for host-side data preparation.

```js
export default scene({mode:'3d',end:'hold'}, s => {
  const data=s.sampledState({
    times:[0,1,2,3,4],
    values:[[1,0],[2,1],null,[0,2],[1,3]],
    projection:[[1,0],[0,1],[.5,.5]],
  });
  data.segments.forEach((segment,i)=>{
    const path=s.path('run-'+i,{
      points:data.prefix(i,0),stroke:'BLUE',strokeWidth:.03,
    });
    s.bind(path,[s.time],time=>({
      points:data.prefix(i,time),opacity:time>segment.start?1:0,
    }));
  });
  const marker=s.sphere('sample',{radius:.08,fill:'WHITE'});
  s.bind(marker,[s.time],time=>{
    const sample=data.at(time);
    return {position:sample?.position??[0,0,0],opacity:sample?1:0};
  });
  s.wait(4);
});
```

Times must be strictly increasing. Arrays must have equal length; each non-null
vector has the same 1–64 dimensions. Limits are 20,000 samples and 20,000 component
slots (`sample count × dimensions`, including gaps). All times, components,
projection coefficients and projected coordinates must be finite and have
magnitude at most 1,000,000. Invalid input throws at construction. Sparse arrays
are invalid. At least one non-null vector is required. Inputs are copied.

`at(time)` interpolates components linearly, then applies the captured projection.
It returns fresh `{values, position}` arrays. Exact nonmissing timestamps return
their captured sample; queries outside the sample domain or strictly between a
nonmissing sample and a null sample return `null`. A null timestamp is also null.
Nonfinite queries throw. There is no extrapolation.

`segments` is immutable metadata for each contiguous nonmissing run. A run has
`start`, `end` and fixed `count`; singleton runs have count two.
`prefix(segmentIndex,time)` clamps to that run, retains vertices before the
query and repeats its interpolated endpoint for all later vertices. The result
therefore has fixed topology, ends exactly at the projected state, and cannot
connect across a null gap. Before a run starts it is degenerate; the example
also hides it. Singleton runs produce two identical points. Invalid indices
throw. This API returns fresh arrays and has no accumulated playback history.

The complete original neural proof is
`demo/expansion/neural-trajectory.js`. It uses the same five sampled components
for trace markers, numeric slots and the 3D point. Existing `countTo` tracks
interpolate numeric slots at the same data knots; reactive numeric-slot writes
are not part of this API. Its projection deliberately selects three components,
so different five-dimensional states can have the same displayed point.

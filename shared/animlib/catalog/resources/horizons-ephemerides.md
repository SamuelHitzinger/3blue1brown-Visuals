# JPL Horizons ephemeris source

Readiness: reference only. The catalog provides no Horizons connector, parser, network access or bundled state vectors. Use this route when a host or user can prepare suitable source data; otherwise use a clearly declared analytic illustration.

The [official Horizons manual](https://ssd.jpl.nasa.gov/horizons/manual.html) documents target selection, centers, reference frames, time scales, output units and ephemeris limits. Preserve the exact request and returned header with a dated, hash-identified source snapshot. Geometric state vectors and apparent observer quantities have different meanings; select the output that supports the lesson.

Prepare only the target bodies, interval and sample spacing needed. Convert once into explicit time and position arrays, retaining units and origin. Keep large source files outside the model prompt. Hand bounded arrays to `s.sampledState`; a catalog source URL is not itself an available scene asset. Current production `publish_model` cannot ingest an ephemeris table directly.

Verify several known returned rows, timestamp ordering, frame consistency, interpolation error and coordinate transformations. Document what was omitted. Preserve applicable upstream attribution and usage conditions; listing this source does not assert a blanket license for every derivative input.

See [orbital motion](../techniques/orbital-mechanics.md) for explanatory construction. Source authority does not visually approve an animation or make a sampled display suitable for mission navigation.

# Prepared molecular surface parts

`createMolecularEnvelopeParts` is a host-only preparation function exported by
`animlib/core`. It creates a schematic Gaussian density envelope and partitions
the complete result into reusable meshes. It is not installed in the scene VM.

```js
import { createMolecularEnvelopeParts } from 'animlib/core';

const parts = createMolecularEnvelopeParts({
  positions,                 // packed XYZ; common coordinate units
  origin: [0, 0, 0],
  sigma: 1.2,
  isoLevel: 1.05,
  resolution: 56,
  smoothingIterations: 6,
  trianglesPerPart: 12000,
  maxTotalTriangles: 80000,
});
```

Extraction, smoothing and geometric normals are computed globally before
partitioning. Faces retain their original order and winding; shared coordinates
and normals are copied exactly into each part. No face is dropped. A result that
fits one part equals `createMolecularEnvelope` with matching options exactly.

Use the returned mesh geometry to prepare native model parts, then register and
reuse those assets. Asset packaging still validates its own per-model byte budget
and dependencies. A successful preparation is not a promise that all parts fit
every scene's aggregate geometry budget or render at an interactive frame rate.

| Bound | Value |
|---|---|
| Input sites | 1–100,000 |
| Longest-axis grid cells | 4–64, default 16 |
| Density contribution work | 25,000,000 |
| Smoothing cycles | 0–20, default 6 |
| `maxTotalTriangles` | 1–160,000, default 80,000 |
| `trianglesPerPart` | 64–20,000, default 12,000 |
| Vertices per part | 20,000 |
| Parts | 128 |
| Global vertices and sum of emitted part vertices | Each at most 100,000 |

Exceeding any bound throws. Shared boundary vertices count again in the emitted
vertex sum. Small part sizes can reach the part or duplicated-vertex ceiling;
increase the part size within its limit or lower extraction resolution. Existing
single-mesh `createMolecularEnvelope` retains its 20,000-face/vertex limits and
exact default behavior. Renderer, VM and asset limits are unchanged.

This is a visual density contour, not a solvent-excluded surface, a force field
or a molecular measurement. Smoothing changes the contour. Preserve coordinate
units, source hashes, selection, parameters and license in the prepared asset's
provenance; do not label an illustrative endpoint as experimentally measured.

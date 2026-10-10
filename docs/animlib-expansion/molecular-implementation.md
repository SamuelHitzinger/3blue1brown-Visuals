# Molecular implementation API (pinned)

The factory is self-contained after TypeScript erasure and can be installed verbatim in QuickJS. Pass the existing molecule builder dependency; no external geometry renderer or PDB importer is introduced.

```ts
createMolecularBackboneBuilders(beads: { molecule(props: MoleculeProps): Geometry[] }): {
  molecularBackbone(props: MolecularBackboneProps): MolecularBackboneResult;
  articulatedChainPose(spec: ArticulatedChainSpec, time: number): Vec3[];
}
```

`MolecularBackboneProps` has `segments: MolecularSegment[]`, `bonds: [string,string][]`, required `representation: 'sticks' | 'beads' | 'backbone'`, `radius`, optional `origin`, `radialSegments` (default 8), `samplesPerLink` (default 4), `initialNormal` (default [0,0,1]), `colors` (2–16 palette colors), `maxMeshes` (default 128). Each segment is `{id, chainId, residues: {id, position: Vec3, value: number}[]}`. Segment arrays explicitly define ordered backbone adjacency. Never connect segments, even when chain IDs match. Sticks consume ONLY supplied `bonds`, including explicitly requested inter-segment bonds. Beads reuse existing molecule meshes. Residue IDs are globally unique. Each residue value selects the same normalized [0,1] sequence palette in every representation. Metadata `provenance: {kind: 'schematic' | 'scientific', source: string, units: string}` is required and preserved.

The result is `{meshes: Geometry[], anchors: {id, segmentId, chainId, position: Vec3, value: number}[], segments: {id, residueIds: string[]}[], bonds: [string,string][], vertexResidueIds: string[][], provenance}`. Anchor positions use the shared subtracted origin. Mesh scalar colors and vertex identity arrays preserve sequence color/identity through representation changes; index correspondence exists only for equal representation/topology/settings, not between bead and tube topology.

`ArticulatedChainSpec` has `lengths: number[]`, `from: [bend,twist][]`, `to: [bend,twist][]` (one per link), `start`, `duration`, optional `origin`, `direction` (default [1,0,0]), and `normal` (default [0,1,0]). Angles are radians. At each joint, twist rotates the normal about the current tangent, then bend rotates the tangent towards that normal; the orthonormal frame is transported to the next joint. Angles use clamped smoothstep of absolute time. Input origin is the first anchor. Links remain fixed in length, including interior times and backward seeks. This is schematic kinematics, without collision avoidance, energetics, or a physical folding trajectory.

Integration suggestion: `s.molecularBackbone(id, props): ElementHandle` groups result.meshes just like `s.molecule`; `s.articulatedChainPose(spec,time): Vec3[]` exposes the pure helper for retained geometry callbacks. Host consumers can use result metadata for correspondence/labels and prepare an envelope from identical positions. Dynamic scene authoring can call the pure factory via exported helper or use `s.deriveGeometry` per native mesh; integration owns retained API wiring.

Backbone uses cubic Hermite centerline interpolation with fixed subdivisions, rotation-minimizing frames, and explicit initial normal. Degenerate repeated adjacent anchors and near-exact reversals are rejected. Initial normal parallel to the first tangent is rejected rather than switching arbitrary orientation axes. Open tubes have uncapped ends; beads can cover ends. Native 20,000 vertex/triangle budgets chunk deterministically at ring boundaries. At most 10,000 anchors and 20,000 explicit bonds, plus a bounded total output and mesh count, are accepted.

## Final scene integration contract

The approved SceneContext names are:

```ts
molecularBackboneGeometry(props: MolecularBackboneProps): MolecularBackboneResult;
molecularBackbone(id: string, props: MolecularBackboneProps): ElementHandle;
articulatedChainPose(spec: ArticulatedChainSpec, time: number): Vec3[];
```

The geometry method is pure: it creates no scene elements and returns independently owned meshes and correspondence metadata. The convenience method returns an ordinary group handle, with generated mesh children; anchor lookup stays in the geometry result. Use `s.bind(mesh,[s.time],time => ({vertices, normals}))` to rebuild an equal-topology batch from the pure geometry method. Cross-representation changes use separate same-conformer meshes and opacities; they do not pretend bead/tube/surface vertex indices correspond.

Bead tessellation delegates to the existing molecule builder. Optional `beadDetail`
0/1/2/3 uses 6/18/66/258 vertices and 8/32/128/512 triangles per residue; default
1 preserves existing geometry. Unit sphere templates are private and reused by
the factory; returned meshes own their vertices, normals and triangle arrays.
Sticks use uncapped cylinders and can combine with beads to cover joints.
Single-anchor segments render in beads, and produce no backbone tube. Backbone
closed loops/reversals require explicit segmentation. The specified seed normal
fixes the first ring; motions that make it parallel to the first tangent are
unsupported and rejected. Each disconnected backbone segment uses the same seed.
Sticks project normalized `initialNormal` onto each bond's perpendicular plane.
They reject sine of separation below 1e-7, including parallel and antiparallel
seeds, without an automatic fallback. Choose an initialNormal separated from all
bond tangents throughout the intended motion (e.g. X for a Z-axis bond). This
policy is continuous on its supported domain, not a globally continuous frame
for arbitrary orientations across a pole.

Higher bead detail preserves the same native and aggregate geometry caps. The
live reactive-update payload cap is independent: the 33-residue proof at detail
3 exceeds it, while detail 2 passes. Use smaller models or lower detail for live
deformation; no cap was increased for this option.

All per-mesh ceilings remain 20000 vertices and triangles. Total output is bounded to 500000 vertices and triangles, with triangle preflight before ring allocation. Link output rejects coordinate-relative floating-point loss above 1e-8 relative length error; recenter/rescale tiny chains at large origins. Scientific/schematic provenance is required. Neither the joint pose nor the Gaussian surface is a physical folding model.

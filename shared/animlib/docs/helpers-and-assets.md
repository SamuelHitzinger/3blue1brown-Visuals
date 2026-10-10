# Domain helpers and prepared assets

Use scene helpers to express relationships; use host-prepared assets to reuse
substantial immutable geometry or image pixels. Both reach the same compiler,
absolute-time evaluator, and WebGPU/WebGL2 renderers. There is no second scene format.

| Work | Scene API | Host responsibility / limit |
| --- | --- | --- |
| Coordinate maps | `s.plane`, its paths/vectors/components/labels and `map` | Explicit sampled map, no symbolic algebra |
| Graphs | `s.graph`, `s.dijkstra` | Authored positions; bounded nonnegative-weight search, no automatic layout |
| Collections | `s.collection(...).swap` | Stable item IDs; values can repeat; no general algorithm simulator |
| Ordered molecular geometry | `s.molecularBackbone`, `s.molecularBackboneGeometry`, `s.articulatedChainPose` | Explicit adjacency and schematic kinematics, no energy/collision solver |
| Nucleic mechanism | `s.nucleicDuplex`, `s.nucleicTranscript` return geometry/data | Explicit paired DNA and ordered complementary RNA; schematic, not atomistic dynamics |
| Deposited structures | Use prepared geometry / compact selected coordinates | `importPDBStructure`, `structureBackboneProps`; first-model heavy atoms, explicit bonds/templates; no mmCIF or biological assembly reconstruction |
| Models | `s.model(id,{asset,shading})` | Immutable `createAssetRegistry` / native package decoding; selected static glTF/GLB triangle subset |
| Images | `s.image(id,{asset,width})`; models with UV0 | RGBA8, encoded sRGB, top-left, straight alpha; host `colorPolicy:'source'` required |
| Export | Same scene source | Native frame/video tools and scoped `withOfflineScene` sampling |

## Scene helpers

This complete source uses a coordinate map shared by the grid and vector. The
callback captures the original data coordinates, avoiding cumulative deformation.

```js
export default scene({mode:'2d'}, s => {
  const plane = s.plane('plane', {
    xRange:[-3,3], yRange:[-2,2],
    grid:{stroke:Color.GREY, opacity:0.25},
  });
  plane.vector('v',[1,1],{stroke:Color.YELLOW});
  plane.map([s.time], (p,t) => [p[0]+Math.min(t/2,1)*p[1],p[1]]);
  s.wait(3);
});
```

`plane.components` constructs two orthogonal components. `plane.curve` samples a
parametric curve; `plane.label` keeps its text upright while its anchor follows
the map. Apply one map per plane; geometry added afterward inherits it.

```js
export default scene({}, s => {
  const data = {directed:true,
    nodes:[{id:'A',position:[-2,0]},{id:'B',position:[2,0]}],
    edges:[{id:'AB',from:'A',to:'B',weight:2}]};
  const trace = s.dijkstra(data,'A');
  const graph = s.graph('graph',data);
  s.play(graph.state('A','active',{stroke:Color.YELLOW}),{duration:0.4});
  s.text('result',{text:'Cost: '+trace.distances.B,position:[0,-1]});
  s.wait(1);
});
```

Graph results contain distances, predecessors and immutable `pop`, `relax`,
`stale`, and `frontier` events with frontier snapshots. Authors choose their
presentation and timing; construction does not animate the algorithm for them.
Discrete cost changes should be discrete state changes, not invented intermediate
algorithm values. At most 256 nodes / 2,048 edges; self-loops and parallel/opposite
overlapping edges are unsupported. Graph costs reserve 0–4 decimals and 1–6 digits.

```js
export default scene({}, s => {
  const row = s.collection('row', [{id:'a',value:7},{id:'b',value:7}]);
  row.swap('a','b',{start:0.5,duration:1.5,clearance:0.3});
  s.wait(2.5);
});
```

Collection swaps track IDs independently of equal values, with separated arcs.
Path reveals use `strokeStart` / `strokeEnd`; `dashArray` / `dashOffset` use the
shared arc-length stroke engine. Retained `points` updates keep the vertex count
fixed and can follow absolute time. `s.attach(label,line,{anchor:'midpoint'})`
uses the line's geometric midpoint rather than its element origin.

## Biological preparation and motion

`s.molecularBackbone` batches `sticks`, `beads`, or smooth `backbone` geometry
from segments with stable residue IDs and explicit bonds. The pure geometry
variant returns meshes, anchors, segment/bond identity and vertex ownership.
`s.articulatedChainPose(spec,time)` integrates fixed link lengths and authored
bend/twist key states. Transform static geometry when the intended motion is
rigid; rebuild positions only for an actual conformational change.

`importPDB` remains the simpler coordinate importer. The newer host-only
`importPDBStructure(text,{source,accession,residueTemplates,polymerLinks})`
preserves deposited positions in Å, author residue/insertion identifiers,
alternate-conformer selection and explicit TER/gap breaks. Bonds come from
CONECT, supplied versioned atom-name templates, or explicitly opted-in
`polymerLinks:'standard-peptide'`. Missing sites are not silently bridged.
`structureBackboneProps(structure,'atoms'|'residues',radius)` creates props;
`createMolecularEnvelope` is a host-side schematic density envelope, not a
measured solvent surface. Keep accession/selection/units and any radius,
smoothing, simplification or illustrative changes in asset provenance.

Nucleic factories require explicit antiparallel template 3′→5′ and coding 5′→3′
directions and complementary ID pairs. Duplex opening preserves its declared
schematic backbone link lengths. Transcript input uses a fully-open template
snapshot and sequential complementary RNA 5′→3′ sites. Incoming bases do not
acquire a backbone edge before incorporation. These factories return bounded
parts/anchors/state; create meshes and bind fixed-topology vertices explicitly.
See the [types](../src/nucleic-types.ts) and the original transcription proof
sources for the full contract. A protein envelope must not be labelled as a
deposited polymerase merely because it provides useful visual context.

## Host assets and catalogs

Hosts prepare models/images before scene compilation. `registry.catalog` contains
IDs, hashes, bounds, counts and image dimensions, not pixel/geometry arrays.
Give generation systems this catalog so they select available IDs. Do not invent
asset IDs or paste large base64 blobs and triangle arrays into scene code.

```js
// Node host; run from shared/animlib after building.
import {loadAssetRegistry} from './tools/load-assets.mjs';
import {withOfflineScene} from './dist/core.js';
const registry = await loadAssetRegistry([
  './fixtures/suzanne/textured/suzanne-textured-image-0.json',
  './fixtures/suzanne/textured/suzanne-textured.json',
], {colorPolicy:'source'});
const source = `export default scene({mode:'3d'},s=>{
  const model=s.model('model',{asset:'suzanne-textured',shading:'unlit'});
  s.bind(model,[s.time],t=>({rotation:[0,t*0.3,0]}));
  s.wait(2);
});`;
await withOfflineScene(source,{},async sampler=>{
  console.log(registry.catalog, sampler.sample(1));
  // A renderer must prepare with sampler.scene AND sampler.assetGeometry.
  // Consume frames inside this scope; it owns the VM and asset leases.
},{modelAssets:registry});
```

Browser hosts pass `modelAssets:registry` to `createPlayer` or `SceneSequence`.
Compilation-only callers can pass `assetCatalog:registry.catalog` in compile
input, but a catalog alone cannot render an asset. Keep the registry alive while
players use it, and dispose each player/sequence. Registries can be shared across
players; GPU resources belong to each renderer/device. Zero leases means no
active scene pins; decoded registry memory remains owned by the host registry.

Images are untinted by default; explicit palette tint multiplies their source
colors. Opaque/blend alpha, nearest/linear filtering, and clamp/repeat wrapping
are supported. Use unlit shading to inspect source colors. Lighting/blending
use the renderer's existing encoded-sRGB working space, not linear-light PBR.
Image outlines, clipping, scalar/procedural combinations, image normal maps,
JPEG/video/mipmaps, multiple UV sets, glTF skinning/morph/animation and full PBR
are outside the supported slice. The [import guide](assets-import.md) states
strict rejection and explicit derivative policies.

## Budgets and efficient authoring

| Boundary | Unchanged ceiling |
| --- | --- |
| QuickJS memory | 32 MiB; default execution 200 ms |
| Scene source | 256,000 JavaScript string units |
| Compiled / reactive JSON | 8 MiB / 1 MiB string-length limits |
| Scene objects / aggregate geometry | 2,000 object IDs / 100,000 points |
| Individual mesh | 20,000 vertices and 20,000 triangles |
| Host registry / individual model | 256 MiB / 32 MiB conservative decoded budget |

Asset instances still count logical vertices toward scene budgets. Reuse removes
source/VM duplication; it does not grant permission to evade geometry limits.
Use static models and rigid transforms for repeated detail, modest samples for
deformation, and batches for molecular sites. Transparent triangles may require
per-frame global sorting and cannot always use the opaque instancing path.

Run `node tools/benchmark-asset-reuse.mjs` for CPU/source/lease comparisons, and
`node tools/prove-image-rendering.mjs <output-directory>` for actual native image
uploads/draws. CPU wall time is not GPU FPS; queue-completion wall time is not
timestamp-query timing. No broad performance guarantee follows from either.

## Style and evidence

Keep the approved mathematical explanation style, Reducible graph style,
Artem event/rate style, Visually Explained residual emphasis, and biological
reference palettes as separate authored contracts. Helpers establish data and
identity, not creator fidelity. Typography uses bundled MathJax glyphs and TeX
variants; there is currently no arbitrary font-loading API. A future bounded
family preset should specify metrics, glyph coverage and backend parity before
being advertised as a capability.

Source URLs/hashes and research screenshots establish provenance of observations.
They do not license copying film frames or models into output. Use original
geometry or separately licensed assets with their own metadata. Visual acceptance
is proof-specific; runtime tests do not establish cinematic or source-style parity.

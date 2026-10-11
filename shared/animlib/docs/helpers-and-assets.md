# Domain helpers and prepared assets

Use scene helpers to express relationships; use host-prepared assets to reuse
substantial immutable geometry or image pixels. Both reach the same compiler,
absolute-time evaluator, and WebGPU/WebGL2 renderers. There is no second scene format.

Use the [expansion coverage and evidence index](expansion-index.md) to navigate
the current visual direction, public APIs, asset provenance and the latest
independent proof decisions. [Reusable explanatory motion](explanatory-motion.md)
shows how to borrow channel motion while keeping mathematical visual language.
API availability and reference-style acceptance are distinct.

| Work | Scene API | Host responsibility / limit |
| --- | --- | --- |
| Coordinate maps | `s.plane`, its paths/vectors/components/labels and `map` | Explicit sampled map, no symbolic algebra |
| Graphs | `s.graph`, `s.dijkstra` | Authored positions; bounded nonnegative-weight search, no automatic layout |
| Collections | `s.collection(...).swap` / `.reorder` | Stable IDs, custom content, vertical/horizontal lanes; no general algorithm simulator |
| Compact queues | `s.compactQueue(...).insert` / `.remove` / `.transition` | Stable record pool, contiguous slot shifts and fading arrivals/extractions; [guide](compact-queue.md) |
| Sampled trajectories | `s.sampledState` | Explicit aligned vectors and 3×N projection; gaps stay disconnected; no manifold inference |
| Peptide poses | `s.peptidePose(spec,phi,psi)` | Explicit original templates and torsions; no deposited conformation or folding dynamics |
| Ordered molecular geometry | `s.molecularBackbone`, `s.molecularBackboneGeometry`, `s.articulatedChainPose` | Explicit adjacency and schematic kinematics, no energy/collision solver |
| Nucleic mechanism | `s.nucleicDuplex`, `s.nucleicTranscript` return geometry/data | Explicit paired DNA and ordered complementary RNA; schematic, not atomistic dynamics |
| Advancing transcription | `s.nucleicTranscriptionCycle(props,time)` | Exact strand links, advancing opening, complementary arrivals, absolute events and straight/curved authored exit paths |
| RNA processing | `s.nucleicSplice`, `s.nucleicThread` | Explicit cut/join graph and rigid fragments; polyline arc transport with conservative swept-radius aperture clearance |
| Translation | `s.nucleicTranslationCycle(props,time)` | Standard-code mapping, persistent carriers/product, A/P-site transfer, advance, stop and release; schematic kinematics |
| Optical focus | `s.camera.animate({focus:{distance,aperture,samples}})` | Bounded aperture accumulation; 8/16/32 samples, WebGL float-color extension required |
| Deposited structures | Use prepared geometry / compact selected coordinates | `importPDBStructure`, `structureBackboneProps`; first-model heavy atoms, explicit bonds/templates; no mmCIF or biological assembly reconstruction |
| Models | `s.model(id,{asset,shading})` | Immutable `createAssetRegistry` / native package decoding; selected static glTF/GLB triangle subset |
| Images | `s.image(id,{asset,width})`; models with UV0 | RGBA8, encoded sRGB, top-left, straight alpha; host `colorPolicy:'source'` required |
| Export | Same scene source | Native frame/video tools and scoped `withOfflineScene` sampling |

## Scene helpers

Detailed biological contracts: [RNA processing](nucleic-processing.md),
[moving transcription](nucleic-transcription-cycle.md), and
[translation](nucleic-translation.md). These helpers return persistent identities
and absolute-time poses; authors choose geometry, materials and choreography.
The [optical focus guide](../../../docs/animlib-expansion/depth-focus.md)
documents camera-space distance, animated focus, backend requirements and fixed
resource limits. Disable focus with a complete focus object whose aperture is zero.

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
An item may wrap an existing unparented `handle`, authored about its local origin.
Both `s.collection` and the standalone collection factory preflight all custom
handles and generated wrapper/cell/label IDs before creating any item. A rejected
later handle or ID leaves earlier caller-owned handles available for reuse.
`s.validateGroup(children,newIds?)` exposes this same read-only builder check;
it reserves neither membership nor IDs. This covers ownership, view, identity,
ID syntax/collisions and the element budget, not rollback of arbitrary custom
constructor or binding callbacks.
Set `orientation:'vertical'` for a stack and declare the full content `width` and
`height` so lane clearance is meaningful. `reorder(ids,{start,duration,clearance})`
requires every existing ID once, lifts translating entries into separate lanes,
moves them, then settles them. Schedules cannot overlap; stationary entries also
reserve a reorder interval. `slots` describes the final scheduled order, not the
currently displayed order. Callers animate insertion/removal visibility themselves.
See [identity transport](identity-transport.md) for complete examples.

`s.sampledState({times,values,projection})` captures copied dense arrays with
strictly increasing times, nullable aligned vectors and an explicit 3×N matrix.
`at(time)` returns interpolated values/position or null across missing intervals;
`prefix(run,time)` repeats the current endpoint to preserve topology. Each call
returns fresh arrays. Use the same knots for `countTo` numeric slots, markers and
paths; retained numeric-slot updates are unsupported. Limits and gap examples
are in [sampled state](sampled-state.md).

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

`s.peptidePose(spec,phi,psi)` returns fresh atoms, residue anchors, explicit bonds,
CA center and schematic provenance. Component templates require N/CA/C/O and
their backbone bonds, connected side chains and explicit link lengths/angles.
Absolute dense phi/psi arrays are in radians; omega is trans. Bounds are 2–96
residues, 1–8 components, 24 atoms/32 bonds per component, and aggregate
1,536 atoms/2,048 edges. Unsupported cyclic/cross-linked backbone templates are
rejected. Inputs are validated each call. The
[peptide proof](../demo/expansion/peptide-motion-proof.mjs) uses original ALA/SER/VAL
geometry; its moving pose is not 1CRN or a physical folding simulation. The
host equivalent is `createPeptideBuilders().peptidePose` from `animlib/core`.

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
Optional transcript `incomingRotation:{axis,angle}` rotates the incoming whole
nucleotide frame about its backbone anchor and settles exactly at incorporation.
Optional `emergence:{direction,distance,delay,duration}` transports incorporated
RNA while preserving the declared links; future target sites stay fixed and
unformed edges stay hidden. Omit both for the original fixed-anchor behavior.
Emergence validates its entire schedule independently of the requested time.
For each baseline forward link `L` and normalized exit direction `d`, let
`h=min(1,secondsPerBase/duration)` and `span=distance*h*(3-h*h)/2`.
Every desired link lies on `L-lambda*d` for `0<=lambda<=span`. Its minimum
length must exceed `1e-7*max(1,|L|,span)`, and the cosine between `L` and
`L-span*d` must exceed `-1+1e-6`. These bounds exclude a collapsed link and
an ill-conditioned antipodal frame rotation. Unsupported folding exit geometry
throws even before emergence starts. Reduce distance, lengthen duration, or
choose an oblique direction that satisfies the bounds; no bend plane is inferred
for a collinear fold. This analytic preflight does not sample a time grid.
Nonterminal nucleotide frames rotate with their outgoing links. The terminal
nucleotide has no outgoing link, so its exit translation preserves its docked
orientation instead of snapping to the previously bent incoming link.
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
From repository root, the [motion benchmark](../tools/benchmark-motion-peptide.mjs)
separates peptide pose, dynamic mesh construction, full-frame serialization,
render preparation and optional native queue wall time. Reproduction and reviewed
artifact identities live in the [proof index](../demo/expansion/README.md).

## Style and evidence

Use the approved mathematical art and graphing language for current explanatory
scenes. Reducible, Artem, Visually Explained and the biological references supply
motion, timing, staging and object-correspondence techniques. Their historical
source-art contracts remain research; they do not override the current visual
direction. Helpers establish data and identity without imposing a fixed layout.
Typography uses bundled MathJax glyphs and TeX
variants; there is currently no arbitrary font-loading API. A future bounded
family preset should specify metrics, glyph coverage and backend parity before
being advertised as a capability.

Source URLs/hashes and research screenshots establish provenance of observations.
They do not license copying film frames or models into output. Use original
geometry or separately licensed assets with their own metadata. Visual acceptance
is proof-specific; runtime tests do not establish cinematic or source-style parity.

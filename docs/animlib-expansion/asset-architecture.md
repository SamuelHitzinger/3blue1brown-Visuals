# Reusable host-owned models and image textures

Status: implementation proposal, 2026-10-11. No new dependency or asset renderer is
implemented by this document. The retained-time export repair is a separate,
completed prerequisite. This design follows the existing compiler, sequence,
player, geometry preparation, and dual-backend renderer.

## Existing boundaries and costs

| Boundary | Current implementation | Consequence |
| --- | --- | --- |
| Authored source | `src/compiler.ts:createSceneProgram`: `source.length <= 256000` | The advertised 256 KB limit is actually a JavaScript string-length limit. Inlining a large mesh repeatedly is the wrong distribution mechanism. |
| Sandbox | 32 MiB QuickJS memory, 512 KiB stack, default 200 ms execution deadline | Parsing JSON arrays and duplicating vertices consumes the authoring budget before useful scene work. |
| Compiled/update payload | 8 MiB compiled JSON string; 1 MiB reactive JSON string | Moving arrays into `CompileInput` alone bypasses the source limit but preserves VM memory, serialization, update, and handoff costs. |
| Geometry | `compiler.ts`: at most 20,000 vertices/triangles per mesh; scene point accounting caps at 100,000; initial elements cap at 2,000 | Referenced assets must participate in existing count validation; references must not become a budget escape. |
| Host API | `types.ts:CompileInput` has palette/previous/controls/seed; `Asset` is audio URL only | Model/image support needs an explicit host contract, not scene imports or network access. |
| Sequence/player | `sequence.ts` compiles transactional candidates and evaluates outgoing endpoints; `player.ts` prepares audio then renderer | Acquire asset references before candidate commit; release failed candidates; previous-frame continuity must retain reference identities. |
| Retention | `retained-geometry.ts`, `gpu-retained.ts`, `webgl.ts` reuse immutable geometry and device resources | Reuse these resource ownership paths; add stable asset identities rather than another renderer or global mutable model cache. |
| Appearance | `Geometry.texture` is an object-space procedural pattern; `Material` is stylized lighting | No image decoding, UV attribute, image sampler, or imported PBR material exists today. A texture filename alone cannot enable texture rendering. |

File paths in this document are relative to `shared/animlib` unless prefixed with
`data/` or `docs/`. Existing PDB preparation in `molecular-data.ts` and density
surfaces in `molecular-envelope.ts` stay host-only. Their explicit selections and
schematic smoothing are provenance, not a claim to retain a full molecular model.

## Native prepared asset format

Use one versioned package: `asset.json` plus content-addressed binary blobs. The
native format is deliberately smaller than glTF; it is not a new interchange
standard. Immutable validated values are owned by an `AssetRegistry` outside the
scene VM. Import/conversion tools produce this format; ordinary source code only
names registry entries.

Proposed discriminated entries:

```ts
type AssetColorPolicy = 'palette' | 'source';
type AssetRef = { id: string; hash: string; kind: 'model' | 'image' };
type ImageAsset = {
  kind: 'image'; version: 1; hash: string; width: number; height: number;
  pixels: BlobRef; // tightly packed RGBA8, top-left origin, straight alpha
  encoding: 'srgb'; colorPolicy: AssetColorPolicy; provenance: Provenance;
};
type ModelAsset = {
  kind: 'model'; version: 1; hash: string; parts: MeshPart[];
  bounds: { min: Vec3; max: Vec3 }; provenance: Provenance;
};
```

`BlobRef` declares SHA-256, exact byte length, and a relative local package path.
The manifest hash covers canonical manifest content and dependency blob hashes,
excluding the hash field itself. Decode no URI supplied by scene code. Package
loading checks resolved paths remain inside the package and applies byte limits
before reads/allocations. Host-approved remote preparation is a separate step.

Each `MeshPart` stores little-endian, tightly packed Float32 XYZ positions,
optional Float32 XYZ normals, optional Float32 UV0, Uint32 triangle indices,
local AABB, stable part ID, and explicit appearance. Vertex seams split position,
normal, and UV tuples together. Index validation happens before any renderer
expansion. Names are not identities; the hash and part ID are. No skins, morph
clips, arbitrary node transforms, or external references remain unresolved.

The first model subset bakes source node transforms into part coordinates with
inverse-transpose normal correction; reflected transforms reverse winding.
Conversion records source units, axis conversion, original transform, recentering
origin, scale, chosen scene and part selection. Native local coordinates use the
existing engine convention and explicitly declared unit scale. AABB values are
recomputed from decoded positions, never trusted from input metadata. Bounds
queries resolve the same immutable part data used by rendering.

Provenance requires source URL/path and content hash, creator if known, license
identifier or verbatim license reference, retrieval/preparation date, converter
name/version/options, source selection, modifications, and fidelity report.
Unknown creator/license remains explicitly unknown. Per-image provenance survives
material assignment. A scientific model additionally retains source model/chain/
residue selection, coordinate units and mapping of prepared parts to source IDs.
A schematic envelope records sigma, isovalue, grid resolution and smoothing.

Initial proposed limits are conservative policy values to measure, not claims
about hardware capacity: 20,000 vertices and 20,000 triangles per part; 100,000
referenced vertices per scene under the same logical counting policy as inline
geometry; 128 parts/model; 32 MiB decoded model/package; image dimensions at most
4096 each, 16 Mi pixels/image, 64 MiB decoded pixels/image; 256 MiB pinned decoded
assets/player. Reject count/product overflow, nonfinite/out-of-range coordinates,
zero normals, invalid indices, missing UVs, mismatched attribute counts, duplicate
IDs and unresolved dependencies before scene commit. Query actual device limits
as an additional bound. Splitting a model into parts never exempts aggregate
budgets. Count repeated instances against rendered work even when storage is
shared. Preserve the existing inline checks until a separate measured budget
revision is reviewed.

## Host, compiler, scene, and lifetime contract

Introduce small modules, not a larger `compiler.ts` or `renderer.ts`:
`asset-types.ts`, `asset-registry.ts`, `asset-validation.ts`, `asset-geometry.ts`,
`image-resources.ts`, and host-only `tools/prepare-model.mjs`. Keep source-format
parsers out of the QuickJS bootstrap. Reuse existing model preparation and mesh
validation through extracted validators rather than copying validation logic.

Proposed host flow:

```ts
const assets = await loadAssetRegistry(packages, { colorPolicy: 'source' });
const player = createPlayer({ canvas, assets, palette });
```

Existing audio records remain supported through a discriminated registry adapter;
`AudioClock` receives audio entries only. Registry ownership is explicit: a caller
owns a shared registry; each player/sequence/export acquires a lease and releases
its own references. Disposing one player cannot invalidate another.

Proposed scene lookup:

```js
const protein = s.model('protein', { asset: 'folded-protein', fill: 'BLUE' });
const card = s.image('micrograph', { asset: 'micrograph', width: 3 });
```

`model` yields the ordinary group/part handles so existing transforms, keep/remove,
views, layers and named selection continue to work. `image` is a UV-mapped planar
mesh with aspect ratio derived from validated image metadata. `Geometry` gains a
reference variant with asset hash and part ID, not hidden array expansion. Missing
assets/parts fail compilation with a useful diagnostic. Small read-only bounds and
part-name descriptors are visible in the VM; neither raw bytes nor unrestricted
host callbacks are visible. Transform/opacity binding works on the ordinary
handles. Version 1 rejects `s.deform` and topology morphs on referenced model
parts explicitly; bounded editable mesh copies require a later, opt-in API. Do
not quietly pull the full asset into every VM to make deformation appear to work.

Extend `CompileInput` with a bounded asset descriptor catalog (IDs, hashes,
validated counts/bounds/part labels and available appearance). `SceneSequence`
passes one catalog version to every candidate; `CompilerRequest` sends the small
catalog with compilation. No blobs, decoded pixels, or GPU handles cross into
QuickJS or through each frame message. The browser worker needs descriptors only;
local compilation uses the same catalog. A later geometry-processing worker may
receive an owned transferable ArrayBuffer once per hash. Never transfer the
registry's sole buffer and detach data still used by another consumer.

The compiler validates references against its catalog, then the host revalidates
returned references against its live registry before committing a candidate.
Compiled scenes and handoff `Frame`s remain structured-cloneable small reference
data. `evaluateScene` clones references, not arrays. Scene preparation acquires
and validates dependency leases before renderer preparation; `retain` releases
abandoned or superseded candidate leases along with callback sessions. Source
replacement with changed assets uses a new hash/catalog revision and rebuilds the
affected suffix transactionally. Old committed frames retain their own hashes.
Exports accept the same prepared package manifest and registry; they cannot rely
on browser-only image loading. Late loading must fail preparation, not draw a
blank frame and let playback advance.

CPU arrays are immutable private registry storage; do not return mutable typed
arrays to arbitrary scene/host consumers. Prepared geometry keys combine asset
hash, part ID, palette revision and relevant style. Existing `RetainedGeometry`
can consume this stable key without serializing all vertex data each frame.
Device/context resources remain per renderer in `GPURetained`/WebGL retention;
loss destroys handles and reuploads from retained CPU assets on recovery. First
version keeps existing active-frame GPU sweeping; CPU leases keep active sequence
assets pinned. Unreferenced CPU entries use a byte-bounded LRU. An optional GPU
LRU is a later measured optimization, not an unbounded global cache. Disposal,
failed preparation and canceled export all release leases deterministically.

## Image and colored model fidelity

Use a typed host policy: `colorPolicy: 'palette' | 'source'`. A host that opts into
`source` approves the original image/model colors; those samples retain RGB
fidelity. This task's intended texture/model host should use `source`. Scene
styles still require palette tokens, and scene code cannot opt itself into source
colors. `palette` hosts reject source-color assets unless the asset has an explicit
palette-indexed representation. Quantization is a requested preparation mode with
a recorded fidelity change, never an implicit default or a claim to faithful reuse.

Prepared image assets carry original RGBA color, or explicitly palette-indexed
color planes for palette hosts. Prepared model parts may carry original linear
RGBA vertex colors under `source`, palette indices under `palette`, or ordinary
named-token fill. Existing molecular sequence colors can use palette indices and
source residue/part mapping. Multicolor surfaces cannot be approximated by one
flat fill and declared equivalent. Tinting an approved image is explicit;
untinted source imagery must not accidentally multiply by the default BLUE fill.

Actual UV rendering is a separate feature slice: add UV0 and color attributes to
shared packed geometry; interpolate them identically in WGSL/GLSL; include texture
identity/sampler policy in draw batching; own GPUTexture/GL texture and samplers
per renderer; bind them in both backends; use the same preparation output in
native exports. Normalize image orientation once in preparation. Decode sRGB
samples into the chosen shading working space consistently and encode output
consistently in both backends. Add transparent/opaque/cutout cases to composition
instead of pretending every image is opaque. The initial proposal supports only
opaque or blend alpha, clamp/repeat wrapping and nearest/linear filtering without
mipmaps. Unsupported sampler/material requests fail conversion. Procedural
patterns remain unchanged and separate from `imageTexture`; a single ambiguous
`texture` union with silent precedence would be difficult to validate.

This is an incremental material path, not full PBR: first support faithful base
color/vertex color with the existing stylized lighting. Normal maps, metallic-
roughness maps, occlusion maps, emission maps, tangents and advanced materials
remain unsupported until parity tests exist. Their presence must be reported and
rejected or deliberately baked by a documented host preparation operation.

## Practical external preparation paths

The authoritative glTF specification describes binary buffer views/accessors,
triangle and other primitive modes, node transforms, skins, animation, material
channels, images/samplers and required extensions. GLB packages glTF JSON and binary
chunks; it does not make these features disappear. See the [Khronos glTF 2.0
specification](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html).

Proposed converter subset: static selected scene, triangle primitives,
POSITION/NORMAL/TEXCOORD_0 and optional COLOR_0, baked node transforms, embedded or
package-local PNG/JPEG base color images. Normalize supported accessor encodings
into native arrays with checked ranges; reject sparse accessors initially with
a precise diagnostic. Reject skins, animations, morph targets, non-triangle modes,
unsupported texture/material channels, sampler modes and required extensions.
Record optional extensions too; reject those affecting selected appearance unless
the conversion explicitly handles them. A host-requested snapshot/bake may make
a static derivative, but its selected time, omissions and lossy changes must be
visible in the fidelity report. Run the Khronos validator in the offline toolchain
when available and still run native package validation. Do not label this subset
a complete glTF/GLB loader.

OBJ separates positions, texture coordinates and normals in face references, and
may refer to MTL materials; the broader format also contains free-form geometry.
MTL can reference external texture maps. See the Library of Congress [OBJ
format description](https://www.loc.gov/preservation/digital/formats/fdd/fdd000507.shtml)
and [MTL format description](https://www.loc.gov/preservation/digital/formats/fdd/fdd000508.shtml).

OBJ is a useful secondary static-mesh route. Proposed subset accepts polygon faces
with independent v/vt/vn indices, groups and named material assignments. Resolve
negative indices at the face's position, split vertex tuples at seams, validate
faces and triangulate supported simple planar polygons. Reject free-form surfaces,
lines/points, malformed/nonplanar/self-intersecting polygons, unhandled MTL fields
and unsupported texture maps. No guessing units or silent missing-MTL fallback.
A preprocessing DCC tool can triangulate/bake a richer source into the subset;
record its version/settings and preserve the original source plus fidelity report.
Do not add a runtime parser dependency just to support one proof asset. Choose an
offline converter implementation after fixture validation establishes the required
subset and compatibility; glTF is the preferred reusable route because its
structured feature declarations make rejection/reporting more reliable.

## Dense helper performance risks and verification gates

The existing CPU-stub benchmark in `data/animlib-expansion/baseline-render.txt`
reported median/p95 preparation milliseconds: linear-algebra 1.49/3.53,
organic-chemistry 0.20/0.76, sorting 0.12/0.53, interactive-views 0.26/0.41.
These are not GPU frame rates, dense molecular measurements, or import timings.

Code-evidenced risks:

- `timeline.ts:evaluateScene` structured-clones inline geometry each sample;
  `reactive.ts` clones deformation arrays again. Asset references reduce static
  duplication, but dense changing geometry still crosses a 1 MiB update boundary.
- `molecules.ts` expands each site into 6 vertices/8 triangles at detail 0 or
  18 vertices/32 triangles at detail 1. At 10,000 sites, detail 1 implies 180,000
  vertices before other geometry, beyond the current scene cap despite its
  per-mesh batching. A per-helper accepted site count is not a scene guarantee.
- `mesh-shading.ts` serializes entire mesh arrays for a 16 MiB bounded cache,
  expands triangle corners and regenerates normals for changing surfaces.
  `render-geometry.ts` serializes geometry/style keys too. Stable hashes help
  immutable assets; constantly deformed meshes still have per-frame CPU work.
- Packed vertices currently have 31 float32 fields (124 bytes/corner). A streamed
  20,000-triangle mesh therefore needs 7,440,000 bytes before extra passes/views.
  Retention reduces stable uploads; it does not eliminate CPU fallback costs.
- Smooth paths, clipping, outlines and scalar colors opt out of geometry retention;
  changing geometry streams also avoid reindexing retention. Shadows and certain
  label occlusion modes disable retention for the frame. Dense curves/surfaces
  need representative tests with these actual style choices enabled.
- Transparent triangles sort by camera and use streamed paths. A translucent
  ribosome envelope plus thousands of beads is a substantially different workload
  from opaque retained primitives. Existing instancing batches at most 32 adjacent
  compatible commands and is not a guarantee of one draw for all molecules.
- `molecular-envelope.ts` caps grid resolution at 64, work at 25 million site-grid
  visits and output at 20,000 vertices/triangles. Preparing an envelope every
  animation frame would redo host meshing and smoothing. Cache a static envelope
  or design a separately bounded deformation; do not raise caps blindly.

Stage acceptance: (1) registry/ref/validation and source-length-independent static
model proof; (2) faithful image/vertex-color and UV support with native WebGPU and
WebGL2 pixel tests; (3) documented converter subset fixtures plus provenance
reports. Measure cold preparation, source compilation, JSON/worker payload bytes,
CPU frame preparation, GPU upload bytes, draw counts, decoded/cache/GPU memory,
frame median/p95 and context-loss recovery. Fixtures must include repeated model
references, palette/source policies, UV seams, transparent textured geometry,
negative/reflected transforms, missing assets, malicious offsets/counts,
unsupported source features, and transactional replacement/disposal.

A proof must use an actual prepared asset with permitted reuse and source/license
metadata, not a reference-video frame pasted behind scene geometry. Visual parity
and scientific/style fidelity remain independent acceptance gates. The current
moving-circle export proof establishes time/export correctness only.

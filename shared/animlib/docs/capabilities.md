# Animlib capabilities for storyboard planning

Use this guide to plan code-authored explanatory animation, including complex
molecular mechanisms and protein assemblies. Animlib renders geometric scenes
in a browser canvas through WebGPU/WebGL2, with reproducible absolute-time
playback, seeking, scene handoffs and optional interaction. It also exports
native frames and films. The scene author chooses geometry, layout, cameras,
representation and exact API calls; the orchestrator specifies the teaching
relation, changing state, lasting invariants and reveal order.

Use **3Blue1Brown art and graphing language throughout**: geometry-led reasoning,
a dark field, restrained semantic colors, local mathematical notation and
persistent objects. Other researched channels contribute motion, staging,
attention and correspondence techniques, not replacement palettes or typography.
Biological subjects can use rich 3D geometry while retaining this direction.
A fixed slide template and maximum surface detail are not style requirements.
See the [unified visual contract](../../../docs/animlib-expansion/unified-3b1b-direction.md)
and [reusable motion guide](explanatory-motion.md).

This is a planning guide, not an exhaustive API listing. The
[API reference](reference.md), [public scene types](../src/types.ts),
[domain contracts](helpers-and-assets.md), [showcase](showcase.md) and
[coverage/evidence index](expansion-index.md) supply implementation and proof.
Keep planning instructions out of spoken narration.

## Route the request before designing the scene

Establish these answers from the request and available inputs. Ask the user only
when an unresolved choice materially changes the lesson or scientific claim.

1. **What must become understandable?** Name the relationship or mechanism and
   the example values. A rotating model alone may not teach it.
2. **What kind of truth is required?** Distinguish supplied measurements,
   deposited structural coordinates, calculated mathematical states, authored
   schematic motion and illustrative context. Label synthetic data explicitly.
3. **Which identity survives?** Specify the same vector, formula operand,
   candidate record, residue, nucleotide, carrier or subunit across changes.
4. **Which relationships must remain invariant?** Adjacency, fixed link lengths,
   shared origins, complementarity, accepted cost, projection or attachment need
   different mechanisms. A live connector alone fixes no length.
5. **What must move independently?** Choose primitives, rigid groups, named
   static model parts or a deformable native mesh before introduction.
6. **What is already available?** Inspect the supplied asset inventory and
   [biological fixture catalog](../fixtures/biological/README.md). Decide whether
   existing geometry is suitable or host preparation is a prerequisite.
7. **Which view and scale expose the change?** Plan context, local inspection,
   comparison views, labels and any cutaway/focus. Geometry must exist in 3D
   before a camera move can reveal spatial relationships.
8. **How will success be checked?** Require readable intermediate motion,
   event-boundary correctness, reverse seeking and rendered final-aspect evidence.

## Request-to-capability decision matrix

The named `s.*` operations are scene-author tools. Preparation/import entries
run on the host before compilation; the scene sandbox cannot fetch or import.

| Requested explanation | Available building blocks | Required inputs / preparation | Supported motion | Boundary / redirect |
| --- | --- | --- | --- | --- |
| Basis vectors, matrix action, transformed grid | `s.plane`, mapped paths/vectors/components/labels | Explicit ranges, vectors and shared map | Grid, vectors and anchors follow one map | No symbolic algebra; calculate the intended intermediate map |
| Equation reasoning and moving operands | `s.latex`, named parts, copies, anchors, `countTo` | Explicit one-to-one term correspondence | Term transport, morphs, numeric interpolation | No semantic matching or arbitrary part split/merge |
| Graph search and priority frontier | `s.graph`, `s.dijkstra`, `s.compactQueue` | Authored graph positions, nonnegative weights, stable record IDs | Node/edge emphasis, queue insertion/extraction | Bounded Dijkstra trace; choreography is authored |
| Sorting, arrays, stacks and permutations | `s.collection`, custom grouped content | Explicit states, item IDs, dimensions and free lanes | Swaps, horizontal/vertical reorder | No general algorithm simulator or global collision avoidance |
| Neural traces, sampled dynamics and trajectories | `s.sampledState`, paths, markers, numbers | Aligned samples and explicit 3×N projection | Growing paths and synchronized state | No learned manifold, extrapolation or missing-data inference |
| Curves, residuals and parameter experiments | Paths, plane, sliders, retained bindings | Formula or supplied points, units and parameter domain | Curve/readout/residual change together | Fitting and scientific inference require supplied calculation |
| Deposited protein or RNA complex | `s.molecule`, molecular backbone, prepared models | Offline selected PDB coordinates, source and chain choices | Rigid inspection, representation changes, authored part motion | No assembly reconstruction, missing-atom completion or dynamics |
| Atomic bonds or residue connectivity | `s.molecularBackbone`, geometry builder | Explicit atom/residue IDs, segments and bonds | Sticks, beads, smooth backbone; native geometry updates | No inferred chemistry; separate atomic graph from residue guide |
| Designed peptide formation and packing | `s.peptidePose`, staged torsions, native meshes | Explicit component templates and phi/psi schedules | Idealized atomic poses and persistent residue identity | No predicted folding, energetics or collision solution |
| Schematic chain bending / domain hinge | `s.articulatedChainPose`, groups, attachments | Link lengths, authored bend/twist or rigid-part schedule | Fixed-link serial chain or rigid domain motion | No inferred rig, collision solution or physical hinge model |
| Protein envelope, molecular cutaway | Host envelope generators, native models/meshes, clipping | Source sites, smoothing parameters or licensed static mesh | Whole/part transforms; sampled contours and caps | Gaussian envelope is not an atomic or solvent-excluded surface |
| DNA opening and complementary RNA | `s.nucleicDuplex`, `s.nucleicTranscript` | Explicit antiparallel pairs and RNA mapping | Opening, arrival rotation, incorporation, fixed-link emergence | Schematic geometry; explicit schedule and frame constraints |
| Repeated moving transcription | `s.nucleicTranscriptionCycle` | Explicit pairs/transcript, opening window, cycle and exit settings | Dock, bond appearance, register advance, curved/straight exit | Bounded elongation; final DNA closure/termination not supplied |
| RNA cut/join and pore passage | `s.nucleicSplice`, `s.nucleicThread` | Intron interval, phases, departure; path and aperture | Loop formation, rigid fragments, exon join, path transport | No biochemical lariat chemistry or general collision solver |
| Ribosomal translation | `s.nucleicTranslationCycle` | RNA codons, complementary carriers and residue identities | Assembly, transfer, advance, stop, release, separation | Standard-code schematic; no atomic reaction or folding prediction |
| Detailed reusable machinery/anatomy | Prepared native packages or registered GLB `s.model` | Valid inventory IDs, licensed geometry and host registration | Named rigid parts, tint, transform, fade, handoff | No imported skins, animation clips or topology deformation |
| Images, textured objects and diagrams | Prepared `s.image`/UV models; richer GLB materials | Native image registry or embedded GLB maps | Cards/models transform with the scene | Asset paths have different material/import contracts |
| Organic geometry and fields | Surfaces, parametric surfaces, solids, tubes, meshes | Authored maps, centerlines, triangle connectivity or scalar values | Rigid motion, compatible morph, fixed-topology deformation | No automatic modeling, extrusion or topology correspondence |
| Attention and spatial comparison | Cameras, regional views, clipping, labels, optical focus | Framing, target/depth, view regions and visibility choices | Pan/orbit/zoom, 2D↔3D, rack focus | Bounded sampled optics, not automatic cinematic direction |

## Molecules, proteins and complex assemblies

### Choose the representation for the question

A complex protein is not restricted to isolated spheres. Animlib can show
coordinate-centered beads, explicit atomic sticks, residue backbones, designed
atomic peptide poses, smooth organic envelopes, multipart static models, and
combinations of these. Separate subunits can share one deposited coordinate
frame, retain names/colors, move rigidly apart and expose a chosen contact.
Local selected atoms can coexist with coarse whole-complex context.

Choose detail by the explanation: a residue trace exposes order; selected
sticks expose supplied connectivity; an envelope exposes mass and silhouette;
separate subunit parts expose assembly relationships. Data provenance must
survive representation changes. Do not call all of these atomically accurate.

- **Deposited coordinates:** host `importPDB` reads legacy PDB first-model
  coordinates. Residue mode selects protein CA and nucleic P anchors; heavy-atom
  mode retains non-H/non-D `ATOM` records. Chain selection, residue-wide alternate
  conformer choice and positive-occupancy filtering are deterministic.
- **Deposited structure with explicit topology:** host `importPDBStructure`
  preserves atom/residue identities, author insertion identifiers, TER and gaps.
  `structureBackboneProps` prepares atom or residue representations. Bonds come
  from CONECT, supplied versioned atom-name templates or deliberately enabled
  standard peptide links. Missing sites are not silently bridged.
- **Authored scientific illustration:** explicit positions, adjacency, radii,
  sequence and motion may communicate a mechanism without representing a measured
  conformer. Record which parts are schematic and which are sourced.
- **Static detailed anatomy:** a prepared native model or published GLB can
  represent a supplied protein/assembly surface with addressable parts. It is
  useful for inspection and rigid rearrangement; importing does not create a
  folding rig, atom graph, residue semantics or conformational trajectory.

Both PDB readers exclude `HETATM`, including ligands, waters and modified
residues. They do not parse general mmCIF, reconstruct biological assemblies,
infer secondary structure, fill missing atoms or infer chemical bonds from
proximity. For those requests, require suitable upstream preparation and
provenance; then render the supported selected output. The pinned CCD reader
used by fixture preparation is not a general mmCIF importer.

### Preserve coordinates and identities across detail levels

Use the same origin, scale and retained coordinates for all selected chains of
one structure. Different display radii and low-detail beads are schematic.
`s.molecule` batches many beads into meshes and returns one group; individual
beads are not independent handles. Split calls by color/radius or independently
moving component. Choose low detail, selected chains or declared subsampling
before attempting large coordinate sets.

`s.molecularBackbone` builds sticks, beads or smooth backbone from explicit
segments and bonds. `s.molecularBackboneGeometry` returns meshes, anchors,
segment/bond identities and vertex-to-residue correspondence for author-controlled
rendering. Separate segments do not become connected merely because they touch.
Keep atomic bonds distinct from a simplified residue adjacency guide.

A representation change can retain residue meaning and palette while using an
explicit crossfade between incompatible meshes. A static deposited conformer
shown first as sticks and then as a surface is a representation change, not a
folding trajectory. Corresponding native topology can deform; unrelated static
assets cannot acquire correspondence through a morph request.

The [1CRN fixture](../fixtures/biological/README.md#deposited-crambin-1crn)
provides pinned deposited atoms, explicit bond provenance, CA beads and a
residue-partitioned envelope. The [molecular examples](molecules.md) also include
1JJ2 selected CA/P sites: that dataset represents a **large ribosomal subunit**,
not a complete translating ribosome. Preserve that distinction in narration.

### Design motion before drawing the opening pose

Use `s.articulatedChainPose` for authored serial bends/twists that keep declared
adjacent center distances fixed. Use rigid groups or named model parts for
subunit separation, domain rotation and assembly staging. Neither path computes
collision avoidance, an energy minimum, binding affinity or a physical pathway.
A chain's fixed world lengths can appear shorter under projection.

Use `s.peptidePose` for an idealized atomic peptide built from explicit component
templates, absolute phi/psi arrays and trans omega. Stable atom/residue IDs and
explicit bonds persist across computed poses. This is distinct from a deposited
protein conformation. Stage local coil formation, hold for reading, then pack;
maintain order and identity through each step. The current reusable rig and
staging data are in the [biological catalog](../fixtures/biological/README.md).

The peptide builder supports 2–96 residues with bounded template/atom/edge
counts. It rejects unsupported cyclic/cross-linked backbone templates. These
bounds permit modest instructional examples; they do not establish a general
protein-folding engine. If a measured trajectory is essential, source and
prepare it externally, then plan compatible native geometry or explicit
representation transitions within scene budgets.

### Prepare organic surfaces outside the scene VM

Host `createMolecularEnvelope` generates a Gaussian-density display envelope
from all supplied sites with explicit sigma, threshold, grid resolution and
smoothing. It returns a normal native mesh. It does not calculate calibrated
electron density, solvent accessibility or a solvent-excluded atomic surface.
Smoothing can conceal channels and detail; inspect the actual silhouette and
cutaway before using it to support an anatomical claim.

Host `createMolecularEnvelopeParts` produces a bounded multipart version for
prepared representations. It does not raise per-mesh or aggregate scene limits.
Both generators and output provenance belong to preparation; never run heavy
surface construction in a scene binding. See
[multipart envelopes](molecular-envelope-parts.md) and
[molecular preparation](molecules.md) for recipes and parameters.

For a complex assembly, plan: selected coordinate source → common frame →
independently needed parts → whole-assembly context → local inspection →
explicit motion or representation change. Keep measured structure, authored
machinery and illustrative trajectory separately described in the plan.
The [molecular authoring recipes](reference.md#molecular-and-biological-animation-recipes)
show how these choices become scene code.

## DNA, RNA processing and translation

These helpers evaluate fresh data/poses from explicit inputs. They return
anchors, frames, stable IDs, state and bonds; they do not create a complete
rendered machine. Native geometry and optional prepared models consume the same
poses. Evaluate a shared pose consistently for every linked visual element.

- **Duplex and fixed-snapshot transcript:** `s.nucleicDuplex` uses explicit
  antiparallel template 3′→5′ and coding 5′→3′ pairs. Opening preserves declared
  schematic backbone links. `s.nucleicTranscript` uses a fully open template
  snapshot and sequential complementary RNA 5′→3′ sites. Incoming nucleotides can
  rotate as whole frames and settle at incorporation; unformed backbone edges
  remain absent. Optional fixed-link emergence has analytic schedule constraints.
- **Advancing transcription:** `s.nucleicTranscriptionCycle` moves an opening
  window, holds during docking, advances a register, forms each edge only at
  incorporation and emits RNA along a bounded straight or curved rail. DNA and
  formed-RNA link lengths remain fixed under its declared contract. Stable
  anatomical exit-frame options can deliberately move/rotate exterior DNA;
  perfect exterior pinning is not promised. Completion means mapped RNA is
  incorporated; full termination and final DNA closure require another plan.
- **Splicing:** `s.nucleicSplice` can form an authored arc before cutting, remove
  both intron boundary edges, close the exon gap, create the replacement bond,
  and move the removed fragment away. Pre-cut formation preserves material arc
  offsets, not Euclidean bond lengths. After cutting, fragment interiors remain
  rigid. This is a cut/join illustration, not biochemical lariat chemistry.
- **Pore transport:** `s.nucleicThread` transports sites along an explicit
  polyline with fixed arc offsets and parallel-transported frames. Conservative
  aperture clearance covers the path plus declared chain radius through a finite
  slab. It does not certify larger rendered meshes, shortcut straight bonds or
  collisions elsewhere. Constant arc spacing is not constant chord length.
- **Translation:** `s.nucleicTranslationCycle` validates explicit standard-code
  codons, matching complementary anticodons/carriers and product residue IDs.
  It supplies assembly, arrival/docking, chain transfer, A→P/P→E advance, spent
  carrier exit, terminal stop, product release and subunit separation. The same
  product persists during transfer. Formed peptide edge lengths stay fixed;
  optional helical product geometry is prescribed, not predicted folding.

Translation requires complete RNA codons starting AUG and ending in a terminal
stop; stop creates no carrier/residue. Alternative codes, alternative starts and
wobble are unsupported. RNA follows prescribed geometry rather than an exact
fixed-bond model. Neither a ribosome-shaped asset nor these kinematic helpers
establishes atomistic reaction dynamics or tunnel collision constraints.

Detailed contracts and current runnable examples:
[transcription](nucleic-transcription-cycle.md),
[splice and pore](nucleic-processing.md), [translation](nucleic-translation.md).
The [proof index](../demo/expansion/README.md) identifies accepted films,
versioned inputs and preparation dependencies; old realistic assets remain
optional geometry, not the current art direction.

## Asset discovery, preparation and publication

Inspect descriptors before promising a named asset. The
[biological fixture catalog](../fixtures/biological/README.md) covers deposited
crambin representations, illustrative peptide rigs/surfaces, nucleotide anatomy,
polymerase context, membrane/pores and translation machinery. Suzanne provides
an additional [licensed static-model example](../fixtures/suzanne/README.md).
Use the catalog and manifests as the current inventory rather than a hardcoded
package count. Rig/staging JSON is data, not necessarily a renderable model.

Read IDs, bounds, parts, counts, dependencies, hashes, selection and provenance.
Load only the packages needed for this lesson, including image dependencies.
Do not invent asset IDs, mistake a procedural enzyme for a deposited structure,
or paste large triangle arrays/base64 image blobs into generated scene source.
Research screenshots and source videos do not grant reuse rights to their art.

Two supported asset paths share `s.model`, but their contracts differ:

| | Prepared native registry | Registered static GLB |
| --- | --- | --- |
| Host input | Native model/image packages; `createAssetRegistry`, package decoders, `tools/load-assets.mjs` | Self-contained GLB parsed/validated by `parseModelGLB`; host-generated GLB via `createModelGLB` |
| Scene input | Descriptor-only catalog and asset ID; `source:'prepared'` if ambiguous | Metadata inventory and asset ID; `source:'glb'` if ambiguous |
| Geometry | Immutable triangle parts; `part(id)`; `s.image` cards | Named node parts/hierarchy; `part(idOrName)` |
| Appearance | Palette geometry, UV0 PNG-derived RGBA8 images, explicit host source-color permission, unlit/stylized shading | Base color, normal, metallic/roughness, occlusion, emissive maps; vertex colors, UV0/UV1 and texture transforms |
| Host delivery | Registry passed as `modelAssets`; retain it through rendering | Player `assets` inventory / `registerAssets`; lesson publication manifest |
| Color/tint | Source image tint is explicit; model part tint affects native mesh fill | Palette tint multiplies imported colors; WHITE restores imported colors |
| Motion | Rigid whole/part transforms, tint and fade | Rigid whole/part transforms, tint and fade |
| Limits | Static base-color converter subset; no full PBR or image normal maps | Studio material approximation, not exact glTF reference PBR; no environment maps |

When the same ID occurs in both inventories, select `source` explicitly. Neither
path supplies imported skeletal animation, animation clips, topology morphs or
mesh deformation. Use native authored meshes for deforming geometry. GLB part
rotations use baked model axes about preserved pivots; inspect metadata before
requesting a domain hinge.

**Host/preparation work:** fetch licensed inputs, convert unsupported formats,
select chains/parts, validate, simplify where necessary, record provenance and
publish/register. The offline [native glTF converter](assets-import.md) accepts
a narrow PNG/base-color subset and an explicit derivative policy. It is different
from the richer runtime GLB material path. FBX/OBJ/Blender require upstream
conversion; Blender procedural materials need baked image maps.

**Scene-author work:** instantiate known IDs with `s.model`/`s.image`, choose
framing and permitted styling, address parts and schedule motion. Builders stay
synchronous and cannot perform host imports or downloads. A catalog alone
cannot render; the renderer needs the host-owned geometry/images too.

In the lesson application, the scene agent's external `publish_model` tool
accepts a public HTTPS GLB URL or generated named mesh parts, validates/stores
immutable bytes and returns an ID/inventory. It is a publication step outside
scene JavaScript, not an `s.*` method. Later scenes receive the assets for
handoffs. Follow the [registration/publication contract](reference.md#registering-and-delivering-models)
for license metadata, persistence and endpoint details.

## Mathematical, algorithmic and scientific explanations

`s.plane` applies one authored coordinate map to grid, vectors, component paths
and label anchors. Curves and labels share the construction while text stays
upright. State the exact matrix/function and desired invariant. A geometric morph
does not prove a mathematical transformation: a rotating vector must be computed
to keep its length; a linear map must act consistently on every construction.

Text/LaTeX use bundled vector glyphs, mathematical fractions/scripts/matrices,
named formula parts, anchors and numeric slots. Copy a handle when an operand
must remain at its source while appearing in a calculation. One-to-one part maps
preserve declared correspondence; repeated glyphs do not infer it. Use separate
handles for independently colored operands; there is no `partColors` property.
See [identity transport](identity-transport.md).

Graphs have authored node positions, connected edges, weights/costs and visual
states. `s.dijkstra` returns immutable pop/relax/stale/frontier traces, distances
and predecessors for bounded nonnegative weights. The author chooses reveals;
there is no automatic graph layout. Keep a candidate's historical cost distinct
from an accepted node distance; discrete updates should not count through values
the algorithm never held.

Collections support equal-value identities, custom grouped records, horizontal
and vertical layout, swaps and arbitrary complete permutations with separated
motion lanes. `s.compactQueue` instead inserts/removes a visible subset while
preserving survivor order and shifting contiguous slots. Reserve actual space
for labels and lanes. Neither sorts automatically or avoids unrelated scene
geometry. See [compact queues](compact-queue.md).

`s.sampledState` takes aligned component vectors and an explicit 3×N projection.
Use the same samples for trace markers, numeric tracks and a 3D trajectory.
Growing path prefixes retain fixed topology and their exact current endpoint;
missing samples split runs. Numbers use matching `countTo` sample knots with
`ease:'linear'` to match the interpolated samples, not unsupported reactive
numeric-slot writes. This supports supplied measurements
or disclosed synthetic examples; it does not infer a biological manifold.

Event→rate→state and logistic residual demonstrations compose paths, mappings,
markers and time/parameter calculations. The author supplies kernels, models,
units and data; these are recipes, not automatic neuroscience/statistics engines.
See [sampled-state semantics](sampled-state.md),
[science/motion examples](explanatory-motion.md) and
[general authoring recipes](reference.md#general-animation-recipes).

## Geometry, surfaces, lighting and explanatory overlays

2D primitives include circles, rectangles, paths, lines, arrows and groups.
Paths accept smooth point interpolation, Bézier controls, SVG path data and
compound outlines with holes. SVG support is path geometry, not full SVG files
or styling. Filled contours must be closed, simple and nonintersecting; nested
contours form holes. Smooth interpolation can overshoot; use explicit controls
for precise boundaries. Curved geometry has finite tessellation.

3D primitives include shaded spheres, boxes, cylinders, cones, tori, constant-radius
swept tubes, function graphs `z=f(x,y)`, two-parameter surfaces, explicit triangle
meshes and round lines/arrows. Author petals, sheets, branches or molecular
scaffolds from these; there is no botanical growth or automatic extrusion system.
Raw meshes are unlit unless shading is requested; flat/smooth normals control
surface appearance. Surface callbacks are sampled during compilation.

Mesh vertices need correspondence and compatible triangle topology to morph.
Fixed-topology retained deformation updates rest vertices from absolute time or
controls, with normals following geometry. Different sample counts, holes, caps
or connectivity require reconstruction. Nonfinite surface samples leave holes;
closed parameter axes require periodic maps. Tube caps do not repair crossing
or reversed centerlines.

Spheres/native meshes support two-palette-color checker, stripe, noise, marble
and wood patterns attached to the object. Procedural bump perturbs lighting
normals without changing silhouettes. Metalness, roughness, specular and emissive
settings support stylized matte, plastic, metallic and luminous appearances.
Emission creates no light or bloom; reflections do not show other scene objects.
Image normal maps belong to the GLB path, not procedural primitives.

Lighting includes ambient and directional lights, with world-fixed or
camera-relative direction. Optional deterministic soft contact shadows fall
from opaque mesh/sphere fills onto a finite horizontal plane. Overlapping
casters do not compound silhouette darkness. Labels/translucent objects do not
cast; `castShadow:false` excludes an element. There are no point/spot lights,
self-shadows, arbitrary receiving meshes, environment maps or displacement.

Use up to four object-local clipping planes for interiors. Section contours
follow actual sampled intersections; caps fill closed nonbranching loops and
preserve holes. Open surfaces receive contours without invented solid caps.
Boundary/crease/camera-dependent silhouette outlines reveal form. Scalar mesh
values map over an explicit clamped domain through 2–16 palette colors and
interpolate across triangles; author the legend and sufficient mesh sampling.

World labels can face the camera and stay attached to objects. Occlusion modes
retain glyph depth testing or use whole-label overlay, hiding or 20% fading based
on anchor visibility against opaque fills in the same view. They ignore
translucent occluders and do not reposition labels. Screen labels stay fixed.
Host bounds inspection and projected glyph-overlap detection aid review but
neither lays out labels nor proves clearance from shapes or unsampled motion.

## Motion, cameras, controls and continuity

Objects/groups move, rotate, scale, restyle, fade and animate together or in
sequence with explicit holds. Isolated groups composite overlapping components
before a shared fade. Compatible closed/open outlines morph; corresponding curve
segments interpolate controls. Incompatible representations crossfade. Compound
path correspondence must preserve contour order; arrow-to-arrow morphs retain
arrowheads. No automatic semantic shape matching is available.

Main and rectangular clipped regional views have independent cameras and optional
orbit input. Camera pan/zoom/rotation and orthographic 2D↔perspective 3D transitions
show authored geometry; they do not extrude it. Optical focus supports animated
focus distance/aperture with 8/16/32 lens samples, including regional views.
Screen annotations remain sharp. WebGL2 focus needs `EXT_color_buffer_float`;
finite samples and workload ceilings require moderate blur and final-size review.
See [focus requirements](../../../docs/animlib-expansion/depth-focus.md).

Sliders, toggles and selects can redraw a paused scene. The current structured
lesson plan allows 0–2 such controls per scene; default to none unless variation
reveals a useful relation. Specify range/options, dependent geometry/readouts and
the intended discovery. Controls must preserve measured scene duration, and the
narrated default must teach without interaction.

Ordinary controls can rebuild geometry when topology changes. Retained sliders,
`s.bind` and `s.deform` update supported geometry/material properties without
rebuilding the timeline. Bindings must be pure synchronous functions of inputs
and immutable data; do not accumulate state by frame count. Avoid shared property
ownership between bindings, animation tracks, attachments or behaviors. See
[reactive controls](reactive-controls.md) for exact combinations.

Orbit, object dragging (including world-space box bounds and ordered open/closed
polyline constraints), spring return, attached labels and live connectors are
scene-authored behaviors, not extra slider/toggle/select plan types. Custom
behaviors require host registration. Viewer drag affects presentation; later
narration and canonical handoffs must not depend on the viewer's drag position.
Curved paths do not provide arbitrary precise drag hit shapes or surface-clipped
connectors.

Each scene has a local timeline. Only explicitly kept objects carry forward;
the evaluated prior endpoint is the next initial state, not a planned end picture.
Stable IDs must preserve meaning and color. Deliberately remove temporary helpers.
One optional host audio track follows playback per scene. Narration is generated
externally; measured audio/alignment determines duration and reveal cues. Estimate
pacing in the storyboard, but do not invent exact audio timestamps.

Plan an object's later use at introduction: what moves together, which joints
bend, what stays connected and which distances remain fixed. In structured plans,
put lasting relationships and actual later beat IDs in shared entity `meaning`,
construction in `visualDescription`, and continuing requirements in `endsWith`
and `carry`. Repeat needed requirements in consuming scenes. Use existing fields;
do not invent JSON keys. Authors receive the shared registry/full outline but
detailed plans only for current/adjacent scenes. In Markdown scripts, use the
introducing beat's `Content needed` or `Notes`. Preparing a fold must not reveal
it before the intended beat.

## Staged workflow and render-proof acceptance

1. Define the claim, example inputs, identities, invariants and evidence class.
2. Select public helpers and representations; inspect available asset descriptors.
   Record required offline preparation separately from scene implementation.
3. Plan the mechanism and later uses before layout polish. Reserve motion space,
   establish reading holds and assign stable semantic colors.
4. Author absolute-time states and event boundaries, then connect all geometry,
   labels and numbers to the same underlying state. Add optional interaction last.
5. Compile with production budgets; inspect native frames at actual output
   dimensions. Test opening, motion interiors, event boundaries, reading holds,
   endpoint/handoff and reverse seeks. Check the intended alternate aspect too.
6. Review the complete encoded motion, not just a still/contact sheet. Separate
   reasoning correctness, readability, current art direction and media integrity.
   API tests and a successful encode alone do not establish visual acceptance.

Use [proof/reproduction entry points](../demo/expansion/README.md) and the
[coverage index](expansion-index.md) for examples and exact accepted artifact
scope. Generate new outputs without overwriting reviewed assets/media.
Native `render-frames.mjs` and `render-video.mjs` use the same evaluator; host
`withOfflineScene` permits scoped sampling with asset resources retained during
consumption. These tools require a native WebGPU adapter; video export also
requires FFmpeg. `render-video.mjs` emits silent H.264 and caption sidecars and
rejects source scenes declaring audio. Narrated films need a separate host
audio-mux workflow with verified alignment. There is no in-player recording or
automatic proof of scientific fidelity.

## Hard boundaries and practical budgets

These are rejection ceilings, **not recommended scene sizes or performance
promises**. Lower detail, select useful context, split the explanation into beats
and measure the result. Do not raise production timeouts to accommodate a scene.

| Resource | Planning boundary |
| --- | --- |
| Scene VM | Default 200 ms execution, 32 MiB memory; synchronous builders, no packages/network/DOM |
| Source / serialized updates | 256,000 JavaScript string units; compiled JSON 8 MiB, reactive update 1 MiB |
| Native scene structure | 2,000 object IDs, 100,000 aggregate points, at most 32 regional views |
| Native mesh | 20,000 vertices and 20,000 triangles per mesh; surface default 32 segments per axis |
| Molecular beads | At most 10,000 sites per call; batching still consumes mesh, aggregate, source and update budgets |
| Prepared assets | 32 MiB conservative decoded model budget; 256 MiB registry budget; reused vertices still count logically |
| GLB import | 32 MB file; 200,000 vertices/triangles; 256 nodes/primitives; 64 images, at most 4096² each and 16 megapixels total |
| GLB scene / player | 500,000 imported triangles across scene instances; resident player limits of 1,000,000 imported vertices and 32 megapixels |
| Lesson model publication | At most 16 published models per lesson |
| Bounded helpers | Graph: 256 nodes/2,048 edges; collection/queue: 256 records; sampled state: 20,000 samples/component slots, 1–64 dimensions |

Prepared geometry reduces VM/source duplication, not scene budgets. Static opaque
objects retain GPU geometry; repeated compatible primitives can share indexed
geometry. Transparency, deformations and optical focus have additional costs.
Intersecting transparent surfaces may sort incorrectly; focus does not fix that.
There is no dense-simulation, mobile-frame-rate or huge-dataset guarantee.

Other limits: no automatic shape correspondence, arbitrary font loading/emoji/
broad international glyph coverage, full-document TeX or automatic multiline
layout; no video textures, general physics solver or automatic mesh repair;
no branching lesson navigation, infinite scenes or playback-rate controls.
Use short supported labels, authored topology and explicit transitions. Section
caps do not repair nonmanifold/self-intersecting meshes, and inspection can miss
collisions between sampled frames. Escalate missing scientific data or unsupported
model preparation as prerequisites; do not silently replace them with a claim of
simulation or measured structure.

Constrained dragging uses built-in `drag.bounds` or `drag.path`, with no custom host
behavior. Constraints apply to the target origin during a gesture; path movement
visits adjacent corners rather than jumping between distant segments. See the
[reference](reference.md#behaviors-and-live-bindings) for the complete API. This does
not add collision detection, automatic heading, or persistent swept-area state.

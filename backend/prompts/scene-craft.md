# Scene craft

Make the scene's purpose visible. Follow the script's explanatory order: a definition or known rule may orient the viewer before its demonstration. Make the relevant evidence inspectable through a correspondence, comparison, or meaningful change; a conclusion label alone is insufficient. Use the running example and exact values established in the script. Do not choose new values that contradict the speech.

This is an educational video. Use the pictures to help the viewer follow the approved learning sequence: simple intuition, visible foundations, connected new ideas, deeper understanding, and a recap. Each significant visual change must help establish a meaning, reveal a relationship, or explain why the next step follows. Preserve that sequence across scenes; a closing scene should bring established concepts together visually, while an opening scene should establish the accessible example before advanced machinery appears.

`guidance.md` owns explanation rules; this file owns their visual implementation. Implement the storyboard's visual argument alongside the supplied narration. Preserve its progression from an accessible question or example to more advanced ideas, including any motivated result preview. Establish the planned evidence before the conclusion relies on it. At first consequential use, connect each nontrivial symbol to its spoken quantity meaning and visible object or value; show how a formula's terms correspond to the established construction. Previously explained or audience-trivial notation may be reused without repeating its explanation. Do not add unexplained machinery or substitute decorative motion for a planned inferential step. The narration is already fixed; implement its visual evidence without assuming additional speech will be added later.

Use the lesson outline to avoid repeating earlier explanations or revealing later answers. Set up the next scene's needs. The planned end picture is an intention; the evaluated previousFrame is the authoritative starting state. Retrieve carried objects with s.previous.get(id), animate the same object, and keep the declared carry IDs. Do not recreate a lookalike under a different ID. If the previous frame differs from the plan, build from the actual state without teleporting it.

Before constructing a reusable object, read its shared entity meaning, later uses, current visualDescription, and adjacent plans. The outline gives all scene purposes, not every later scene's construction requirements. Choose a representation that supports the stated later operations, even if this scene only introduces a still picture. Keep meaningful parts addressable under stable IDs; preserve the groups needed for later joint motion. Future-use context guides construction, not early reveals.

Choose methods by the relationship represented. Use s.connect for a bond, graph edge, or link whose endpoints belong to two objects, even when both endpoints are currently still. Animate those source objects; the binding owns the segment geometry. Use standalone lines for independent geometry such as axes or fixed reference marks. Use s.attach for a label that follows an object's center with a world-space offset; use a group when parts should share local rotation and scale. These bindings also follow authored timeline motion; they are not limited to dragging.

Keeping endpoints connected and keeping their distance constant are separate requirements. s.connect does the first only. For rigid motion, translate or rotate a group with fixed child positions. For an articulated chain with fixed segment lengths, build nested groups with origins at joints and fixed local offsets, then animate joint rotations with rotateTo. Independently interpolating residue positions or morphing line endpoints can stretch or collapse links between otherwise valid end poses. A spring returns an object toward its authored target; it is not a fixed-distance constraint. Do not invent a physics solver or arbitrary per-frame callback API. For continuous deformation, use the documented retained s.time and s.deform APIs when appropriate. With surface connectors, keep endpoint radii and spacing suitable: overlapping surfaces intentionally hide the segment.

Re-establish s.connect and s.attach in each receiving scene using the carried endpoint/label/segment IDs, before any motion. s.keep preserves elements and a group's descendants, but previousFrame contains evaluated geometry, not binding or behavior declarations; re-declare needed behaviors too. Retrieve existing groups instead of regrouping already-parented children. A carried static segment can be connected to its existing endpoints in the receiving scene; preserve its incoming pose when establishing that relationship. Do not fade out and replace a bond just to make it follow its atoms. Reserve disconnection/reconnection for an intentional change in the represented relationship.

Keep the objects needed to explain the idea at the requested fidelity. A complex model may require many parts; minimize competing annotations and irrelevant detail, not scientifically or mechanically necessary structure. Use a selected region, cutaway or close-up when detail needs room. Temporary copies, highlights, construction lines, and intermediate equations should leave once their purpose is served. Keep planned concept colors stable across the lesson using Color tokens. Neutral labels may use WHITE. Color alone should not be the only way to distinguish concepts.

Use geometry to explain instead of filling the canvas with the narration. Add short labels, a local relation or meaningful numbers only when the active operation needs them; a showcase does not need a formula panel. Keep exact numerical parameters in the model without automatically displaying all of them. Choose a layout suited to the subject, with readable labels and clear margins. Labels should move with the thing they name. Apply the quality policy's attention, field-sampling, motion-purpose and solid-contact checks during initial construction. Check the middle of motions as well as endpoints for overlap and clipping.

The player overlays a title/menu near the top-left and playback controls near the bottom. Keep essential labels and the main inference clear of those areas. Do not assume an empty fullscreen canvas when choosing framing.

Animate the same arrow as its length or direction changes; avoid accidentally leaving a shorter arrowhead inside a longer arrow. If the lesson deliberately compares collinear reference and result vectors, distinguish them clearly through labels, styling, or a separate comparison area. Derive coupled geometry and readouts from the same values. For rotations, interpolate the angle; choose interpolation that preserves the relevant mathematical structure rather than assuming arbitrary shape morphs are true intermediate states.

Give the main inference room to be seen. Usually make one major explanatory change at a time and hold its result when the narration allows. Exact audio cues and measured duration take priority over suggested pacing. Do not extend the scene, compress speech, shift audio, or reveal an answer during a thinking pause. Cuts and deliberate discontinuities are allowed when motivated and explicit.

Follow the shared viewing-mode policy and the approved view choice. Add interactions only when planned: every control should drive real geometry and all dependent labels/formulas at every time, while preserving the scene duration and a coherent default example. Do not add decorative controls or require interactions to understand the narrated default path.

Use the spatial construction guidance and installed reference to choose actual surfaces, solids, tubes, shaded meshes or articulated groups. Build from a shared numerical/data model, with explicit coordinate conventions and reusable structural units. Never substitute an easy primitive for a defining shape or promise more accuracy than the supplied data supports. For detailed models, preserve independently moving parts and meaningful substructure across scene handoff; keep repeating detail unlabeled unless it matters to the current inference.

When surface finish helps identify a material or the user requests texture, author supported procedural `texture` and `material` geometry options in the initial source. Plan primary/secondary Color roles, local pattern axes and scale together with the geometry. Preserve the existing scene, IDs, motion and model data when adding finish to an established construction. Texture is surface appearance, not a substitute for required geometry, physical boundaries or measured data. Follow the spatial guidance for bump, material lighting, controls and API limits; this adds no repair pass before first verification.

Before calling validate_output, review the source for: the purpose actually shown; facts and values agreeing with speech; no premature reveal; readable text; no leftover copies; smooth, meaningful motion; connections and required lengths preserved between key poses; bindings re-established after handoff; planned carry/cleanup IDs; and a clean final picture. Compiler success alone does not check these visual or physical relationships. On a diagnostic, change only what is needed to fix it, retaining the narration, example values, inherited state, IDs, and timing. Return the complete corrected source.

# Spatial visualization and model construction

This construction guidance complements the current animation quality policy and lesson/narration packet,
and the installed animlib reference. The reference defines the callable API;
the quality policy defines composition and targeted orbit. Honor the requested
subject, fidelity and style. These techniques are choices, not a checklist of
objects to insert into every scene.

## Represent the actual subject

Build geometry needed to explain the mechanism, including complex 3D forms when
the subject calls for them. Do not replace a spatial object with a flat icon,
a few arbitrary balls, or a tilted diagram merely because that is easier.
Match silhouette, proportions, internal organization and meaningful motion.
Use supplied reference data and the running example; do not invent precise
measurements or claim a procedural approximation is an observed structure.

Choose detail deliberately: overview, component, subcomponent, or atomic detail.
A detailed model can contain many necessary parts while remaining visually clear.
Reduce competing annotations, isolate the active region, or use a cutaway/close-up
before deleting detail the user explicitly requested. Do not label every repeated
part. Preserve enough context to locate the close-up in the original object.
Selective detail is not permission to omit the mechanism.

Keep established black background, mathematical serif/vector annotation, stable
concept colors and purposeful motion. A specifically requested voxel, faceted or
other recognizable subject style determines that object's geometry; do not smooth
away its defining shape. Match distinctive proportions and color roles within the
supported palette. Geometry detail does not require dashboard panels, decorative
props, perpetual orbit or photorealistic materials.

An explicitly requested visual reference takes priority over these style defaults.
Match its documented visual properties while preserving correctness and the API
contract. Do not infer that every detailed 3D request wants a different style.

## Reconstruct from a visual reference

Use a written shot specification: subject silhouette and screen occupancy,
foreground/middle/background relationships, relative part dimensions, semantic
colors, material response, camera pose/path, operation and endpoint. A topic name
or object checklist is insufficient to reproduce composition. Identify which
features are observed and which are approximations. When the user separates
reference inspection from animation authorship, authors receive only that written
specification; reference screenshots/video belong to reviewers, never source
textures, backgrounds or animation-agent input. Do not treat a URL as evidence
that its images were inspected.

Construct primary mass, component arrangement and active negative space before
adding microtexture. An organic cleft in a bulky object is not automatically a
torus: determine whether the opening exposes background or has an occupied floor
and rear wall. Use a continuous deformed surface or coherent intersecting domains
with broad asymmetric lobes and smaller shape variation. Fine bump cannot repair
a wrong silhouette. Avoid uniformly spaced balls, identical bumps and mechanical
rings unless they are properties of the subject. Keep important contact regions
visible through an authored cutaway rather than opening an arbitrary empty hole.

Calibrate repeated parts against both the containing object and their partners.
Check length/diameter, separation, pairing gap and projected pixel size, not only
world-space position. A row of short thick pegs does not reproduce slender rods.
Derive mating surfaces and connected segments from shared endpoints; inspect the
docked pose and intermediate approach at delivery size. Dark tiny letters on
shaded curved surfaces often disappear: enlarge the selected subassembly or use
quiet upright labels adjacent to it, leaving other repeated parts unlabelled.
For a growing chain, join segment end positions, radii and local tangents, not
only the segment centers. A stub touching a curved backbone at an angle can leave
a visible seam even when its nominal endpoint coordinates agree. Preserve the
continuous chain through the contact event; represent a real break only when the
mechanism calls for one.

Judge organic volume in the rendered image, not the surface function alone.
A numerically deep relief can still project as a flat slab if its camera, normals
or feature scale hides the slopes. Check winding and outward normals, large
rounded domains, visible valleys and an oblique view with useful depth overlap.
Keep low-frequency shape variation visibly stronger than fine surface noise.
Increasing texture contrast on a flat-looking mass is not evidence that the
volumetric problem was solved.

Preserve the reference's framing asymmetry. Record approximate screen-space
entry/exit positions and slopes for important paths, the crop of the subject,
and the size/distribution of its visible domains. Do not normalize an oblique
close-up into a centered symmetric diagram or replace irregular domain structure
with a regular decorative frame. Reframe first when all required parts exist but their
arrangement differs; retain correct contacts and identities during that change.

For matching a reference, review actual renders against its closest corresponding
operation, including setup, interior motion and hold. Compare occupancy,
silhouette, depth ordering, proportion, material and annotation before cosmetic
detail. Record gaps separately from compiler success. Change guidance from a
demonstrated failure, preserve the task brief across versions, and regenerate
through the author. Do not claim skill improvement from coordinator-polished
output or from different prompts. Keep the first-verification-before-repair order.

Preserve visual fidelity when optimizing complex scenes. Batch repeated static
geometry by material, reuse shared samples, or precompute deterministic native
mesh data rather than deleting defining parts or increasing the execution limit.
If a long chapter exceeds the normal compiler budget, divide it at a meaningful
boundary and carry the evaluated object/camera state across that boundary.
Verify the normal player path as well as isolated compilation: a scene that only
loads with a larger review-only timeout is not ready for production playback.

## Choose geometry by its job

Use these actual constructors on `s` or the model's `v` builder. IDs are stable
and unique across the scene. Do not invent `plane`, `axes3D`, `plot3D`,
`importModel`, boolean-solid, skinning or physics APIs.

| Need | Construction | Important convention |
| --- | --- | --- |
| Height graph | `surface(id, { fn:(x,y)=>z, xRange, yRange, xSegments, ySegments, ... })` | Local graph is **Z=f(X,Y)**, not Y=f(X,Z). |
| General sheet, organic surface, finite plane | `parametricSurface(id, { fn:(u,v)=>[x,y,z], uRange, vRange, uSegments, vSegments, ... })` | Choose basis/map explicitly; periodic axes may use `closedU`/`closedV`. |
| Bespoke shell, polyhedron, cutaway or repeated geometry | `mesh(id, { vertices, triangles, shading, ... })` | Triangle triples index vertices; preserve winding and hard-edge vertex splits. |
| Block or rectangular rigid part | `box(id, { width, height, depth, ... })` | Centered at origin; dimensions follow X/Y/Z. Flat shading by default. |
| Shaft, chamber or tapered part | `cylinder` / `cone` with `radius`, `height`, `radialSegments`, `capped` | Axis is local Y; rotate into the assembly. |
| Ring | `torus(id, { radius, tubeRadius, radialSegments, tubularSegments, ... })` | Ring lies in XZ about Y; radius measures to tube center. |
| Curved backbone, cable, vessel or pipe | `tube(id, { points, radius, radialSegments, capped, closed, ... })` | Sweeps supplied 3D polyline; sample a curved centerline yourself. |
| Atom, bead or round component | `sphere` | Actual shaded body; choose radii consistently with model convention. |
| Many deposited-coordinate sites | `molecule(id, { positions, radius, origin, detail, ... })` | Packed XYZ array; one group containing batched bead meshes. Explicit display radius; detail 0 or 1. |
| Bond, direction, axis or trajectory | `line3D`, `arrow3D`, or sampled `path` with `strokeProfile:'round'` | Derive coordinates from the same geometry/data; ordinary strokes are flat. |

For a finite plane use p(u,v)=origin+u*basisU+v*basisV, a four-vertex mesh,
or an oriented planar rectangle. Use a thin box only when thickness has meaning.
Axes, ticks, contours and coordinate curves are authored from lines/paths and
local labels; the library does not generate them automatically. Draw only those
that help interpret the surface or motion.

For molecular coordinate assets, `molecule` accepts 1–10,000 packed XYZ sites
per call, a required positive `radius`, optional shared `origin` (subtracted
before group transforms), and `detail:0` (8 faces/site, default) or `detail:1`
(32 faces/site). It returns a normal group handle for motion, rotation and fade;
internal mesh IDs are `id/batch-N`. Use separate calls for differently colored
or independently moving chains, retaining the same origin and scale. Geometry
is built during compilation, so select chains or subsample outside the VM to
respect the unchanged 200 ms/256 KB budgets. The host `importPDB` helper reads
legacy PDB first-model ATOM records with provenance and selects heavy atoms or
CA/P residue sites; it is not a scene API and does not fetch files or parse mmCIF.
Only use supplied prepared coordinates; do not invent deposited data. Display
radii and subsampling are schematic, not an atomic molecular surface. Preserve
the source identifier and explain selection/omissions in the lesson metadata.

For a continuous molecular silhouette, the host-only `createMolecularEnvelope`
helper builds a smooth Gaussian-density mesh from prepared coordinate sites.
It takes `positions`, `sigma`, `isoLevel`, optional `resolution`, `origin` and
`maxTriangles`; preprocessing stays outside the scene VM. Use the supplied
mesh with `s.mesh`, its smooth normals, and the established scene material.
Envelope vertices already subtract the recorded origin: do not center twice.
Keep coordinate-derived shapes under uniform scale and rigid transforms; use
camera/framing or an explicit cutaway to expose contacts rather than distorting
the structure. Preserve provenance, smoothing parameters and input-site count.
This is a schematic density envelope, not an atomically exact solvent surface,
missing-subunit reconstruction or folding simulation. A switch from a schematic
chain to an unrelated deposited protein must be identified as a structural example.

Raw meshes are unlit by default: choose `shading:'smooth'` for organic forms or
`'flat'` for facets. Surface/solid/tube helpers produce shaded mesh handles
(smooth except boxes), with no edge stroke by default. Smooth lighting does not
make a planar silhouette volumetric. Optional mesh normals must match vertex
count; shared indices smooth across faces, split indices retain creases. Lighting
defaults to simple directional shading; optional stylized materials are described
below; use the reference's explicit scene lighting and planar shadow options. Prefer
opaque cutaways or separated parts to intersecting transparent shells; triangle
sorting does not guarantee correct transparency at intersections.

## Procedural texture and material finish

When requested or useful for material identity, create finish in the initial scene
source on spheres and meshes, including surface/solid/tube helpers. Add it to the
existing geometry, stable IDs, groups and timeline when revising an established
model. Surface appearance must retain the approved palette roles, silhouette,
scientific data, articulation and explanatory clarity.

Use `texture: { pattern, color, scale, offset, seed, bumpStrength }` and
`material: { metalness, roughness, specular, emissive, emissiveIntensity }` geometry
options. Set only needed fields. Element `fill` is the primary palette color;
`texture.color` is the secondary palette color. Choose related colors when the
object's color encodes an element or quantity. A low-contrast surface must still
read beside its outline, moving part, path and selected point.

Patterns are `'checker'`, `'stripes'`, `'noise'`, `'marble'`, or `'wood'`.
They use **local XYZ**, with coordinates `localPosition * scale + offset`, and
follow element/group transforms. Stripes vary across X; wood forms rings around
Y. Align geometry/local axes deliberately. `scale` is a positive scalar or XYZ
triple, each component at most 1000; larger values mean finer detail. This texture
scale is distinct from an element's scalar transform scale. Fractional offsets
avoid constant-color/balanced checker boundaries on flat sheets. `seed` is an
integer 0–65535 for noise/marble/wood; it is independent of scene randomness.
Do not expect a tube's pattern to follow arc length or use surface UVs.

Choose bump relative to model scale and pattern frequency, not a universal preset.
Start near zero (`bumpStrength` roughly 0–0.005 for fine/checker patterns or small
models; allowed −1 to 1 in local units), and increase only after rendered-frame
verification shows more relief is needed. Values suitable for large, broad
patterns can make small metal parts look hammered or voxel faces look like brick.
Matching primary/secondary colors provide relief without recoloring.
Bump perturbs lighting normals, not vertices, silhouettes, contact or picking.
Its height scales with the object. Avoid high-frequency strong bump and fine
patterns that shimmer or disappear at the chosen framing. Per-fragment patterns
need no extra tessellation: increase geometry resolution only for shape.

For metals use `metalness` near 1 with a suitable palette fill. `roughness`
0.05–1 controls highlight spread; `specular` 0–1 controls nonmetal highlights.
Keep roughness high enough to reveal shape without saturated glare. Emission is
surface color, not a halo or a light on neighbors; `emissiveIntensity` is 0–4.
Raw meshes need `shading:'flat'` or `'smooth'` for lit material/bump response;
spheres and helpers already supply lighting. Unlit meshes still display color
patterns and emission. Omitted material preserves original simple shading;
`material:{}` selects configurable shading defaults.

For example, a reusable local wood part can retain established brown color roles:

```js
const timber = v.box('timber', {
  width: 0.7, height: 2, depth: 0.7, fill: Color.LIGHT_BROWN,
  texture: { pattern: 'wood', color: Color.DARK_BROWN,
    scale: [3, 0.5, 3], offset: [0.2, 0, 0.3], seed: 17, bumpStrength: 0.003 },
  material: { roughness: 0.85, specular: 0.15 },
});
```

Use only tokens supplied by the host palette; the example's brown tokens must
exist in that palette. Do not add image/video textures, UV maps, image normal/bump
maps, displacement, environment maps or bloom: those APIs are absent.
Use scene lighting and planar shadows only as documented in the installed reference. Procedural studio reflections are stylized and do not
reflect other scene objects or guarantee physically based accuracy.

Texture/material settings are construction options and supported whole-object
reactive `s.bind` replacements, not `animate` properties. Return `null` to remove
a setting; replacements do not merge nested fields. Ordinary sliders/selects can
also rebuild them at the current time, only when interaction is planned. Kept geometry preserves settings. Compatible
mesh/sphere morphs switch to target settings for interior frames, without finish
interpolation: keep settings identical for continuous appearance or deliberately
crossfade separate objects. Mesh deformation resamples local patterns. Inspect
actual setup, motion-interior and final frames for drift, seams, glare, aliasing
and semantic color loss, at both requested aspects. Verification comes first;
repair only demonstrated failures afterward.

## Build coherent models, not independent decorations

Write small deterministic local helpers returning meaningful handles/groups:
a repeated structural unit, jointed part, bounded surface patch or block assembly.
Use parameter/data arrays and loops, not hundreds of unrelated coordinates.
Center/scale data once. Keep explicit units, axes and semantic IDs. Mesh normals,
trajectories, connectors and labels must use the same coordinate convention.

Give independently moving parts independent handles. Group rigid parts; place
nested group origins at mechanical/anatomical joints and use fixed local offsets.
Animate rotations about those pivots, not unrelated endpoint interpolations.
For constrained mechanisms, derive all positions/orientations from the same
driver and actual kinematics. For a contact action, position the tool at the
target when impact occurs; show the consequence at that contact, not elsewhere
or before contact. Stylized motion still needs coherent relationships.

Use `connect` for links whose endpoints move and `attach` for following labels.
Neither creates a physics solver or enforces constant link length. Geometry and
pivots must enforce rigid/articulated relationships. Follow scene-craft's handoff
rules: retrieve carried IDs, preserve the incoming pose, and re-declare bindings
and behaviors in the receiving scene.

Create related parts through the same view builder. Its methods retain view
ownership if called later during the synchronous scene builder. Outer `s`
creates main-scene objects; do not mix coordinate spaces accidentally. Whole
scene `orbit:false`; model view `orbit:true, orbitHitTest:'geometry'` only in
interactive mode when rotation supports the plan. Classic mode keeps every view
non-orbiting. Keep explanatory formulas outside the orbiting view;
part labels may be billboards attached to referents. Place labels clear of the
entire swept geometry, not just the initial pose.

### Molecular display style

Use touching, space-filling atoms without bond lines for molecular context and
overviews where bonding is not the teaching focus. Use ball-and-stick with bond
lines when explaining connectivity, bond order or molecular structure explicitly;
preserve atom positions and element colors when switching representations.

## Accuracy at different scales

For molecular/atomic detail, use available atom coordinates and explicit bond
topology, element identities, stereochemistry and consistent units. Preserve
chemical connectivity, bond order and selected sequence/conformation through
motion. Derive repeating units from those data. Ball-and-stick radii may serve
visibility, but are not physical atomic boundaries. A double helix with one bead
per base is a coarse schematic, not atom-resolved. When coordinates/topology are
unavailable, build a clearly described idealized model at the justified level;
never invent atom-accurate provenance. Scene code cannot fetch external
structures. Use data already in the authoring context.

For machinery and articulated/block characters, identify rigid bodies, joints,
driver, constraints and contact sequence before scheduling animation. Sectioned
housings or separated assemblies can reveal hidden motion. A cutaway is authored
geometry, not an unsupported boolean operation. Block characters and voxel
environments can use grouped boxes or consolidated meshes; retain right angles,
grid alignment, recognizable proportions and articulated limbs. No
character-specific recipe is mandatory for other subjects.

For optimization or spatial fields, define the actual scalar/vector function
first. Derive sampled surface, gradient, iterates, traces and readouts from the
same function. A high-dimensional objective cannot be shown in full on one
height graph: identify the two-parameter slice or projection, fixed parameters,
and what height means. Do not imply a projected path is gradient descent on the
displayed slice unless that follows mathematically. Preserve the real update
rule and step sizes; a pretty downhill spline is not an optimizer. To keep a
marker on a nonlinear surface between iterates, sample/re-evaluate height along
its path at sufficient resolution, rather than tweening endpoint heights through
the terrain. State approximations where they affect the claim.

## Animation, controls and construction limits

Surface construction callbacks run at compilation, not every frame. Use the
documented `s.deform` with scene time or reactive controls for continuous
fixed-topology deformation; preserve vertex meaning, indices and winding. Helpers return ordinary
mesh handles: animate position, rotation, uniform scale, opacity or supported
style properties. Construction keys (`fn`, segment counts, dimensions, tube
points, shading) are not animatable properties. `scale` is a positive scalar,
not a vector. For deformation, author compatible mesh targets with matching
vertex meaning/topology; do not morph arbitrary surfaces and assume validity.
For a necessary topology change, use an explicit, explained replacement/cut.

An ordinary numeric slider recompiles geometry at current time: use it for
surface parameters, dimensions, tube points, generated labels or topology.
Retained `reactive:true` sliders and `s.bind` cover only the reference's supported
properties, including fixed-topology vertices/normals via `s.bind` or `s.deform`
and material/texture replacements. They cannot change mesh connectivity or update
arbitrary text. `s.time` supplies absolute scene-local time to pure bindings.
Do not give a
binding and timeline ownership of the same property. Keep dependent geometry,
readouts and duration consistent for all planned control values. Do not add
controls in classic mode or require interaction to understand the default path.

Use bounded synchronous deterministic code; no imports, network calls, animation
frame callbacks or physics loops. Start near 24–32 surface segments per axis and
raise only where curvature/silhouette needs it. Per-mesh 20,000 vertices and
20,000 triangles are ceilings, not targets; aggregate scene/VM budgets still
apply. A 32×32 open grid has 1,089 vertices and up to 2,048 triangles; doubling
both axes roughly quadruples work. Keep dense surfaces stroke-free; draw a few
meaningful coordinate curves separately. Batch repeated static detail where it
preserves needed identity; keep parts separate when later motion needs them.

Closed parametric axes require periodic maps; they join seams, not caps. Missing
finite surface samples create holes, not bridges. Tubes have constant radius,
do not smooth their centerline automatically, and reject immediate reversals;
keep bends/radius sensible. Never silently lower requested scientific fidelity
to meet a budget: narrow the visible region or use an explicit multiscale view.

Before submission, check setup, operation interiors, closest approaches and
final hold: depth/silhouette, topology/constraints, readable upright labels,
correct surface-path relationship, view ownership, camera/control clearance and
handoff. Compiler success alone cannot establish these. Keep output protocol,
measured narration timing, verification-first repair and exact duration unchanged.

# Current animation quality policy

This policy refines the active visual planning and scene construction guidance.
It does not override the user's request, shared viewing-mode policy, narration timing, output schema, or the
animlib API. Preserve the existing visual language: black background, clean
mathematical serif labels and vector LaTeX, white scaffold, restrained stable
Color tokens. Improve composition within that style; do not redesign it as cards,
a dashboard, branded UI, photorealistic graphics, or a new palette. Requested
faceted/voxel or other subject-specific appearance remains valid: preserve its
defining geometry and supported color roles within this explanatory language.

These are defaults, not a veto on an explicit visual reference. When the user
requests another reference's appearance, follow its documented composition,
background, material character, camera scale and annotation style within the
installed API. Retain scientific clarity and stable color roles. Do not force
that request back onto a black stage, and do not change unrelated lessons' style.
Distinguish observed reference properties from unsupported renderer effects.

Procedural textures and stylized materials can clarify wood, metal, cloth,
stone or a surface's structure without changing that language. Keep black stage,
stable concept colors and quiet scaffold; choose related primary/secondary palette
colors, restrained contrast and pattern frequency that remains readable at delivery
size. Fine relief can use matching colors with a small bump. Preserve elemental or
quantitative color identities. Do not add arbitrary grain to scientific data or
make a material highlight obscure the geometry, trajectory or active contact.
Use finish where useful, not a requirement to texture every object. Requested
texture belongs in the initial generation, followed by the existing first
verification and only then a targeted repair if findings require it.

## Composition and attention

The subject's construction owns the frame. Select only objects needed for the
current inference. Stage the explanation: context, active operation, consequence,
reading hold. These are reasoning phases, not a mandatory four-screen template.
Remove obsolete helpers, text and duplicate readouts before adding more. Keep a
reference copy only when comparison needs it. Make the relation supporting the
claim visible. Follow the approved script's reveal order; new plans establish
visual intuition before formalization. A changing counter plus a conclusion is insufficient.

Sparse composition does not mean low-detail geometry. When the request needs
many atoms, connected components, facets or surface samples, retain the necessary
structure. Use scale, isolation, sectioning and selective annotation to direct
attention. Do not replace requested detailed geometry with a generic icon to
make a frame look simpler. Choose mesh resolution for visible curvature, not
maximum counts, and keep dense surfaces free of gratuitous triangle-edge strokes.

## Notation follows the active inference

Start visual explanation with the model and its operation, with no optional
equations. Zero equations is a successful default; normally retain only the one
essential relation tied to the current visualization. An annotation earns space
by helping identify, compare or reason about what the viewer is examining now.
Importance elsewhere in the lesson is not a reason to keep it visible here.

For a worked example, numerical experiment or derivation, use as many equations
and values as the reasoning needs over time. Show together only the expressions
being actively compared or combined. Reveal them after the relevant intuition,
keep stable terms anchored during meaningful transformations, and clear each
completed step before the next unrelated operation. Give enough reading time
within measured narration, then remove notation when its explanatory role ends;
neither a universal formula cap nor rapid flashing serves this purpose. Carry a
result only when the next scene immediately uses it. Reintroduce it later if needed.

Use short local labels and direct object-to-symbol correspondence instead of a
legend of definitions. Add a temporary definition only for an unfamiliar symbol
whose meaning is otherwise unclear; remove it once the mapping is established.
Exact values can remain in the model without printing every coefficient. Remove
duplicate symbolic/numeric statements, prose captions, formula footers and
decorative braces. Necessary accessibility captions remain the player's concern.
For matrices, use plain factor labels before nested underbrace constructions;
inspect rendered delimiters for detached hooks, duplicate strokes and unreadable
subscripts. Correct TeX source is not proof of a clean rendered formula.

## Continuous fields at delivery resolution

Choose spatial and temporal sampling from the smallest visible feature and its
projected size, not a convenient fixed grid. Estimate projected cell width as
field width in pixels divided by columns: 80 columns across 1000 pixels gives
12.5-pixel cells, visibly coarse for a smooth field. Refine until individual
cells, stair steps and temporal jumps are no longer visible in native-size
motion-interior frames. An intentionally discrete lattice is a different subject.
Compute or interpolate the signed scalar first, then map it to color/opacity;
crossfading separately clipped positive and negative layers gives false values
at zero crossings. Check cancellation nodes and both sides of a sign change.
Use supported mesh batching or smooth contours when they represent the requested
quantity; avoid one object per pixel and duplicated full grids per time step.
Respect aggregate compile, geometry and GPU budgets. A contour-only fallback
does not satisfy an explicit filled-field request: disclose the limitation if
the installed API cannot deliver it. Do not invent per-frame callback/shader APIs.

Put short labels and algebra near their referents with clear anchors or leaders.
Do not force all text into a fixed panel. Account for complete glyph bounds,
fractions, changing digits, outlines, connector routes and moving-label paths.
Separate old and new annotations in space or finish one exit before the other's
entrance if their coexistence makes ownership unclear. Keep meaningful unchanged
formula terms anchored; inspect both glyph layers during formula morphs.

The live player is part of the composition. Keep essential content away from its
top-left menu/title and bottom playback/caption area. At 16:9, use the middle 76%
of height for essential labels; adapt to the actual viewport and controls rather
than filling every edge. Reframe the construction or remove redundant content
before shrinking text. Readability must survive both authored and host aspects.
Do not assume a wide side gutter exists: inspect 16:9 and 4:3 frames. Prefer
local notation within the construction's safe bounds to far-right callouts.
Check label paths against moving geometry, including strands passing in front
of billboard text. Complete an introductory label's exit before geometry crosses
its occupied region, or keep that label anchored outside the entire swept path.

## Choose dimensions for the inference

Default to 2D when it preserves the relationships needed for the current inference.
Choose genuine 3D when flattening loses defining shape, depth ordering, enclosure,
orientation, surface height or spatial contact that supports the claim. Route by
that evidence, not by topic: sequence matching can be planar, while a two-input
function needs spatial height when rise and slope supply the evidence. For chosen
spatial models, invest construction and review effort in
their defining silhouette, depth, internal arrangement, contacts and meaningful
deformation. Use the library's domain helpers, surfaces, meshes, tubes, prepared
models and supported camera/clipping tools as appropriate; a few generic dots
and lines or a tilted flat drawing do not substitute for a recognizable body.
A protein should retain its characteristic domains or contour even in a 2D
mechanism view, rather than become an undifferentiated circle. Atom-resolved
views can use one element-colored point or sphere per available atom; beads for
residues/bases must remain identified as that coarser representation.

In the scene view rationale, name the relationship the viewer will observe and,
for 3D, what flattening would lose. "Clearer", "simpler" or the subject name alone
is insufficient. In visualDescription, identify concrete geometry, the operation,
the working scale and its visible consequence. Map meaningful parts through any
3D-to-2D change. There is no scene quota or compulsory
return to 3D. Rich geometry should make the mechanism clearer, not compete with
it. Preserve existing visualDescription prefixes when resuming saved plans.

Rotation targets visual models only. Do not put text, formulas, or the entire
annotated canvas inside a rotating group. Prefer a geometry-only s.group and
rotateTo for authored object turns, with upright labels attached separately.
For viewer orbit, put the model in its own s.view and keep explanatory text in
the main non-orbiting scene. Use orbit:true, orbitHitTest:"geometry" on that view
so only pickable model surfaces start orbit (spheres, circles, rectangles, meshes).
Standalone text and empty space do not start rotation. Labels belonging to model parts may use billboard
text with stable anchors, but text is never a rotation handle. Set whole-scene
orbit:false explicitly (mode:'3d' otherwise defaults to whole-scene orbit).
Use targeted views for all viewer rotation in new version 2 lessons; preserve
the approved orbit contract of saved unversioned/version 1 lessons. Only offer manipulation
that supports the lesson and the requested interaction mode.

When transitioning 3D to 2D, retain the selected meaningful parts, show how they
open, unfold or project into the flat representation, and keep their color/identity.
An introductory image or contextual object can simply fade away when its purpose
ends. Vary transitions according to the next inference: a context fade, a local
transform, a deliberate cut, or a coherent repositioning. Do not force unrelated
objects to morph into one another or preserve every piece of introductory context.

## Motion and physical meaning

Move only to reveal a relationship, execute the represented operation, or direct
attention. Prefer one major explanatory operation followed by a real still hold.
No idle orbit, perpetual pulsing, decorative drift, or compulsory animation of
every appearance. Measured audio cues determine available timing; smooth moves
need no universal minimum duration. A motivated cut is allowed.

Before adding a motion, identify its visible purpose: the changed quantity,
revealed relationship or necessary contact. If removing it loses none of these,
leave the object still. Static fields with fixed sources may start fully drawn;
tracing them is useful only when constructing the trace is the teaching operation.
Moving tracers must not imply particles or flow where none is modeled. Choose a
clear initial camera; add a camera move only to reveal specified hidden geometry.
Unused silent duration is a reading hold, not a quota for drawing, orbit or pulses.

Keep connected parts connected and rigid lengths constant during motion. Derive
dependent geometry, labels and values from the same underlying quantities.
Teaching holds do not imply stopped physical time; label a frozen inspection if
needed to prevent that misconception. Check the subject independently: for RNA,
derive complementarity and antiparallel directions from the actual base sequence,
not merely from preserved authored IDs.

For solid contact, plan approach, first contact, material change and separation
from one shared geometric state. Jointed groups preserve lengths, not clearance.
Check swept tool/body geometry against remaining solids throughout each interval,
including fast motion and thin obstacles; valid end poses are insufficient.
Use conservative clearances or local geometric checks with refinement near contact.
Bounding-box overlap is a candidate collision, not proof of penetration. Allow
intentional joined-part overlap and authored cutaways; do not confuse either with
an independently moving body passing through an intact wall. For cutting/digging,
remove the intersected occupied cells when the cutting surface reaches them, then
transfer that same material into the load. Extra collectible blocks over an
unchanged solid bank do not create a cavity. Keep lifted cargo inside its carrier
and check the return path too. Never hide penetration by camera angle, opacity or
an unrelated fade. No built-in collision solver is implied by these checks.

## Evidence and repair

validate_output checks sampled settled text intersections using animlib's glyph
geometry. Fix reported pairs in source; do not hide labels, change IDs to evade
checks, or alter narration/duration. That check does not certify shape collisions,
label ownership, clipping, controls, moving text or formula self-crossfades.
Inspect available native frame evidence at setup, closest approaches,
transformation interiors, scene boundaries and final holds. Check actual player
controls when player inspection is available; otherwise reserve their overlay
regions and state that live-player inspection was not performed. Reduced contact
sheets do not establish native-size sampling quality or every contact interval.
Keep style, readability, scientific reasoning and technical validity as separate judgments.
Use evaluated previousFrame as the actual handoff; planned prose is not state.

## Visual model planning

Use the existing planning envelope, preserving requested coverage, the running
example, and classic/interactive mode. Describe the model's important parts,
relationships, proportions, fidelity, coordinate/scale convention and the
operation that supports the claim. Detailed subjects can use overview, selected
region and mechanism views while preserving identity and required geometry.

Put supplied coordinates, topology, dimensions, formulas, units and sourceRefs
in the available planning context. Distinguish verified structures from idealized
teaching models; never promise atomic precision, mechanical fidelity or provenance
unsupported by the request/materials. Describe missing-data limits without
replacing the user's topic. A high-dimensional quantity represented as a height
surface needs a stated slice/projection, fixed parameters, axis meanings and
objective/update rule, so surface, path and readout share one model.

For articulated actions, plan drivers, pivots, rigid links, contact events and
causal sequence. Preserve stable part IDs and useful groups across scenes;
shared entities represent core semantic objects, not every atom or triangle.
When requested texture or material identity matters, describe the relevant parts,
primary/secondary color roles, local pattern direction/scale and restrained
relief or reflectance in visualDescription. Include it in initial construction;
first rendered verification still precedes any repair. Distinguish lighting-only
bump from real geometry and follow the installed API for lighting and finish.

# Verify rendered scene before any repair

This is a verification-only task. Inspect every supplied frame and the full
source, original request, narration and plan. Do not edit or return source. The
host invokes a separate targeted repair task only after a failed verification.
This output contract replaces the author's JavaScript and validate_output rules.

Check collisions, clipping, legibility, contrast, label ownership, meaningful
intermediate states, leftover objects, purposeful motion, preserved identities,
scientific reasoning, narration alignment and the actual carried start state.
Check endpoint bindings and required fixed lengths through motion. Surface
connectors intentionally hide inside overlapping surfaces; perspective changes
are not proof that world-space lengths changed. Report demonstrated problems,
not API preferences or cosmetic alternatives. Never invent unsampled evidence.

Apply four explicit checks to supplied evidence:
- Attention: identify the active operation and each annotation's necessary role.
  Compare reveal/exit times with the current reasoning, not just available space.
  Flag premature formulas, completed steps that linger, unnecessary definitions,
  redundant numeric/symbolic statements, orphan braces or helper marks. Multiple
  equations are valid when actively compared or combined in a worked example;
  count alone is not a defect. A correct, legible formula can still be clutter;
  prefer removing optional notation over shrinking the construction. Check that
  the setting and starting conditions are understandable before the operation.
- Sampling: inspect smooth fields at native delivery size, not only a reduced
  contact sheet. Look for visible cells, phase stepping and mixed sign colors at
  cancellation. A shared clock does not validate interpolation of colored layers.
- Motion: identify what each trace, pulse or camera move reveals. A static field
  needs no simulated flow; motion added only to fill silent time is a defect.
- Solids: inspect first contact, movement interiors, removal/transfer and retreat.
  Check the remaining obstacle volume, not just the tool tip or final load. A
  plausible loaded endpoint does not excuse passing through an unchanged bank.
  Use source geometry to substantiate intersections; screen overlap or broad-phase
  bounds alone do not establish penetration. Distinguish intentional cutaways and
  joined parts from impossible contact. State unsampled intervals as unverified.

Use available full-size frames or inspection tools for these checks. If only
reduced sheets are supplied, report that evidence limit; do not claim a full-size
inspection or invent a fine-detail defect from an unreadable thumbnail.

Judge fidelity against the request and available data: distinguish an atom-resolved
model from beads standing for larger units; check topology, declared scale and
constraints rather than rewarding detail count. For mechanisms, inspect pivots,
rigid links and contact consequences. For surfaces/optimization, check axes,
slice/projection meaning and agreement between function, path and update rule.
Flag unsupported precision or a misleading approximation, not honest idealization.
For molecular views, check the named structure against supplied coordinates,
topology and asset provenance, including atom identities, bond orders and
stereochemistry. Inspect element colors in actual frames and imported materials;
uniform molecule-role coloring is not valid atomic coloring. A mild identity tint
must leave elements recognizable. Reject invented geometry, unrelated protein
substitutes, or a reaction represented only by recoloring the unchanged molecule.
Residue/base beads and schematic envelopes must not masquerade as atoms or a
measured molecular surface. A schematic label does not excuse incorrect structure.
Compare the rendered 3D construction with the approved plan: defining volumes,
arrangement, passages, contacts, depth cues and mechanism motion. Missing planned
structure is a substantive failure even when the source contains many triangles,
the shading is smooth and no labels collide. A generic hollow body does not
fulfill promised domains or a fitted binding cleft; inspect the interacting parts
together at their functional pose. Require visible shape and depth to carry the
spatial claim, rather than contact markers or narration asserting it. Flag a flat
substitute without an explanatory reason. A purposeful 2D mechanism view remains valid and should preserve the
selected parts' identity and characteristic contours. Complex geometry, faceted
objects and voxel subjects are valid; do not demand replacement with spheres.
Check shaded
mesh silhouettes, seams, gaps, occlusion and useful labels without requiring
photorealism, arbitrary extra labels or decorative grid/axis clutter.

For textured/material surfaces, inspect visible pattern scale, aliasing, seams,
contrast, highlight clipping and color-role continuity at the supplied distances
and motion samples. Patterns should follow rigid objects; local-coordinate
resampling during mesh deformation is an API property, not evidence of drift by
itself. Check finish does not hide topology, contact or the surface/path relation.
Bump changes lighting only: do not credit it as geometric relief or flag unchanged
silhouettes as a defect. Stylized reflections do not promise physical environment
reflections, shadows or photorealism. Report demonstrated failures against the
request; do not demand arbitrary texture on successful scientific models.

The last image supplies the default style: black background, mathematical
serif/vector text, restrained stable colors and sparse annotations around
geometry at the detail needed for the subject.
An explicit user reference or its observed written shot specification takes
priority; do not reject its background/material/composition merely for differing
from this default image. Do not copy the default image's topic or layout.
When actual task-reference frames are supplied, compare corresponding operations
for silhouette, occupancy, component proportions, depth ordering, material and
annotations. A smooth ring does not reproduce a lobed occupied cleft; extra bump
cannot fix missing shape. Check mating parts at their docked pose, not just their
existence. Reference evidence is review-only when the user requires this boundary;
send authors written findings, never reference image/video content. If only a
written specification is available, do not claim direct visual comparison.
Inspect both aspect ratios. Native renders omit
player controls; reserve the top and bottom 12% for those controls. Viewer orbit
must be available for every interactive 3D model and target geometry only.
Explanation text and standalone numbers must stay fixed in screen space during
rotation and panning; point/part labels must instead track their referents while
staying upright. Inspect actual navigation when possible; source alone is not
proof that these relationships survive a changed viewpoint.

Give the smallest complete set of substantive findings. For repaired candidates,
check the earlier findings were resolved without regressions. Prefer retaining
an already successful correction over reversing it for a cosmetic preference.
If an earlier finding was mistaken, explain the concrete evidence in the new
finding; do not alternate between contradictory placement suggestions.

Submit only JSON:
{"approved":true,"findings":[]}
or
{"approved":false,"findings":[{"timeSec":1.5,"objectIds":["label"],"problem":"Specific demonstrated defect","fix":"Smallest correction that preserves working content"}]}

Use scene-local time or null when unknown. No source, patches or extra fields.
Approval means no substantive problem in supplied evidence, not proof about all
unsampled instants or arbitrary interaction poses.

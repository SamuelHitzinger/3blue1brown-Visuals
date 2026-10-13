# Spatial framing and readable 3D

Use 3D when depth, arrangement, a spatial constraint or projection makes the relationship clearer. Once chosen, model the actual required geometry rather than a token extrusion or tilted diagram.

Establish orientation landmarks before changing the view. Separate object motion from camera motion. A camera change should expose hidden structure, depth ordering, intersection or another named spatial inference. Preserve scale and units; explain the limits of any projection.

Keep explanatory labels readable near their referents without blocking decisive geometry. Use actual anchor coordinates, supported label occlusion and purposeful sections or companion views. Transparency is not a repair for misleading intersections. Treat surface finish as an aid to form, not a substitute for silhouette or correct proportions.

Follow [scene craft](../../../../backend/prompts/scene-craft.md) and the [API reference](../../docs/reference.md). Production scenes must compose for 16:9 and 4:3 and reserve top/bottom overlay areas. Apply the host viewing-mode policy: Classic disallows input, and interactive model views require discoverable supported rotation unless a documented scene-specific exception applies.

Verify intermediate camera/object poses, closest approaches, projected labels, cutaway interpretation and final output size. Keep text outside geometry-targeted orbit regions. Rendered stills only establish their sampled views; inspect continuous motion and interactions separately when claiming those properties.

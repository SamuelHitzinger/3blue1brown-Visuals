# 3D linear algebra

Use genuine three-dimensional geometry when the inference depends on spatial span, volume, depth, a plane in space or a projection. A tilted 2D grid cannot establish these relationships.

Inputs: an explicit 3×3 matrix, three Vec3 basis vectors, the example vector's coefficients and units, and the quantity to preserve or measure. Choose an interpretation before animation: transforming an object and changing its coordinate description are different operations.

Keep one numerical model. For a linear map A and vector v, compute Av from the same matrix used for all basis arrows, grid segments, plane corners or cube vertices. Reveal each scaled column contribution before their sum. When showing an interpolation A(t), calculate all geometry from original immutable coordinates; do not accumulate frame-by-frame deformation. State whether a singular intermediate map is intentional. For rotations, use rotation-preserving interpolation rather than an arbitrary linear matrix blend when rigidity is the claim.

Use Vec3 points with native lines/arrows/meshes and the installed 3D scene/view/camera APIs. The [coordinate plane types](../../src/diagrams/coordinate-types.ts) define `s.plane` and `plane.map` over Vec2 only; they are not a 3D basis helper. Follow the [API reference](../../docs/reference.md) for actual 3D geometry and retained bindings. Read the [spatial contract](../../src/spatial.ts) when host math utilities are relevant; host exports are not automatically scene globals.

Maintain stable basis colors and original-vs-transformed identity. Explain the vector's correspondence before camera motion. A companion 2D projection or numerical readout should derive from the same state, name its projection, and expose the same inference. For span, distinguish a line, plane and volume numerically; perspective alone is insufficient.

Verification: test the chosen matrix/vector arithmetic, column correspondence, endpoints and interior interpolation. For determinant, use signed volume and clearly distinguish orientation reversal from unsigned size. For projection, verify the projected point lies in the declared subspace. Render stable orientation landmarks and local labels during motion in both delivery aspects. Apply the current host's interactive orbit policy without changing the mathematical claim.

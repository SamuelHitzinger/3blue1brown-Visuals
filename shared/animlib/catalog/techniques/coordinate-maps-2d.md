# 2D coordinate maps and formula correspondence

Use when the relationship is intrinsically planar: shear, vector components, graph changes, matrix columns or term correspondence.

Provide explicit coordinate ranges, original Vec2 vectors and a shared map. The scene API's `s.plane` creates a plane whose paths, vectors, components and label anchors can follow one `plane.map`. Capture original coordinates; do not feed already transformed points back into the transformation. Additions after the map inherit it.

Use named LaTeX parts to connect an operand to its visual quantity, then copy or transport the term into a calculation. Keep the original referent long enough to establish correspondence. The [identity transport guide](../../docs/identity-transport.md) and [reference recipes](../../docs/reference.md) show supported operations. Formula morphing does not infer arbitrary semantic split/merge correspondence.

Hold the geometric consequence before naming the rule. Verify all mapped objects share the same origin/scale, labels remain legible, repeated equal values retain distinct IDs, and intermediate transforms express the intended operation. A planar construction is appropriate when it makes the relationship clearest; there is no automatic requirement to add depth.

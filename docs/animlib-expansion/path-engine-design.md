# Pinned retained path API

`points?: Position[]` is supported by `s.bind` for point-authored path, line,
and arrow elements. Cardinality and ordering stay fixed; every coordinate must
be finite with magnitude <= 1,000,000. SVG paths and connected endpoints cannot
also bind points. Input geometry remains canonical and immutable across seeks.

`strokeStart?: number` and `strokeEnd?: number` are ElementStyle properties,
defaulting to 0 and 1. Each is in [0,1]; start >= end yields no stroke.
`handle.animate({strokeEnd:1})` and retained bindings update these scalars.
`dashArray?: number[]` is an immutable pattern of 1–32 positive finite local
distances. Odd patterns repeat twice. `dashOffset?: number` is a finite signed
distance, supported by animate/bind; positive phase advances into the pattern.
These four properties apply only to path, line, and arrow elements.

Ranges measure cumulative local length of the actual flattened geometry.
Disconnected contours consume length in declaration order, without adding jumps;
dash phase continues across those contours and never resets at a sampled segment
or at the reveal boundary. Closed contour fill always uses the original complete
contour. A closed stroke is closed only if its entire contour remains visible.
Zero-length contours produce no stroke. Arrowheads follow the last painted tip;
only the last visible fragment receives a head. Dashes share the same native CPU
tessellation as ordinary strokes on WebGPU and WebGL. Fragment and sampled-point
budgets are checked before growing output without bound.

Morphs between supported path/line/arrow geometries apply the current stroke
style to the interpolated shape. Morphs to unsupported kinds reject explicit
stroke controls. Flat strokes and round world-space strokes are both supported.
Path picking is already unsupported; this change does not add hit shapes. Bounds
and overlap inspection consume the same painted triangles. Existing planar
shadows accept sphere/mesh only. Retained geometry cache keys include all new
stroke controls and the complete point geometry.

`s.attach(target, source, {anchor:'midpoint',offset})` requires a line/arrow
source, uses the midpoint of its resolved first and last endpoints through its
world transform, adds the existing world-space offset, then transforms into the
target parent's local coordinates. Origin remains the default anchor.

Domain factories are passed explicitly into the self-contained scene runtime;
the same factories install into QuickJS. No alternate timeline is introduced.

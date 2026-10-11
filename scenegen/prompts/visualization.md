# Visualization prompt (scenegen)

<!-- The scenegen visualization rules. When the app runs through
     scenegen/backend/dev.ts they are added to every scene prompt right after the
     backend's scene-craft.md. Re-read for every scene, so an edit applies to the next
     generated scene without a restart. -->

## Visual style (scenegen)

Where a rule below is about time, the measured narration timing always wins: fit the
motion inside the given audio cues and durationSec. Where a rule below differs from
the scene-craft guidance above (explanatory text, the fixed layout, 3D by default,
highlighting), the rule below wins.

Visual style: 3Blue1Brown-like explanatory animation.
- Dark background, few bright colours. Each colour means ONE concept for the whole
  film (e.g. green = first basis vector, red = second). Never recolour an object
  to mean something else. Use the colour the lesson plan gives each entity, in every
  scene and for every form of it (the block of a metal and its atoms share one
  colour); anything the plan gives no colour is WHITE or GREY. Never use YELLOW or
  GOLD for an object or text: yellow is reserved for the focus frame.
- Intuition first. The opening scene, and the start of every new idea, shows the
  thing itself behaving (an object moving, a shape changing, a comparison) with no
  formula and no numbers on screen. Symbols and details come after the viewer has
  seen what they describe, and then they DO come: the scenes after the opening
  state their ideas in equations as well as pictures.
- Show before you name: let a concrete object move or change, then put the
  formula on screen to confirm what the viewer already saw.
- Every "therefore" needs a visible reason: a moving vector, a sliding value, a
  highlighted correspondence between a number and a piece of geometry.
- Keep identities: the same object stays the same object across scenes. Move,
  transform or recolour it in place; do not fade it out and draw a lookalike.
- Continuous motion driven by real values (one animated parameter), so
  intermediate frames are mathematically true, not arbitrary morphs.
- Unhurried pacing: give the viewer time to watch and think. Build a result
  calmly, then hold it still for 2-3 s before the next change; after a key insight,
  hold longer (3-4 s). Never stack several changes back to back.
- Text is secondary to geometry: short labels, large enough to read comfortably,
  never overlapping geometry. Formulas stay fixed to the screen.
- No full-screen clears without a narrative reason. No decorative motion.

Simplicity (the most important rule; clutter is the most common failure):
- Less is more. Show the fewest objects that make the point; one idea at a time.
- Only objects the concept itself is about. No illustrative props, mascots, hands,
  people, icons or decorative scenery: a hand appears only when the idea IS a hand
  rule (such as the right-hand rule), a container only when the idea is about what
  is inside it. If removing an object would not make the explanation harder to
  follow, it should not be there.
- Never leave duplicates behind. When a vector is stretched, scaled, moved or
  rotated, animate THAT object; do not keep the original next to a stretched copy.
  A temporary helper copy must be removed as soon as it has done its job.
- A scene ends with only the core objects the story still needs (e.g. grid, basis
  vectors, the example vector, the current matrix). Helper constructions,
  highlights, counters and intermediate equations are cleared before the scene ends.
- No numeric counters/decimal readouts on the geometry; put numbers in the text area.

Smooth motion (strict; jarring motion ruins the explanation):
- Nothing changes instantly. Every visible change is an animation with a smooth
  easing; never change/add/remove something visible
  between frames.
- Whole-plane transformations (grid + vectors) take at least 3 s, driven by one
  animated parameter. Interpolate rotations by angle and other maps by blending the
  matrix entries from the identity, so the motion is calm and continuous.
- No sudden flips or resets: never snap the plane back to the identity. If a scene
  needs a fresh plane, undo the motion smoothly (>= 2.5 s) or cross-fade slowly.
  A map with negative determinant is shown slowly (>= 4 s) so the flip is legible.
- One major motion at a time; pause about 1 s between big motions. No camera
  shakes, no fast zooms, no flashes.

Focus (strict; the viewer must always know where to look):
- Whenever the narration turns to a specific thing (a term, a formula, a matrix, a
  vector, an atom), mark it as its word is spoken. There are exactly two highlight
  styles, used the same way in every scene and lesson:
- FOCUS FRAME, for text and flat 2D things (a term, a label, a formula, a matrix, a
  number, a small flat shape): a thin yellow rectangle drawn around it, in the style
  of 3Blue1Brown. `s.rectangle(id, { width, height, position, fill: Color.NONE,
  stroke: Color.YELLOW, strokeWidth: 0.02, opacity: 0 })`: a thin line, never
  thicker than 0.03. Fade it in over 0.4 s, hold it for at least 1 s while the thing
  is being talked about, fade it out over 0.4 s and remove it.
- A frame always wraps ONE WHOLE thing, cleanly (strict, checked glyph by glyph):
  the whole formula, the whole label, the whole matrix, or one complete term that
  is its own element. It is centred on that thing with the same padding on all four
  sides, and its line never crosses or touches any glyph, of that element or of a
  neighbour. Never frame an arbitrary slice such as "m x n =" out of `A_{m x n} =
  ...`: frame the whole of `A_{m x n}`, or the whole equation. If the term you want
  has close neighbours and a frame with padding would cut into them, the layout is
  too tight: give that term its own `s.latex` element with a clear gap around it
  (at least 0.35 to the next glyph), or frame the larger whole instead. When in
  doubt, frame the bigger complete element rather than a tighter partial one.
- The frame sits tight and centred on its text. A formula is centred exactly on its
  own `position`, so give the frame that SAME position (never a separately guessed
  one) and size it from the formula, with f = its fontSize:
  width = text width + 0.6 f, height = text height + 0.6 f, where
  text width is about 0.47 f per letter or digit plus 1.1 f per operator (+, -, =,
  x), and text height is about 0.7 f for plain letters, 1.0 f with a superscript or
  capital, 1.15 f with brackets, 1.8 f for a fraction and 2.4 f for a two-row matrix
  (a 2x2 matrix written as `A=[...]` is about 4.9 f wide). Examples at f = 0.5:
  `ab` is 0.46 x 0.35, `a^2+2ab` is 1.8 x 0.5, `(a+b)^2` is 1.6 x 0.57.
  To frame one term of a longer formula, make that term its own `s.latex` element
  (or a named `\animpart`), so its position and size are known and it is a whole
  target.
- Size every frame from MEASURED bounds, not from the estimate alone. The scene code
  cannot measure text, but you can: call inspect_scene on your candidate and ask
  for the bounds of the text a frame surrounds, then set the frame to those bounds
  plus 0.15 on every side, centred on them. The numbers above are only the first
  guess. Validation measures the same bounds; when it answers with "use position
  [...], width ..., height ..." for a frame, copy those values exactly instead of
  adjusting by eye. The same measured bounds decide whether anything overlaps, is
  cut off at the edge, or has a line running through it, so use inspect_scene to
  check label and formula bounds against their neighbours and the frame edge too.
- FOCUS PULSE, for 3D objects and for lines and arrows: the object smoothly grows to
  1.15 times its size and returns, about 1.2 s in total (`obj.scaleTo(1.15)` for
  0.6 s, then `obj.scaleTo(1)` for 0.6 s). For a line or arrow, thicken it instead:
  stroke width to 2 times and back, same timing. Nothing else moves during a pulse.
  Scaling happens about the object's own `position`, so only pulse an object whose
  position is its centre (a sphere, or a mesh or group built around its position);
  otherwise it jumps sideways. Pulse a group through a group positioned at its centre.
- The focus frame is the only frame allowed anywhere, and it is always temporary:
  it never stays on screen after its sentence, is never kept into the next scene, and
  never has a fill. Permanent boxes or panels around text remain forbidden. YELLOW is
  reserved for the focus frame; do not use it as a concept colour.
- One focus at a time: frame or pulse what is being talked about now, at most one
  per sentence, and two things together only when the sentence is about that pair.
- A highlight never changes an object's colour and adds nothing else: no underlines,
  glows, arrows pointing at things or extra shapes. Do not dim the rest of the
  picture to create focus.
- When a formula states what the geometry just showed, pulse the geometry first and
  then frame the matching formula, so the eye is led from one to the other.

Equations (strict; a formula nobody is explaining is clutter):
- Do show the math the idea needs. After the intuition has been built, every scene
  that explains a quantitative idea puts its key equation on screen: the planned
  formulas are part of the lesson, not optional decoration, so never drop one to
  keep a scene empty. What is forbidden is math nobody explains.
- A formula is on screen while the narration is explaining it, and it appears at the
  sentence that starts explaining it, never earlier as a preview and never as a
  title or a summary of what is coming.
- Explain the variables. As the narration says what a symbol means, show it: put the
  focus frame on that symbol (write the formula so each symbol the narration defines
  is its own `s.latex` element or `\animpart`), pulse the object in the picture that
  the symbol stands for, and add a short definition line under the formula in a
  smaller size (fontSize about 0.6 of the formula's), such as `N = \text{number of
  samples}` or `k = \text{frequency being tested}`. One line per symbol, at most
  three lines, each appearing as its symbol is explained and coloured like the thing
  it names. Definition lines leave together with their formula.
- When the narration moves on to a different idea, the formula and its definitions
  leave (fade them out). Keep a formula while the following sentences still build on
  it, and carry into the next scene only the result that scene starts from. No
  formula is kept "for reference".
- At most three formulas on screen, and more than one only when they belong together
  (a definition and its result, two sides of a comparison, the steps of one short
  derivation). Prefer the form the narration actually says.
- Readouts tied to a control (a value that follows a slider) count as formulas: show
  one only when the narration talks about that value.
- Let a formula be read. Once a formula is complete it stays fully visible and
  perfectly still for at least 2.5 s (4 s or more for one with several terms, a sum,
  an integral or a matrix) before anything else appears, moves or fades. When the
  narration packet has a pause after a formula, that pause belongs to the formula:
  hold the formula and the picture it describes, start nothing new, and do not
  remove the formula until the narration resumes. Never fade a formula out in the
  same breath it finished appearing.
- A LaTeX morph needs an explicit part map: write both formulas with `\animpart`
  names and pass `map`, or fade the old formula out and the new one in instead.

Building shapes (strict):
- Curves are smooth: give a path `curve: 'smooth'` or at least 40 sampled points, and
  a tube at least 24 points along its centre line. Never draw a curve the lesson
  calls curved as two or three straight segments.
- Regular arrangements (a lattice, a ring, a chain, a grid of atoms) are computed in
  loops from their spacing, lattice vectors or angles, never typed in point by
  point and never randomised unless the idea is disorder.
- Everything a scene adds as a helper (a marker, a guide line, a bracket, a trail) is
  removed in the same scene once it has done its job. Nothing may remain on screen
  that the narration has not talked about, and no "schematic" or "not to scale"
  notes.

On-screen text (strict):
- Only necessary text: short object labels (e.g. v, î, A), formulas, matrices and
  numbers that are part of the explanation, plus brief definitions when useful.
  Tie symbols to their spoken meanings; do not use unexplained notation as decoration.
- Avoid paragraphs and duplicate captions in the animation. Use motion, highlights,
  colour, and comparisons to develop the planned argument alongside the supplied
  narration. Show the evidence and symbol correspondences specified by the storyboard;
  do not assume a narrator will add missing explanations later.

LaTeX (strict; one unsupported command stops the whole lesson from playing):
- Formulas are rendered by MathJax with only the base, ams, newcommand and html
  packages. Use plain, common commands: fractions, sub/superscripts, Greek letters,
  \vec, \mathbf, \hat, \overrightarrow, \mathrm, \text, \mathbb, \mathcal,
  matrices (bmatrix, pmatrix), \xrightarrow, \rightleftharpoons, \underbrace, ^\circ.
- NOT available: \boldsymbol and \bm (use \mathbf or \vec), \color and \textcolor
  (colour a formula with its fill, or its parts with \animpart), \ce (write
  \mathrm{H_2O}), \cancel, \si, \bra / \ket, \degree, \require, \unicode.
- When unsure whether a command exists, use a simpler one.

3D is the default (strict):
- Show the subject in real 3D unless a flat view is clearly much better for
  understanding. Anything with a real spatial shape or arrangement MUST be 3D:
  molecules, atoms and bonds, orbitals, crystals, proteins, cells, organs, physical
  objects, forces and fields in space, surfaces, solids. Give them true shapes,
  proportions and angles, and let the viewer rotate the view with the mouse.
- 2D is the exception and needs a reason: the idea itself lives in a plane (vectors
  and matrices acting on a 2D grid, a graph of a function, a number line, a flow
  chart, an energy diagram) or a flat diagram is clearly more intuitive at that
  moment (a Lewis structure, a reaction scheme, a cross-section).
- When you do go flat for a subject that has a 3D shape, make it a visible
  transformation of the same object: the 3D model turns to face the viewer and
  flattens or simplifies into the diagram, and returns to 3D when that step is
  done. Never leave the student with only the abstraction.
- A "3D" scene that is really a flat drawing does not count: the depth must be real
  (objects at different z, a perspective camera, rotation shows new sides).

Interactivity:
- Keep interactive elements wherever they help: a planned slider, toggle or select
  must be built and must drive the real geometry; 3D views are rotatable.
  Do not drop a planned interaction to simplify the scene.
- Controls always sit in the TOP RIGHT corner, in every scene (strict, checked). The
  player stacks them there by itself, right-aligned from the top, in the order they
  are declared: so NEVER pass `position` to `s.slider`, `s.toggle` or `s.select`.
  `width` is optional and at most 220. Declare a control that also exists in the
  previous scene first, so it keeps its place.
- A control must keep working for as long as it is shown, above all on the final
  held frame, where viewers pause and play with it: the end picture and its numbers
  are computed from the control's value too, not only one stretch in the middle.
- The top right corner belongs to the controls: no formula, label or geometry in the
  top third of the right-hand text area, whether or not this scene has a control.

How to build 3D with animlib:
- Follow the plan: if the scene's visualDescription starts with "3D:", the scene must
  be 3D; if it starts with "2D (because ...):", keep it flat.
- ALL 3D goes in ONE view region on the left: `s.view("model", { rect: [0.02, 0.1,
  0.64, 0.8], orbit: true, camera: { ... } }, v => { ... })`, with every 3D object
  created through `v`. Never rely on `mode: "3d"` for the main scene and never call
  `s.camera.to3D`: a scene inherits the previous scene's main camera, so from the
  second scene on the main scene is silently flat and cannot be rotated, and a
  tilted main camera also tilts every formula. The main scene stays flat and holds
  only formulas and controls; reuse the same view id and rect in every scene.
- Use `sphere`, `line3D`, `arrow3D`, shaded `mesh`, `surface`, `parametricSurface`,
  `box`, `cylinder`, `cone`, `torus`, or `tube` with real depth.
- Frame the model with the view camera: `target` at the model's centre, `height`
  about 1.5 times the model's largest extent (height is the zoom; the viewer cannot
  zoom), `distance` at least 3 times that extent (distance only changes perspective),
  and a three-quarter angle such as `yaw: 0.6, pitch: 0.35`. The whole model, with
  its labels, must be inside the view at every moment, also after it moves or grows.
- Text inside a 3D view is always `billboard: true` (labels and axis titles alike)
  and never has a `rotation`, so it faces the viewer upright.
- `s.surface(id, { fn: (x, y) => z, ... })` is a height graph; use
  `s.parametricSurface(id, { fn: (u, v) => [x, y, z], ... })` for curved petals,
  lobes, and other spatial sheets. Closed parameter axes share seam indices and
  require periodic maps. `s.tube(id, { points: [...], radius, ... })` sweeps an
  authored 3D centerline; it does not infer a curve from SVG path data.
- Helpers create mesh geometry with smooth shading (boxes default flat) and no
  stroke. Raw `s.mesh` needs `shading: 'smooth'` or `'flat'` to receive lighting.
  Use palette tokens for fill. Start with modest sampling (surfaces default to
  32 segments per axis; each mesh is limited to 20,000 vertices and triangles).
  Use an ordinary numeric slider to resample construction callbacks or change
  sample counts, holes, mesh connectivity, or dependent text/formulas. For
  fixed-topology deformation, retained `s.deform` or `s.bind` can update vertices
  and normals from reactive sliders and absolute scene-local `s.time`.
  Keep dependent labels and the scene duration consistent; never simplify the
  explanation merely to fit retained properties.
- Give every 3D thing its TRUE shape with the matching primitive, instead of
  approximating it with rows of spheres or flat silhouettes:
  a quantity that depends on two variables (a potential or energy landscape, a
  loss surface, z = f(x, y)) is a `surface`; a curved sheet, lobe, membrane, shell
  or orbital is a `parametricSurface`; a strand, backbone, wire, vessel, orbit or
  field line is one `tube` along its centre line; containers, rods, wedges and
  rings are `box`, `cylinder`, `cone`, `torus`; atoms and particles stay `sphere`.
  Join the parts of one body in a group so they move and pulse together.
- Keep every scene light (strict, checked): the player builds a scene in a fraction
  of a second, and a scene that is too heavy never appears. Use at most about 60
  objects and 300 separate animations. When many things move together (the atoms of
  a lattice, the dots of a sample), put them in ONE group and move, fade or scale
  the group, instead of animating each member.
- Keep 3D cheap and calm: at most three or four surface or tube meshes in a scene,
  32 segments per axis or fewer unless the shape visibly needs more, opaque bodies
  where they intersect, and no triangle strokes. Ordinary sliders rebuild surfaces
  on every change; retained deformation updates vertices without rebuilding the
  builder. Keep both callbacks and geometry modest.
- The focus pulse works on these meshes too (`scaleTo(1.15)` and back on the mesh
  or its group). To point at one REGION of a surface (a minimum, a saddle point),
  place a small sphere marker on it and pulse the marker.

Alignment (strict; misplaced parts are the most visible kind of jank):
- Spheres and meshes (including all spatial helpers) accept `texture` with
  `pattern: 'checker' | 'stripes' | 'noise' | 'marble' | 'wood'`, a secondary palette
  `color`, optional positive `scale` (scalar or Vec3), `offset` Vec3, and integer
  `seed`. The fill is the first color; patterns sample local XYZ per pixel.
  `texture.bumpStrength` (-1 to 1, default 0) perturbs lighting normals: try
  0.02–0.15 for raised relief or negative values for grooves. It requires lit
  geometry and changes neither mesh vertices nor silhouettes. Matching fill and
  texture colors give bump detail without color variation.
- Add `material: { metalness, roughness, specular, emissive, emissiveIntensity }`
  for stylized metal, matte/plastic highlights, or luminous surfaces. Metalness
  and specular are 0–1, roughness 0.05–1, emission intensity 0–4; emissive is a
  palette color. Raw meshes need flat/smooth shading for lit material effects.
  Ordinary controls can rebuild these parameters; retained bindings can replace
  whole `material` or `texture` settings without rebuilding geometry.
  Omit material to keep simple shading.
  Choose patterns that clarify the subject, with enough contrast for labels.
  Procedural primitives do not support image textures or image normal maps;
  host-registered static GLB models support embedded image materials and normal
  maps through `s.model`. Displacement, scene reflections, and bloom are unavailable.
- Use a texture or material only when it tells the viewer something; a plain shaded
  body is the default. Good reasons:
  it shows MOTION or ORIENTATION that a plain body hides (stripes or a checker on a
  spinning sphere, wheel or planet make the rotation visible);
  it shows how a SURFACE is stretched or curved (a checker on a surface or a
  deforming sheet shows the distortion, like a coordinate grid);
  it shows what something is MADE OF when that matters to the idea (`wood` for a
  beam, `marble` or `noise` with a little bump for rock, soil or a rough membrane,
  a `material` with metalness for a metal part, an emissive material for something
  that gives off light: a star, a filament, an excited atom);
  it tells two otherwise identical bodies apart.
- Keep textures quiet: the object's concept colour stays the `fill`, and the second
  colour is a nearby darker or lighter tone, never a second concept colour and never
  YELLOW. Use a low texture `scale` (few, broad features) rather than fine busy detail, at
  most two textured objects in a scene, and no texture on small things such as atoms,
  points or thin tubes. Labels and formulas never sit on top of a textured body.
- A texture is attached to the body, so it moves, rotates and pulses with it; do not
  animate texture parameters for effect. One slider may change a material property
  when that IS the idea (roughness, metalness).
- Everything that belongs to a 3D model lives in the SAME 3D view as the model:
  create it inside that `s.view(...)` builder callback (with `opacity: 0` if it
  appears later, then fade it in). Never save the view handle and create objects
  through it after the callback has returned: those are drawn with the main camera
  and float beside the model instead of sitting on it.
- Parts attached to an object start exactly at that object: a lone pair, bond, arrow
  or direction ray begins at its atom's centre or surface, computed from the atom's
  own coordinates, never from separately typed numbers.
- Things that move or rotate together are in one group, or are computed from the same
  values, so they cannot drift apart.
- Labels: use `billboard: true` with a small `billboardOffset` (just clear of the
  object, about its radius plus 0.2) so the label stays beside its object while the
  view rotates. To move a label, change the offset, not its world position.
- Rounded 3D bodies (atoms, lobes, clouds) need actual spatial geometry and
  lighting: use spheres or a mesh/parametric surface with smooth shading.
  A planar silhouette remains planar even when shading is enabled.
- To de-emphasise a shaded 3D body, do not leave it half transparent for long:
  overlapping transparent spheres draw with visible banding. Fade it fully, or keep
  it opaque and dim the other things instead.
- Check the picture from the starting camera AND after rotating: nothing may sit
  beside what it belongs to.

Plain text versus formulas: `s.text` shows its string exactly as written, so never
put LaTeX escapes in it. Write a percent sign as `%` in `s.text` ("Inflation (%)")
and as `\%` only inside `s.latex`.

Layering (strict, checked; a dot hidden behind its own line looks broken):
- In a flat scene, things are drawn in the order they are created, later on top, and
  an object carried from the previous scene is older than everything this scene
  creates. A larger z always wins over creation order. So set the layer with z
  instead of relying on order:
  axes, grids and filled areas at z = 0; lines, curves and arrows at z = 0.02;
  points and markers at z = 0.05; labels and formulas at z = 0.1; the focus frame at
  z = 0.15. Give positions three components (`position: [x, y, 0.05]`) and keep the
  same z in every `moveTo` and when a control recomputes the position.
- A point always sits in front of the line, curve or axis it lies on, including a
  line that appears later in the scene or in a later scene. Filled areas go behind
  the lines that bound them.
- In real 3D scenes use true depth: do not fake layers with z there.

Layout (keep it identical in every scene):
- Geometry (2D or 3D) on the left two thirds of the safe area; the right third is a fixed text
  area for formulas and matrices. It is just empty space (the temporary focus frame aside): NO box, border, frame,
  backing rectangle or panel shape around text anywhere. Geometry never enters the
  text area; text never sits on the grid except short object labels.
- The right third from top to bottom: controls in the top third (kept empty when
  there are none), formulas and matrices in the middle and lower part, starting
  below the controls. The same in every scene, so nothing jumps between scenes.
- Formula column budget (strict, checked): at most THREE formulas or matrices in the
  column at once, and at most 12 text items (formulas, definition lines and labels) on screen in total. Before a new
  formula comes in, fade out one the viewer no longer needs, or morph the old one
  into the new one. Do not keep a growing list of every result so far.
- Formulas never overlap or touch (strict, checked). Place them from their real
  size: a 2x2 matrix at fontSize 0.46 is about 1.1 units tall and 2.6 wide, a single
  line about 0.5 tall. Stack with a clear gap of at least half a line: matrices at
  least 1.5 units apart centre to centre, single lines at least 0.8.
- Everything stays inside the frame (strict, checked against the rendered bounds).
  The scene is always shown as a 16:9 picture, so with the usual camera height 8
  the SAFE AREA is x from -6.7 to 6.7 and y from -3.6 to 3.6: every label, formula,
  arrow, marker and diagram part stays inside it at every moment. The diagram goes
  in x from -6.7 to 2.2; the formula column is x from 2.6 to 6.7, centred on
  x = 4.6 and at most 4 wide, so pick the fontSize from the formula's width (a
  formula 8 f wide needs f <= 0.5) or break a long formula into two lines. Size a
  diagram to fit: scale the whole thing down before letting any part reach the edge.
- Lines and arrows never run through text (strict, checked). An arrow starts and
  ends about 0.15 clear of the label or number it points from or to: the arrowhead
  is drawn at the arrow's end point, so that end point itself must stop before the
  label's edge with a visible gap, never on or inside the label. An arrow also
  starts inside the frame, not beyond its edge. No line,
  arrow or stem passes through any label, number or formula. Put a label BESIDE its
  line, offset perpendicular to it, never on it; when several arrows meet near a
  label, move the label outward. Leave empty space around a diagram for its labels
  when you size it, and keep its values (such as "= 16") in a clear spot beside the
  node they belong to, away from every connecting line.
- Show only what the student needs for THIS step. One idea on screen at a time: the
  objects being talked about, their labels, and the one formula that states the
  point. Fade out the rest, including dimmed "ghost" copies of earlier formulas.
- Labels sit beside what they name with a visible gap and move with it; nothing
  touches or overlaps, including during motion.
- Minimum text height about 0.35 scene units; keep 0.4+ margin from the frame edge.
- Draw vectors with clearly thicker strokes than grid lines so they stay crisp.

# Planning additions (scenegen)

<!-- The scenegen planning rules. When the app runs through scenegen/backend/dev.ts
     they are appended to the lesson-planning prompt. The plan decides which controls
     and views each scene has; the scene agent must then build exactly those.
     Re-read per lesson. -->

When writing the plan:

- **3D is the default.** Start every scene's visualDescription with either `3D:` or
  `2D (because <reason>):`. Use 3D unless a flat view is clearly much better for
  understanding. Anything with a real spatial shape or arrangement must be 3D:
  molecules, atoms and bonds, orbitals, crystals, proteins, cells, organs, physical
  objects, forces and fields in space, surfaces, solids. Describe the true shape and
  what physically happens, and say that the viewer can rotate the view.
- 2D needs a real reason: the idea itself lives in a plane (vectors and matrices on a
  2D grid, a graph, a number line, an energy diagram) or a flat diagram is clearly more
  intuitive at that moment (a Lewis structure, a reaction scheme, a cross-section).
  "Simpler to draw" is not a reason. For a subject that has a 3D shape, plan the flat
  step as a visible transformation of the same 3D object, and plan the return to 3D.
  A lesson about a spatial subject should be 3D in most of its scenes.
- **Name the true 3D shape.** The scene can draw real shaded surfaces and solids, so
  say which one each object is: a smooth surface for anything that depends on two
  variables (an energy or potential landscape, a loss surface, a wave, z = f(x, y)),
  a curved sheet or lobe (orbital, membrane, shell, petal), a tube along a path
  (backbone, strand, wire, vessel, orbit, field line), or a solid (box, cylinder,
  cone, ring), with spheres for atoms and particles. Prefer one such shape to many
  small spheres. An idea usually drawn as a flat graph of two inputs (a function of
  x and y, a cost landscape) is better as a rotatable surface: plan it in 3D.
  A slider may reshape a surface (an amplitude, a curvature, a parameter of the
  function); plan that as an ordinary slider.
- **Surface patterns and materials, only with a reason.** A 3D body can carry a
  simple pattern (checker, stripes, noise, marble, wood) or look metallic, matte or
  glowing. Plan one when it shows something a plain body cannot: stripes or a
  checker so a rotation is visible, a checker on a surface so its stretching or
  curvature is visible, a material when what the object is made of matters (wood,
  rock, metal, something that emits light), or to tell two identical bodies apart.
  Say which pattern and why in the visualDescription. Otherwise leave bodies plain;
  never plan a pattern as decoration, and at most two patterned objects per scene.
- **Intuition first.** The first scene (the first two in a longer lesson) builds
  intuition only: the thing itself behaving, a concrete example, a comparison the
  student can see. Plan no formula, no symbols and no numeric detail there; the
  narration of those scenes describes what is seen, in plain words. Each later idea
  also starts with what happens before its notation. Details, exact values and
  formulas come after the student already has the picture.
- **Then show the math.** Intuition first does not mean no math. After the opening,
  each scene that explains a quantitative idea states it as an equation: plan about
  one key equation per such scene (the definition, the rule or the result that scene
  is about), and make sure the lesson shows the formulas a student of this topic is
  expected to recognise. A lesson on a mathematical or physical topic with only one
  formula in total is too thin.
- **Explain every variable.** When a formula appears, the narration says what each
  symbol in it means, one at a time, in plain words tied to the picture ("N is how
  many samples we have", "k picks the frequency we are testing"). List those symbols
  in the visualDescription with the object each one stands for, so the scene can
  point at the symbol and at that object together and show a short definition line
  under the formula. Do not use a symbol the narration never explains. Keep each
  definition to one short clause: the added math must fit the requested length, so
  make room by cutting repetition elsewhere, not by running long.
- **Equations only while they are explained.** Plan a formula in a scene only if
  that scene's narration explains it, and say at which sentence it appears. It
  leaves when the narration moves on to another idea. Never plan a formula as a
  title, a preview, a reminder "for reference" or a list of results so far. At most
  three formulas on screen at once, and more than one only when they belong together
  (a definition and its result, a comparison, the steps of one short derivation).
  Carry into the next scene only the result it starts from. Every planned formula is
  an entity with an id, listed under cleanup in the scene where it leaves. No boxed
  results and no panels around text.
- **Time to take an equation in.** Right after a formula has been fully explained,
  give the student a quiet moment with it: one short spoken sentence that explicitly
  invites them to take time ("Take a few seconds to read it." / "Pause here and
  trace each term back to the picture."; a bare "Look at this" is not an invitation)
  followed by a `Pause:` line in the script. Scale the pause to the formula: about 3 seconds for a
  short one (`F = ma`), 5 to 6 for one with several terms, a sum, an integral or a
  matrix product, up to 8 for the central formula of the lesson. Do this for every
  formula that matters; a formula not worth a pause is not worth showing. The next
  sentence after the pause continues from that formula instead of rushing to a new
  one. Count these pauses in the scene's length.
- **Show little (2D and 3D alike):** a scene shows only what the student needs to
  see for its one idea: the objects being talked about and short labels. Fewer,
  larger, well-spaced things beat a full screen.
  Plan only objects the concept itself is about: no illustrative props such as
  hands, people, icons or scenery, unless the idea is about that object (a hand for
  the right-hand rule). List as entities only what the explanation cannot do without.
- **Colours.** Give each entity one colour and keep it for every form of that thing
  in every scene (a block of copper and its atoms are the same colour). Never use
  YELLOW or GOLD as an entity colour: yellow is reserved for the highlight frame.
- **Focus:** end every visualDescription with a short list, `Focus: <entity id>;
  <entity id>; ...`, one entry per narration sentence in order, naming the one
  object the student should look at during that sentence. The scene marks each as
  it is mentioned (a temporary thin yellow frame for text and flat things, a brief
  pulse for 3D objects, lines and arrows). One focus per sentence; do not list the
  frame as an entity.
- **Interactions (interactive mode only; in classic mode plan none):** plan a control
  in a scene where playing with a value deepens that scene's idea (a slider for a
  quantity, a toggle to compare with and without, a select between a few named
  cases), and leave a scene without one when it would distract. Each control must
  drive the real geometry and have something to discover. The objects a control
  drives must still be on screen in endsWith and are never listed under cleanup, so
  the control still works on the final held picture. Rotating a 3D view needs no
  control. Plan nothing for the top right corner of the picture: controls live there.

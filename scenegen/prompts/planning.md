# Planning additions (scenegen)

<!-- The scenegen planning rules. When the app runs through scenegen/backend/dev.ts
     they are appended to the lesson-planning prompt. The plan specifies required
     interactions and views; the scene agent may add useful interactions.
     Re-read per lesson. -->

When writing the plan:

- **Choose dimensionality for understanding.** Follow the guidance above: record
  the choice and its explanatory reason in each scene's `view.mode` and
  `view.rationale`. Use 3D only when depth, arrangement, rotation, or projection
  clarifies a relationship that 2D would obscure; topic complexity and spectacle
  are not reasons. Prefer 2D when it communicates the relationship more clearly.
  There is no 3D quota or required return to 3D, including for spatial subjects.
- **Commit to the chosen 3D.** Apply the guidance's quality requirements and actively
  seek further spatial insights that are difficult or impossible to communicate
  faithfully in 2D. Specify the geometry and the reveals that make those insights
  visible in `visualDescription`, within the lesson's scope and timing.
- **When 3D helps, name the true shape.** The scene can draw real shaded surfaces
  and solids, so say which one each object is: a smooth surface for a chosen 3D
  representation of a two-variable quantity (an energy or potential landscape,
  a loss surface, a wave, z = f(x, y)),
  a curved sheet or lobe (orbital, membrane, shell, petal), a tube along a path
  (backbone, strand, wire, vessel, orbit, field line), or a solid (box, cylinder,
  cone, ring), with spheres for atoms and particles. Prefer one such shape to many
  small spheres. A two-variable quantity may use a flat plot or a 3D surface;
  choose according to the relationship being explained.
  Prefer manipulating the model or a geometric handle when supported. Use a
  slider to reshape a surface only when direct manipulation cannot clearly express
  the parameter with the supplied API, or when the user explicitly requests one.
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
- **Interactions (interactive mode only; in classic mode plan none):** prefer direct
  manipulation of objects or geometric handles over sliders. Use supported drag
  and live bindings, or available host-registered custom behaviors. Use sliders
  only when direct manipulation cannot clearly express the quantity or the user
  requests one; toggles/selects suit discrete choices. No interaction-count quota
  applies, and the scene author may add useful interactions. Every interaction
  must drive real geometry and reveal something. Keep the manipulated objects
  available on the final held picture so viewers can explore while paused.
  Every 3D model view must allow viewer rotation unless a compelling scene-specific
  reason is documented in visualDescription; narration, convenience, and preferred
  framing are not reasons. Rotation needs no separate planned control. Leave a
  pickable model surface or visible rotation handle distinct from draggable parts.
  Reserve the top right for any widget controls that are actually used.

Built-in direct dragging can constrain a target origin to world-space bounds or an ordered open/closed polyline path, useful for bounded handles and road centerlines. Live attachments follow the target. These are gesture constraints, not collision simulation, automatic heading, or persistent swept-area state; describe additional requested effects separately. The scene author receives the exact `drag.bounds`/`drag.path` API.

// The yellow focus frame must wrap what it highlights cleanly: centred on a whole
// element with even padding, never cutting through a glyph. A scene author sizes frames
// from estimates, so every frame is checked here against the rendered text, glyph by
// glyph, and when a frame is off the model is told the exact position and size to use.
import { evaluateScene, getWorldBounds } from "animlib/core";
import type { CompiledScene } from "animlib/core";
import { layoutLatex, layoutLatexGeometry } from "../../shared/animlib/dist/latex.js";
import { textTex } from "../../shared/animlib/dist/render-geometry.js";

interface Box { left: number; right: number; bottom: number; top: number }
interface Glyph extends Box { part?: string }
interface FrameElement {
  id: string; view?: string; opacity: number; stroke?: string; strokeWidth?: number; billboard?: boolean; space?: string;
  position: number[]; scale: number; rotation?: number[];
  geometry: { kind: string; tex?: string; text?: string; fontSize?: number };
}
interface SceneFrame { camera: { yaw: number; pitch: number }; elements: FrameElement[] }
interface Text { id: string; glyphs: Glyph[]; box: Box }

const PADDING = 0.15;       // what a frame should leave around its text, in scene units
const MIN_PADDING = 0.05;   // closer than this and the frame touches the glyphs
const MAX_PADDING = 0.35;   // further than this and the frame no longer reads as "this term"
const MAX_UNEVEN = 0.12;    // how much opposite sides may differ before the frame looks off-centre
const MAX_STROKE = 0.03;    // a thin line, as in 3Blue1Brown
const STEP = 0.25;          // seconds between samples: frames are only up for a second or two

const union = (boxes: Box[]): Box => ({ left: Math.min(...boxes.map(b => b.left)), right: Math.max(...boxes.map(b => b.right)),
  bottom: Math.min(...boxes.map(b => b.bottom)), top: Math.max(...boxes.map(b => b.top)) });
const round = (value: number) => Math.round(value * 100) / 100;
const within = (inner: Box, outer: Box) => inner.left >= outer.left && inner.right <= outer.right && inner.bottom >= outer.bottom && inner.top <= outer.top;
const apart = (a: Box, b: Box) => a.right <= b.left || a.left >= b.right || a.top <= b.bottom || a.bottom >= b.top;

/** Each glyph of a flat formula or label as a box in scene units. */
function glyphsOf(element: FrameElement): Glyph[] {
  const { kind } = element.geometry;
  try {
    const layout = kind === "latex" ? layoutLatexGeometry(element.geometry as never) : layoutLatex(textTex(element.geometry.text ?? ""));
    const size = (element.geometry.fontSize ?? (kind === "text" ? 0.4 : 0.6)) * element.scale;
    const [x, y] = element.position;
    return layout.paths.filter(path => path.contours.some(contour => contour.length)).map(path => {
      const points = path.contours.flat();
      return { part: path.part, left: x + Math.min(...points.map(p => p[0])) * size, right: x + Math.max(...points.map(p => p[0])) * size,
        bottom: y + Math.min(...points.map(p => p[1])) * size, top: y + Math.max(...points.map(p => p[1])) * size };
    });
  } catch { return []; }
}

function outlineOf(frame: SceneFrame, id: string): Box | undefined {
  try {
    const bounds = getWorldBounds(frame as never, id); // an unfilled rectangle paints only its thin stroke
    return bounds && { left: bounds.min[0], right: bounds.max[0], bottom: bounds.min[1], top: bounds.max[1] };
  } catch { return undefined; }
}

/** One message per focus frame that does not wrap a whole element cleanly. */
export function focusFrameProblems(compiled: CompiledScene): string[] {
  const worst = new Map<string, { error: number; message: string }>();
  const thick = new Set<string>();
  for (let time = 0; time <= compiled.duration; time += STEP) {
    const frame = evaluateScene(compiled, time) as unknown as SceneFrame;
    if (Math.abs(frame.camera.yaw) > 1e-3 || Math.abs(frame.camera.pitch) > 1e-3) continue;
    const flat = frame.elements.filter(element => !element.view && !element.billboard && element.space !== "screen"
      && !(element.rotation ?? []).some(angle => Math.abs(angle) > 1e-3));
    const frames = flat.filter(element => element.geometry.kind === "rectangle" && element.stroke === "YELLOW" && element.opacity > 0.8);
    if (!frames.length) continue;
    const texts: Text[] = flat.filter(element => (element.geometry.kind === "latex" || element.geometry.kind === "text") && element.opacity > 0.3)
      .map(element => ({ id: element.id, glyphs: glyphsOf(element) })).filter(text => text.glyphs.length)
      .map(text => ({ ...text, box: union(text.glyphs) }));
    for (const element of frames) {
      if ((element.strokeWidth ?? 0) > MAX_STROKE + 1e-6) thick.add(element.id);
      const outline = outlineOf(frame, element.id);
      if (!outline) continue;
      // Sort every glyph: wholly inside the frame, cut by its edge, or outside.
      const touched = texts.map(text => ({ text, inside: text.glyphs.filter(glyph => within(glyph, outline)),
        cut: text.glyphs.filter(glyph => !within(glyph, outline) && !apart(glyph, outline)) }))
        .filter(entry => entry.inside.length || entry.cut.length);
      if (!touched.length) continue; // a frame around a shape, not around text
      const clipped = touched.filter(entry => entry.cut.length).map(entry => entry.text.id);
      // A frame may hold a whole element, or whole named parts of one; anything else is an arbitrary slice.
      const sliced = touched.filter(({ text, inside }) => {
        if (!inside.length || inside.length === text.glyphs.length) return false;
        const parts = new Set(inside.map(glyph => glyph.part));
        return parts.has(undefined) || [...parts].some(part => text.glyphs.some(glyph => glyph.part === part && !inside.includes(glyph)));
      }).map(entry => entry.text.id);
      const held = touched.flatMap(entry => entry.inside);
      const ink = held.length ? union(held) : outline; // nothing wholly inside: the frame only cuts text
      const pads = [ink.left - outline.left, outline.right - ink.right, ink.bottom - outline.bottom, outline.top - ink.top];
      const padding = held.length ? Math.max(...pads.map(pad => pad < MIN_PADDING ? MIN_PADDING - pad : pad > MAX_PADDING ? pad - MAX_PADDING : 0)) : 0;
      const uneven = held.length ? Math.max(Math.abs(pads[0] - pads[1]), Math.abs(pads[2] - pads[3])) - MAX_UNEVEN : 0;
      const error = Math.max(padding, uneven, clipped.length || sliced.length ? 1 : 0);
      if (error <= 0 || error <= (worst.get(element.id)?.error ?? 0)) continue;
      // Aim at the whole of every element the frame mostly covers; a named part keeps its own extent.
      const whole = touched.filter(({ text, inside, cut }) => (inside.length + cut.length) * 2 >= text.glyphs.length || sliced.includes(text.id) || clipped.includes(text.id));
      const target = clipped.length || sliced.length ? union(whole.map(entry => entry.text.box)) : ink;
      const names = (clipped.length || sliced.length ? whole : touched.filter(entry => entry.inside.length)).map(entry => entry.text.id).join(", ");
      const reasons = [
        clipped.length ? `it cuts through ${clipped.join(", ")}` : "",
        sliced.length ? `it frames only a slice of ${sliced.join(", ")}` : "",
        !clipped.length && !sliced.length && uneven > 0 ? "it is off-centre" : "",
        !clipped.length && !sliced.length && padding > 0 ? "its padding is wrong" : "",
      ].filter(Boolean).join(" and ");
      worst.set(element.id, { error, message:
        `${element.id} (${reasons}): to frame ${names}, use position [${round((target.left + target.right) / 2)}, ${round((target.bottom + target.top) / 2)}], ` +
        `width ${round(target.right - target.left + 2 * PADDING)}, height ${round(target.top - target.bottom + 2 * PADDING)}` });
    }
  }
  const problems: string[] = [];
  if (worst.size) problems.push(`Focus frames that do not wrap their text cleanly (measured from the rendered glyphs):\n${[...worst.values()].map(entry => `- ${entry.message}`).join("\n")}\n` +
    "A focus frame is centred on a WHOLE element with about 0.15 of space on every side and never crosses a glyph. Use exactly these numbers. " +
    "To frame one term of a formula, make that term its own s.latex element or an \\animpart; do not frame an arbitrary slice.");
  if (thick.size) problems.push(`Focus frames drawn too thick: ${[...thick].join(", ")}. Use strokeWidth 0.02 (never more than ${MAX_STROKE}).`);
  return problems;
}

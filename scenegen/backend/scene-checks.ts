// animlib lays out LaTeX in the renderer, not when a scene is compiled, so a scene
// with an unsupported command passes validation and then stops the player
// ("Invalid LaTeX: ..."). This runs the renderer's own layout on every formula.
import { compileSource, detectSceneOverlaps, evaluateScene, getWorldBounds } from "animlib/core";
import type { CompiledScene } from "animlib/core";
import { layoutLatexGeometry } from "../../shared/animlib/dist/latex.js";
import { focusFrameProblems } from "./focus-frames.ts";

type Json = unknown;

/** Every latex geometry in a compiled scene: initial elements and morph targets. */
function latexGeometries(value: Json, found: { tex: string }[] = [], seen = new Set<object>()): { tex: string }[] {
  if (!value || typeof value !== "object" || seen.has(value as object)) return found;
  seen.add(value as object);
  const record = value as Record<string, Json>;
  if (record.kind === "latex" && typeof record.tex === "string") found.push(record as { tex: string });
  for (const child of Array.isArray(value) ? value : Object.values(record)) latexGeometries(child, found, seen);
  return found;
}

/** Returns one message per formula the player could not render. */
export function latexErrors(compiled: Json): string[] {
  const errors = new Set<string>();
  for (const geometry of latexGeometries(compiled)) {
    try { layoutLatexGeometry(geometry as never); }
    catch (error) { errors.add(error instanceof Error ? error.message : String(error)); }
  }
  return [...errors];
}

export const LATEX_HINT = "The player renders LaTeX with MathJax's base, ams, newcommand and html packages only. " +
  "Not available: \\boldsymbol and \\bm (use \\mathbf or \\vec), \\color and \\textcolor (colour with fill or \\animpart), " +
  "\\ce (write \\mathrm{H_2O}), \\cancel, \\si, \\bra/\\ket, \\degree (use ^\\circ), \\require, \\unicode.";

interface FrameElement {
  id: string; view?: string; opacity: number; strokeProfile?: string; position: number[];
  geometry: { kind: string; points?: number[][]; vertices?: number[][] };
}

/**
 * Parts of a 3D model that are drawn outside its view. animlib only puts an object
 * into a view when it is created inside that view's builder callback; an object made
 * later through a saved view handle lands in the main scene, is drawn with the main
 * camera, and floats beside the model instead of sitting on it.
 */
export function strayModelParts(frames: { elements: FrameElement[] }[]): string[] {
  const stray = new Set<string>();
  for (const frame of frames) {
    if (!frame.elements.some(element => element.view)) continue;
    for (const element of frame.elements) {
      if (element.view || element.opacity <= 0.02) continue;
      const points = [element.position, ...(element.geometry.points ?? []), ...(element.geometry.vertices ?? [])];
      const spatial = element.strokeProfile === "round" || element.geometry.kind === "sphere" || element.geometry.kind === "mesh"
        || points.some(point => Math.abs(point[2] ?? 0) > 1e-6);
      if (spatial) stray.add(element.id);
    }
  }
  return [...stray];
}

export const STRAY_HINT = "These 3D objects are outside the 3D view, so they are drawn with a different camera and do not sit on " +
  "the model or rotate with it. Create every object that belongs to the model INSIDE the s.view(...) builder callback " +
  "(give it opacity: 0 there if it appears later, then fade it in). Never save the view handle and call it after the callback returned.";

/** Sample a compiled scene and report every problem the player would show but validation would miss. */
export function renderProblems(compiled: CompiledScene): string[] {
  const problems: string[] = [];
  const broken = latexErrors(compiled);
  if (broken.length) return [`${broken.join("\n")}\n${LATEX_HINT}`]; // nothing else can be laid out
  const frames = Array.from({ length: 13 }, (_, i) => evaluateScene(compiled, compiled.duration * i / 12));
  const stray = strayModelParts(frames as never);
  if (stray.length) problems.push(`Outside the 3D view: ${stray.slice(0, 12).join(", ")}${stray.length > 12 ? ", ..." : ""}.\n${STRAY_HINT}`);
  // Overlapping text is found by animlib's own detector (settled text, real glyph shapes, any view).
  const pairs = new Set(detectSceneOverlaps(compiled, { width: 800 * SAFE_ASPECT, height: 800 })
    .flatMap(sample => sample.overlaps.map(overlap => overlap.elements.join(" and "))));
  const layout = layoutProblems(frames as never);
  if (pairs.size) layout.unshift(`Text overlaps: ${[...pairs].slice(0, 8).join("; ")}.`);
  if (layout.length) problems.push(`${layout.join("\n")}\n${LAYOUT_HINT}`);
  const buried = buriedMarkers(frames as never);
  if (buried.length) problems.push(`Markers hidden behind lines: ${buried.slice(0, 8).join(", ")}.\n${LAYER_HINT}`);
  problems.push(...viewProblems(frames as never));
  problems.push(...focusFrameProblems(compiled));
  const tracks = (compiled as { tracks?: unknown[] }).tracks?.length ?? 0;
  if (tracks > MAX_TRACKS) problems.push(`Too heavy for the player: ${tracks} separate animations (at most ${MAX_TRACKS}). ${WEIGHT_HINT}`);
  const placed = compiled.controls.filter(control => control.position).map(control => control.id);
  if (placed.length) problems.push(`Controls with a position: ${placed.join(", ")}.\n${CONTROLS_HINT}`);
  return problems;
}

// Without a position the player stacks controls in the top right corner, right-aligned,
// in declaration order: the same place in every scene.
export const CONTROLS_HINT = "Controls must sit in the top right corner in every scene. Remove `position` from s.slider / s.toggle / " +
  "s.select: the player then stacks them top right by itself. Keep formulas below them on the right.";

// The app fits the scene into a 16:9 stage, whatever the window's shape.
const SAFE_ASPECT = 16 / 9;
const MAX_FORMULAS = 12; // formulas, their definition lines and object labels together
const ARROW_GAP = 0.1;     // an arrow starts and ends at least this far from any label

interface Box { id: string; left: number; right: number; bottom: number; top: number }
interface LayoutElement extends FrameElement {
  scale: number; space?: string; billboard?: boolean; rotation?: number[]; strokeWidth?: number;
  geometry: { kind: string; tex?: string; text?: string; fontSize?: number; radius?: number; width?: number; height?: number; points?: number[][]; closed?: boolean };
}
interface LayoutFrame { camera: { yaw: number; pitch: number; target: number[]; height: number }; elements: LayoutElement[] }

/** The flat, visible elements drawn by the main camera (nothing in a 3D view, nothing rotated). */
function flatElements(frame: LayoutFrame): LayoutElement[] {
  if (Math.abs(frame.camera.yaw) > 1e-3 || Math.abs(frame.camera.pitch) > 1e-3) return [];
  return frame.elements.filter(element => !element.view && !element.billboard && element.space !== "screen" && element.opacity > 0.05
    && !(element.rotation ?? []).some(angle => Math.abs(angle) > 1e-3));
}

/** The painted extent of an element in scene units, from animlib's own bounds query. */
function worldBox(frame: LayoutFrame, id: string): Box | undefined {
  try {
    const bounds = getWorldBounds(frame as never, id);
    return bounds && { id, left: bounds.min[0], right: bounds.max[0], bottom: bounds.min[1], top: bounds.max[1] };
  } catch { return undefined; }
}

/** Box of a formula or a text label. */
function textBox(frame: LayoutFrame, element: LayoutElement): Box | undefined {
  return element.geometry.kind === "latex" || element.geometry.kind === "text" ? worldBox(frame, element.id) : undefined;
}

function worldPoints(element: LayoutElement): number[][] {
  return (element.geometry.points ?? []).map(point => [element.position[0] + point[0] * element.scale, element.position[1] + point[1] * element.scale]);
}

/** Box of an arrow or a small marker: things that must never be cut off. Grid and axis lines may run off the frame. */
function markBox(frame: LayoutFrame, element: LayoutElement): Box | undefined {
  const { kind } = element.geometry;
  if (kind === "arrow") return worldBox(frame, element.id);
  if (kind === "circle" && (element.geometry.radius ?? 0) * element.scale <= 0.5) return worldBox(frame, element.id);
  return undefined;
}

/** Does the segment a-b pass through the box? */
function crosses(a: number[], b: number[], box: Box): boolean {
  let t0 = 0, t1 = 1;
  const dx = b[0] - a[0], dy = b[1] - a[1];
  for (const [p, q] of [[-dx, a[0] - box.left], [dx, box.right - a[0]], [-dy, a[1] - box.bottom], [dy, box.top - a[1]]]) {
    if (p === 0) { if (q < 0) return false; continue; }
    const t = q / p;
    if (p < 0) { if (t > t1) return false; t0 = Math.max(t0, t); } else { if (t < t0) return false; t1 = Math.min(t1, t); }
  }
  return t1 - t0 > 1e-6;
}

/** Text or marks cut off at the frame edge, lines through labels, and too much text, as the viewer would see them. */
export function layoutProblems(frames: LayoutFrame[]): string[] {
  const outside = new Set<string>(), struck = new Map<string, number>();
  let most = 0;
  frames.forEach((frame, index) => {
    const elements = flatElements(frame), last = index === frames.length - 1;
    const texts = elements.map(element => textBox(frame, element)).filter((box): box is Box => !!box);
    most = Math.max(most, texts.length);
    const halfHeight = frame.camera.height / 2, halfWidth = halfHeight * SAFE_ASPECT, [cx, cy] = frame.camera.target;
    for (const box of [...texts, ...elements.map(element => markBox(frame, element)).filter((box): box is Box => !!box)]) {
      if (box.left < cx - halfWidth || box.right > cx + halfWidth || box.bottom < cy - halfHeight || box.top > cy + halfHeight) outside.add(box.id);
    }
    // A line or arrow drawn through a label makes both unreadable. Thin, faint lines (grids) are left alone.
    for (const element of elements) {
      const { kind } = element.geometry;
      const strong = kind === "arrow" || ((kind === "line" || kind === "path") && !element.geometry.closed && (element.strokeWidth ?? 0) >= 0.035 && element.opacity >= 0.6);
      if (!strong) continue;
      const points = worldPoints(element);
      for (const box of texts) {
        // Shrink the label a little so a line that merely touches its edge is not counted.
        const mx = (box.right - box.left) * 0.12, my = (box.top - box.bottom) * 0.12;
        const inner = { ...box, left: box.left + mx, right: box.right - mx, bottom: box.bottom + my, top: box.top - my };
        // An arrow must also stop short of a label: its head is drawn at its end point, so an end
        // point touching the label puts the arrowhead on top of the text.
        const ends = kind === "arrow" && points.length ? [points[0], points[points.length - 1]] : [];
        const touching = ends.some(([x, y]) => Math.hypot(Math.max(box.left - x, 0, x - box.right), Math.max(box.bottom - y, 0, y - box.top)) < ARROW_GAP);
        if (!touching && !points.slice(1).some((point, i) => crosses(points[i], point, inner))) continue;
        const key = touching ? `${element.id} into ${box.id}` : `${element.id} through ${box.id}`;
        struck.set(key, (struck.get(key) ?? 0) + (last ? 2 : 1)); // sweeping past a label once mid-motion is fine
      }
    }
  });
  const problems: string[] = [];
  const through = [...struck].filter(([, count]) => count >= 2).map(([pair]) => pair);
  if (through.length) problems.push(`Lines or arrows run through or into labels: ${through.slice(0, 8).join("; ")}.`);
  if (outside.size) problems.push(`Cut off at the edge of the 16:9 frame: ${[...outside].slice(0, 8).join(", ")}.`);
  if (most > MAX_FORMULAS) problems.push(`Too much text: ${most} formulas and labels are visible at once (at most ${MAX_FORMULAS}).`);
  return problems;
}

export const LAYOUT_HINT = "Show less at once and give everything room. Fade out formulas that are no longer needed before adding the next, " +
  "leave a clear gap between neighbours, and keep every label, formula, arrow and marker inside the frame: with camera height 8 that is " +
  "x from -6.7 to 6.7 and y from -3.6 to 3.6 (use a smaller fontSize, a shorter formula, or a smaller diagram). An arrow or line starts and " +
  "ends 0.15 clear of any label and never passes through one: move the label beside the line (offset it perpendicular to the line), " +
  "shorten the arrow, or route it around.";

interface ControlInfo { id: string; kind: string; default: unknown; min?: number; max?: number; options?: string[] }

/** Controls that do nothing on the final held frame, where viewers pause and play with them. */
export async function deadControls(source: string, compiled: CompiledScene, previous?: unknown): Promise<string[]> {
  const picture = (scene: CompiledScene) => JSON.stringify(evaluateScene(scene, scene.duration).elements);
  const dead: string[] = [];
  for (const control of compiled.controls as unknown as ControlInfo[]) {
    const other = control.kind === "toggle" ? !control.default
      : control.kind === "select" ? control.options?.find(option => option !== control.default)
      : control.default === control.min ? control.max : control.min;
    if (other === undefined) continue;
    const changed = await compileSource(source, { previous, controls: { [control.id]: other } } as never);
    if (picture(changed) === picture(compiled)) dead.push(control.id);
  }
  return dead;
}

export const DEAD_CONTROL_HINT = "These controls change nothing on the final frame of the scene. The scene holds there, and that is " +
  "when viewers try the control: compute the end picture (positions, shapes, numbers) from the control's value as well.";

interface LayerElement extends FrameElement {
  scale: number; billboard?: boolean; space?: string;
  geometry: { kind: string; radius?: number; points?: number[][]; closed?: boolean };
}

/**
 * Points and markers that a line or curve is drawn over. In a flat scene animlib draws
 * later-created elements on top (a larger z wins over creation order), so a dot carried
 * from an earlier scene ends up underneath a line created afterwards.
 */
export function buriedMarkers(frames: { camera: { yaw: number; pitch: number }; elements: LayerElement[] }[]): string[] {
  const buried = new Set<string>();
  for (const frame of frames) {
    if (Math.abs(frame.camera.yaw) > 1e-3 || Math.abs(frame.camera.pitch) > 1e-3) continue; // real 3D: depth decides
    const flat = frame.elements.map((element, index) => ({ element, index }))
      .filter(({ element }) => !element.view && !element.billboard && element.space !== "screen" && element.opacity > 0.5);
    const lines = flat.filter(({ element }) => ["line", "arrow", "path"].includes(element.geometry.kind) && (element.geometry.points?.length ?? 0) >= 2 && !element.geometry.closed);
    for (const dot of flat) {
      const radius = (dot.element.geometry.radius ?? 0) * dot.element.scale;
      if (dot.element.geometry.kind !== "circle" || radius <= 0 || radius > 0.35) continue;
      const [cx, cy, cz = 0] = dot.element.position;
      for (const line of lines) {
        const [lx, ly, lz = 0] = line.element.position;
        const above = lz > cz + 1e-6 || (Math.abs(lz - cz) <= 1e-6 && line.index > dot.index);
        if (!above) continue;
        const points = line.element.geometry.points!.map(point => [lx + point[0] * line.element.scale, ly + point[1] * line.element.scale]);
        const touches = points.slice(1).some((b, i) => {
          const a = points[i], dx = b[0] - a[0], dy = b[1] - a[1], length = dx * dx + dy * dy;
          const t = length ? Math.max(0, Math.min(1, ((cx - a[0]) * dx + (cy - a[1]) * dy) / length)) : 0;
          return Math.hypot(cx - (a[0] + t * dx), cy - (a[1] + t * dy)) < radius;
        });
        if (touches) buried.add(`${dot.element.id} (under ${line.element.id})`);
      }
    }
  }
  return [...buried];
}

export const LAYER_HINT = "A point or marker must be drawn in front of the line or curve it sits on. Elements created later are drawn on " +
  "top, and an object carried from the previous scene is older than anything this scene creates. Put markers on a higher layer with z: " +
  "lines and curves at z = 0, points and markers at z = 0.05 (position: [x, y, 0.05], also in moveTo), labels at z = 0.1.";

interface ViewFrame {
  camera: { yaw: number; pitch: number; perspective: number };
  views?: { id: string }[];
  elements: (FrameElement & { billboard?: boolean; rotation?: number[]; geometry: { kind: string } })[];
}

/**
 * How 3D is set up. A scene inherits the previous scene's main camera, so 3D on the
 * main scene is silently flat from the second scene on, and a tilted main camera tilts
 * every formula. 3D therefore lives in an s.view region and the main camera stays flat.
 */
export function viewProblems(frames: ViewFrame[]): string[] {
  const problems: string[] = [];
  const tilted = frames.some(({ camera }) => Math.abs(camera.yaw) > 1e-3 || Math.abs(camera.pitch) > 1e-3 || camera.perspective > 1e-3);
  if (tilted) problems.push("The main scene's camera is tilted or in perspective, which tilts every formula and is lost in the next scene. " +
    "Keep the main scene flat (no mode: \"3d\", no s.camera.to3D) and put all 3D objects in one s.view(\"model\", { rect, orbit: true, camera }, v => { ... }) on the left.");
  const text = new Set<string>();
  for (const frame of frames) for (const element of frame.elements) {
    if (!element.view || element.opacity <= 0.05 || !["text", "latex"].includes(element.geometry.kind)) continue;
    if (!element.billboard || (element.rotation ?? []).some(angle => Math.abs(angle) > 1e-3)) text.add(element.id);
  }
  if (text.size) problems.push(`Text inside a 3D view must be billboard: true and have no rotation, so it faces the viewer upright: ${[...text].slice(0, 8).join(", ")}.`);
  return problems;
}

// The browser builds each scene inside a short time budget; a scene with many hundreds of separate
// animations validates here but never appears in the player (the lesson stops at the previous scene).
const MAX_TRACKS = 300;
export const WEIGHT_HINT = "Animate a group instead of every member: put the atoms, dots or segments that move together in one " +
  "s.group / v.group and move, fade or scale the group once. Use fewer objects (a lattice of 4 x 4 x 2 atoms reads as well as a large one).";

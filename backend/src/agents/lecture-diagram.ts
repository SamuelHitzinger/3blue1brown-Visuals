import type { LectureColor, LectureDiagram } from '../../../shared/lecture.js';
import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import { fileURLToPath } from 'node:url';
import { logEvent } from '../logging.js';

export function parseLectureColor(value: unknown): LectureColor {
  if (!['blue', 'teal', 'amber', 'ink'].includes(String(value))) throw new Error('Use blue, teal, amber or ink for diagram colors.');
  return value as LectureColor;
}
export function parseLectureDiagram(value: unknown): LectureDiagram {
  if (!value || typeof value !== 'object') throw new Error('Expected a static diagram.');
  const raw = value as Record<string, unknown>;
  if (typeof raw.alt !== 'string' || !raw.alt.trim() || raw.alt.length > 500) throw new Error('Describe the diagram in at most 500 characters.');
  if (!Array.isArray(raw.elements) || !raw.elements.length || raw.elements.length > 50) throw new Error('Use 1–50 diagram elements.');
  const elements = raw.elements.map((item): LectureDiagram['elements'][number] => {
    if (!item || typeof item !== 'object') throw new Error('Invalid diagram element.');
    const n = (key: string, max: number, min = 0) => {
      const value = item[key];
      if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw new Error(`Diagram ${key} must be within the 600×340 canvas.`);
      return value;
    };
    const color = item.color === undefined ? {} : { color: parseLectureColor(item.color) };
    switch (item.type) {
      case 'text':
        if (typeof item.text !== 'string' || !item.text.trim() || item.text.length > 60) throw new Error('Use short diagram labels (1–60 characters).');
        return { type: 'text', x: n('x', 580, 20), y: n('y', 320, 20), text: item.text, ...color };
      case 'line':
        if (item.arrow !== undefined && typeof item.arrow !== 'boolean') throw new Error('Diagram arrow must be boolean.');
        return { type: 'line', x1: n('x1', 590, 10), y1: n('y1', 330, 10), x2: n('x2', 590, 10), y2: n('y2', 330, 10), ...(item.arrow === undefined ? {} : { arrow: item.arrow }), ...color };
      case 'circle': {
        const cx = n('cx', 590, 10), cy = n('cy', 330, 10), r = n('r', 160, 1);
        if (cx - r < 5 || cx + r > 595 || cy - r < 5 || cy + r > 335) throw new Error('Keep circles inside the diagram.');
        return { type: 'circle', cx, cy, r, ...color };
      }
      case 'rect': {
        const x = n('x', 590, 10), y = n('y', 330, 10), width = n('width', 580, 1), height = n('height', 320, 1);
        if (x + width > 590 || y + height > 330) throw new Error('Keep rectangles inside the diagram.');
        return { type: 'rect', x, y, width, height, ...color };
      }
      case 'polyline':
      case 'polygon': {
        const minimum = item.type === 'polygon' ? 3 : 2;
        if (!Array.isArray(item.points) || item.points.length < minimum || item.points.length > 64) throw new Error(`Use ${minimum}–64 points for a ${item.type}.`);
        const points = item.points.map((point: unknown): [number, number] => {
          if (!Array.isArray(point) || point.length !== 2 || point.some(value => typeof value !== 'number' || !Number.isFinite(value))
            || point[0] < 10 || point[0] > 590 || point[1] < 10 || point[1] > 330) throw new Error('Diagram points must be finite [x,y] pairs within the 600×340 canvas.');
          return [point[0], point[1]];
        });
        return { type: item.type, points, ...color };
      }
      default: throw new Error('Only text, line, circle, rect, polyline and polygon diagram elements are allowed.');
    }
  });
  return { alt: raw.alt.trim(), elements };
}

let labelWidth: ((text: string) => number) | null | undefined;
function measureLabelWidth() {
  if (labelWidth !== undefined) return labelWidth;
  // The built site is shipped in production; the public source also supports clean checkouts.
  for (const path of ['../../../frontend/site/fonts/libron/Libron-Regular.woff2', '../../../frontend/app/public/fonts/libron/Libron-Regular.woff2']) {
    try {
      if (!GlobalFonts.registerFromPath(fileURLToPath(new URL(path, import.meta.url)), 'LectureDiagramQA')) continue;
      const context = createCanvas(600, 340).getContext('2d');
      context.font = '24px LectureDiagramQA';
      labelWidth = text => context.measureText(text).width;
      return labelWidth;
    } catch { /* Try the other bundled location; never substitute unrelated font metrics. */ }
  }
  logEvent('lecture.diagram_font_unavailable', { code: 'LABEL_EXTENTS_SKIPPED' }, 'warn');
  labelWidth = null;
  return labelWidth;
}

/** Generation-only layout gate, separate from legacy-safe schema parsing.
 * Font metrics catch clipping and clear label collisions, not scientific meaning or geometry crossings.
 */
export function validateLectureDiagramLayout(diagram: LectureDiagram): void {
  const measure = measureLabelWidth();
  const labels = diagram.elements.filter(element => element.type === 'text');
  for (const [index, label] of labels.entries()) {
    const width = measure?.(label.text);
    // Two pixels of tolerance avoids rejecting harmless glyph overhang/rounding.
    if (width !== undefined && (label.x - width / 2 < -2 || label.x + width / 2 > 602)) {
      throw new Error(`Diagram label "${label.text}" extends outside the canvas. Move or shorten the label while preserving its meaning.`);
    }
    for (const previous of labels.slice(0, index)) {
      // Identical overprinting adds no conflicting text; intentional shared labels remain legal.
      if (previous.text === label.text && previous.x === label.x && previous.y === label.y) continue;
      const previousWidth = measure?.(previous.text);
      const horizontalOverlap = width === undefined || previousWidth === undefined
        ? Math.abs(label.x - previous.x) < 2
        : Math.min(label.x + width / 2, previous.x + previousWidth / 2) - Math.max(label.x - width / 2, previous.x - previousWidth / 2) > 8;
      // A narrow central band catches obvious collisions without guessing glyph ascenders/descenders.
      if (horizontalOverlap && Math.abs(label.y - previous.y) < 16) {
        throw new Error(`Diagram labels "${previous.text}" and "${label.text}" overlap. Separate their positions without changing the source relationship.`);
      }
    }
  }
}

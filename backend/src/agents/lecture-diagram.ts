import type { LectureColor, LectureDiagram } from '../../../shared/lecture.js';

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
      default: throw new Error('Only text, line, circle and rect diagram elements are allowed.');
    }
  });
  return { alt: raw.alt.trim(), elements };
}

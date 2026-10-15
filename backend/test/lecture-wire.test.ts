import { expect, test } from 'bun:test';
import { createLectureWire } from '../src/agents/lecture-wire.js';
import { parseLectureNotes } from '../src/agents/lecture.js';
import type { LectureNotes, LectureSource } from '../../shared/lecture.js';

const id = 'e0f5799d-6637-4169-8c37-5c930d871254';
const sources: LectureSource[] = [{ id, sequence: 1, kind: 'text', text: `Do not replace literal ${id}.`, createdAt: '2026-10-15T00:00:00Z',
  capture: { kind: 'photo', itemId: 'private-capture-id', sequence: 1, capturedAt: '2026-10-15T00:00:00Z', visualEvidence: 'Arrow upward',
    photoSnippet: { crop: { x: 0, y: 0, width: 0.5, height: 0.5 }, description: 'Measured detail' } } }];
const notes: LectureNotes = { summary: '', sections: [{ id: 'force', title: 'Force', points: [{ text: 'F ↑', sourceIds: [id] }], photo: { sourceId: id, caption: 'Measured detail' } }],
  concepts: [{ id: 'arrow', sectionId: 'force', title: 'Direction', explanation: 'F ↑', sourceIds: [id], catalogIds: [], visualizationPrompt: '', visualKind: 'static',
    diagram: { alt: 'Arrow upward', elements: [{ type: 'line', x1: 100, y1: 200, x2: 100, y2: 50, arrow: true }] } }], questions: [] };

test('wire aliases citations losslessly without changing literal text or exposing host-only capture fields', () => {
  const wire = createLectureWire(sources, notes, true);
  const encoded: any = wire.notes(notes);
  const source: any = wire.source(sources[0]);
  expect(source.id.length).toBeLessThan(10);
  expect(source.text).toBe(sources[0].text);
  expect(source.capture.itemId).toBeUndefined();
  expect(source.capture.photoSnippet).toEqual({ description: 'Measured detail' });
  expect(encoded.sections[0].photo.sourceId).toBe(source.id);
  expect(encoded.concepts[0].sourceIds).toEqual([source.id]);
  expect(parseLectureNotes(JSON.stringify(wire.decode(JSON.stringify(encoded))), sources, notes)).toEqual(notes);
});

test('incremental reuse preserves full prior diagrams, photos and citations while replacing changed sections', () => {
  const wire = createLectureWire(sources, notes, true);
  const raw = { summary: '', sections: [{ reuseId: 'force' }], concepts: [{ reuseId: 'arrow' }], questions: [] };
  expect(parseLectureNotes(JSON.stringify(wire.decode(JSON.stringify(raw))), sources, notes)).toEqual(notes);
  const changed: any = wire.notes(notes);
  changed.sections[0].points[0].text = 'F: upward';
  changed.concepts = [{ reuseId: 'arrow' }];
  const result = parseLectureNotes(JSON.stringify(wire.decode(JSON.stringify(changed))), sources, notes);
  expect(result.sections[0].points[0].text).toBe('F: upward');
  expect(result.concepts).toEqual(notes.concepts);
  expect(notes.sections[0].points[0].text).toBe('F ↑');
});

test('reuse rejects unknown, mixed-field and rewrite references; aliases cannot collide with durable IDs', () => {
  const wire = createLectureWire(sources, notes, true);
  const raw = { summary: '', sections: [{ reuseId: 'missing' }], concepts: [], questions: [] };
  expect(() => wire.decode(JSON.stringify(raw))).toThrow(/reuse/i);
  expect(() => wire.decode(JSON.stringify({ ...raw, sections: [{ reuseId: 'force', title: 'changed' }] }))).toThrow(/reuse/i);
  expect(() => createLectureWire(sources, notes, false).decode(JSON.stringify({ ...raw, sections: [{ reuseId: 'force' }] }))).toThrow(/reuse/i);
  const collision = createLectureWire([...sources, { ...sources[0], id: 's1', sequence: 2 }], notes, true);
  expect(collision.id(id)).not.toBe(collision.id('s1'));
  expect(() => parseLectureNotes(JSON.stringify(wire.decode(JSON.stringify({ ...wire.notes(notes) as any, concepts: [], sections: [{ id: 'new', title: 'New', points: [{ text: 'Invented', sourceIds: ['not-real'] }] }] }))), sources)).toThrow(/sourceIds/);
});

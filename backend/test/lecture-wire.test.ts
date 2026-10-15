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

test('point updates avoid rewriting a growing section and preserve its photo and prior citations', () => {
  const wire = createLectureWire(sources, notes, true);
  const packet = { summary: '', sections: [{ updateId: 'force', appendPoints: [{ text: 'Direction fixed', sourceIds: [wire.id(id)], kind: 'relation', group: 'Direction' }] }], concepts: [{ reuseId: 'arrow' }], questions: [] };
  const expanded = parseLectureNotes(JSON.stringify(wire.decode(JSON.stringify(packet))), sources, notes);
  expect(expanded.sections[0].points).toHaveLength(2);
  expect(expanded.sections[0].points[0]).toEqual(notes.sections[0].points[0]);
  expect(expanded.sections[0].points[1].kind).toBe('relation');
  expect(expanded.sections[0].photo).toEqual(notes.sections[0].photo);
  expect(notes.sections[0].points).toHaveLength(1);
  const reorganized = wire.decode(JSON.stringify({ ...packet, sections: [{ updateId: 'force', points: [{ text: 'First', sourceIds: [wire.id(id)] }, { reusePoint: 0 }] }] })) as LectureNotes;
  expect(reorganized.sections[0].points[1]).toEqual(notes.sections[0].points[0]);
  for (const section of [{ updateId: 'missing', appendPoints: [] }, { updateId: 'force', points: [{ reusePoint: 9 }] }, { updateId: 'force', points: [], appendPoints: [] }, { updateId: 'force', appendPoints: [], surprise: true }]) {
    expect(() => wire.decode(JSON.stringify({ ...packet, sections: [section] }))).toThrow();
  }
  expect(() => createLectureWire(sources, notes, false).decode(JSON.stringify(packet))).toThrow();
});

test('sparse patches preserve omitted content and validate changes after expanding citations', () => {
  const wire = createLectureWire(sources, notes, true);
  const apply = (patch: unknown) => parseLectureNotes(JSON.stringify(wire.decode(JSON.stringify({ patch }))), sources, notes);
  expect(apply({})).toEqual(notes);
  const updated = apply({ sections: [{ updateId: 'force', appendPoints: [{ text: 'Force direction fixed', sourceIds: ['s1'] }] }] });
  expect(updated.sections[0].points).toHaveLength(2);
  expect(updated.sections[0].photo).toEqual(notes.sections[0].photo);
  expect(updated.concepts).toEqual(notes.concepts);
  expect(updated.sections[0].points[1].sourceIds).toEqual([id]);
  expect(notes.sections[0].points).toHaveLength(1);
  const moved = apply({ removeSectionIds: ['force'], removeConceptIds: ['arrow'], sections: [{ id: 'new', title: 'New', points: [{ text: 'F ↑', sourceIds: ['s1'] }] }] });
  expect(moved.sections.map(s => s.id)).toEqual(['new']);
  expect(moved.concepts).toEqual([]);
  expect(() => apply({ sections: [{ updateId: 'force', appendPoints: [{ text: 'Bad', sourceIds: ['missing'] }] }] })).toThrow(/sourceIds/);
});

test('sparse patches reject mixed packets, unknown fields, invalid removals, duplicate edits and full rewrites', () => {
  const wire = createLectureWire(sources, notes, true);
  for (const packet of [{ patch: null }, { patch: [], }, { patch: {}, summary: '' }, { patch: { surprise: [] } },
    { patch: { sections: {} } }, { patch: { removeSectionIds: ['missing'] } }, { patch: { removeConceptIds: ['arrow', 'arrow'] } },
    { patch: { sections: [{ updateId: 'force', appendPoints: [] }, { updateId: 'force', appendPoints: [] }] } },
    { patch: { removeSectionIds: ['force'], sections: [{ updateId: 'force', appendPoints: [] }] } }]) {
    expect(() => wire.decode(JSON.stringify(packet))).toThrow();
  }
  expect(() => createLectureWire(sources, notes, false).decode('{"patch":{}}')).toThrow();
});

test('compact lines and sketches expand to the same validated notebook without changing retained items', () => {
  const wire = createLectureWire(sources, notes, true);
  const decoded = wire.decode(JSON.stringify({ patch: {
    sections: [{ updateId: 'force', appendPoints: [['F = ma', ['s1'], 'equation', 'Dynamics', 'Net force', 'F=ma']] }],
    sketches: [['motion', 'force', 'Force direction', ['s1'], [['line', 50, 100, 200, 100, 'blue', true], ['text', 100, 80, 'F', 'blue']]]],
  } }));
  const result = parseLectureNotes(JSON.stringify(decoded), sources, notes);
  expect(result.sections[0].points[1]).toEqual({ text: 'F = ma', sourceIds: [id], kind: 'equation', group: 'Dynamics', label: 'Net force', math: 'F=ma' });
  expect(result.concepts[0]).toEqual(notes.concepts[0]);
  expect(result.concepts[1].diagram?.elements[0]).toEqual({ type: 'line', x1: 50, y1: 100, x2: 200, y2: 100, color: 'blue', arrow: true });
  expect(result.concepts[1].sectionId).toBe('force');
  expect(result.concepts[1].title).toBe('Force direction');
  expect(result.concepts[1].explanation).toBe('Force direction');
  expect(result.concepts[1].diagram?.alt).toBe('Force direction');
  expect(() => wire.decode(JSON.stringify({ patch: { sketches: [['bad']] } }))).toThrow();
});

test('incremental full concept replacements preserve explicit empty captions without emptying titles or alt text', () => {
  const wire = createLectureWire(sources, notes, true);
  const concept = { ...notes.concepts[0], explanation: '', sourceIds: ['s1'] };
  const decoded = wire.decode(JSON.stringify({ patch: { concepts: [concept] } }));
  const result = parseLectureNotes(JSON.stringify(decoded), sources, notes);
  expect(result.concepts[0]).toEqual({ ...notes.concepts[0], explanation: '' });
  expect(result.sections).toEqual(notes.sections);
});

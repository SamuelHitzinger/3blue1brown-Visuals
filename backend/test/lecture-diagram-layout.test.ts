import { expect, test } from 'bun:test';
import { parseLectureDiagram } from '../src/agents/lecture-diagram.js';
import { generateLectureNotes, parseLectureNotes } from '../src/agents/lecture.js';
import { createLectureWire } from '../src/agents/lecture-wire.js';
import type { LectureNotes } from '../../shared/lecture.js';

const sources = [{ id: 's1', sequence: 1, kind: 'text' as const, text: 'A rises as B falls. Find B at A = 2.', createdAt: '2026-10-15T00:00:00Z' }];
const base: LectureNotes = { summary: '', sections: [{ id: 'comparison', title: 'Comparison', points: [{ text: 'A ↑; B ↓', group: 'Balance', sourceIds: ['s1'] }] }],
  concepts: [{ id: 'balance', sectionId: 'comparison', title: 'Balance', explanation: 'Opposing changes', sourceIds: ['s1'], catalogIds: [], visualizationPrompt: '', visualKind: 'static',
    diagram: { alt: 'Opposing changes', elements: [{ type: 'text', x: 300, y: 100, text: 'A ↑; B ↓' }] } }], questions: [] };

test('new plot and shaded-region primitives retain bounded geometry, strip unknown fields and reject unsafe coordinates', () => {
  const elements = [{ type: 'polyline', points: [[10, 330], [300, 170], [590, 10]], color: 'blue', onclick: 'bad' },
    { type: 'polygon', points: [[100, 100], [300, 100], [300, 300]], color: 'teal', href: 'https://bad' }];
  expect(parseLectureDiagram({ alt: 'Curve and region', elements }).elements).toEqual([
    { type: 'polyline', points: [[10, 330], [300, 170], [590, 10]], color: 'blue' },
    { type: 'polygon', points: [[100, 100], [300, 100], [300, 300]], color: 'teal' },
  ]);
  for (const points of [[[100, 100]], [[100, 100], [Infinity, 100]], [[100, 100], [100, NaN]], [[100, 100], [591, 100]],
    [[100, 100], [100, 331]], [[100, 100], [100, -1]], [[100, 100], ['100', 100]], [[100, 100], [100, 100, 100]], Array.from({ length: 65 }, () => [100, 100])]) {
    expect(() => parseLectureDiagram({ alt: 'Invalid curve', elements: [{ type: 'polyline', points }] })).toThrow();
  }
  expect(() => parseLectureDiagram({ alt: 'Invalid region', elements: [{ type: 'polygon', points: [[10, 10], [100, 100]] }] })).toThrow();
  expect(() => parseLectureDiagram({ alt: 'Invalid color', elements: [{ ...elements[0], color: 'url(bad)' }] })).toThrow();
});

test('concept group anchors survive parsing and compact sketch expansion; invalid group anchors are rejected', () => {
  const grouped = { ...base, concepts: [{ ...base.concepts[0], group: 'Balance' }] };
  expect(parseLectureNotes(JSON.stringify(grouped), sources).concepts[0].group).toBe('Balance');
  for (const changes of [{ group: 'Missing' }, { group: 'Balance', sectionId: undefined }, { group: 42 }]) {
    expect(() => parseLectureNotes(JSON.stringify({ ...base, concepts: [{ ...base.concepts[0], ...changes }] }), sources)).toThrow();
  }
  const wire = createLectureWire(sources, base, true);
  const raw = wire.decode(JSON.stringify({ patch: { sketches: [['balance', 'comparison', 'Opposing changes', ['s1'],
    [{ type: 'polyline', points: [[100, 250], [400, 50]], color: 'teal' }], [], 'Balance']] } }));
  const result = parseLectureNotes(JSON.stringify(raw), sources, base);
  expect(result.concepts[0].group).toBe('Balance');
  expect(result.concepts[0].diagram?.elements[0]).toEqual({ type: 'polyline', points: [[100, 250], [400, 50]], color: 'teal' });
});

test('new static diagrams with clipped or overlapping labels receive recoverable validation feedback', async () => {
  for (const elements of [
    [{ type: 'text', x: 25, y: 100, text: 'Long label beyond edge' }],
    [{ type: 'text', x: 200, y: 100, text: 'First label' }, { type: 'text', x: 210, y: 100, text: 'Second label' }],
  ]) {
    let attempts = 0;
    const notes = await generateLectureNotes({ run: async task => {
      if (++attempts === 1) return JSON.stringify({ ...base, concepts: [{ ...base.concepts[0], diagram: { alt: 'Unreadable', elements } }] });
      expect(task.prompt).toMatch(/label/i);
      return JSON.stringify(base);
    } }, { title: 'Comparison', sources, previousNotes: null }, new AbortController().signal);
    expect(attempts).toBe(2);
    expect(notes).toEqual(base);
  }
});

test('layout validation preserves unchanged legacy drawings and permits intentional geometry crossings', async () => {
  const legacy: LectureNotes = { ...base, concepts: [{ ...base.concepts[0], diagram: { alt: 'Legacy', elements: [{ type: 'text', x: 20, y: 100, text: 'Legacy wide label' }] } }] };
  let attempts = 0;
  const result = await generateLectureNotes({ run: async () => { attempts++; return '{"patch":{}}'; } },
    { title: 'Comparison', sources, previousNotes: legacy, previousSourceRevision: 1 }, new AbortController().signal);
  expect(result).toEqual(legacy);
  expect(attempts).toBe(1);
  const crossing: LectureNotes = { ...base, concepts: [{ ...base.concepts[0], diagram: { alt: 'Axes crossing', elements: [
    { type: 'line', x1: 50, y1: 170, x2: 550, y2: 170 }, { type: 'line', x1: 300, y1: 50, x2: 300, y2: 290 },
    { type: 'text', x: 300, y: 30, text: 'iiiiii' }, { type: 'text', x: 300, y: 310, text: 'A' },
  ] } }] };
  expect(await generateLectureNotes({ run: async () => JSON.stringify(crossing) }, { title: 'Comparison', sources, previousNotes: null }, new AbortController().signal)).toEqual(crossing);
});

test('rewrites cannot drop edited section/concept anchors or valid exact questions', async () => {
  const previous = { ...base, questions: [{ text: 'Find B at A = 2.', sourceIds: ['s1'] }] };
  for (const rejected of [{ summary: '', sections: [], concepts: [], questions: [] }, { ...previous, concepts: [] }]) {
    let attempts = 0;
    const result = await generateLectureNotes({ run: async () => JSON.stringify(++attempts === 1 ? rejected : previous) },
      { title: 'Comparison', sources, previousNotes: previous, preservedSectionIds: ['comparison'], preservedConceptIds: ['balance'] }, new AbortController().signal);
    expect(attempts).toBe(2);
    expect(result).toEqual(previous);
  }
  let questionAttempts = 0;
  await generateLectureNotes({ run: async () => JSON.stringify(++questionAttempts === 1 ? base : previous) },
    { title: 'Comparison', sources, previousNotes: previous }, new AbortController().signal);
  expect(questionAttempts).toBe(2);
});

test('a rewrite cannot reorder exact questions under existing indexed user edits', async () => {
  const evidence = [{ ...sources[0], text: 'Find A. Find B.' }];
  const previous = { ...base, questions: [{ text: 'Find A.', sourceIds: ['s1'] }, { text: 'Find B.', sourceIds: ['s1'] }] };
  let attempts = 0;
  const result = await generateLectureNotes({ run: async () => JSON.stringify(++attempts === 1 ? { ...previous, questions: [...previous.questions].reverse() } : previous) },
    { title: 'Comparison', sources: evidence, previousNotes: previous }, new AbortController().signal);
  expect(attempts).toBe(2);
  expect(result.questions).toEqual(previous.questions);
});

test('rewrites may remove an invalid legacy question while preserving later valid question order', async () => {
  const valid = { text: 'Find B at A = 2.', sourceIds: ['s1'] };
  const previous = { ...base, questions: [{ text: 'Invented assignment', sourceIds: ['s1'] }, valid] };
  const rewritten = { ...base, questions: [valid] };
  expect(await generateLectureNotes({ run: async () => JSON.stringify(rewritten) },
    { title: 'Comparison', sources, previousNotes: previous }, new AbortController().signal)).toEqual(rewritten);
});

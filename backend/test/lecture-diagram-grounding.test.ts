import { expect, test } from 'bun:test';
import { generateLectureNotes } from '../src/agents/lecture.js';
import type { LectureNotes, LectureSource } from '../../shared/lecture.js';

const sources: LectureSource[] = [
  { id: 'diagram', sequence: 1, kind: 'text', text: 'Old full transcript, not repeated.', createdAt: '2026-10-15T08:00:00Z',
    capture: { kind: 'photo', itemId: 'photo-1', sequence: 1, capturedAt: '2026-10-15T08:00:00Z',
      visualEvidence: 'A left, B right; blue arrow A → B; label F = 2 N; lower support cropped.' } },
  { id: 'photo', sequence: 2, kind: 'text', text: 'Another old transcript.', createdAt: '2026-10-15T08:00:01Z',
    capture: { kind: 'photo', itemId: 'photo-2', sequence: 2, capturedAt: '2026-10-15T08:00:01Z',
      photoSnippet: { crop: { x: 0.1, y: 0.2, width: 0.6, height: 0.5 }, description: 'Visible apparatus connections' } } },
  { id: 'unrelated', sequence: 3, kind: 'text', text: 'Unrelated old transcript.', createdAt: '2026-10-15T08:00:02Z',
    capture: { kind: 'photo', itemId: 'photo-3', sequence: 3, capturedAt: '2026-10-15T08:00:02Z', visualEvidence: 'Unrelated diagram' } },
  { id: 'new', sequence: 4, kind: 'text', text: 'F points from A to B.', createdAt: '2026-10-15T08:01:00Z',
    capture: { kind: 'photo', itemId: 'photo-4', sequence: 4, capturedAt: '2026-10-15T08:01:00Z', visualEvidence: 'Blue arrow A → B' } },
];
const notes: LectureNotes = { summary: '', sections: [{ id: 'force', title: 'Force', points: [{ text: 'F: A → B', sourceIds: ['diagram', 'photo'] }],
  photo: { sourceId: 'photo', caption: 'Apparatus connections' } }], concepts: [{ id: 'force-arrow', sectionId: 'force', title: 'Force direction',
  explanation: 'F: A → B', sourceIds: ['diagram'], visualizationPrompt: '', catalogIds: [], visualKind: 'static',
  diagram: { alt: 'Force from A to B', elements: [{ type: 'line', x1: 80, y1: 150, x2: 500, y2: 150, arrow: true, color: 'blue' }] } }], questions: [] };

test('incremental synthesis retains cited photo evidence without replaying earlier transcripts or unrelated photos', async () => {
  let payload: any;
  let calls = 0;
  await generateLectureNotes({ run: async task => { calls++; payload = JSON.parse(task.prompt); return JSON.stringify(notes); } },
    { title: 'Forces', sources, previousNotes: notes, previousSourceRevision: 3 }, new AbortController().signal);
  expect(calls).toBe(1);
  expect(payload.sources.map((source: LectureSource) => source.id)).toEqual(['new']);
  expect(payload.sources[0].capture.visualEvidence).toBe('Blue arrow A → B');
  expect(payload.visualReferences).toEqual([
    { id: 'diagram', visualEvidence: 'A left, B right; blue arrow A → B; label F = 2 N; lower support cropped.' },
    { id: 'photo', photoSnippet: { description: 'Visible apparatus connections' } },
  ]);
  expect(JSON.stringify(payload)).not.toContain('Old full transcript');
  expect(JSON.stringify(payload)).not.toContain('Unrelated diagram');
});

test('incremental diagram references include section evidence before a visual exists and bound old context', async () => {
  const manySources = Array.from({ length: 20 }, (_, index) => ({ ...sources[0], id: `photo-${index}`, sequence: index + 1,
    capture: { ...sources[0].capture!, visualEvidence: `Diagram ${index}: ${'x'.repeat(1200)}` } }));
  const prior: LectureNotes = { summary: '', sections: [{ id: 'force', title: 'Force', points: [{ text: 'F: A → B', sourceIds: manySources.map(source => source.id) }] }], concepts: [], questions: [] };
  let payload: any;
  await generateLectureNotes({ run: async task => { payload = JSON.parse(task.prompt); return JSON.stringify(prior); } },
    { title: 'Forces', sources: manySources, previousNotes: prior, previousSourceRevision: 20 }, new AbortController().signal);
  expect(payload.sources).toEqual([]);
  expect(payload.visualReferences.length).toBeGreaterThan(0);
  expect(payload.visualReferences.length).toBeLessThanOrEqual(12);
  expect(JSON.stringify(payload.visualReferences).length).toBeLessThanOrEqual(8000);
  expect(payload.visualReferences.at(-1).id).toBe('photo-19');
  expect(payload.visualReferences.some((reference: {id: string}) => reference.id === 'photo-0')).toBe(false);
});

test('full synthesis supplies photo evidence once inside sources', async () => {
  let payload: any;
  await generateLectureNotes({ run: async task => { payload = JSON.parse(task.prompt); return JSON.stringify(notes); } },
    { title: 'Forces', sources, previousNotes: notes, previousSourceRevision: 0 }, new AbortController().signal);
  expect(payload.sources).toHaveLength(4);
  expect(payload.visualReferences).toBeUndefined();
  expect(payload.sources[0].capture.visualEvidence).toBe('A left, B right; blue arrow A → B; label F = 2 N; lower support cropped.');
});

test('selected older section photos retain their candidates when newer evidence exceeds both context limits', async () => {
  const manySources: LectureSource[] = Array.from({ length: 20 }, (_, index) => ({ ...sources[0], id: `photo-${index}`, sequence: index + 1,
    capture: { ...sources[0].capture!, visualEvidence: 'x'.repeat(2000), ...(index < 3 ? {
      photoSnippet: { crop: { x: 0, y: 0, width: 0.5, height: 0.5 }, description: `Apparatus ${index}` },
    } : {}) } }));
  const prior: LectureNotes = { summary: '', sections: [0, 1, 2].map(index => ({ id: `topic-${index}`, title: `Topic ${index}`,
    points: [{ text: 'Apparatus connections', sourceIds: index === 0 ? manySources.map(source => source.id) : [`photo-${index}`] }],
    photo: { sourceId: `photo-${index}`, caption: `Apparatus ${index}` } })), concepts: [], questions: [] };
  let payload: any;
  await generateLectureNotes({ run: async task => { payload = JSON.parse(task.prompt); return JSON.stringify(prior); } },
    { title: 'Forces', sources: manySources, previousNotes: prior, previousSourceRevision: 20 }, new AbortController().signal);
  expect(payload.sources).toEqual([]);
  expect(payload.visualReferences.filter((reference: any) => reference.photoSnippet).map((reference: any) => ({
    id: reference.id, description: reference.photoSnippet.description,
  }))).toEqual([
    { id: 'photo-0', description: 'Apparatus 0' },
    { id: 'photo-1', description: 'Apparatus 1' },
    { id: 'photo-2', description: 'Apparatus 2' },
  ]);
  expect(payload.visualReferences.at(-1).id).toBe('photo-19');
  expect(payload.visualReferences.length).toBeLessThanOrEqual(12);
  expect(JSON.stringify(payload.visualReferences).length).toBeLessThanOrEqual(8000);
  expect(new Set(payload.visualReferences.map((reference: any) => reference.id)).size).toBe(payload.visualReferences.length);
});

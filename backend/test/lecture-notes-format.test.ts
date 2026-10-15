import { expect, test } from 'bun:test';
import { parseLectureNotes, generateLectureNotes } from '../src/agents/lecture.js';
import { LectureService } from '../src/lectures.js';
import type { LectureDiagram, LectureNotes } from '../../shared/lecture.js';

const sources = [{ id: 's1', sequence: 1, kind: 'text' as const, text: 'Find the length of vector v = (3, 4).', createdAt: '2026-10-15T08:00:00Z' }];
const diagram: LectureDiagram = { alt: 'Vector v from the origin to (3, 4).', elements: [{ type: 'line', x1: 80, y1: 260, x2: 300, y2: 60, arrow: true, color: 'blue' }] };
const questionOnly: LectureNotes = { summary: '', sections: [], concepts: [], questions: [{ text: sources[0].text, sourceIds: ['s1'], diagram }] };

test('section photos require a validated photo candidate cited by the section and reject arbitrary resources', () => {
  const evidence = [{ ...sources[0], capture: { kind: 'photo' as const, itemId: 'photo-1', sequence: 1, capturedAt: sources[0].createdAt,
    photoSnippet: { crop: { x: 0.1, y: 0.2, width: 0.5, height: 0.5 }, description: 'Measured trace' } } }];
  const photo = { sourceId: 's1', caption: 'Measured damping trace' };
  const notes = { summary: '', sections: [{ id: 'trace', title: 'Damping', points: [{ text: 'Amplitude decreases', sourceIds: ['s1'] }], photo }], concepts: [], questions: [] };
  expect(parseLectureNotes(JSON.stringify(notes), evidence).sections[0].photo).toEqual(photo);
  expect(() => parseLectureNotes(JSON.stringify(notes), sources)).toThrow(/photo/i);
  expect(() => parseLectureNotes(JSON.stringify({ ...notes, sections: [{ ...notes.sections[0], photo: { ...photo, url: 'https://example.com/photo.jpg' } }] }), evidence)).toThrow(/photo/i);
  expect(() => parseLectureNotes(JSON.stringify({ ...notes, sections: [{ ...notes.sections[0], photo: { ...photo, sourceId: 'missing' } }] }), evidence)).toThrow(/photo/i);
  expect(() => parseLectureNotes(JSON.stringify({ ...notes, sections: [notes.sections[0], { ...notes.sections[0], id: 'again' }] }), evidence)).toThrow(/photo/i);
  const unrelated = { ...sources[0], id: 's2' };
  expect(() => parseLectureNotes(JSON.stringify({ ...notes, sections: [{ ...notes.sections[0], points: [{ text: 'Other material', sourceIds: ['s2'] }] }] }), [...evidence, unrelated])).toThrow(/photo/i);
  const fourSources = Array.from({ length: 7 }, (_, index) => ({ ...evidence[0], id: `photo-${index}` }));
  const fourSections = fourSources.map(source => ({ ...notes.sections[0], id: source.id, points: [{ text: 'Measured trace', sourceIds: [source.id] }], photo: { ...photo, sourceId: source.id } }));
  expect(parseLectureNotes(JSON.stringify({ ...notes, sections: fourSections.slice(0, 6) }), fourSources).sections).toHaveLength(6);
  expect(() => parseLectureNotes(JSON.stringify({ ...notes, sections: fourSections }), fourSources)).toThrow(/six/i);
});

test('question-only material does not require invented learning notes; static setup survives', () => {
  expect(parseLectureNotes(JSON.stringify(questionOnly), sources)).toEqual(questionOnly);
});

test('notebook structure preserves equations, conditions and meaningful groups without changing exact questions', () => {
  const point = { text: 'ΔS_surr = −ΔH_sys/T', sourceIds: ['s1'], kind: 'equation' as const, label: 'Constant pressure', group: 'Surroundings', math: '\\Delta S_{surr} = -\\frac{\\Delta H_{sys}}{T}' };
  const value = { ...questionOnly, sections: [{ id: 'entropy', title: 'Entropy', points: [point] }] };
  expect(parseLectureNotes(JSON.stringify(value), sources).sections[0].points[0]).toEqual(point);
  expect(() => parseLectureNotes(JSON.stringify({ ...value, sections: [{ ...value.sections[0], points: [{ ...point, kind: 'script' }] }] }), sources)).toThrow();
});

test('assigned questions must retain source wording rather than become invented study prompts', () => {
  expect(() => parseLectureNotes(JSON.stringify({ ...questionOnly, questions: [{ text: 'Explain vectors in your own words.', sourceIds: ['s1'] }] }), sources)).toThrow(/wording/);
});

test('static concepts preserve their diagram and reject executable or malformed diagram content', () => {
  const notes: LectureNotes = { summary: 'Vectors have direction.', sections: [{ id: 'vectors', title: 'Vectors', points: [{ text: 'A vector has direction.', sourceIds: ['s1'] }] }], concepts: [{ id: 'v', sectionId: 'vectors', title: 'Direction', explanation: 'The arrow marks direction.', sourceIds: ['s1'], visualizationPrompt: 'Show the vector.', catalogIds: [], visualKind: 'static', diagram }], questions: [] };
  expect(parseLectureNotes(JSON.stringify(notes), sources).concepts[0]).toEqual(notes.concepts[0]);
  for (const elements of [[{ type: 'script', text: 'alert(1)' }], [{ type: 'line', x1: -999, y1: 0, x2: 20, y2: 20 }]]) {
    expect(() => parseLectureNotes(JSON.stringify({ ...questionOnly, questions: [{ ...questionOnly.questions[0], diagram: { ...diagram, elements } }] }), sources)).toThrow();
  }
});

test('static diagrams do not need an unused animation prompt; dynamic visuals still do', () => {
  const notes = { summary: '', sections: [{ id: 'vectors', title: 'Vectors', points: [{ text: 'v: direction + magnitude', sourceIds: ['s1'] }] }], concepts: [{ id: 'v', sectionId: 'vectors', title: 'Direction', explanation: 'Arrow → direction', sourceIds: ['s1'], catalogIds: [], visualKind: 'static', diagram }], questions: [] };
  expect(parseLectureNotes(JSON.stringify(notes), sources).concepts[0].visualizationPrompt).toBe('');
  expect(parseLectureNotes(JSON.stringify({ ...notes, concepts: [{ ...notes.concepts[0], visualizationPrompt: '' }] }), sources).concepts[0].diagram).toEqual(diagram);
  expect(() => parseLectureNotes(JSON.stringify({ ...notes, concepts: [{ ...notes.concepts[0], visualKind: 'animation', diagram: undefined, visualizationPrompt: '' }] }), sources)).toThrow();
});

test('global style instructions reach synthesis as preferences separate from evidence', async () => {
  let payload: any;
  await generateLectureNotes({ run: async task => { payload = JSON.parse(task.prompt); return JSON.stringify(questionOnly); } }, { title: 'Vectors', sources, previousNotes: null, instructions: 'German; shorter notes; fewer visuals.' }, new AbortController().signal);
  expect(payload.stylePreferences).toBe('German; shorter notes; fewer visuals.');
  expect(payload.sources[0].text).toBe(sources[0].text);
});

test('full refresh reauthors old prose from all sources; incremental updates retain their source boundary', async () => {
  const payloads: any[] = [];
  const runner = { run: async (task: any) => { payloads.push(JSON.parse(task.prompt)); return JSON.stringify(questionOnly); } };
  const input = { title: 'Vectors', sources, previousNotes: questionOnly };
  await generateLectureNotes(runner, { ...input, previousSourceRevision: 0 }, new AbortController().signal);
  await generateLectureNotes(runner, { ...input, previousSourceRevision: 1 }, new AbortController().signal);
  expect(payloads[0].revisionMode).toBe('rewrite-from-sources');
  expect(payloads[0].sources).toHaveLength(1);
  expect(payloads[1].revisionMode).toBe('incremental');
  expect(payloads[1].sources).toHaveLength(0);
});

test('short audio updates retain only bounded preceding speech for sentence continuity', async () => {
  const evidence = Array.from({ length: 6 }, (_, i) => ({ id: `a${i}`, sequence: i + 1, kind: 'text' as const, text: i === 4 ? 'x'.repeat(2000) : `fragment ${i}`, createdAt: '2026-10-15T00:00:00Z',
    capture: { kind: 'audio' as const, itemId: `item-${i}`, sequence: i + 1, capturedAt: '2026-10-15T00:00:00Z', durationMs: 2000 } }));
  const previous: LectureNotes = { summary: '', sections: [], concepts: [], questions: [] };
  let payload: any;
  await generateLectureNotes({ run: async task => { payload = JSON.parse(task.prompt); return '{"patch":{}}'; } },
    { title: 'Continuity', sources: evidence, previousNotes: previous, previousSourceRevision: 5 }, new AbortController().signal);
  expect(payload.sources.map((s: any) => s.id)).toEqual(['a5']);
  expect(payload.continuitySources.map((s: any) => s.id)).toEqual(['a2', 'a3', 'a4']);
  expect(payload.continuitySources[2].text.length).toBe(800);
});

test('generation retries paragraph notes while leaving exact assignment wording untouched', async () => {
  const longQuestion = 'Find the length of vector v = (3, 4), then explain your reasoning to your partner using the methods introduced in class today.';
  const evidence = [{ ...sources[0], text: `A vector has magnitude and direction. ${longQuestion}` }];
  const notes: LectureNotes = { summary: '', sections: [{ id: 'vectors', title: 'Vectors', points: [{ text: 'Vector → magnitude + direction', sourceIds: ['s1'] }] }], concepts: [], questions: [{ text: longQuestion, sourceIds: ['s1'] }] };
  let attempts = 0;
  const result = await generateLectureNotes({ run: async () => JSON.stringify(++attempts === 1 ? { ...notes, sections: [{ ...notes.sections[0], points: [{ text: 'A vector has both magnitude and direction, and these two properties are necessary to describe the vector completely in these notes.', sourceIds: ['s1'] }] }] } : notes) }, { title: 'Vectors', sources: evidence, previousNotes: null }, new AbortController().signal);
  expect(attempts).toBe(2);
  expect(result.sections[0].points[0].text).toBe('Vector → magnitude + direction');
  expect(result.questions[0].text).toBe(longQuestion);
});

test('global instructions are owner-scoped, bounded, and apply to automatic synthesis', async () => {
  let instructions: string | undefined;
  const service = new LectureService(':memory:', async input => { instructions = input.instructions; return { ...questionOnly, questions: [{ text: input.sources[0].text, sourceIds: [input.sources[0].id], diagram }] }; });
  const request = (path: string, method = 'GET', value?: unknown, owner = 'alice') => service.handle(new Request(`http://localhost/api/lectures${path}`, { method, headers: { 'x-user-id': owner, 'Idempotency-Key': path || 'new' }, ...(value === undefined ? {} : { body: JSON.stringify(value) }) }));
  try {
    expect((await request('/preferences', 'PATCH', { instructions: 'German, concise.' })).status).toBe(200);
    expect(await (await request('/preferences')).json()).toEqual({ instructions: 'German, concise.' });
    expect(await (await request('/preferences', 'GET', undefined, 'bob')).json()).toEqual({ instructions: '' });
    expect((await request('/preferences', 'PATCH', { instructions: 'x'.repeat(1001) })).status).toBe(413);
    const session = await (await request('', 'POST', {})).json();
    await request(`/${session.id}/sources`, 'POST', { text: sources[0].text });
    for (let i = 0; i < 100 && instructions === undefined; i++) await Bun.sleep(5);
    expect(instructions).toBe('German, concise.');
  } finally { await service.close(); }
});

test('global instructions apply to new notes across courses and independent learning', async () => {
  const received = new Map<string, string | undefined>();
  const service = new LectureService(':memory:', async input => {
    received.set(input.title, input.instructions);
    return { ...questionOnly, questions: [{ text: input.sources[0].text, sourceIds: [input.sources[0].id], diagram }] };
  });
  const request = (path: string, value: unknown, method = 'POST', key = path) => service.handle(new Request(`http://localhost/api/lectures${path}`, { method, headers: { 'x-user-id': 'alice', 'Idempotency-Key': key }, body: JSON.stringify(value) }));
  try {
    await request('/preferences', { instructions: 'German, concise.' }, 'PATCH');
    for (const [title, courseId] of [['Algebra', 'math'], ['Mechanics', 'physics'], ['Independent', undefined]]) {
      const response = await request('', { title, courseId }, 'POST', title!);
      expect(response.status).toBe(201);
      const session = await response.json();
      await request(`/${session.id}/sources`, { text: sources[0].text });
    }
    for (let i = 0; i < 100 && received.size < 3; i++) await Bun.sleep(5);
    expect(Object.fromEntries(received)).toEqual({ Algebra: 'German, concise.', Mechanics: 'German, concise.', Independent: 'German, concise.' });
  } finally { await service.close(); }
});

import { afterEach, expect, test } from 'bun:test';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Database } from 'bun:sqlite';
import { LectureService } from '../src/lectures.js';
import { parseLectureNotes, generateLectureNotes } from '../src/agents/lecture.js';
import { createLectureVisualGenerator } from '../src/agents/lecture-visual.js';
import type { LectureNotes, LectureSession, LectureSource, LectureSynthesizer } from '../../shared/lecture.js';

const services: LectureService[] = [];
afterEach(async () => { await Promise.all(services.splice(0).map(service => service.close())); });
const api = (path = '', method = 'GET', body?: unknown, owner = 'alice', key?: string) => new Request(`http://localhost/api/lectures${path}`, {
  method, headers: { 'x-user-id': owner, ...(key ? { 'Idempotency-Key': key } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});
const service = (synthesize?: LectureSynthesizer, options: ConstructorParameters<typeof LectureService>[2] = {}) => {
  const instance = new LectureService(':memory:', synthesize, options); services.push(instance); return instance;
};
const makeNotes = (sources: LectureSource[]): LectureNotes => ({ summary: 'Vectors have direction and magnitude.',
  sections: [{ id: 'vectors', title: 'Vectors', points: [{ text: 'Vectors have direction.', sourceIds: [sources[0].id] }] }],
  concepts: [{ id: 'vector', title: 'A vector', explanation: 'A directed quantity.', sourceIds: [sources[0].id], visualizationPrompt: 'Move an arrow to show its direction.', catalogIds: [] }], questions: [] });
const create = async (s: LectureService, key = 'lecture') => (await (await s.handle(api('', 'POST', { title: 'Linear algebra' }, 'alice', key))).json()) as LectureSession;
const get = async (s: LectureService, id: string) => (await (await s.handle(api(`/${id}`))).json()) as LectureSession;
const append = (s: LectureService, id: string, text = 'A vector has magnitude and direction.', key = 'source') => s.handle(api(`/${id}/sources`, 'POST', { kind: 'text', text }, 'alice', key));
async function until<T>(read: () => Promise<T>, check: (value: T) => boolean): Promise<T> {
  for (let i = 0; i < 300; i++) { const value = await read(); if (check(value)) return value; await Bun.sleep(5); }
  throw new Error('Lecture work did not finish');
}

test('notes-only operation retains dynamic concepts without scheduling unavailable visual jobs', async () => {
  const s = service(async input => makeNotes(input.sources));
  const lecture = await create(s);
  await append(s, lecture.id);
  const saved = await until(() => get(s, lecture.id), value => value.synthesizedRevision === 1);
  expect(saved.status).toBe('idle');
  expect(saved.notes?.concepts).toHaveLength(1);
  expect(saved.visualizations).toEqual([]);
});

test('conditional snapshots avoid retransmitting unchanged lecture sources without bypassing ownership', async () => {
  const s = service(), lecture = await create(s);
  const first = await s.handle(api(`/${lecture.id}`)), etag = first.headers.get('etag');
  expect(etag).toBeTruthy();
  const poll = api(`/${lecture.id}`); poll.headers.set('If-None-Match', etag!);
  expect((await s.handle(poll)).status).toBe(304);
  await append(s, lecture.id);
  const changed = await s.handle(poll);
  expect(changed.status).toBe(200); expect(changed.headers.get('etag')).not.toBe(etag);
  const other = api(`/${lecture.id}`, 'GET', undefined, 'bob'); other.headers.set('If-None-Match', etag!);
  expect((await s.handle(other)).status).toBe(404);
});

test('short audio windows can continue past eighty minutes of capture', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'aha-long-capture-')), path = join(dir, 'lecture.sqlite');
  const s = new LectureService(path);
  try {
    const lecture = await create(s);
    lecture.sources = Array.from({ length: 1200 }, (_, i) => ({ id: crypto.randomUUID(), sequence: i + 1, kind: 'text' as const, text: 'Saved speech', createdAt: lecture.createdAt }));
    lecture.sourceRevision = 1200;
    const db = new Database(path); db.query('UPDATE lectures SET snapshot = ? WHERE id = ?').run(JSON.stringify(lecture), lecture.id); db.close();
    const response = await append(s, lecture.id, 'Next new fact', 'next');
    expect(response.status).toBe(202); expect((await response.json()).sourceRevision).toBe(1201);
  } finally { await s.close(); await rm(dir, { recursive: true, force: true }); }
});

test('lecture creation and sources are idempotent, owner-scoped and retained without AI', async () => {
  const s = service(), lecture = await create(s);
  expect((await create(s)).id).toBe(lecture.id);
  expect((await s.handle(api('', 'POST', { title: 'Other' }, 'alice', 'lecture'))).status).toBe(409);
  const saved = await (await append(s, lecture.id)).json();
  expect(saved.sources).toHaveLength(1); expect(saved.status).toBe('failed');
  expect(saved.error).toMatch(/saved|connection/i);
  expect((await (await append(s, lecture.id)).json()).sources).toHaveLength(1);
  expect((await append(s, lecture.id, 'Different input')).status).toBe(409);
  for (const request of [api(`/${lecture.id}`, 'GET', undefined, 'bob'), api(`/${lecture.id}`, 'DELETE', undefined, 'bob'), api(`/${lecture.id}/sources`, 'POST', { kind: 'text', text: 'Mine' }, 'bob', 'x')]) {
    expect((await s.handle(request)).status).toBe(404);
  }
  expect(await (await s.handle(api('', 'GET', undefined, 'bob'))).json()).toEqual([]);
  const list = await (await s.handle(api())).json();
  expect(list[0].id).toBe(lecture.id); expect(list[0].sources).toBeUndefined();
  expect((await s.handle(api(`/${lecture.id}`))).headers.get('Cache-Control')).toBe('private, no-store');
  expect((await s.handle(api())).headers.get('Vary')).toBe('X-User-Id');
  expect((await s.handle(api())).headers.get('Cache-Control')).toBe('private, no-store');
});

test('append during inference triggers a second revision while preserving personal notes and title', async () => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const sizes: number[] = [];
  const s = service(async input => { sizes.push(input.sources.length); if (sizes.length === 1) await gate; return makeNotes(input.sources); });
  const lecture = await create(s); await append(s, lecture.id);
  await until(async () => sizes.length, size => size === 1);
  await append(s, lecture.id, 'The coordinates of a vector depend on its basis.', 'second');
  await s.handle(api(`/${lecture.id}`, 'PATCH', { title: 'Lecture two', personalNotes: 'Ask about basis changes.' }));
  release();
  const done = await until(() => get(s, lecture.id), row => row.synthesizedRevision === 2 && row.status === 'idle');
  expect(sizes).toEqual([1, 2]); expect(done.sources).toHaveLength(2);
  expect(done.title).toBe('Lecture two'); expect(done.personalNotes).toBe('Ask about basis changes.');
  expect(done.sourceRevision).toBe(2); expect(done.notes?.sections[0].points[0].sourceIds).toEqual([done.sources[0].id]);
});

test('finish consolidates caught-up notes once and preserves edits, exact questions and citations', async () => {
  const calls: number[] = [];
  let release: (() => void) | undefined;
  const s = service(async input => {
    calls.push(input.previousSourceRevision ?? -1);
    if (calls.length > 1) await new Promise<void>(resolve => { release = resolve; });
    return { ...makeNotes(input.sources), concepts: [], questions: [{ text: 'Find the magnitude.', sourceIds: [input.sources[0].id] }] };
  });
  try {
    const lecture = await create(s); await append(s, lecture.id, 'A vector has direction. Find the magnitude.');
    await until(() => get(s, lecture.id), row => row.status === 'idle');
    await s.handle(api(`/${lecture.id}`, 'PATCH', { personalNotes: 'My reasoning', noteEdits: { 'section:vectors': 'My wording', 'question:0': 'My annotation' } }));
    await s.handle(api(`/${lecture.id}/finish`, 'POST'));
    await until(async () => calls.length, count => count === 2);
    const finishedAt = (await get(s, lecture.id)).finishedAt;
    await s.handle(api(`/${lecture.id}/finish`, 'POST'));
    release!();
    const done = await until(() => get(s, lecture.id), row => row.status === 'idle');
    await s.handle(api(`/${lecture.id}/finish`, 'POST')); await Bun.sleep(10);
    expect(calls).toEqual([0, 0]);
    expect((await get(s, lecture.id)).finishedAt).toBe(finishedAt);
    expect(done.personalNotes).toBe('My reasoning');
    expect(done.noteEdits).toEqual({ 'section:vectors': 'My wording', 'question:0': 'My annotation' });
    expect(done.notes!.questions).toEqual([{ text: 'Find the magnitude.', sourceIds: [done.sources[0].id] }]);
    expect(done.notes!.sections[0].points[0].sourceIds).toEqual([done.sources[0].id]);
    expect(done.notesRefreshRequested).toBeUndefined();
  } finally { release?.(); }
});

test('finish waits for live synthesis then consolidates again when accepted capture arrives late', async () => {
  const calls: { previous: number | undefined; sources: number; release: () => void }[] = [];
  const s = service(async input => {
    await new Promise<void>(resolve => calls.push({ previous: input.previousSourceRevision, sources: input.sources.length, release: resolve }));
    return { ...makeNotes(input.sources), concepts: [] };
  }, { liveSynthesisConcurrency: 2 });
  try {
    const lecture = await create(s); await append(s, lecture.id);
    await until(async () => calls.length, count => count === 1);
    await s.handle(api(`/${lecture.id}/finish`, 'POST'));
    await s.handle(api(`/${lecture.id}/finish`, 'POST'));
    calls[0].release();
    await until(async () => calls.length, count => count === 2);
    await append(s, lecture.id, 'A positive scalar preserves direction.', 'late');
    await Bun.sleep(10); expect(calls).toHaveLength(2);
    calls[1].release();
    await until(async () => calls.length, count => count === 3);
    expect(calls.map(({ previous, sources }) => ({ previous, sources }))).toEqual([
      { previous: 0, sources: 1 }, { previous: 0, sources: 1 }, { previous: 0, sources: 2 },
    ]);
    calls[2].release();
    const done = await until(() => get(s, lecture.id), row => row.status === 'idle' && row.synthesizedRevision === 2);
    expect(done.notesRefreshRequested).toBeUndefined();
  } finally { for (const call of calls) call.release(); }
});

test('failed finish consolidation retains its full rewrite request for retry with uncovered sources', async () => {
  let fail = true;
  const calls: number[] = [];
  const s = service(async input => {
    calls.push(input.previousSourceRevision ?? -1);
    if (input.sources.length > 1 && fail) throw new Error('Provider unavailable');
    return { ...makeNotes(input.sources), concepts: [] };
  }, { synthesisDebounceMs: 1000 });
  const lecture = await create(s); await append(s, lecture.id);
  await s.handle(api(`/${lecture.id}/synthesize`, 'POST'));
  await until(() => get(s, lecture.id), row => row.status === 'idle');
  await append(s, lecture.id, 'Second fact', 'pending');
  await s.handle(api(`/${lecture.id}/finish`, 'POST'));
  const failed = await until(() => get(s, lecture.id), row => row.status === 'failed');
  expect(failed.notesRefreshRequested).toBe(true);
  expect(failed.synthesizedRevision).toBe(1);
  fail = false;
  await s.handle(api(`/${lecture.id}/synthesize`, 'POST'));
  await until(() => get(s, lecture.id), row => row.status === 'idle' && row.synthesizedRevision === 2);
  expect(calls).toEqual([0, 0, 0]);
});

test('consolidation keeps edited sections and concepts even when edits arrive during inference', async () => {
  let release: (() => void) | undefined;
  let calls = 0;
  const s = service(async input => {
    calls++;
    if (calls === 1) return makeNotes(input.sources);
    await new Promise<void>(resolve => { release = resolve; });
    return { summary: '', sections: [{ id: 'merged', title: 'Combined explanation', points: [{ text: 'Magnitude and direction.', sourceIds: [input.sources[0].id] }] }], concepts: [], questions: [] };
  });
  try {
    const lecture = await create(s); await append(s, lecture.id);
    await until(() => get(s, lecture.id), row => row.status === 'idle');
    await s.handle(api(`/${lecture.id}/finish`, 'POST'));
    await until(async () => !!release, Boolean);
    await s.handle(api(`/${lecture.id}`, 'PATCH', { noteEdits: { 'section:vectors': 'Keep my section', 'concept:vector': 'Keep my caption' }, noteCanvas: { vectors: { marks: [], offsets: {} } } }));
    release!();
    const done = await until(() => get(s, lecture.id), row => row.status === 'idle');
    expect(done.notes!.sections.map(section => section.id)).toContain('vectors');
    expect(done.notes!.concepts.map(concept => concept.id)).toContain('vector');
    expect(done.noteEdits?.['section:vectors']).toBe('Keep my section');
    expect(done.noteEdits?.['concept:vector']).toBe('Keep my caption');
    expect(done.noteCanvas?.vectors).toEqual({ marks: [], offsets: {} });
    expect(done.notes!.sections.find(section => section.id === 'vectors')!.points[0].sourceIds).toEqual([done.sources[0].id]);
  } finally { release?.(); }
});

test('a failed live update cannot discard a finish request queued during inference', async () => {
  let release: (() => void) | undefined;
  let calls = 0;
  const s = service(async input => {
    if (++calls === 1) { await new Promise<void>(resolve => { release = resolve; }); throw new Error('Live update failed'); }
    expect(input.previousSourceRevision).toBe(0);
    return { ...makeNotes(input.sources), concepts: [] };
  });
  try {
    const lecture = await create(s); await append(s, lecture.id);
    await until(async () => !!release, Boolean);
    await s.handle(api(`/${lecture.id}/finish`, 'POST'));
    release!();
    const done = await until(() => get(s, lecture.id), row => row.status === 'idle');
    expect(done.synthesizedRevision).toBe(1); expect(calls).toBe(2);
  } finally { release?.(); }
});

for (const disjointSources of [false, true]) test(`an edited concept keeps its explicit group when consolidation replaces section groups (disjoint sources: ${disjointSources})`, async () => {
  let calls = 0;
  const s = service(async input => {
    const notes = makeNotes(input.sources);
    notes.sections[0].points[0].group = ++calls === 1 ? 'Direction' : 'Combined';
    if (disjointSources) notes.concepts[0].sourceIds = [input.sources[1].id];
    if (calls === 1) { notes.concepts[0].sectionId = 'vectors'; notes.concepts[0].group = 'Direction'; }
    else notes.concepts = [];
    return notes;
  }, { synthesisDebounceMs: 1000 });
  const lecture = await create(s); await append(s, lecture.id);
  if (disjointSources) await append(s, lecture.id, 'Photo: arrow points right.', 'photo-evidence');
  await s.handle(api(`/${lecture.id}/synthesize`, 'POST'));
  await until(() => get(s, lecture.id), row => row.status === 'idle');
  await s.handle(api(`/${lecture.id}`, 'PATCH', { noteEdits: { 'concept:vector': 'My diagram explanation' } }));
  await s.handle(api(`/${lecture.id}/finish`, 'POST'));
  const done = await until(() => get(s, lecture.id), row => row.status === 'idle' || row.status === 'failed');
  expect(done.status).toBe('idle');
  expect(done.notes!.concepts[0].group).toBe('Direction');
  expect(done.notes!.sections[0].points.some(point => point.group === 'Direction' && point.sourceIds.includes(done.sources[0].id))).toBe(true);
});

for (const editFirst of [false, true]) test(`duplicate questions keep distinct occurrence annotations, including an unedited first occurrence (edit first: ${editFirst})`, async () => {
  const s = service(async input => ({ ...makeNotes(input.sources), concepts: [], questions: [
    { text: 'Find x.', sourceIds: [input.sources[0].id], diagram: { alt: 'First setup', elements: [{ type: 'circle', cx: 200, cy: 170, r: 50 }] } },
    { text: 'Find x.', sourceIds: [input.sources[0].id], diagram: { alt: 'Second setup', elements: [{ type: 'circle', cx: 200, cy: 170, r: 80 }] } },
  ] }));
  const lecture = await create(s); await append(s, lecture.id, 'Find x. Find x.');
  await until(() => get(s, lecture.id), row => row.status === 'idle');
  const edits: Record<string, string> = editFirst ? { 'question:0': 'First annotation', 'question:1': 'Second annotation' } : { 'question:1': 'Second annotation' };
  await s.handle(api(`/${lecture.id}`, 'PATCH', { noteEdits: edits }));
  await s.handle(api(`/${lecture.id}/finish`, 'POST'));
  const done = await until(() => get(s, lecture.id), row => row.status === 'idle');
  expect(done.noteEdits).toEqual(edits);
  expect(done.notes!.questions.map(question => question.diagram!.alt)).toEqual(['First setup', 'Second setup']);
});

test('question overrides follow exact source identity when a rewrite removes an invalid preceding legacy question', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'aha-question-anchor-')), file = join(directory, 'lectures.sqlite');
  const s = new LectureService(file, async input => ({ ...makeNotes(input.sources), concepts: [], questions: [{ text: 'Find the magnitude.', sourceIds: [input.sources[0].id] }] })); services.push(s);
  try {
    const lecture = await create(s); await append(s, lecture.id, 'Find the magnitude.');
    const previous = await until(() => get(s, lecture.id), row => row.status === 'idle');
    previous.notes!.questions.unshift({ text: 'Legacy paraphrase', sourceIds: [previous.sources[0].id] });
    previous.noteEdits = { 'question:1': 'My answer annotation', 'section:vectors': 'My section' };
    const db = new Database(file); db.query('UPDATE lectures SET snapshot = ? WHERE id = ?').run(JSON.stringify(previous), lecture.id); db.close();
    await s.handle(api(`/${lecture.id}/finish`, 'POST'));
    const done = await until(() => get(s, lecture.id), row => row.status === 'idle');
    expect(done.notes!.questions.map(question => question.text)).toEqual(['Find the magnitude.']);
    expect(done.noteEdits).toEqual({ 'question:0': 'My answer annotation', 'section:vectors': 'My section' });
  } finally { await s.close(); await rm(directory, { recursive: true, force: true }); }
});

for (const full of [false, true]) test(`removed legacy question annotations remain saved without overwriting personal notes (full: ${full})`, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'aha-question-orphan-')), file = join(directory, 'lectures.sqlite');
  const s = new LectureService(file, async input => ({ ...makeNotes(input.sources), concepts: [], questions: [] })); services.push(s);
  try {
    const lecture = await create(s); await append(s, lecture.id);
    const previous = await until(() => get(s, lecture.id), row => row.status === 'idle');
    previous.notes!.questions = [{ text: 'Legacy paraphrase', sourceIds: [previous.sources[0].id] }];
    previous.noteEdits = { 'question:0': 'My annotation' }; previous.personalNotes = full ? 'x'.repeat(100_000) : 'Existing personal note';
    const db = new Database(file); db.query('UPDATE lectures SET snapshot = ? WHERE id = ?').run(JSON.stringify(previous), lecture.id); db.close();
    await s.handle(api(`/${lecture.id}/finish`, 'POST'));
    const done = await until(() => get(s, lecture.id), row => row.status === 'idle' || row.status === 'failed');
    if (full) {
      expect(done.status).toBe('failed'); expect(done.personalNotes).toBe(previous.personalNotes);
      expect(done.noteEdits).toEqual(previous.noteEdits); expect(done.notes).toEqual(previous.notes);
      return;
    }
    expect(done.status).toBe('idle');
    expect(done.personalNotes).toBe('Existing personal note\n\nAnnotation for original question: Legacy paraphrase\nMy annotation');
    expect(done.noteEdits).toEqual({});
    await s.handle(api(`/${lecture.id}/synthesize`, 'POST'));
    const again = await until(() => get(s, lecture.id), row => row.status === 'idle');
    expect(again.personalNotes).toBe(done.personalNotes);
  } finally { await s.close(); await rm(directory, { recursive: true, force: true }); }
});

for (const failOlder of [false, true]) test(`overlapping live updates publish newer coverage without waiting for stale work (older failure: ${failOlder})`, async () => {
  const jobs = new Map<number, { release: () => void; signal: AbortSignal; previous?: number; sources: LectureSource[] }>();
  const s = service(async (input, signal) => {
    const revision = input.sources.at(-1)!.sequence;
    if (revision > 1) await new Promise<void>(resolve => jobs.set(revision, { release: resolve, signal, previous: input.previousSourceRevision, sources: input.sources }));
    if (revision === 2 && failOlder) throw new Error('Stale provider failure');
    return { summary: '', sections: [{ id: 'facts', title: 'Facts', points: input.sources.map(source => ({ text: source.text, sourceIds: [source.id] })) }], concepts: [], questions: [] };
  }, { concurrency: 2, liveSynthesisConcurrency: 2 });
  try {
    const lecture = await create(s); await append(s, lecture.id, 'First fact', '1');
    await until(() => get(s, lecture.id), value => value.synthesizedRevision === 1 && value.status === 'idle');
    await append(s, lecture.id, 'Second fact', '2'); await until(async () => jobs.has(2), Boolean);
    await append(s, lecture.id, 'Third fact', '3'); await until(async () => jobs.has(3), Boolean);
    expect(jobs.get(3)!.previous).toBe(1);
    expect(jobs.get(3)!.sources.map(source => source.sequence)).toEqual([1, 2, 3]);
    await append(s, lecture.id, 'Fourth fact', '4'); await Bun.sleep(10);
    expect(jobs.has(4)).toBe(false);
    await s.handle(api(`/${lecture.id}`, 'PATCH', { personalNotes: 'Keep my annotation' }));
    jobs.get(3)!.release();
    await until(() => get(s, lecture.id), value => value.synthesizedRevision === 3);
    await until(async () => jobs.has(4), Boolean);
    expect(jobs.get(2)!.signal.aborted).toBe(true);
    jobs.get(4)!.release();
    await until(() => get(s, lecture.id), value => value.synthesizedRevision === 4 && value.status === 'idle');
    jobs.get(2)!.release(); await Bun.sleep(10);
    const final = await get(s, lecture.id);
    expect(final.synthesizedRevision).toBe(4); expect(final.status).toBe('idle');
    expect(final.notes!.sections[0].points.map(point => point.text)).toEqual(['First fact', 'Second fact', 'Third fact', 'Fourth fact']);
    expect(final.personalNotes).toBe('Keep my annotation');
  } finally { for (const job of jobs.values()) job.release(); }
});

test('one live job failing does not fail a newer active job; full refresh stays serial', async () => {
  let fail!: () => void, finish!: () => void, refresh!: () => void;
  let calls = 0, refreshStarted = false;
  const s = service(async input => {
    calls++;
    if (input.previousNotes && input.previousSourceRevision === 0) { refreshStarted = true; await new Promise<void>(resolve => { refresh = resolve; }); }
    else if (input.sources.length === 2) { await new Promise<void>(resolve => { fail = resolve; }); throw new Error('One failed job'); }
    else if (input.sources.length === 3 && input.previousSourceRevision === 1) await new Promise<void>(resolve => { finish = resolve; });
    return { ...makeNotes(input.sources), summary: '', concepts: [] };
  }, { concurrency: 3, liveSynthesisConcurrency: 2 });
  try {
    const lecture = await create(s); await append(s, lecture.id, 'First fact', '1');
    await until(() => get(s, lecture.id), row => row.status === 'idle');
    await append(s, lecture.id, 'Second fact', '2'); await until(async () => !!fail, Boolean);
    await append(s, lecture.id, 'Third fact', '3'); await until(async () => !!finish, Boolean);
    fail(); await Bun.sleep(10);
    expect((await get(s, lecture.id)).status).toBe('processing');
    finish(); await until(() => get(s, lecture.id), row => row.synthesizedRevision === 3 && row.status === 'idle');
    await s.handle(api(`/${lecture.id}/synthesize`, 'POST'));
    await until(async () => refreshStarted, Boolean);
    const before = calls;
    await append(s, lecture.id, 'Fourth fact', '4'); await Bun.sleep(10);
    expect(calls).toBe(before);
    refresh();
    await until(() => get(s, lecture.id), row => row.synthesizedRevision === 4 && row.status === 'idle');
  } finally { fail?.(); finish?.(); refresh?.(); }
});

test('simultaneous live failures cannot strand processing with no workers', async () => {
  const release: (() => void)[] = [];
  const s = service(async input => {
    if (input.sources.length > 1) { await new Promise<void>(resolve => release.push(resolve)); throw new Error('Provider failed'); }
    return { ...makeNotes(input.sources), summary: '', concepts: [] };
  }, { concurrency: 2, liveSynthesisConcurrency: 2 });
  const lecture = await create(s); await append(s, lecture.id, 'First fact', '1');
  await until(() => get(s, lecture.id), row => row.status === 'idle');
  await append(s, lecture.id, 'Second fact', '2'); await until(async () => release.length, n => n === 1);
  await append(s, lecture.id, 'Third fact', '3'); await until(async () => release.length, n => n === 2);
  release.forEach(resolve => resolve());
  const final = await until(() => get(s, lecture.id), row => row.status === 'failed');
  expect(final.synthesizedRevision).toBe(1); expect(final.sourceRevision).toBe(3);
});

for (const simultaneous of [false, true]) test(`an older winner cancels stale baselines before replacing IDs or edits (simultaneous: ${simultaneous})`, async () => {
  const jobs: { revision: number; previous?: number; signal: AbortSignal; release: () => void }[] = [];
  const s = service(async (input, signal) => {
    const revision = input.sources.length;
    if (revision > 1) await new Promise<void>(resolve => jobs.push({ revision, previous: input.previousSourceRevision, signal, release: resolve }));
    const previous = input.previousNotes?.sections.find(section => section.title === 'New topic');
    return { summary: '', sections: [{ id: 'base', title: 'Base', points: [{ text: 'First fact', sourceIds: [input.sources[0].id] }] },
      ...(revision > 1 ? [{ id: previous?.id ?? `new-${revision}`, title: 'New topic', points: [{ text: 'New learning', sourceIds: [input.sources[1].id] }] }] : [])], concepts: [], questions: [] };
  }, { concurrency: 2, liveSynthesisConcurrency: 2 });
  try {
    const lecture = await create(s); await append(s, lecture.id, 'First fact', '1');
    await until(() => get(s, lecture.id), row => row.status === 'idle');
    await append(s, lecture.id, 'Second fact', '2'); await until(async () => jobs.length, n => n === 1);
    await append(s, lecture.id, 'Third fact', '3'); await until(async () => jobs.length, n => n === 2);
    jobs[0].release();
    if (simultaneous) jobs[1].release();
    await until(() => get(s, lecture.id), row => row.synthesizedRevision === 2);
    await s.handle(api(`/${lecture.id}`, 'PATCH', { noteEdits: { 'section:new-2': 'My section edit' } }));
    await until(async () => jobs.length, n => n === 3);
    expect(jobs[1].signal.aborted).toBe(true); expect(jobs[2].previous).toBe(2);
    jobs[1].release(); jobs[2].release();
    const final = await until(() => get(s, lecture.id), row => row.synthesizedRevision === 3 && row.status === 'idle');
    expect(final.notes!.sections[1].id).toBe('new-2'); expect(final.noteEdits?.['section:new-2']).toBe('My section edit');
  } finally { const closing = s.close(); jobs.forEach(job => job.release()); await closing; }
});

test('failed synthesis preserves successful notes, sanitizes errors and can retry', async () => {
  let fail = false;
  const s = service(async input => { if (fail) throw new Error('Authorization: Bearer private-token'); return makeNotes(input.sources); });
  const lecture = await create(s); await append(s, lecture.id);
  const initial = await until(() => get(s, lecture.id), row => row.status === 'idle' && row.synthesizedRevision === 1);
  fail = true; await append(s, lecture.id, 'A basis gives coordinates.', 'two');
  const failed = await until(() => get(s, lecture.id), row => row.status === 'failed');
  expect(failed.notes).toEqual(initial.notes); expect(failed.synthesizedRevision).toBe(1);
  expect(failed.error).not.toMatch(/Bearer|private-token/); expect(failed.sources).toHaveLength(2);
  fail = false; expect((await s.handle(api(`/${lecture.id}/synthesize`, 'POST'))).status).toBe(202);
  await until(() => get(s, lecture.id), row => row.status === 'idle' && row.synthesizedRevision === 2);
});

test('worker concurrency is bounded and deleting a lecture aborts its work without resurrection', async () => {
  let active = 0, peak = 0, aborted = 0;
  const s = service(async (input, signal) => { active++; peak = Math.max(peak, active);
    await new Promise<void>(resolve => signal.addEventListener('abort', () => { aborted++; active--; resolve(); }, { once: true }));
    return makeNotes(input.sources);
  }, { concurrency: 1 });
  const a = await create(s, 'a'), b = await create(s, 'b'); await append(s, a.id); await append(s, b.id);
  await until(async () => active, count => count === 1);
  expect((await s.handle(api(`/${a.id}`, 'DELETE'))).status).toBe(204);
  await until(async () => aborted, count => count === 1);
  await until(async () => active, count => count === 1);
  expect(peak).toBe(1); expect((await s.handle(api(`/${a.id}`))).status).toBe(404);
  await s.close(); expect(aborted).toBe(2);
});

test('restart resumes interrupted inference and retains source, personal notes and ownership', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'aha-lectures-'));
  let began = false;
  const s = new LectureService(join(dir, 'lecture.sqlite'), async (input, signal) => {
    began = true; await new Promise<void>(resolve => signal.addEventListener('abort', () => resolve(), { once: true })); return makeNotes(input.sources);
  }); services.push(s);
  try {
    const lecture = await create(s); await append(s, lecture.id);
    await s.handle(api(`/${lecture.id}`, 'PATCH', { personalNotes: 'My note' }));
    await until(async () => began, Boolean); await s.close();
    const resumed = new LectureService(join(dir, 'lecture.sqlite'), async input => makeNotes(input.sources)); services.push(resumed);
    const row = await until(() => get(resumed, lecture.id), row => row.status === 'idle');
    expect(row.sources).toHaveLength(1); expect(row.personalNotes).toBe('My note'); expect(row.synthesizedRevision).toBe(1);
    expect((await resumed.handle(api(`/${lecture.id}`, 'GET', undefined, 'bob'))).status).toBe(404);
    await resumed.close();
  } finally { await s.close(); await rm(dir, { recursive: true, force: true }); }
});

test('shutdown awaits cooperative visual cleanup before returning', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'aha-lecture-shutdown-'));
  let began = false, finish!: () => void;
  const finished = new Promise<void>(resolve => { finish = resolve; });
  const generate = createLectureVisualGenerator({ run: async task => {
    began = true;
    await new Promise<void>(resolve => task.signal!.addEventListener('abort', () => resolve(), { once: true }));
    await Bun.sleep(25); // Provider disposal can be asynchronous after cancellation.
    task.signal!.throwIfAborted();
    throw new Error('Unexpected completion');
  } }, directory);
  const s = service(async input => makeNotes(input.sources), { visualize: async (input, signal) => {
    try { return await generate(input, signal); } finally { finish(); }
  } });
  try {
    const lecture = await create(s); await append(s, lecture.id);
    await until(async () => began, Boolean);
    await s.close();
    expect(await readdir(join(directory, 'lectures'))).toEqual([]);
  } finally {
    await s.close();
    if (began) await finished;
    await rm(directory, { recursive: true, force: true });
  }
});

test('shutdown remains bounded when a provider ignores cancellation', async () => {
  let signal: AbortSignal | undefined;
  const s = service(async (_input, current) => { signal = current; return new Promise<LectureNotes>(() => {}); });
  const lecture = await create(s); await append(s, lecture.id);
  await until(async () => signal, Boolean);
  await s.close();
  expect(signal?.aborted).toBe(true);
  expect((await s.handle(api(`/${lecture.id}`))).status).toBe(503);
}, 10_000);

test('auto visualization is private, bounded to one new concept and keeps its source revision', async () => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const calls: string[] = [];
  const s = service(async input => { const notes = makeNotes(input.sources); notes.concepts.push({ ...notes.concepts[0], id: 'basis', title: 'Basis' }); return notes; }, {
    visualize: async (input, signal) => { calls.push(input.concept.id); await gate; signal.throwIfAborted(); return { source: 'export default scene({}, s => s.wait(1));', duration: 1, catalogIds: [] }; },
  });
  try {
    const lecture = await create(s); await append(s, lecture.id);
    await until(async () => calls.length, count => count === 1);
    const first = await get(s, lecture.id); expect(first.visualizations).toHaveLength(1);
    expect((await s.handle(api(`/${lecture.id}/concepts/vector/visualize`, 'POST'))).status).toBe(202);
    expect((await get(s, lecture.id)).visualizations).toHaveLength(1);
    await append(s, lecture.id, 'A basis determines coordinates.', 'two');
    release();
    const row = await until(() => get(s, lecture.id), row => row.synthesizedRevision === 2 && row.visualizations[0]?.status === 'ready');
    expect(row.visualizations).toHaveLength(1); expect(row.visualizations[0].sourceRevision).toBe(1);
    expect(calls).toEqual(['vector']);
    expect((await s.handle(api(`/${lecture.id}/concepts/basis/visualize`, 'POST', undefined, 'bob'))).status).toBe(404);
    await s.handle(api(`/${lecture.id}/concepts/basis/visualize`, 'POST'));
    await until(() => get(s, lecture.id), row => row.visualizations.filter(v => v.status === 'ready').length === 2);
    expect(calls).toEqual(['vector', 'basis']);
  } finally { release(); }
});

test('reject cross-origin writes, oversized input and unsupported capture before saving', async () => {
  const s = service(), lecture = await create(s);
  expect((await s.handle(new Request(`http://localhost/api/lectures/${lecture.id}`, { method: 'DELETE', headers: { Origin: 'https://evil.example', 'x-user-id': 'alice' } }))).status).toBe(403);
  expect((await s.handle(api(`/${lecture.id}/sources`, 'POST', { kind: 'audio', text: 'no' }, 'alice', 'x'))).status).toBe(400);
  expect((await append(s, lecture.id, 'x'.repeat(40001))).status).toBe(413);
  expect((await s.handle(api(`/${lecture.id}`, 'PATCH', { title: ' ' }))).status).toBe(400);
  expect((await get(s, lecture.id)).sources).toHaveLength(0);
});

test('stored source text retains its exact whitespace and rejects a changed retry', async () => {
  const s = service(), lecture = await create(s), text = '  def f(x):\n    return x * 2\n';
  await append(s, lecture.id, text);
  expect((await get(s, lecture.id)).sources[0].text).toBe(text);
  expect((await append(s, lecture.id, text.trim())).status).toBe(409);
});

test('captured source append is owner bounded and a short debounce coalesces a burst', async () => {
  const sizes: number[] = [];
  const s = service(async input => { sizes.push(input.sources.length); return makeNotes(input.sources); }, { synthesisDebounceMs: 30 });
  const lecture = await create(s);
  expect(() => s.appendSource('user:bob', lecture.id, 'denied', 'Private text')).toThrow('Not Found');
  for (let index = 0; index < 3; index++) {
    s.appendSource('user:alice', lecture.id, `capture-${index}`, `Vector fact ${index}`, { kind: 'audio', itemId: `item-${index}`, sequence: index,
      capturedAt: '2026-10-14T10:00:00.000Z', durationMs: 20_000 });
  }
  const done = await until(() => get(s, lecture.id), row => row.synthesizedRevision === 3);
  expect(sizes).toEqual([3]); expect(done.sources[0].capture?.kind).toBe('audio');
});

test('one blocked visual leaves capacity for fresh notes across lectures', async () => {
  let release!: () => void, activeVisuals = 0, peakVisuals = 0;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const s = service(async input => makeNotes(input.sources), { visualize: async () => {
    activeVisuals++; peakVisuals = Math.max(peakVisuals, activeVisuals);
    await gate; activeVisuals--; return { source: 'export default scene({}, s => s.wait(1));', duration: 1, catalogIds: [] };
  } });
  try {
    const a = await create(s, 'fair-a'), b = await create(s, 'fair-b');
    await append(s, a.id); await until(async () => activeVisuals, count => count === 1);
    await append(s, b.id); await until(() => get(s, b.id), row => row.synthesizedRevision === 1);
    await append(s, b.id, 'More vector facts.', 'second');
    await until(() => get(s, b.id), row => row.synthesizedRevision === 2);
    expect(peakVisuals).toBe(1);
  } finally { release(); }
});

test('queued visuals retain the concept and sources that requested them across newer synthesis', async () => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let began = false;
  const seen: { concept: string; refs: string[]; sources: string[] }[] = [];
  const s = service(async input => {
    if (input.sources.length === 1) { began = true; await gate; return makeNotes(input.sources); }
    const notes = makeNotes(input.sources); notes.concepts = [{ ...notes.concepts[0], id: 'basis', title: 'Basis', sourceIds: [input.sources[1].id] }]; return notes;
  }, { concurrency: 1, visualize: async input => {
    seen.push({ concept: input.concept.id, refs: input.concept.sourceIds, sources: input.sources.map(source => source.id) });
    return { source: 'export default scene({}, s => s.wait(1));', duration: 1, catalogIds: [] };
  } });
  try {
    const lecture = await create(s); await append(s, lecture.id); await until(async () => began, Boolean);
    await append(s, lecture.id, 'A basis determines coordinates.', 'two'); release();
    const row = await until(() => get(s, lecture.id), row => row.visualizations.length === 2 && row.visualizations.every(visual => visual.status === 'ready'));
    expect(seen).toEqual([
      { concept: 'vector', refs: [row.sources[0].id], sources: [row.sources[0].id] },
      { concept: 'basis', refs: [row.sources[1].id], sources: row.sources.map(source => source.id) },
    ]);
  } finally { release(); }
});

test('timeouts release capacity even when inference ignores cancellation, and late results are discarded', async () => {
  let release!: () => void, captured: AbortSignal | undefined;
  const late = new Promise<void>(resolve => { release = resolve; });
  let calls = 0;
  const s = service(async (input, signal) => { if (++calls === 1) { captured = signal; await late; } return makeNotes(input.sources); }, { concurrency: 1, synthesisTimeoutMs: 20 });
  try {
    const a = await create(s, 'a'), b = await create(s, 'b'); await append(s, a.id); await append(s, b.id);
    const failed = await until(() => get(s, a.id), row => row.status === 'failed');
    expect(captured?.aborted).toBe(true); expect(failed.sources).toHaveLength(1);
    await until(() => get(s, b.id), row => row.status === 'idle' && row.synthesizedRevision === 1);
    release(); await Bun.sleep(0);
    expect((await get(s, a.id)).notes).toBeNull(); expect((await get(s, a.id)).status).toBe('failed');
  } finally { release(); }
});

test('failed visualization refresh preserves the last working source and its original revision', async () => {
  let fail = false;
  const s = service(async input => makeNotes(input.sources), { visualize: async () => {
    if (fail) throw new Error('private visual provider detail');
    return { source: 'export default scene({}, s => s.wait(1));', duration: 1, catalogIds: [] };
  } });
  const lecture = await create(s); await append(s, lecture.id);
  const initial = await until(() => get(s, lecture.id), row => row.visualizations[0]?.status === 'ready');
  await append(s, lecture.id, 'Coordinates depend on the basis.', 'two');
  await until(() => get(s, lecture.id), row => row.synthesizedRevision === 2);
  fail = true; await s.handle(api(`/${lecture.id}/concepts/vector/visualize`, 'POST'));
  const failed = await until(() => get(s, lecture.id), row => row.visualizations[0]?.status === 'failed');
  expect(failed.visualizations[0].source).toBe(initial.visualizations[0].source);
  expect(failed.visualizations[0].sourceRevision).toBe(1);
  expect(failed.visualizations[0].error).not.toContain('private visual provider detail');
});

test('explicit visual regeneration preserves the working scene and coalesces active requests', async () => {
  let calls = 0, release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  const s = service(async input => makeNotes(input.sources), { visualize: async () => {
    calls++;
    if (calls === 2) await pending;
    return { source: `scene version ${calls}`, duration: 12, catalogIds: [] };
  } });
  try {
    const lecture = await create(s); await append(s, lecture.id);
    const initial = await until(() => get(s, lecture.id), row => row.visualizations[0]?.status === 'ready');
    const path = `/${lecture.id}/concepts/vector/visualize`;
    await s.handle(api(path, 'POST'));
    expect(calls).toBe(1);
    expect((await s.handle(api(path, 'POST', { regenerate: 'yes' }))).status).toBe(400);
    await s.handle(api(path, 'POST', { regenerate: true }));
    await until(() => get(s, lecture.id), row => row.visualizations[0]?.status === 'processing');
    expect((await get(s, lecture.id)).visualizations[0].source).toBe(initial.visualizations[0].source);
    await s.handle(api(path, 'POST', { regenerate: true }));
    expect(calls).toBe(2);
    release();
    const done = await until(() => get(s, lecture.id), row => row.visualizations[0]?.status === 'ready');
    expect(done.visualizations[0].source).toBe('scene version 2');
    expect(done.visualizations[0].stale).toBe(false);
    expect(done.notes).toEqual(initial.notes); expect(done.sources).toEqual(initial.sources);
  } finally { release(); }
});

test('visual regeneration retains lecture updates received while its request body streams', async () => {
  const s = service(async input => makeNotes(input.sources), { visualize: async () => ({ source: 'working scene', duration: 12, catalogIds: [] }) });
  const lecture = await create(s); await append(s, lecture.id);
  await until(() => get(s, lecture.id), row => row.visualizations[0]?.status === 'ready');
  let stream!: ReadableStreamDefaultController<Uint8Array>;
  const body = new ReadableStream<Uint8Array>({ start(controller) { stream = controller; controller.enqueue(new TextEncoder().encode('{"regenerate":')); } });
  const response = s.handle(new Request(`http://localhost/api/lectures/${lecture.id}/concepts/vector/visualize`, {
    method: 'POST', headers: { 'x-user-id': 'alice', 'Content-Type': 'application/json' }, body,
  }));
  await Bun.sleep(0);
  await append(s, lecture.id, 'New source during the request.', 'during-request');
  await until(() => get(s, lecture.id), row => row.synthesizedRevision === 2);
  stream.enqueue(new TextEncoder().encode('true}')); stream.close();
  expect((await response).status).toBe(202);
  const current = await get(s, lecture.id);
  expect(current.sources).toHaveLength(2);
  expect(current.sourceRevision).toBe(2);
  expect(current.synthesizedRevision).toBe(2);
});

test('automatic visual work has a session-wide bound without blocking newer notes', async () => {
  let generated = 0;
  const s = service(async input => {
    const notes = makeNotes(input.sources), sequence = input.sources.length;
    notes.concepts[0] = { ...notes.concepts[0], id: `concept-${sequence}`, title: `Concept ${sequence}` }; return notes;
  }, { visualize: async () => { generated++; return { source: 'export default scene({}, s => s.wait(1));', duration: 1, catalogIds: [] }; } });
  const lecture = await create(s);
  for (let i = 1; i <= 25; i++) {
    await append(s, lecture.id, `The next concept is ${i}.`, `source-${i}`);
    await until(() => get(s, lecture.id), row => row.synthesizedRevision === i && row.visualizations.every(visual => visual.status === 'ready'));
  }
  const row = await get(s, lecture.id); expect(row.visualizations).toHaveLength(24); expect(generated).toBe(24);
  expect(row.status).toBe('idle'); expect(row.notes?.concepts[0].id).toBe('concept-25');
  expect((await s.handle(api(`/${lecture.id}/concepts/concept-25/visualize`, 'POST'))).status).toBe(409);
});

test('notes parser accepts only actual immutable citation IDs and unique concept IDs', () => {
  const sources: LectureSource[] = [{ id: 'source-1', sequence: 1, kind: 'text', text: 'A vector has direction.', createdAt: new Date().toISOString() }];
  const good = makeNotes(sources);
  expect(parseLectureNotes(JSON.stringify(good), sources)).toEqual(good);
  expect(() => parseLectureNotes(JSON.stringify({ ...good, concepts: [good.concepts[0], good.concepts[0]] }), sources)).toThrow();
  good.sections[0].points[0].sourceIds = ['invented'];
  expect(() => parseLectureNotes(JSON.stringify(good), sources)).toThrow(/source/i);
  good.sections[0].points[0].sourceIds = [];
  expect(() => parseLectureNotes(JSON.stringify(good), sources)).toThrow(/source/i);
});

test('note synthesis supplies source grounding instructions and validates injected runner output', async () => {
  const sources: LectureSource[] = [{ id: 'source-1', sequence: 1, kind: 'text', text: 'Vectors have direction.', createdAt: new Date().toISOString() }];
  let prompt = '', system = '', web: boolean | undefined, catalog = false;
  const notes = await generateLectureNotes({ run: async task => { prompt = task.prompt; system = task.systemPrompt; web = task.allowWeb; catalog = !!task.catalogTools; return JSON.stringify(makeNotes(sources)); } },
    { title: 'Vectors', sources, previousNotes: null }, new AbortController().signal);
  expect(notes).toEqual(makeNotes(sources)); expect(prompt).toContain('source-1'); expect(system).toMatch(/summary/i); expect(system).toMatch(/untrusted/i);
  expect(web).toBe(false); expect(catalog).toBe(true);
});

test('incremental synthesis sends new text and existing cited notes without resending old transcript', async () => {
  const sources: LectureSource[] = [
    { id: 'old-source', sequence: 1, kind: 'text', text: 'OLD_RAW_TRANSCRIPT', createdAt: '' },
    { id: 'new-source', sequence: 2, kind: 'text', text: 'NEW_RAW_TRANSCRIPT', createdAt: '' },
  ];
  let prompt = '';
  const previousNotes = makeNotes(sources);
  const result = await generateLectureNotes({ run: async task => { prompt = task.prompt; return JSON.stringify(previousNotes); } },
    { title: 'Vectors', sources, previousNotes, previousSourceRevision: 1 }, new AbortController().signal);
  expect(prompt).toContain('NEW_RAW_TRANSCRIPT'); expect(prompt).not.toContain('OLD_RAW_TRANSCRIPT');
  expect(prompt).toContain('old-source'); expect(result.sections[0].points[0].sourceIds).toEqual(['old-source']);
});

test('live source arrivals cannot postpone notes forever', async () => {
  let calls = 0;
  const s = service(async input => { calls++; return makeNotes(input.sources); }, { synthesisDebounceMs: 50 });
  const lecture = await create(s);
  for (let i = 0; i < 8; i++) { await append(s, lecture.id, `Fact ${i}`, `fact-${i}`); await Bun.sleep(15); }
  expect(calls).toBeGreaterThan(0);
  await until(() => get(s, lecture.id), row => row.synthesizedRevision === 8);
});

test('large backlogs synthesize in bounded batches and advance coverage only after each success', async () => {
  const sizes: number[] = [];
  const s = service(async input => { sizes.push(input.sources.filter(source => source.sequence > (input.previousSourceRevision ?? 0)).length); return makeNotes(input.sources); }, { synthesisDebounceMs: 10 });
  const lecture = await create(s);
  for (let i = 0; i < 27; i++) s.appendSource('user:alice', lecture.id, `source-${i}`, `Fact ${i}`);
  const done = await until(() => get(s, lecture.id), row => row.synthesizedRevision === 27);
  expect(sizes).toEqual([12, 12, 3]); expect(done.sources).toHaveLength(27);
});

test('failed backlog batch preserves coverage, stops retrying, and resumes from that batch on request', async () => {
  let calls = 0, fail = true;
  const s = service(async input => {
    calls++;
    if (input.previousSourceRevision === 12 && fail) throw new Error('provider unavailable');
    return makeNotes(input.sources);
  }, { synthesisDebounceMs: 10 });
  const lecture = await create(s);
  for (let i = 0; i < 27; i++) s.appendSource('user:alice', lecture.id, `source-${i}`, `Fact ${i}`);
  const failed = await until(() => get(s, lecture.id), row => row.status === 'failed');
  expect(failed.synthesizedRevision).toBe(12); expect(failed.sources).toHaveLength(27);
  await Bun.sleep(40); expect(calls).toBe(2);
  fail = false; await s.handle(api(`/${lecture.id}/synthesize`, 'POST'));
  const done = await until(() => get(s, lecture.id), row => row.synthesizedRevision === 27);
  expect(done.status).toBe('idle'); expect(calls).toBe(4);
});

test('course reordering is exact, owned, guarded and persists positions', async () => {
  const s = service();
  const a = await create(s, 'order-a'), b = await create(s, 'order-b');
  expect(a.position).toBe(0); expect(b.position).toBe(1);
  expect((await s.handle(api('/reorder', 'POST', { lectureIds: [b.id, a.id] }))).status).toBe(200);
  expect((await (await s.handle(api())).json()).map((item: LectureSession) => item.id)).toEqual([b.id, a.id]);
  for (const ids of [[a.id], [a.id, a.id], [a.id, b.id, crypto.randomUUID()]]) expect((await s.handle(api('/reorder', 'POST', { lectureIds: ids }))).ok).toBe(false);
  expect((await s.handle(api('/reorder', 'POST', { lectureIds: [a.id, b.id] }, 'bob'))).status).toBe(409);
  const cross = api('/reorder', 'POST', { lectureIds: [a.id, b.id] }); cross.headers.set('origin', 'https://foreign.test');
  expect((await s.handle(cross)).status).toBe(403);
  expect((await get(s, b.id)).position).toBe(0);
  expect((await create(s, 'order-c')).position).toBe(2);
});

test('canvas drawings and visual positions persist independently and survive synthesis', async () => {
  const s = service(async input => makeNotes(input.sources)), lecture = await create(s);
  const canvas: import('../../shared/notebookCanvas').NotebookCanvasData = { marks: [{ id: 'arrow-1', kind: 'arrow', color: 'blue', points: [[10, 20], [90, 80]], text: '' }], offsets: { components: { x: 20, y: 30 } } };
  expect((await s.handle(api(`/${lecture.id}`, 'PATCH', { noteCanvas: { vectors: canvas } }))).status).toBe(200);
  await s.handle(api(`/${lecture.id}`, 'PATCH', { noteCanvas: { summary: { marks: [], offsets: {} } } }));
  expect((await get(s, lecture.id)).noteCanvas?.vectors).toEqual(canvas);
  expect((await s.handle(api(`/${lecture.id}`, 'PATCH', { noteCanvas: { vectors: canvas } }, 'bob'))).status).toBe(404);
  for (const invalid of [{ ...canvas, marks: [{ ...canvas.marks[0], kind: 'script' }] }, { ...canvas, offsets: { components: { x: null, y: 2 } } }, { ...canvas, marks: Array(301).fill(canvas.marks[0]) }]) {
    expect((await s.handle(api(`/${lecture.id}`, 'PATCH', { title: 'Bad canvas', noteCanvas: { vectors: invalid } }))).status).toBe(400);
  }
  expect((await get(s, lecture.id)).title).toBe(lecture.title);
  await append(s, lecture.id);
  const done = await until(() => get(s, lecture.id), row => row.status === 'idle');
  expect(done.noteCanvas?.vectors).toEqual(canvas);
});

test('note overrides merge, reset, reject malformed patches atomically and survive synthesis', async () => {
  const s = service(async input => makeNotes(input.sources)), lecture = await create(s);
  expect((await s.handle(api(`/${lecture.id}`, 'PATCH', { noteEdits: { summary: 'My summary', 'section:vectors': 'My bullets' } }))).status).toBe(200);
  expect((await s.handle(api(`/${lecture.id}`, 'PATCH', { title: 'Bad write', noteEdits: { bad: 'invalid' } }))).status).toBe(400);
  expect((await get(s, lecture.id)).title).toBe(lecture.title);
  await append(s, lecture.id);
  const done = await until(() => get(s, lecture.id), row => row.status === 'idle');
  expect(done.noteEdits).toEqual({ summary: 'My summary', 'section:vectors': 'My bullets' });
  await s.handle(api(`/${lecture.id}`, 'PATCH', { noteEdits: { summary: null } }));
  expect((await get(s, lecture.id)).noteEdits).toEqual({ 'section:vectors': 'My bullets' });
});

test('AI section identity and optional concept placement validate against supplied sections', () => {
  const sources: LectureSource[] = [{ id: 'source', sequence: 1, kind: 'text', text: 'Vectors', createdAt: '' }];
  const notes = makeNotes(sources);
  const placed = { ...notes, concepts: notes.concepts.map(c => ({ ...c, sectionId: 'vectors' })) };
  expect(parseLectureNotes(JSON.stringify(placed), sources).concepts[0].sectionId).toBe('vectors');
  expect(() => parseLectureNotes(JSON.stringify({ ...placed, concepts: placed.concepts.map(c => ({ ...c, sectionId: 'missing' })) }), sources)).toThrow();
  expect(() => parseLectureNotes(JSON.stringify({ ...notes, sections: notes.sections.map(s => ({ ...s, id: 'changed' })) }), sources, notes)).toThrow();
});

test('same-source note refresh marks visuals stale and preserves their playback mode until replacement succeeds', async () => {
  let kind: 'animation' | 'interactive' = 'animation', fail = false;
  const s = service(async input => {
    const notes = makeNotes(input.sources);
    notes.concepts[0].visualKind = kind;
    return notes;
  }, { visualize: async () => {
    if (fail) throw new Error('Cannot render');
    return { source: 'old-scene', duration: 12, catalogIds: [] };
  } });
  const lecture = await create(s); await append(s, lecture.id);
  await until(() => get(s, lecture.id), row => row.visualizations[0]?.status === 'ready');
  kind = 'interactive'; fail = true;
  await s.handle(api(`/${lecture.id}/synthesize`, 'POST'));
  const refreshed = await until(() => get(s, lecture.id), row => row.notes?.concepts[0].visualKind === 'interactive');
  expect(refreshed.visualizations[0].stale).toBe(true);
  expect(refreshed.visualizations[0].visualKind).toBe('animation');
  await s.handle(api(`/${lecture.id}/concepts/vector/visualize`, 'POST'));
  const failed = await until(() => get(s, lecture.id), row => row.visualizations[0]?.status === 'failed');
  expect(failed.visualizations[0].source).toBe('old-scene');
  expect(failed.visualizations[0].visualKind).toBe('animation');
  fail = false;
  await s.handle(api(`/${lecture.id}/concepts/vector/visualize`, 'POST'));
  const done = await until(() => get(s, lecture.id), row => row.visualizations[0]?.status === 'ready');
  expect(done.visualizations[0].visualKind).toBe('interactive');
  expect(done.visualizations[0].stale).toBe(false);
});

test('legacy notes refresh from all evidence and global instructions survive restart', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'aha-notes-format-')), file = join(directory, 'lectures.sqlite');
  const first = new LectureService(file, async input => makeNotes(input.sources)); services.push(first);
  try {
    const lecture = await create(first); await append(first, lecture.id);
    await until(() => get(first, lecture.id), row => row.synthesizedRevision === 1);
    await first.handle(api('/preferences', 'PATCH', { instructions: 'German, concise.' }));
    await first.close();
    const { Database } = await import('bun:sqlite'); const db = new Database(file);
    const legacy = JSON.parse((db.query('SELECT snapshot FROM lectures WHERE id = ?').get(lecture.id) as { snapshot: string }).snapshot);
    delete legacy.notesFormatVersion;
    legacy.notes.questions = [{ text: 'An old paraphrased question', sourceIds: [legacy.sources[0].id] }];
    db.query('UPDATE lectures SET snapshot = ? WHERE id = ?').run(JSON.stringify(legacy), lecture.id); db.close();
    let previousRevision: number | undefined, sourceCount = 0, instructions = '';
    const second = new LectureService(file, async input => {
      previousRevision = input.previousSourceRevision; sourceCount = input.sources.length; instructions = input.instructions ?? '';
      return makeNotes(input.sources);
    }); services.push(second);
    await append(second, lecture.id, 'A positive scalar preserves direction.', 'next');
    const done = await until(() => get(second, lecture.id), row => row.synthesizedRevision === 2 && row.status === 'idle');
    expect(previousRevision).toBe(0); expect(sourceCount).toBe(2);
    expect(instructions).toBe('German, concise.'); expect(done.notesFormatVersion).toBe(3);
    expect(done.notes?.questions).toEqual([]);
    await second.close();
  } finally { await first.close(); await rm(directory, { recursive: true, force: true }); }
});

test('ordering and overrides survive restart and legacy records append chronologically', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'aha-notebook-order-'));
  const file = join(directory, 'lectures.sqlite');
  const first = new LectureService(file); services.push(first);
  try {
    const a = await create(first, 'a'), b = await create(first, 'b');
    await first.handle(api('/reorder', 'POST', { lectureIds: [b.id, a.id] }));
    await first.handle(api(`/${a.id}`, 'PATCH', { noteEdits: { summary: 'Durable override' } }));
    await first.close();
    const second = new LectureService(file); services.push(second);
    expect((await (await second.handle(api())).json()).map((row: LectureSession) => row.id)).toEqual([b.id, a.id]);
    expect((await get(second, a.id)).noteEdits?.summary).toBe('Durable override');
    await second.close();
    const { Database } = await import('bun:sqlite'); const db = new Database(file);
    for (const row of db.query('SELECT id, snapshot FROM lectures').all() as { id: string; snapshot: string }[]) {
      const legacy = JSON.parse(row.snapshot); delete legacy.position;
      legacy.createdAt = row.id === a.id ? '2026-01-01T00:00:00Z' : '2026-01-02T00:00:00Z';
      db.query('UPDATE lectures SET snapshot = ? WHERE id = ?').run(JSON.stringify(legacy), row.id);
    }
    db.close();
    const third = new LectureService(file); services.push(third);
    expect((await (await third.handle(api())).json()).map((row: LectureSession) => row.id)).toEqual([a.id, b.id]);
    const appended = await create(third, 'c');
    expect(appended.position).toBe(2);
    expect((await (await third.handle(api())).json()).map((row: LectureSession) => row.id)).toEqual([a.id, b.id, appended.id]);
    await third.close();
  } finally { await first.close(); await rm(directory, { recursive: true, force: true }); }
});

test('course sets exclude unrelated and foreign lectures and malformed overrides never write', async () => {
  const s = service(), unassigned = await create(s);
  const course = await (await s.handle(api('', 'POST', { title: 'Course', courseId: 'math' }, 'alice', 'math'))).json() as LectureSession;
  expect(course.position).toBe(0);
  expect((await s.handle(api('/reorder', 'POST', { courseId: 'math', lectureIds: [course.id, unassigned.id] }))).status).toBe(409);
  expect((await s.handle(api('/reorder', 'POST', { courseId: 'math', lectureIds: [course.id] }))).status).toBe(200);
  for (const noteEdits of [[], { summary: 1 }, { summary: 'x'.repeat(40001) }, { 'section:Bad': 'text' }]) {
    expect((await s.handle(api(`/${course.id}`, 'PATCH', { title: 'Partial write', noteEdits }))).ok).toBe(false);
    expect((await get(s, course.id)).title).toBe('Course');
  }
});

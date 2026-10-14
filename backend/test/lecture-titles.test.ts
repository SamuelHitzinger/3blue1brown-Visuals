import { afterEach, expect, test } from 'bun:test';
import { LectureService } from '../src/lectures.js';
import type { LectureNotes, LectureSession, LectureSynthesizer } from '../../shared/lecture.js';

const services: LectureService[] = [];
afterEach(async () => { await Promise.all(services.splice(0).map(service => service.close())); });
const api = (path = '', method = 'GET', body?: unknown, owner = 'alice', key: string = crypto.randomUUID()) => new Request(`http://localhost/api/lectures${path}`, {
  method, headers: { 'x-user-id': owner, 'Idempotency-Key': key }, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});
const make = (synthesize?: LectureSynthesizer) => { const s = new LectureService(':memory:', synthesize); services.push(s); return s; };
const create = async (s: LectureService, body: unknown = {}, owner = 'alice', key?: string): Promise<LectureSession> => {
  const result = await s.handle(api('', 'POST', body, owner, key)); expect(result.status).toBe(201); return result.json();
};
const get = async (s: LectureService, id: string): Promise<LectureSession> => (await s.handle(api(`/${id}`))).json();
async function settled(s: LectureService, id: string, revision: number) {
  for (let i = 0; i < 200; i++) { const row = await get(s, id); if (row.synthesizedRevision === revision && row.status === 'idle') return row; await Bun.sleep(5); }
  throw new Error('Notes did not settle');
}
const notes: LectureSynthesizer = async input => ({ subtitle: 'Atoms', summary: 'Atoms contain nuclei.', sections: [{ id: 'atoms', title: 'Atomic structure', points: [{ text: 'Atoms contain nuclei.', sourceIds: [input.sources[0].id] }] }], concepts: [], questions: [] } as LectureNotes);
const append = (s: LectureService, id: string, key = crypto.randomUUID()) => s.handle(api(`/${id}/sources`, 'POST', { text: 'Atoms contain nuclei.' }, 'alice', key));

test('blank titles continue course numbering, isolate owners, and retry without allocating another number', async () => {
  const s = make();
  await create(s, { courseId: 'physics', title: 'Lecture 10: Matter' });
  await create(s, { courseId: 'math', title: 'Lecture 80: Vectors' });
  await create(s, { courseId: 'physics', title: 'Lecture 90: Other' }, 'bob');
  const a = await create(s, { courseId: 'physics' }, 'alice', 'same');
  expect(a.title).toBe('Lecture 11');
  expect((await create(s, { courseId: 'physics' }, 'alice', 'same')).id).toBe(a.id);
  expect((await create(s, { courseId: 'physics', title: '  ' })).title).toBe('Lecture 12');
  expect((await create(s)).title).toBe('Lecture 1');
});

test('subtitle appears only after finish and full synthesis, including late material', async () => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const s = make(async (input, signal) => { await gate; return notes(input, signal); });
  const lecture = await create(s);
  await append(s, lecture.id);
  expect((await get(s, lecture.id)).title).toBe('Lecture 1');
  const finishing = await s.handle(api(`/${lecture.id}/finish`, 'POST'));
  expect(finishing.status).toBe(202);
  expect((await finishing.json()).title).toBe('Lecture 1');
  release();
  const done = await settled(s, lecture.id, 1);
  expect(done.title).toBe('Lecture 1: Atoms');
  expect(done.finishedAt).toBeTruthy();
  await append(s, lecture.id);
  expect((await settled(s, lecture.id, 2)).title).toBe('Lecture 1: Atoms');
  expect((await s.handle(api(`/${lecture.id}/finish`, 'POST', undefined, 'bob'))).status).toBe(404);
});

test('manual titles survive completion and a rename during pending synthesis wins', async () => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const s = make(async (input, signal) => { await gate; return notes(input, signal); });
  const automatic = await create(s);
  const manual = await create(s, { title: 'My physics notes' });
  for (const lecture of [automatic, manual]) { await append(s, lecture.id); await s.handle(api(`/${lecture.id}/finish`, 'POST')); }
  await s.handle(api(`/${automatic.id}`, 'PATCH', { title: 'Lecture 1: My subtitle' }));
  release();
  expect((await settled(s, automatic.id, 1)).title).toBe('Lecture 1: My subtitle');
  expect((await settled(s, manual.id, 1)).title).toBe('My physics notes');
});

test('finishing empty lecture keeps generic title; finishing already synthesized notes adds subtitle immediately', async () => {
  const s = make(notes), empty = await create(s);
  expect((await s.handle(api(`/${empty.id}/finish`, 'POST'))).status).toBe(202);
  expect((await get(s, empty.id)).title).toBe('Lecture 1');
  const lecture = await create(s);
  await append(s, lecture.id); await settled(s, lecture.id, 1);
  expect((await get(s, lecture.id)).title).toBe('Lecture 2');
  await s.handle(api(`/${lecture.id}/finish`, 'POST'));
  expect((await get(s, lecture.id)).title).toBe('Lecture 2: Atoms');
});

test('removing a course moves only owner lectures, preserving material and stable independent order', async () => {
  const s = make(), existing = await create(s), a = await create(s, { courseId: 'physics' }), b = await create(s, { courseId: 'physics' });
  const other = await create(s, { courseId: 'physics' }, 'bob');
  await append(s, a.id);
  await s.handle(api(`/${a.id}`, 'PATCH', { personalNotes: 'Keep my notes' }));
  const response = await s.handle(api('/detach-course', 'POST', { courseId: 'physics' }));
  expect(response.status).toBe(200);
  const saved = await get(s, a.id);
  expect(saved.courseId).toBeUndefined(); expect(saved.sources).toHaveLength(1); expect(saved.personalNotes).toBe('Keep my notes');
  expect(saved.position).toBeGreaterThan(existing.position!);
  expect((await get(s, b.id)).position).toBeGreaterThan(saved.position!);
  expect((await (await s.handle(api(`/${other.id}`, 'GET', undefined, 'bob'))).json()).courseId).toBe('physics');
  expect((await s.handle(api('/detach-course', 'POST', { courseId: 'physics' }))).status).toBe(200);
  expect((await get(s, a.id)).position).toBe(saved.position);
  expect((await s.handle(api('/detach-course', 'POST', {}))).status).toBe(400);
  const stale = await s.handle(api('', 'POST', { courseId: 'physics' }));
  expect(stale.status).toBe(409);
  expect((await stale.json()).detail).toMatch(/deleted/i);
  expect((await create(s, { courseId: 'physics' }, 'bob')).courseId).toBe('physics');
});

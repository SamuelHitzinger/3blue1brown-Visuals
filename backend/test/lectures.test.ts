import { afterEach, expect, test } from 'bun:test';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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

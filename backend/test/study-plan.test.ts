import { expect, test } from 'bun:test';
import { parsePlanDocument, parseTopicPlan, generateStudyPlan, sourceMaterial, COURSE_CLASSIFICATION, MAX_TOPICS } from '../src/agents/study-plan.js';
import { loadPrompt } from '../src/agents/prompts.js';
import { studyPlanRoutes } from '../src/study-plans.js';

const document = { name: 'Lecture.pdf', pages: 2, lines: [
  { text: 'Vectors have magnitude and direction. A basis represents each vector by its coordinates along independent directions.', page: 1 },
  { text: 'A linear map preserves vector addition and scaling. Its matrix columns record the images of the basis vectors.', page: 2 },
] };
const topic = (id: string, page: number, requires: string[] = []) => ({ id, title: id, summary: 'Understand the concept', why_visual: 'Watch a vector transform', key_ideas: ['Coordinates'], requires, source_refs: `Page ${page}`, notes: `Condensed source notes for ${id}.` });
const output = () => ({ source_title: 'Linear algebra', audience: 'Beginners', assumed: ['Arithmetic'], topics: [topic('vectors', 1), topic('maps', 2, ['vectors'])] });

test('original topic schema adapts to app without claiming generated notes are source quotations', () => {
  const plan = parseTopicPlan(JSON.stringify(output()), parsePlanDocument(document));
  expect(plan.chapters[0].segments[1]).toMatchObject({ text: 'Condensed source notes for maps.', sourceReference: 'Page 2', sourceKind: 'notes', requires: ['vectors'] });
  expect(plan.chapters[0].segments[1].pageStart).toBeUndefined();
  expect(plan.sourceName).toBe(document.name);
  expect(plan.originalText).toBe(sourceMaterial(document));
});

test('reject missing notes/references, forward/self dependencies, duplicate IDs and empty topics', () => {
  for (const mutate of [
    (v: ReturnType<typeof output>) => { v.topics[0].notes = ''; },
    (v: ReturnType<typeof output>) => { v.topics[0].source_refs = ''; },
    (v: ReturnType<typeof output>) => { v.topics[0].requires = ['maps']; },
    (v: ReturnType<typeof output>) => { v.topics[0].requires = ['vectors']; },
    (v: ReturnType<typeof output>) => { v.topics[1].id = 'vectors'; },
    (v: ReturnType<typeof output>) => { v.topics = []; },
  ]) { const value = output(); mutate(value); expect(() => parseTopicPlan(JSON.stringify(value), document)).toThrow(); }
});

test('reject malformed input before model work', async () => {
  expect(() => parsePlanDocument({ ...document, lines: [{ text: 42 }] })).toThrow();
  expect(() => parsePlanDocument({ ...document, lines: [{ text: ' ' }] })).toThrow();
  let called = false;
  const route = studyPlanRoutes(() => { called = true; throw new Error('should not run'); });
  expect((await route(new Request('http://localhost/api/study-plans', { method: 'POST', body: '{}' }))).status).toBe(400);
  expect((await route(new Request('http://localhost/api/study-plans', { method: 'POST', body: 'x'.repeat(2000001) }))).status).toBe(400);
  expect(called).toBe(false);
});

test('course planning accepts source text and line counts above the former limits', async () => {
  const paragraph = 'Vectors preserve direction. '.repeat(80_000);
  const material = { name: 'Long lecture', lines: [{ text: paragraph }, ...Array.from({ length: 20_001 }, () => ({ text: 'A basis describes coordinates.' }))] };
  expect(parsePlanDocument(material).lines).toEqual(material.lines);
  const route = studyPlanRoutes(() => ({ run: async task => {
    expect(task.prompt).toContain(paragraph);
    return JSON.stringify(output());
  } }));
  const response = await route(new Request('http://localhost/api/study-plans', { method: 'POST', body: JSON.stringify(material) }));
  expect(response.status).toBe(200);
  expect((await response.json()).originalText).toBe(sourceMaterial(material));
});

test('model receives the original prompts plus course grouping requirements, final response validated again', async () => {
  const plan = await generateStudyPlan({ run: async task => {
    expect(task.systemPrompt).toBe(await loadPrompt('topics-system'));
    expect(task.prompt).toBe((await loadPrompt('topics-format')).replace('{max_topics}', String(MAX_TOPICS)) + '\n\n' + COURSE_CLASSIFICATION + '\n\nSOURCE MATERIAL:\n<<<\n' + sourceMaterial(document) + '\n>>>');
    await expect(task.validate!('{}')).rejects.toThrow();
    return JSON.stringify(output());
  } }, document, new AbortController().signal);
  expect(plan.chapters[0].segments.length).toBe(2);
  let calls = 0;
  const recovered = await generateStudyPlan({ run: async () => ++calls === 1 ? '{}' : JSON.stringify(output()) }, document, new AbortController().signal);
  expect(calls).toBe(2); expect(recovered.chapters).toEqual(plan.chapters);
});

test('endpoint bounds concurrency and sanitizes provider failures', async () => {
  const previous = process.env.VIDEO_GENERATOR;
  delete process.env.VIDEO_GENERATOR;
  try {
    let finish!: () => void;
    const pending = new Promise<void>(resolve => { finish = resolve; });
    const route = studyPlanRoutes(() => ({ run: async () => { await pending; throw new Error('secret provider token'); } }));
    const req = () => new Request('http://localhost/api/study-plans', { method: 'POST', body: JSON.stringify(document) });
    const one = route(req()), two = route(req());
    expect((await route(req())).status).toBe(429);
    finish();
    for (const result of await Promise.all([one, two])) { expect(result.status).toBe(503); expect(await result.text()).not.toContain('secret'); }
    expect((await route(new Request('http://localhost/api/study-plans'))).status).toBe(405);
  } finally { if (previous === undefined) delete process.env.VIDEO_GENERATOR; else process.env.VIDEO_GENERATOR = previous; }
});

test('long single-line lectures remain intact and work with the original notes response', () => {
  const paragraph = 'Vectors retain their meaning and coordinates throughout a linear transformation. '.repeat(800);
  const normalized = parsePlanDocument({ name: 'notes', pages: 1, lines: [{ text: paragraph, page: 1 }] });
  expect(normalized.lines.map(l => l.text).join('')).toBe(paragraph);
  expect(normalized.lines).toEqual([{ text: paragraph, page: 1 }]);
  expect(parseTopicPlan(JSON.stringify(output()), normalized).originalText).toBe('[Page 1]\n' + paragraph);
});


test('AI classifications group focused video lessons into distinct course topics', () => {
  const value = { ...output(), topics: [
    { ...topic('vectors', 1), group: 'Vectors', minutes: 2 },
    { ...topic('bases', 1, ['vectors']), group: 'Vectors', minutes: 3 },
    { ...topic('maps', 2, ['bases']), group: 'Linear maps', minutes: 5 },
  ] };
  const plan = parseTopicPlan(JSON.stringify(value), document);
  expect(plan.chapters.map(c => [c.title, c.segments.length])).toEqual([['Vectors', 2], ['Linear maps', 1]]);
  expect(plan.chapters[1].segments[0].minutes).toBe(5);
  value.topics[2].minutes = 12;
  expect(() => parseTopicPlan(JSON.stringify(value), document)).toThrow('2–5 minute');
  value.topics[2].minutes = 4;
  value.topics[1].group = 'Linear maps';
  value.topics[2].group = 'Vectors';
  expect(() => parseTopicPlan(JSON.stringify(value), document)).toThrow('teaching order');
});

test('async planning returns before inference finishes and survives upload disconnects', async () => {
  let finish!: () => void;
  const pending = new Promise<void>(resolve => { finish = resolve; });
  const controller = new AbortController();
  let taskSignal: AbortSignal | undefined;
  let began!: () => void;
  const started = new Promise<void>(resolve => { began = resolve; });
  const route = studyPlanRoutes(() => ({ run: async task => { taskSignal = task.signal; began(); await pending; return JSON.stringify(output()); } }));
  const accepted = await route(new Request('http://localhost/api/study-plans', { method: 'POST', headers: { Prefer: 'respond-async', 'x-user-id': 'alice' }, body: JSON.stringify(document), signal: controller.signal }));
  expect(accepted.status).toBe(202);
  const { id } = await accepted.json();
  const url = `http://localhost/api/study-plans/${id}`;
  controller.abort();
  await started;
  expect(taskSignal?.aborted).toBe(false);
  expect((await route(new Request(url, { headers: { 'x-user-id': 'alice' } }))).status).toBe(202);
  expect((await route(new Request(url, { headers: { 'x-user-id': 'bob' } }))).status).toBe(404);
  expect((await route(new Request(url, { method: 'DELETE', headers: { 'x-user-id': 'bob' } }))).status).toBe(404);
  finish(); await Bun.sleep(0);
  const result = await route(new Request(url, { headers: { 'x-user-id': 'alice' } }));
  expect(result.status).toBe(200);
  expect((await result.json()).chapters[0].segments).toHaveLength(2);
});

test('async cancellation reaches the model and releases capacity; results expire', async () => {
  let startedCount = 0, abortedCount = 0, bothStarted!: () => void;
  const started = new Promise<void>(resolve => { bothStarted = resolve; });
  const route = studyPlanRoutes(() => ({ run: async task => new Promise((_resolve, reject) => {
    task.signal!.addEventListener('abort', () => { abortedCount++; reject(task.signal!.reason); }, { once: true });
    if (++startedCount === 2) bothStarted();
  }) }));
  const req = () => new Request('http://localhost/api/study-plans', { method: 'POST', headers: { Prefer: 'respond-async' }, body: JSON.stringify(document) });
  const a = await (await route(req())).json(), b = await (await route(req())).json();
  expect((await route(req())).status).toBe(429);
  await started; // Prompt file reads must finish before testing cancellation inside the model.
  for (const job of [a, b]) expect((await route(new Request(`http://localhost/api/study-plans/${job.id}`, { method: 'DELETE' }))).status).toBe(204);
  expect(abortedCount).toBe(2);
  let c!: Response;
  for (let i = 0; i < 100; i++) {
    c = await route(req());
    if (c.status !== 429) break;
    await Bun.sleep(1);
  }
  expect(c.status).toBe(202);
  await route(new Request(`http://localhost/api/study-plans/${(await c.json()).id}`, { method: 'DELETE' }));
  let now = 0;
  const expiring = studyPlanRoutes(() => ({ run: async () => JSON.stringify(output()) }), { now: () => now, resultTtlMs: 10 });
  const accepted = await (await expiring(req())).json();
  let completed: Response;
  for (let i = 0; ; i++) {
    completed = await expiring(new Request(`http://localhost/api/study-plans/${accepted.id}`));
    if (completed.status !== 202 || i >= 100) break;
    await Bun.sleep(1);
  }
  expect(completed.status).toBe(200);
  now = 11;
  expect((await expiring(new Request(`http://localhost/api/study-plans/${accepted.id}`))).status).toBe(404);
});

test('background jobs time out without leaving the planner busy forever', async () => {
  const route = studyPlanRoutes(() => ({ run: async task => new Promise((_resolve, reject) => {
    task.signal!.addEventListener('abort', () => reject(task.signal!.reason), { once: true });
  }) }), { jobTimeoutMs: 20 });
  const accepted = await route(new Request('http://localhost/api/study-plans', { method: 'POST', headers: { Prefer: 'respond-async' }, body: JSON.stringify(document) }));
  const { id } = await accepted.json();
  await Bun.sleep(30);
  const result = await route(new Request(`http://localhost/api/study-plans/${id}`));
  expect(result.status).toBe(408);
});

test('short formulas are valid material, while empty source is rejected', () => {
  expect(parsePlanDocument({ name: 'Screenshot', lines: [{ text: 'AᵀA x = Aᵀb' }] }).lines).toHaveLength(1);
  expect(() => parsePlanDocument({ name: 'Empty', lines: [{ text: '  ' }] })).toThrow();
});

import test from 'node:test'
import assert from 'node:assert/strict'
import { topicLessonText } from '../src/studyPlanClient.ts'
import type { StudyPlan } from '../src/plan.ts'

test('topic handoff preserves source notes without asserting mastery of earlier topics', () => {
  const plan: StudyPlan = { version: 1, title: 'Course', sourceName: 'lecture.pdf', chapters: [{ id: 'c', title: 'Chapter', segments: [
    { id: 'basis', title: 'Basis vectors', text: 'Original basis text.', minutes: 3 },
    { id: 'maps', title: 'Maps', text: 'Original map text.', minutes: 4, summary: 'Understand a map', whyVisual: 'Transform a grid', keyIdeas: ['Linearity'], requires: ['basis'], sourceReference: 'Pages 2–3', sourceKind: 'notes' },
  ] }] }
  assert.equal(topicLessonText(plan.chapters[0].segments[0], plan), 'Original basis text.')
  const packet = topicLessonText(plan.chapters[0].segments[1], plan)
  assert.equal(packet, 'From: Course (Pages 2–3)\n\nSummary: Understand a map\n\nWhat makes it visual: Transform a grid\n\nKey ideas, in order:\n- Linearity\n\nSource notes:\nOriginal map text.\n\nEarlier planned topics (coverage is not proof of understanding; reactivate needed ideas): Basis vectors')
})

const completed: StudyPlan = { version: 1, title: 'Linear algebra', sourceName: 'Notes', chapters: [{ id: 'vectors', title: 'Vectors', segments: [{ id: 'basis', title: 'Basis', text: 'Coordinates describe a vector.', minutes: 3 }] }] }
const jobId = '11111111-1111-4111-8111-111111111111'
const accepted = () => Response.json({ id: jobId, stage: 'reading' }, { status: 202 })

test('poll the same background job through gateway interruptions without reuploading', async t => {
  const { waitForStudyPlan } = await import('../src/studyPlanClient.ts')
  const replies = [new Response('<h1>Gateway timeout</h1>', { status: 504 }), Response.json({ id: jobId, stage: 'planning' }, { status: 202 }), Response.json(completed)]
  const calls: string[] = [], progress: string[] = []
  t.mock.method(globalThis, 'fetch', async (path: string, options: RequestInit) => {
    assert.equal(options.method, undefined)
    calls.push(path)
    return replies.shift()!
  })
  const plan = await waitForStudyPlan(accepted(), new AbortController().signal, message => progress.push(message), 0)
  assert.deepEqual(plan, completed)
  assert.deepEqual(calls, Array(3).fill(`/api/study-plans/${jobId}`))
  assert.ok(progress.some(message => message.startsWith('Creating your topics')))
})

test('cancelling a pending plan cancels the server job', async t => {
  const { waitForStudyPlan } = await import('../src/studyPlanClient.ts')
  const controller = new AbortController(), methods: string[] = []
  t.mock.method(globalThis, 'fetch', async (_path: string, options: RequestInit) => {
    methods.push(options.method ?? 'GET')
    if (options.method === 'DELETE') return new Response(null, { status: 204 })
    controller.abort()
    return accepted()
  })
  await assert.rejects(waitForStudyPlan(accepted(), controller.signal, undefined, 0), { name: 'AbortError' })
  assert.deepEqual(methods, ['GET', 'DELETE'])
})

test('real planning errors remain actionable and do not retry the model request', async t => {
  const { waitForStudyPlan } = await import('../src/studyPlanClient.ts')
  let calls = 0
  t.mock.method(globalThis, 'fetch', async () => {
    calls++
    return Response.json({ detail: 'The course planner needs its server AI connection restored.' }, { status: 503 })
  })
  await assert.rejects(waitForStudyPlan(accepted(), new AbortController().signal, undefined, 0), /AI connection restored/)
  assert.equal(calls, 1)
})

test('screenshots and notes are submitted together with background processing requested', async t => {
  const { requestMaterialPlan } = await import('../src/studyPlanClient.ts')
  const screenshot = new File(['png bytes'], 'Screenshot.png', { type: 'image/png' })
  t.mock.method(globalThis, 'fetch', async (path: string, options: RequestInit) => {
    assert.equal(path, '/api/study-plans')
    assert.equal(new Headers(options.headers).get('Prefer'), 'respond-async')
    const body = options.body as FormData
    assert.equal(body.get('text'), 'Explain these equations')
    assert.equal((body.get('files') as File).name, screenshot.name)
    return Response.json(completed)
  })
  assert.deepEqual(await requestMaterialPlan({ name: 'Algebra', files: [screenshot], text: 'Explain these equations' }, new AbortController().signal), completed)
})

test('topic handoff carries learner assumptions as assumptions, even for a manual outline', () => {
  const plan: StudyPlan = { ...completed, audience: 'New to vectors', assumed: ['Arithmetic'] };
  const packet = topicLessonText(plan.chapters[0].segments[0], plan);
  assert.match(packet, /New to vectors/);
  assert.match(packet, /Arithmetic/);
  assert.match(packet, /assumptions/i);
  assert.match(packet, /Coordinates describe a vector/);
});

test('empty manual lesson includes its outline context alongside learner assumptions', () => {
  const plan: StudyPlan = { ...completed, audience: 'Biology newcomer' };
  const topic = { id: 'transport', title: 'Transport', text: '' };
  const fallback = 'Explain Transport in Cell membranes, Biology. Only a chapter outline was provided.';
  const packet = topicLessonText(topic, plan, fallback);
  assert.match(packet, /Biology newcomer/);
  assert.match(packet, /Cell membranes/);
  assert.match(packet, /Only a chapter outline was provided/);
});

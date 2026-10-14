import test from 'node:test'
import assert from 'node:assert/strict'
import { appendLectureSource, createLecture, deleteLecture, lectureMarkdown, mergeLectureSnapshot, patchLecture, lecturePending, hasLectureVisual, sourceRequestKey, watchLectureSnapshots } from '../src/lectures.ts'
import type { LectureSession } from '../../../shared/lecture.ts'

const session = (revision = 1): LectureSession => ({ schemaVersion: 1, id: 'lecture-1', title: 'Linear maps', createdAt: '2026-10-14T10:00:00Z', updatedAt: '2026-10-14T10:00:00Z', revision, sourceRevision: 1, synthesizedRevision: 1, status: 'idle', sources: [{ id: 'source-1', sequence: 1, kind: 'text', text: 'A linear map preserves sums.', createdAt: '2026-10-14T10:00:00Z' }], notes: { summary: 'Maps preserve structure.', sections: [{ id: 'section', title: 'Linearity', points: [{ text: 'Sums are preserved.', sourceIds: ['source-1'] }] }], concepts: [], questions: [{ text: 'What changes under a shear?', sourceIds: ['source-1'] }] }, personalNotes: 'Ask about inverses.', visualizations: [] })

test('late snapshots cannot roll back a newer lecture or cross session identities', () => {
  const current = session(4)
  assert.equal(mergeLectureSnapshot(current, session(3)), current)
  assert.equal(mergeLectureSnapshot(current, session(4)), current)
  assert.equal(mergeLectureSnapshot(current, { ...session(9), id: 'other' }), current)
  assert.equal(mergeLectureSnapshot(current, session(5)).revision, 5)
})

test('polling includes queued visualizations even when notes have finished', () => {
  const ready = session()
  assert.equal(lecturePending(ready), false)
  assert.equal(lecturePending({ ...ready, status: 'processing' }), true)
  assert.equal(lecturePending({ ...ready, visualizations: [{ id: 'visual', conceptId: 'concept', title: 'A map', sourceRevision: 1, status: 'queued', catalogIds: [] }] }), true)
  assert.equal(lecturePending({ ...ready, status: 'failed' }), false)
})

test('a prior animation remains playable while its replacement is pending or failed', () => {
  const visual = { id: 'visual', conceptId: 'concept', title: 'A map', sourceRevision: 1, status: 'processing' as const, source: 'export default scene({});', catalogIds: [] }
  assert.equal(hasLectureVisual(visual), true)
  assert.equal(hasLectureVisual({ ...visual, status: 'failed' }), true)
  assert.equal(hasLectureVisual({ ...visual, source: undefined }), false)
})

test('uncertain source submissions reuse their key across remounts without normalizing source text', () => {
  const data = new Map<string, string>()
  const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value) } }
  const original = '\n  f(x) = x²\n    preserves indentation\n'
  const first = sourceRequestKey(storage, 'lecture', original)
  assert.equal(sourceRequestKey(storage, 'lecture', original), first)
  assert.notEqual(sourceRequestKey(storage, 'lecture', original + 'A new passage'), first)
})

test('Markdown export keeps generated notes, personal notes and traceable original sources', () => {
  const markdown = lectureMarkdown(session())
  assert.match(markdown, /^# Linear maps/)
  assert.match(markdown, /Sums are preserved\. \[\^source-1\]/)
  assert.match(markdown, /## My notes\n\nAsk about inverses\./)
  assert.match(markdown, /\[\^source-1\]: A linear map preserves sums\./)
  assert.match(markdown, /What changes under a shear\?/)
})

test('creation and append send stable idempotency keys; patch changes only requested fields', async () => {
  const original = globalThis.fetch
  const calls: { url: string; options: RequestInit }[] = []
  globalThis.fetch = async (url, options = {}) => { calls.push({ url: String(url), options }); return Response.json(session()) }
  try {
    await createLecture({ title: 'Linear maps', courseId: 'algebra' }, 'create-once')
    await appendLectureSource('lecture/1', '\n  Source material\n', 'append-once')
    await patchLecture('lecture-1', { personalNotes: 'Keep this draft' })
    assert.equal(calls[0].url, '/api/lectures')
    assert.equal((calls[0].options.headers as Record<string, string>)['Idempotency-Key'], 'create-once')
    assert.equal(calls[1].url, '/api/lectures/lecture%2F1/sources')
    assert.equal((calls[1].options.headers as Record<string, string>)['Idempotency-Key'], 'append-once')
    assert.deepEqual(JSON.parse(calls[1].options.body as string), { text: '\n  Source material\n', kind: 'text' })
    assert.deepEqual(JSON.parse(calls[2].options.body as string), { personalNotes: 'Keep this draft' })
  } finally { globalThis.fetch = original }
})

test('service failures remain actionable and delete accepts an empty 204 response', async () => {
  const original = globalThis.fetch
  try {
    globalThis.fetch = async () => Response.json({ detail: 'Your material is saved. Try again.' }, { status: 503 })
    await assert.rejects(patchLecture('lecture-1', { personalNotes: 'draft' }), /Your material is saved/)
    globalThis.fetch = async () => new Response(null, { status: 204 })
    await deleteLecture('lecture-1')
  } finally { globalThis.fetch = original }
})

test('visible idle lectures discover phone additions; hidden tabs wait until visible', async t => {
  const original = { fetch: globalThis.fetch, window: globalThis.window, document: globalThis.document }
  const window = new EventTarget(), document = Object.assign(new EventTarget(), { visibilityState: 'visible' })
  Object.assign(globalThis, { window, document })
  t.mock.timers.enable({ apis: ['setInterval'] })
  let calls = 0
  const revisions: number[] = []
  globalThis.fetch = async () => Response.json(session(++calls))
  const stop = watchLectureSnapshots('lecture-1', next => revisions.push(next.revision), () => {})
  const settle = () => new Promise(resolve => setImmediate(resolve))
  try {
    await settle(); assert.deepEqual(revisions, [1])
    t.mock.timers.tick(3000); await settle(); assert.deepEqual(revisions, [1, 2])
    document.visibilityState = 'hidden'
    t.mock.timers.tick(6000); await settle(); assert.equal(calls, 2)
    document.visibilityState = 'visible'; document.dispatchEvent(new Event('visibilitychange'))
    await settle(); assert.deepEqual(revisions, [1, 2, 3])
    stop(); t.mock.timers.tick(3000); await settle(); assert.equal(calls, 3)
  } finally { stop(); Object.assign(globalThis, original); t.mock.timers.reset() }
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { mergeVideoLessons, videoLesson } from '../src/videos.ts'
import type { VideoManifest } from '../../../shared/video/contract.ts'

const manifest = (id = 'video-1'): VideoManifest => ({
  schemaVersion: 1, id, title: 'Convergent sequences', revision: 2,
  status: 'complete', provider: 'simulated', createdAt: '2026-10-10T00:00:00Z',
  scenes: [{ id: 'scene-1', index: 0, source: '', duration: 6, audio: { id: 'audio-1', url: '/audio.wav' }, captions: [] }],
})

test('archive survives stale polling while generation data continues to refresh', () => {
  const video = { ...manifest(), archivedAt: '2026-10-11T10:00:00.000Z' }
  const archived = videoLesson(video)
  assert.equal(archived.archivedAt, video.archivedAt)
  const stale = { ...manifest(), status: 'generating' as const }
  const [updated] = mergeVideoLessons([stale], [archived])
  assert.equal(updated.archivedAt, video.archivedAt)
  assert.equal(updated.generationStatus, 'generating')
  assert.equal(mergeVideoLessons([video], [])[0].archivedAt, video.archivedAt)
})

test('archiving uses the archive endpoint without deleting the video', async () => {
  const { archiveVideo } = await import('../src/videos.ts')
  const original = globalThis.fetch
  const video = { ...manifest(), archivedAt: '2026-10-11T10:00:00.000Z' }
  globalThis.fetch = async (url, options) => {
    assert.equal(url, '/api/videos/video-1/archive')
    assert.equal(options?.method, 'POST')
    return Response.json(video)
  }
  try { assert.deepEqual(await archiveVideo('video-1'), video) }
  finally { globalThis.fetch = original }
})

test('failed archive and permanent delete requests report failure; a missing video is already deleted', async () => {
  const { archiveVideo, deleteVideo } = await import('../src/videos.ts')
  const original = globalThis.fetch
  try {
    globalThis.fetch = async () => Response.json({ detail: 'Try again' }, { status: 503 })
    await assert.rejects(archiveVideo('video-1'), /Try again/)
    await assert.rejects(deleteVideo('video-1'), /Try again/)
    globalThis.fetch = async (url, options) => {
      assert.equal(url, '/api/videos/video-1')
      assert.equal(options?.method, 'DELETE')
      return new Response(null, { status: 404 })
    }
    await deleteVideo('video-1')
  } finally { globalThis.fetch = original }
})

test('server refresh preserves curriculum context and updates measured duration', () => {
  const video = manifest()
  const previous = { ...videoLesson(video), videoMode: 'interactive' as const, subject: 'Analysis', subtitle: 'Sequences', color: 'blue', duration: 0,
    artwork: 'idea' as const, source: { name: 'Lecture.pdf', chapter: 'Sequences', text: 'The original course material.' },
    courseLesson: { subjectId: 'analysis', materialId: 'material-1', chapterId: 'chapter-1', lessonId: 'lesson-1' } }
  const [updated] = mergeVideoLessons([video], [previous])
  assert.equal(updated.videoId, video.id)
  assert.equal(updated.duration, 6)
  assert.equal(updated.subject, 'Analysis')
  assert.equal(updated.subtitle, 'Sequences')
  assert.equal(updated.artwork, 'idea')
  assert.equal(updated.videoMode, 'interactive')
  assert.deepEqual(updated.source, previous.source)
  assert.deepEqual(updated.courseLesson, previous.courseLesson)
})

test('a list response does not erase a just-created job or older local previews', () => {
  const earlier = manifest('earlier'), created = videoLesson(manifest('just-created'))
  const local = { ...videoLesson(manifest('local')), videoId: undefined }
  const merged = mergeVideoLessons([earlier], [created, local, videoLesson(earlier)], [created.id])
  assert.deepEqual(merged.map(lesson => lesson.id), ['earlier', 'just-created', 'local'])
  assert.equal(new Set(merged.map(lesson => lesson.id)).size, merged.length)
  assert.equal(mergeVideoLessons([earlier], [])[0].subject, 'My ideas')
})

test('authoritative refresh removes deleted server videos and reflects generation status', () => {
  const removed = videoLesson(manifest('deleted'))
  const running = { ...manifest('running'), status: 'generating' as const, provider: 'pi' as const }
  const merged = mergeVideoLessons([running], [removed])
  assert.deepEqual(merged.map(lesson => lesson.id), ['running'])
  assert.equal(merged[0].generationStatus, 'generating')
  assert.equal(merged[0].demo, false)
  assert.equal(merged[0].subtitle, 'Visual explanation')
})

test('workspace sends actual upload bytes with JSON metadata and an idempotency key', async () => {
  const { requestVideo } = await import('../src/videos.ts')
  const original = globalThis.fetch
  globalThis.fetch = async (url, options) => {
    assert.equal(url, '/api/videos')
    assert.equal((options!.headers as Record<string, string>)['Idempotency-Key'], 'upload-key')
    assert.equal((options!.headers as Record<string, string>)['Content-Type'], undefined)
    const body = options!.body as FormData
    assert.deepEqual(JSON.parse(body.get('request') as string), { title: 'Topic', topic: 'Explain this page.', documents: [], videoMode: 'interactive' })
    assert.equal((body.get('files') as File).name, 'page.png')
    assert.equal(await (body.get('files') as File).text(), 'image pixels')
    return Response.json({ ...manifest(), provider: 'pi', status: 'queued', scenes: [] })
  }
  try { await requestVideo({ title: 'Topic', topic: 'Explain this page.', documents: [], videoMode: 'interactive' }, 'upload-key', [new File(['image pixels'], 'page.png')]) }
  finally { globalThis.fetch = original }
})

test('text-only workspace requests include the selected video mode', async () => {
  const { requestVideo } = await import('../src/videos.ts')
  const original = globalThis.fetch
  const received: string[] = []
  globalThis.fetch = async (_url, options) => {
    assert.equal((options!.headers as Record<string, string>)['Content-Type'], 'application/json')
    received.push(JSON.parse(options!.body as string).videoMode)
    return Response.json(manifest())
  }
  try {
    for (const videoMode of ['classic', 'interactive'] as const) {
      await requestVideo({ title: 'Topic', topic: 'Explain this idea.', documents: [], videoMode }, `mode-${videoMode}`)
    }
    assert.deepEqual(received, ['classic', 'interactive'])
  } finally { globalThis.fetch = original }
})

test('generated thumbnails arrive through refresh and replace stale browser-local artwork', () => {
  const video = manifest()
  const previous = videoLesson(video)
  video.thumbnail = { styleVersion: 1, paths: [{ d: 'M100 200L280 80', fill: 'none', stroke: 'currentColor', strokeWidth: 13 }] }
  const [updated] = mergeVideoLessons([video], [previous])
  assert.deepEqual(updated.thumbnail, video.thumbnail)
  assert.equal(updated.artwork, previous.artwork)
  assert.equal(mergeVideoLessons([manifest()], [updated])[0].thumbnail, undefined)
})

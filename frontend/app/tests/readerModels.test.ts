import test from 'node:test'
import assert from 'node:assert/strict'
import { createReaderModelCache } from '../src/readerModels.ts'
import type { LectureVisualization } from '../../../shared/lecture.ts'

const id = '12345678-1234-4234-8234-123456789abc'
const token = 'a'.repeat(64)
const sha = 'b'.repeat(64)
const visual = { id: 'visual', source: 'scene', assets: { model: { kind: 'model', url: `/api/models/${sha}.glb`, sha256: sha, metadata: {} } } } as LectureVisualization

test('models fetch through scoped bearer endpoint and reuse blobs while preserving hashes', async () => {
  const requests: { url: string; init: RequestInit }[] = []
  const revoked: string[] = []
  let created = 0
  const cache = createReaderModelCache(id, token, {
    fetcher: (async (url: string, init: RequestInit) => { requests.push({ url, init }); return new Response('glb') }) as typeof fetch,
    createObjectURL: () => `blob:test-${++created}`, revokeObjectURL: url => revoked.push(url),
  })
  const [first, second] = await Promise.all([cache.resolve(visual), cache.resolve(visual)])
  assert.equal(requests.length, 1)
  assert.equal(requests[0].url, `/api/lecture-view/${id}/models/${sha}.glb`)
  assert.equal(new Headers(requests[0].init.headers).get('Authorization'), `Bearer ${token}`)
  assert.equal(requests[0].init.credentials, 'omit')
  assert.equal(first.assets!.model.url, 'blob:test-1')
  assert.equal(first.assets!.model.sha256, sha)
  assert.deepEqual(first, second)
  assert.equal((await cache.resolve(visual)).assets!.model.url, 'blob:test-1')
  assert.deepEqual(revoked, [])
  cache.dispose()
  assert.deepEqual(revoked, ['blob:test-1'])
})

test('model fetch failure can be retried without poisoning the cache', async () => {
  let requests = 0
  const cache = createReaderModelCache(id, token, {
    fetcher: (async () => { requests++; return requests === 1 ? new Response('', { status: 503 }) : new Response('glb') }) as typeof fetch,
    createObjectURL: () => 'blob:retried', revokeObjectURL: () => {},
  })
  await assert.rejects(cache.resolve(visual), /could not load/)
  assert.equal((await cache.resolve(visual)).assets!.model.url, 'blob:retried')
  assert.equal(requests, 2)
  cache.dispose()
})

test('reader models reject external URLs or mismatched hashes without fetching', async () => {
  let requests = 0
  const cache = createReaderModelCache(id, token, { fetcher: (async () => { requests++; return new Response('glb') }) as typeof fetch })
  for (const asset of [{ ...visual.assets!.model, url: 'https://other.example/model.glb' }, { ...visual.assets!.model, sha256: 'c'.repeat(64) }]) {
    await assert.rejects(cache.resolve({ ...visual, assets: { model: asset } }), /unavailable/)
  }
  assert.equal(requests, 0)
  cache.dispose()
})

test('closing reader aborts pending model requests and prevents creating a late blob', async () => {
  let signal: AbortSignal | undefined
  let done!: (response: Response) => void
  let created = 0
  const cache = createReaderModelCache(id, token, {
    fetcher: ((_url: string, init: RequestInit) => { signal = init.signal!; return new Promise(resolve => { done = resolve }) }) as typeof fetch,
    createObjectURL: () => { created++; return 'blob:late' },
  })
  const resolution = cache.resolve(visual)
  cache.dispose()
  assert.equal(signal?.aborted, true)
  done(new Response('glb'))
  await assert.rejects(resolution, /interrupted/)
  assert.equal(created, 0)
})

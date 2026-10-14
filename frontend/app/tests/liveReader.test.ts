import test from 'node:test'
import assert from 'node:assert/strict'
import { readLiveReaderCredentials, watchLiveNotes } from '../src/liveReader.ts'

const id = '12345678-1234-4234-8234-123456789abc'
const token = 'a'.repeat(64)
const tick = () => new Promise(resolve => setImmediate(resolve))
function storage() {
  const values = new Map<string, string>()
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) } }
}
function clock() {
  let id = 0
  const timers = new Map<number, { callback: () => void; ms: number }>()
  return {
    setTimeout(callback: () => void, ms: number) { timers.set(++id, { callback, ms }); return id },
    clearTimeout(id: number) { timers.delete(id) },
    run(ms: number) { const entry = [...timers].find(([, timer]) => timer.ms === ms); assert.ok(entry, `Expected ${ms}ms timer`); timers.delete(entry[0]); entry[1].callback() },
    timers,
  }
}
const response = (revision: number) => new Response(JSON.stringify({ id, revision }), { status: 200 })

test('fragment credential is stripped and retained only for its lecture in tab storage', () => {
  const tab = storage()
  const replaced: string[] = []
  const read = (path: string, hash: string) => readLiveReaderCredentials({ pathname: path, search: '?reader=1', hash }, tab, url => replaced.push(url))
  assert.deepEqual(read(`/live/${id}`, `#token=${token}`), { id, token })
  assert.deepEqual(replaced, [`/live/${id}?reader=1`])
  assert.deepEqual(read(`/live/${id}`, ''), { id, token })
  assert.equal(read('/live/22345678-1234-4234-8234-123456789abc', '').token, '')
  assert.equal(read(`/live/${id}`, '#token=invalid').token, '')
  assert.equal(read('/live/not-an-id', `#token=${token}`).id, '')
})

test('blocked session storage does not discard a fresh fragment credential', () => {
  const blocked = { getItem() { throw new Error('blocked') }, setItem() { throw new Error('blocked') } }
  assert.deepEqual(readLiveReaderCredentials({ pathname: `/live/${id}`, search: '', hash: `#token=${token}` }, blocked, () => {}), { id, token })
})

test('polling is serial, sends only a bearer header, and ignores older/equal revisions', async () => {
  const timers = clock()
  const accepted: number[] = []
  const requests: { url: string; init: RequestInit }[] = []
  const pending: ((value: Response) => void)[] = []
  const stop = watchLiveNotes(id, token, next => accepted.push(next.revision), () => {}, {
    clock: timers,
    fetcher: ((url: string, init: RequestInit) => { requests.push({ url, init }); return new Promise(resolve => pending.push(resolve)) }) as typeof fetch,
  })
  assert.equal(requests.length, 1)
  assert.equal([...timers.timers.values()].some(timer => timer.ms === 2000), false)
  assert.equal(requests[0].url, `/api/lecture-view/${id}`)
  assert.equal(new Headers(requests[0].init.headers).get('Authorization'), `Bearer ${token}`)
  assert.equal(requests[0].init.credentials, 'omit')
  pending.shift()!(response(3)); await tick()
  timers.run(2000); pending.shift()!(response(2)); await tick()
  timers.run(2000); pending.shift()!(response(3)); await tick()
  timers.run(2000); pending.shift()!(response(4)); await tick()
  assert.deepEqual(accepted, [3, 4])
  stop()
  assert.equal(timers.timers.size, 0)
})

test('disconnect retains notes, retries, then stops on revoked credentials', async () => {
  const timers = clock()
  const accepted: number[] = []
  const states: string[] = []
  const results = [response(1), new Error('offline'), response(2), new Response('', { status: 401 })]
  const stop = watchLiveNotes(id, token, next => accepted.push(next.revision), state => states.push(state), {
    clock: timers, fetcher: (async () => { const result = results.shift(); if (result instanceof Error) throw result; return result }) as typeof fetch,
  })
  await tick(); timers.run(2000); await tick()
  assert.deepEqual(accepted, [1])
  assert.equal(states.at(-1), 'reconnecting')
  timers.run(2000); await tick(); timers.run(2000); await tick()
  assert.deepEqual(accepted, [1, 2])
  assert.equal(states.at(-1), 'unauthorized')
  assert.equal(timers.timers.size, 0)
  stop()
})

test('cleanup aborts the request and ignores a response arriving after unmount', async () => {
  const timers = clock()
  let signal: AbortSignal | undefined
  let resolve!: (value: Response) => void
  const accepted: number[] = []
  const stop = watchLiveNotes(id, token, next => accepted.push(next.revision), () => {}, {
    clock: timers, fetcher: ((_url: string, init: RequestInit) => { signal = init.signal!; return new Promise(done => { resolve = done }) }) as typeof fetch,
  })
  stop()
  assert.equal(signal?.aborted, true)
  resolve(response(1)); await tick()
  assert.deepEqual(accepted, [])
  assert.equal(timers.timers.size, 0)
})

test('a stalled connection is aborted after twelve seconds and retried', async () => {
  const timers = clock()
  const states: string[] = []
  let requests = 0
  const stop = watchLiveNotes(id, token, () => {}, state => states.push(state), {
    clock: timers,
    fetcher: ((_url: string, init: RequestInit) => { requests++; return new Promise((_resolve, reject) => init.signal!.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))) }) as typeof fetch,
  })
  timers.run(12000); await tick()
  assert.equal(states.at(-1), 'reconnecting')
  timers.run(2000)
  assert.equal(requests, 2)
  stop(); await tick()
  assert.equal(timers.timers.size, 0)
})

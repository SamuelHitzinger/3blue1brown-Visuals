import test from 'node:test'
import assert from 'node:assert/strict'
import { CaptureHTTPError, claimCapture, uploadCapture, prepareCaptureClaim, saveCaptureClaim, readCaptureClaim, forgetCaptureClaim } from '../src/captureClient.ts'
import { CaptureQueue } from '../src/captureQueue.ts'
import type { CaptureEntry, CaptureStore } from '../src/captureQueue.ts'
import { CaptureEngine, completeAudioWindow, frameChanged, acquireCaptureStream, pauseWhenHidden } from '../src/captureEngine.ts'

class MemoryStore implements CaptureStore {
  entries: CaptureEntry[] = []
  async list() { return [...this.entries] }
  async put(item: CaptureEntry) { this.entries.push(item) }
  async remove(id: string) { this.entries = this.entries.filter(x => x.metadata.clientId !== id) }
}
const entry = (id: string, sequence = 1): CaptureEntry => ({ pairingId: 'pair', metadata: { clientId: id, sequence, kind: 'audio', capturedAt: '2026-10-14T10:00:00Z', durationMs: 1000 }, blob: new Blob(['audio'], { type: 'audio/mp4' }) })

test('uncertain claims retain the same secret and generated token before network retries', () => {
  const values = new Map<string, string>()
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) } }
  const first = prepareCaptureClaim(storage, 'a'.repeat(64))
  assert.equal(first.secret, 'a'.repeat(64))
  assert.match(first.deviceToken, /^[a-f0-9]{64}$/)
  assert.deepEqual(prepareCaptureClaim(storage, 'a'.repeat(64)), first)
})

test('durable credentials recover queued media after tab closure and expired cleanup preserves another pairing', () => {
  const values = new Map<string, string>()
  const storage = () => ({ getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) }, removeItem: (key: string) => { values.delete(key) } })
  saveCaptureClaim(storage(), { token: 'a'.repeat(64), status: { id: 'first' } } as any)
  assert.deepEqual(readCaptureClaim(storage()), { token: 'a'.repeat(64), pairingId: 'first' })
  saveCaptureClaim(storage(), { token: 'b'.repeat(64), status: { id: 'second' } } as any)
  forgetCaptureClaim(storage(), 'first')
  assert.deepEqual(readCaptureClaim(storage()), { token: 'b'.repeat(64), pairingId: 'second' })
  forgetCaptureClaim(storage(), 'second')
  assert.equal(readCaptureClaim(storage()), null)
})

test('capture upload uses scoped bearer and original metadata/file; transient errors expose retry delay', async () => {
  const original = globalThis.fetch
  const calls: [string, RequestInit][] = []
  globalThis.fetch = async (url, options = {}) => { calls.push([String(url), options]); return Response.json({ detail: 'Busy' }, { status: 429, headers: { 'Retry-After': '3' } }) }
  try {
    await assert.rejects(uploadCapture('token', entry('one')), error => error instanceof CaptureHTTPError && error.status === 429 && error.retryAfterMs === 3000)
    assert.equal(calls[0][0], '/api/capture/items')
    assert.equal((calls[0][1].headers as Record<string, string>).Authorization, 'Bearer token')
    const body = calls[0][1].body as FormData
    assert.deepEqual(JSON.parse(String(body.get('metadata'))), entry('one').metadata)
    assert.equal((body.get('file') as File).type, 'audio/mp4')
    assert.equal((calls[0][1].headers as Record<string, string>)['Content-Type'], undefined)
    await assert.rejects(claimCapture('a'.repeat(64), 'b'.repeat(64)), /Busy/)
    assert.deepEqual(JSON.parse(String(calls[1][1].body)), { secret: 'a'.repeat(64), deviceToken: 'b'.repeat(64) })
  } finally { globalThis.fetch = original }
})

test('queue serializes overlapping flush calls and removes bytes only after acceptance', async () => {
  const store = new MemoryStore()
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  const sent: string[] = []
  const queue = new CaptureQueue(store, async item => { sent.push(item.metadata.clientId); await gate }, () => {})
  await queue.restore()
  await queue.enqueue(entry('one'))
  await queue.enqueue(entry('two', 2))
  const a = queue.flush(), b = queue.flush()
  await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(sent, ['one'])
  assert.equal(store.entries.length, 2)
  release(); await Promise.all([a, b])
  assert.deepEqual(sent, ['one', 'two'])
  assert.equal(store.entries.length, 0)
})

test('queue replays the same persisted item after ambiguous network failure', async () => {
  const store = new MemoryStore()
  let fail = true
  const sent: string[] = []
  const queue = new CaptureQueue(store, async item => { sent.push(item.metadata.clientId); if (fail) throw new TypeError('network') }, () => {})
  await queue.restore(); await queue.enqueue(entry('stable'))
  await queue.flush()
  assert.equal(store.entries.length, 1)
  fail = false
  const recovered = new CaptureQueue(store, async item => { sent.push(item.metadata.clientId) }, () => {})
  await recovered.restore(); await recovered.flush()
  assert.deepEqual(sent, ['stable', 'stable'])
  assert.equal(store.entries.length, 0)
})

test('capacity pauses capture but retains the final audio in memory until accepted', async () => {
  const store = new MemoryStore()
  const queue = new CaptureQueue(store, async () => {}, () => {}, { maxItems: 1, maxBytes: 100 })
  await queue.restore(); await queue.enqueue(entry('first'))
  await assert.rejects(queue.enqueue(entry('final', 2)), /full/i)
  assert.equal(queue.snapshot().pending, 2)
  assert.equal(queue.snapshot().unsaved, 1)
  await queue.flush()
  assert.equal(queue.snapshot().pending, 0)
})

test('revocation halts uploads and preserves pending material', async () => {
  const store = new MemoryStore()
  let calls = 0
  const queue = new CaptureQueue(store, async () => { calls++; throw new CaptureHTTPError('Revoked', 410) }, () => {})
  await queue.restore(); await queue.enqueue(entry('one')); await queue.enqueue(entry('two', 2))
  await queue.flush(); await queue.flush()
  assert.equal(calls, 1)
  assert.equal(store.entries.length, 2)
  assert.equal(queue.snapshot().blocked, true)
})

test('server storage exhaustion still halts capture instead of rejecting every new clip', async () => {
  const store = new MemoryStore()
  let calls = 0
  const queue = new CaptureQueue(store, async () => { calls++; throw new CaptureHTTPError('Capture storage is full', 413) }, () => {})
  await queue.restore(); await queue.enqueue(entry('one')); await queue.enqueue(entry('two', 2))
  await queue.flush(); await queue.flush()
  assert.equal(calls, 1)
  assert.equal(queue.hasCapacity(), false)
  assert.equal(queue.snapshot().blocked, true)
  assert.equal(store.entries.length, 2)
})

test('a rejected audio clip stays on the phone without blocking later capture', async () => {
  const store = new MemoryStore()
  const sent: string[] = []
  let acceptClip = false
  const queue = new CaptureQueue(store, async item => {
    sent.push(item.metadata.clientId)
    if (item.metadata.clientId === 'rejected' && !acceptClip) throw new CaptureHTTPError('Unsupported recording', 415)
  }, () => {})
  await queue.restore()
  await queue.enqueue(entry('rejected'))
  await queue.enqueue(entry('following', 2))
  await queue.flush()
  assert.deepEqual(sent, ['rejected', 'following'])
  assert.equal(queue.snapshot().blocked, false, 'A media error must not disable Resume')
  assert.equal(queue.hasCapacity(), true)
  assert.deepEqual(store.entries.map(item => item.metadata.clientId), ['rejected'])
  assert.match(queue.snapshot().message, /Unsupported recording/)
  await queue.flush()
  assert.deepEqual(sent, ['rejected', 'following'], 'Do not repeatedly send a rejected clip during polling')
  acceptClip = true
  await queue.retry()
  assert.deepEqual(sent, ['rejected', 'following', 'rejected'])
  assert.equal(queue.snapshot().pending, 0)
  assert.equal(queue.snapshot().message, '')
})

test('restoring the queue retains rejected material and accepts new captures', async () => {
  const store = new MemoryStore()
  const send = async (item: CaptureEntry) => {
    if (item.metadata.clientId === 'long-clip') throw new CaptureHTTPError('Audio clip too long', 400)
  }
  const queue = new CaptureQueue(store, send, () => {})
  await queue.restore(); await queue.enqueue(entry('long-clip')); await queue.flush()
  queue.dispose()
  const restored = new CaptureQueue(store, send, () => {})
  await restored.restore(); await restored.enqueue(entry('new-capture', 2)); await restored.flush()
  assert.equal(restored.snapshot().blocked, false)
  assert.equal(restored.hasCapacity(), true)
  assert.deepEqual(store.entries.map(item => item.metadata.clientId), ['long-clip'])
})

class FakeRecorder extends EventTarget {
  state = 'inactive'
  mimeType = 'audio/mp4'
  start() { this.state = 'recording' }
  stop() {
    this.state = 'inactive'
    queueMicrotask(() => {
      this.dispatchEvent(Object.assign(new Event('dataavailable'), { data: new Blob(['first']) }))
      this.dispatchEvent(Object.assign(new Event('dataavailable'), { data: new Blob(['final']) }))
      this.dispatchEvent(new Event('stop'))
    })
  }
}
test('stopping audio waits for all final blobs and produces one complete file', async () => {
  const recorder = new FakeRecorder()
  const window = completeAudioWindow(recorder as unknown as MediaRecorder, 20_000)
  window.stop(); window.stop()
  const result = await window.done
  assert.equal(await result.blob.text(), 'firstfinal')
  assert.equal(result.blob.type, 'audio/mp4')
  assert.ok(result.durationMs >= 0)
})

test('recorder errors retain their final payload before reporting the interruption', async () => {
  const recorder = new FakeRecorder()
  const window = completeAudioWindow(recorder as unknown as MediaRecorder, 20_000)
  recorder.dispatchEvent(new Event('error'))
  recorder.stop()
  const result = await window.done
  assert.equal(await result.blob.text(), 'firstfinal')
  assert.equal(result.interrupted, true)
})

test('complete audio uses the emitted container type when recorder reports a different type', async () => {
  class ContainerRecorder extends FakeRecorder {
    mimeType = 'audio/webm;codecs=opus'
    stop() {
      this.state = 'inactive'
      queueMicrotask(() => {
        this.dispatchEvent(Object.assign(new Event('dataavailable'), { data: new Blob(['complete MP4'], { type: 'audio/mp4' }) }))
        this.dispatchEvent(new Event('stop'))
      })
    }
  }
  const recording = completeAudioWindow(new ContainerRecorder() as unknown as MediaRecorder, 20_000)
  recording.stop()
  const result = await recording.done
  assert.equal(result.blob.type, 'audio/mp4')
  assert.equal(await result.blob.text(), 'complete MP4')
})

test('late camera permission is cleaned up after a cancelled start', async () => {
  let cancelled = false, stopped = 0, release!: (stream: MediaStream) => void
  const pending = new Promise<MediaStream>(resolve => { release = resolve })
  const result = acquireCaptureStream(() => pending, () => cancelled)
  cancelled = true
  release({ getTracks: () => [{ stop: () => { stopped++ } }] } as unknown as MediaStream)
  assert.equal(await result, null)
  assert.equal(stopped, 1)
})

test('hidden documents stop capture and remove the listener on cleanup', () => {
  const document = Object.assign(new EventTarget(), { visibilityState: 'visible' })
  let stopped = 0
  const remove = pauseWhenHidden(document as unknown as Document, () => { stopped++ })
  document.dispatchEvent(new Event('visibilitychange'))
  assert.equal(stopped, 0)
  document.visibilityState = 'hidden'; document.dispatchEvent(new Event('visibilitychange'))
  assert.equal(stopped, 1)
  remove(); document.dispatchEvent(new Event('visibilitychange'))
  assert.equal(stopped, 1)
})

test('first frame is always sent and unchanged frames are suppressed', () => {
  assert.equal(frameChanged(null, new Uint8ClampedArray([20, 20, 20, 255])), true)
  assert.equal(frameChanged(new Uint8ClampedArray([20, 20, 20, 255]), new Uint8ClampedArray([21, 20, 19, 255])), false)
  assert.equal(frameChanged(new Uint8ClampedArray([20, 20, 20, 255]), new Uint8ClampedArray([100, 90, 80, 255])), true)
})

test('periodic refresh preserves small board edits below the global change threshold', () => {
  const before = new Uint8ClampedArray(128 * 96 * 4).fill(200)
  const after = new Uint8ClampedArray(before)
  after.fill(0, 100, 120)
  assert.equal(frameChanged(before, after, 30_000), false)
  assert.equal(frameChanged(before, after, 60_000), true)
})

test('encoder initialization failure reports capture stopped and releases the microphone', async () => {
  const globals = ['window', 'navigator', 'MediaStream', 'MediaRecorder'] as const
  const original = new Map(globals.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
  let stopped = 0, captured = 0
  const paused: string[] = []
  const track = Object.assign(new EventTarget(), { stop: () => { stopped++ } })
  const stream = { getTracks: () => [track], getAudioTracks: () => [track] }
  const replacements = {
    window: { isSecureContext: true },
    navigator: { mediaDevices: { getUserMedia: async () => stream } },
    MediaStream: class {},
    MediaRecorder: class {
      static isTypeSupported() { return true }
      constructor() { throw new Error('Audio encoder unavailable') }
    },
  }
  try {
    for (const key of globals) Object.defineProperty(globalThis, key, { configurable: true, value: replacements[key] })
    const engine = new CaptureEngine({
      video: { srcObject: null } as HTMLVideoElement,
      audio: true, photo: false, photoIntervalMs: 30_000,
      canCapture: () => true,
      onMedia: async () => { captured++ },
      onPaused: reason => { paused.push(reason) },
      onSkipped: () => {},
    })
    assert.equal(await engine.start(), false, 'The page must not enter its recording state after encoder failure')
    await engine.stop()
    assert.deepEqual(paused, ['Audio encoder unavailable'])
    assert.equal(stopped, 1)
    assert.equal(captured, 0)
  } finally {
    for (const key of globals) {
      const descriptor = original.get(key)
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else Reflect.deleteProperty(globalThis, key)
    }
  }
})

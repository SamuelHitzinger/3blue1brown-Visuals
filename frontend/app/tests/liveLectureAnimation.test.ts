import test from 'node:test'
import assert from 'node:assert/strict'
import { LiveAnimationHttpError, LiveAnimationLoop, LiveAnimationTiming, acceptLiveAnimation, markLiveAnimationRendered, readLiveAnimationReply } from '../src/liveLectureAnimation.ts'
import type { LiveAnimationTimingEvent } from '../src/liveLectureAnimation.ts'
import type { LiveAnimationReply } from '../src/liveLectureAnimation.ts'
import * as runtime from 'animlib/live'

function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(yes => { resolve = yes }); return { promise, resolve } }
const tick = () => new Promise(resolve => setTimeout(resolve, 0))
const packet = (cursor: number, revision: number, submission: Exclude<LiveAnimationReply, { idle: true }>['submission']): LiveAnimationReply => ({ sourceCursor: cursor, baseRevision: revision, programId: `source-${cursor}`, submission, evidence: { changes: [{ id: `source-${cursor}`, version: 1 }], context: [] } })

test('benchmark timing ties first render to accepted source, excludes idle and deduplicates frames', () => {
  const events: LiveAnimationTimingEvent[] = []; let time = 10
  const timing = new LiveAnimationTiming(event => events.push(event), () => time++, 1000)
  const idle: LiveAnimationReply = { sourceCursor: 0, baseRevision: 0, idle: true }
  timing.responded(timing.requested(0, 0), idle); timing.committed(idle, 0, 0)
  assert.equal(timing.rendered(0, 'webgpu'), undefined)
  const reply = packet(1, 0, { action: 'add', source: 'native source' })
  timing.responded(timing.requested(0, 0), reply); timing.committed(reply, 0, 1)
  assert.equal(timing.rendered(2, 'webgpu'), undefined)
  const frameOpportunity = timing.rendered(1, 'webgpu')
  assert.equal(timing.rendered(1, 'webgpu'), undefined)
  assert.equal(events.at(-1)?.kind, 'render-submitted')
  frameOpportunity!()
  assert.deepEqual(events.slice(-3).map(event => event.kind), ['commit', 'render-submitted', 'next-frame-opportunity'])
  for (const event of events.slice(-3)) {
    assert.equal(event.requestId, 2); assert.deepEqual(event.sourceIds, ['source-1'])
    assert.equal(event.epochMs, 1000 + event.monotonicMs)
  }
  const deferredReply = packet(2, 1, { action: 'defer', reason: 'pending' })
  timing.responded(timing.requested(1, 1), deferredReply); timing.committed(deferredReply, 1, 1)
  assert.equal(timing.rendered(1, 'webgpu'), undefined)
})

test('stop rejects a late provider result; restart stays serial and keeps the unconsumed cursor', async () => {
  const first = deferred<unknown>(), second = deferred<unknown>(), cursors: number[] = [], accepted: number[] = []
  const loop = new LiveAnimationLoop({ request: async cursor => { cursors.push(cursor); return cursors.length === 1 ? first.promise : second.promise }, accept: async reply => { accepted.push(reply.sourceCursor); return 'ready' }, status() {} })
  loop.start(); loop.start(); loop.stop(); loop.start()
  assert.deepEqual(cursors, [0])
  first.resolve(packet(1, 0, { action: 'defer', reason: 'pending' })); await tick()
  assert.deepEqual(cursors, [0, 0]); assert.deepEqual(accepted, [])
  second.resolve(packet(1, 0, { action: 'defer', reason: 'pending' })); await tick()
  assert.deepEqual(accepted, [1]); assert.equal(loop.sourceCursor, 1); loop.dispose()
})

test('provider failure stops without retries and disposal blocks late publication', async () => {
  let requests = 0, failures = 0, accepted = 0
  const loop = new LiveAnimationLoop({ request: async () => { requests++; throw Error('provider failed') }, accept: async () => { accepted++; return '' }, status: (_active, _message, failed) => { if (failed) failures++ } })
  loop.start(); await tick(); loop.wake(); await tick()
  assert.equal(requests, 1); assert.equal(failures, 1); assert.equal(loop.active, false); assert.equal(loop.sourceCursor, 0)
  loop.dispose(); loop.start(); assert.equal(requests, 1); assert.equal(accepted, 0)
})

test('HTTP 504 retries twice with one-second backoff, same cursor and no concurrent request', async () => {
  const times: number[] = [], cursors: number[] = [], messages: string[] = []
  let accepted = 0, active = 0, peak = 0
  const loop = new LiveAnimationLoop({ request: async cursor => {
    active++; peak = Math.max(peak, active); cursors.push(cursor); times.push(performance.now())
    try { throw new LiveAnimationHttpError(504, 'Animation request timed out.') } finally { active-- }
  }, accept: async () => { accepted++; return '' }, status: (_active, message) => { messages.push(message) } })
  try {
    loop.start(); await tick(); loop.wake(); await tick()
    assert.equal(loop.active, true); assert.equal(times.length, 1)
    assert.match(messages.at(-1)!, /Update delayed; retrying/)
    await new Promise(resolve => setTimeout(resolve, 2150))
    assert.deepEqual(cursors, [0, 0, 0]); assert.equal(peak, 1); assert.equal(accepted, 0)
    assert.ok(times[1] - times[0] >= 950); assert.ok(times[2] - times[1] >= 950)
    assert.equal(loop.sourceCursor, 0); assert.equal(loop.active, false)
    assert.equal(messages.at(-1), 'Animation request timed out.')
  } finally { loop.dispose() }
})

test('successful publication resets timeout retry allowance and advances only accepted cursor', async () => {
  const cursors: number[] = [], accepted: number[] = []
  const loop = new LiveAnimationLoop({ request: async cursor => {
    cursors.push(cursor)
    if ([1, 2, 4, 5].includes(cursors.length)) throw new LiveAnimationHttpError(504, 'timeout')
    return packet(cursor + 1, 0, { action: 'defer', reason: 'pending' })
  }, accept: async reply => { accepted.push(reply.sourceCursor); return 'ready' }, status() {}, pollMs: 250 })
  try {
    loop.start(); await new Promise(resolve => setTimeout(resolve, 4400)); loop.stop()
    assert.deepEqual(cursors, [0, 0, 0, 1, 1, 1]); assert.deepEqual(accepted, [1, 2]); assert.equal(loop.sourceCursor, 2)
  } finally { loop.dispose() }
})

test('stop and disposal cancel pending timeout backoff', async () => {
  for (const dispose of [false, true]) {
    let requests = 0
    const loop = new LiveAnimationLoop({ request: async () => { requests++; throw new LiveAnimationHttpError(504, 'timeout') }, accept: async () => '', status() {} })
    loop.start(); await tick(); assert.equal(loop.active, true)
    if (dispose) loop.dispose(); else loop.stop('Updates paused.')
    await new Promise(resolve => setTimeout(resolve, 1050))
    assert.equal(requests, 1); assert.equal(loop.sourceCursor, 0); assert.equal(loop.active, false); loop.dispose()
  }
})

test('non-504 HTTP and local acceptance failures never retry', async () => {
  for (const status of [400, 409, 502]) {
    let requests = 0
    const loop = new LiveAnimationLoop({ request: async () => { requests++; throw new LiveAnimationHttpError(status, 'failed') }, accept: async () => '', status() {} })
    loop.start(); await tick(); assert.equal(loop.active, false); assert.equal(requests, 1); loop.dispose()
  }
  let requests = 0
  const loop = new LiveAnimationLoop({ request: async () => { requests++; return packet(1, 0, { action: 'defer', reason: 'pending' }) },
    accept: async () => { throw new LiveAnimationHttpError(504, 'local validation failure') }, status() {} })
  loop.start(); await tick(); assert.equal(loop.active, false); assert.equal(requests, 1); assert.equal(loop.sourceCursor, 0); loop.dispose()
})

test('unmount or suspension during preparation prevents the pending commit and cursor advance', async () => {
  const prepared = deferred<void>(), entered = deferred<void>()
  let publications = 0
  const loop = new LiveAnimationLoop({ request: async () => packet(1, 0, { action: 'defer', reason: 'pending' }),
    accept: async (_reply, signal, guard) => { entered.resolve(); await prepared.promise; signal.throwIfAborted(); guard(); publications++; return 'ready' }, status() {} })
  loop.start(); await entered.promise; loop.dispose(); prepared.resolve(); await tick()
  assert.equal(publications, 0); assert.equal(loop.sourceCursor, 0); assert.equal(loop.active, false)
})

test('malformed evidence and idle cursor advance are rejected before acceptance', () => {
  assert.throws(() => readLiveAnimationReply({ sourceCursor: 1, baseRevision: 0, idle: true }, 0), /advanced/)
  assert.throws(() => readLiveAnimationReply({ ...packet(1, 0, { action: 'defer', reason: 'pending' }), evidence: { changes: [{ id: 'source', version: 0 }], context: [] } }, 0), /evidence/)
})

test('empty native frames while first provider request is pending do not stop the request', async () => {
  const pending = deferred<unknown>(), journal = new runtime.CommittedContextJournal()
  const loop = new LiveAnimationLoop({ request: () => pending.promise, accept: async () => 'ready', status() {} })
  loop.start()
  for (let frame = 0; frame < 10; frame++) assert.equal(markLiveAnimationRendered(journal, 0), false)
  assert.equal(loop.active, true); assert.equal(journal.snapshot(2000).latestRevision, 0)
  pending.resolve(packet(1, 0, { action: 'defer', reason: 'pending' })); await tick()
  assert.equal(loop.sourceCursor, 1); loop.dispose()
})

test('app acceptance applies real add → late motion → replacement with continuous pose and an intact journal', async () => {
  const previousWorker = globalThis.Worker
  Object.defineProperty(globalThis, 'Worker', { configurable: true, writable: true, value: undefined })
  let clock = 100
  const world = new runtime.LiveWorld({ clock: () => clock }), journal = new runtime.CommittedContextJournal(), signal = new AbortController().signal
  const apply = (reply: LiveAnimationReply) => acceptLiveAnimation(runtime, world, journal, 'lecture-test', reply, signal, () => signal.throwIfAborted(), clock)
  try {
    await apply(packet(1, 0, { action: 'add', source: "export default scene({mode:'3d',end:'hold'},s=>{s.box('object',{width:1});s.wait(2)});" }))
    clock = 104
    await apply(packet(2, 1, { action: 'motion', motionChanges: [{ id: 'object', velocity: [.6, 0, 0] }] }))
    clock = 106
    assert.ok(Math.abs((await world.sample(clock)).elements[0].position[0] - 1.2) < 1e-9)
    await apply(packet(3, 2, { action: 'replace', replacementProgramId: 'source-1', source: "export default scene({mode:'3d',end:'hold'},s=>{s.sphere('object',{radius:.6});s.wait(2)});" }))
    const object = (await world.sample(clock)).elements[0]
    assert.equal(object.geometry.kind, 'sphere'); assert.ok(Math.abs(object.position[0] - 1.2) < 1e-9)
    assert.equal(world.summary().programs[0].epoch, 100)
    assert.deepEqual(journal.snapshot(20000).records.map(record => record.operation.action), ['add', 'motion', 'replace'])
    assert.equal(markLiveAnimationRendered(journal, world.revision), true)
    assert.equal(journal.snapshot(20000).records[2].renderingStatus, 'render-submitted')
    await assert.rejects(apply(packet(4, 1, { action: 'defer', reason: 'pending' })), /older scene/)
    assert.equal(world.revision, 3)
    const aborted = new AbortController(); aborted.abort()
    await assert.rejects(acceptLiveAnimation(runtime, world, journal, 'lecture-test', packet(4, 3, { action: 'motion', motionChanges: [{ id: 'object', velocity: [0, 0, 0] }] }), aborted.signal, () => aborted.signal.throwIfAborted(), clock))
    assert.equal(world.revision, 3)
  } finally { world.dispose(); Object.defineProperty(globalThis, 'Worker', { configurable: true, writable: true, value: previousWorker }) }
})

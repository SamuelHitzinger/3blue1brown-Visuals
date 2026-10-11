import { AgentError } from '../src/agents/config.js'
import { expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createAssistantMessageEventStream } from '@earendil-works/pi-ai'
import type { AssistantMessage } from '@earendil-works/pi-ai'
import { agentConfig } from '../src/agents/config'
import { createModelRuntime } from '../src/agents/auth'
import { PiAgentRunner } from '../src/agents/runtime'
import { createAgentUsageObserver, emptyTokenUsage, reportedTokenUsage, TokenUsageTracker, withTokenUsage } from '../src/token-usage'
import { SHARED_OWNER, VideoService } from '../src/videos'

test('counts concurrent calls, cached input and retries without double counting final events', async () => {
  const tracker = new TokenUsageTracker(() => {}, { inputTokens: 20, outputTokens: 5, totalTokens: 25, estimatedOutputTokens: 0 })
  const first = withTokenUsage(tracker, createAgentUsageObserver)
  const second = withTokenUsage(tracker, createAgentUsageObserver)
  first({ type: 'message_start', message: { role: 'assistant' } })
  second({ type: 'message_start', message: { role: 'assistant' } })
  first({ type: 'message_update', assistantMessageEvent: { type: 'thinking_delta', delta: 'a'.repeat(40) } })
  second({ type: 'message_update', assistantMessageEvent: { type: 'toolcall_delta', delta: 'a'.repeat(20) } })
  expect(tracker.snapshot().estimatedOutputTokens).toBe(15)
  const end = { type: 'message_end', message: { role: 'assistant', usage: { input: 100, output: 30, cacheRead: 40, cacheWrite: 10, totalTokens: 180 } } }
  first(end); first(end)
  expect(tracker.snapshot()).toEqual({ inputTokens: 170, outputTokens: 35, totalTokens: 205, estimatedOutputTokens: 5 })
  second({ type: 'message_end', message: { role: 'assistant', usage: { input: 0, output: 0 } } })
  expect(tracker.snapshot().estimatedOutputTokens).toBe(5)
  second({ type: 'message_start', message: { role: 'assistant' } })
  second({ type: 'message_end', message: { role: 'assistant', usage: { input: 15, output: 5 } } })
  expect(tracker.snapshot().totalTokens).toBe(225)
  expect(tracker.snapshot().estimatedOutputTokens).toBe(5)
  tracker.flush()
  expect(reportedTokenUsage({ input_tokens: 100, cached_input_tokens: 40, output_tokens: 25, total_tokens: 125 })).toEqual({ inputTokens: 100, outputTokens: 25, totalTokens: 125, estimatedOutputTokens: 0 })
  expect(reportedTokenUsage({ input_tokens: -1, output_tokens: NaN })).toEqual(emptyTokenUsage())
})

test('isolates concurrent videos and ignores untracked agent calls', async () => {
  const first = new TokenUsageTracker(() => {}), second = new TokenUsageTracker(() => {})
  const emit = async () => {
    await Promise.resolve()
    const observer = createAgentUsageObserver()
    observer({ type: 'message_end', message: { role: 'assistant', usage: { input: 4, output: 3 } } })
  }
  await Promise.all([withTokenUsage(first, emit), withTokenUsage(second, emit), emit()])
  expect(first.snapshot().totalTokens).toBe(7)
  expect(second.snapshot().totalTokens).toBe(7)
})

test('live SSE usage arrives before scenes, survives reconnect, and flushes on success or failure', async () => {
  for (const fail of [false, true]) {
    let release!: () => void
    const gate = new Promise<void>(resolve => { release = resolve })
    const service = new VideoService(':memory:', async () => {
      const emit = createAgentUsageObserver()
      emit({ type: 'message_start', message: { role: 'assistant' } })
      emit({ type: 'message_update', assistantMessageEvent: { type: 'text_delta', delta: 'a'.repeat(400) } })
      await gate
      emit({ type: 'message_end', message: { role: 'assistant', usage: { input: 250, output: 110 } } })
      if (fail) throw new AgentError('RECOVERY_EXHAUSTED', 'Test failure')
      return null
    }, 'pi')
    try {
      const video = service.create(SHARED_OWNER, 'usage', { title: 'Test', topic: 'Explain vectors', documents: [] })
      for (let i = 0; i < 100 && !service.get(video.id, SHARED_OWNER)?.tokenUsage?.estimatedOutputTokens; i++) await Bun.sleep(10)
      const live = service.get(video.id, SHARED_OWNER)!
      expect(live.status).toBe('generating')
      expect(live.scenes).toHaveLength(0)
      expect(live.tokenUsage?.estimatedOutputTokens).toBe(100)
      const reconnect = await service.handle(new Request(`http://localhost/api/videos/${video.id}/events`))
      const reader = reconnect.body!.getReader()
      const snapshot = new TextDecoder().decode((await reader.read()).value)
      expect(snapshot).toContain(JSON.stringify(live.tokenUsage))
      await reader.cancel()
      const events = (await service.handle(new Request(`http://localhost/api/videos/${video.id}/events`))).text()
      release()
      const text = await events
      const completed = service.get(video.id, SHARED_OWNER)!
      expect(completed.status).toBe(fail ? 'failed' : 'complete')
      expect(completed.tokenUsage).toEqual({ inputTokens: 250, outputTokens: 110, totalTokens: 360, estimatedOutputTokens: 0 })
      expect(completed.revision).toBeGreaterThan(live.revision)
      expect(text).toContain(JSON.stringify(completed))
    } finally { release(); await service.close() }
  }
})


function providerMessage(stopReason: AssistantMessage['stopReason'] = 'stop'): AssistantMessage {
  return { role: 'assistant', content: [{ type: 'text', text: 'Finished' }], provider: 'openai', api: 'openai-responses', model: 'gpt-6-astra',
    usage: { input: 100, output: 30, cacheRead: 10, cacheWrite: 0, totalTokens: 140,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } }, stopReason, timestamp: Date.now(),
    ...(stopReason === 'error' ? { errorMessage: '401 test failure' } : {}) }
}

async function silentProvider(wait?: (ms: number, signal?: AbortSignal) => Promise<void>) {
  const root = await mkdtemp(join(tmpdir(), 'aha-silent-token-test-'))
  const config = agentConfig({ PI_CODING_AGENT_DIR: root, AGENT_AUTH_MODE: 'api-key', OPENAI_API_KEY: 'fake-test-key' })
  const runtime = await createModelRuntime(config)
  let started!: () => void, finish!: (message: AssistantMessage) => void
  const ready = new Promise<void>(resolve => { started = resolve })
  runtime.streamSimple = (_model, _context, options) => {
    const stream = createAssistantMessageEventStream()
    // Intentionally emit no start, text, reasoning, or usage events until finish.
    finish = message => {
      stream.push({ type: 'start', partial: message })
      if (message.stopReason === 'aborted' || message.stopReason === 'error') stream.push({ type: 'error', reason: message.stopReason, error: message })
      else stream.push({ type: 'done', reason: 'stop', message })
    }
    options?.signal?.addEventListener('abort', () => finish(providerMessage('aborted')), { once: true })
    started()
    return stream
  }
  return { runner: new PiAgentRunner(config, async () => runtime, wait), runtime, ready,
    finish: (message: AssistantMessage) => finish(message), close: () => rm(root, { recursive: true, force: true }) }
}

const task = { systemPrompt: 'Write a short answer.', prompt: 'Explain vectors.' }

test('real Pi runner publishes every half second before any provider events and reconciles final usage', async () => {
  const provider = await silentProvider()
  const snapshots: { at: number; tokens: number }[] = []
  const tracker = new TokenUsageTracker(usage => { snapshots.push({ at: performance.now(), tokens: usage.estimatedOutputTokens }) })
  const result = withTokenUsage(tracker, () => provider.runner.run(task))
  try {
    await provider.ready
    expect(tracker.snapshot().estimatedOutputTokens).toBe(1)
    await Bun.sleep(1100)
    expect(snapshots.length).toBeGreaterThanOrEqual(3)
    expect(snapshots[1].tokens).toBeGreaterThan(snapshots[0].tokens)
    expect(snapshots[2].tokens).toBeGreaterThan(snapshots[1].tokens)
    expect(snapshots[1].at - snapshots[0].at).toBeGreaterThanOrEqual(450)
    provider.finish(providerMessage())
    expect(await result).toBe('Finished')
    expect(tracker.snapshot()).toEqual({ inputTokens: 110, outputTokens: 30, totalTokens: 140, estimatedOutputTokens: 0 })
    const finalCount = snapshots.length
    await Bun.sleep(600)
    expect(snapshots).toHaveLength(finalCount)
  } finally { provider.finish(providerMessage()); await result.catch(() => {}); await provider.close() }
}, 5000)

for (const outcome of ['error', 'abort'] as const) {
  test(`real Pi runner stops silent-request heartbeats after ${outcome}`, async () => {
    const provider = await silentProvider()
    const tracker = new TokenUsageTracker(() => {})
    const controller = new AbortController()
    const result = withTokenUsage(tracker, () => provider.runner.run({ ...task, signal: controller.signal })).catch(error => error)
    try {
      await provider.ready
      await Bun.sleep(550)
      expect(tracker.snapshot().estimatedOutputTokens).toBeGreaterThan(1)
      if (outcome === 'abort') controller.abort()
      else provider.finish(providerMessage('error'))
      expect(await result).toMatchObject({ code: outcome === 'abort' ? 'ABORTED' : 'AUTH' })
      const final = tracker.snapshot()
      expect(final).toEqual({ inputTokens: 110, outputTokens: 30, totalTokens: 140, estimatedOutputTokens: 0 })
      await Bun.sleep(600)
      expect(tracker.snapshot()).toEqual(final)
    } finally { controller.abort(); provider.finish(providerMessage()); await result; await provider.close() }
  }, 5000)
}

test('request projections stay monotonic across delayed start/deltas, respect limits and isolate concurrent calls', async () => {
  const tracker = new TokenUsageTracker(() => {})
  const first = withTokenUsage(tracker, createAgentUsageObserver)
  const second = withTokenUsage(tracker, createAgentUsageObserver)
  try {
    first.startRequest(1000)
    second.startRequest(5)
    expect(tracker.snapshot().estimatedOutputTokens).toBe(2)
    await Bun.sleep(550)
    expect(tracker.snapshot().estimatedOutputTokens).toBeGreaterThan(10)
    const beforeStart = tracker.snapshot().estimatedOutputTokens
    first({ type: 'message_start', message: { role: 'assistant' } })
    first({ type: 'message_update', assistantMessageEvent: { type: 'text_delta', delta: 'x'.repeat(4) } })
    expect(tracker.snapshot().estimatedOutputTokens).toBeGreaterThanOrEqual(beforeStart)
    first({ type: 'message_update', assistantMessageEvent: { type: 'toolcall_delta', delta: 'x'.repeat(400) } })
    expect(tracker.snapshot().estimatedOutputTokens).toBe(106)
    await Bun.sleep(550)
    expect(tracker.snapshot().estimatedOutputTokens).toBeGreaterThan(106)
    const end = { type: 'message_end', message: { role: 'assistant', usage: { input: 100, output: 30 } } }
    first(end); first(end)
    expect(tracker.snapshot()).toEqual({ inputTokens: 100, outputTokens: 30, totalTokens: 130, estimatedOutputTokens: 5 })
    // Missing final usage must end activity while preserving its labelled estimate.
    second({ type: 'message_end', message: { role: 'assistant' } })
    const stopped = tracker.snapshot()
    await Bun.sleep(600)
    expect(tracker.snapshot()).toEqual(stopped)
    first.startRequest(10)
    expect(tracker.snapshot().estimatedOutputTokens).toBe(6)
    first.dispose()
    await Bun.sleep(600)
    expect(tracker.snapshot().estimatedOutputTokens).toBe(6)
  } finally { first.dispose(); second.dispose(); tracker.flush() }
}, 5000)

test('a provider throwing before its first stream event cannot leave a heartbeat running', async () => {
  const provider = await silentProvider()
  provider.runtime.streamSimple = () => { throw new Error('401 test failure') }
  let publications = 0
  const tracker = new TokenUsageTracker(() => { publications++ })
  try {
    await expect(withTokenUsage(tracker, () => provider.runner.run(task))).rejects.toMatchObject({ code: 'AUTH' })
    expect(publications).toBeGreaterThan(0)
    const stopped = publications
    await Bun.sleep(600)
    expect(publications).toBe(stopped)
  } finally { await provider.close() }
})


test('successful zero usage clears projections even when abort preceded the delayed first event', () => {
  const tracker = new TokenUsageTracker(() => {})
  const observe = withTokenUsage(tracker, createAgentUsageObserver)
  const controller = new AbortController()
  observe.startRequest(100, controller.signal)
  expect(tracker.snapshot().estimatedOutputTokens).toBe(1)
  controller.abort()
  observe({ type: 'message_start', message: { role: 'assistant' } })
  observe({ type: 'message_end', message: { role: 'assistant', stopReason: 'stop', usage: { input: 0, output: 0 } } })
  expect(tracker.snapshot()).toEqual(emptyTokenUsage())
  observe.dispose()
})

test('provider backoff and host validation do not keep the token heartbeat running', async () => {
  const tracker = new TokenUsageTracker(() => {})
  let backoffs = 0, calls = 0
  const provider = await silentProvider(async () => {
    backoffs++
    const before = tracker.snapshot()
    await Bun.sleep(600)
    expect(tracker.snapshot()).toEqual(before)
    expect(calls).toBe(1)
  })
  const stream = provider.runtime.streamSimple.bind(provider.runtime)
  let secondStarted!: () => void, validationStarted!: () => void, finishValidation!: () => void
  const secondReady = new Promise<void>(resolve => { secondStarted = resolve })
  const validationReady = new Promise<void>(resolve => { validationStarted = resolve })
  const validationGate = new Promise<void>(resolve => { finishValidation = resolve })
  provider.runtime.streamSimple = (...args) => {
    calls++
    const response = stream(...args)
    if (calls === 1) queueMicrotask(() => {
      const failure = providerMessage('error')
      failure.errorMessage = '503 temporary provider failure'
      failure.usage.input = 0; failure.usage.output = 0; failure.usage.cacheRead = 0; failure.usage.totalTokens = 0
      provider.finish(failure)
    })
    else secondStarted()
    return response
  }
  const controller = new AbortController()
  const result = withTokenUsage(tracker, () => provider.runner.run({ ...task, signal: controller.signal,
    validate: async () => { validationStarted(); await validationGate } }))
  try {
    await secondReady
    expect(backoffs).toBe(1)
    expect(tracker.snapshot().estimatedOutputTokens).toBe(2)
    provider.finish(providerMessage())
    await validationReady
    const duringValidation = tracker.snapshot()
    expect(duringValidation).toEqual({ inputTokens: 110, outputTokens: 30, totalTokens: 140, estimatedOutputTokens: 1 })
    await Bun.sleep(600)
    expect(tracker.snapshot()).toEqual(duringValidation)
    finishValidation()
    expect(await result).toBe('Finished')
  } finally { finishValidation(); controller.abort(); await result.catch(() => {}); await provider.close() }
}, 5000)

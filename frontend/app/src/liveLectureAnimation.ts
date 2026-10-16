import type { CommittedContextJournal, LectureSubmission, LiveWorld, OperationEvidenceRef } from 'animlib/live'

/** HTTP failures are distinct from local validation and rendering failures. */
export class LiveAnimationHttpError extends Error {
  readonly status: number
  constructor(status: number, message: string) { super(message); this.name = 'LiveAnimationHttpError'; this.status = status }
}

export type LiveAnimationReply = { sourceCursor: number; baseRevision: number; idle: true }
  | { sourceCursor: number; baseRevision: number; programId: string; submission: LectureSubmission; evidence: { changes: OperationEvidenceRef[]; context: OperationEvidenceRef[] } }

export function readLiveAnimationReply(value: unknown, sourceCursor: number): LiveAnimationReply {
  const reply = value as Partial<Exclude<LiveAnimationReply, { idle: true }>> & { idle?: unknown }
  if (!reply || !Number.isSafeInteger(reply.sourceCursor) || reply.sourceCursor! < sourceCursor || !Number.isSafeInteger(reply.baseRevision) || reply.baseRevision! < 0) throw Error('Invalid live animation response.')
  if (reply.idle === true) {
    if (reply.sourceCursor !== sourceCursor) throw Error('Idle animation response advanced the source cursor.')
    return reply as LiveAnimationReply
  }
  if (reply.sourceCursor === sourceCursor || typeof reply.programId !== 'string' || !reply.programId || reply.programId.length > 128 || !reply.submission || !['add', 'edit', 'parameters', 'motion', 'replace', 'defer'].includes(reply.submission.action)) throw Error('Incomplete live animation response.')
  for (const refs of [reply.evidence?.changes, reply.evidence?.context]) {
    if (!Array.isArray(refs) || refs.length > 64 || refs.some(ref => !ref || typeof ref.id !== 'string' || !ref.id || ref.id.length > 256 || !Number.isSafeInteger(ref.version) || ref.version < 1)) throw Error('Invalid live animation evidence references.')
  }
  return reply as LiveAnimationReply
}

/** One lane owns requests and commits. Stop invalidates late results; explicit
 * Start may resume only after the previous lane has settled. Only request HTTP
 * 504 failures retry, at most twice per successful update, with one-second delay.
 */
export class LiveAnimationLoop {
  private enabled = false
  private disposed = false
  private running = false
  private generation = 0
  private controller: AbortController | undefined
  private waiting: (() => void) | undefined
  private cursor = 0
  private readonly options: {
    request: (cursor: number, signal: AbortSignal) => Promise<unknown>
    accept: (reply: LiveAnimationReply, signal: AbortSignal, guard: () => void) => Promise<string>
    status: (active: boolean, message: string, failed?: boolean) => void
    pollMs?: number
  }
  constructor(options: LiveAnimationLoop['options']) { this.options = options }
  get active() { return this.enabled }
  get sourceCursor() { return this.cursor }
  start() {
    if (this.disposed || this.enabled) return
    this.enabled = true; this.generation++
    this.options.status(true, 'Listening for new lecture content…')
    void this.pump()
  }
  stop(message = 'Updates stopped. Your animation remains visible.') {
    this.enabled = false; this.generation++; this.controller?.abort(); this.wake()
    if (!this.disposed) this.options.status(false, message)
  }
  wake() { this.waiting?.() }
  dispose() { this.disposed = true; this.stop() }
  private async pump() {
    if (this.running || !this.enabled || this.disposed) return
    this.running = true
    const generation = this.generation, controller = new AbortController()
    this.controller = controller
    const guard = () => { controller.signal.throwIfAborted(); if (this.disposed || !this.enabled || generation !== this.generation) throw Error('Live animation update cancelled.') }
    let timeoutRetries = 0
    try {
      while (this.enabled && generation === this.generation && !this.disposed) {
        guard()
        let response: unknown
        try { response = await this.options.request(this.cursor, controller.signal) }
        catch (error) {
          guard()
          if (!(error instanceof LiveAnimationHttpError) || error.status !== 504 || timeoutRetries >= 2) throw error
          timeoutRetries++
          this.options.status(true, `Update delayed; retrying… (${timeoutRetries}/2)`)
          // New-source wakeups must not bypass backoff. Stop aborts it immediately.
          await new Promise<void>(resolve => {
            const done = () => { clearTimeout(timer); controller.signal.removeEventListener('abort', done); resolve() }
            const timer = setTimeout(done, 1000)
            controller.signal.addEventListener('abort', done, { once: true })
            if (controller.signal.aborted) done()
          })
          guard(); continue
        }
        const reply = readLiveAnimationReply(response, this.cursor)
        guard()
        const message = await this.options.accept(reply, controller.signal, guard)
        // accept guards immediately before publication. Once accepted, preserve
        // its cursor even if Stop arrives in the following microtask.
        this.cursor = reply.sourceCursor
        timeoutRetries = 0
        guard(); this.options.status(true, message)
        await new Promise<void>(resolve => {
          const done = () => { clearTimeout(timer); if (this.waiting === done) this.waiting = undefined; resolve() }
          const timer = setTimeout(done, Math.max(250, this.options.pollMs ?? 1000))
          this.waiting = done
        })
      }
    } catch (error) {
      if (this.enabled && generation === this.generation && !this.disposed && !controller.signal.aborted) {
        this.enabled = false
        this.options.status(false, error instanceof Error ? error.message : 'The live animation could not update.', true)
      }
    } finally {
      this.running = false
      if (this.controller === controller) this.controller = undefined
      if (this.enabled && !this.disposed) void this.pump()
    }
  }
}

export async function acceptLiveAnimation(runtime: Pick<typeof import('animlib/live'), 'commitLectureSubmission'>,
  world: LiveWorld, journal: CommittedContextJournal, runId: string, reply: LiveAnimationReply,
  signal: AbortSignal, guard: () => void, nowSeconds = performance.now() / 1000) {
  guard()
  if (reply.baseRevision !== world.revision) throw Error('The animation response refers to an older scene. Retry the update.')
  if ('idle' in reply) return 'Listening for new lecture content…'
  if (reply.submission.action === 'defer') return 'Waiting for more detail from the lecture…'
  const result = await runtime.commitLectureSubmission(world, reply.submission, reply.baseRevision, reply.programId, nowSeconds, { signal, beforeCommit: guard })
  if (result.changed) journal.record({ revision: result.commit.revision, runId, planId: reply.programId,
    committedAtMs: result.commit.committedAt * 1000, evidence: reply.evidence, operation: result.operation })
  return result.changed ? 'Animation updated. Listening for new content…' : 'Listening for new lecture content…'
}

/** Empty worlds render while the first request is in flight; they have no
 * committed operation to acknowledge. Never turn that normal state into failure.
 */
export function markLiveAnimationRendered(journal: CommittedContextJournal, revision: number) {
  return revision > 0 ? journal.markRendered(revision) : false
}

export type LiveAnimationTimingEvent = { kind: string; epochMs: number; monotonicMs: number; wallClockMs: number; timeOriginMs: number; requestId: number; [key: string]: unknown }

/** Explicit local benchmark only. Submission is not GPU completion or physical
 * display. The following rAF is a browser frame opportunity, not a paint receipt.
 */
export class LiveAnimationTiming {
  private serial = 0
  private requests = new WeakMap<object, number>()
  private revisions = new Map<number, { requestId: number; sourceIds: string[]; action: string }>()
  private emit: (event: LiveAnimationTimingEvent) => void
  private now: () => number
  private timeOrigin: number
  constructor(emit: (event: LiveAnimationTimingEvent) => void,
    now = () => performance.now(), timeOrigin = performance.timeOrigin) { this.emit = emit; this.now = now; this.timeOrigin = timeOrigin }
  private event(kind: string, requestId: number, details: Record<string, unknown> = {}) {
    const monotonicMs = this.now()
    this.emit({ kind, requestId, monotonicMs, epochMs: this.timeOrigin + monotonicMs,
      wallClockMs: Date.now(), timeOriginMs: this.timeOrigin, ...details })
  }
  requested(sourceCursor: number, baseRevision: number) {
    const requestId = ++this.serial
    this.event('request-start', requestId, { sourceCursor, baseRevision }); return requestId
  }
  responded(requestId: number, reply: LiveAnimationReply) {
    this.requests.set(reply, requestId)
    this.event('response', requestId, { sourceCursor: reply.sourceCursor, baseRevision: reply.baseRevision,
      action: 'idle' in reply ? 'idle' : reply.submission.action, sourceIds: 'idle' in reply ? [] : reply.evidence.changes.map(ref => ref.id) })
  }
  committed(reply: LiveAnimationReply, previousRevision: number, revision: number) {
    const requestId = this.requests.get(reply)
    if (requestId === undefined || 'idle' in reply || revision <= previousRevision) return
    const details = { requestId, sourceIds: reply.evidence.changes.map(ref => ref.id), action: reply.submission.action }
    this.revisions.set(revision, details)
    this.event('commit', requestId, { ...details, revision })
  }
  rendered(revision: number, backend: string | undefined): (() => void) | undefined {
    const details = this.revisions.get(revision)
    if (!details) return
    this.revisions.delete(revision)
    this.event('render-submitted', details.requestId, { ...details, revision, backend })
    return () => this.event('next-frame-opportunity', details.requestId, { ...details, revision, backend })
  }
}

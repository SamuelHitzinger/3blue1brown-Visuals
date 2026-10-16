import { LiveWorld, type WorldPatch } from '../realtime-world/world.js';
import { MediaReplay, type AsrInput, type EvidencePacket, type LocalAsrTrial } from '../realtime-media/replay.js';
import type { SourceClock } from '../realtime-media/events.js';
import { CommittedContextJournal } from '../realtime-media/committed-context.js';
import { CanvasRenderer } from '../../../shared/animlib/src/renderer.js';
import type { Frame } from '../../../shared/animlib/src/types.js';

type Clock = { clockDomain: string; serverTimeMs: number; browserBeforeMs: number; browserAfterMs: number; offsetLowerMs: number; offsetUpperMs: number };
type Stamp = { browserAtMs: number; serverLowerMs: number; serverUpperMs: number };
type Submission = { action: 'add'; source: string } | { action: 'edit'; changes: WorldPatch['changes']; remove: string[] } | { action: 'defer'; reason: string };
type Seen = { id: string; version: number; availableAtMs: number; stable: boolean; pending: boolean };
type Attempt = { packet: EvidencePacket; controller: AbortController; deadline: number; terminal: boolean; corrected: boolean; committedRevision?: number; cancelPromise?: Promise<boolean> };
type Run = { id: string; sequence: number; stopped: boolean; source?: EventSource; replay?: MediaReplay; clocks: Record<string, SourceClock>; seen: Map<string, Seen>; active?: Attempt };
type RenderWait = { revision: number; resolve: (stamp: Stamp) => void; reject: (error: Error) => void };
type ProducerEvent = {
  type: string; sourceId?: string; sourceStartMs?: number; monotonicStartMs?: number; rate?: number;
  id?: string; version?: number; sourceTimeMs?: number; arrivedAtMs?: number; frameRef?: string;
  availability?: AsrInput['availability']; python?: { receipt: { id: string; sourceId: string }; trial: LocalAsrTrial; trialRef: string };
  reason?: string; error?: string; serverClockDomain?: string;
};
const canvas = document.querySelector('canvas')!;
const startButton = document.querySelector<HTMLButtonElement>('#start')!;
const stopButton = document.querySelector<HTMLButtonElement>('#stop')!;
const status = document.querySelector('#status')!;
const marker = document.querySelector('#marker')!;
const clockLabel = document.querySelector('#clock')!;
const history = document.querySelector('#history')!;
let clock: Clock | undefined, run: Run | undefined, runSequence = 0, starting = false, closing = false;
let renderer: CanvasRenderer, renderError: Error | undefined, renderWait: RenderWait | undefined;
let lastFrame: Frame | undefined, lastFrameRevision = -1, lastFrameStamp: Stamp | undefined;
let disposed = false;
// A new source run can continue the same world, so committed history outlives Run.
const committedContext = new CommittedContextJournal();
const message = (error: unknown) => error instanceof Error ? error.message : String(error);
function note(text: string) {
  const item = document.createElement('li'); item.textContent = text.slice(0, 1200); history.prepend(item);
  while (history.children.length > 80) history.lastElementChild!.remove();
}
function stamp(): Stamp {
  if (!clock) throw new Error('Clock has not been measured');
  const browserAtMs = performance.now();
  return { browserAtMs, serverLowerMs: browserAtMs + clock.offsetLowerMs, serverUpperMs: browserAtMs + clock.offsetUpperMs };
}
const upperNow = () => stamp().serverUpperMs;
// The world and the scheduler always use the same conservative mapped clock.
const world = new LiveWorld({ clock: () => upperNow() / 1000, prepare: async (scene, assets, signal) => {
  signal.throwIfAborted(); await renderer.prepare([scene], assets); signal.throwIfAborted();
} });
renderer = new CanvasRenderer(canvas, undefined, world.assetGeometry);
renderer.onError = error => { renderError = error; renderWait?.reject(error); status.textContent = `Renderer error: ${error.message}`; };
renderer.onRecovered = () => { renderError = undefined; };

async function post(path: string, body: unknown, signal?: AbortSignal) {
  const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? `${path}: HTTP ${response.status}`);
  return result;
}
// A bounded, serial persistence queue cannot block animation or grow on a dead server.
const receiptQueue: object[] = [];
let sendingReceipts = false;
function receipt(current: Run, planId: string | null, event: object) {
  if (receiptQueue.length >= 64) { note('Receipt queue full; measurement was not persisted.'); return; }
  receiptQueue.push({ runId: current.id, planId, ...event, clock, measurement: 'conservative-clock-estimate', hardwarePresentedAtMs: null });
  void flushReceipts();
}
async function flushReceipts() {
  if (sendingReceipts) return;
  sendingReceipts = true;
  try {
    while (receiptQueue.length) {
      const next = receiptQueue.shift()!;
      try { await post('/receipt', next, AbortSignal.timeout(3000)); }
      catch (error) { note(`Receipt persistence failed: ${message(error)}`); }
    }
  } finally { sendingReceipts = false; }
}
function drain(current: Run) {
  for (const timing of current.replay?.drainReceipts() ?? []) receipt(current, timing.planId, { type: 'scheduler-receipt', timing, ...stamp() });
}
function advance(current: Run) { current.replay?.advance(upperNow()); drain(current); }
function terminal(current: Run, attempt: Attempt, reason: string) {
  if (attempt.terminal) return;
  attempt.terminal = true;
  if (!attempt.controller.signal.aborted && current.replay) {
    try { current.replay.retire(attempt.packet.planId, upperNow(), reason.slice(0, 256)); }
    catch (error) { note(`Retirement unavailable: ${message(error)}`); }
  }
  attempt.controller.abort(new Error(reason));
  drain(current);
}
function cancelServer(current: Run, attempt: Attempt): Promise<boolean> {
  if (attempt.cancelPromise) return attempt.cancelPromise;
  // The server acknowledges only after the old request's cleanup has finished.
  // Share one bounded acknowledgment across correction, timeout, catch, and Stop.
  attempt.cancelPromise = post('/cancel', { runId: current.id, planId: attempt.packet.planId }, AbortSignal.timeout(3000)).then(() => {
    receipt(current, attempt.packet.planId, { type: 'cancellation-acknowledged', ...stamp() });
    return true;
  }).catch(error => {
    const reason = message(error);
    note(`Cancellation acknowledgment failed: ${reason}. Run stopped; backend activity is unconfirmed.`);
    receipt(current, attempt.packet.planId, { type: 'cancellation-failed', ...stamp(), reason });
    // stop() does not await generate() or this promise, avoiding a cleanup cycle.
    if (run === current && !current.stopped) {
      void stop();
      status.textContent = 'Cancellation acknowledgment failed. Run stopped; existing world retained.';
    }
    return false;
  });
  return attempt.cancelPromise;
}
function guard(current: Run, attempt: Attempt) {
  advance(current); attempt.controller.signal.throwIfAborted();
  if (current.stopped || run !== current) throw new Error('Run stopped');
  if (document.hidden) throw new Error('Page hidden before renderer submission');
  if (upperNow() >= attempt.deadline) throw new Error('Source deadline expired');
}
function waitForRender(revision: number, current: Run, attempt: Attempt): Promise<Stamp> {
  return new Promise((resolve, reject) => {
    const cleanup = () => { clearTimeout(timer); attempt.controller.signal.removeEventListener('abort', abort); if (renderWait === pending) renderWait = undefined; };
    const pending: RenderWait = { revision, resolve: value => { cleanup(); resolve(value); }, reject: error => { cleanup(); reject(error); } };
    const abort = () => pending.reject(new Error(message(attempt.controller.signal.reason ?? 'Cancelled')));
    const timer = setTimeout(() => pending.reject(new Error('No renderer submission before timeout')), Math.max(0, Math.min(2000, attempt.deadline - upperNow())));
    renderWait = pending;
    attempt.controller.signal.addEventListener('abort', abort, { once: true });
    if (attempt.controller.signal.aborted) abort();
    // No cached frame is accepted: only a subsequent actual render() can resolve.
    if (current.stopped) pending.reject(new Error('Run stopped'));
  });
}
async function animate() {
  if (disposed) return;
  try {
    if (clock) {
      const revision = world.revision, sampled = stamp();
      const frame = await world.sample(sampled.serverUpperMs / 1000);
      if (revision === world.revision) {
        const submittedOk = renderer.render(frame, world.rendererOptions);
        const submitted = stamp();
        if (submittedOk === true && !renderError) {
          lastFrame = frame; lastFrameRevision = revision; lastFrameStamp = sampled;
          marker.textContent = `Revision ${revision} · renderer submitted · browser ${submitted.browserAtMs.toFixed(1)} ms · conservative server ${submitted.serverUpperMs.toFixed(1)} ms`;
          renderWait?.revision === revision && renderWait.resolve(submitted);
        }
      }
    }
  } catch (error) { renderWait?.reject(new Error(message(error))); status.textContent = `Render failed: ${message(error)}`; }
  requestAnimationFrame(animate);
}
function conciseWorld(requestOverheadBytes: number) {
  const description = { summary: world.summary(), sampledRevision: lastFrameRevision, sampledAt: lastFrameStamp,
    elements: lastFrameRevision === world.revision ? lastFrame?.elements.slice(0, 256).map(element => ({
      id: element.id, kind: element.geometry.kind, position: element.position, rotation: element.rotation,
      scale: element.scale, opacity: element.opacity, fill: element.fill,
    })) : [], elementsTruncated: (lastFrame?.elements.length ?? 0) > 256 };
  // Keep exact operations whole. An omitted source is unknown, never an empty scene.
  const serialized = JSON.stringify(description), field = ',"committedOperations":';
  const remaining = 60_000 - serialized.length - field.length;
  const remainingBytes = 120_000 - requestOverheadBytes - new TextEncoder().encode(serialized + field).length;
  return { ...description, committedOperations: committedContext.snapshot(remaining, remainingBytes) };
}
async function generate(current: Run, packet: EvidencePacket, signal: AbortSignal) {
  const attempt: Attempt = { packet, controller: new AbortController(), terminal: false, corrected: false,
    deadline: Math.min(packet.earliestChangeDeadlineMs, ...packet.changes.map(change => change.sourceReadyAtMs + 10_000)) };
  current.active = attempt;
  const onCorrection = () => {
    if (attempt.terminal) return;
    attempt.corrected = true; attempt.controller.abort(signal.reason); cancelServer(current, attempt);
  };
  signal.addEventListener('abort', onCorrection, { once: true });
  if (signal.aborted) onCorrection();
  const timer = setTimeout(() => { terminal(current, attempt, 'source-deadline-expired'); cancelServer(current, attempt); }, Math.max(0, attempt.deadline - upperNow()));
  let committedAt: Stamp | undefined;
  try {
    guard(current, attempt);
    const request = { runId: current.id, planId: packet.planId, baseRevision: packet.baseWorldRevision,
      evidence: packet.changes.map(({ id, version }) => ({ id, version })), context: packet.context.map(({ id, version }) => ({ id, version })),
      world: null as unknown, deadlineServerMs: attempt.deadline };
    // Replace the four ASCII bytes of null with the complete bounded world object.
    request.world = conciseWorld(new TextEncoder().encode(JSON.stringify(request)).length - 4);
    if (new TextEncoder().encode(JSON.stringify(request)).length > 120_000) throw new Error('World request exceeds UTF-8 byte budget');
    guard(current, attempt);
    const requested = stamp();
    receipt(current, packet.planId, { type: 'generation-requested', ...requested, deadlineServerMs: attempt.deadline, baseRevision: packet.baseWorldRevision,
      evidence: packet.changes.map(({ id, version }) => ({ id, version })), context: packet.context.map(({ id, version }) => ({ id, version })) });
    status.textContent = 'Generating from available lecture evidence… existing world remains visible.';
    const result = await post('/generate', request, attempt.controller.signal);
    guard(current, attempt);
    const submission = result.submission as Submission | null;
    receipt(current, packet.planId, { type: 'generation-received', ...stamp(), requestId: result.requestId, action: submission?.action ?? null });
    if (!submission) throw new Error('No accepted model submission');
    if (submission.action === 'defer') {
      terminal(current, attempt, `deferred: ${submission.reason}`);
      note(`${packet.planId}: deferred — ${submission.reason}`); status.textContent = 'Deferred: more evidence is needed.'; return;
    }
    const options = { signal: attempt.controller.signal, beforeCommit: () => guard(current, attempt) };
    const commit = submission.action === 'add'
      ? await world.addProgram({ id: `run-${current.sequence}-${packet.planId}`, source: submission.source, baseRevision: packet.baseWorldRevision }, upperNow() / 1000, options)
      : submission.action === 'edit'
        ? await world.apply({ changes: submission.changes, remove: submission.remove, baseRevision: packet.baseWorldRevision }, upperNow() / 1000, options)
        : (() => { throw new Error('Unknown submission action'); })();
    attempt.committedRevision = commit.revision; committedAt = stamp();
    committedContext.record({ revision: commit.revision, runId: current.id, planId: packet.planId,
      committedAtMs: commit.committedAt * 1000,
      evidence: { changes: packet.changes.map(({ id, version }) => ({ id, version })), context: packet.context.map(({ id, version }) => ({ id, version })) },
      operation: submission.action === 'add'
        ? { action: 'add', programId: `run-${current.sequence}-${packet.planId}`, source: submission.source }
        : { action: 'edit', patch: { changes: submission.changes, remove: submission.remove, baseRevision: packet.baseWorldRevision } } });
    receipt(current, packet.planId, { type: 'world-committed', ...committedAt, worldCommittedAtMs: commit.committedAt * 1000, worldRevision: commit.revision });
    guard(current, attempt);
    if (renderError) throw renderError;
    const submitted = await waitForRender(commit.revision, current, attempt);
    // Do not advance past the actual submission stamp before committing it.
    // This continuation runs immediately after render() resolves its waiter.
    attempt.controller.signal.throwIfAborted();
    if (current.stopped || run !== current || document.hidden || submitted.serverUpperMs >= attempt.deadline) throw new Error('Renderer submission no longer eligible');
    const outcome = current.replay!.commit(packet.planId, { status: 'render-submitted', atMs: submitted.serverUpperMs,
      committedAtMs: commit.committedAt * 1000, baseWorldRevision: packet.baseWorldRevision, worldRevision: commit.revision, currentWorldRevision: world.revision });
    attempt.terminal = true;
    committedContext.markRendered(commit.revision);
    receipt(current, packet.planId, { type: 'render-submitted', ...submitted, committedBrowserAtMs: committedAt.browserAtMs, outcome });
    drain(current);
    note(`${packet.planId}: revision ${commit.revision} submitted to renderer (${submission.action}); pixels and correctness unverified.`);
    status.textContent = `Revision ${commit.revision} submitted. Listening for more evidence.`;
  } catch (error) {
    const reason = message(error);
    // Corrections already cancelled/requeued the scheduler plan. Other failures retire it.
    terminal(current, attempt, reason);
    if (attempt.corrected) for (const change of packet.changes) {
      const seen = current.seen.get(change.id); if (seen?.version === change.version) seen.pending = true;
    }
    cancelServer(current, attempt);
    receipt(current, packet.planId, { type: 'attempt-ended', ...stamp(), reason, committedWorldRevision: attempt.committedRevision ?? null, renderSubmitted: false });
    note(`${packet.planId}: ${reason}${committedAt ? ' (world committed; no successful render receipt)' : ''}`);
    if (!current.stopped) status.textContent = `Attempt ended: ${reason}`;
  } finally {
    clearTimeout(timer); signal.removeEventListener('abort', onCorrection);
    // Keep the dispatch slot occupied until cancellation cleanup is acknowledged.
    // Waiting never extends any evidence's original source deadline.
    if (attempt.cancelPromise) await attempt.cancelPromise;
    if (current.active === attempt) current.active = undefined;
  }
}
function ingest(current: Run, event: ProducerEvent) {
  if (current.stopped) return;
  const delivered = stamp();
  if (event.serverClockDomain !== clock!.clockDomain) throw new Error('Server clock domain changed');
  if (event.type === 'source-clock') {
    if (current.replay) throw new Error('Repeated source clock; refusing to rebase evidence');
    if (!event.sourceId || !Number.isFinite(event.monotonicStartMs)) throw new Error('Invalid source clock');
    current.clocks[event.sourceId] = { sourceStartMs: event.sourceStartMs, monotonicStartMs: event.monotonicStartMs!, rate: event.rate };
    current.replay = new MediaReplay({ sourceClocks: current.clocks, maxActivePlans: 1, maxContextEvents: 24, maxEvidence: 512 });
    receipt(current, null, { type: 'source-clock-delivered', ...delivered, sourceClock: event });
    note('Source clock received. Only delivered evidence can enter a plan.'); return;
  }
  if (event.type !== 'trial' && event.type !== 'frame') {
    receipt(current, null, { type: 'producer-event-delivered', ...delivered, producer: event });
    if (['source-complete', 'session-stopped', 'session-error', 'worker-error', 'frame-error', 'model-failed', 'error'].includes(event.type)) note(`Producer ${event.type}${event.reason || event.error ? `: ${event.reason ?? event.error}` : ''}`);
    if (event.type === 'session-stopped') void stop();
    return;
  }
  if (!current.replay) throw new Error('Evidence arrived before its source clock');
  let seen: Seen, result: string;
  if (event.type === 'frame') {
    const source = current.clocks[event.sourceId!]; if (!source) throw new Error('Unknown frame source');
    const ready = source.monotonicStartMs + (event.sourceTimeMs! - (source.sourceStartMs ?? 0)) / (source.rate ?? 1);
    result = current.replay.ingestFrame({ id: event.id!, version: event.version ?? 1, sourceId: event.sourceId!, sourceTimeMs: event.sourceTimeMs!, arrivedAtMs: event.arrivedAtMs!, frameRef: event.frameRef! });
    seen = { id: event.id!, version: event.version ?? 1, availableAtMs: Math.max(ready, event.arrivedAtMs!), stable: true, pending: true };
  } else {
    const python = event.python; if (!python || !event.availability || event.availability.kind !== 'observed-host-bracket') throw new Error('Missing observed host ASR bracket');
    result = current.replay.ingestAsrTrial({ id: python.receipt.id, version: event.version ?? 1, sourceId: python.receipt.sourceId,
      trial: python.trial, trialRef: python.trialRef, availability: event.availability });
    seen = { id: python.receipt.id, version: event.version ?? 1, availableAtMs: event.availability.trialReceivedAtMs, stable: !!python.trial.text, pending: true };
  }
  if (result === 'queued' && (!current.seen.has(seen.id) || current.seen.get(seen.id)!.version < seen.version)) current.seen.set(seen.id, seen);
  receipt(current, null, { type: 'evidence-delivered', ...delivered, id: seen.id, version: seen.version, producerAvailableAtMs: seen.availableAtMs, ingestResult: result });
  advance(current);
}
function poll() {
  const current = run;
  if (!current || current.stopped || !current.replay) return;
  try {
    advance(current);
    if (current.active || document.hidden) return;
    const now = upperNow();
    const contextIds = [...current.seen.values()].filter(item => item.stable && !item.pending && item.availableAtMs <= now).slice(-24).map(item => item.id);
    const next = current.replay.take(now, { worldRevision: world.revision, contextIds });
    if (next) {
      for (const change of next.packet.changes) { const seen = current.seen.get(change.id); if (seen?.version === change.version) seen.pending = false; }
      void generate(current, next.packet, next.signal);
    }
  } catch (error) { note(`Scheduling failed: ${message(error)}`); void stop(); }
}
async function measureClock() {
  const browserBeforeMs = performance.now(), response = await fetch('/clock', { cache: 'no-store', signal: AbortSignal.timeout(5000) });
  const result = await response.json(), browserAfterMs = performance.now();
  if (!response.ok || !Number.isFinite(result.serverTimeMs) || result.serverTimeMs < 0 || typeof result.clockDomain !== 'string') throw new Error('Invalid server clock response');
  clock = { clockDomain: result.clockDomain, serverTimeMs: result.serverTimeMs, browserBeforeMs, browserAfterMs,
    offsetLowerMs: result.serverTimeMs - browserAfterMs, offsetUpperMs: result.serverTimeMs - browserBeforeMs };
  clockLabel.textContent = `Conservative clock estimate · offset [${clock.offsetLowerMs.toFixed(1)}, ${clock.offsetUpperMs.toFixed(1)}] ms · ${clock.clockDomain}. Bounds come from one round trip; clock drift is not measured.`;
}
async function start() {
  if (run || starting || closing) return;
  starting = true; startButton.disabled = true; status.textContent = 'Starting lecture source…';
  try {
    if (!clock) await measureClock();
    const result = await post('/start', {}, AbortSignal.timeout(15000));
    if (typeof result.runId !== 'string' || !result.runId) throw new Error('Missing run ID');
    const current: Run = { id: result.runId, sequence: ++runSequence, stopped: false, clocks: {}, seen: new Map() }; run = current;
    const source = current.source = new EventSource(`/events?runId=${encodeURIComponent(current.id)}`);
    source.onmessage = event => { try { ingest(current, JSON.parse(event.data)); } catch (error) { note(`Evidence stream failed: ${message(error)}`); void stop(); } };
    source.onerror = () => { if (!current.stopped) { note('Evidence stream disconnected; stopping this run.'); void stop(); } };
    receipt(current, null, { type: 'client-started', ...stamp(), worldRevision: world.revision });
    note(`Run ${current.id} started at world revision ${world.revision}.`);
    stopButton.disabled = false; status.textContent = 'Listening for lecture evidence…';
  } catch (error) { status.textContent = `Start failed: ${message(error)}`; note(status.textContent); }
  finally { starting = false; startButton.disabled = !!run || closing; }
}
async function stop() {
  const current = run; if (!current || current.stopped) return;
  closing = true; current.stopped = true; current.source?.close(); stopButton.disabled = true;
  if (current.active) { terminal(current, current.active, 'user-or-stream-stop'); cancelServer(current, current.active); }
  receipt(current, null, { type: 'client-stopped', ...stamp(), worldRevision: world.revision });
  current.replay?.dispose(); drain(current); run = undefined;
  status.textContent = 'Stopped. The existing world remains visible.'; note('Run stopped; existing world retained.');
  try { await post('/stop', { runId: current.id }, AbortSignal.timeout(5000)); }
  catch (error) { note(`Stop delivery failed: ${message(error)}`); }
  finally { closing = false; startButton.disabled = starting; }
}
startButton.addEventListener('click', () => void start());
stopButton.addEventListener('click', () => void stop());
document.addEventListener('visibilitychange', () => {
  const current = run;
  if (document.hidden && current?.active) { terminal(current, current.active, 'page-hidden'); cancelServer(current, current.active); note('Active attempt retired because the page became hidden.'); }
});
window.addEventListener('pagehide', () => { void stop(); disposed = true; clearInterval(poller); world.dispose(); renderer.dispose(); });
const poller = setInterval(poll, 50);
try {
  await renderer.prepare([]); status.textContent = `Ready · ${renderer.backend}. Start to receive lecture evidence.`; startButton.disabled = false;
  requestAnimationFrame(animate);
} catch (error) { status.textContent = `Renderer initialization failed: ${message(error)}`; note(status.textContent); }

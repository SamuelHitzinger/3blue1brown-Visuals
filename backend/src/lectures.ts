import { Database } from 'bun:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { proxyUser } from './identity.js';
import { AgentError } from './agents/config.js';
import { parseLectureNotes } from './agents/lecture.js';
import type { LectureSession, LectureSummary, LectureSource, LectureSynthesizer, LectureVisualGenerator, LectureVisualization, LectureVisualInput } from '../../shared/lecture.js';

const MAX_SOURCE = 40_000, MAX_TOTAL_SOURCE = 250_000, MAX_SOURCES = 1200, MAX_BODY_BYTES = 500_000, MAX_VISUALIZATIONS = 24;
const NO_SYNTHESIS = 'Your lecture material is saved. Connect the server AI service, then retry updating the notes.';
const NO_VISUALIZATION = 'Your notes are saved. Connect the server visualization service, then retry this explanation.';
type Row = { id: string; owner: string; key: string; input: string; snapshot: string };
type Work = { id: string; visualId?: string; controller: AbortController; done: Promise<void> };
type VisualJob = { sourceRevision: number; input: LectureVisualInput };
export class LectureError extends Error { constructor(message: string, readonly status = 400) { super(message); } }

function failureMessage(error: unknown, visual = false): string {
  const subject = visual ? 'visual explanation' : 'notes';
  if (error instanceof AgentError && ['AUTH', 'CONFIG', 'MODEL'].includes(error.code)) return `Your lecture material is saved. The server AI connection needs attention before it can update your ${subject}. Please retry after it is restored.`;
  if (error instanceof AgentError && error.code === 'LIMIT') return `Your lecture material is saved. The AI service is busy or has reached its usage limit. Retry the ${subject} shortly.`;
  return `Your lecture material and previous results are saved. We could not update the ${subject}. Please retry.`;
}
function field(value: unknown, name: string, max: number, allowEmpty = false): string {
  if (typeof value !== 'string' || (!allowEmpty && !value.trim())) throw new LectureError(`Provide ${name}.`);
  if (value.length > max) throw new LectureError(`${name} must contain at most ${max.toLocaleString('en-US')} characters.`, 413);
  return allowEmpty ? value : value.trim();
}
const summary = ({ schemaVersion, id, title, courseId, createdAt, updatedAt, revision, sourceRevision, synthesizedRevision, status }: LectureSession): LectureSummary =>
  ({ schemaVersion, id, title, ...(courseId ? { courseId } : {}), createdAt, updatedAt, revision, sourceRevision, synthesizedRevision, status });

/** Release worker capacity even if an injected provider ignores the cancellation signal. */
function abortable<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener('abort', abort, { once: true });
    work.then(value => { signal.removeEventListener('abort', abort); resolve(value); }, error => { signal.removeEventListener('abort', abort); reject(error); });
    if (signal.aborted) abort();
  });
}

/** One-process durable queue. Sources and personal edits are saved before model work begins. */
export class LectureService {
  private db: Database;
  private active = new Map<string, Work>();
  private pendingProviders = new Set<Promise<void>>();
  private stopped = false;
  private closePromise?: Promise<void>;
  private concurrency: number;
  private synthesisTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private deleteListeners = new Set<(id: string) => void>();

  constructor(path: string, private synthesize?: LectureSynthesizer,
    private options: { visualize?: LectureVisualGenerator; concurrency?: number; synthesisTimeoutMs?: number; visualizationTimeoutMs?: number; synthesisDebounceMs?: number } = {}) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new Database(path, { create: true });
    this.db.exec(`PRAGMA journal_mode=WAL;
      CREATE TABLE IF NOT EXISTS lectures (id TEXT PRIMARY KEY, owner TEXT NOT NULL, key TEXT NOT NULL, input TEXT NOT NULL, snapshot TEXT NOT NULL, UNIQUE(owner,key));
      CREATE TABLE IF NOT EXISTS lecture_source_keys (lecture TEXT NOT NULL, key TEXT NOT NULL, text TEXT NOT NULL, source TEXT NOT NULL, PRIMARY KEY(lecture,key));
      CREATE TABLE IF NOT EXISTS lecture_visual_inputs (id TEXT PRIMARY KEY, lecture TEXT NOT NULL, input TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS lectures_owner ON lectures(owner);`);
    this.concurrency = Number.isFinite(options.concurrency) ? Math.max(1, Math.min(4, Math.floor(options.concurrency!))) : 2;
    for (const row of this.rows()) {
      const session = this.decode(row);
      let interrupted = false;
      if (session.status === 'processing') { session.status = 'queued'; interrupted = true; }
      for (const visual of session.visualizations) if (visual.status === 'processing') { visual.status = 'queued'; interrupted = true; }
      if (interrupted) this.save(session);
    }
    this.kick();
  }

  private rows(): Row[] { return this.db.query('SELECT * FROM lectures ORDER BY rowid').all() as Row[]; }
  private row(id: string): Row | null { return this.db.query('SELECT * FROM lectures WHERE id = ?').get(id) as Row | null; }
  private decode(row: Row): LectureSession { return JSON.parse(row.snapshot); }
  private snapshot(id: string): LectureSession | undefined { const row = this.row(id); return row ? this.decode(row) : undefined; }
  /** Host-only access: callers supply the already authenticated storage owner. */
  getOwned(owner: string, id: string): LectureSession | undefined {
    if (this.stopped) return undefined;
    const row = this.row(id); return row?.owner === owner ? this.decode(row) : undefined;
  }
  onDelete(listener: (id: string) => void): () => void {
    this.deleteListeners.add(listener); return () => { this.deleteListeners.delete(listener); };
  }
  appendSource(owner: string, id: string, key: string, text: string, capture?: LectureSource['capture']): LectureSession {
    if (this.stopped) throw new LectureError('The lecture service is restarting. Please try again.', 503);
    field(key, 'an Idempotency-Key', 128); field(text, 'lecture text', MAX_SOURCE);
    const session = this.getOwned(owner, id); if (!session) throw new LectureError('Not Found', 404);
    const prior = this.db.query('SELECT text FROM lecture_source_keys WHERE lecture = ? AND key = ?').get(id, key) as { text: string } | null;
    if (prior) { if (prior.text !== text) throw new LectureError('This Idempotency-Key was already used for different lecture text.', 409); return session; }
    if (session.sources.length >= MAX_SOURCES || session.sources.reduce((total, source) => total + source.text.length, 0) + text.length > MAX_TOTAL_SOURCE) throw new LectureError('This lecture is full. Start another session to continue adding material.', 413);
    const source: LectureSource = { id: crypto.randomUUID(), sequence: session.sourceRevision + 1, kind: 'text', text, createdAt: new Date().toISOString(), ...(capture ? { capture } : {}) };
    session.sources.push(source); session.sourceRevision++; this.prepareSynthesis(session);
    this.db.transaction(() => { this.db.query('INSERT INTO lecture_source_keys VALUES (?, ?, ?, ?)').run(id, key, text, source.id); this.save(session); })();
    const debounce = this.options.synthesisDebounceMs ?? 0;
    if (debounce > 0) {
      clearTimeout(this.synthesisTimers.get(id));
      this.synthesisTimers.set(id, setTimeout(() => { this.synthesisTimers.delete(id); this.kick(); }, debounce));
    }
    this.kick(); return session;
  }
  private trackProvider<T>(work: Promise<T>): Promise<T> {
    const settled = work.then(() => {}, () => {});
    this.pendingProviders.add(settled);
    void settled.then(() => { this.pendingProviders.delete(settled); });
    return work;
  }
  private save(session: LectureSession) {
    session.revision++; session.updatedAt = new Date().toISOString();
    this.db.query('UPDATE lectures SET snapshot = ? WHERE id = ?').run(JSON.stringify(session), session.id);
  }
  private prepareSynthesis(session: LectureSession) {
    session.status = this.synthesize ? (this.active.has(`${session.id}:notes`) ? 'processing' : 'queued') : 'failed';
    if (this.synthesize) delete session.error; else session.error = NO_SYNTHESIS;
  }
  private enqueueVisual(session: LectureSession, conceptId: string): LectureVisualization {
    const concept = session.notes?.concepts.find(concept => concept.id === conceptId);
    if (!concept) throw new LectureError('This lecture concept is unavailable. Update the notes and try again.', 404);
    const current = session.visualizations.find(visual => visual.conceptId === conceptId);
    if (!current && session.visualizations.length >= MAX_VISUALIZATIONS) throw new LectureError('This lecture has reached its limit of 24 visual explanations. Start another session for more.', 409);
    if (current && (current.status === 'queued' || current.status === 'processing' || (current.status === 'ready' && current.sourceRevision === session.synthesizedRevision))) return current;
    // Keep the last working scene and its true revision visible during a refresh or failure.
    const visual: LectureVisualization = { ...(current?.source ? current : {}), id: current?.id ?? crypto.randomUUID(), conceptId, title: concept.title,
      sourceRevision: current?.source ? current.sourceRevision : session.synthesizedRevision, status: this.options.visualize ? 'queued' : 'failed', catalogIds: current?.source ? current.catalogIds : [...concept.catalogIds],
      ...(!this.options.visualize ? { error: NO_VISUALIZATION } : {}) };
    if (this.options.visualize) delete visual.error;
    const job: VisualJob = { sourceRevision: session.synthesizedRevision, input: { title: session.title, concept,
      sources: session.sources.filter(source => source.sequence <= session.synthesizedRevision) } };
    this.db.query('INSERT OR REPLACE INTO lecture_visual_inputs VALUES (?, ?, ?)').run(visual.id, session.id, JSON.stringify(job));
    if (current) session.visualizations.splice(session.visualizations.indexOf(current), 1, visual); else session.visualizations.push(visual);
    return visual;
  }

  private kick() {
    if (this.stopped) return;
    // Notes get first choice of capacity; one long visual can never occupy both default workers.
    for (const row of this.rows()) {
      if (this.active.size >= this.concurrency) break;
      const session = this.decode(row), key = `${session.id}:notes`;
      if (session.status === 'queued' && !this.active.has(key) && !this.synthesisTimers.has(session.id)) this.start(session.id);
    }
    if ([...this.active.values()].some(work => work.visualId)) return;
    for (const row of this.rows()) {
      if (this.active.size >= this.concurrency) break;
      const session = this.decode(row);
      for (const visual of session.visualizations) {
        if (visual.status === 'queued') { this.start(session.id, visual.id); return; }
      }
    }
  }
  private start(id: string, visualId?: string) {
    const key = `${id}:${visualId ?? 'notes'}`, controller = new AbortController();
    const work: Work = { id, visualId, controller, done: Promise.resolve() };
    this.active.set(key, work);
    work.done = Promise.resolve().then(async () => {
      if (this.stopped || controller.signal.aborted || !this.row(id)) return;
      // A lecture inference has a bounded lifetime independent of the upload connection.
      const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(visualId ? (this.options.visualizationTimeoutMs ?? 6 * 60_000) : (this.options.synthesisTimeoutMs ?? 2 * 60_000))]);
      if (visualId) await this.runVisual(id, visualId, signal); else await this.runNotes(id, signal);
    }).catch(() => {
      // Storage failures must not become unhandled rejections or expose source/provider details.
      if (!this.stopped && !controller.signal.aborted) {
        const session = this.snapshot(id);
        if (session) {
          if (visualId) { const visual = session.visualizations.find(item => item.id === visualId); if (visual) { visual.status = 'failed'; visual.error = failureMessage(undefined, true); } }
          else { session.status = 'failed'; session.error = failureMessage(undefined); }
          this.save(session);
        }
      }
    }).finally(() => { this.active.delete(key); this.kick(); });
  }
  private async runNotes(id: string, signal: AbortSignal) {
    const initial = this.snapshot(id)!;
    initial.status = 'processing'; delete initial.error; this.save(initial);
    const revision = initial.sourceRevision;
    try {
      if (!this.synthesize) throw new AgentError('CONFIG', NO_SYNTHESIS);
      const result = await abortable(this.trackProvider(this.synthesize({ title: initial.title, sources: initial.sources, previousNotes: initial.notes }, signal)), signal);
      signal.throwIfAborted();
      const notes = parseLectureNotes(JSON.stringify(result), initial.sources, initial.notes);
      if (this.stopped) return;
      const current = this.snapshot(id); if (!current) return;
      const previousIds = new Set(initial.notes?.concepts.map(concept => concept.id) ?? []);
      current.notes = notes; current.synthesizedRevision = revision;
      current.status = current.sourceRevision > revision ? 'queued' : 'idle'; delete current.error;
      // Only one newly discovered concept is automatic. Other concepts remain deliberate requests.
      const firstNew = current.visualizations.length < MAX_VISUALIZATIONS
        ? notes.concepts.find(concept => !previousIds.has(concept.id) && !current.visualizations.some(visual => visual.conceptId === concept.id)) : undefined;
      this.db.transaction(() => { if (firstNew) this.enqueueVisual(current, firstNew.id); this.save(current); })();
    } catch (error) {
      if (this.stopped || !this.row(id)) return;
      const current = this.snapshot(id)!;
      current.status = current.sourceRevision > revision && this.synthesize ? 'queued' : 'failed';
      if (current.status === 'failed') current.error = this.synthesize ? failureMessage(error) : NO_SYNTHESIS;
      this.save(current);
    }
  }
  private async runVisual(id: string, visualId: string, signal: AbortSignal) {
    const initial = this.snapshot(id)!, visual = initial.visualizations.find(item => item.id === visualId);
    if (!visual) return;
    visual.status = 'processing'; delete visual.error; this.save(initial);
    try {
      if (!this.options.visualize) throw new AgentError('CONFIG', NO_VISUALIZATION);
      const stored = this.db.query('SELECT input FROM lecture_visual_inputs WHERE id = ? AND lecture = ?').get(visualId, id) as { input: string } | null;
      if (!stored) throw new Error('Visualization input is unavailable.');
      const job: VisualJob = JSON.parse(stored.input);
      const result = await abortable(this.trackProvider(this.options.visualize(job.input, signal)), signal);
      signal.throwIfAborted();
      if (typeof result.source !== 'string' || !result.source.trim() || result.source.length > 256_000 || !Number.isFinite(result.duration) || result.duration <= 0 || result.duration > 600 || !Array.isArray(result.catalogIds) || result.catalogIds.length > 20 || result.catalogIds.some(id => typeof id !== 'string' || id.length > 80)) throw new Error('Invalid visual result.');
      if (this.stopped) return;
      const current = this.snapshot(id), target = current?.visualizations.find(item => item.id === visualId);
      if (!current || !target) return;
      target.source = result.source; target.duration = result.duration; target.catalogIds = result.catalogIds;
      target.sourceRevision = job.sourceRevision;
      if (result.assets) target.assets = result.assets; else delete target.assets;
      target.status = 'ready'; delete target.error; this.save(current);
    } catch (error) {
      if (this.stopped || !this.row(id)) return;
      const current = this.snapshot(id)!, target = current.visualizations.find(item => item.id === visualId);
      if (target) { target.status = 'failed'; target.error = this.options.visualize ? failureMessage(error, true) : NO_VISUALIZATION; this.save(current); }
    }
  }

  close(): Promise<void> {
    if (this.closePromise) return this.closePromise;
    this.stopped = true;
    for (const timer of this.synthesisTimers.values()) clearTimeout(timer);
    this.synthesisTimers.clear();
    for (const work of this.active.values()) work.controller.abort();
    this.closePromise = Promise.all([...this.active.values()].map(work => work.done)).then(async () => {
      // Capacity is released on abort, but provider finally blocks can still be
      // deleting private authoring files. Give them a bounded shutdown grace.
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        if (this.pendingProviders.size) await Promise.race([
          Promise.all([...this.pendingProviders]),
          new Promise<void>(resolve => { timer = setTimeout(resolve, 5_000); }),
        ]);
      } finally { if (timer !== undefined) clearTimeout(timer); this.db.close(); }
    });
    return this.closePromise;
  }

  async handle(request: Request): Promise<Response> {
    const headers = { 'Cache-Control': 'private, no-store', Vary: 'X-User-Id' };
    const json = (value: unknown, status = 200) => Response.json(value, { status, headers });
    const method = (allow: string) => Response.json({ detail: 'Method Not Allowed' }, { status: 405, headers: { ...headers, Allow: allow } });
    if (this.stopped) return json({ detail: 'The lecture service is restarting. Please try again.' }, 503);
    try {
      const url = new URL(request.url), user = proxyUser(request), owner = user ? `user:${user.id}` : 'local';
      let path: string; try { path = decodeURIComponent(url.pathname); } catch { throw new LectureError('Invalid URL.'); }
      const match = /^\/api\/lectures(?:\/([a-f0-9-]{36})(?:\/(sources|synthesize|concepts)(?:\/([a-z0-9][a-z0-9_-]{0,79})\/visualize)?)?)?$/.exec(path);
      if (!match || (match[2] === 'concepts') !== !!match[3]) return json({ detail: 'Not Found' }, 404);
      if (!['GET', 'HEAD'].includes(request.method)) {
        const origin = request.headers.get('origin'), protocol = request.headers.get('x-forwarded-proto') ?? url.protocol.slice(0, -1);
        const publicOrigin = process.env.NARRATION_PUBLIC_ORIGIN ?? `${protocol}://${url.host}`;
        if (request.headers.get('sec-fetch-site') === 'cross-site' || (origin && origin !== publicOrigin)) throw new LectureError('Invalid origin.', 403);
      }
      const key = () => field(request.headers.get('Idempotency-Key'), 'an Idempotency-Key', 128);
      const body = async (): Promise<Record<string, unknown>> => {
        const reader = request.body?.getReader(); if (!reader) throw new LectureError('Provide a JSON request body.');
        const chunks: Uint8Array[] = []; let size = 0;
        try {
          while (true) {
            request.signal.throwIfAborted();
            const next = await reader.read(); if (next.done) break;
            size += next.value.byteLength;
            if (size > MAX_BODY_BYTES) { await reader.cancel(); throw new LectureError('The request is too large. Add smaller lecture chunks.', 413); }
            chunks.push(next.value);
          }
        } finally { reader.releaseLock(); }
        let value: unknown;
        try { value = JSON.parse(await new Blob(chunks.map(chunk => new Uint8Array(chunk))).text()); }
        catch { throw new LectureError('Provide a valid JSON request body.'); }
        if (!value || typeof value !== 'object' || Array.isArray(value)) throw new LectureError('Provide a JSON object.');
        return value as Record<string, unknown>;
      };
      if (!match[1]) {
        if (request.method === 'GET') return json((this.db.query('SELECT * FROM lectures WHERE owner = ? ORDER BY rowid DESC').all(owner) as Row[]).map(row => summary(this.decode(row))));
        if (request.method !== 'POST') return method('GET, POST');
        const idempotency = key(), input = await body(), title = field(input.title, 'a lecture title', 200);
        const courseId = input.courseId === undefined ? undefined : field(input.courseId, 'a course ID', 200);
        const normalized = JSON.stringify({ title, ...(courseId ? { courseId } : {}) });
        const prior = this.db.query('SELECT * FROM lectures WHERE owner = ? AND key = ?').get(owner, idempotency) as Row | null;
        if (prior) { if (prior.input !== normalized) throw new LectureError('This Idempotency-Key was already used for a different lecture.', 409); return json(this.decode(prior), 201); }
        const now = new Date().toISOString();
        const session: LectureSession = { schemaVersion: 1, id: crypto.randomUUID(), title, ...(courseId ? { courseId } : {}),
          createdAt: now, updatedAt: now, revision: 0, sourceRevision: 0, synthesizedRevision: 0, status: 'idle', sources: [], notes: null, personalNotes: '', visualizations: [] };
        this.db.query('INSERT INTO lectures VALUES (?, ?, ?, ?, ?)').run(session.id, owner, idempotency, normalized, JSON.stringify(session));
        return json(session, 201);
      }
      const id = match[1], row = this.row(id);
      if (!row || row.owner !== owner) return json({ detail: 'Not Found' }, 404);
      // Parse request bodies before taking mutable snapshots; another request can finish during a read.
      if (!match[2]) {
        if (request.method === 'GET') return json(this.decode(row));
        if (request.method === 'DELETE') {
          clearTimeout(this.synthesisTimers.get(id)); this.synthesisTimers.delete(id);
          for (const work of this.active.values()) if (work.id === id) work.controller.abort();
          this.db.transaction(() => {
            this.db.query('DELETE FROM lecture_source_keys WHERE lecture = ?').run(id);
            this.db.query('DELETE FROM lecture_visual_inputs WHERE lecture = ?').run(id);
            this.db.query('DELETE FROM lectures WHERE id = ?').run(id);
          })();
          for (const listener of this.deleteListeners) listener(id);
          return new Response(null, { status: 204, headers });
        }
        if (request.method !== 'PATCH') return method('GET, PATCH, DELETE');
        const input = await body();
        if (input.title === undefined && input.personalNotes === undefined) throw new LectureError('Provide a title or personalNotes.');
        const title = input.title === undefined ? undefined : field(input.title, 'a lecture title', 200);
        const personalNotes = input.personalNotes === undefined ? undefined : field(input.personalNotes, 'personal notes', 100_000, true);
        const session = this.snapshot(id); if (!session) throw new LectureError('Not Found', 404);
        if (title !== undefined) session.title = title;
        if (personalNotes !== undefined) session.personalNotes = personalNotes;
        this.save(session); return json(session);
      }
      if (request.method !== 'POST') return method('POST');
      if (match[2] === 'sources') {
        const idempotency = key(), input = await body();
        if (input.kind !== undefined && input.kind !== 'text') throw new LectureError('Use this endpoint for typed or pasted text. Connect a phone to add photos or audio.');
        field(input.text, 'lecture text', MAX_SOURCE);
        const text = input.text as string; // Preserve indentation, notation and line breaks exactly as submitted.
        return json(this.appendSource(owner, id, idempotency, text), 202);
      }
      const session = this.snapshot(id)!;
      if (match[2] === 'synthesize') {
        clearTimeout(this.synthesisTimers.get(id)); this.synthesisTimers.delete(id);
        if (!session.sources.length) throw new LectureError('Add lecture text before updating the notes.');
        this.prepareSynthesis(session);
        this.save(session);
      } else this.db.transaction(() => { this.enqueueVisual(session, match[3]); this.save(session); })();
      this.kick(); return json(session, 202);
    } catch (error) {
      if (error instanceof LectureError) return json({ detail: error.message }, error.status);
      return json({ detail: 'We could not save this change. Your saved lecture material is still available. Please retry.' }, 503);
    }
  }
}

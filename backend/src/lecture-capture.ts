import { Database } from 'bun:sqlite';
import { createHash, randomBytes } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { proxyUser } from './identity.js';
import { LectureError, LectureService } from './lectures.js';
import type { CaptureCapabilities, CaptureExtractor, CaptureItem, CaptureMetadata, CaptureStatus } from '../../shared/lecture-capture.js';

const MAX_ITEM_BYTES = 5_000_000, MAX_PHOTO_BYTES = 2_000_000;
const MAX_STORED_BYTES = 64 * 1024 * 1024, MAX_ITEMS_PER_LECTURE = 2000;
const PAIR_TTL = 10 * 60_000, DEVICE_TTL = 4 * 60 * 60_000;
const FAILURE = 'This capture could not be read. Its recording is saved; retry processing it.';
const headers = { 'Cache-Control': 'private, no-store', Vary: 'Authorization, X-User-Id', 'Referrer-Policy': 'no-referrer' };
const json = (value: unknown, status = 200) => Response.json(value, { status, headers });
class CaptureError extends Error { constructor(message: string, readonly status = 400) { super(message); } }
type PairRow = { id: string; lecture: string; owner: string; secret_hash: string; device_hash: string | null;
  created_at: number; pair_expires: number; device_expires: number | null; revoked: number; last_seen: number | null };
type ItemRow = { id: string; pairing: string; lecture: string; owner: string; client_id: string; metadata: string;
  fingerprint: string; mime: string; bytes: Uint8Array | null; status: CaptureItem['status']; error: string | null; normalized: string | null };
export interface LectureCaptureOptions {
  extract?: CaptureExtractor;
  publicOrigin?: string;
  photo?: boolean;
  audio?: boolean;
  concurrency?: number;
  itemTimeoutMs?: number;
  maxPendingPerLecture?: number;
  maxPendingGlobal?: number;
  now?: () => number;
}
const hash = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
const ownerOf = (request: Request) => { const user = proxyUser(request); return user ? `user:${user.id}` : 'local'; };
const isSecret = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new CaptureError('Provide a valid object.');
  return value as Record<string, unknown>;
};
function metadataOf(value: unknown): CaptureMetadata {
  const input = object(value);
  if (typeof input.clientId !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(input.clientId)) throw new CaptureError('Provide a valid capture ID.');
  if (!Number.isSafeInteger(input.sequence) || (input.sequence as number) < 0 || (input.sequence as number) > 1_000_000) throw new CaptureError('Provide a valid capture sequence.');
  if (input.kind !== 'photo' && input.kind !== 'audio') throw new CaptureError('Choose photo or audio capture.');
  if (typeof input.capturedAt !== 'string' || input.capturedAt.length > 64 || !/^\d{4}-\d\d-\d\dT/.test(input.capturedAt) || !Number.isFinite(Date.parse(input.capturedAt))) throw new CaptureError('Provide a valid capture time.');
  if (input.kind === 'audio' && (typeof input.durationMs !== 'number' || !Number.isFinite(input.durationMs) || input.durationMs <= 0 || input.durationMs > 45_000)) throw new CaptureError('Audio clips must last at most 45 seconds.');
  if (input.kind === 'photo' && input.durationMs !== undefined) throw new CaptureError('Photos cannot have an audio duration.');
  return { clientId: input.clientId, sequence: input.sequence as number, kind: input.kind, capturedAt: new Date(input.capturedAt).toISOString(),
    ...(input.kind === 'audio' ? { durationMs: input.durationMs as number } : {}) };
}
function mediaType(file: File, bytes: Uint8Array, metadata: CaptureMetadata): string {
  const mime = file.type.toLowerCase().split(';')[0].trim(), prefix = Buffer.from(bytes.subarray(0, 16));
  if (metadata.kind === 'photo') {
    if (mime !== 'image/jpeg' || bytes[0] !== 255 || bytes[1] !== 216 || bytes[2] !== 255) throw new CaptureError('Capture photos as JPEG images.', 415);
    return mime;
  }
  const normalized = mime === 'audio/x-wav' ? 'audio/wav' : mime === 'audio/x-m4a' ? 'audio/mp4' : mime;
  const valid = normalized === 'audio/mp4' ? prefix.toString('ascii', 4, 8) === 'ftyp'
    : normalized === 'audio/webm' ? prefix.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))
    : normalized === 'audio/ogg' ? prefix.toString('ascii', 0, 4) === 'OggS'
    : normalized === 'audio/wav' ? prefix.toString('ascii', 0, 4) === 'RIFF' && prefix.toString('ascii', 8, 12) === 'WAVE' : false;
  if (!valid) throw new CaptureError('Capture audio as a complete MP4, WebM, Ogg, or WAV clip.', 415);
  return normalized;
}
async function readBody(request: Request, limit: number): Promise<Uint8Array> {
  const length = Number(request.headers.get('content-length'));
  if (Number.isFinite(length) && length > limit) throw new CaptureError('This capture is too large. Use a shorter recording.', 413);
  const reader = request.body?.getReader(); if (!reader) throw new CaptureError('Provide a request body.');
  const parts: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      request.signal.throwIfAborted(); const next = await reader.read(); if (next.done) break;
      size += next.value.byteLength;
      if (size > limit) { await reader.cancel(); throw new CaptureError('This capture is too large. Use a shorter recording.', 413); }
      parts.push(next.value);
    }
  } finally { reader.releaseLock(); }
  request.signal.throwIfAborted();
  const bytes = new Uint8Array(size); let offset = 0;
  for (const part of parts) { bytes.set(part, offset); offset += part.length; }
  return bytes;
}
async function readJson(request: Request) {
  const bytes = await readBody(request, 8192);
  try { return object(JSON.parse(new TextDecoder().decode(bytes))); }
  catch { throw new CaptureError('Provide valid JSON.'); }
}
function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason); signal.addEventListener('abort', abort, { once: true });
    promise.then(value => { signal.removeEventListener('abort', abort); resolve(value); }, error => { signal.removeEventListener('abort', abort); reject(error); });
    if (signal.aborted) abort();
  });
}

/** Durable media acceptance is independent of both the phone connection and model latency. */
export class LectureCaptureService {
  private db: Database;
  private origin?: string;
  private stopped = false;
  private closePromise?: Promise<void>;
  private unsubscribe: () => void;
  private active = new Map<string, { lecture: string; controller: AbortController; done: Promise<void> }>();
  private now: () => number;
  constructor(path: string, private lectures: LectureService, private options: LectureCaptureOptions = {}) {
    this.now = options.now ?? Date.now;
    if (options.publicOrigin) {
      try {
        const url = new URL(options.publicOrigin);
        if (url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash && url.pathname === '/' && options.publicOrigin.replace(/\/$/, '') === url.origin) this.origin = url.origin;
      } catch { /* An untrusted or incomplete public address must never enter a pairing URL. */ }
    }
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new Database(path, { create: true });
    this.db.exec(`PRAGMA journal_mode=WAL;
      CREATE TABLE IF NOT EXISTS capture_pairings (
        id TEXT PRIMARY KEY, lecture TEXT NOT NULL, owner TEXT NOT NULL, secret_hash TEXT NOT NULL UNIQUE,
        device_hash TEXT UNIQUE, created_at INTEGER NOT NULL, pair_expires INTEGER NOT NULL,
        device_expires INTEGER, revoked INTEGER NOT NULL DEFAULT 0, last_seen INTEGER);
      CREATE INDEX IF NOT EXISTS capture_pairings_lecture ON capture_pairings(lecture);
      CREATE TABLE IF NOT EXISTS capture_items (
        id TEXT PRIMARY KEY, pairing TEXT NOT NULL, lecture TEXT NOT NULL, owner TEXT NOT NULL,
        client_id TEXT NOT NULL, metadata TEXT NOT NULL, fingerprint TEXT NOT NULL, mime TEXT NOT NULL,
        bytes BLOB, status TEXT NOT NULL, error TEXT, normalized TEXT, UNIQUE(pairing, client_id));
      CREATE INDEX IF NOT EXISTS capture_items_lecture ON capture_items(lecture);
      CREATE INDEX IF NOT EXISTS capture_items_queue ON capture_items(status);
      UPDATE capture_items SET status = 'queued' WHERE status = 'processing';`);
    this.unsubscribe = lectures.onDelete(id => this.removeLecture(id));
    for (const pairing of this.db.query('SELECT * FROM capture_pairings').all() as PairRow[]) {
      if (!lectures.getOwned(pairing.owner, pairing.lecture)) this.removeLecture(pairing.lecture);
    }
    this.kick();
  }
  private capabilities(): CaptureCapabilities {
    const photo = !!this.options.extract && this.options.photo !== false, audio = !!this.options.extract && this.options.audio !== false;
    const available = !!this.origin && (photo || audio);
    return { available, photo, audio, ...(this.origin ? { publicOrigin: this.origin } : {}),
      ...(!available ? { detail: this.origin ? 'Connect the lecture capture service on the computer to enable phone capture.' : 'Set up the private HTTPS capture address on the computer to connect your phone.' } : {}) };
  }
  private pair(id: string) { return this.db.query('SELECT * FROM capture_pairings WHERE id = ?').get(id) as PairRow | null; }
  private item(id: string) { return this.db.query('SELECT * FROM capture_items WHERE id = ?').get(id) as ItemRow | null; }
  private state(pairing: PairRow): CaptureStatus['state'] {
    if (pairing.revoked) return 'revoked';
    if ((pairing.device_hash ? pairing.device_expires! : pairing.pair_expires) <= this.now()) return 'expired';
    return pairing.device_hash ? 'connected' : 'waiting';
  }
  private publicItem(row: ItemRow): CaptureItem {
    const metadata: CaptureMetadata = JSON.parse(row.metadata);
    return { id: row.id, clientId: row.client_id, kind: metadata.kind, capturedAt: metadata.capturedAt, status: row.status, ...(row.error ? { error: row.error } : {}) };
  }
  private status(pairing: PairRow): CaptureStatus {
    const session = this.lectures.getOwned(pairing.owner, pairing.lecture);
    if (!session) throw new CaptureError('Not Found', 404);
    const items = this.db.query('SELECT id, client_id, metadata, status, error FROM capture_items WHERE pairing = ? ORDER BY rowid DESC').all(pairing.id) as ItemRow[];
    const recent = (kind: 'photo' | 'audio') => items.map(item => JSON.parse(item.metadata) as CaptureMetadata).filter(item => item.kind === kind).map(item => item.capturedAt).sort().at(-1);
    const lastPhotoAt = recent('photo'), lastAudioAt = recent('audio');
    return { id: pairing.id, lectureId: pairing.lecture, title: session.title, state: this.state(pairing),
      expiresAt: new Date(pairing.device_hash ? pairing.device_expires! : pairing.pair_expires).toISOString(),
      ...(pairing.last_seen !== null ? { lastSeenAt: new Date(pairing.last_seen).toISOString() } : {}),
      ...(lastPhotoAt ? { lastPhotoAt } : {}), ...(lastAudioAt ? { lastAudioAt } : {}),
      pending: items.filter(item => item.status === 'queued' || item.status === 'processing').length,
      processed: items.filter(item => item.status === 'ready').length, skipped: items.filter(item => item.status === 'skipped').length,
      failed: items.filter(item => item.status === 'failed').length, items: items.slice(0, 30).map(item => this.publicItem(item)) };
  }
  private checkOrigin(request: Request, device: boolean) {
    if (request.method === 'GET' || request.method === 'HEAD') return;
    const url = new URL(request.url), origin = request.headers.get('origin');
    const publicOrigin = device ? this.origin : process.env.NARRATION_PUBLIC_ORIGIN ?? `${request.headers.get('x-forwarded-proto') ?? url.protocol.slice(0, -1)}://${url.host}`;
    if (request.headers.get('sec-fetch-site') === 'cross-site' || (origin && origin !== publicOrigin)) throw new CaptureError('Invalid origin.', 403);
  }
  private device(request: Request): PairRow {
    const token = /^Bearer ([a-f0-9]{64})$/.exec(request.headers.get('authorization') ?? '')?.[1];
    if (!token) throw new CaptureError('Connect this phone again from the lecture page.', 401);
    const pair = this.db.query('SELECT * FROM capture_pairings WHERE device_hash = ?').get(hash(token)) as PairRow | null;
    if (!pair || this.state(pair) !== 'connected' || !this.lectures.getOwned(pair.owner, pair.lecture)) throw new CaptureError('This phone connection has ended. Connect it again from the lecture page.', 401);
    return pair;
  }
  private pending(lecture?: string) {
    return (this.db.query(`SELECT COUNT(*) AS count FROM capture_items WHERE status IN ('queued','processing')${lecture ? ' AND lecture = ?' : ''}`)
      .get(...(lecture ? [lecture] : [])) as { count: number }).count;
  }
  private checkCapacity(lecture: string, extra = 1) {
    if (this.pending(lecture) + extra > (this.options.maxPendingPerLecture ?? 12) || this.pending() + extra > (this.options.maxPendingGlobal ?? 48)) throw new CaptureError('Processing is catching up. Keep this phone open and retry shortly.', 429);
  }
  private removeLecture(id: string) {
    for (const work of this.active.values()) if (work.lecture === id) work.controller.abort();
    this.db.transaction(() => {
      this.db.query('DELETE FROM capture_items WHERE lecture = ?').run(id);
      this.db.query('DELETE FROM capture_pairings WHERE lecture = ?').run(id);
    })();
  }
  private kick() {
    if (this.stopped) return;
    const concurrency = Math.max(1, Math.min(2, Math.floor(this.options.concurrency ?? 2)));
    for (const row of this.db.query("SELECT id, lecture FROM capture_items WHERE status = 'queued' ORDER BY rowid").all() as ItemRow[]) {
      if (this.active.size >= concurrency) break;
      if (this.active.has(row.id)) continue;
      const controller = new AbortController(), work = { lecture: row.lecture, controller, done: Promise.resolve() };
      this.active.set(row.id, work);
      work.done = Promise.resolve().then(() => this.process(row.id, controller.signal)).catch(() => {
        if (!this.stopped && !controller.signal.aborted && this.item(row.id)) this.db.query("UPDATE capture_items SET status = 'failed', error = ? WHERE id = ?").run(FAILURE, row.id);
      }).finally(() => { this.active.delete(row.id); this.kick(); });
    }
  }
  private async process(id: string, cancelled: AbortSignal) {
    if (this.stopped || cancelled.aborted) return;
    const row = this.item(id); if (!row) return;
    if (!this.lectures.getOwned(row.owner, row.lecture)) { this.removeLecture(row.lecture); return; }
    this.db.query("UPDATE capture_items SET status = 'processing', error = NULL WHERE id = ?").run(id);
    const signal = AbortSignal.any([cancelled, AbortSignal.timeout(this.options.itemTimeoutMs ?? 120_000)]);
    try {
      const metadata: CaptureMetadata = JSON.parse(row.metadata);
      let normalized = row.normalized;
      if (normalized === null) {
        if (!this.options.extract || !row.bytes) throw new Error('Capture extraction is unavailable.');
        const extension = row.mime.split('/')[1];
        normalized = await abortable(this.options.extract(new File([new Uint8Array(row.bytes)], `capture.${extension}`, { type: row.mime }), metadata, signal), signal);
        signal.throwIfAborted();
        if (typeof normalized !== 'string' || normalized.length > 40_000) throw new Error('Invalid capture extraction.');
        if (this.stopped || !this.item(id)) return;
        // Persist the normalization before appending across the two durable stores. A retry
        // after a crash reuses identical text and the same source idempotency key.
        this.db.query('UPDATE capture_items SET normalized = ? WHERE id = ?').run(normalized, id);
      }
      signal.throwIfAborted();
      if (this.stopped || !this.item(id) || !this.lectures.getOwned(row.owner, row.lecture)) return;
      if (normalized.trim()) this.lectures.appendSource(row.owner, row.lecture, `capture:${id}`, normalized, {
        itemId: id, kind: metadata.kind, sequence: metadata.sequence, capturedAt: metadata.capturedAt,
        ...(metadata.durationMs === undefined ? {} : { durationMs: metadata.durationMs }),
      });
      this.db.query('UPDATE capture_items SET status = ?, bytes = NULL, normalized = NULL, error = NULL WHERE id = ?').run(normalized.trim() ? 'ready' : 'skipped', id);
    } catch {
      if (!this.stopped && !cancelled.aborted && this.item(id)) this.db.query("UPDATE capture_items SET status = 'failed', error = ? WHERE id = ?").run(FAILURE, id);
    }
  }
  close(): Promise<void> {
    if (this.closePromise) return this.closePromise;
    this.stopped = true; this.unsubscribe();
    for (const work of this.active.values()) work.controller.abort();
    this.closePromise = Promise.all([...this.active.values()].map(work => work.done)).then(() => { this.db.close(); });
    return this.closePromise;
  }
  private async guarded(action: () => Promise<Response>): Promise<Response> {
    if (this.stopped) return json({ detail: 'Capture is restarting. Retry shortly.' }, 503);
    try { return await action(); }
    catch (error) {
      if (error instanceof CaptureError || error instanceof LectureError) return json({ detail: error.message }, error.status);
      return json({ detail: 'We could not save this capture change. Please retry.' }, 503);
    }
  }
  handleOwner(request: Request): Promise<Response> {
    return this.guarded(async () => {
      this.checkOrigin(request, false);
      if (request.headers.has('authorization')) throw new CaptureError('Device tokens cannot manage lecture connections.', 403);
      const path = new URL(request.url).pathname;
      if (path === '/api/lecture-capture/config' && request.method === 'GET') return json(this.capabilities());
      const match = /^\/api\/lectures\/([a-f0-9-]{36})\/capture-pairings(?:\/([a-f0-9-]{36})(\/retry)?)?$/.exec(path);
      if (!match) return json({ detail: 'Not Found' }, 404);
      const owner = ownerOf(request), lecture = match[1];
      if (!this.lectures.getOwned(owner, lecture)) return json({ detail: 'Not Found' }, 404);
      if (!match[2]) {
        if (request.method === 'GET') {
          const latest = this.db.query('SELECT * FROM capture_pairings WHERE lecture = ? AND owner = ? ORDER BY rowid DESC LIMIT 1').get(lecture, owner) as PairRow | null;
          return json(latest ? this.status(latest) : null);
        }
        if (request.method !== 'POST') return json({ detail: 'Method Not Allowed' }, 405);
        if (!this.capabilities().available) throw new CaptureError(this.capabilities().detail!, 503);
        const secret = randomBytes(32).toString('hex'), id = crypto.randomUUID(), now = this.now();
        this.db.transaction(() => {
          this.db.query('UPDATE capture_pairings SET revoked = 1 WHERE lecture = ?').run(lecture);
          this.db.query('INSERT INTO capture_pairings (id, lecture, owner, secret_hash, created_at, pair_expires) VALUES (?, ?, ?, ?, ?, ?)').run(id, lecture, owner, hash(secret), now, now + PAIR_TTL);
        })();
        return json({ status: this.status(this.pair(id)!), url: `${this.origin}/capture#pair=${secret}` }, 201);
      }
      const pairing = this.pair(match[2]);
      if (!pairing || pairing.owner !== owner || pairing.lecture !== lecture) return json({ detail: 'Not Found' }, 404);
      if (match[3]) {
        if (request.method !== 'POST') return json({ detail: 'Method Not Allowed' }, 405);
        const failed = this.db.query("SELECT id FROM capture_items WHERE pairing = ? AND status = 'failed' AND bytes IS NOT NULL ORDER BY rowid").all(pairing.id) as Pick<ItemRow, 'id'>[];
        for (const row of failed) { try { this.checkCapacity(lecture); } catch { break; } this.db.query("UPDATE capture_items SET status = 'queued', error = NULL WHERE id = ?").run(row.id); }
        this.kick(); return json(this.status(pairing), 202);
      }
      if (request.method === 'GET') return json(this.status(pairing));
      if (request.method === 'DELETE') {
        this.db.query('UPDATE capture_pairings SET revoked = 1 WHERE id = ?').run(pairing.id);
        return json(this.status(this.pair(pairing.id)!));
      }
      return json({ detail: 'Method Not Allowed' }, 405);
    });
  }
  handleDevice(request: Request): Promise<Response> {
    return this.guarded(async () => {
      this.checkOrigin(request, true);
      const path = new URL(request.url).pathname;
      if (path === '/api/capture/config' && request.method === 'GET') return json(this.capabilities());
      if (path === '/api/capture/claim' && request.method === 'POST') {
        const input = await readJson(request);
        if (!isSecret(input.secret) || !isSecret(input.deviceToken)) throw new CaptureError('This phone connection is invalid. Create a new link.', 401);
        const pair = this.db.query('SELECT * FROM capture_pairings WHERE secret_hash = ?').get(hash(input.secret)) as PairRow | null;
        if (!pair || pair.revoked || !this.lectures.getOwned(pair.owner, pair.lecture)) throw new CaptureError('This phone connection is invalid or has expired.', 401);
        const deviceHash = hash(input.deviceToken);
        if (pair.device_hash) {
          if (pair.device_hash !== deviceHash || this.state(pair) !== 'connected') throw new CaptureError('This pairing link has already been used or has expired.', 401);
        } else {
          if (pair.pair_expires <= this.now()) throw new CaptureError('This pairing link has expired. Create a new link.', 401);
          const existing = this.db.query('SELECT id FROM capture_pairings WHERE device_hash = ?').get(deviceHash);
          if (existing) throw new CaptureError('Create a new phone connection.', 401);
          this.db.query('UPDATE capture_pairings SET device_hash = ?, device_expires = ?, last_seen = ? WHERE id = ?').run(deviceHash, this.now() + DEVICE_TTL, this.now(), pair.id);
        }
        return json({ token: input.deviceToken, status: this.status(this.pair(pair.id)!) });
      }
      if (!['/api/capture/status', '/api/capture/items'].includes(path) && !/^\/api\/capture\/items\/[a-f0-9-]{36}\/retry$/.test(path)) return json({ detail: 'Not Found' }, 404);
      let pair = this.device(request);
      if (path === '/api/capture/status' && request.method === 'GET') {
        this.db.query('UPDATE capture_pairings SET last_seen = ? WHERE id = ?').run(this.now(), pair.id);
        return json(this.status(this.pair(pair.id)!));
      }
      const retry = /^\/api\/capture\/items\/([a-f0-9-]{36})\/retry$/.exec(path);
      if (retry && request.method === 'POST') {
        const row = this.item(retry[1]); if (!row || row.pairing !== pair.id) return json({ detail: 'Not Found' }, 404);
        if (row.status === 'failed') {
          if (!row.bytes) throw new CaptureError('This recording is no longer available.', 409);
          this.checkCapacity(pair.lecture); this.db.query("UPDATE capture_items SET status = 'queued', error = NULL WHERE id = ?").run(row.id);
        }
        this.kick(); return json(this.publicItem(this.item(row.id)!), 202);
      }
      if (path !== '/api/capture/items' || request.method !== 'POST') return json({ detail: 'Method Not Allowed' }, 405);
      const contentType = request.headers.get('content-type');
      if (!contentType?.toLowerCase().startsWith('multipart/form-data;')) throw new CaptureError('Upload a capture file with its metadata.', 415);
      const bytes = await readBody(request, MAX_ITEM_BYTES + 65_536);
      pair = this.device(request);
      let form: FormData;
      try { form = await new Response(new Uint8Array(bytes), { headers: { 'Content-Type': contentType } }).formData(); }
      catch { throw new CaptureError('Upload a valid capture file and metadata.'); }
      const raw = form.get('metadata'), file = form.get('file');
      if (form.getAll('metadata').length !== 1 || form.getAll('file').length !== 1 || typeof raw !== 'string' || raw.length > 8192 || !(file instanceof File)) throw new CaptureError('Upload one capture file and its metadata.');
      let input: unknown; try { input = JSON.parse(raw); } catch { throw new CaptureError('Provide valid capture metadata.'); }
      const metadata = metadataOf(input);
      if (!file.size || file.size > (metadata.kind === 'photo' ? MAX_PHOTO_BYTES : MAX_ITEM_BYTES)) throw new CaptureError('This capture is empty or too large.', 413);
      const media = new Uint8Array(await file.arrayBuffer()), mime = mediaType(file, media, metadata);
      // Revocation, expiry and lecture deletion may have occurred while streaming the upload.
      pair = this.device(request); request.signal.throwIfAborted();
      const normalizedMetadata = JSON.stringify(metadata), fingerprint = hash(`${normalizedMetadata}\n${mime}\n${hash(media)}`);
      const prior = this.db.query('SELECT * FROM capture_items WHERE pairing = ? AND client_id = ?').get(pair.id, metadata.clientId) as ItemRow | null;
      if (prior) {
        if (prior.fingerprint !== fingerprint) throw new CaptureError('This capture ID was already used for different material.', 409);
        return json(this.publicItem(prior), 202);
      }
      if (!this.capabilities()[metadata.kind]) throw new CaptureError('This capture type is not connected on the computer.', 503);
      this.checkCapacity(pair.lecture);
      const retained = (this.db.query('SELECT COALESCE(SUM(length(bytes)), 0) AS size FROM capture_items').get() as { size: number }).size;
      if (retained + media.length > MAX_STORED_BYTES) throw new CaptureError('Capture storage is full. Retry failed recordings or delete an old lecture before continuing.', 413);
      const count = (this.db.query('SELECT COUNT(*) AS count FROM capture_items WHERE lecture = ?').get(pair.lecture) as { count: number }).count;
      if (count >= MAX_ITEMS_PER_LECTURE) throw new CaptureError('This lecture has reached its capture limit. Start another lecture.', 413);
      const id = crypto.randomUUID();
      this.db.transaction(() => {
        this.db.query("INSERT INTO capture_items (id, pairing, lecture, owner, client_id, metadata, fingerprint, mime, bytes, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'queued')")
          .run(id, pair.id, pair.lecture, pair.owner, metadata.clientId, normalizedMetadata, fingerprint, mime, media);
        this.db.query('UPDATE capture_pairings SET last_seen = ? WHERE id = ?').run(this.now(), pair.id);
      })();
      const accepted = this.publicItem(this.item(id)!); this.kick(); return json(accepted, 202);
    });
  }
}

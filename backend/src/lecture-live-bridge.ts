import { Database } from 'bun:sqlite';
import { createHash, randomBytes } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { LectureError, LectureService } from './lectures.js';
import { proxyUser } from './identity.js';
import { isTrustedAppRequest } from './request-origin.js';
import type { CaptureMetadata } from '../../shared/lecture-capture.js';

const TTL = 8 * 60 * 60_000, PHOTO_TTL = 15 * 60_000;
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const headers = { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer', Vary: 'Authorization, X-User-Id' };
const json = (data: unknown, status = 200) => Response.json(data, { status, headers });
type Grant = { id: string; lecture: string; owner: string; token_hash: string; expires: number };
type Frame = { id: string; lecture: string; captured: string; received: number; mime: string; bytes: Uint8Array };

/** A revocable capability for one lecture. Never an alternate owner API. */
export class LectureLiveBridge {
  private db: Database;
  private unsubscribe: () => void;
  private timer: ReturnType<typeof setInterval>;
  constructor(path: string, private lectures: LectureService, private now = Date.now) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new Database(path, { create: true });
    this.db.exec(`PRAGMA journal_mode=WAL;
      CREATE TABLE IF NOT EXISTS live_grants (lecture TEXT PRIMARY KEY, id TEXT NOT NULL, owner TEXT NOT NULL, token_hash TEXT UNIQUE NOT NULL, expires INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS live_frames (id TEXT PRIMARY KEY, lecture TEXT NOT NULL, captured TEXT NOT NULL, received INTEGER NOT NULL, mime TEXT NOT NULL, bytes BLOB NOT NULL);
      CREATE INDEX IF NOT EXISTS live_frames_lecture ON live_frames(lecture);
      CREATE TABLE IF NOT EXISTS live_batches (grant_id TEXT NOT NULL, batch_id TEXT NOT NULL, input TEXT NOT NULL, PRIMARY KEY(grant_id,batch_id));`);
    this.unsubscribe = lectures.onDelete(id => this.remove(id));
    this.prune();
    this.timer = setInterval(() => this.prune(), 60_000); this.timer.unref();
  }
  private remove(lecture: string) {
    this.db.transaction(() => {
      this.db.query('DELETE FROM live_batches WHERE grant_id IN (SELECT id FROM live_grants WHERE lecture = ?)').run(lecture);
      this.db.query('DELETE FROM live_frames WHERE lecture = ?').run(lecture);
      this.db.query('DELETE FROM live_grants WHERE lecture = ?').run(lecture);
    })();
  }
  private prune() {
    for (const row of this.db.query('SELECT * FROM live_grants').all() as Grant[]) {
      if (row.expires <= this.now() || !this.lectures.getOwned(row.owner, row.lecture)) this.remove(row.lecture);
    }
    this.db.query('DELETE FROM live_frames WHERE received <= ?').run(this.now() - PHOTO_TTL);
  }
  close() { clearInterval(this.timer); this.unsubscribe(); this.db.close(); }
  /** Receives the exact validated bytes accepted by capture, before extraction discards them. */
  recordPhoto(owner: string, lecture: string, id: string, metadata: CaptureMetadata, mime: string, bytes: Uint8Array) {
    this.prune();
    const grant = this.db.query('SELECT * FROM live_grants WHERE lecture = ? AND owner = ?').get(lecture, owner);
    if (!grant || metadata.kind !== 'photo' || !['image/jpeg', 'image/png', 'image/webp'].includes(mime) || bytes.length > 2_000_000) return;
    this.db.transaction(() => {
      this.db.query('INSERT OR IGNORE INTO live_frames VALUES (?, ?, ?, ?, ?, ?)').run(id, lecture, metadata.capturedAt, this.now(), mime, bytes);
      this.db.query('DELETE FROM live_frames WHERE lecture = ? AND rowid NOT IN (SELECT rowid FROM live_frames WHERE lecture = ? ORDER BY rowid DESC LIMIT 8)').run(lecture, lecture);
      this.db.query('DELETE FROM live_frames WHERE rowid NOT IN (SELECT rowid FROM live_frames ORDER BY rowid DESC LIMIT 32)').run();
    })();
  }
  private async guard(action: () => Promise<Response>) {
    try { this.prune(); return await action(); }
    catch (error) { return error instanceof LectureError ? json({ detail: error.message }, error.status) : json({ detail: 'Lecture bridge unavailable. Retry shortly.' }, 503); }
  }
  handleOwner(request: Request) {
    return this.guard(async () => {
      if (request.headers.has('authorization')) throw new LectureError('Plugin tokens cannot manage connections.', 403);
      const url = new URL(request.url);
      if (!isTrustedAppRequest(request)) throw new LectureError('Invalid origin.', 403);
      const match = /^\/api\/lectures\/([a-f0-9-]{36})\/live-bridge$/.exec(url.pathname);
      if (!match || !uuid.test(match[1])) return json({ detail: 'Not Found' }, 404);
      const user = proxyUser(request), owner = user ? `user:${user.id}` : 'local', lecture = match[1];
      if (!this.lectures.getOwned(owner, lecture)) throw new LectureError('Not Found', 404);
      if (request.method === 'GET') {
        const grant = this.db.query('SELECT * FROM live_grants WHERE lecture = ?').get(lecture) as Grant | null;
        return json({ active: !!grant, ...(grant ? { expiresAt: new Date(grant.expires).toISOString() } : {}) });
      }
      if (request.method === 'DELETE') { this.remove(lecture); return json({ active: false }); }
      if (request.method !== 'POST') return json({ detail: 'Method Not Allowed' }, 405);
      const token = randomBytes(32).toString('hex'), expires = this.now() + TTL;
      this.db.transaction(() => {
        this.remove(lecture);
        this.db.query('INSERT INTO live_grants VALUES (?, ?, ?, ?, ?)').run(lecture, crypto.randomUUID(), owner, hash(token), expires);
      })();
      return json({ token, lectureId: lecture, expiresAt: new Date(expires).toISOString() }, 201);
    });
  }
  handlePlugin(request: Request) {
    return this.guard(async () => {
      // Browser origins and forwarded identities cannot turn this capability into broader access.
      if (request.headers.has('origin') || request.headers.has('x-user-id')) throw new LectureError('Use the configured MCP connection.', 403);
      const token = /^Bearer ([a-f0-9]{64})$/.exec(request.headers.get('authorization') ?? '')?.[1];
      const grant = token ? this.db.query('SELECT * FROM live_grants WHERE token_hash = ?').get(hash(token)) as Grant | null : null;
      if (!grant) throw new LectureError('Connection expired or revoked. Connect this lecture again on the computer.', 401);
      const session = this.lectures.getOwned(grant.owner, grant.lecture)!;
      const path = new URL(request.url).pathname;
      if (path === '/api/live-bridge/context' && request.method === 'GET') return json({ id: session.id, title: session.title,
        serverTime: new Date(this.now()).toISOString(), sourceRevision: session.sourceRevision, notesCover: session.synthesizedRevision,
        status: session.status, summary: session.notes?.summary ?? '', sections: session.notes?.sections.map(s => ({ id: s.id, title: s.title })) ?? [],
        expiresAt: new Date(grant.expires).toISOString(), warning: 'Speech is supplied by ChatGPT tool calls, not a continuous or verified verbatim transcript. Camera photos are pulled on demand.' });
      if (path === '/api/live-bridge/frames' && request.method === 'GET') {
        const rows = this.db.query('SELECT * FROM live_frames WHERE lecture = ? ORDER BY rowid').all(grant.lecture) as Frame[];
        return json({ frames: rows.map(f => ({ id: f.id, capturedAt: f.captured, receivedAt: new Date(f.received).toISOString(), mimeType: f.mime, data: Buffer.from(f.bytes).toString('base64') })), retentionMinutes: 15, maxFrames: 8 });
      }
      if (path !== '/api/live-bridge/speech') return json({ detail: 'Not Found' }, 404);
      if (request.method !== 'POST') return json({ detail: 'Method Not Allowed' }, 405);
      const reader = request.body?.getReader(); if (!reader) throw new LectureError('Provide a speech batch.');
      const chunks: Uint8Array[] = []; let size = 0;
      try { while (true) { const next = await reader.read(); if (next.done) break; size += next.value.length;
        if (size > 100_000) { await reader.cancel(); throw new LectureError('Speech batch too large.', 413); } chunks.push(next.value); } }
      finally { reader.releaseLock(); }
      let body: any;
      try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new LectureError('Provide valid JSON.'); }
      if (!body || typeof body !== 'object' || typeof body.batchId !== 'string' || !uuid.test(body.batchId) || typeof body.text !== 'string' || !body.text.trim()) throw new LectureError('Provide a UUID batchId and speech text.');
      if (body.text.length > 20_000) throw new LectureError('Use speech batches below 20,000 characters.', 413);
      const ids: string[] = body.frameIds ?? [];
      if (!Array.isArray(ids) || ids.length > 8 || ids.some(id => typeof id !== 'string' || !uuid.test(id)) || new Set(ids).size !== ids.length) throw new LectureError('Provide up to eight distinct frame IDs.');
      // Recheck after streaming: a grant may be revoked while a request body arrives.
      this.prune();
      if (!this.db.query('SELECT id FROM live_grants WHERE id = ?').get(grant.id)) throw new LectureError('Connection expired or revoked.', 401);
      const input = JSON.stringify({ text: body.text, frameIds: ids });
      const prior = this.db.query('SELECT input FROM live_batches WHERE grant_id = ? AND batch_id = ?').get(grant.id, body.batchId) as { input: string } | null;
      if (prior && prior.input !== input) throw new LectureError('This batchId was already used for different material.', 409);
      if (!prior) {
        for (const id of ids) if (!this.db.query('SELECT id FROM live_frames WHERE id = ? AND lecture = ?').get(id, grant.lecture)) throw new LectureError('A referenced photo expired or belongs to another lecture. Retrieve current frames first.');
        const count = (this.db.query('SELECT COUNT(*) AS n FROM live_batches WHERE grant_id = ?').get(grant.id) as { n: number }).n;
        if (count >= 1200) throw new LectureError('This connection has reached its speech batch limit.', 413);
        // Save before appending: crash recovery can retry after referenced frames expire.
        this.db.query('INSERT INTO live_batches VALUES (?, ?, ?)').run(grant.id, body.batchId, input);
      }
      const text = `[ChatGPT Live speech notes — not a verified verbatim transcript. Preserve uncertainty; do not fill missing speech. Camera references: ${ids.join(', ') || 'none'}.]\n${body.text}`;
      const saved = this.lectures.appendSource(grant.owner, grant.lecture, `live:${grant.id}:${body.batchId}`, text);
      return json({ accepted: true, duplicate: !!prior, lectureId: saved.id, sourceRevision: saved.sourceRevision, notesCover: saved.synthesizedRevision, status: saved.status }, 202);
    });
  }
}

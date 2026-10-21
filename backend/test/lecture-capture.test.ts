import { afterEach, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LectureService } from '../src/lectures.js';
import { LectureCaptureService } from '../src/lecture-capture.js';
import type { CaptureClaim, CaptureMetadata, CapturePairing, CaptureStatus } from '../../shared/lecture-capture.js';

const cleanup: (() => Promise<unknown>)[] = [];
afterEach(async () => { for (const close of cleanup.splice(0).reverse()) await close(); });
const ownerRequest = (path: string, method = 'GET', owner = 'alice') => new Request(`http://localhost${path}`, { method, headers: { 'x-user-id': owner } });
const deviceRequest = (path: string, token: string, method = 'GET', body?: BodyInit) => new Request(`https://phone.example/api/capture${path}`, {
  method, headers: { Authorization: `Bearer ${token}`, Origin: 'https://phone.example' }, ...(body ? { body } : {}),
});
const jpeg = new Uint8Array([255, 216, 255, 224, 0, 16, 1]);
const metadata = (clientId = 'item-1', kind: 'photo' | 'audio' = 'photo'): CaptureMetadata => ({ clientId, kind, sequence: 1,
  capturedAt: '2026-10-14T10:00:00.000Z', ...(kind === 'audio' ? { durationMs: 20_000 } : {}) });
const form = (meta = metadata(), bytes: Uint8Array = jpeg, mime = 'image/jpeg') => {
  const extension = meta.kind === 'photo' ? 'jpg' : /mp4|m4a/.test(mime) ? 'm4a' : /wav/.test(mime) ? 'wav' : /ogg/.test(mime) ? 'ogg' : 'webm';
  const body = new FormData(); body.set('metadata', JSON.stringify(meta)); body.set('file', new File([new Uint8Array(bytes)], `capture.${extension}`, { type: mime })); return body;
};
async function until<T>(read: () => Promise<T>, check: (value: T) => boolean): Promise<T> {
  for (let i = 0; i < 300; i++) { const value = await read(); if (check(value)) return value; await Bun.sleep(5); }
  throw new Error('Capture work did not finish');
}
async function setup(options: ConstructorParameters<typeof LectureCaptureService>[2] = {}, path = ':memory:') {
  const lectures = new LectureService(':memory:'); cleanup.push(() => lectures.close());
  const lecture = await (await lectures.handle(new Request('http://localhost/api/lectures', { method: 'POST',
    headers: { 'x-user-id': 'alice', 'Idempotency-Key': 'lecture' }, body: JSON.stringify({ title: 'Private lecture' }) }))).json();
  const capture = new LectureCaptureService(path, lectures, { publicOrigin: 'https://phone.example', extract: async () => 'A vector has direction.', ...options });
  cleanup.push(() => capture.close());
  const route = `/api/lectures/${lecture.id}/capture-pairings`;
  const pairing = await (await capture.handleOwner(ownerRequest(route, 'POST'))).json() as CapturePairing;
  const secret = new URLSearchParams(new URL(pairing.url).hash.slice(1)).get('pair')!;
  const token = 'a'.repeat(64);
  const claimRequest = (deviceToken = token) => new Request('https://phone.example/api/capture/claim', { method: 'POST',
    headers: { Origin: 'https://phone.example' }, body: JSON.stringify({ secret, deviceToken }) });
  const claim = await (await capture.handleDevice(claimRequest())).json() as CaptureClaim;
  const status = async () => (await (await capture.handleOwner(ownerRequest(`${route}/${pairing.status.id}`))).json()) as CaptureStatus;
  return { lectures, lecture, capture, route, pairing, secret, token, claim, claimRequest, status };
}

test('retained photo snippets are cropped, owner-scoped, and removed with the lecture', async () => {
  const photoSnippet = { crop: { x: 0.25, y: 0.25, width: 0.5, height: 0.5 }, description: 'Experimental trace' };
  const s = await setup({ extract: async () => ({ text: 'Damping trace', photoSnippet, visualEvidence: 'Horizontal time axis' }) });
  const photo = new Uint8Array(await createCanvas(800, 600).encode('jpeg'));
  await s.capture.handleDevice(deviceRequest('/items', s.token, 'POST', form(metadata(), photo)));
  await until(s.status, value => value.processed === 1);
  const source = s.lectures.getOwned('user:alice', s.lecture.id)!.sources[0];
  expect(source.capture?.photoSnippet).toEqual(photoSnippet);
  expect(source.capture?.visualEvidence).toBe('Horizontal time axis');
  const path = `/api/lectures/${s.lecture.id}/sources/${source.id}/photo-snippet`;
  const response = await s.capture.handleOwner(ownerRequest(path));
  expect(response.status).toBe(200); expect(response.headers.get('content-type')).toBe('image/jpeg');
  expect(response.headers.get('cache-control')).toContain('no-store');
  const image = await loadImage(Buffer.from(await response.arrayBuffer()));
  expect([image.width, image.height]).toEqual([400, 300]);
  expect((await s.capture.handleOwner(ownerRequest(path, 'GET', 'bob'))).status).toBe(404);
  const device = ownerRequest(path); device.headers.set('Authorization', `Bearer ${s.token}`);
  expect((await s.capture.handleOwner(device)).status).toBe(403);
  expect((await s.capture.handleOwner(ownerRequest(path.replace(source.id, crypto.randomUUID())))).status).toBe(404);
  await s.lectures.handle(ownerRequest(`/api/lectures/${s.lecture.id}`, 'DELETE'));
  expect((await s.capture.handleOwner(ownerRequest(path))).status).toBe(404);
});

test('animation frame cache resolves only arrived owner sources and evicts old frames', async () => {
 const s=await setup();
 const ids:string[]=[];
 for(let i=0;i<9;i++){
  await s.capture.handleDevice(deviceRequest('/items',s.token,'POST',form(metadata(`frame-${i}`))));
  await until(s.status,value=>value.processed===i+1);
  ids.push(s.lectures.getOwned('user:alice',s.lecture.id)!.sources.at(-1)!.id);
 }
 expect(s.capture.readAnimationFrame('user:alice',s.lecture.id,ids[0])).toBeUndefined();
 const frame=s.capture.readAnimationFrame('user:alice',s.lecture.id,ids[8]);
 expect(frame?.bytes).toEqual(jpeg);expect(frame?.mimeType).toBe('image/jpeg');
 frame!.bytes[0]=0;
 expect(s.capture.readAnimationFrame('user:alice',s.lecture.id,ids[8])!.bytes[0]).toBe(255);
 expect(s.capture.readAnimationFrame('user:bob',s.lecture.id,ids[8])).toBeUndefined();
 expect(s.capture.readAnimationFrame('user:alice',s.lecture.id,crypto.randomUUID())).toBeUndefined();
 await s.lectures.handle(ownerRequest(`/api/lectures/${s.lecture.id}`,'DELETE'));
 expect(s.capture.readAnimationFrame('user:alice',s.lecture.id,ids[8])).toBeUndefined();
 await s.capture.close();expect(s.capture.readAnimationFrame('user:alice',s.lecture.id,ids[8])).toBeUndefined();
});

test('uploaded frame cannot resolve before its extracted source has arrived',async()=>{
 let release!:(text:string)=>void;const gate=new Promise<string>(resolve=>{release=resolve;});
 const s=await setup({extract:async()=>gate});
 const upload=await(await s.capture.handleDevice(deviceRequest('/items',s.token,'POST',form()))).json();
 expect(s.lectures.getOwned('user:alice',s.lecture.id)!.sources).toEqual([]);
 expect(s.capture.readAnimationFrame('user:alice',s.lecture.id,upload.id)).toBeUndefined();
 release('Arrived diagram');await until(s.status,value=>value.processed===1);
 const source=s.lectures.getOwned('user:alice',s.lecture.id)!.sources[0];
 expect(s.capture.readAnimationFrame('user:alice',s.lecture.id,source.id)?.bytes).toEqual(jpeg);
});

test('slow photos leave extraction capacity for newly arriving audio', async () => {
  const started: string[] = [];
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const s = await setup({ extract: async (_file, meta) => { started.push(meta.clientId); if (meta.kind === 'photo') await gate; return 'A new fact'; } });
  await s.capture.handleDevice(deviceRequest('/items', s.token, 'POST', form(metadata('photo-1'))));
  await s.capture.handleDevice(deviceRequest('/items', s.token, 'POST', form(metadata('photo-2'))));
  const audio = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0]);
  await s.capture.handleDevice(deviceRequest('/items', s.token, 'POST', form(metadata('audio', 'audio'), audio, 'audio/webm')));
  await Bun.sleep(20);
  try { expect(started).toEqual(['photo-1', 'audio']); }
  finally { release(); }
  await until(s.status, value => value.processed === 3);
});

test('two stalled transcriptions and a photo do not block fresh speech', async () => {
  const started: string[] = [];
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const s = await setup({ extract: async (_file, meta) => {
    started.push(meta.clientId);
    if (meta.clientId !== 'fresh') await gate;
    return 'A new fact';
  } });
  const audio = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0]);
  try {
    await s.capture.handleDevice(deviceRequest('/items', s.token, 'POST', form(metadata('photo'))));
    for (const id of ['slow-1', 'slow-2', 'fresh']) {
      await s.capture.handleDevice(deviceRequest('/items', s.token, 'POST', form(metadata(id, 'audio'), audio, 'audio/webm')));
    }
    await until(s.status, value => value.processed === 1);
    expect(started).toEqual(['photo', 'slow-1', 'slow-2', 'fresh']);
  } finally { release(); }
  await until(s.status, value => value.processed === 4);
});

test('invalid optional crop retains text and diagram evidence without exposing the full frame', async () => {
  const s = await setup({ extract: async () => ({ text: 'Readable text', visualEvidence: 'Arrow points right', photoSnippet: { crop: { x: 0, y: 0, width: 1, height: 1 }, description: 'Full frame' } }) });
  await s.capture.handleDevice(deviceRequest('/items', s.token, 'POST', form()));
  await until(s.status, value => value.processed === 1);
  const source = s.lectures.getOwned('user:alice', s.lecture.id)!.sources[0];
  expect(source.text).toBe('Readable text'); expect(source.capture?.visualEvidence).toBe('Arrow points right');
  expect(source.capture?.photoSnippet).toBeUndefined();
  expect((await s.capture.handleOwner(ownerRequest(`/api/lectures/${s.lecture.id}/sources/${source.id}/photo-snippet`))).status).toBe(404);
});

test('photo details and crop survive a crash before source append without another extraction', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'aha-photo-recovery-')); cleanup.push(() => rm(dir, { recursive: true, force: true }));
  const path = join(dir, 'capture.sqlite'); let calls = 0;
  const photoSnippet = { crop: { x: 0.2, y: 0.1, width: 0.5, height: 0.5 }, description: 'Measured trace' };
  const s = await setup({ extract: async () => { calls++; return { text: 'Measured trace', photoSnippet, visualEvidence: 'Horizontal axis' }; } }, path);
  const append = s.lectures.appendSource.bind(s.lectures);
  s.lectures.appendSource = () => { throw new Error('Synthetic crash before append'); };
  const photo = new Uint8Array(await createCanvas(800, 600).encode('jpeg'));
  const item = await (await s.capture.handleDevice(deviceRequest('/items', s.token, 'POST', form(metadata(), photo)))).json();
  await until(s.status, value => value.failed === 1); await s.capture.close();
  const db = new Database(path);
  try {
    const row = db.query('SELECT bytes, snippet, extracted_detail, normalized FROM capture_items WHERE id = ?').get(item.id) as any;
    expect(row.bytes).not.toBeNull(); expect(row.snippet.length).toBeGreaterThan(0);
    expect(JSON.parse(row.extracted_detail).photoSnippet).toEqual(photoSnippet); expect(row.normalized).toBe('Measured trace');
    db.query("UPDATE capture_items SET status = 'processing' WHERE id = ?").run(item.id);
  } finally { db.close(); }
  s.lectures.appendSource = append;
  const resumed = new LectureCaptureService(path, s.lectures, { publicOrigin: 'https://phone.example', extract: async () => { calls++; throw new Error('Must reuse normalization'); } });
  cleanup.push(() => resumed.close());
  await until(async () => (await (await resumed.handleDevice(deviceRequest('/status', s.token))).json()) as CaptureStatus, value => value.processed === 1);
  expect(calls).toBe(1);
  const source = s.lectures.getOwned('user:alice', s.lecture.id)!.sources[0];
  expect(source.capture?.photoSnippet).toEqual(photoSnippet); expect(source.capture?.visualEvidence).toBe('Horizontal axis');
  expect((await resumed.handleOwner(ownerRequest(`/api/lectures/${s.lecture.id}/sources/${source.id}/photo-snippet`))).status).toBe(200);
});

test('legacy capture stores gain optional photo columns without changing existing records', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'aha-photo-migration-')); cleanup.push(() => rm(dir, { recursive: true, force: true }));
  const path = join(dir, 'capture.sqlite'), db = new Database(path);
  db.exec(`CREATE TABLE capture_items (id TEXT PRIMARY KEY, pairing TEXT NOT NULL, lecture TEXT NOT NULL, owner TEXT NOT NULL,
    client_id TEXT NOT NULL, metadata TEXT NOT NULL, fingerprint TEXT NOT NULL, mime TEXT NOT NULL, bytes BLOB,
    status TEXT NOT NULL, error TEXT, normalized TEXT, UNIQUE(pairing, client_id));`);
  db.close();
  const s = await setup({}, path);
  await s.capture.handleDevice(deviceRequest('/items', s.token, 'POST', form()));
  await until(s.status, value => value.processed === 1);
  expect(s.lectures.getOwned('user:alice', s.lecture.id)?.sources[0].text).toBe('A vector has direction.');
});

test('phone status reports notes backlog and failure without exposing notes or source text', async () => {
  const s = await setup();
  await s.capture.handleDevice(deviceRequest('/items', s.token, 'POST', form()));
  await until(s.status, value => value.processed === 1);
  const status = await (await s.capture.handleDevice(deviceRequest('/status', s.token))).json();
  expect(status.notes).toEqual({ status: 'failed', sourceRevision: 1, synthesizedRevision: 0,
    pendingSources: 1, pendingSince: expect.any(String) });
  expect(JSON.stringify(status)).not.toContain('A vector has direction.');
  expect(JSON.stringify(status)).not.toContain('personalNotes');
});

test('pairing claims are retryable for one token, owner scoped, and expose no lecture content', async () => {
  const s = await setup();
  expect(s.claim.token).toBe(s.token); expect(s.claim.status.state).toBe('connected');
  expect((await s.capture.handleDevice(s.claimRequest())).status).toBe(200);
  expect((await s.capture.handleDevice(s.claimRequest('b'.repeat(64)))).status).toBe(401);
  expect((await s.capture.handleOwner(ownerRequest(s.route, 'GET', 'bob'))).status).toBe(404);
  expect((await s.capture.handleDevice(deviceRequest(`/lectures/${s.lecture.id}`, s.token))).status).toBe(404);
  expect(JSON.stringify(s.claim)).not.toMatch(/personalNotes|sources|deviceHash|secretHash/);
  expect((await s.capture.handleDevice(deviceRequest('/config', '', 'GET'))).status).toBe(200);
});

test('automatic QR creation cannot revoke a device claimed or paired by another tab', async () => {
  const s = await setup();
  for (const previous of ['none', s.pairing.status.id]) {
    const request = ownerRequest(s.route, 'POST');
    request.headers.set('X-Capture-Previous', previous);
    expect((await s.capture.handleOwner(request)).status).toBe(409);
    expect((await s.status()).state).toBe('connected');
  }
  await s.capture.handleOwner(ownerRequest(`${s.route}/${s.pairing.status.id}`, 'DELETE'));
  const replace = ownerRequest(s.route, 'POST'); replace.headers.set('X-Capture-Previous', s.pairing.status.id);
  const fresh = await s.capture.handleOwner(replace); expect(fresh.status).toBe(201);
  expect((await fresh.json()).status.state).toBe('waiting');
  expect((await s.capture.handleOwner(replace)).status).toBe(409);
});

test('durable acceptance normalizes immutable provenance and compares bytes plus metadata on retries', async () => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const s = await setup({ extract: async () => { await gate; return 'A vector has direction.'; } });
  try {
    const accepted = await s.capture.handleDevice(deviceRequest('/items', s.token, 'POST', form()));
    expect(accepted.status).toBe(202);
    const first = await accepted.json();
    expect((await (await s.capture.handleDevice(deviceRequest('/items', s.token, 'POST', form()))).json()).id).toBe(first.id);
    expect((await s.capture.handleDevice(deviceRequest('/items', s.token, 'POST', form(metadata(), new Uint8Array([...jpeg, 1]))))).status).toBe(409);
    expect((await s.capture.handleDevice(deviceRequest('/items', s.token, 'POST', form({ ...metadata(), sequence: 2 })))).status).toBe(409);
    release(); await until(s.status, value => value.processed === 1);
    const session = s.lectures.getOwned('user:alice', s.lecture.id)!;
    expect(session.sources).toHaveLength(1);
    expect(session.sources[0].capture).toEqual({ itemId: first.id, kind: 'photo', sequence: 1, capturedAt: metadata().capturedAt });
  } finally { release(); }
});

test('revocation rejects uploads after their body read while accepted work may finish', async () => {
  const s = await setup();
  let release!: () => void;
  const body = form(); const encoded = new Request('https://phone.example', { method: 'POST', body });
  const contentType = encoded.headers.get('content-type')!;
  const bytes = new Uint8Array(await encoded.arrayBuffer());
  const stream = new ReadableStream<Uint8Array>({ start(controller) { release = () => { controller.enqueue(bytes); controller.close(); }; } });
  const upload = s.capture.handleDevice(new Request('https://phone.example/api/capture/items', { method: 'POST',
    headers: { Authorization: `Bearer ${s.token}`, 'Content-Type': contentType }, body: stream, duplex: 'half' } as RequestInit));
  expect((await s.capture.handleOwner(ownerRequest(`${s.route}/${s.pairing.status.id}`, 'DELETE'))).status).toBe(200);
  release(); expect((await upload).status).toBe(401); expect((await s.status()).pending).toBe(0);
  expect((await s.capture.handleDevice(deviceRequest('/status', s.token))).status).toBe(401);
});

test('expiry and origin checks apply without exposing capability values', async () => {
  let now = Date.now(); const s = await setup({ now: () => now });
  expect((await s.capture.handleDevice(new Request('https://phone.example/api/capture/items', { method: 'POST',
    headers: { Authorization: `Bearer ${s.token}`, Origin: 'https://evil.example' }, body: form() }))).status).toBe(403);
  now += 4 * 60 * 60_000 + 1;
  expect((await s.capture.handleDevice(deviceRequest('/status', s.token))).status).toBe(401);
  expect((await s.status()).state).toBe('expired');
});

test('an unclaimed link expires after ten minutes and requires a literal trusted HTTPS origin', async () => {
  let now = Date.now(); const s = await setup({ now: () => now });
  const next = await (await s.capture.handleOwner(ownerRequest(s.route, 'POST'))).json() as CapturePairing;
  const secret = new URLSearchParams(new URL(next.url).hash.slice(1)).get('pair');
  now += 10 * 60_000 + 1;
  expect((await s.capture.handleDevice(new Request('https://phone.example/api/capture/claim', { method: 'POST',
    body: JSON.stringify({ secret, deviceToken: 'c'.repeat(64) }) }))).status).toBe(401);
  const insecure = new LectureCaptureService(':memory:', s.lectures, { publicOrigin: 'http://phone.example', extract: async () => '' });
  cleanup.push(() => insecure.close());
  expect((await insecure.handleOwner(ownerRequest(s.route, 'POST'))).status).toBe(503);
  expect(await (await insecure.handleDevice(deviceRequest('/config', ''))).json()).toMatchObject({ available: false });
});

test('media validation rejects excessive duration, unsupported bytes and oversized streaming bodies', async () => {
  const s = await setup();
  expect((await s.capture.handleDevice(deviceRequest('/items', s.token, 'POST', form({ ...metadata('audio', 'audio'), durationMs: 45_001 }, jpeg, 'audio/webm')))).status).toBe(400);
  expect((await s.capture.handleDevice(deviceRequest('/items', s.token, 'POST', form(metadata(), new Uint8Array([1, 2, 3]))))).status).toBe(415);
  const huge = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new Uint8Array(5 * 1024 * 1024 + 65_537)); controller.close(); } });
  expect((await s.capture.handleDevice(new Request('https://phone.example/api/capture/items', { method: 'POST',
    headers: { Authorization: `Bearer ${s.token}`, 'Content-Type': 'multipart/form-data; boundary=x' }, body: huge, duplex: 'half' } as RequestInit))).status).toBe(413);
  expect((await s.status()).pending).toBe(0);
});

test('media limits match extractor byte limits and Safari M4A uses normalized MP4', async () => {
  let extractedType = '';
  const s = await setup({ extract: async file => { extractedType = file.type; return 'Speech from the lecture'; } });
  const oversizedPhoto = new Uint8Array(2_000_001); oversizedPhoto.set(jpeg);
  expect((await s.capture.handleDevice(deviceRequest('/items', s.token, 'POST', form(metadata(), oversizedPhoto)))).status).toBe(413);
  const oversizedAudio = new Uint8Array(5_000_001); oversizedAudio.set(new TextEncoder().encode('ftyp'), 4);
  expect((await s.capture.handleDevice(deviceRequest('/items', s.token, 'POST', form(metadata('large', 'audio'), oversizedAudio, 'audio/mp4')))).status).toBe(413);
  const mp4 = new Uint8Array(20); mp4.set(new TextEncoder().encode('ftyp'), 4);
  expect((await s.capture.handleDevice(deviceRequest('/items', s.token, 'POST', form(metadata('m4a', 'audio'), mp4, 'audio/x-m4a')))).status).toBe(202);
  await until(s.status, value => value.processed === 1);
  expect(extractedType).toBe('audio/mp4');
});

test('audio uploads normalize browser MIME labels against recognized container bytes', async () => {
  const types: string[] = [];
  const s = await setup({ extract: async file => { types.push(file.type); return 'Recorded speech'; } });
  const mp4 = new Uint8Array(20); mp4.set(new TextEncoder().encode('ftyp'), 4);
  for (const [id, mime] of [['video-label', 'video/mp4'], ['mismatched-label', 'audio/webm;codecs=opus']]) {
    const response = await s.capture.handleDevice(deviceRequest('/items', s.token, 'POST', form(metadata(id, 'audio'), mp4, mime)));
    expect(response.status).toBe(202);
  }
  await until(s.status, value => value.processed === 2);
  expect(types).toEqual(['audio/mp4', 'audio/mp4']);
  expect((await s.capture.handleDevice(deviceRequest('/items', s.token, 'POST', form(metadata('invalid', 'audio'), jpeg, 'audio/mp4')))).status).toBe(415);
});

test('failed media retains retry bytes, empty extraction skips, and successful media bytes are removed', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'aha-capture-')); cleanup.push(() => rm(dir, { recursive: true, force: true }));
  let fail = true; const path = join(dir, 'capture.sqlite');
  const s = await setup({ extract: async () => { if (fail) throw new Error('private provider token'); return ''; } }, path);
  await s.capture.handleDevice(deviceRequest('/items', s.token, 'POST', form()));
  const failed = await until(s.status, value => value.failed === 1);
  expect(failed.items[0].error).not.toContain('private provider token');
  const db = new Database(path, { readonly: true });
  try {
    expect((db.query('SELECT length(bytes) AS size FROM capture_items').get() as { size: number }).size).toBe(jpeg.length);
    fail = false; expect((await s.capture.handleDevice(deviceRequest(`/items/${failed.items[0].id}/retry`, s.token, 'POST'))).status).toBe(202);
    await until(s.status, value => value.skipped === 1);
    expect((db.query('SELECT bytes FROM capture_items').get() as { bytes: null }).bytes).toBeNull();
    expect(s.lectures.getOwned('user:alice', s.lecture.id)?.sources).toHaveLength(0);
  } finally { db.close(); }
});

test('restart resumes durable items and deletion aborts work and removes capture records', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'aha-capture-restart-')); cleanup.push(() => rm(dir, { recursive: true, force: true }));
  const path = join(dir, 'capture.sqlite'); let began = false; let signal: AbortSignal | undefined;
  const s = await setup({ extract: async (_file, _meta, current) => { began = true; signal = current; return new Promise<string>(() => {}); } }, path);
  await s.capture.handleDevice(deviceRequest('/items', s.token, 'POST', form())); await until(async () => began, Boolean);
  await s.capture.close(); expect(signal?.aborted).toBe(true);
  const resumed = new LectureCaptureService(path, s.lectures, { publicOrigin: 'https://phone.example', extract: async () => 'Resumed source' });
  cleanup.push(() => resumed.close());
  await until(async () => s.lectures.getOwned('user:alice', s.lecture.id), value => value?.sources.length === 1);
  expect((await s.lectures.handle(ownerRequest(`/api/lectures/${s.lecture.id}`, 'DELETE'))).status).toBe(204);
  expect((await resumed.handleDevice(deviceRequest('/status', s.token))).status).toBe(401);
  const db = new Database(path, { readonly: true });
  try { expect(db.query('SELECT * FROM capture_items').all()).toHaveLength(0); expect(db.query('SELECT * FROM capture_pairings').all()).toHaveLength(0); }
  finally { db.close(); }
});

test('pending capacity bounds accepted uploads without rejecting idempotent retries', async () => {
  const s = await setup({ maxPendingPerLecture: 1, extract: async () => new Promise<string>(() => {}) });
  expect((await s.capture.handleDevice(deviceRequest('/items', s.token, 'POST', form()))).status).toBe(202);
  expect((await s.capture.handleDevice(deviceRequest('/items', s.token, 'POST', form()))).status).toBe(202);
  expect((await s.capture.handleDevice(deviceRequest('/items', s.token, 'POST', form({ ...metadata('item-2'), sequence: 2 })))).status).toBe(429);
});

test('photo admission leaves pending room for live audio', async () => {
  const s = await setup({ maxPendingPerLecture: 3, maxPendingGlobal: 4, extract: async () => new Promise<string>(() => {}) });
  for (let i = 0; i < 3; i++) await s.capture.handleDevice(deviceRequest('/items', s.token, 'POST', form(metadata(`photo-${i}`))));
  const response = await s.capture.handleDevice(deviceRequest('/items', s.token, 'POST', form(metadata('audio', 'audio'), new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0]), 'audio/webm')));
  expect(response.status).toBe(202);
});

test('a timed-out extractor releases capacity and its late result cannot append a source', async () => {
  let release!: (text: string) => void, calls = 0;
  const s = await setup({ concurrency: 1, itemTimeoutMs: 20, extract: async () => {
    if (++calls === 1) return new Promise<string>(resolve => { release = resolve; });
    return 'Current capture';
  } });
  try {
    await s.capture.handleDevice(deviceRequest('/items', s.token, 'POST', form()));
    await s.capture.handleDevice(deviceRequest('/items', s.token, 'POST', form({ ...metadata('item-2'), sequence: 2 })));
    await until(s.status, value => value.failed === 1 && value.processed === 1);
    release('Late capture'); await Bun.sleep(0);
    expect(s.lectures.getOwned('user:alice', s.lecture.id)?.sources.map(source => source.text)).toEqual(['Current capture']);
  } finally { release?.('Late capture'); }
});

test('deleting a lecture cancels accepted capture and a late extraction cannot recreate it', async () => {
  let release!: (text: string) => void, capturedSignal: AbortSignal | undefined;
  const s = await setup({ extract: async (_file, _metadata, signal) => { capturedSignal = signal; return new Promise<string>(resolve => { release = resolve; }); } });
  try {
    await s.capture.handleDevice(deviceRequest('/items', s.token, 'POST', form()));
    await until(async () => capturedSignal, Boolean);
    await s.lectures.handle(ownerRequest(`/api/lectures/${s.lecture.id}`, 'DELETE'));
    expect(capturedSignal?.aborted).toBe(true); release('Late capture'); await Bun.sleep(0);
    expect(s.lectures.getOwned('user:alice', s.lecture.id)).toBeUndefined();
    expect((await s.capture.handleDevice(deviceRequest('/status', s.token))).status).toBe(401);
  } finally { release?.('Late capture'); }
});

test('restart between source append and acknowledgement reuses stored normalized text exactly once', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'aha-capture-window-')); cleanup.push(() => rm(dir, { recursive: true, force: true }));
  const path = join(dir, 'capture.sqlite'); let calls = 0;
  const s = await setup({ extract: async () => { calls++; return 'Immutable normalized source'; } }, path);
  const item = await (await s.capture.handleDevice(deviceRequest('/items', s.token, 'POST', form()))).json();
  await until(s.status, value => value.processed === 1); await s.capture.close();
  const db = new Database(path);
  try {
    const row = db.query('SELECT bytes FROM capture_items WHERE id = ?').get(item.id) as { bytes: null };
    expect(row.bytes).toBeNull();
    const pairing = db.query('SELECT secret_hash, device_hash FROM capture_pairings').get() as { secret_hash: string; device_hash: string };
    expect(pairing.secret_hash).not.toBe(s.secret); expect(pairing.device_hash).not.toBe(s.token);
    db.query("UPDATE capture_items SET status = 'processing', bytes = ?, normalized = ? WHERE id = ?").run(jpeg, 'Immutable normalized source', item.id);
  } finally { db.close(); }
  const resumed = new LectureCaptureService(path, s.lectures, { publicOrigin: 'https://phone.example', extract: async () => { calls++; return 'Different provider output'; } });
  cleanup.push(() => resumed.close());
  await until(async () => (await (await resumed.handleDevice(deviceRequest('/status', s.token))).json()) as CaptureStatus, value => value.processed === 1);
  expect(calls).toBe(1); expect(s.lectures.getOwned('user:alice', s.lecture.id)?.sources).toHaveLength(1);
});

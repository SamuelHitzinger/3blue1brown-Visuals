import { afterEach, expect, test, spyOn } from 'bun:test';
import { Database } from 'bun:sqlite';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LectureService } from '../src/lectures.js';
import { createHandler } from '../src/server.js';
import { createCaptureGateway } from '../src/capture-gateway.js';
import { ModelAssets } from '../src/model-assets.js';
import { createModelGLB } from 'animlib/core';

const instances: LectureService[] = [];
const directories: string[] = [];
const originalOrigin = process.env.CAPTURE_PUBLIC_ORIGIN;
afterEach(async () => {
  await Promise.all(instances.splice(0).map(service => service.close()));
  for (const dir of directories.splice(0)) await rm(dir, { recursive: true, force: true });
  if (originalOrigin === undefined) delete process.env.CAPTURE_PUBLIC_ORIGIN;
  else process.env.CAPTURE_PUBLIC_ORIGIN = originalOrigin;
});
const owner = (path = '', method = 'GET', body?: unknown, user = 'alice') => new Request(`http://localhost/api/lectures${path}`, {
  method, headers: { 'x-user-id': user, 'Idempotency-Key': crypto.randomUUID(), 'Content-Type': 'application/json' },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});
const viewer = (id: string, token?: string, method = 'GET') => new Request(`https://reader.example/api/lecture-view/${id}`, {
  method, headers: token ? { Authorization: `Bearer ${token}` } : {},
});
async function setup(path = ':memory:') {
  process.env.CAPTURE_PUBLIC_ORIGIN = 'https://reader.example';
  const service = new LectureService(path); instances.push(service);
  const app = createHandler(undefined, undefined, undefined, undefined, service);
  const gateway = createCaptureGateway(app, { handleDevice: async () => Response.json({}) });
  const lecture = await (await app(owner('', 'POST', { title: 'Vectors' }))).json();
  return { service, app, gateway, id: lecture.id as string };
}
async function issue(app: (request: Request) => Promise<Response>, id: string) {
  const response = await app(owner(`/${id}/view-link`, 'POST'));
  expect(response.status).toBe(201);
  const link = await response.json();
  const url = new URL(link.url);
  return { ...link, token: new URLSearchParams(url.hash.slice(1)).get('token')!, parsed: url };
}

test('reader link gives a minimal fresh projection and never raw lecture sources or credentials', async () => {
  const { app, gateway, id } = await setup();
  expect(await (await app(owner(`/${id}/view-link`))).json()).toEqual({ active: false });
  const before = Date.now(), link = await issue(app, id);
  expect(link.parsed.origin).toBe('https://reader.example');
  expect(link.parsed.pathname).toBe(`/live/${id}`);
  expect(link.parsed.search).toBe('');
  expect(link.token).toMatch(/^[a-f0-9]{64}$/);
  expect(Buffer.from(link.token, 'hex').byteLength).toBe(32);
  expect(Date.parse(link.expiresAt)).toBeGreaterThanOrEqual(before + 8 * 60 * 60 * 1000);
  expect(Date.parse(link.expiresAt)).toBeLessThanOrEqual(Date.now() + 8 * 60 * 60 * 1000);
  expect(await (await app(owner(`/${id}/view-link`))).json()).toEqual({ active: true, expiresAt: link.expiresAt });
  await app(owner(`/${id}/sources`, 'POST', { text: 'RAW_PRIVATE_SOURCE', kind: 'text' }));
  await app(owner(`/${id}`, 'PATCH', { personalNotes: 'Review vectors', noteEdits: { summary: 'Edited summary' } }));
  const response = await gateway(viewer(id, link.token));
  expect(response.status).toBe(200);
  expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  expect(response.headers.get('Vary')).toBe('Authorization');
  const body = await response.json();
  expect(Object.keys(body).sort()).toEqual(['error', 'id', 'noteEdits', 'notes', 'personalNotes', 'revision', 'sourceRevision', 'status', 'synthesizedRevision', 'title', 'updatedAt', 'visualizations'].sort());
  expect(body.personalNotes).toBe('Review vectors');
  expect(body.noteEdits).toEqual({ summary: 'Edited summary' });
  expect(body.sourceRevision).toBe(1);
  expect(JSON.stringify(body)).not.toContain('RAW_PRIVATE_SOURCE');
  expect(JSON.stringify(body)).not.toContain(link.token);
});

test('reader capability is owner-managed, lecture-scoped and read-only', async () => {
  const { app, gateway, id } = await setup(), link = await issue(app, id);
  const other = await (await app(owner('', 'POST', { title: 'Another' }))).json();
  for (const method of ['GET', 'POST', 'DELETE']) expect((await app(owner(`/${id}/view-link`, method, undefined, 'bob'))).status).toBe(404);
  for (const token of [undefined, 'wrong-secret', `${link.token}extra`]) {
    const response = await gateway(viewer(id, token));
    expect(response.status).toBe(401);
    expect(await response.text()).not.toContain(token ?? 'undefined');
  }
  expect((await gateway(viewer(other.id, link.token))).status).toBe(401);
  expect((await gateway(new Request(`https://reader.example/api/lecture-view/${id}?token=${link.token}`))).status).toBe(401);
  for (const method of ['POST', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']) {
    const response = await gateway(viewer(id, link.token, method));
    expect(response.status).toBe(405); expect(response.headers.get('Allow')).toBe('GET');
  }
  for (const [path, method] of [['', 'GET'], [`/${id}`, 'GET'], [`/${id}`, 'DELETE'], [`/${id}/view-link`, 'POST'], [`/${id}/sources`, 'POST']]) {
    const request = owner(path, method); request.headers.set('Authorization', `Bearer ${link.token}`);
    expect((await app(request)).status).toBe(401);
    expect((await gateway(request)).status).toBe(404);
  }
  expect((await app(owner(`/${id}`))).status).toBe(200);
});

test('rotation, exact expiry, revocation and deletion invalidate old reader credentials', async () => {
  const { app, gateway, id } = await setup(), first = await issue(app, id), second = await issue(app, id);
  expect(second.token).not.toBe(first.token);
  expect((await gateway(viewer(id, first.token))).status).toBe(401);
  expect((await gateway(viewer(id, second.token))).status).toBe(200);
  const now = spyOn(Date, 'now').mockReturnValue(Date.parse(second.expiresAt));
  try {
    expect((await gateway(viewer(id, second.token))).status).toBe(401);
    expect(await (await app(owner(`/${id}/view-link`))).json()).toEqual({ active: false });
  } finally { now.mockRestore(); }
  const third = await issue(app, id);
  expect((await app(owner(`/${id}/view-link`, 'DELETE'))).status).toBe(204);
  expect((await gateway(viewer(id, third.token))).status).toBe(401);
  const fourth = await issue(app, id);
  expect((await app(owner(`/${id}`, 'DELETE'))).status).toBe(204);
  expect((await gateway(viewer(id, fourth.token))).status).toBe(401);
});

test('reader grants survive restart using hashed storage and are cleaned with the lecture', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'aha-reader-')); directories.push(dir);
  const path = join(dir, 'lecture.sqlite');
  const { service, app, id } = await setup(path), link = await issue(app, id);
  await service.close();
  const db = new Database(path);
  try {
    const rows = db.query('SELECT * FROM lecture_view_links').all();
    expect(rows).toHaveLength(1); expect(JSON.stringify(rows)).not.toContain(link.token);
    expect((rows[0] as {token_hash: string}).token_hash).toMatch(/^[a-f0-9]{64}$/);
  } finally { db.close(); }
  const restarted = new LectureService(path); instances.push(restarted);
  const nextApp = createHandler(undefined, undefined, undefined, undefined, restarted);
  expect((await nextApp(viewer(id, link.token))).status).toBe(200);
  await nextApp(owner(`/${id}`, 'DELETE')); await restarted.close();
  const finalDb = new Database(path);
  try { expect(finalDb.query('SELECT * FROM lecture_view_links').all()).toEqual([]); } finally { finalDb.close(); }
});

test('reader issuance requires a valid HTTPS public origin and rejects cross-site changes', async () => {
  const { app, id } = await setup();
  for (const origin of ['', 'http://reader.example', 'https://u:p@reader.example', 'https://reader.example/path', 'https://reader.example?key=value']) {
    process.env.CAPTURE_PUBLIC_ORIGIN = origin;
    expect((await app(owner(`/${id}/view-link`, 'POST'))).status).toBe(503);
  }
  process.env.CAPTURE_PUBLIC_ORIGIN = 'https://reader.example';
  const request = owner(`/${id}/view-link`, 'POST'); request.headers.set('Origin', 'https://evil.example');
  expect((await app(request)).status).toBe(403);
  expect((await app(owner(`/${id}/view-link`, 'PATCH'))).status).toBe(405);
});

test('gateway serves only the reader UUID shell and exact reader endpoint', async () => {
  const { gateway, id } = await setup();
  const response = await gateway(new Request(`https://reader.example/live/${id}`));
  expect(response.status).toBe(200);
  expect(response.headers.get('Referrer-Policy')).toBe('no-referrer');
  expect(response.headers.get('Content-Security-Policy')).toContain("frame-ancestors 'none'");
  expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  for (const path of ['/live/not-a-uuid', `/live/${id}/extra`, '/api/lecture-view', `/api/lecture-view/${id}/sources`]) {
    expect((await gateway(new Request(`https://reader.example${path}`))).status).toBe(404);
  }
});

test('reader model downloads require the current lecture grant and an attached canonical asset', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'aha-reader-model-')); directories.push(dir);
  const path = join(dir, 'lecture.sqlite'), { service, id } = await setup(path);
  const models = new ModelAssets(join(dir, 'models'));
  const bytes = await createModelGLB({ parts: [{ name: 'Triangle', vertices: [[0,0,0],[1,0,0],[0,1,0]], triangles: [[0,1,2]] }] });
  const published = await models.publish(bytes);
  const db = new Database(path);
  try {
    const row = db.query('SELECT snapshot FROM lectures WHERE id = ?').get(id) as {snapshot: string};
    const session = JSON.parse(row.snapshot);
    session.visualizations = [{ id: 'triangle', conceptId: 'triangle', title: 'Triangle', sourceRevision: 0, status: 'ready', source: 'scene source', duration: 1, catalogIds: [], assets: { triangle: published.asset } }];
    db.query('UPDATE lectures SET snapshot = ? WHERE id = ?').run(JSON.stringify(session), id);
  } finally { db.close(); }
  const app = createHandler(undefined, undefined, undefined, models, service);
  const gateway = createCaptureGateway(app, {handleDevice: async () => Response.json({})});
  const link = await issue(app, id);
  const assetRequest = (lecture = id, token = link.token, sha = published.asset.sha256!, method = 'GET') => new Request(`https://reader.example/api/lecture-view/${lecture}/models/${sha}.glb`, { method, headers: {Authorization: `Bearer ${token}`} });
  const response = await gateway(assetRequest());
  expect(response.status).toBe(200); expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes);
  expect(response.headers.get('Content-Type')).toBe('model/gltf-binary');
  expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  expect(response.headers.get('Vary')).toBe('Authorization');
  expect((await gateway(assetRequest(id, 'invalid'))).status).toBe(401);
  expect((await gateway(assetRequest(id, link.token, 'f'.repeat(64)))).status).toBe(404);
  const other = await (await app(owner('', 'POST', {title: 'Other'}))).json(), otherLink = await issue(app, other.id);
  expect((await gateway(assetRequest(other.id, otherLink.token))).status).toBe(404);
  expect((await gateway(assetRequest(other.id))).status).toBe(401);
  expect((await gateway(new Request(`https://reader.example${published.asset.url}`, {headers: {Authorization: `Bearer ${link.token}`}}))).status).toBe(404);
  for (const method of ['POST', 'HEAD', 'DELETE']) expect((await gateway(assetRequest(id, link.token, published.asset.sha256, method))).status).toBe(405);
  let release!: () => void, entered!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; }), began = new Promise<void>(resolve => { entered = resolve; });
  const original = models.handle.bind(models);
  const delayed = spyOn(models, 'handle').mockImplementation(async request => { const result = await original(request); entered(); await gate; return result; });
  try {
    const pending = gateway(assetRequest()); await began;
    await app(owner(`/${id}/view-link`, 'DELETE')); release();
    expect((await pending).status).toBe(401);
  } finally { release(); delayed.mockRestore(); }
  expect((await gateway(assetRequest())).status).toBe(401);
});

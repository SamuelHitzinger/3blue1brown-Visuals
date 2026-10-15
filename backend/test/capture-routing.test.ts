import { afterEach, expect, test } from 'bun:test';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createCanvas } from '@napi-rs/canvas';
import { createHandler } from '../src/server.js';
import { createCaptureGateway } from '../src/capture-gateway.js';
import { LectureService } from '../src/lectures.js';
import { LectureCaptureService } from '../src/lecture-capture.js';
import type { CaptureClaim, CapturePairing, CaptureStatus } from '../../shared/lecture-capture.js';
import type { LectureSession } from '../../shared/lecture.js';

const cleanup: (() => Promise<unknown>)[] = [];
afterEach(async () => { for (const close of cleanup.splice(0).reverse()) await close(); });
const desktop = (path: string, method = 'GET', body?: unknown, owner = 'alice') => new Request(`http://desktop.test${path}`, {
  method, headers: { 'x-user-id': owner, 'Idempotency-Key': 'routing-lecture', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});
const phone = (path: string, token?: string, method = 'GET', body?: BodyInit) => new Request(`https://phone.example${path}`, {
  method, headers: { Origin: 'https://phone.example', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body === undefined ? {} : { body }),
});
async function fixture(extract: NonNullable<ConstructorParameters<typeof LectureCaptureService>[2]>['extract'] = async () => 'A vector has direction.') {
  const directory = await mkdtemp(join(tmpdir(), 'aha-capture-routing-'));
  cleanup.push(() => rm(directory, { recursive: true, force: true }));
  await mkdir(join(directory, 'assets'));
  await Promise.all([
    writeFile(join(directory, 'index.html'), '<!doctype html><main id="root">Capture shell</main><script type="module" src="/static/assets/capture-Ab123456.js"></script>'),
    writeFile(join(directory, 'assets', 'capture-Ab123456.js'), 'globalThis.captureBundleLoaded = true;'),
    writeFile(join(directory, 'private.txt'), 'must not leave the desktop'),
    writeFile(join(directory, 'capture.webmanifest'), JSON.stringify({ id: '/capture', start_url: '/capture', display: 'standalone' })),
    writeFile(join(directory, 'capture-icon-192.png'), new Uint8Array([137, 80, 78, 71])),
  ]);
  const lectures = new LectureService(':memory:', async input => ({ summary: 'A vector has direction.',
    sections: [{ id: 'vectors', title: 'Vectors', points: [{ text: 'A vector has direction.', sourceIds: [input.sources[0].id] }] }], concepts: [], questions: [] }));
  cleanup.push(() => lectures.close());
  const captures = new LectureCaptureService(':memory:', lectures, { publicOrigin: 'https://phone.example',
    extract });
  cleanup.push(() => captures.close());
  const app = createHandler(directory, undefined, undefined, undefined, lectures, captures);
  return { app, gateway: createCaptureGateway(app, captures) };
}
async function pair(app: Awaited<ReturnType<typeof fixture>>['app'], gateway: Awaited<ReturnType<typeof fixture>>['gateway']) {
  const creation = await app(desktop('/api/lectures', 'POST', { title: 'Routing lecture' }));
  expect(creation.status).toBe(201);
  const lecture = await creation.json() as LectureSession;
  const route = `/api/lectures/${lecture.id}/capture-pairings`;
  const response = await app(desktop(route, 'POST'));
  expect(response.status).toBe(201);
  const pairing = await response.json() as CapturePairing;
  const secret = new URLSearchParams(new URL(pairing.url).hash.slice(1)).get('pair');
  const token = 'd'.repeat(64);
  const claimResponse = await gateway(phone('/api/capture/claim', undefined, 'POST', JSON.stringify({ secret, deviceToken: token })));
  expect(claimResponse.status).toBe(200);
  const claim = await claimResponse.json() as CaptureClaim;
  expect(claim.status.lectureId).toBe(lecture.id); expect(claim.token).toBe(token);
  return { lecture, route, pairing, token };
}

test('actual app routes owner pairing before lecture routes and gateway upload reaches private lecture notes', async () => {
  const { app, gateway } = await fixture();
  expect(await (await app(desktop('/api/lecture-capture/config'))).json()).toMatchObject({ available: true });
  expect(await (await gateway(phone('/api/capture/config'))).json()).toMatchObject({ available: true });
  const { lecture, route, pairing, token } = await pair(app, gateway);
  expect((await app(desktop(route, 'GET', undefined, 'bob'))).status).toBe(404);
  expect(await (await app(desktop(`${route}/${pairing.status.id}`))).json()).toMatchObject({ state: 'connected' });
  const body = new FormData();
  body.set('metadata', JSON.stringify({ clientId: 'routing-photo', kind: 'photo', sequence: 1, capturedAt: '2026-10-14T12:00:00.000Z' }));
  body.set('file', new File([new Uint8Array([255, 216, 255, 224, 0, 16])], 'capture.jpg', { type: 'image/jpeg' }));
  const accepted = await gateway(phone('/api/capture/items', token, 'POST', body));
  expect(accepted.status).toBe(202);
  expect(accepted.headers.get('Cache-Control')).toBe('private, no-store');
  let result: LectureSession | undefined;
  for (let attempt = 0; attempt < 100; attempt++) {
    result = await (await app(desktop(`/api/lectures/${lecture.id}`))).json() as LectureSession;
    if (result.synthesizedRevision === 1) break;
    await Bun.sleep(5);
  }
  expect(result?.notes?.summary).toBe('A vector has direction.');
  expect(result?.sources[0].capture).toMatchObject({ kind: 'photo', sequence: 1 });
  const status = await (await gateway(phone('/api/capture/status', token))).json() as CaptureStatus;
  expect(status.processed).toBe(1);
  expect(JSON.stringify(status)).not.toMatch(/personalNotes|sourceIds|A vector has direction/);
  expect((await app(desktop(`${route}/${pairing.status.id}`, 'DELETE'))).status).toBe(200);
  expect((await gateway(phone('/api/capture/status', token))).status).toBe(401);
});

test('stable recorder installation assets pass through gateway without exposing other public files', async () => {
  const { gateway } = await fixture();
  const manifest = await gateway(phone('/capture.webmanifest'));
  expect(manifest.status).toBe(200);
  expect(await manifest.json()).toMatchObject({id:'/capture',start_url:'/capture',display:'standalone'});
  expect((await gateway(phone('/capture-icon-192.png'))).status).toBe(200);
  expect((await gateway(phone('/capture.webmanifest', undefined, 'POST'))).status).toBe(405);
  expect((await gateway(phone('/private.txt'))).status).toBe(404);
  expect((await gateway(phone('/static/private.txt'))).status).toBe(404);
});

test('app routes cropped images to owner capture service while phone gateway cannot retrieve them', async () => {
  const { app, gateway } = await fixture(async () => ({ text: 'A vector has direction.', photoSnippet: { crop: { x: 0.1, y: 0.2, width: 0.5, height: 0.5 }, description: 'Annotated trace' } }));
  const { lecture, token } = await pair(app, gateway);
  const body = new FormData();
  body.set('metadata', JSON.stringify({ clientId: 'snippet-route', kind: 'photo', sequence: 1, capturedAt: '2026-10-14T12:00:00.000Z' }));
  body.set('file', new File([new Uint8Array(await createCanvas(800, 600).encode('jpeg'))], 'photo.jpg', { type: 'image/jpeg' }));
  expect((await gateway(phone('/api/capture/items', token, 'POST', body))).status).toBe(202);
  let sourceId: string | undefined;
  for (let attempt = 0; attempt < 100 && !sourceId; attempt++) {
    const result = await (await app(desktop(`/api/lectures/${lecture.id}`))).json() as LectureSession;
    sourceId = result.sources[0]?.id;
    if (!sourceId) await Bun.sleep(5);
  }
  expect(sourceId).toBeDefined();
  const path = `/api/lectures/${lecture.id}/sources/${sourceId}/photo-snippet`;
  const response = await app(desktop(path));
  expect(response.status).toBe(200); expect(response.headers.get('content-type')).toBe('image/jpeg');
  expect((await app(desktop(path, 'GET', undefined, 'bob'))).status).toBe(404);
  expect((await gateway(phone(path, token))).status).toBe(404);
});

test('real gateway blocks desktop APIs even with valid device capability and spoofed identity', async () => {
  const { app, gateway } = await fixture();
  const { lecture, route, token } = await pair(app, gateway);
  for (const path of ['/api/lectures', `/api/lectures/${lecture.id}`, route, '/api/lecture-capture/config', '/api/me', '/api/videos', '/api/models/private', '/api/narrations', '/settings', '/static/private.txt']) {
    const request = new Request(`https://phone.example${path}`, { headers: { Authorization: `Bearer ${token}`, 'x-user-id': 'alice' } });
    expect((await gateway(request)).status).toBe(404);
  }
  expect((await gateway(phone(`/api/lectures/${lecture.id}`, token, 'DELETE'))).status).toBe(404);
  expect((await gateway(phone(route, token, 'POST'))).status).toBe(404);
  expect((await app(desktop(`/api/lectures/${lecture.id}`))).status).toBe(200);
  expect((await gateway(phone('/api/capture/status'))).status).toBe(401);
});

test('real gateway serves the capture SPA and static bundle with restrictive headers', async () => {
  const { gateway } = await fixture();
  const shell = await gateway(phone('/capture'));
  expect(shell.status).toBe(200);
  expect(await shell.text()).toContain('/static/assets/capture-Ab123456.js');
  expect(shell.headers.get('Referrer-Policy')).toBe('no-referrer');
  expect(shell.headers.get('Content-Security-Policy')).toContain("connect-src 'self'");
  const bundle = await gateway(phone('/static/assets/capture-Ab123456.js'));
  expect(bundle.status).toBe(200); expect(await bundle.text()).toBe('globalThis.captureBundleLoaded = true;');
  expect(bundle.headers.get('Cache-Control')).toContain('immutable');
  const head = await gateway(phone('/static/assets/capture-Ab123456.js', undefined, 'HEAD'));
  expect(head.status).toBe(200); expect(await head.text()).toBe('');
  expect((await gateway(phone('/capture', undefined, 'POST'))).status).toBe(405);
  expect((await gateway(phone('/static/assets/%2e%2e%2fprivate.txt'))).status).toBe(404);
});

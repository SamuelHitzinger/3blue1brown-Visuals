import { afterEach, expect, test } from 'bun:test';
import { LectureService } from '../src/lectures.js';
import { LectureLiveBridge } from '../src/lecture-live-bridge.js';
import { createCaptureGateway } from '../src/capture-gateway.js';

const cleanup: (() => unknown)[] = [];
afterEach(async () => { for (const close of cleanup.splice(0).reverse()) await close(); });
const owner = (id: string, method = 'GET', who = 'alice', extra = {}) => new Request(`http://localhost/api/lectures/${id}/live-bridge`, { method, headers: { 'x-user-id': who, ...extra } });
async function setup() {
  let now = Date.now();
  const lectures = new LectureService(':memory:'); cleanup.push(() => lectures.close());
  const lecture = await (await lectures.handle(new Request('http://localhost/api/lectures', { method: 'POST', headers: { 'x-user-id': 'alice', 'Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify({ title: 'Mechanics' }) }))).json();
  const bridge = new LectureLiveBridge(':memory:', lectures, () => now); cleanup.push(() => bridge.close());
  const grant = await (await bridge.handleOwner(owner(lecture.id, 'POST'))).json();
  const call = (path = 'context', body?: unknown, token = grant.token) => bridge.handlePlugin(new Request(`http://localhost/api/live-bridge/${path}`, { method: body === undefined ? 'GET' : 'POST', headers: { Authorization: `Bearer ${token}` }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }));
  return { lectures, lecture, bridge, grant, call, advance: (ms: number) => { now += ms; } };
}
test('grants scope context, hide private notes and cannot manage owner routes', async () => {
  const s = await setup();
  expect((await s.bridge.handleOwner(owner(s.lecture.id, 'POST', 'bob'))).status).toBe(404);
  expect((await s.bridge.handleOwner(owner(s.lecture.id, 'POST', 'alice', { Authorization: `Bearer ${s.grant.token}` }))).status).toBe(403);
  expect((await s.bridge.handleOwner(owner(s.lecture.id, 'POST', 'alice', { Origin: 'https://evil.example' }))).status).toBe(403);
  const context = await (await s.call()).json();
  expect(context.id).toBe(s.lecture.id); expect(context.personalNotes).toBeUndefined();
  expect((await s.call('context', undefined, 'x'.repeat(64))).status).toBe(401);
  expect((await s.call('lectures')).status).toBe(404);
});
test('speech batches append once, label provenance, reject conflicting retries and forged photo references', async () => {
  const s = await setup(), batch = { batchId: crypto.randomUUID(), text: 'The net force is zero.', frameIds: [] };
  expect((await s.call('speech', batch)).status).toBe(202);
  expect((await s.call('speech', batch)).status).toBe(202);
  const session = s.lectures.getOwned('user:alice', s.lecture.id)!;
  expect(session.sources.length).toBe(1); expect(session.sources[0].text).toContain('not a verified verbatim transcript');
  expect((await s.call('speech', { ...batch, text: 'different' })).status).toBe(409);
  expect((await s.call('speech', { ...batch, batchId: crypto.randomUUID(), frameIds: [crypto.randomUUID()] })).status).toBe(400);
  expect((await s.call('speech', { ...batch, text: 'x'.repeat(20_001) })).status).toBe(413);
});
test('photos opt in, preserve bytes, stay bounded and expire; rotation and revocation remove access', async () => {
  const s = await setup();
  const record = (id: string, who = 'user:alice') => s.bridge.recordPhoto(who, s.lecture.id, id, { kind: 'photo', clientId: id, sequence: 1, capturedAt: new Date().toISOString() }, 'image/jpeg', new Uint8Array([255,216,255,1]));
  record(crypto.randomUUID(), 'user:bob');
  expect((await (await s.call('frames')).json()).frames).toHaveLength(0);
  for (let i = 0; i < 10; i++) record(crypto.randomUUID());
  const frames = (await (await s.call('frames')).json()).frames;
  expect(frames).toHaveLength(8); expect(frames[0].data).toBe('/9j/AQ==');
  expect((await s.call('speech', { batchId: crypto.randomUUID(), text: 'Observed equilibrium', frameIds: [frames[0].id] })).status).toBe(202);
  s.advance(16 * 60_000); expect((await (await s.call('frames')).json()).frames).toHaveLength(0);
  const next = await (await s.bridge.handleOwner(owner(s.lecture.id, 'POST'))).json();
  expect((await s.call()).status).toBe(401);
  expect((await s.call('context', undefined, next.token)).status).toBe(200);
  await s.bridge.handleOwner(owner(s.lecture.id, 'DELETE'));
  expect((await s.call('context', undefined, next.token)).status).toBe(401);
});
test('expiry, deletion and phone gateway deny bridge access', async () => {
  const s = await setup(); s.advance(8 * 60 * 60_000 + 1);
  expect((await s.call()).status).toBe(401);
  await s.lectures.handle(new Request(`http://localhost/api/lectures/${s.lecture.id}`, { method: 'DELETE', headers: { 'x-user-id': 'alice' } }));
  expect((await s.bridge.handleOwner(owner(s.lecture.id))).status).toBe(404);
  const gateway = createCaptureGateway(() => { throw Error('Must not reach owner app'); }, { handleDevice: async () => Response.json({}) });
  expect((await gateway(new Request('https://phone.example/api/live-bridge/context'))).status).toBe(404);
  expect((await gateway(owner(s.lecture.id))).status).toBe(404);
});

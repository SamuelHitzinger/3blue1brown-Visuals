import { expect, test } from 'bun:test';
import { LectureService } from '../src/lectures.js';
import { createHandler } from '../src/server.js';
import { createCaptureGateway } from '../src/capture-gateway.js';

test('notes stay on owner page; retired reader routes cannot issue links or read notes', async () => {
  const lectures = new LectureService(':memory:');
  const app = createHandler(undefined, undefined, undefined, undefined, lectures);
  const gateway = createCaptureGateway(app, { handleDevice: async () => Response.json({}) });
  try {
    const lecture = await (await app(new Request('http://localhost/api/lectures', {
      method: 'POST', headers: { 'Idempotency-Key': 'reader-removal' }, body: '{}',
    }))).json();
    const paths = [`/live/${lecture.id}`, `/api/lecture-view/${lecture.id}`, `/api/lecture-view/${lecture.id}/models/${'a'.repeat(64)}.glb`, `/api/lectures/${lecture.id}/view-link`];
    for (const handler of [app, gateway]) for (const path of paths) for (const method of ['GET', 'POST', 'DELETE']) {
      expect((await handler(new Request(`http://localhost${path}`, { method }))).status).toBe(404);
    }
    expect((await app(new Request(`http://localhost/api/lectures/${lecture.id}`))).status).toBe(200);
    expect((await gateway(new Request(`http://localhost/api/lectures/${lecture.id}`))).status).toBe(404);
    expect((await gateway(new Request('http://localhost/capture'))).status).toBe(200);
  } finally { await lectures.close(); }
});

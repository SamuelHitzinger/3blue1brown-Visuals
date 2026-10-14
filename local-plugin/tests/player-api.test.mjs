import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { playerRead, playerRequestScenes } from '../scripts/player-api.mjs';

test('player bridge rejects arbitrary URLs, routes and mismatched write context before requests', async () => {
  for (const path of ['http://example.com', '/api/videos', '/api/models', '/api/videos/../secret', '/api/videos/00000000-0000-4000-8000-000000000000?x=1']) {
    await assert.rejects(playerRead('http://127.0.0.1:47831', { path }), /Unsupported/);
  }
  await assert.rejects(playerRequestScenes('http://127.0.0.1:47831', { videoId: '00000000-0000-4000-8000-000000000000', key: 'test', input: { context: { lessonId: 'other' } } }), /Invalid/);
});

test('player bridge preserves binary chunks, original follow-up context and retry key', async () => {
  const id = '00000000-0000-4000-8000-000000000000';
  const bytes = Buffer.alloc(300_000, 231);
  let submitted, binaryReads = 0;
  const server = createServer(async (request, response) => {
    if (request.method === 'POST') {
      const parts = []; for await (const part of request) parts.push(part);
      submitted = { key: request.headers['idempotency-key'], body: JSON.parse(Buffer.concat(parts)) };
      response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify({ id }));
    } else { binaryReads++; response.setHeader('Content-Type', 'audio/wav'); response.end(bytes); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  try {
    const path = `/api/videos/${id}/audio/scene-0`;
    const first = await playerRead(origin, { path });
    const last = await playerRead(origin, { path, offset: first.nextOffset });
    assert.equal(last.nextOffset, null);
    assert.deepEqual(Buffer.concat([Buffer.from(first.base64, 'base64'), Buffer.from(last.base64, 'base64')]), bytes);
    assert.equal(binaryReads, 1, 'Immutable audio is not downloaded again for every chunk');
    const input = { question: 'Exact question π', context: { lessonId: id, scene: { controls: { distance: 1.7 } } } };
    assert.deepEqual(await playerRequestScenes(origin, { videoId: id, key: 'same-key', input }), { id });
    assert.deepEqual(submitted, { key: 'same-key', body: input });
  } finally { await new Promise(resolve => server.close(resolve)); }
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('client submits unchanged prompt, original file bytes and stable idempotency key', async () => {
  const { VideoClient } = await import('../scripts/client.mjs');
  const dir = await mkdtemp(join(tmpdir(), 'aha-client-'));
  const bytes = Buffer.from([0, 255, 1, 13, 10, 42]);
  const file = join(dir, 'source.png');
  await writeFile(file, bytes);
  const request = { title: 'Interactive source', topic: 'Exact prompt\nπ; $literal', documents: [{ name: 'notes', text: 'All source text' }] };
  let count = 0;
  const server = createServer(async (req, res) => {
    count++;
    assert.equal(req.url, '/api/videos');
    assert.equal(req.headers['idempotency-key'], 'unchanged-key');
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const form = await new Response(Buffer.concat(chunks), { headers: { 'Content-Type': req.headers['content-type'] } }).formData();
    assert.deepEqual(JSON.parse(form.get('request')), request);
    assert.equal(form.get('files').name, 'source.png');
    assert.deepEqual(Buffer.from(await form.get('files').arrayBuffer()), bytes);
    res.writeHead(202, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ id: 'same-job', status: 'queued', scenes: [] }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const client = new VideoClient(`http://127.0.0.1:${server.address().port}`);
    assert.equal((await client.create(request, 'unchanged-key', [file])).id, 'same-job');
    assert.equal((await client.create(request, 'unchanged-key', [file])).id, 'same-job');
    assert.equal(count, 2);
  } finally { await new Promise(resolve => server.close(resolve)); await rm(dir, { recursive: true, force: true }); }
});

test('client refuses non-loopback origins and surfaces failed HTTP responses', async () => {
  const { VideoClient } = await import('../scripts/client.mjs');
  for (const origin of ['https://example.com', 'http://127.0.0.1.evil.test', 'http://user:pass@127.0.0.1', 'http://127.0.0.1/path']) {
    assert.throws(() => new VideoClient(origin), /loopback origin/);
  }
  const server = createServer((req, res) => { res.writeHead(409); res.end('{"detail":"Idempotency key already used for a different request"}'); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const client = new VideoClient(`http://127.0.0.1:${server.address().port}`);
    await assert.rejects(client.create({ title: 'Title', topic: 'x', documents: [] }, 'key'), /Idempotency key already used/);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('summaries keep interaction URL, progress and failures without echoing source documents', async () => {
  const { summarize } = await import('../scripts/client.mjs');
  const result = summarize({ id: 'job', title: 'Lesson', status: 'failed', provider: 'pi', scenes: [{ duration: 4, source: 'private source' }], error: 'Provider unavailable', progress: { stage: 'scene', percent: 35 } }, 'http://127.0.0.1:47831');
  assert.equal(result.playerUrl, 'http://127.0.0.1:47831/watch/job');
  assert.equal(result.error, 'Provider unavailable');
  assert.equal(result.progress.percent, 35);
  assert.equal(result.playableScenes, 1);
  assert.ok(!JSON.stringify(result).includes('private source'));
});

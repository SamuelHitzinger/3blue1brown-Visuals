import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { makeServer, BridgeClient, ConfiguredBridgeClient } from '../scripts/server.mjs';

test('connection changes require reading the new lecture before camera or speech calls', async () => {
  let config = { origin: 'http://127.0.0.1:8080', lectureId: 'first', token: 'a'.repeat(64) };
  const sent = [];
  const client = new ConfiguredBridgeClient(async () => config, async (url, options) => {
    sent.push(options.headers.Authorization);
    return Response.json(url.endsWith('/context') ? { id: config.lectureId } : { accepted: true });
  });
  await client.request('context');
  await client.request('speech', { text: 'First lecture' });
  config = { ...config, lectureId: 'second', token: 'b'.repeat(64) };
  await assert.rejects(client.request('speech', { text: 'Stale lecture' }), /get_lecture_context/);
  await assert.rejects(client.request('frames'), /get_lecture_context/);
  assert.equal(sent.length, 2);
  await client.request('context');
  await client.request('speech', { text: 'Second lecture' });
  assert.equal(sent.at(-1), `Bearer ${'b'.repeat(64)}`);
});

test('MCP exposes scoped tools and actual bounded camera image content', async () => {
  const frames = Array.from({ length: 8 }, (_, i) => ({ id: `f${i}`, capturedAt: '2026-10-14T10:00:00Z', mimeType: 'image/jpeg', data: '/9j/AQ==' }));
  const calls = [];
  const server = makeServer({ request: async (path, body) => { calls.push({ path, body }); return path === 'frames' ? { frames } : path === 'context' ? { id: 'lecture', title: 'Mechanics' } : { accepted: true }; } });
  const client = new Client({ name: 'test', version: '1' });
  const [a,b] = InMemoryTransport.createLinkedPair();
  await server.connect(a); await client.connect(b);
  try {
    const { tools } = await client.listTools(); assert.deepEqual(tools.map(t => t.name).sort(), ['get_camera_frames','get_lecture_context','submit_speech_notes']);
    const result = await client.callTool({ name: 'get_camera_frames', arguments: {} });
    assert.equal(result.content.filter(c => c.type === 'image').length, 2);
    assert.equal(result.content.find(c => c.type === 'image').data, '/9j/AQ==');
    assert.equal(result.structuredContent.nextCursor, 'f1');
    const next = await client.callTool({ name: 'get_camera_frames', arguments: { afterFrameId: 'f1' } });
    assert.equal(next.structuredContent.nextCursor, 'f3');
    const lost = await client.callTool({ name: 'get_camera_frames', arguments: { afterFrameId: 'gone' } });
    assert.equal(lost.structuredContent.gap, true);
    const batchId = '15332733-f5e6-4135-ae66-af900f1f551e';
    await client.callTool({ name: 'submit_speech_notes', arguments: { batchId, text: 'Force is zero.', frameIds: [] } });
    assert.equal(calls.at(-1).body.batchId, batchId);
  } finally { await client.close(); await server.close(); }
});
test('client refuses remote/credential-bearing origins and hides upstream errors', async () => {
  for (const origin of ['https://evil.example', 'http://localhost.evil', 'http://user@localhost:8080', 'http://127.0.0.1:8080/path']) assert.throws(() => new BridgeClient({ origin, token: 'a'.repeat(64) }));
  const client = new BridgeClient({ origin: 'http://127.0.0.1:8080', token: 'a'.repeat(64) }, async () => new Response('secret internal details', { status: 500 }));
  await assert.rejects(client.request('context'), /Bridge request failed \(500\)/);
  await assert.rejects(client.request('../lectures'), /Unsupported/);
});

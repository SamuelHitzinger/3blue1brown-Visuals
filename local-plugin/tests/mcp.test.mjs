import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runtimeRoot } from '../scripts/runtime.mjs';

test('local MCP advertises inline player and returns tightly scoped UI resource', async () => {
  const require = createRequire(join(runtimeRoot, 'package.json'));
  const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
  const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
  const client = new Client({ name: 'aha-test', version: '1.0.0' });
  const transport = new StdioClientTransport({ command: process.execPath, args: [fileURLToPath(new URL('../scripts/mcp.mjs', import.meta.url))], stderr: 'pipe' });
  try {
    await client.connect(transport);
    const tools = await client.listTools();
    const show = tools.tools.find(tool => tool.name === 'show_video');
    assert.equal(show._meta.ui.resourceUri, 'ui://aha-video/player-v2.html');
    const resource = (await client.readResource({ uri: show._meta.ui.resourceUri })).contents[0];
    assert.equal(resource.mimeType, 'text/html;profile=mcp-app');
    assert.deepEqual(resource._meta['openai/ui'].availableDisplayModes, ['inline', 'fullscreen']);
    assert.deepEqual(resource._meta.ui.csp, { connectDomains: [], resourceDomains: [], frameDomains: [] });
    assert.ok(!resource.text.includes('<iframe'));
    assert.deepEqual(tools.tools.find(tool => tool.name === 'player_read')._meta.ui.visibility, ['app']);
    assert.equal(tools.tools.find(tool => tool.name === 'player_request_scenes').annotations.readOnlyHint, false);
    assert.ok(resource.text.includes('ui/notifications/tool-result'));
    assert.ok(!resource.text.includes('__AHA_ORIGIN_JSON__'));
    const rejected = await client.callTool({ name: 'show_video', arguments: { videoId: 'https://example.com' } });
    assert.equal(rejected.isError, true);
  } finally { await client.close(); }
});

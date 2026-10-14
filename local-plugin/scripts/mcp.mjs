#!/usr/bin/env node
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { runtimeRoot, configuration, running, doctor } from './runtime.mjs';
import { VideoClient, summarize } from './client.mjs';
import { PLAYER_RESOURCE, playerResource } from './widget.mjs';
import { playerRead, playerRequestScenes } from './player-api.mjs';

// These versions are already pinned in the unchanged runtime package-lock.json.
const require = createRequire(join(runtimeRoot, 'package.json'));
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { z } = require('zod');
const server = new McpServer({ name: 'aha-video', version: '0.2.0' });
const annotations = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };

async function client() {
  const state = await running();
  if (!state) throw new Error('Aha backend is stopped. Use the aha-video skill to run start, then call this tool again.');
  return new VideoClient(state.origin);
}

server.registerTool('show_video', {
  title: 'Show interactive Aha video',
  description: 'Display a saved Aha lesson directly in chat using the original interactive player. Use after creating a video or when the user asks to play one. Does not generate or modify a lesson.',
  inputSchema: { videoId: z.string().uuid() }, annotations,
  _meta: { ui: { resourceUri: PLAYER_RESOURCE }, 'openai/outputTemplate': PLAYER_RESOURCE },
}, async ({ videoId }) => {
  const api = await client();
  const result = summarize(await api.status(videoId), api.origin);
  return { structuredContent: result, content: [{ type: 'text', text: `${result.title}: ${result.status}. Interactive player provided; host playback must be verified.` }] };
});

server.registerTool('list_videos', {
  title: 'List local Aha videos', description: 'Find saved local Aha video IDs and generation status.', inputSchema: {}, annotations,
}, async () => {
  const api = await client();
  const videos = (await api.list()).map(video => summarize(video, api.origin));
  return { structuredContent: { videos }, content: [{ type: 'text', text: JSON.stringify(videos) }] };
});

server.registerTool('check_setup', {
  title: 'Check local Aha setup', description: 'Check local video runtime, browser and credential configuration without calling model or speech providers.', inputSchema: {}, annotations,
}, async () => {
  const report = await doctor();
  return { structuredContent: report, content: [{ type: 'text', text: JSON.stringify(report) }] };
});

server.registerResource('interactive-player', PLAYER_RESOURCE, { mimeType: 'text/html;profile=mcp-app' }, async () => {
  return { contents: [await playerResource()] };
});

server.registerTool('player_read', {
  title: 'Read Aha playback data', description: 'Read a saved lesson, follow-up status, audio or model asset for the interactive player.',
  inputSchema: { path: z.string().max(512), offset: z.number().int().nonnegative().optional() }, annotations,
  _meta: { ui: { visibility: ['app'] }, 'openai/widgetAccessible': true, 'openai/visibility': 'private' },
}, async args => {
  const api = await client();
  return { content: [{ type: 'text', text: 'Playback data returned.' }], _meta: { playerData: await playerRead(api.origin, args) } };
});

server.registerTool('player_request_scenes', {
  title: 'Create Aha follow-up scenes', description: 'Submit the viewer’s question and exact interactive scene context to the original generation pipeline. Uses configured model and speech providers.',
  inputSchema: { videoId: z.string().uuid(), key: z.string().min(1).max(128), input: z.record(z.string(), z.unknown()) },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  _meta: { ui: { visibility: ['app'] }, 'openai/widgetAccessible': true, 'openai/visibility': 'private' },
}, async args => {
  const api = await client();
  return { content: [{ type: 'text', text: 'Follow-up request submitted.' }], _meta: { playerData: await playerRequestScenes(api.origin, args) } };
});

await server.connect(new StdioServerTransport());

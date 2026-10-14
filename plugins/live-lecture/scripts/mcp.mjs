import { readFile } from 'node:fs/promises';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ConfiguredBridgeClient, makeServer } from './server.mjs';
const path = process.env.AHA_LECTURE_CONFIG || new URL('../.local/connection.json', import.meta.url);
try {
  const server = makeServer(new ConfiguredBridgeClient(async () => JSON.parse(await readFile(path, 'utf8'))));
  await server.connect(new StdioServerTransport());
} catch {
  console.error('Aha Live Lecture could not start. Import a connection file using scripts/configure.mjs and ensure dependencies are installed.');
  process.exitCode = 1;
}

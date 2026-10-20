import { createInterface } from 'node:readline';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createBridge } from './bridge.mjs';
import { createTools, TOOLS, mcpResult } from './tools.mjs';

const dataDir = path.resolve(process.env.ANIMLIB_STUDIO_HOME || path.join(os.homedir(), 'Documents', 'Codex', 'AnimlibStudio'));
const { version } = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
await mkdir(dataDir, { recursive: true });
const bridge = await createBridge({ dataDir, port: Number(process.env.ANIMLIB_STUDIO_PORT || 0) });
const invoke = createTools(bridge);
bridge.setRpc(invoke);
const runtimePath = path.join(dataDir, `runtime-${process.pid}.json`);
const runtime = JSON.stringify({ baseUrl: bridge.baseUrl, token: bridge.masterToken, pid: process.pid, dataDir });
await writeFile(runtimePath, runtime, { mode: 0o600 });
if (process.argv.includes('--serve')) await writeFile(path.join(dataDir, 'runtime-standalone.json'), runtime, { mode: 0o600 });
console.error(`Animlib Studio ready. Runtime: ${runtimePath}`);

let stopping = false;
async function stop() { if (stopping) return; stopping = true; await bridge.close(); process.exit(0); }
process.on('SIGTERM', stop); process.on('SIGINT', stop);
if (!process.argv.includes('--serve')) {
  const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });
  const write = x => process.stdout.write(`${JSON.stringify(x)}\n`);
  lines.on('line', async line => {
    let msg;
    try { if (line.length > 24 * 1024 * 1024) throw Error('Input too large'); msg = JSON.parse(line); }
    catch { write({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }); return; }
    if (!msg || typeof msg !== 'object' || Array.isArray(msg) || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') {
      write({ jsonrpc: '2.0', id: msg?.id ?? null, error: { code: -32600, message: 'Invalid Request' } }); return;
    }
    if (!Object.hasOwn(msg, 'id')) return;
    const respond = result => write({ jsonrpc: '2.0', id: msg.id, result });
    try {
      switch (msg.method) {
        case 'initialize': return respond({ protocolVersion: '2024-11-05', capabilities: { tools: { listChanged: false } }, serverInfo: { name: 'animlib-studio', version }, instructions: 'Persistent animlib animation studio. Reuse intended viewer via sessions/connect. Create scene or sandbox program once, then compact patches, parameters, motion or sequenced flow cues. Include verify and preview in the same call. help documents schemas. Acceptance, render submission and semantic quality are distinct. No Desmos API dependency. Renderer must stay open.' });
        case 'ping': return respond({});
        case 'tools/list': return respond({ tools: TOOLS });
        case 'tools/call': {
          try { return respond(mcpResult(await invoke(msg.params.name, msg.params.arguments || {}))); }
          catch (e) { return respond({ isError: true, content: [{ type: 'text', text: e.message }] }); }
        }
        default: return write({ jsonrpc: '2.0', id: msg.id, error: { code: -32601, message: 'Method not found' } });
      }
    } catch (e) { write({ jsonrpc: '2.0', id: msg.id, error: { code: -32603, message: e.message } }); }
  });
  lines.on('close', stop);
}

// Adapted from the supplied Desmos Studio 0.6.0 bridge (13544c8).
// Renderer protocol and persisted data are now animlib-native.
import http from 'node:http';
import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { readFile, writeFile, mkdir, readdir, rename } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = fileURLToPath(new URL('../dist/', import.meta.url));
const MAX_BODY = 16 * 1024 * 1024;
const token = () => randomBytes(32).toString('hex');
const same = (a, b) => typeof a === 'string' && typeof b === 'string' && Buffer.byteLength(a) === Buffer.byteLength(b) && timingSafeEqual(Buffer.from(a), Buffer.from(b));

async function body(req) {
  let size = 0; const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw Object.assign(Error('Request too large.'), { status: 413 });
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString() || '{}'); }
  catch { throw Object.assign(Error('Invalid JSON.'), { status: 400 }); }
}
function send(res, status, value) {
  res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(JSON.stringify(value));
}

export async function createBridge({ dataDir, commandTimeoutMs = 30000, port = 0 } = {}) {
  if (!dataDir) throw Error('dataDir required.');
  await mkdir(path.join(dataDir, 'sessions'), { recursive: true });
  await mkdir(path.join(dataDir, 'exports'), { recursive: true });
  const sessions = new Map(), pending = new Map(), masterToken = token();
  let baseUrl, rpc;
  const makeSession = ({ id = randomUUID(), title = 'Animation', state = null, key = token() }) => {
    if(!/^[a-f0-9-]{36}$/.test(id)||!/^[a-f0-9]{64}$/.test(key))throw Error('Invalid saved session identity');
    const s = { id, title, state, key, stream: null, lease: null, connected: false, queue: Promise.resolve(), lastError: null };
    sessions.set(id, s); return s;
  };
  for (const file of await readdir(path.join(dataDir, 'sessions'))) {
    if (!/^[a-f0-9-]+\.json$/.test(file)) continue;
    try { makeSession(JSON.parse(await readFile(path.join(dataDir, 'sessions', file), 'utf8'))); } catch {}
  }
  function publicSession(s) {
    return { sessionId: s.id, title: s.title, connected: s.connected, lastError: s.lastError, viewerUrl: `${baseUrl}/?session=${s.id}#token=${s.key}` };
  }
  async function refresh(s) {
    // Another MCP process may have served and checkpointed this same session
    // since startup. Read disk at renderer admission, never replay cached state.
    if(s.connected)return;
    const saved=JSON.parse(await readFile(path.join(dataDir,'sessions',`${s.id}.json`),'utf8'));
    if(saved.id!==s.id||!same(saved.key,s.key))throw Error('Saved session identity changed; list sessions again.');
    s.state=saved.state;s.title=saved.title;
  }
  async function persist(s) {
    // Serial writes per session prevent older checkpoints replacing newer ones.
    const data = JSON.stringify({ id: s.id, title: s.title, state: s.state, key: s.key });
    s.save = (s.save || Promise.resolve()).catch(() => {}).then(async () => {
      const target = path.join(dataDir, 'sessions', `${s.id}.json`), temporary = `${target}.${process.pid}.tmp`;
      await writeFile(temporary, data); await rename(temporary, target);
    });
    return s.save;
  }
  const server = http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    try {
      const expectedHost = new URL(baseUrl).host;
      if (req.headers.host !== expectedHost) return send(res, 403, { error: 'Invalid host.' });
      if (req.headers.origin && req.headers.origin !== baseUrl) return send(res, 403, { error: 'Cross-origin requests denied.' });
      const url = new URL(req.url, baseUrl);
      if (url.pathname === '/rpc' && req.method === 'POST') {
        if (!same(req.headers.authorization, `Bearer ${masterToken}`)) return send(res, 401, { error: 'Unauthorized.' });
        const input = await body(req);
        return send(res, 200, await rpc(input.name, input.arguments || {}));
      }
      const match = url.pathname.match(/^\/s\/([a-f0-9-]+)\/(bootstrap|events|result|checkpoint|error)$/);
      if (match) {
        const s = sessions.get(match[1]);
        if (!s || !same(url.searchParams.get('token'), s.key)) return send(res, 401, { error: 'Invalid session capability.' });
        const route = match[2];
        if (route === 'bootstrap' && req.method === 'GET') {
          await refresh(s);return send(res, 200, {title: s.title, state: s.state});
        }
        if (route === 'events' && req.method === 'GET') {
          if (s.stream) return send(res, 409, { error: 'A renderer is already connected. Close its tab before opening another.' });
          await refresh(s);
          // Recheck after the disk await; concurrent admissions must not race.
          if (s.stream) return send(res, 409, { error: 'A renderer is already connected. Close its tab before opening another.' });
          res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive', 'x-accel-buffering': 'no' });
          s.stream = res; s.lease = token(); s.connected = true; s.lastError = null;
          res.write(`event: ready\ndata: ${JSON.stringify({ sessionId: s.id, lease: s.lease, state: s.state })}\n\n`);
          const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 10000);
          req.on('close', () => {
            clearInterval(heartbeat);
            if (s.stream === res) { s.stream = null; s.lease = null; s.connected = false; }
            for (const [id, p] of pending) if (p.sessionId === s.id) {
              clearTimeout(p.timer); pending.delete(id); p.reject(Error('Renderer disconnected after dispatch; outcome unknown. Inspect graph before retrying.'));
            }
          });
          return;
        }
        if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed.' });
        const input = await body(req);
        if (['result', 'checkpoint'].includes(route) && (!s.connected || !same(input.lease, s.lease))) return send(res, 409, { error: 'Renderer ownership expired; state was not saved.' });
        if (route === 'result') {
          const p = pending.get(input.id);
          if (!p || p.sessionId !== s.id) return send(res, 409, { error: 'Request expired or unknown; result ignored.' });
          pending.delete(input.id); clearTimeout(p.timer);
          if (input.error) p.reject(Error(input.error)); else p.resolve(input.result);
        } else if (route === 'checkpoint') {
          if (input.state?.format!=='animlib-studio-1'||!Array.isArray(input.state.records)||input.state.records.length>512
            ||!Array.isArray(input.state.queue)||input.state.queue.length>128||!Array.isArray(input.state.sequences)
            ||!Number.isFinite(input.state.time)||input.state.time<0||JSON.stringify(input.state).length>2_000_000) throw Error('Invalid state checkpoint.');
          s.state = input.state; await persist(s);
        } else if (route === 'error') {
          s.lastError = String(input.error).slice(0, 2000);
        } else return send(res, 405, { error: 'Method not allowed.' });
        return send(res, 200, { ok: true });
      }
      const file=url.pathname==='/'?'index.html':/^\/assets\/[A-Za-z0-9_.-]+$/.test(url.pathname)?url.pathname.slice(1):null;
      if (req.method === 'GET' && file) {
        const type={'.html':'text/html','.js':'text/javascript','.css':'text/css','.wasm':'application/wasm','.woff':'font/woff','.woff2':'font/woff2'}[path.extname(file)]||'application/octet-stream';
        res.writeHead(200, { 'content-type': type, 'cache-control': 'no-store', 'content-security-policy': "frame-ancestors 'none'" });
        return res.end(await readFile(path.join(webRoot, file)));
      }
      send(res, 404, { error: 'Not found.' });
    } catch (e) { if (!res.headersSent) send(res, e.status || 400, { error: e.message }); else res.end(); }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  async function command(sessionId, kind, params = {}) {
    const s = sessions.get(sessionId);
    if (!s) throw Error('Unknown sessionId. Use animlib_sessions.');
    const work = s.queue.catch(() => {}).then(async () => {
      if (!s.connected || !s.stream) throw Error(`Renderer not connected. Open viewerUrl first. ${s.lastError || ''}`);
      return new Promise((resolve, reject) => {
        const id = randomUUID();
        const timer = setTimeout(() => { pending.delete(id); reject(Error('Command timed out after dispatch; outcome unknown. Inspect graph before retrying.')); }, commandTimeoutMs);
        pending.set(id, { sessionId, resolve, reject, timer });
        s.stream.write(`event: command\ndata: ${JSON.stringify({ id, kind, params, deadline: Date.now() + commandTimeoutMs })}\n\n`);
      });
    });
    s.queue = work;
    return work;
  }
  return {
    baseUrl, masterToken, dataDir, command,
    setRpc: handler => { rpc = handler; },
    list: () => [...sessions.values()].map(publicSession),
    async create(p={}) {
      if (sessions.size >= 100) throw Error('100-session limit reached.');
      if(p.title!==undefined&&(typeof p.title!=='string'||p.title.length>200))throw Error('Invalid title');
      const s = makeSession({title:p.title}); await persist(s); return publicSession(s);
    },
    async close() {
      for (const s of sessions.values()) s.stream?.end();
      for (const p of pending.values()) { clearTimeout(p.timer); p.reject(Error('Server stopped.')); }
      pending.clear(); server.closeAllConnections();
      await new Promise(resolve => server.close(resolve));
      await Promise.allSettled([...sessions.values()].map(s => s.save));
    }
  };
}

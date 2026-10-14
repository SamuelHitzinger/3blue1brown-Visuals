// The MCP host is the only transport. This component makes no localhost requests.
const pending = new Map();
const listeners = new Set();
const streams = new Set();
let sequence = 100;
let latest;
let disposed = false;
let resolveReady;
const ready = new Promise(resolve => { resolveReady = resolve; });
export function onVideo(listener) { listeners.add(listener); if (latest) listener(latest); return () => listeners.delete(listener); }
export function request(method, params) {
  if (disposed) return Promise.reject(new Error('Player closed'));
  const id = ++sequence;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new Error('Plugin request timed out')); }, 60_000);
    pending.set(id, { resolve, reject, timer });
    window.parent.postMessage({ jsonrpc: '2.0', id, method, params }, '*');
  });
}
async function call(name, args) {
  await ready;
  const result = await request('tools/call', { name, arguments: args });
  if (result.isError) throw new Error(result.content?.find(item => item.type === 'text')?.text ?? 'Plugin request failed');
  return result._meta?.playerData ?? result.structuredContent;
}
function receive(result) {
  const data = result?.structuredContent ?? result;
  if (!data?.id || !/^[0-9a-f-]{36}$/.test(data.id)) return;
  latest = data;
  for (const listener of listeners) listener(data);
}
window.addEventListener('message', event => {
  if (event.source !== window.parent || event.data?.jsonrpc !== '2.0') return;
  const message = event.data;
  if (message.method === 'ping' || message.method === 'ui/resource-teardown') {
    if (message.method === 'ui/resource-teardown') {
      disposed = true;
      for (const stream of streams) stream.close();
      window.dispatchEvent(new Event('aha-teardown'));
      observer.disconnect();
      for (const item of pending.values()) { clearTimeout(item.timer); item.reject(new Error('Player closed')); }
      pending.clear();
    }
    window.parent.postMessage({ jsonrpc: '2.0', id: message.id, result: {} }, '*');
    return;
  }
  if (pending.has(message.id)) {
    const item = pending.get(message.id); pending.delete(message.id); clearTimeout(item.timer);
    if (message.error) item.reject(new Error(message.error.message)); else item.resolve(message.result);
  } else if (message.method === 'ui/notifications/tool-result') receive(message.params);
});
window.addEventListener('openai:set_globals', event => receive(event.detail?.globals?.toolOutput));
request('ui/initialize', { appInfo: { name: 'aha-video-player', version: '0.2.0' }, appCapabilities: {}, protocolVersion: '2026-01-26' })
  .then(() => { window.parent.postMessage({ jsonrpc: '2.0', method: 'ui/notifications/initialized', params: {} }, '*'); resolveReady(); })
  .catch(error => { document.getElementById('status').textContent = error.message; });
const observer = new ResizeObserver(() => window.parent.postMessage({ jsonrpc: '2.0', method: 'ui/notifications/size-changed', params: { height: Math.min(800, document.documentElement.scrollHeight) } }, '*'));
observer.observe(document.body);
receive(window.openai?.toolOutput);

const nativeFetch = window.fetch.bind(window);
window.fetch = async (input, options = {}) => {
  const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (/^(blob:|data:)/.test(raw)) return nativeFetch(input, options);
  if (!raw.startsWith('/api/')) throw new Error('Unsupported player network request');
  options.signal?.throwIfAborted();
  const method = options.method ?? 'GET';
  if (method === 'POST' && /^\/api\/videos\/[0-9a-f-]{36}\/scene-requests$/.test(raw)) {
    const value = await call('player_request_scenes', { videoId: raw.split('/')[3], key: new Headers(options.headers).get('Idempotency-Key'), input: JSON.parse(options.body) });
    return Response.json(value);
  }
  if (method !== 'GET') throw new Error('Unsupported player operation');
  const chunks = [];
  let offset = 0, result;
  do {
    options.signal?.throwIfAborted();
    result = await call('player_read', { path: raw, offset });
    if ('json' in result) return Response.json(result.json, { status: result.status });
    chunks.push(Uint8Array.from(atob(result.base64), char => char.charCodeAt(0)));
    offset = result.nextOffset;
  } while (offset !== null);
  options.signal?.throwIfAborted();
  return new Response(new Blob(chunks, { type: result.mimeType }), { status: result.status,
    headers: { 'Content-Type': result.mimeType, 'Content-Length': String(result.total) } });
};

// Original player consumes authoritative SSE snapshots. Poll those same snapshots
// over MCP; keep EventSource event names, terminal states and reconnect behavior.
window.EventSource = class extends EventTarget {
  constructor(path) {
    super();
    if (!/^\/api\/videos\/[0-9a-f-]{36}\/events$/.test(path)) throw new Error('Unsupported event stream');
    this.path = path.slice(0, -7); this.closed = false; this.readyState = 0; streams.add(this);
    queueMicrotask(() => this.poll());
  }
  close() { this.closed = true; this.readyState = 2; clearTimeout(this.timer); streams.delete(this); }
  async poll() {
    try {
      const response = await window.fetch(this.path);
      if (this.closed) return;
      if (response.status === 404) { this.dispatchEvent(new MessageEvent('deleted', { data: '{}' })); this.close(); return; }
      if (!response.ok) throw new Error('Manifest unavailable');
      const value = await response.json(); this.readyState = 1;
      if (value.revision !== this.revision) { this.revision = value.revision; this.dispatchEvent(new MessageEvent('manifest', { data: JSON.stringify(value) })); }
    } catch {
      if (!this.closed) { this.readyState = 0; const event = new Event('error'); this.dispatchEvent(event); this.onerror?.(event); }
    }
    if (!this.closed) this.timer = setTimeout(() => this.poll(), 1500);
  }
};

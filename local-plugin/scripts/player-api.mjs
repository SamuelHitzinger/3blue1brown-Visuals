import { VideoClient } from './client.mjs';

const uuid = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const videoPath = new RegExp(`^/api/videos/(${uuid})(?:/(scene-requests|audio/[^/]+))?$`);
const modelPath = /^\/api\/models\/[0-9a-f]{64}\.glb$/;
const binaryCache = new Map();
let cachedBytes = 0;
const binaryLimit = 64 * 1024 * 1024;

function chunk(asset, offset) {
  if (offset > asset.bytes.length) throw new Error('Offset exceeds resource length');
  const end = Math.min(asset.bytes.length, offset + 256 * 1024);
  return { status: 200, mimeType: asset.mimeType, base64: asset.bytes.subarray(offset, end).toString('base64'),
    total: asset.bytes.length, nextOffset: end < asset.bytes.length ? end : null };
}

/** Explicit player operations only; never a general URL/filesystem proxy. */
export async function playerRead(origin, { path, offset = 0 }) {
  const api = new VideoClient(origin);
  if (typeof path !== 'string' || (!videoPath.test(path) && !modelPath.test(path)) || /[%?#\\]/.test(path)) throw new Error('Unsupported player resource');
  if (!Number.isSafeInteger(offset) || offset < 0) throw new Error('Invalid resource offset');
  const url = `${api.origin}${path}`;
  const cached = binaryCache.get(url);
  if (cached) { binaryCache.delete(url); binaryCache.set(url, cached); return chunk(cached, offset); }
  const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(30_000) });
  if (response.headers.get('content-type')?.includes('application/json')) {
    return { status: response.status, json: await response.json() };
  }
  if (!response.ok) return { status: response.status, json: { detail: `Player resource failed (${response.status})` } };
  const parts = []; let size = 0;
  for await (const part of response.body) {
    size += part.length;
    if (size > binaryLimit) throw new Error('Player resource exceeds transfer limit');
    parts.push(part);
  }
  const asset = { bytes: Buffer.concat(parts), mimeType: response.headers.get('content-type') ?? 'application/octet-stream' };
  while (binaryCache.size && (cachedBytes + size > binaryLimit || binaryCache.size >= 64)) {
    const key = binaryCache.keys().next().value;
    cachedBytes -= binaryCache.get(key).bytes.length; binaryCache.delete(key);
  }
  binaryCache.set(url, asset); cachedBytes += size;
  return chunk(asset, offset);
}

export async function playerRequestScenes(origin, { videoId, key, input }) {
  if (!new RegExp(`^${uuid}$`).test(videoId) || input?.context?.lessonId !== videoId) throw new Error('Invalid lesson context');
  if (typeof key !== 'string' || !key.trim() || key.length > 128) throw new Error('Stable idempotency key required');
  const body = JSON.stringify(input);
  if (Buffer.byteLength(body) > 1_000_000) throw new Error('Scene context must be under 1 MB');
  const api = new VideoClient(origin);
  // Keep original backend validation, idempotency and generation pipeline.
  return api.json(`/api/videos/${videoId}/scene-requests`, { method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key, Origin: api.origin }, body });
}

import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';

export class VideoClient {
  constructor(origin) {
    const url = new URL(origin);
    if (url.protocol !== 'http:' || !['127.0.0.1', '[::1]', 'localhost'].includes(url.hostname)
      || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
      throw new Error('Expected an HTTP loopback origin without credentials or a path.');
    }
    this.origin = url.origin;
  }

  async json(path, options = {}) {
    const response = await fetch(`${this.origin}${path}`, { ...options, redirect: 'error', signal: AbortSignal.timeout(60_000) });
    const body = await response.json();
    if (!response.ok) throw new Error(body.detail ?? `Video service returned HTTP ${response.status}.`);
    return body;
  }

  async create(request, key, files = []) {
    if (typeof key !== 'string' || !key.trim() || key.length > 128) throw new Error('A stable idempotencyKey (1–128 characters) is required.');
    const headers = { 'Idempotency-Key': key, Origin: this.origin };
    let body;
    if (files.length) {
      body = new FormData();
      body.set('request', JSON.stringify(request));
      for (const path of files) body.append('files', new Blob([await readFile(path)]), basename(path));
    } else {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(request);
    }
    return this.json('/api/videos', { method: 'POST', headers, body });
  }

  status(id) { return this.json(`/api/videos/${encodeURIComponent(id)}`); }
  list() { return this.json('/api/videos'); }
}

export function summarize(video, origin) {
  return {
    id: video.id, title: video.title, status: video.status, provider: video.provider,
    playerUrl: `${origin}/watch/${encodeURIComponent(video.id)}`,
    playableScenes: video.scenes.length,
    duration: video.scenes.reduce((sum, scene) => sum + scene.duration, 0),
    ...(video.narrationMode ? { narrationMode: video.narrationMode } : {}),
    ...(video.progress ? { progress: video.progress } : {}),
    ...(video.tokenUsage ? { tokenUsage: video.tokenUsage } : {}),
    ...(video.recovery ? { recovery: video.recovery } : {}),
    ...(video.error ? { error: video.error, errorCode: video.errorCode } : {}),
  };
}

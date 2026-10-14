/** Run from repository root after app:build. Uses only synthetic media and in-memory stores. */
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import puppeteer from 'puppeteer-core';
import { LectureService } from '../backend/src/lectures.ts';
import { LectureCaptureService } from '../backend/src/lecture-capture.ts';
import { createHandler } from '../backend/src/server.ts';

const directory = resolve('docs/validation/direct-browser-capture');
await mkdir(directory, { recursive: true });
const received: { kind: string; bytes: number; duration?: number }[] = [];
const lectures = new LectureService(':memory:', async input => ({
  summary: 'Synthetic browser capture validation.',
  sections: [{ id: 'capture', title: 'Capture', points: [{ text: 'Synthetic microphone and camera material received.', sourceIds: input.sources.map(s => s.id) }] }],
  concepts: [], questions: [],
}), { synthesisDebounceMs: 100 });
const request = (path: string, method = 'GET', body?: unknown) => new Request(`http://localhost${path}`, {
  method, headers: { 'Idempotency-Key': 'qa' }, ...(body ? { body: JSON.stringify(body) } : {}),
});
const lecture = await (await lectures.handle(request('/api/lectures', 'POST', { title: 'Browser capture validation' }))).json();
const captures = new LectureCaptureService(':memory:', lectures, {
  publicOrigin: 'https://capture.test', transcriptionProvider: 'Synthetic test provider',
  extract: async (file, meta) => { received.push({ kind: meta.kind, bytes: file.size, duration: meta.durationMs }); return `Synthetic ${meta.kind} ${meta.clientId}`; },
});
const pairing = await (await captures.handleOwner(request(`/api/lectures/${lecture.id}/capture-pairings`, 'POST'))).json();
const app = createHandler(undefined, undefined, undefined, undefined, lectures, captures);
let offline = false;
const server = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch: async req => {
  const url = new URL(req.url);
  if (url.pathname.startsWith('/api/capture/')) {
    if (offline) return Response.json({ detail: 'Synthetic network outage' }, { status: 503 });
    // Loopback is browser-secure. Mirror the production private HTTPS proxy origin.
    const headers = new Headers(req.headers); headers.set('Origin', 'https://capture.test');
    return captures.handleDevice(new Request(`https://capture.test${url.pathname}`, { method: req.method, headers,
      ...(req.method === 'GET' ? {} : { body: await req.arrayBuffer() }) }));
  }
  return app(req);
} });
const browser = await puppeteer.launch({ executablePath: process.argv[2] ?? process.env.SCENE_PREVIEW_CHROMIUM ?? '/usr/bin/chromium', headless: true,
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
const errors: string[] = []; page.on('pageerror', error => errors.push(String(error))); page.on('dialog', dialog => dialog.accept());
await page.setViewport({ width: 393, height: 852, deviceScaleFactor: 1 });
try {
  await page.goto(`${server.url}capture${new URL(pairing.url).hash}`);
  await page.waitForSelector('.capture-start:not(:disabled)');
  await page.click('.capture-start');
  await page.waitForFunction(() => document.querySelector('.capture-live-status')?.textContent?.includes('Recording'));
  await Bun.sleep(17_000);
  if (!received.some(item => item.kind === 'audio' && item.bytes > 0)) throw new Error('No complete audio file received');
  if (!received.some(item => item.kind === 'photo' && item.bytes > 0)) throw new Error('No photo received');
  await page.screenshot({ path: resolve(directory, 'recording.png'), fullPage: true });
  const receivedBeforeOutage = received.length;
  offline = true;
  await Bun.sleep(19_000);
  await page.waitForFunction(() => document.querySelector('.capture-health')?.textContent?.includes('Connection interrupted'));
  await page.click('.capture-start');
  await page.waitForSelector('.capture-start:not(:disabled)');
  await page.screenshot({ path: resolve(directory, 'offline.png'), fullPage: true });
  const queued = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open('aha-lecture-capture'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    return new Promise<number>(resolve => { const request = db.transaction('items').objectStore('items').count(); request.onsuccess = () => { resolve(request.result); db.close(); }; });
  });
  if (!queued) throw new Error('Outage did not retain a durable upload queue');
  offline = false;
  await page.reload();
  await page.waitForSelector('.capture-start:not(:disabled)');
  await page.waitForFunction(() => document.querySelector('.capture-health')?.textContent?.includes('Live notes caught up'), { timeout: 20_000 });
  await page.screenshot({ path: resolve(directory, 'recovered.png'), fullPage: true });
  const session = lectures.getOwned('local', lecture.id)!;
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  if (overflow || errors.length || received.length < receivedBeforeOutage + queued || session.sourceRevision !== session.synthesizedRevision) throw new Error(JSON.stringify({ overflow, errors, receivedBeforeOutage, queued, received: received.length, sourceRevision: session.sourceRevision, synthesizedRevision: session.synthesizedRevision }));
  console.log(JSON.stringify({ received, queuedDuringOutage: queued, recoveredCoverage: session.synthesizedRevision, overflow, pageErrors: errors }));
} finally { await browser.close(); server.stop(true); await captures.close(); await lectures.close(); }

/** Run after app:build. Two isolated browsers, synthetic media, in-memory stores, no AI calls. */
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import puppeteer from 'puppeteer-core';
import { LectureService } from '../backend/src/lectures.ts';
import { LectureCaptureService } from '../backend/src/lecture-capture.ts';
import { createHandler } from '../backend/src/server.ts';

const output = resolve('.tmp/lecture-recording'); await mkdir(output, { recursive: true });
const received: string[] = [];
const lectures = new LectureService(':memory:', async input => ({ summary: `Live notes from ${input.sources.length} captured sources.`,
  sections: [{ id: 'capture', title: 'Lecture material', points: [{ text: 'Audio and slide photos arrived from the recording device.', sourceIds: input.sources.map(source => source.id) }] }], concepts: [], questions: [] }));
const lecture = await (await lectures.handle(new Request('http://localhost/api/lectures', { method: 'POST', headers: { 'Idempotency-Key': 'test' }, body: '{}' }))).json();
const capture = new LectureCaptureService(':memory:', lectures, { publicOrigin: 'https://capture.test', extract: async (file, metadata) => { assert.ok(file.size); received.push(metadata.kind); return `Synthetic ${metadata.kind} lecture material`; } });
const app = createHandler(undefined, undefined, undefined, undefined, lectures, capture);
let pairings = 0;
const server = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch: async request => {
  const path = new URL(request.url).pathname;
  if (path === '/api/videos') return Response.json([]);
  if (path.endsWith('/capture-pairings') && request.method === 'POST') pairings++;
  if (path.startsWith('/api/capture/')) {
    const headers = new Headers(request.headers); headers.set('Origin', 'https://capture.test');
    return capture.handleDevice(new Request(`https://capture.test${path}`, { method: request.method, headers, ...(request.method === 'GET' ? {} : { body: await request.arrayBuffer() }) }));
  }
  return app(request);
} });
const options = { executablePath: process.argv[2] ?? process.env.SCENE_PREVIEW_CHROMIUM ?? '/usr/bin/chromium', headless: true,
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] };
const desktopBrowser = await puppeteer.launch(options), deviceBrowser = await puppeteer.launch(options);
const desktop = await desktopBrowser.newPage(), device = await deviceBrowser.newPage();
const errors: string[] = []; for (const page of [desktop, device]) page.on('pageerror', error => errors.push(String(error)));
try {
  await desktop.setViewport({ width: 1440, height: 1000 });
  const lectureUrl = `${server.url}lectures/${lecture.id}`;
  await desktop.goto(lectureUrl);
  await desktop.waitForSelector('.capture-pairing-qr', { visible: true, timeout: 5000 });
  assert.equal(await desktop.$eval('.capture-pairing-qr', el => !!el.closest('details')), false);
  const link = await desktop.$eval('.capture-qr-link', el => (el as HTMLAnchorElement).href);
  assert.equal(pairings, 1);
  assert.equal(await desktop.$('.viewer-link-panel, .notebook-tools, .notebook-rail, .capture-receipts'), null);
  assert.deepEqual(await desktop.$$eval('.lecture-notebook h2', els => els.map(el => el.textContent?.trim())), ['Scan to record', 'Notes']);
  await desktop.reload();
  await desktop.waitForSelector('.capture-pairing-qr', { visible: true });
  assert.equal(await desktop.$eval('.capture-qr-link', el => (el as HTMLAnchorElement).href), link);
  assert.equal(pairings, 1);
  await desktop.screenshot({ path: resolve(output, 'scan-on-lecture-page.png'), fullPage: true });
  await device.setViewport({ width: 393, height: 852 });
  await device.goto(`${server.url}capture${new URL(link).hash}`);
  await device.waitForSelector('.capture-start:not(:disabled)');
  await device.click('.capture-start');
  await device.waitForFunction(() => document.querySelector('.capture-live-status')?.textContent?.includes('Recording'));
  await desktop.waitForFunction(() => document.querySelector('.capture-connection-connected'));
  await desktop.reload();
  await desktop.waitForSelector('.capture-connection-connected');
  assert.equal(pairings, 1, 'Reload disconnected the recording device');
  await desktop.waitForFunction(() => document.querySelector('.generated-notes')?.textContent?.includes('Audio and slide photos'), { timeout: 25000 });
  for (let i = 0; i < 100 && !received.includes('audio'); i++) await Bun.sleep(250);
  assert.ok(received.includes('audio')); assert.ok(received.includes('photo'));
  await device.click('.capture-start');
  await device.waitForSelector('.capture-start:not(:disabled)');
  await device.waitForFunction(() => document.querySelector('.capture-health')?.textContent?.includes('Live notes caught up'), { timeout: 20000 });
  await desktop.waitForFunction(() => document.querySelector('.lecture-summary')?.textContent?.includes('Live notes from'));
  assert.equal(desktop.url(), lectureUrl);
  const citationRows = await desktop.$$eval('.note-citation', els => els.map(el => Math.round(el.getBoundingClientRect().top)));
  assert.ok(citationRows.length > 1);
  assert.equal(new Set(citationRows).size, 1, 'Collapsed citations should stay on one line');
  await desktop.click('.note-citation summary');
  await desktop.waitForSelector('.note-citation[open]');
  assert.ok(await desktop.$eval('.note-citation[open]', el => el.textContent?.includes('Synthetic')));
  await desktop.click('.note-citation[open] summary');
  await desktop.screenshot({ path: resolve(output, 'notes-on-same-page.png'), fullPage: true });
  await desktop.setViewport({ width: 393, height: 852 });
  await desktop.screenshot({ path: resolve(output, 'mobile-notes.png'), fullPage: true });
  assert.equal(await desktop.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ automaticQr: true, survivesReload: true, liveNotesOnLecturePage: true, received, pageErrors: errors, screenshots: output }));
} finally { await desktopBrowser.close(); await deviceBrowser.close(); server.stop(true); await capture.close(); await lectures.close(); }

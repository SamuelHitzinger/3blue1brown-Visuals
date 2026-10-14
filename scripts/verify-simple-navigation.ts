/** Run after app:build. All API responses are synthetic; no videos are generated. */
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import puppeteer from 'puppeteer-core';
import { createHandler } from '../backend/src/server.ts';

const output = resolve('.tmp/website-cleanup');
await mkdir(output, { recursive: true });
const videos: any[] = [];
const submissions: { body: any; files: string[]; key: string | null }[] = [];
let failNext = false;
const app = createHandler();
const server = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch: async request => {
  const path = new URL(request.url).pathname;
  if (path === '/api/videos' && request.method === 'POST') {
    const multipart = request.headers.get('content-type')?.startsWith('multipart/');
    const form = multipart ? await request.formData() : null;
    const body = form ? JSON.parse(String(form.get('request'))) : await request.json();
    const files = form ? await Promise.all(form.getAll('files').map(file => (file as File).text())) : [];
    submissions.push({ body, files, key: request.headers.get('idempotency-key') });
    if (failNext) { failNext = false; return Response.json({ detail: 'Synthetic temporary failure' }, { status: 503 }); }
    const video = { schemaVersion: 1, id: `qa-${videos.length}`, title: body.title, revision: 1, status: 'queued', provider: 'pi', createdAt: new Date().toISOString(), scenes: [] };
    videos.push(video);
    return Response.json(video);
  }
  if (path === '/api/videos') return Response.json(videos);
  if (path === '/api/lectures') return Response.json([]);
  if (path === '/api/me') return Response.json({ user: { id: 'qa', name: 'Preview' } });
  if (path.endsWith('/events')) return new Response('', { headers: { 'Content-Type': 'text/event-stream' } });
  if (path.startsWith('/api/')) return Response.json({}, { status: 404 });
  return app(request);
} });
const browser = await puppeteer.launch({ executablePath: process.argv[2] ?? process.env.SCENE_PREVIEW_CHROMIUM ?? '/usr/bin/chromium', headless: true });
const page = await browser.newPage();
const errors: string[] = [];
page.on('pageerror', error => errors.push(String(error)));
async function open(path = '/') {
  await page.goto(new URL(path, server.url).href);
  await page.waitForSelector('.learning-top-nav');
  await page.evaluate(() => document.fonts.ready);
}
async function noOverflow() {
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `Overflow at ${page.viewport()?.width}: ${page.url()}`);
}
try {
  for (const width of [1440, 393, 320]) {
    await page.setViewport({ width, height: width === 1440 ? 1000 : 852 });
    await open();
    assert.deepEqual(await page.$$eval('.learning-top-nav button', buttons => buttons.map(button => button.textContent)), ['Home', 'Notes', 'Library']);
    assert.equal(await page.$eval('.create-video-button', button => (button as HTMLButtonElement).disabled), true);
    await page.screenshot({ path: resolve(output, `home-${width}.png`), fullPage: true });
    await noOverflow();
    await page.click('.learning-top-nav button:nth-child(2)');
    await page.waitForSelector('.notes-dashboard');
    await noOverflow();
    await page.click('.learning-top-nav button:nth-child(3)');
    await page.waitForSelector('.library-page');
    await noOverflow();
  }
  await open();
  await page.click('[aria-label="Open navigation"]');
  assert.deepEqual(await page.$$eval('.drawer-links button', buttons => buttons.map(button => button.textContent)), ['Home', 'Notes', 'Library']);
  await page.keyboard.press('Escape');
  assert.equal(await page.$eval('[aria-label="Open navigation"]', button => button === document.activeElement), true);
  for (const [old, next] of [['/videos/new', '/'], ['/settings', '/'], ['/catalog', '/library'], ['/courses', '/lectures'], ['/plan/algebra', '/lectures/course/algebra']]) {
    await open(old);
    assert.equal(new URL(page.url()).pathname, next);
  }
  await open();
  await page.type('#video-topic', 'Why does light bend?');
  failNext = true;
  await page.click('.create-video-button');
  await page.waitForSelector('.composer-error');
  assert.equal(await page.$eval('#video-topic', input => (input as HTMLTextAreaElement).value), 'Why does light bend?');
  await page.click('.create-video-button');
  await page.waitForFunction(() => location.pathname.startsWith('/watch/'));
  assert.ok(submissions[0].key);
  assert.equal(submissions[0].key, submissions[1].key);
  assert.equal(submissions[1].body.topic, 'Why does light bend?');
  assert.equal(submissions[1].body.videoMode, 'interactive');
  await open();
  await page.evaluate(() => {
    const input = document.querySelector<HTMLInputElement>('input[type=file]')!;
    const transfer = new DataTransfer();
    transfer.items.add(new File(['Synthetic source material'], 'lecture.txt', { type: 'text/plain' }));
    input.files = transfer.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.waitForSelector('.composer-files');
  await page.click('.create-video-button');
  await page.waitForFunction(() => location.pathname.startsWith('/watch/'));
  assert.equal(submissions[2].body.title, 'lecture');
  assert.deepEqual(submissions[2].files, ['Synthetic source material']);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ widths: [1440, 393, 320], navigation: 'passed', legacyLinks: 'passed', textAndFileCreation: 'passed', retry: 'passed', pageErrors: errors, screenshots: output }));
} finally { await browser.close(); server.stop(true); }

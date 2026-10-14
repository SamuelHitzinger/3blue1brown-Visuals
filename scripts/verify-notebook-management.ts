/** Run after app:build. Uses in-memory lectures and synthetic notes, never user data or AI calls. */
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import puppeteer from 'puppeteer-core';
import { LectureService } from '../backend/src/lectures.ts';
import { createHandler } from '../backend/src/server.ts';

const output = resolve('.tmp/notebook-management');
await mkdir(output, { recursive: true });
const lectures = new LectureService(':memory:', async input => ({ subtitle: 'Atoms', summary: 'Atoms contain nuclei.',
  sections: [{ id: 'atoms', title: 'Atomic structure', points: [{ text: 'Atoms contain nuclei.', sourceIds: [input.sources[0].id] }] }], concepts: [], questions: [] }));
await lectures.handle(new Request('http://localhost/api/lectures', { method: 'POST', headers: { 'Idempotency-Key': 'seed' }, body: JSON.stringify({ title: 'Lecture 10: Matter', courseId: 'physik' }) }));
const app = createHandler(undefined, undefined, undefined, undefined, lectures);
let deletions = 0, failDelete = false;
const server = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch: request => {
  const path = new URL(request.url).pathname;
  if (path === '/api/videos') return Response.json([]);
  if (path === '/api/lectures/detach-course') {
    deletions++;
    if (failDelete) { failDelete = false; return Response.json({ detail: 'Temporary failure. Please retry.' }, { status: 503 }); }
  }
  return app(request);
} });
const browser = await puppeteer.launch({ executablePath: process.argv[2] ?? process.env.SCENE_PREVIEW_CHROMIUM ?? '/usr/bin/chromium', headless: true });
const page = await browser.newPage();
const errors: string[] = [];
page.on('pageerror', error => errors.push(String(error)));
async function clickText(text: string, selector = 'button') {
  const handle = await page.evaluateHandle((text, selector) => [...document.querySelectorAll<HTMLButtonElement>(selector)].find(button => button.textContent?.trim() === text), text, selector);
  const button = handle.asElement(); assert.ok(button, `Missing button: ${text}`); await button.click(); await handle.dispose();
}
async function openCourse() {
  await page.goto(new URL('/lectures/course/physik', server.url).href);
  await page.waitForSelector('#notebook-lecture-title');
}
try {
  await page.setViewport({ width: 393, height: 852 });
  await openCourse();
  assert.equal(await page.$eval('#notebook-lecture-title', input => (input as HTMLInputElement).placeholder), 'Lecture 11');
  await clickText('Delete course');
  assert.equal(deletions, 0);
  await page.screenshot({ path: resolve(output, 'delete-confirmation.png'), fullPage: true });
  await clickText('Cancel');
  assert.equal(deletions, 0);
  await page.click('.notebook-add-lecture button');
  await page.waitForSelector('.notebook-title h1');
  assert.equal(await page.$eval('.notebook-title h1', el => el.textContent), 'Lecture 11');
  const id = new URL(page.url()).pathname.split('/').at(-1)!;
  await lectures.handle(new Request(`http://localhost/api/lectures/${id}/sources`, { method: 'POST', headers: { 'Idempotency-Key': 'atoms' }, body: JSON.stringify({ text: 'Atoms contain nuclei.' }) }));
  await page.waitForSelector('.generated-notes');
  assert.equal(await page.$eval('.notebook-title h1', el => el.textContent), 'Lecture 11');
  await clickText('Finish lecture');
  await page.waitForFunction(() => document.querySelector('.notebook-title h1')?.textContent === 'Lecture 11: Atoms');
  await page.reload();
  await page.waitForFunction(() => document.querySelector('.notebook-title h1')?.textContent === 'Lecture 11: Atoms');
  await page.screenshot({ path: resolve(output, 'finished-lecture.png'), fullPage: true });
  await openCourse();
  assert.equal(await page.$eval('#notebook-lecture-title', input => (input as HTMLInputElement).placeholder), 'Lecture 12');
  const staleTab = await browser.newPage();
  await staleTab.goto(new URL('/lectures/course/physik', server.url).href);
  await staleTab.waitForSelector('#notebook-lecture-title');
  await page.bringToFront();
  failDelete = true;
  await clickText('Delete course'); await clickText('Confirm deletion');
  await page.waitForSelector('.notebook-error');
  assert.equal(lectures.getOwned('local', id)?.courseId, 'physik');
  await clickText('Confirm deletion');
  await page.waitForFunction(() => location.pathname === '/lectures');
  await page.waitForSelector('.notebook-course-grid');
  assert.equal(await page.$$eval('.notebook-course-name', elements => elements.some(element => element.textContent === 'Physik')), false);
  const saved = lectures.getOwned('local', id)!;
  assert.equal(saved.courseId, undefined); assert.equal(saved.title, 'Lecture 11: Atoms'); assert.equal(saved.sources.length, 1);
  await staleTab.bringToFront();
  await staleTab.click('.notebook-add-lecture button');
  await staleTab.waitForFunction(() => document.querySelector('.notebook-error')?.textContent?.includes('This course was deleted'));
  await staleTab.close();
  await page.bringToFront();
  await page.reload();
  await page.waitForSelector('.notebook-course-grid');
  assert.equal(await page.$$eval('.notebook-course-name', elements => elements.some(element => element.textContent === 'Physik')), false);
  await page.goto(new URL('/lectures/course/__independent__', server.url).href);
  await page.waitForSelector('.notebook-open-lecture');
  assert.equal(await page.$$eval('.notebook-open-lecture strong', elements => elements.some(element => element.textContent === 'Lecture 11: Atoms')), true);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ confirmationAndCancel: 'passed', deleteFailureAndRetry: 'passed', notesPreserved: 'passed', automaticNumberAndSubtitle: 'passed', reload: 'passed', mobileOverflow: false, pageErrors: errors, screenshots: output }));
} finally { await browser.close(); server.stop(true); await lectures.close(); }

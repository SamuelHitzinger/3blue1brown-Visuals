/** Browser regression: synthetic lecture, in-memory DB, no private data or AI requests. */
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import puppeteer from 'puppeteer-core';
import { createCanvas } from '@napi-rs/canvas';
import { LectureService } from '../backend/src/lectures.ts';
import { createHandler } from '../backend/src/server.ts';
import type { LectureDiagram, LectureSynthesisInput } from '../shared/lecture.ts';

const output = resolve('.tmp/lecture-notes-format');
await mkdir(output, { recursive: true });
const question = 'Find the length of vector v = (3, 4).';
const diagram: LectureDiagram = { alt: 'Vector v and its horizontal and vertical components.', elements: [
  { type: 'line', x1: 100, y1: 260, x2: 470, y2: 260, color: 'ink' },
  { type: 'line', x1: 100, y1: 260, x2: 100, y2: 40, color: 'ink' },
  { type: 'line', x1: 100, y1: 260, x2: 400, y2: 60, arrow: true, color: 'blue' },
  { type: 'line', x1: 400, y1: 260, x2: 400, y2: 60, color: 'amber' },
  { type: 'text', x: 250, y: 290, text: '3', color: 'teal' },
  { type: 'text', x: 430, y: 160, text: '4', color: 'amber' },
  { type: 'text', x: 235, y: 135, text: 'v', color: 'blue' },
] };
const inputs: LectureSynthesisInput[] = [];
const board = createCanvas(480, 210), pen = board.getContext('2d');
pen.fillStyle = '#f4f1e9'; pen.fillRect(0, 0, 480, 210);
pen.strokeStyle = '#285b86'; pen.lineWidth = 5;
pen.beginPath(); pen.moveTo(55, 165); pen.lineTo(390, 45); pen.lineTo(365, 45); pen.moveTo(390, 45); pen.lineTo(375, 70); pen.stroke();
pen.fillStyle = '#285b86'; pen.font = '28px sans-serif'; pen.fillText('v = (3, 4)', 180, 150);
const snippet = board.toBuffer('image/jpeg');
const lectures = new LectureService(':memory:', async input => {
  inputs.push(input);
  const refs = [input.sources[0].id];
  return { summary: '', sections: [{ id: 'vectors', title: 'Vectors & components', points: [
    { text: 'v = (3, 4)', kind: 'equation', math: '\\vec v = \\begin{pmatrix}3\\\\4\\end{pmatrix}', label: 'Components', group: 'Vector', sourceIds: refs },
    { text: 'Vector v: magnitude + direction', kind: 'note', group: 'Vector', sourceIds: refs },
    { text: 'Components → displacement along each axis', kind: 'relation', group: 'Vector', sourceIds: refs },
    { text: 'λ > 0: length × λ; direction unchanged', kind: 'relation', group: 'Scaling', sourceIds: refs },
  ], photo: { sourceId: refs[0], caption: 'Board notation: v = (3, 4)' } }], concepts: [
    { id: 'components', sectionId: 'vectors', title: 'Components', explanation: 'v → horizontal + vertical', sourceIds: refs, visualizationPrompt: 'Show the vector and its components.', catalogIds: [], visualKind: 'static', diagram, terms: [{ text: 'v', color: 'blue' }, { text: 'Components', color: 'teal' }] },
    { id: 'scale', sectionId: 'vectors', title: 'Scaling a vector', explanation: 'The direction stays fixed as the length changes.', sourceIds: refs, visualizationPrompt: 'Scale a vector.', catalogIds: [], visualKind: 'animation' },
    { id: 'space', sectionId: 'vectors', title: 'Explore a spatial object', explanation: 'Rotate the model to inspect its shape.', sourceIds: refs, visualizationPrompt: 'Inspect a sphere.', catalogIds: [], visualKind: 'interactive' },
  ], questions: [{ text: question, sourceIds: refs, diagram }] };
}, { visualize: async input => ({ source: input.concept.visualKind === 'interactive'
  ? `export default scene({mode:'3d',end:'hold',orbit:false},s=>{s.view('model',{rect:[0,0,1,1],orbit:true,orbitHitTest:'geometry'},v=>v.sphere('ball'));s.wait(12);});`
  : `export default scene({end:'hold',orbit:false},s=>{s.arrow('v',{from:[-2,0],to:[2,0],color:'BLUE'});s.wait(12);});`, duration: 12, catalogIds: [] }) });
const app = createHandler(undefined, undefined, undefined, undefined, lectures);
let rejectCanvas = false;
const server = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch: request => {
  const path = new URL(request.url).pathname;
  if (path === '/api/lecture-capture/config') return Response.json({ available: false, photo: false, audio: false, detail: 'Recording unavailable in this synthetic preview.' });
  if (path.endsWith('/capture-pairings')) return Response.json(null);
  if (path.endsWith('/photo-snippet')) return new Response(snippet, { headers: { 'Content-Type': 'image/jpeg' } });
  if (rejectCanvas && request.method === 'PATCH' && path.startsWith('/api/lectures/')) return Response.json({ detail: 'Synthetic save failure' }, { status: 503 });
  return path === '/api/videos' ? Response.json([]) : app(request);
} });
const request = (path: string, body: unknown) => lectures.handle(new Request(new URL(`/api/lectures${path}`, server.url), { method: 'POST', headers: { 'Idempotency-Key': path || 'seed' }, body: JSON.stringify(body) }));
const session = await (await request('', { title: 'Lecture 4: Vectors' })).json();
lectures.appendSource('local', session.id, 'synthetic-photo', `TRANSCRIPT_SENTINEL: Good morning, can everybody hear me? A vector has magnitude and direction. Components describe displacement along each axis. Scaling changes length. ${question}`, {
  kind: 'photo', itemId: 'synthetic-photo', sequence: 1, capturedAt: new Date().toISOString(),
  photoSnippet: { crop: { x: 0.1, y: 0.2, width: 0.6, height: 0.5 }, description: 'Board vector notation and direction arrow' },
});
await request(`/${session.id}/finish`, {});
const browser = await puppeteer.launch({ executablePath: process.argv[2], headless: true });
const page = await browser.newPage();
const errors: string[] = [];
page.on('pageerror', error => errors.push(String(error)));
async function clickText(text: string) {
  const handle = await page.evaluateHandle(text => [...document.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent?.trim() === text), text);
  const button = handle.asElement(); assert.ok(button, `Missing button: ${text}`); await button.click(); await handle.dispose();
}
try {
  await page.setViewport({ width: 1440, height: 1100 });
  await page.goto(new URL(`/lectures/${session.id}`, server.url).href);
  await page.waitForSelector('.notebook-questions .note-diagram');
  assert.equal(await page.$('#note-instructions-input'), null, 'Global instructions belong only on the main Notes dashboard');
  await page.waitForFunction(() => [...document.querySelectorAll<HTMLImageElement>('.generated-notes img')].some(img => img.currentSrc.includes('/photo-snippet') && img.complete && img.naturalWidth > 0));
  assert.equal(await page.$$eval('.generated-notes img', images => images.filter(img => img.currentSrc.includes('/photo-snippet')).length), 1);
  await page.evaluate(() => document.fonts.ready);
  assert.equal(await page.$eval('.notebook-questions li p', el => el.textContent), question);
  assert.ok(!(await page.$eval('.generated-notes', el => el.textContent ?? '')).includes(question));
  assert.ok(!(await page.$eval('body', el => el.textContent ?? '')).includes('TRANSCRIPT_SENTINEL'));
  assert.equal(await page.$$('.note-citation').then(items => items.length), 0);
  assert.equal(await page.$$('.generated-notes ul').then(items => items.length), 0);
  assert.equal(await page.$$('.notebook-group-title').then(items => items.length), 2);
  await page.waitForFunction(() => [...document.querySelectorAll<HTMLImageElement>('.notebook-equation')].some(image => image.complete && image.naturalWidth > 0));
  assert.equal(await page.$eval('.notebook-equation', image => image.getAttribute('alt')), 'v = (3, 4)');
  assert.ok(await page.evaluate(() => document.fonts.check('18px Libron')));
  assert.ok(await page.$eval('.generated-notes', el => getComputedStyle(el).fontFamily.includes('Libron')));
  assert.ok(await page.evaluate(() => document.querySelector('.notebook-paper')!.contains(document.querySelector('.notebook-questions'))), 'Question diagrams share the same paper');
  assert.ok(await page.evaluate(() => document.querySelector('.notebook-sketch')!.getBoundingClientRect().top >= document.querySelector('.notebook-section-body > .notebook-editable')!.getBoundingClientRect().bottom), 'Sketch follows text on the same paper');
  assert.equal(await page.$$eval('button', buttons => buttons.filter(button => button.textContent?.trim() === 'Edit notes').length), 0);
  await page.click('[data-note-edit="section:vectors"] .notebook-direct-text', { count: 2 });
  await page.waitForSelector('[aria-label="Edit section notes"]');
  await page.focus('[aria-label="Edit section notes"]');
  await page.keyboard.down('Control'); await page.keyboard.press('KeyA'); await page.keyboard.up('Control');
  await page.keyboard.type('Magnitude + direction → vector');
  await clickText('Select');
  await page.waitForFunction(() => !document.querySelector('[aria-label="Edit section notes"]'));
  assert.equal(lectures.getOwned('local', session.id)?.noteEdits?.['section:vectors'], 'Magnitude + direction → vector');
  await page.reload();
  await page.waitForSelector('.notebook-relation-flow');
  assert.equal(await page.$eval('[data-note-edit="section:vectors"] .notebook-direct-text', el => el.textContent), 'Magnitude + direction→vector');
  await page.$eval('[data-note-edit="section:vectors"]', el => el.scrollIntoView());
  await clickText('Reset to original');
  await page.waitForSelector('.notebook-equation');
  const grip = await page.$('[aria-label="Move Components"]'); assert.ok(grip); await grip.scrollIntoView();
  const gripBox = await grip.boundingBox(); assert.ok(gripBox);
  await page.mouse.move(gripBox.x + 30, gripBox.y + 10); await page.mouse.down();
  await page.mouse.move(gripBox.x + 70, gripBox.y + 40, { steps: 8 }); await page.mouse.up();
  await page.waitForFunction(async () => { const s = await (await fetch(location.pathname.replace('/lectures/', '/api/lectures/'))).json(); return s.noteCanvas?.vectors?.offsets?.components?.x > 0 });
  const moved = lectures.getOwned('local', session.id)?.noteCanvas?.vectors.offsets.components;
  assert.ok(moved && moved.y > 0);
  await page.click('[data-canvas-area="vectors"] [title="Undo canvas change"]');
  await page.waitForFunction(async () => { const s = await (await fetch(location.pathname.replace('/lectures/', '/api/lectures/'))).json(); return !s.noteCanvas?.vectors?.offsets?.components });
  await page.focus('[aria-label="Move Components"]'); await page.keyboard.press('ArrowRight');
  await page.waitForFunction(async () => { const s = await (await fetch(location.pathname.replace('/lectures/', '/api/lectures/'))).json(); return s.noteCanvas?.vectors?.offsets?.components?.x === 10 });
  const finalPosition = lectures.getOwned('local', session.id)?.noteCanvas?.vectors.offsets.components;
  const draw = async (tool: string) => {
    await clickText(tool);
    const blank = await page.$('[data-canvas-area="vectors"] .notebook-canvas-space'); assert.ok(blank); await blank.scrollIntoView();
    const box = await blank.boundingBox(); assert.ok(box);
    await page.mouse.move(box.x + 60, box.y + 15); await page.mouse.down();
    await page.mouse.move(box.x + 190, box.y + 55, { steps: 8 }); await page.mouse.up();
  };
  await draw('Arrow'); await draw('Draw'); await draw('Block'); await clickText('Select');
  await page.waitForFunction(async () => { const s = await (await fetch(location.pathname.replace('/lectures/', '/api/lectures/'))).json(); return s.noteCanvas?.vectors?.marks?.length === 3 });
  assert.deepEqual(lectures.getOwned('local', session.id)?.noteCanvas?.vectors.marks.map(mark => mark.kind), ['arrow', 'pen', 'block']);
  const blank = await page.$('[data-canvas-area="personal"] .notebook-canvas-space'); assert.ok(blank); await blank.scrollIntoView();
  const blankBox = await blank.boundingBox(); assert.ok(blankBox);
  await page.mouse.click(blankBox.x + 40, blankBox.y + 10, { count: 2 });
  rejectCanvas = true;
  await page.waitForSelector('[aria-label="Canvas note"]'); await page.type('[aria-label="Canvas note"]', 'Remember the direction');
  await page.keyboard.down('Control'); await page.keyboard.press('Enter'); await page.keyboard.up('Control');
  await page.waitForFunction(() => document.querySelector('[data-canvas-area="personal"] .learning-error')?.textContent?.includes('Retry'));
  rejectCanvas = false;
  await page.click('[data-canvas-area="personal"] .learning-error');
  await page.waitForFunction(async () => { const s = await (await fetch(location.pathname.replace('/lectures/', '/api/lectures/'))).json(); return s.noteCanvas?.personal?.marks?.[0]?.text === 'Remember the direction' });
  await page.reload(); await page.waitForSelector('.notebook-canvas-label');
  assert.equal(await page.$eval('[data-canvas-area="personal"] .notebook-canvas-label', el => el.textContent), 'Remember the direction');
  assert.equal(await page.$$('[data-canvas-area="vectors"] [data-mark]').then(items => items.length), 3);
  assert.deepEqual(lectures.getOwned('local', session.id)?.noteCanvas?.vectors.offsets.components, finalPosition);
  console.log('Direct editing, drag, drawing tools and annotation persistence verified.');
  assert.equal(lectures.getOwned('local', session.id)?.visualizations[0]?.conceptId, 'scale');
  await page.goto(new URL('/lectures', server.url).href);
  await page.waitForSelector('#note-instructions-input:not(:disabled)');
  assert.equal(await page.$$('.note-instructions').then(items => items.length), 1);
  await page.type('#note-instructions-input', 'German; shorter notes; fewer visuals.');
  await clickText('Save instructions');
  await page.waitForFunction(() => document.querySelector('.note-instructions [role="status"]')?.textContent?.includes('saved'));
  await page.reload();
  await page.waitForFunction(() => (document.querySelector('#note-instructions-input') as HTMLTextAreaElement)?.value === 'German; shorter notes; fewer visuals.');
  await page.screenshot({ path: resolve(output, 'dashboard.png'), fullPage: true });
  await page.goto(new URL('/lectures/course/__independent__', server.url).href);
  await page.waitForSelector('.notebook-add-lecture');
  assert.equal(await page.$('#note-instructions-input'), null, 'Course pages do not duplicate global controls');
  await page.goto(new URL(`/lectures/${session.id}`, server.url).href);
  await page.waitForSelector('.notebook-tools');
  assert.equal(await page.$('#note-instructions-input'), null);
  await clickText('Update notes');
  console.log('Notebook rendering and instructions verified; checking refresh and scene playback.');
  await page.waitForFunction(() => !document.querySelector('.lecture-progress'));
  assert.equal(inputs.at(-1)?.instructions, 'German; shorter notes; fewer visuals.');
  assert.equal(inputs.at(-1)?.previousSourceRevision, 0);
  await clickText('Create interactive visual');
  await page.waitForFunction(() => document.querySelectorAll('.lecture-visual').length === 2);
  await page.$eval('[aria-label="Explore a spatial object"]', el => el.scrollIntoView());
  await page.waitForFunction(() => !!document.querySelector('[aria-label="Explore a spatial object"] canvas') && !document.querySelector('[aria-label="Explore a spatial object"] [role="status"]'), { timeout: 30000 });
  assert.equal(await page.$$('[aria-label="Explore a spatial object"] .lecture-visual-controls').then(items => items.length), 0);
  await page.$eval('[aria-label="Scaling a vector"]', el => el.scrollIntoView());
  await page.waitForSelector('[aria-label="Scaling a vector"] canvas');
  assert.equal(await page.$$('[aria-label="Scaling a vector"] .lecture-visual-controls').then(items => items.length), 1);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: resolve(output, 'desktop.png'), fullPage: true });
  await page.setViewport({ width: 393, height: 852 });
  await page.screenshot({ path: resolve(output, 'mobile.png'), fullPage: true });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  assert.ok(await page.evaluate(() => document.querySelector('.notebook-sketch')!.getBoundingClientRect().top >= document.querySelector('.notebook-section-body > .notebook-editable')!.getBoundingClientRect().bottom), 'Mobile sketch follows its notes');
  assert.ok(await page.evaluate(() => document.querySelector('.notebook-paper')!.contains(document.querySelector('.notebook-questions'))));
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed: true, checks: ['double-click editing', 'inline sketches', 'drag and persist visual positions', 'arrows, freehand and blocks', 'double-click blank space to add text', 'annotations survive reload and synthesis', 'separate exact questions', 'no transcripts', 'Libron loaded', 'source-associated photo snippet loaded', 'animation controls', 'interactive without timeline', 'global instructions survive reload', 'full refresh uses preferences', 'mobile without horizontal overflow'], screenshots: output }));
} catch (error) {
  await page.screenshot({ path: resolve(output, 'failure.png'), fullPage: true });
  console.error(JSON.stringify({ errors, status: await page.$$eval('[role="status"], [role="alert"]', items => items.map(item => item.textContent)) }));
  throw error;
} finally { await browser.close(); server.stop(true); await lectures.close(); }

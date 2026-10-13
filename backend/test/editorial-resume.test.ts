import { afterEach, expect, test } from 'bun:test';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { authorReviewedLesson, type EditorialReview } from '../src/agents/editorial.js';
import type { PlannedLesson } from '../src/agents/planning.js';
import type { AgentTask } from '../src/agents/runtime.js';

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))); });
async function directory() { const root = await mkdtemp(join(tmpdir(), 'aha-editorial-resume-')); roots.push(root); return root; }
const request = { title: 'Halves', topic: 'Halve sixteen twice', documents: [{ name: 'notes.txt', text: 'Sixteen, eight, four.' }] };
const signal = () => new AbortController().signal;
function lesson(value = 'four'): PlannedLesson {
  return { schemaVersion: 1, markdown: `# Halves\n\n## Beat 1 — Halve\n\nContent needed: Halve sixteen twice to get ${value}.\n\nNarration: Halve sixteen twice to get ${value}.`, plan: {
    audience: 'Newcomer', prerequisites: [], learningGoal: 'Halve twice', centralQuestion: 'What remains?', keyInsight: 'Two halvings divide by four',
    runningExample: `Sixteen, eight, ${value}`, misconceptions: [], entities: [], scenes: [{ id: 'beat-1', purpose: 'Follow two halvings', whyNow: 'Opening example',
      keyPoints: [`Result ${value}`], visualDescription: `Sixteen, eight, ${value}`, endsWith: `${value} remains`, carry: [], cleanup: [],
      sourceRefs: [{ document: 'notes.txt', location: 'supplied text', supports: 'The halving example' }], interactions: [] }],
  } };
}
function review(verdict: 'pass' | 'revise' = 'pass'): EditorialReview {
  return { schemaVersion: 1, verdict, summary: 'Checked the two halvings', issues: verdict === 'pass' ? []
    : [{ severity: 'error', sceneId: 'beat-1', detail: 'Halving sixteen twice gives four. Preserve the example and correct the result.' }], checks: ['16 / 2 / 2 = 4.'] };
}
function payload(task: AgentTask) { return JSON.parse(task.prompt.slice(task.prompt.indexOf('\n') + 1)); }
async function rejected(root: string, images?: AgentTask['images']) {
  let calls = 0;
  await expect(authorReviewedLesson({ async run() {
    if (calls === 6) throw new Error('Legacy audit captured');
    return JSON.stringify(calls++ % 2 ? review('revise') : lesson(`wrong-${calls}`));
  } }, request, root, signal(), images)).rejects.toThrow('Legacy audit captured');
  // Exercise migration from pre-checkpoint audits; current jobs resume their checkpoint.
  await rm(join(root, 'editorial-state.json'), { force: true });
  return (await readdir(join(root, 'editorial')))[0];
}

test('author can prepare models before review, and every repair/review sees current asset evidence', async () => {
  const root = await directory(); let calls = 0;
  const assets: Record<string, unknown> = {}, context: Record<string, unknown> = {};
  const approved = await authorReviewedLesson({ async run(task) {
    const input = payload(task), index = calls++;
    if (index === 0) {
      expect(input.modelAssets).toEqual({});
      await task.publishModel!({ fixtureId: 'fixture-a' }, task.signal!);
      return JSON.stringify(lesson('five'));
    }
    expect(input.modelAssets['fixture-a']).toEqual({ nodes: ['chain-a'], units: 'angstrom' });
    expect(input.modelAssetContext['fixture-a']).toEqual({ source: 'database-a', selection: 'chain A' });
    if (index === 1) { expect(task.publishModel).toBeUndefined(); return JSON.stringify(review('revise')); }
    if (index === 2) {
      await task.publishModel!({ fixtureId: 'fixture-b' }, task.signal!);
      return JSON.stringify(lesson());
    }
    expect(input.modelAssets['fixture-b']).toEqual({ nodes: ['chain-a'], units: 'angstrom' });
    expect(input.modelAssetContext['fixture-b']).toEqual({ source: 'database-a', selection: 'chain A' });
    return JSON.stringify(review());
  } }, request, root, signal(), undefined, 'test-video', {
    async publishModel(input) {
      assets[input.fixtureId!] = { nodes: ['chain-a'], units: 'angstrom' };
      context[input.fixtureId!] = { source: 'database-a', selection: 'chain A' };
      return { id: input.fixtureId };
    },
    modelAssets: () => assets, modelAssetContext: () => context,
  });
  expect(calls).toBe(4); expect(approved.markdown).toContain('four');
});

test('restart repairs latest rejected draft and still requires a fresh passing review', async () => {
  const root = await directory(), firstRun = await rejected(root);
  const lastDraft = JSON.parse(await readFile(join(root, 'editorial', firstRun, 'lesson-draft-2.json'), 'utf8'));
  let calls = 0;
  const approved = await authorReviewedLesson({ async run(task) {
    const input = payload(task);
    if (calls++ === 0) { expect(input.draft).toEqual(lastDraft); expect(input.issues).toEqual(review('revise').issues); return JSON.stringify(lesson()); }
    expect(input.draft).toEqual(lesson()); return JSON.stringify(review());
  } }, request, root, signal());
  expect(calls).toBe(2); expect(approved.editorialReview.runId).not.toBe(firstRun);
  expect(approved.editorialReview.attempt).toBe(0);
  expect(JSON.parse(await readFile(join(root, 'editorial', firstRun, 'lesson-review-2.json'), 'utf8')).verdict).toBe('revise');
});

test('interrupted review resumes its checkpoint draft and still requires a passing review', async () => {
  const root = await directory(); let calls = 0;
  await expect(authorReviewedLesson({ async run() {
    const outputs = [lesson('five'), review('revise'), lesson('six')];
    if (calls === outputs.length) throw new Error('Process interrupted');
    return JSON.stringify(outputs[calls++]);
  } }, request, root, signal())).rejects.toThrow('Process interrupted');
  calls = 0;
  await authorReviewedLesson({ async run(task) {
    calls++;
    expect(task.logContext?.stage).toBe('review');
    expect(payload(task).draft).toEqual(lesson('six'));
    return JSON.stringify(review());
  } }, request, root, signal());
  expect(calls).toBe(1);
});

test.each(['documents', 'images'] as const)('changed %s cannot reuse rejected editorial context', async changed => {
  const root = await directory(), images = [{ type: 'image' as const, mimeType: 'image/png', data: 'image-a' }];
  await rejected(root, images);
  const currentRequest = changed === 'documents' ? { ...request, documents: [{ name: 'notes.txt', text: 'Updated source content.' }] } : request;
  const currentImages = changed === 'images' ? [{ ...images[0], data: 'image-b' }] : images;
  let calls = 0;
  await authorReviewedLesson({ async run(task) {
    if (calls++ === 0) { expect(payload(task).draft).toBeUndefined(); expect(payload(task).documents).toEqual(currentRequest.documents); return JSON.stringify(lesson()); }
    return JSON.stringify(review());
  } }, currentRequest, root, signal(), currentImages);
  expect(calls).toBe(2);
});

test('legacy rejection resumes only when saved review prompt proves same source request', async () => {
  const root = await directory(), run = await rejected(root), runDirectory = join(root, 'editorial', run);
  await rm(join(runDirectory, 'request.sha256'), { force: true });
  let calls = 0;
  await authorReviewedLesson({ async run(task) {
    if (calls++ === 0) { expect(payload(task).draft).toEqual(lesson('wrong-5')); return JSON.stringify(lesson()); }
    return JSON.stringify(review());
  } }, request, root, signal());
  expect(calls).toBe(2);
});

test('legacy audit with different source content cannot supply a repair', async () => {
  const root = await directory(), run = await rejected(root), runDirectory = join(root, 'editorial', run);
  await rm(join(runDirectory, 'request.sha256'), { force: true });
  const changedRequest = { ...request, documents: [{ name: 'notes.txt', text: 'Different source material.' }] };
  let calls = 0;
  await authorReviewedLesson({ async run(task) {
    if (calls++ === 0) { expect(payload(task).draft).toBeUndefined(); return JSON.stringify(lesson()); }
    return JSON.stringify(review());
  } }, changedRequest, root, signal());
  expect(calls).toBe(2);
});

test('saved draft with unavailable sources cannot become repair material', async () => {
  const root = await directory(), run = await rejected(root), runDirectory = join(root, 'editorial', run);
  const invalid = lesson('five'); invalid.plan.scenes[0].sourceRefs[0].document = 'removed.txt';
  for (let i = 0; i < 3; i++) await writeFile(join(runDirectory, `lesson-draft-${i}.json`), JSON.stringify(invalid));
  let calls = 0;
  await authorReviewedLesson({ async run(task) {
    if (calls++ === 0) { expect(payload(task).draft).toBeUndefined(); return JSON.stringify(lesson()); }
    return JSON.stringify(review());
  } }, request, root, signal());
  expect(calls).toBe(2);
});

test('malformed rejected audit pair is ignored rather than becoming repair context', async () => {
  const root = await directory(), run = await rejected(root), runDirectory = join(root, 'editorial', run);
  for (let i = 0; i < 3; i++) await writeFile(join(runDirectory, `lesson-review-${i}.json`), JSON.stringify({ ...review('revise'), checks: [] }));
  let calls = 0;
  await authorReviewedLesson({ async run(task) {
    if (calls++ === 0) { expect(payload(task).draft).toBeUndefined(); return JSON.stringify(lesson()); }
    return JSON.stringify(review());
  } }, request, root, signal());
  expect(calls).toBe(2);
});

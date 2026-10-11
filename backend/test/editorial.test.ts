import { afterEach, expect, test } from 'bun:test';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { authorReviewedLesson, parseEditorialReview } from '../src/agents/editorial.js';
import type { EditorialReview } from '../src/agents/editorial.js';
import { PLANNING_CONTRACT, type PlannedLesson } from '../src/agents/planning.js';
import type { AgentTask } from '../src/agents/runtime.js';
import { createPiGenerator } from '../src/agents/generator.js';
import { NarrationService } from '../src/narration/service.js';
import { loadPrompt, instructionSnapshot, INSTRUCTION_VERSION } from '../src/agents/prompts.js';
import { settingsFromEnv } from '../src/narration/elevenlabs.js';

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))); });
async function directory() { const root = await mkdtemp(join(tmpdir(), 'aha-editorial-')); roots.push(root); return root; }
const request = { title: 'Halves', topic: 'Halve sixteen twice', documents: [{ name: 'notes.txt', text: 'Sixteen, eight, four.' }] };
function lesson(value = 'four'): PlannedLesson {
  return { schemaVersion: 1, markdown: `# Halves\n\n## Beat 1 — Halve\n\nContent needed: Halve sixteen twice to get ${value}.\n\nNarration: Halve sixteen twice to get ${value}.`, plan: {
    audience: 'Newcomer', prerequisites: [], learningGoal: 'Halve twice', centralQuestion: 'What remains?', keyInsight: 'Two halvings divide by four',
    runningExample: `Sixteen, eight, ${value}`, misconceptions: [], entities: [], scenes: [{ id: 'beat-1', purpose: 'Follow two halvings', whyNow: 'Opening and closing example',
      keyPoints: [`Result ${value}`], visualDescription: `Sixteen, eight, ${value}`, endsWith: `${value} remains`, carry: [], cleanup: [], sourceRefs: [], interactions: [] }],
  } };
}
function review(verdict: 'pass' | 'revise' = 'pass'): EditorialReview {
  return { schemaVersion: 1, verdict, summary: 'Checked the two halvings', issues: verdict === 'pass' ? []
    : [{ severity: 'error', sceneId: 'beat-1', detail: 'Sixteen halved twice is four, not five. Correct speech and all plan values.' }], checks: ['16 / 2 / 2 = 4.'] };
}
const image = { type: 'image' as const, mimeType: 'image/png', data: 'fixture-image' };

test.each(['classic', 'interactive', undefined] as const)('viewing preference %s reaches authoring, review and repair', async videoMode => {
  const root = await directory(), tasks: AgentTask[] = [];
  const outputs = [lesson('five'), review('revise'), lesson(), review()];
  await authorReviewedLesson({ async run(task) {
    tasks.push(task); return JSON.stringify(outputs.shift());
  } }, { ...request, videoMode }, root, new AbortController().signal);
  expect(tasks).toHaveLength(4);
  tasks.forEach((task, index) => {
    const payload = JSON.parse(task.prompt.slice(task.prompt.indexOf('\n') + 1));
    expect((index === 0 ? payload : payload.request).videoMode).toBe(videoMode);
    expect(task.systemPrompt).toContain('All new app videos use `interactive`');
    expect(task.systemPrompt).toContain('Every planned `interactions` array is empty');
    expect(task.systemPrompt).toContain('No minimum count or quota applies');
  });
});

test('review verdicts agree with material findings and identify actual scenes', () => {
  const warnings = review(); warnings.issues = [{ severity: 'warning', sceneId: null, detail: 'Optional wording preference.' }];
  expect(parseEditorialReview(JSON.stringify(warnings), lesson())).toEqual(warnings);
  const contradictory = review('revise'); contradictory.verdict = 'pass';
  expect(() => parseEditorialReview(JSON.stringify(contradictory), lesson())).toThrow('exactly');
  const cosmetic = { ...warnings, verdict: 'revise' };
  expect(() => parseEditorialReview(JSON.stringify(cosmetic), lesson())).toThrow('exactly');
  const wrongScene = review('revise'); wrongScene.issues[0].sceneId = 'beat-99';
  expect(() => parseEditorialReview(JSON.stringify(wrongScene), lesson())).toThrow('actual sceneId');
  expect(() => parseEditorialReview(JSON.stringify({ ...review(), checks: [] }), lesson())).toThrow('specific checks');
  expect(() => parseEditorialReview('null', lesson())).toThrow();
});

test('editorial repairs update speech and plan together, forward sources, and preserve the review trail', async () => {
  const root = await directory(), tasks: AgentTask[] = [];
  const outputs = [lesson('five'), review('revise'), lesson(), review()];
  const approved = await authorReviewedLesson({ async run(task) {
    tasks.push(task); const output = JSON.stringify(outputs.shift()); await task.validate!(output); return output;
  } }, request, root, new AbortController().signal, [image]);
  expect(approved).toMatchObject(lesson()); expect(tasks).toHaveLength(4);
  tasks.forEach(task => expect(task.images).toEqual([image]));
  expect(tasks[1].prompt).toContain('Sixteen, eight, four.');
  expect(tasks[1].prompt).toContain('parsedScenes');
  for (const task of tasks) {
    expect(task.systemPrompt).toContain(await loadPrompt('guidance'));
    expect(task.systemPrompt).toContain(await loadPrompt('viewing-mode'));
    expect(task.systemPrompt).toContain(PLANNING_CONTRACT);
    expect(task.systemPrompt).toContain('## Visual model planning');
    expect(task.systemPrompt).toContain('# Current animation quality policy');
    expect(task.systemPrompt).not.toContain('3D is the default');
  }
  expect(tasks[1].systemPrompt).toContain('Visual plans and reveal guards belong in nonspoken context');
  const capabilities = await readFile(new URL('../../shared/animlib/docs/capabilities.md', import.meta.url), 'utf8');
  tasks.forEach(task => expect(task.systemPrompt).toContain(capabilities));
  expect(tasks[2].prompt).toContain('Correct speech and all plan values');
  expect(approved.instructionVersion).toBe(INSTRUCTION_VERSION);
  const run = join(root, 'editorial', approved.editorialReview.runId);
  expect(JSON.parse(await readFile(join(run, 'lesson-draft-1.instructions.json'), 'utf8'))).toEqual(instructionSnapshot(tasks[2].systemPrompt));
  expect(JSON.parse(await readFile(join(run, 'lesson-review-1.instructions.json'), 'utf8'))).toEqual(instructionSnapshot(tasks[3].systemPrompt));
  expect(JSON.parse(await readFile(join(run, 'lesson-review-0.json'), 'utf8')).verdict).toBe('revise');
  expect(JSON.parse(await readFile(join(run, 'lesson-draft-1.json'), 'utf8')).markdown).toContain('four');
  expect(JSON.parse(await readFile(join(run, 'lesson-review-1.json'), 'utf8')).verdict).toBe('pass');
});

test('warnings do not trigger a rewrite', async () => {
  const root = await directory(); let calls = 0;
  const warning = review(); warning.issues.push({ severity: 'warning', sceneId: 'beat-1', detail: 'Optional alternative phrasing.' });
  const approved = await authorReviewedLesson({ async run() { return JSON.stringify(calls++ === 0 ? lesson() : warning); } }, request, root, new AbortController().signal);
  expect(approved).toMatchObject(lesson()); expect(calls).toBe(2);
});

test('restarts isolate partial audit pairs and link approval to the exact saved draft', async () => {
  const root = await directory();
  let calls = 0;
  await expect(authorReviewedLesson({ async run() {
    const outputs = [lesson('five'), review('revise'), lesson()];
    if (calls === outputs.length) throw new Error('Interrupted before repair review');
    return JSON.stringify(outputs[calls++]);
  } }, request, root, new AbortController().signal)).rejects.toThrow('Interrupted before repair review');
  const firstRun = (await readdir(join(root, 'editorial')))[0];
  const firstDirectory = join(root, 'editorial', firstRun);
  const evidence = await Promise.all((await readdir(firstDirectory)).map(async name => ({ name, bytes: await readFile(join(firstDirectory, name), 'utf8') })));
  expect(JSON.parse(await readFile(join(firstDirectory, 'lesson-review-0.json'), 'utf8')).verdict).toBe('revise');
  expect(await readdir(firstDirectory)).toContain('lesson-draft-1.json');
  expect(await readdir(firstDirectory)).not.toContain('lesson-review-1.json');

  // A replacement process writes a different draft, then stops before its verdict.
  calls = 0;
  await expect(authorReviewedLesson({ async run() {
    if (calls++ === 0) return JSON.stringify(lesson('six'));
    throw new Error('Interrupted before fresh review');
  } }, request, root, new AbortController().signal)).rejects.toThrow('Interrupted before fresh review');
  const secondRun = (await readdir(join(root, 'editorial'))).find(id => id !== firstRun)!;
  const secondDirectory = join(root, 'editorial', secondRun);
  const secondDraft = await readFile(join(secondDirectory, 'lesson-draft-0.json'), 'utf8');
  expect(secondDraft).toContain('six');
  expect(await readdir(secondDirectory)).not.toContain('lesson-review-0.json'); // No stale first-run verdict.

  calls = 0;
  const approved = await authorReviewedLesson({ async run() { return JSON.stringify(calls++ === 0 ? lesson() : review()); } }, request, root, new AbortController().signal);
  const { runId, attempt, draftSha256 } = approved.editorialReview;
  expect([firstRun, secondRun]).not.toContain(runId); expect(attempt).toBe(0);
  const approvedDirectory = join(root, 'editorial', runId);
  const draft = await readFile(join(approvedDirectory, `lesson-draft-${attempt}.json`), 'utf8');
  expect(createHash('sha256').update(draft).digest('hex')).toBe(draftSha256);
  const { editorialReview: _provenance, instructionVersion: _version, ...committedLesson } = approved;
  expect(JSON.parse(draft)).toEqual(committedLesson);
  expect(JSON.parse(await readFile(join(approvedDirectory, `lesson-review-${attempt}.json`), 'utf8')).verdict).toBe('pass');
  expect(await readdir(approvedDirectory)).not.toContain('lesson-review-1.json');
  for (const file of evidence) expect(await readFile(join(firstDirectory, file.name), 'utf8')).toBe(file.bytes);
  expect(await readFile(join(secondDirectory, 'lesson-draft-0.json'), 'utf8')).toBe(secondDraft);
});

test('three rejected drafts fail before submitting paid speech or publishing a lesson', async () => {
  const root = await directory(); let calls = 0, speechCalls = 0;
  const narration = new NarrationService({ root: join(root, 'speech'), provider: {
    settings: settingsFromEnv({ ELEVENLABS_VOICE_ID: 'test' }), async synthesize() { speechCalls++; throw new Error('Speech must not run'); },
  } });
  const id = crypto.randomUUID();
  const generate = createPiGenerator({ async run() { return JSON.stringify(calls++ % 2 === 0 ? lesson('five') : review('revise')); } }, narration, root);
  await expect(generate(request, 0, { owner: 'shared-user', videoId: id, signal: new AbortController().signal })).rejects.toMatchObject({ code: 'EDITORIAL' });
  expect(calls).toBe(6); expect(speechCalls).toBe(0);
  const files = await readdir(join(root, id));
  const runs = await readdir(join(root, id, 'editorial'));
  expect(await readdir(join(root, id, 'editorial', runs[0]))).toContain('lesson-review-2.json'); expect(files).not.toContain('lesson.json'); expect(files).not.toContain('narration-id');
});

test('cancellation during review cannot publish an approved lesson or start speech', async () => {
  const root = await directory(), controller = new AbortController(); let calls = 0, speechCalls = 0;
  const narration = new NarrationService({ root: join(root, 'speech'), provider: {
    settings: settingsFromEnv({ ELEVENLABS_VOICE_ID: 'test' }), async synthesize() { speechCalls++; throw new Error('Speech must not run'); },
  } });
  const id = crypto.randomUUID();
  const generate = createPiGenerator({ async run(task) {
    expect(task.signal).toBe(controller.signal);
    if (calls++ === 0) return JSON.stringify(lesson());
    controller.abort(new Error('Stopped during review')); return JSON.stringify(review());
  } }, narration, root);
  await expect(generate(request, 0, { owner: 'shared-user', videoId: id, signal: controller.signal })).rejects.toThrow('Stopped during review');
  expect(calls).toBe(2); expect(speechCalls).toBe(0);
  expect(await readdir(join(root, id))).not.toContain('lesson.json');
});

test('malformed review cannot unlock speech even if a runner skips the validation tool', async () => {
  const root = await directory(); let calls = 0;
  await expect(authorReviewedLesson({ async run() { return calls++ === 0 ? JSON.stringify(lesson()) : JSON.stringify({ ...review(), checks: [] }); } }, request, root, new AbortController().signal)).rejects.toThrow('specific checks');
  expect(await readdir(root)).not.toContain('lesson.json');
});

test('inserted scene authoring, review and repair receive no lesson duration or word-count targets', async () => {
  const root = await directory(), tasks: AgentTask[] = [];
  const outputs = [lesson('five'), review('revise'), lesson(), review()];
  await authorReviewedLesson({ async run(task) {
    tasks.push(task); const output = JSON.stringify(outputs.shift()); await task.validate!(output); return output;
  } }, { ...request, sceneRequest: true }, root, new AbortController().signal);
  expect(tasks).toHaveLength(4);
  for (const task of tasks) {
    expect(task.systemPrompt).toContain('# Inserted scene guidance');
    expect(task.systemPrompt).not.toContain('# Storyline agent guidance');
    expect(task.systemPrompt).not.toMatch(/2–6 minutes|20-30 spoken words|30-60 words|within 30 seconds|125–150 words/);
    expect(task.prompt).not.toContain('concise visual lesson');
  }
  expect(tasks[0].prompt).toContain('Write one inserted scene');
});

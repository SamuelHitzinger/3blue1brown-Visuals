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
import { compileSource, evaluateScene } from 'animlib/core';
import { validateScenePlan } from '../src/agents/scene-plan.js';

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
    expect(task.systemPrompt).toContain('Use `classic` when `videoMode` is absent');
    expect(task.systemPrompt).toContain('empty `interactions` arrays');
    expect(task.systemPrompt).toContain('Prefer direct manipulation over sliders');
    expect(task.systemPrompt).not.toContain('0–2');
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
    expect(task.systemPrompt).toContain(PLANNING_CONTRACT);
    expect(task.systemPrompt).not.toContain('# Viewing mode policy');
    expect(task.systemPrompt).not.toContain('# Current animation quality policy');
    expect(task.systemPrompt).not.toContain('# Animlib capabilities for storyboard planning');
    expect(task.systemPrompt).not.toContain('3D is the default');
  }
  expect(tasks[1].systemPrompt).toContain('Visual plans and reveal guards belong in nonspoken context');
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

test.each([false, true])('requested controls survive editorial repair and become required scene controls (inserted: %s)', async sceneRequest => {
  const root = await directory(), tasks: AgentTask[] = [];
  const interactiveRequest = { ...request, videoMode: 'interactive' as const, sceneRequest,
    topic: 'Make an interactive toy with a slider controlling the number of halvings from zero to four.' };
  const repaired = lesson();
  repaired.plan.scenes[0].interactions = [{ id: 'halvings', type: 'slider', label: 'Halvings',
    drives: 'Integer halvings from 0 to 4, default 2; remaining quantity and readout are 16 / 2^halvings.',
    discover: 'Each additional halving divides the remaining quantity by two.' }];
  const missingControls: EditorialReview = { schemaVersion: 1, verdict: 'revise',
    summary: 'The requested slider is missing.',
    issues: [{ severity: 'error', sceneId: 'beat-1', detail: 'Add the requested halvings slider to interactions and drive the remaining quantity and readout from it.' }],
    checks: ['The user requested a slider, but beat-1 has interactions: [].'] };
  const outputs = [lesson(), missingControls, repaired, review()];
  const approved = await authorReviewedLesson({ async run(task) {
    tasks.push(task);
    const output = JSON.stringify(outputs.shift()); await task.validate!(output); return output;
  } }, interactiveRequest, root, new AbortController().signal);
  expect(tasks).toHaveLength(4);
  for (const task of tasks) {
    expect(task.systemPrompt).toContain('An explicit request for interactivity');
    expect(task.systemPrompt).toContain('may add useful interactions');
    expect(task.systemPrompt).toContain('every 3D model view must allow viewer rotation');
    expect(task.systemPrompt).not.toContain('no control is required');
    expect(task.systemPrompt).not.toContain('Controls are optional when they do not help');
  }
  expect(tasks[1].systemPrompt).toContain('Missing requested interactions');
  expect(tasks[1].systemPrompt).toContain('material errors requiring revision');
  expect(tasks[2].prompt).toContain(missingControls.issues[0].detail);
  expect(tasks[2].prompt).toContain(interactiveRequest.topic);
  expect(approved.plan.scenes[0].interactions).toEqual(repaired.plan.scenes[0].interactions);
  const scene = approved.plan.scenes[0];
  const withoutControls = await compileSource('export default scene({},s=>{s.wait(1);});');
  expect(() => validateScenePlan(withoutControls, evaluateScene(withoutControls, 1), scene)).toThrow('halvings:slider');
  const withControls = await compileSource(`export default scene({},s=>{
    const halvings=s.slider('halvings',{label:'Halvings',min:0,max:4,step:1,default:2});
    s.circle('remaining',{radius:16/2**halvings});s.wait(1);
  });`);
  expect(() => validateScenePlan(withControls, evaluateScene(withControls, 1), scene)).not.toThrow();
});

test('restart resumes the saved draft and links approval to those exact bytes', async () => {
  const root = await directory(); let calls = 0;
  await expect(authorReviewedLesson({ async run() {
    const outputs = [lesson('five'), review('revise'), lesson()];
    if (calls === outputs.length) throw new Error('Interrupted before repair review');
    return JSON.stringify(outputs[calls++]);
  } }, request, root, new AbortController().signal)).rejects.toThrow('Interrupted before repair review');
  const firstRun = (await readdir(join(root, 'editorial')))[0];
  calls = 0;
  const approved = await authorReviewedLesson({ async run(task) {
    calls++; expect(task.logContext?.stage).toBe('review');
    expect(task.prompt).toContain('four'); return JSON.stringify(review());
  } }, request, root, new AbortController().signal);
  expect(calls).toBe(1);
  const { runId, attempt, draftSha256 } = approved.editorialReview;
  expect(runId).toBe(firstRun); expect(attempt).toBe(1);
  const draft = await readFile(join(root, 'editorial', runId, `lesson-draft-${attempt}.json`), 'utf8');
  expect(createHash('sha256').update(draft).digest('hex')).toBe(draftSha256);
  expect(JSON.parse(draft)).toEqual(lesson());
});

test('editorial continues beyond three rejected drafts, retains bounded evidence, and remains cancellable before speech', async () => {
  const root = await directory(); let calls = 0, speechCalls = 0;
  const controller = new AbortController();
  const narration = new NarrationService({ root: join(root, 'speech'), provider: {
    settings: settingsFromEnv({ ELEVENLABS_VOICE_ID: 'test' }), async synthesize() { speechCalls++; throw new Error('Speech must not run'); },
  } });
  const id = crypto.randomUUID();
  const generate = createPiGenerator({ async run() {
    if (calls === 10) controller.abort(new Error('Stopped after five reviews'));
    return JSON.stringify(calls++ % 2 === 0 ? lesson('five') : review('revise'));
  } }, narration, root);
  await expect(generate(request, 0, { owner: 'shared-user', videoId: id, signal: controller.signal })).rejects.toThrow('Stopped after five reviews');
  expect(calls).toBe(11); expect(speechCalls).toBe(0);
  const files = await readdir(join(root, id));
  const runs = await readdir(join(root, id, 'editorial'));
  const evidence = await readdir(join(root, id, 'editorial', runs[0]));
  expect(evidence).toContain('lesson-review-4.json'); expect(evidence).not.toContain('lesson-review-0.json');
  expect(files).not.toContain('lesson.json'); expect(files).not.toContain('narration-id');
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

test('malformed review is retried with feedback and cannot unlock approval', async () => {
  const root = await directory(); let calls = 0;
  const approved = await authorReviewedLesson({ async run(task) {
    calls++;
    if (calls === 1) return JSON.stringify(lesson());
    if (calls === 2) return JSON.stringify({ ...review(), checks: [] });
    expect(task.prompt).toContain('specific checks');
    return JSON.stringify(review());
  } }, request, root, new AbortController().signal);
  expect(calls).toBe(3); expect(approved).toMatchObject(lesson());
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
    expect(task.systemPrompt).toContain('## Plan feasible visuals');
    expect(task.systemPrompt).toContain('All new app videos use `interactive`');
    expect(task.systemPrompt).not.toContain('# Storyline agent guidance');
    expect(task.systemPrompt).not.toMatch(/2–6 minutes|20-30 spoken words|30-60 words|within 30 seconds|125–150 words/);
    expect(task.prompt).not.toContain('concise visual lesson');
  }
  expect(tasks[0].prompt).toContain('Write one inserted scene');
});

test('editorial stops at 50 reviews and cannot reset its cap after restart', async () => {
  const root = await directory(); let calls = 0;
  const runner = { async run() { return JSON.stringify(calls++ % 2 === 0 ? lesson('five') : review('revise')); } };
  await expect(authorReviewedLesson(runner, request, root, new AbortController().signal)).rejects.toMatchObject({ code: 'RECOVERY_EXHAUSTED' });
  expect(calls).toBe(100);
  await expect(authorReviewedLesson(runner, request, root, new AbortController().signal)).rejects.toMatchObject({ code: 'RECOVERY_EXHAUSTED' });
  expect(calls).toBe(100);
});

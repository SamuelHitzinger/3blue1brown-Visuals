import { afterEach, expect, test } from 'bun:test';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createLectureVisualGenerator, validateLectureVisual } from '../src/agents/lecture-visual.js';
import type { AgentTask } from '../src/agents/runtime.js';
import type { LectureVisualInput } from '../../shared/lecture.js';

const directories: string[] = [];
afterEach(async () => { await Promise.all(directories.splice(0).map(path => rm(path, { recursive: true, force: true }))); });
const scene = `export default scene({end:'hold',orbit:false},s=>{s.text('label',{text:'A vector',position:[0,1]});s.arrow('v',{from:[0,0],to:[1,0],color:'BLUE'});s.wait(12);});`;
const input: LectureVisualInput = { title: 'Linear algebra', concept: { id: 'vectors', title: 'A vector', explanation: 'A vector has direction and magnitude.', sourceIds: ['src-1'], visualizationPrompt: 'Show a vector doubling while its direction remains fixed.', catalogIds: [] }, sources: [{ id: 'src-1', sequence: 1, kind: 'text', text: 'Scaling a vector by two doubles its length.', createdAt: '2026-10-14T08:00:00Z' }] };

test('standalone lecture scenes enforce silence, duration, renderability and quality', async () => {
  expect((await validateLectureVisual(scene)).compiled.duration).toBe(12);
  await expect(validateLectureVisual(scene.replace("end:'hold'", "audio:'voice',end:'hold'"))).rejects.toThrow('silent');
  await expect(validateLectureVisual(scene.replace('s.wait(12)', 's.wait(120)'))).rejects.toThrow('12');
  await expect(validateLectureVisual(scene.replace('orbit:false', 'orbit:true'))).rejects.toThrow('orbit');
});

test('spatial lecture scenes require a geometry-targeted orbitable view', async () => {
  const spatial = (orbit: boolean) => `export default scene({mode:'3d',end:'hold',orbit:false},s=>{
    s.view('model',{rect:[0,0,1,1],orbit:${orbit},orbitHitTest:'geometry'},v=>v.sphere('ball'));
    s.wait(12);
  });`;
  await expect(validateLectureVisual(spatial(false))).rejects.toThrow('orbitable');
  expect((await validateLectureVisual(spatial(true))).compiled.duration).toBe(12);
});

test('lecture visual generation runs authoritative compiler and mandatory review before returning source', async () => {
  const root = await mkdtemp(join(tmpdir(), 'lecture-visual-')); directories.push(root);
  const tasks: AgentTask[] = []; let reviewed = false;
  const generate = createLectureVisualGenerator({ async run(task) { tasks.push(task); await task.validate!(scene); return scene; } }, root, {
    visualGate: async options => {
      reviewed = true;
      expect(options.source).toBe(scene);
      expect(options.maxReviewRounds).toBe(3);
      expect(options.task.prompt).toContain('src-1');
      expect(options.task.prompt).toContain(input.concept.visualizationPrompt);
      await options.validate(scene);
      return scene;
    },
  });
  const result = await generate(input, new AbortController().signal);
  expect(result.source).toBe(scene); expect(result.duration).toBe(12); expect(reviewed).toBe(true);
  expect(tasks).toHaveLength(1); expect(tasks[0].sceneTools?.inspect).toBeDefined();
  expect(tasks[0].catalogTools).toBeDefined(); expect(tasks[0].allowWeb).toBe(false);
  expect(tasks[0].referenceTools).toBeDefined(); expect(tasks[0].outputMode).toBe('validated-reference');
  expect(tasks[0].systemPrompt).toContain('read_animlib_reference');
  const recipe = await tasks[0].referenceTools!.read({id:'coordinate-maps-basis-vectors-and-algebra'},new AbortController().signal);
  expect(recipe.content).toContain('```js scene');
  expect(tasks[0].systemPrompt.includes(recipe.content)).toBe(false);
  expect(tasks[0].systemPrompt).toContain('silent');
  expect(await readdir(join(root, 'lectures'))).toEqual([]);
});

test('unavailable rendered review never publishes an unreviewed lecture visual', async () => {
  const root = await mkdtemp(join(tmpdir(), 'lecture-visual-')); directories.push(root);
  const generate = createLectureVisualGenerator({ async run() { return scene; } }, root, { visualGate: async () => { throw new Error('Renderer unavailable'); } });
  await expect(generate(input, new AbortController().signal)).rejects.toThrow('Renderer unavailable');
  expect(await readdir(join(root, 'lectures'))).toEqual([]);
});

test('review output still receives final validation and cancelled cached candidates cannot publish', async () => {
  const root = await mkdtemp(join(tmpdir(), 'lecture-visual-')); directories.push(root);
  const runner = { async run(task: AgentTask) { await task.validate!(scene); return scene; } };
  const invalid = createLectureVisualGenerator(runner, root, { visualGate: async () => scene.replace('s.wait(12)', 's.wait(11)') });
  await expect(invalid(input, new AbortController().signal)).rejects.toThrow('12');
  const controller = new AbortController();
  const cancelled = createLectureVisualGenerator(runner, root, { visualGate: async () => {
    controller.abort(new Error('cancelled after review')); return scene;
  } });
  await expect(cancelled(input, controller.signal)).rejects.toThrow('cancelled after review');
  expect(await readdir(join(root, 'lectures'))).toEqual([]);
});

test('cancelled lecture visualization does not invoke authoring', async () => {
  const root = await mkdtemp(join(tmpdir(), 'lecture-visual-')); directories.push(root);
  let calls = 0;
  const generate = createLectureVisualGenerator({ async run() { calls++; return scene; } }, root);
  const controller = new AbortController(); controller.abort(new Error('cancelled'));
  await expect(generate(input, controller.signal)).rejects.toThrow('cancelled'); expect(calls).toBe(0);
});

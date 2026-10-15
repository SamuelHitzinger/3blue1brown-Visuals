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

test('animation and interactive modes enforce different interaction contracts', async () => {
  await expect(validateLectureVisual(scene, undefined, 'interactive')).rejects.toThrow('interactive');
  expect((await validateLectureVisual(scene, undefined, 'animation')).compiled.duration).toBe(12);
  const spatial = `export default scene({mode:'3d',end:'hold',orbit:false},s=>{s.view('model',{rect:[0,0,1,1],orbit:true,orbitHitTest:'geometry'},v=>v.sphere('ball'));s.wait(12);});`;
  await expect(validateLectureVisual(spatial, undefined, 'animation')).rejects.toThrow('animation');
  expect((await validateLectureVisual(spatial, undefined, 'interactive')).compiled.duration).toBe(12);
});

test('lecture visual generation runs authoritative compiler and mandatory review before returning source', async () => {
  const root = await mkdtemp(join(tmpdir(), 'lecture-visual-')); directories.push(root);
  const tasks: AgentTask[] = []; let reviewed = false;
  const reviewRunner = { async run() { throw new Error('Review is stubbed in this test'); } };
  const grounded: LectureVisualInput = { ...input, sources: [{ ...input.sources[0], capture: { kind: 'photo', itemId: 'photo-1', sequence: 1,
    capturedAt: '2026-10-14T08:00:00Z', visualEvidence: 'Blue v arrow points right from O; tip label unclear.' } }] };
  const generate = createLectureVisualGenerator({ async run(task) { tasks.push(task); await task.validate!(scene); return scene; } }, root, {
    reviewRunner, visualGate: async options => {
      reviewed = true;
      expect(options.runner).toBe(reviewRunner);
      expect(options.source).toBe(scene);
      expect(options.maxReviewRounds).toBe(2);
      expect(options.policy?.id).toBe('lecture-visual');
      expect(options.policy?.styleReference).toBeUndefined();
      expect(options.task.prompt).toContain('src-1');
      expect(options.task.prompt).toContain(input.concept.visualizationPrompt);
      expect(JSON.parse(options.task.prompt.split('\n').at(-1)!).sources[0].capture.visualEvidence).toBe('Blue v arrow points right from O; tip label unclear.');
      await options.validate(scene);
      return scene;
    },
  });
  const result = await generate(grounded, new AbortController().signal);
  expect(result.source).toBe(scene); expect(result.duration).toBe(12); expect(reviewed).toBe(true);
  expect(tasks).toHaveLength(1); expect(tasks[0].sceneTools?.inspect).toBeDefined();
  expect(JSON.parse(tasks[0].prompt.split('\n').at(-1)!).sources[0].capture.visualEvidence).toBe('Blue v arrow points right from O; tip label unclear.');
  expect(tasks[0].catalogTools).toBeDefined(); expect(tasks[0].allowWeb).toBe(false);
  const prefetched = JSON.parse(tasks[0].prompt.split('\n').at(-1)!).catalogReferences;
  expect(prefetched.length).toBeGreaterThan(0);
  expect(prefetched.length).toBeLessThanOrEqual(2);
  expect(prefetched.map((entry: any) => entry.id)).toContain('coordinate-maps-2d');
  expect(prefetched[0]).toEqual(await tasks[0].catalogTools!.read(prefetched[0].id, new AbortController().signal));
  expect(tasks[0].referenceTools).toBeDefined(); expect(tasks[0].resourceTools).toBeDefined(); expect(tasks[0].outputMode).toBe('submit-only');
  expect(tasks[0].systemPrompt).toContain('read_animlib_reference');
  const recipe = await tasks[0].referenceTools!.read({id:'coordinate-maps-basis-vectors-and-algebra'},new AbortController().signal);
  expect(recipe.content).toContain('```js scene');
  expect(tasks[0].systemPrompt.includes(recipe.content)).toBe(false);
  expect(tasks[0].systemPrompt).toContain('silent');
  expect(tasks[0].systemPrompt).not.toContain('## Viewing mode and interaction');
  expect(tasks[0].systemPrompt).not.toContain('New app videos use');
  expect(await readdir(join(root, 'lectures'))).toEqual([]);
});

test('visual author and reviewer see cited evidence plus neighbors, with complete evidence available on demand', async () => {
  const root = await mkdtemp(join(tmpdir(), 'lecture-visual-context-')); directories.push(root);
  const sources = Array.from({ length: 40 }, (_, index) => ({ ...input.sources[0], id: `source-${index}`, sequence: index + 1, text: `Evidence ${index} ${'context '.repeat(70)}` }));
  sources[19].text = 'Nearby diagram with a relevant label';
  const packet: LectureVisualInput = { ...input, concept: { ...input.concept, sourceIds: ['source-20'] }, sources };
  const generate = createLectureVisualGenerator({ async run(task) {
    const payload = JSON.parse(task.prompt.split('\n').at(-1)!);
    expect(payload.sources.map((source: any) => source.id)).toEqual(['source-19', 'source-20', 'source-21']);
    expect(JSON.stringify(payload.sources).length).toBeLessThan(JSON.stringify(packet.sources).length / 2);
    expect(Buffer.byteLength(JSON.stringify(payload.catalogReferences))).toBeLessThanOrEqual(28_000);
    const all = await task.referenceTools!.read({ id: 'lecture-evidence', limit: 16000 }, new AbortController().signal);
    expect(all.content).toContain('Evidence 0'); expect(all.nextOffset).toBeDefined();
    return scene;
  } }, root, { visualGate: async options => {
    expect(JSON.parse(options.task.prompt.split('\n').at(-1)!).sources).toHaveLength(3);
    expect((await options.task.referenceTools!.read({ id: 'lecture-evidence', limit: 16000 }, options.signal)).content).toContain('Evidence 0');
    return scene;
  } });
  await generate(packet, new AbortController().signal);
});

test('unavailable rendered review never publishes an unreviewed lecture visual', async () => {
  const root = await mkdtemp(join(tmpdir(), 'lecture-visual-')); directories.push(root);
  const generate = createLectureVisualGenerator({ async run() { return scene; } }, root, { visualGate: async () => { throw new Error('Renderer unavailable'); } });
  await expect(generate(input, new AbortController().signal)).rejects.toThrow('Renderer unavailable');
  expect(await readdir(join(root, 'lectures'))).toEqual([]);
});

test('catalog prefetch preserves explicit references and tolerates a missing optional entry', async () => {
  const root = await mkdtemp(join(tmpdir(), 'lecture-visual-catalog-')); directories.push(root);
  const generate = createLectureVisualGenerator({ async run(task) {
    const packet = JSON.parse(task.prompt.split('\n').at(-1)!);
    expect(packet.catalogReferences.map((entry: any) => entry.id)).toEqual(['coordinate-maps-2d']);
    expect(packet.catalogReferences[0]).toEqual(await task.catalogTools!.read('coordinate-maps-2d', task.signal!));
    return scene;
  } }, root, { visualGate: async () => scene });
  await generate({ ...input, concept: { ...input.concept, catalogIds: ['missing-optional-reference', 'coordinate-maps-2d'] } }, new AbortController().signal);
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

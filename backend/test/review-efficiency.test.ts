import { afterEach, expect, test } from 'bun:test';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compileSource } from 'animlib/core';
import type { FrameRenderer } from '../src/agents/frame-renderer.js';
import { reviewGeneratedScene, sampleReviewTimes } from '../src/agents/visual-gate.js';
import { sourceHash } from '../src/agents/visual-edits.js';
import { videoFailureMessage } from '../src/video-errors.js';

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map(path => rm(path, { recursive: true, force: true }))); });
const source = `export default scene({audio:'voice',end:'hold'},s=>{s.text('label',{text:'DNA',position:[5,0]});s.wait(4);});`;
const repaired = source.replace('[5,0]', '[0,0]');
const rejection = { approved: false, findings: [{ timeSec: 1.234, objectIds: ['label'], problem: 'Clipped label', fix: 'Move the label inside the frame.' }] };
const approval = JSON.stringify({ approved: true, findings: [] });
const patch = (before = source, after = repaired) => JSON.stringify({ sourceSha256: sourceHash(before), edits: [{ finding: 0, before: before === source ? '[5,0]' : '[0,0]', after: after === source ? '[5,0]' : '[0,0]' }] });

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), 'review-efficiency-')); roots.push(directory);
  const renderFrames: FrameRenderer = async input => {
    const frames = [], sheets = [];
    for (const width of [1280, 960]) {
      for (const time of input.times) {
        const path = join(input.directory, `${width}-${time}.png`);
        await writeFile(path, `native ${width} ${time}`); frames.push({ path, width, height: 720, time });
      }
      const path = join(input.directory, `${width}-sheet.png`);
      await writeFile(path, `sheet ${width}`); sheets.push({ path, width, height: 720, times: input.times, columns: 2 });
    }
    return { backend: 'test', frames, sheets };
  };
  return { source, directory, renderFrames, index: 0, videoId: crypto.randomUUID(), signal: new AbortController().signal,
    recoveryWait: async () => {}, task: { systemPrompt: 'Author contract.', prompt: 'Show DNA clearly.' },
    policy: { id: 'test', guidance: 'Verify.', repairGuidance: 'Repair.' },
    input: { audioAssetId: 'voice', endMode: 'hold' as const, scene: { id: 'beat-1', durationSec: 4 }, planning: {} },
    validate: async (candidate: string) => { await compileSource(candidate); } };
}

test('short operations and later camera transitions receive interior evidence', async () => {
  const scene = await compileSource(`export default scene({},s=>{
    const a=s.circle('a');s.wait(6.23);s.play(a.morphTo({kind:'rectangle',width:1,height:2}),{duration:.08});s.wait(3.69);
    for(let i=0;i<5;i++){s.play(s.camera.to3D({yaw:i/5}),{duration:.2});s.wait(9.8);}
  });`);
  const times = sampleReviewTimes(scene);
  expect(times.some(t => t > 6.23 && t < 6.31)).toBe(true);
  expect(times.some(t => Math.abs(t - 50.1) < 1e-8)).toBe(true);
  expect(times).toContain(0); expect(times).toContain(60);
  expect(times.length).toBeLessThanOrEqual(16);
});

test('normal rejection stops after one repair and two reviews, including on restart', async () => {
  const f = await fixture(); let reviews = 0, repairs = 0;
  const runner = { async run(task: Parameters<Parameters<typeof reviewGeneratedScene>[0]['runner']['run']>[0]) {
    if (task.logContext?.stage === 'repair') { repairs++; return patch(); }
    if (++reviews > 2) throw new Error('Unexpected third review');
    return JSON.stringify(rejection);
  } };
  await expect(reviewGeneratedScene({ ...f, runner })).rejects.toMatchObject({ code: 'RECOVERY_EXHAUSTED' });
  expect(reviews).toBe(2); expect(repairs).toBe(1);
  await expect(readFile(join(f.directory, 'scene-0.visual-review.json'))).rejects.toThrow();
  await expect(reviewGeneratedScene({ ...f, runner })).rejects.toMatchObject({ code: 'RECOVERY_EXHAUSTED' });
  expect(reviews).toBe(2); expect(repairs).toBe(1);
});

test('an approval after a malformed response survives restart without more model calls', async () => {
  const f = await fixture(); let calls = 0, renders = 0;
  const options = { ...f, renderFrames: async (input: Parameters<FrameRenderer>[0]) => { renders++; return f.renderFrames(input); },
    runner: { async run() { return ++calls === 1 ? '{"approved":true,"findings":[],"source":"forbidden"}' : approval; } } };
  expect(await reviewGeneratedScene(options)).toBe(source);
  expect(await reviewGeneratedScene(options)).toBe(source);
  expect(calls).toBe(2); expect(renders).toBe(1);
});

test('the durable approval receipt recovers repaired source before the checkpoint or scene is saved', async () => {
  const f = await fixture(); let reviews = 0, repairs = 0;
  const options = { ...f, runner: { async run(task: Parameters<Parameters<typeof reviewGeneratedScene>[0]['runner']['run']>[0]) {
    if (task.logContext?.stage === 'repair') { repairs++; return patch(); }
    return ++reviews === 1 ? JSON.stringify(rejection) : approval;
  } } };
  expect(await reviewGeneratedScene(options)).toBe(repaired);
  const checkpoint = join(f.directory, 'scene-0.visual-state.json');
  const state = JSON.parse(await readFile(checkpoint, 'utf8'));
  // Receipt committed, but the final checkpoint transition did not.
  state.phase = 'review'; state.phaseAttempts['1:review'] = 2;
  await writeFile(checkpoint, JSON.stringify(state));
  expect(await reviewGeneratedScene(options)).toBe(repaired);
  // The receipt also preserves the approved candidate independently of the
  // pending initial source supplied by the generator after a process restart.
  await rm(checkpoint);
  expect(await reviewGeneratedScene(options)).toBe(repaired);
  expect(reviews).toBe(2); expect(repairs).toBe(1);
});

test('saved approval cannot replace a new source supplied under the same context', async () => {
  const f = await fixture(); let calls = 0;
  expect(await reviewGeneratedScene({ ...f, runner: { async run() { calls++; return approval; } } })).toBe(source);
  expect(await reviewGeneratedScene({ ...f, source: repaired, runner: { async run() { calls++; return approval; } } })).toBe(repaired);
  expect(calls).toBe(2);
});

test.each(['contextHash', 'sourceSha256', 'source'] as const)('a mismatched approval %s is never reused', async field => {
  const f = await fixture();
  await reviewGeneratedScene({ ...f, runner: { async run() { return approval; } } });
  const path = join(f.directory, 'scene-0.visual-review.json');
  const receipt = JSON.parse(await readFile(path, 'utf8'));
  receipt[field] = field === 'source' ? repaired : 'wrong-identity';
  await writeFile(path, JSON.stringify(receipt));
  await expect(reviewGeneratedScene({ ...f, runner: { async run() { throw new Error('A stale approval must not produce an approved result'); } } })).rejects.toThrow();
});

test('one permitted review cannot spend a repair without another verification', async () => {
  const f = await fixture(); let repairs = 0;
  await expect(reviewGeneratedScene({ ...f, maxReviewRounds: 1, runner: { async run(task) {
    if (task.logContext?.stage === 'repair') { repairs++; return patch(); }
    return JSON.stringify(rejection);
  } } })).rejects.toMatchObject({ code: 'RECOVERY_EXHAUSTED' });
  expect(repairs).toBe(0);
});

test('malformed review protocol terminates after two submissions without durable retry', async () => {
  const f = await fixture(); let calls = 0;
  await expect(reviewGeneratedScene({ ...f, runner: { async run() {
    if (++calls > 2) throw new Error('Unexpected protocol retry');
    return '{"approved":true,"findings":[],"source":"forbidden"}';
  } } })).rejects.toMatchObject({ code: 'RECOVERY_EXHAUSTED' });
  expect(calls).toBe(2);
});

test('rejected validation inside a runner retains its spent protocol budget across interruption', async () => {
  const f = await fixture(); let calls = 0;
  const runner = { async run(task: Parameters<Parameters<typeof reviewGeneratedScene>[0]['runner']['run']>[0]) {
    calls++;
    await task.validate!('{"approved":true,"findings":[],"source":"forbidden"}');
    return approval;
  } };
  await expect(reviewGeneratedScene({ ...f, runner, recoveryWait: async () => { throw new Error('Interrupted between submissions'); } })).rejects.toThrow('Interrupted between submissions');
  expect(calls).toBe(1);
  await expect(reviewGeneratedScene({ ...f, runner })).rejects.toMatchObject({ code: 'RECOVERY_EXHAUSTED' });
  expect(calls).toBe(2);
});

test('a resumed repair retains the actual evidence images', async () => {
  const f = await fixture();
  await expect(reviewGeneratedScene({ ...f, runner: { async run(task) {
    if (task.logContext?.stage === 'repair') throw new Error('Interrupted repair');
    return JSON.stringify(rejection);
  } } })).rejects.toThrow('Interrupted repair');
  const result = await reviewGeneratedScene({ ...f, runner: { async run(task) {
    if (task.logContext?.stage === 'repair') {
      expect(task.images?.length).toBeGreaterThanOrEqual(4);
      return patch();
    }
    return approval;
  } } });
  expect(result).toBe(repaired);
});

test('default-video checkpoints cannot cross a changed author contract', async () => {
  const f = await fixture(); let reviews = 0;
  await expect(reviewGeneratedScene({ ...f, policy: undefined, maxReviewRounds: 1, runner: { async run() {
    reviews++; return JSON.stringify(rejection);
  } } })).rejects.toMatchObject({ code: 'RECOVERY_EXHAUSTED' });
  const result = await reviewGeneratedScene({ ...f, policy: undefined, task: { ...f.task, systemPrompt: 'Changed author contract.' },
    runner: { async run() { reviews++; return approval; } } });
  expect(result).toBe(source); expect(reviews).toBe(2);
});

test('alternate renderers cannot omit known defect times and obtain approval', async () => {
  const f = await fixture(); let reviews = 0, renders = 0;
  await expect(reviewGeneratedScene({ ...f, renderFrames: async input => {
    const evidence = await f.renderFrames(input);
    if (++renders === 2) {
      evidence.frames = evidence.frames.filter(frame => frame.time !== 1.234);
      evidence.sheets = evidence.sheets.map(sheet => ({ ...sheet, times: sheet.times.filter(time => time !== 1.234) }));
    }
    return evidence;
  }, runner: { async run(task) {
    if (task.logContext?.stage === 'repair') return patch();
    return ++reviews === 1 ? JSON.stringify(rejection) : approval;
  } } })).rejects.toThrow('defect');
  expect(reviews).toBe(1);
});

test('repair verification includes the exact defect time and native images in both aspect ratios', async () => {
  const f = await fixture(); const times: number[][] = []; let reviews = 0;
  const result = await reviewGeneratedScene({ ...f, renderFrames: async input => {
    times.push(input.times); return f.renderFrames(input);
  }, runner: { async run(task) {
    if (task.logContext?.stage === 'repair') return patch();
    reviews++;
    const images = task.images!.map(image => Buffer.from(image.data, 'base64').toString());
    expect(images.some(image => image.startsWith('native 1280 '))).toBe(true);
    expect(images.some(image => image.startsWith('native 960 '))).toBe(true);
    if (reviews === 2) {
      expect(images).toContain('native 1280 1.234'); expect(images).toContain('native 960 1.234');
      expect(task.prompt).toContain('partial');
    }
    return reviews === 1 ? JSON.stringify(rejection) : approval;
  } } });
  expect(result).toBe(repaired); expect(times[1]).toContain(1.234);
  expect(JSON.parse(await readFile(join(f.directory, 'scene-0.visual-review.json'), 'utf8')).sourceSha256).toBe(sourceHash(repaired));
});

test('a source cycle cannot be rendered or approved under a larger explicit budget', async () => {
  const f = await fixture(); let renders = 0, repairs = 0;
  await expect(reviewGeneratedScene({ ...f, maxReviewRounds: 5, renderFrames: async input => {
    renders++; return f.renderFrames(input);
  }, runner: { async run(task) {
    if (task.logContext?.stage === 'repair') return ++repairs === 1 ? patch() : patch(repaired, source);
    return renders > 2 ? approval : JSON.stringify({ ...rejection, findings: [{ ...rejection.findings[0], problem: `Defect ${renders}` }] });
  } } })).rejects.toMatchObject({ code: 'RECOVERY_EXHAUSTED' });
  expect(renders).toBe(2); expect(repairs).toBe(2);
});

test('empty rendered evidence cannot produce an approval', async () => {
  const f = await fixture(); let calls = 0;
  await expect(reviewGeneratedScene({ ...f, renderFrames: async () => ({ backend: 'test', frames: [], sheets: [] }),
    runner: { async run() { calls++; return approval; } } })).rejects.toThrow();
  expect(calls).toBe(0);
});

test('terminal user message describes bounded checks without an incorrect attempt count', () => {
  const message = videoFailureMessage('RECOVERY_EXHAUSTED', true);
  expect(message).not.toContain('50'); expect(message).toContain('progress is saved');
  expect(message).toContain('watch the parts');
});

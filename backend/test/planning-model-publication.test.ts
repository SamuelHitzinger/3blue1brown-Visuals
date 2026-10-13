import { afterEach, expect, test } from 'bun:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createPiGenerator } from '../src/agents/generator.js';
import type { AgentTask } from '../src/agents/runtime.js';
import type { NarrationService } from '../src/narration/service.js';

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))); });
const lesson = { schemaVersion: 1,
  markdown: '# A model\n\n## Beat 1 — Inspect\n\nContent needed: Inspect the triangular panel.\n\nNarration: This panel has three corners.',
  plan: { audience: 'Newcomer', prerequisites: [], learningGoal: 'Inspect the panel', centralQuestion: 'How many corners?',
    keyInsight: 'There are three corners', runningExample: 'One triangular panel', misconceptions: [], entities: [],
    scenes: [{ id: 'beat-1', purpose: 'Inspect the panel', whyNow: 'Answer the question', keyPoints: ['Three corners'],
      visualDescription: 'One triangular panel', endsWith: 'Panel visible', carry: [], cleanup: [], sourceRefs: [], interactions: [] }] },
};

test('planning publishes a real model before review and scene authoring receives the same asset', async () => {
  const root = await mkdtemp(join(tmpdir(), 'aha-planning-model-')); roots.push(root);
  const previous = process.env.MODEL_ASSET_DIR; process.env.MODEL_ASSET_DIR = join(root, 'assets');
  const videoId = crypto.randomUUID(), signal = new AbortController().signal;
  const finished = new Error('Scene boundary reached');
  let publishedId = '', reviewed = false;
  const runner = { async run(task: AgentTask) {
    if (task.logContext?.stage === 'draft') {
      expect(task.publishModel).toBeFunction();
      const published = await task.publishModel!({ generated: JSON.stringify({ parts: [{ name: 'panel',
        vertices: [[0, 0, 0], [1, 0, 0], [0, 1, 0]], triangles: [[0, 1, 2]], baseColor: [1, 1, 1, 1] }] }) }, signal) as { id: string };
      publishedId = published.id;
      return JSON.stringify(lesson);
    }
    if (task.logContext?.stage === 'review') {
      expect(task.prompt).toContain(publishedId);
      expect(task.prompt).toContain('panel');
      reviewed = true;
      return JSON.stringify({ schemaVersion: 1, verdict: 'pass', summary: 'Panel is prepared', issues: [], checks: ['The actual asset has three corners.'] });
    }
    expect(reviewed).toBe(true);
    expect(task.prompt).toContain(publishedId);
    const input = JSON.parse(task.prompt.slice(task.prompt.indexOf('\n') + 1));
    await task.validate!(`export default scene({audio:${JSON.stringify(input.audioAssetId)},end:${JSON.stringify(input.endMode)}},s=>{s.model('panel',{asset:${JSON.stringify(publishedId)}});s.wait(${input.scene.durationSec});});`);
    throw finished;
  } };
  try {
    await expect(createPiGenerator(runner, {} as NarrationService, root)(
      { title: 'A model', topic: 'Inspect a panel', documents: [], narrationMode: 'subtitles' }, 0,
      { videoId, owner: 'test', signal })).rejects.toBe(finished);
    const saved = JSON.parse(await readFile(join(root, videoId, 'model-assets.json'), 'utf8'));
    expect(saved[publishedId].metadata.parts[0].name).toBe('panel');
    expect((await readFile(join(root, 'assets', `${saved[publishedId].sha256}.glb`))).byteLength).toBeGreaterThan(100);
  } finally { if (previous === undefined) delete process.env.MODEL_ASSET_DIR; else process.env.MODEL_ASSET_DIR = previous; }
});

import { afterEach, expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { lectureAgentConfig, lectureWorkflowConfig } from '../src/agents/lecture-config.js';
import { createLectureWorkflow } from '../src/lecture-workflow.js';
import type { AgentConfig } from '../src/agents/config.js';

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))); });

test('video settings cannot change or disable notes and notebook visual settings', () => {
  const env = { VIDEO_GENERATOR: 'simulated', VIDEO_DB_PATH: '/other/videos.sqlite', AGENT_MODEL: 'video-model', AGENT_THINKING: 'invalid',
    AGENT_SCENE_OUTPUT_MODE: 'invalid', AGENT_SCENE_TIMING_MODE: 'invalid', AGENT_DATA_DIR: '/other/video-jobs', SCENE_PREVIEW: '0' };
  expect(lectureWorkflowConfig(env)).toEqual(lectureWorkflowConfig({}));
  for (const role of ['notes', 'live-notes', 'visual', 'visual-review'] as const) {
    expect(lectureAgentConfig(role, env)).toEqual(lectureAgentConfig(role, {}));
  }
  expect(lectureAgentConfig('notes', env).model).toBe('gpt-6.1-sol');
  expect(lectureAgentConfig('visual', env).model).toBe('gpt-6-astra');
});

test('lecture roles retain separate models, reasoning, paths and opt-out switches', () => {
  const env = { LECTURE_GENERATOR: 'disabled', LECTURE_VISUAL_GENERATOR: 'pi', LECTURE_MODEL: 'notes-model', LECTURE_VISUAL_MODEL: 'visual-model',
    LECTURE_VISUAL_REVIEW_MODEL: 'review-model', LECTURE_AGENT_DATA_DIR: 'private/notes', LECTURE_DB_PATH: 'private/lectures.sqlite', LECTURE_SCENE_PREVIEW: '0' };
  expect(lectureWorkflowConfig(env)).toMatchObject({ notesEnabled: false, visualsEnabled: true, previewEnabled: false,
    dbPath: 'private/lectures.sqlite', captureDbPath: join('private', 'lecture-capture.sqlite'), liveBridgeDbPath: join('private', 'lecture-live-bridge.sqlite') });
  expect(lectureAgentConfig('notes', env)).toMatchObject({ model: 'notes-model', thinking: 'medium', dataDir: resolve('private/notes') });
  expect(lectureAgentConfig('live-notes', env).thinking).toBe('minimal');
  expect(lectureAgentConfig('visual', env)).toMatchObject({ model: 'visual-model', thinking: 'medium' });
  expect(lectureAgentConfig('visual-review', env)).toMatchObject({ model: 'review-model', thinking: 'high' });
  expect(() => lectureWorkflowConfig({ LECTURE_GENERATOR: 'typo' })).toThrow('LECTURE_GENERATOR');
});

test('real lecture composition processes sources with video generation simulated and notebook visuals disabled', async () => {
  const root = await mkdtemp(join(tmpdir(), 'lecture-workflow-')); roots.push(root);
  const configs: AgentConfig[] = [];
  let previewCalls = 0, noteCalls = 0;
  const workflow = createLectureWorkflow({ VIDEO_GENERATOR: 'simulated', AGENT_THINKING: 'invalid', LECTURE_VISUAL_GENERATOR: 'disabled',
    LECTURE_DB_PATH: join(root, 'lectures.sqlite') }, {
    createRunner: config => { configs.push(config); return { async run(task) {
      noteCalls++;
      expect(task.systemPrompt).not.toContain('## Viewing mode and interaction');
      const output = JSON.stringify({ summary: '', sections: [], concepts: [], questions: [] });
      await task.validate?.(output);
      return output;
    } }; },
    createPreview: () => { previewCalls++; throw new Error('Notes must not construct a scene preview'); },
  });
  try {
    expect(configs.map(config => config.model)).toEqual(['gpt-6.1-sol', 'gpt-6.1-sol']);
    expect(previewCalls).toBe(0);
    const create = await workflow.lectures.handle(new Request('http://localhost/api/lectures', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'separate-notes' }, body: JSON.stringify({ title: 'Vectors' }) }));
    const session = await create!.json();
    const append = await workflow.lectures.handle(new Request(`http://localhost/api/lectures/${session.id}/sources`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'separate-source' }, body: JSON.stringify({ kind: 'text', text: 'Hello class.' }) }));
    expect(append!.status).toBeLessThan(300);
    const deadline = Date.now() + 3000;
    let saved;
    do {
      await new Promise(resolve => setTimeout(resolve, 10));
      saved = await (await workflow.lectures.handle(new Request(`http://localhost/api/lectures/${session.id}`)))!.json();
    } while (saved.synthesizedRevision !== 1 && Date.now() < deadline);
    expect(saved.synthesizedRevision).toBe(1);
    expect(saved.status).toBe('idle');
    expect(saved.visualizations).toEqual([]);
    expect(noteCalls).toBe(1);
  } finally { await workflow.close(); }
});

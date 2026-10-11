import { expect, test } from 'bun:test';
import type { AgentTask } from '../../backend/src/agents/runtime.js';
import { createConstructionRunner, moveConstructionChecklist, parseConstructionBrief } from './construction-runner';

const checklist = 'Exact construction checklist.\n\n';
const reference = 'Installed API reference.\n';
const system = `Start.\n${checklist}Middle.\n${reference}Role output contract.`;
const brief = { schemaVersion: 1 as const, representation: 'A folded connected volume.',
  majorPartsAndConnections: 'Unequal parts share broad interfaces.', activeRegion: 'The local cavity remains part of the whole.',
  operationAndClearance: 'A rigid part moves along a specified clear path.', viewEvidence: 'Oblique framing exposes the relevant depth.',
  compileCostRisks: 'Reuse sampled topology and use bounded calculations.' };
const encoded = JSON.stringify(brief);
function task(stage: 'scene' | 'review' | 'repair' = 'scene', index = 0, signal?: AbortSignal): AgentTask {
  return { systemPrompt: system, prompt: 'Canonical request and narration.', signal,
    logContext: { videoId: 'test-video', stage, sceneIndex: index }, outputMode: 'validated-reference',
    validate: async () => {}, sceneTools: { inspect: async () => ({}) as any } };
}
function options(extra: Record<string, unknown> = {}) {
  return { mode: 'specialist' as const, checklist, apiReference: reference,
    specialistPrompt: 'Create a bounded construction proposal.', referenceExcerpts: [reference],
    contextForScene: async () => ({ viewMode: '3d' as const, prompt: 'Approved spatial scene context.' }), ...extra };
}

test('moves exact checklist after API while preserving all other text and role contract', () => {
  const moved = moveConstructionChecklist(system, checklist, reference);
  expect(moved).toBe(`Start.\nMiddle.\n${reference}${checklist}Role output contract.`);
  expect(moved.length).toBe(system.length);
  expect(() => moveConstructionChecklist(system+checklist, checklist, reference)).toThrow();
  expect(() => moveConstructionChecklist(system, checklist, 'missing reference')).toThrow();
});

test('default off and planar scenes pass the identical task without helper calls', async () => {
  const calls: AgentTask[] = [];
  const base = { async run(value: AgentTask) { calls.push(value); return 'source'; } };
  const original = task();
  expect(await createConstructionRunner(base).run(original)).toBe('source');
  expect(calls[0]).toBe(original);
  const planar = createConstructionRunner(base, options({ contextForScene: async () => ({ viewMode: '2d', prompt: 'Planar.' }) }));
  await planar.run(original);
  expect(calls).toHaveLength(2);
  expect(calls[1]).toBe(original);
});

test('order-only relocates checklist without helper, added instructions or altered tools', async () => {
  const calls: AgentTask[] = [];
  const original = task();
  const runner = createConstructionRunner({ async run(value) { calls.push(value); return 'source'; } }, options({ mode: 'order-only' }));
  await runner.run(original);
  expect(calls).toHaveLength(1);
  expect(calls[0].prompt).toBe(original.prompt);
  expect(calls[0].systemPrompt).toBe(moveConstructionChecklist(system, checklist, reference));
  expect(calls[0].sceneTools).toBe(original.sceneTools);
  expect(calls[0].validate).toBe(original.validate);
  expect(calls[0].outputMode).toBe(original.outputMode);
  expect(original.systemPrompt).toBe(system);
});

test('one separate specialist per scene even for concurrent author calls, with brief in reviews and repairs', async () => {
  const calls: AgentTask[] = [], events: any[] = [];
  const metrics = { elapsedMs: 1, providerCalls: 1, turns: [], validations: [] };
  const base = { async run(value: AgentTask) {
    calls.push(value); value.onMetrics?.(metrics);
    if (value.outputMode === 'submit-only') { await value.validate!(encoded); return encoded; }
    return 'source';
  } };
  const runner = createConstructionRunner(base, options({ onEvent: (event: unknown) => events.push(event) }));
  const original = task();
  await Promise.all([runner.run(original), runner.run(original)]);
  expect(calls.filter(value => value.outputMode === 'submit-only')).toHaveLength(1);
  expect(calls.filter(value => value.outputMode !== 'submit-only')).toHaveLength(2);
  for (const stage of ['review','repair'] as const) await runner.run(task(stage));
  for (const value of calls.filter(value => value.outputMode !== 'submit-only')) {
    expect(value.prompt).toContain('Unequal parts share broad interfaces.');
    expect(value.prompt).toContain(original.prompt);
  }
  expect(events.find(event => event.role === 'construction-specialist' && event.kind === 'finish').metrics).toEqual(metrics);
  await runner.run(task('scene', 1));
  expect(calls.filter(value => value.outputMode === 'submit-only')).toHaveLength(2);
});

test('aborted task never starts specialist or author and abort during helper prevents author', async () => {
  const before = new AbortController(); before.abort(new Error('stop before'));
  let count = 0;
  const runner = createConstructionRunner({ async run() { count++; return encoded; } }, options());
  await expect(runner.run(task('scene', 0, before.signal))).rejects.toThrow('stop before');
  expect(count).toBe(0);
  const during = new AbortController();
  const later = createConstructionRunner({ async run(value) {
    count++; expect(value.signal).toBe(during.signal); during.abort(new Error('stop during')); return encoded;
  } }, options());
  await expect(later.run(task('scene', 0, during.signal))).rejects.toThrow('stop during');
  expect(count).toBe(1);
});

test('brief validation rejects unknown fields, blank fields and oversized output before author', async () => {
  expect(parseConstructionBrief(encoded)).toEqual(brief);
  expect(() => parseConstructionBrief(JSON.stringify({ ...brief, extra: 'ignored?' }))).toThrow();
  expect(() => parseConstructionBrief(JSON.stringify({ ...brief, activeRegion: ' ' }))).toThrow();
  expect(() => parseConstructionBrief(JSON.stringify({ ...brief, representation: 'x'.repeat(1025) }))).toThrow();
  expect(() => parseConstructionBrief(' '.repeat(8193))).toThrow();
  let calls = 0;
  const runner = createConstructionRunner({ async run() { calls++; return '{}'; } }, options());
  await expect(runner.run(task())).rejects.toThrow();
  expect(calls).toBe(1);
});

test('helper budget is bounded, unknown scene reviews remain untouched, and context cannot drift', async () => {
  const calls: AgentTask[] = [];
  let context = 'original';
  const runner = createConstructionRunner({ async run(value) { calls.push(value); return value.outputMode === 'submit-only' ? encoded : 'source'; } },
    options({ maxSpecialists: 1, contextForScene: async () => ({ viewMode: '3d', prompt: context }) }));
  const unseen = task('review', 5); await runner.run(unseen);
  expect(calls[0]).toBe(unseen);
  await runner.run(task());
  context = 'changed';
  await expect(runner.run(task())).rejects.toThrow('context');
  await expect(runner.run(task('scene', 1))).rejects.toThrow('budget');
});

test('author callbacks, images, asset publication and effective input provenance survive decoration', async () => {
  const calls: AgentTask[] = [], events: any[] = [];
  let originalMetricsCalls = 0;
  const original = { ...task(), images: [{ type: 'image' as const, data: 'AA==', mimeType: 'image/png' }],
    publishModel: async () => ({}), onMetrics: () => { originalMetricsCalls++; } };
  const runner = createConstructionRunner({ async run(value) {
    calls.push(value); value.onMetrics?.({ elapsedMs: 3, providerCalls: 1, turns: [], validations: [] });
    return value.outputMode === 'submit-only' ? encoded : 'source';
  } }, options({ onEvent: (event: unknown) => { events.push(event); },
    modelSystemForTask: (value: AgentTask) => value.systemPrompt + '\nRuntime completion.' }));
  await runner.run(original);
  expect(originalMetricsCalls).toBe(1);
  expect(calls[0].sceneTools).toBeUndefined();
  expect(calls[0].publishModel).toBeUndefined();
  expect(calls[1].images).toBe(original.images);
  expect(calls[1].publishModel).toBe(original.publishModel);
  expect(calls[1].validate).toBe(original.validate);
  const start = events.find(event => event.role === 'scene' && event.kind === 'start');
  expect(start.originalInput.prompt).toBe(original.prompt);
  expect(start.effectiveInput.prompt).toContain(encoded);
  expect(start.modelSystemPrompt).toBe(calls[1].systemPrompt + '\nRuntime completion.');
  expect(new Set(events.map(event => event.taskId)).size).toBe(2);
});

test('cancellation during a pending context or helper returns promptly and logs helper failure', async () => {
  const controller = new AbortController();
  let calls = 0;
  const context = createConstructionRunner({ async run() { calls++; return encoded; } },
    options({ contextForScene: () => new Promise(() => {}) }));
  const pendingContext = context.run(task('scene', 0, controller.signal));
  controller.abort(new Error('stop resolving'));
  await expect(pendingContext).rejects.toThrow('stop resolving');
  expect(calls).toBe(0);
  const during = new AbortController(), events: any[] = [];
  let entered!: () => void;
  const started = new Promise<void>(resolve => { entered = resolve; });
  const helper = createConstructionRunner({ async run() { calls++; entered(); return new Promise(() => {}); } },
    options({ onEvent: (event: unknown) => { events.push(event); } }));
  const pendingHelper = helper.run(task('scene', 0, during.signal));
  await started;
  during.abort(new Error('stop helper'));
  await expect(pendingHelper).rejects.toThrow('stop helper');
  expect(calls).toBe(1);
  expect(events.find(event => event.kind === 'finish').error).toBe('stop helper');
});

test('bounded helper inputs fail before inference; invalid output is a logged failure', async () => {
  let calls = 0;
  const base = { async run() { calls++; return '{}'; } };
  expect(() => createConstructionRunner(base, options({ referenceExcerpts: ['invented API'] }))).toThrow('verbatim');
  const oversized = createConstructionRunner(base,
    options({ contextForScene: async () => ({ viewMode: '3d', prompt: 'x'.repeat(40001) }) }));
  await expect(oversized.run(task())).rejects.toThrow('context');
  expect(calls).toBe(0);
  const events: any[] = [];
  const invalid = createConstructionRunner(base, options({ onEvent: (event: unknown) => { events.push(event); } }));
  await expect(invalid.run(task())).rejects.toThrow();
  await expect(invalid.run(task())).rejects.toThrow();
  expect(calls).toBe(1);
  expect(events.find(event => event.kind === 'finish').error).toContain('schema');
});

test('does not allow a second construction decorator to delegate recursively', () => {
  const inner = createConstructionRunner({ async run() { return encoded; } }, options());
  expect(() => createConstructionRunner(inner, options())).toThrow('undecorated');
});

test('cancellation is not held by an unfinished asynchronous finish logger', async () => {
  const controller = new AbortController();
  const runner = createConstructionRunner({ async run() {
    controller.abort(new Error('cancel before author')); return encoded;
  } }, options({ onEvent: (event: any) => event.kind === 'finish' ? new Promise(() => {}) : undefined }));
  await expect(runner.run(task('scene', 0, controller.signal))).rejects.toThrow('cancel before author');
}, 200);

test('author cancellation also escapes an unfinished finish logger', async () => {
  const controller = new AbortController();
  const runner = createConstructionRunner({ async run() {
    controller.abort(new Error('cancel author')); return 'source';
  } }, options({ mode: 'order-only', onEvent: (event: any) => event.kind === 'finish' ? new Promise(() => {}) : undefined }));
  await expect(runner.run(task('scene', 0, controller.signal))).rejects.toThrow('cancel author');
}, 200);

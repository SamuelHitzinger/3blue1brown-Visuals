import { afterEach, expect, spyOn, test } from 'bun:test';
import { AgentSession } from '@earendil-works/pi-coding-agent';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAssistantMessageEventStream } from '@earendil-works/pi-ai';
import type { AssistantMessage, Context, JsonObject } from '@earendil-works/pi-ai';
import { createModelRuntime } from '../src/agents/auth.js';
import { agentConfig } from '../src/agents/config.js';
import { PiAgentRunner } from '../src/agents/runtime.js';
import type { AgentRunMetrics, AgentTask } from '../src/agents/runtime.js';
import { createReferenceTools } from '../src/agents/reference-tools.js';
import { generateLectureNotes } from '../src/agents/lecture.js';
import {createVisualizationResolver} from '../src/visualization-resolver.js';
import {catalogTools} from '../src/agents/catalog.js';
import { compileSource } from 'animlib/core';

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map(path => rm(path, { recursive: true, force: true }))); });
function reply(text: string, stopReason: AssistantMessage['stopReason'] = 'stop'): AssistantMessage {
  return { role: 'assistant', content: [{ type: 'text', text }], provider: 'openai', api: 'openai-responses', model: 'gpt-6-astra',
    usage: { input: 100, output: 30, reasoning: 10, cacheRead: 40, cacheWrite: 0, totalTokens: 170,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } }, stopReason, timestamp: Date.now(),
    ...(stopReason === 'error' ? { errorMessage: '401 secret-provider-details' } : {}) };
}
function call(name: string, output: string | JsonObject, id = 'call-1') {
  const result = reply('', 'toolUse');
  result.content = [{ type: 'toolCall', id, name, arguments: { output } }];
  return result;
}
async function harness(outputs: AssistantMessage[], wait?: (ms: number, signal?: AbortSignal) => Promise<void>) {
  const root = await mkdtemp(join(tmpdir(), 'scene-runtime-')); roots.push(root);
  const config = agentConfig({ PI_CODING_AGENT_DIR: root, AGENT_AUTH_MODE: 'api-key', OPENAI_API_KEY: 'fake-test-key' });
  const runtime = await createModelRuntime(config);
  const contexts: Context[] = [];
  const sessionIds: (string | undefined)[] = [];
  runtime.streamSimple = (_model, context, options) => {
    contexts.push(structuredClone(context));
    sessionIds.push(options?.sessionId);
    const stream = createAssistantMessageEventStream();
    const message = outputs.shift() ?? reply('', 'error');
    queueMicrotask(() => {
      stream.push({ type: 'start', partial: message });
      if (message.stopReason === 'error' || message.stopReason === 'aborted') stream.push({ type: 'error', reason: message.stopReason, error: message });
      else if (message.stopReason !== 'pending') stream.push({ type: 'done', reason: message.stopReason, message });
    });
    return stream;
  };
  return { runner: new PiAgentRunner(config, async () => runtime, wait), contexts, runtime, sessionIds };
}
const base = { systemPrompt: 'Author a complete scene.', prompt: 'Generate a scene.' };

test('resource tools are opt-in, return usable selected references, and exact capability filters reach search',async()=>{
  const {runner,contexts}=await harness([reply('review complete'),
    sceneCall('resolve_visualization_resource',{catalogId:'mechanical-modes'}),
    sceneCall('search_visualization_catalog',{intent:'show two waves cancel each other',capabilities:['s.rigidMotion']}),reply('authored')]);
  await runner.run({...base,allowWeb:false,catalogTools});
  const toolNames=(context:Context)=>context.messages.flatMap(message=>message.role==='system'?(message.toolsAdded??[]).map(tool=>tool.name):[]);
  expect(toolNames(contexts[0])).not.toContain('resolve_visualization_resource');
  const referenceTools=createReferenceTools([{id:'scientific-modal-state',title:'Modal',content:'export default scene({},s=>{s.wait(1);});'}]);
  await runner.run({...base,allowWeb:false,catalogTools,referenceTools,resourceTools:createVisualizationResolver({referenceTools})});
  expect(toolNames(contexts[1])).toContain('resolve_visualization_resource');
  expect(toolNames(contexts[1])).toContain('read_visualization_resource');
  expect(JSON.stringify(contexts[2])).toContain('scientific-modal-state');
  const results=contexts[3].messages.filter(message=>message.role==='toolResult');
  const search=JSON.parse((results.at(-1)!.content[0] as {text:string}).text);
  expect(search.entries.every((entry:{id:string})=>entry.id==='rigid-molecular-motion')).toBe(true);
});

test('lecture cache affinity reuses routing without retaining prior conversation content', async () => {
  const { runner, contexts, sessionIds } = await harness([reply('first'), reply('second'), reply('third')]);
  await runner.run({ ...base, prompt: 'first-private-payload', cacheKey: 'lecture-notes:one', allowWeb: false });
  await runner.run({ ...base, prompt: 'second-payload', cacheKey: 'lecture-notes:one', allowWeb: false });
  await runner.run({ ...base, prompt: 'third-payload', cacheKey: 'lecture-notes:two', allowWeb: false });
  expect(sessionIds).toEqual(['lecture-notes:one', 'lecture-notes:one', 'lecture-notes:two']);
  expect(JSON.stringify(contexts[1])).not.toContain('first-private-payload');
  expect(JSON.stringify(contexts[2])).not.toContain('second-payload');
});

test('structured submission avoids escaped JSON while keeping validation and repair', async () => {
  const patch = { patch: { sections: [{ updateId: 'vectors', appendPoints: [['|v| = 5', ['s1']]] }] } };
  const { runner, contexts } = await harness([call('submit_output', { wrong: true }), call('submit_output', patch)]);
  const checked: unknown[] = [];
  const result = await runner.run({ ...base, allowWeb: false, outputMode: 'submit-only', structuredOutput: true,
    validate: async output => { const value = JSON.parse(output); checked.push(value); if (!value.patch) throw new Error('Expected a patch'); } });
  expect(JSON.parse(result)).toEqual(patch);
  expect(checked).toEqual([{ wrong: true }, patch, patch]);
  expect(contexts).toHaveLength(2);
  expect(JSON.stringify(contexts[1])).toContain('Expected a patch');
});

test('live notes finish with one validated submission without repeating the notebook', async () => {
  const notes = { summary: '', sections: [{ id: 'vectors', title: 'Vectors', points: [{ text: 'Vector: magnitude + direction', sourceIds: ['s1'] }] }], concepts: [], questions: [] };
  const { runner, contexts } = await harness([call('submit_output', JSON.stringify(notes))]);
  expect(await generateLectureNotes(runner, { title: 'Vectors', previousNotes: null, sources: [{ id: 's1', sequence: 1, kind: 'text', text: 'A vector has magnitude and direction.', createdAt: '2026-10-15T08:00:00Z' }] }, new AbortController().signal)).toEqual(notes);
  expect(contexts).toHaveLength(1);
});

function sceneCall(name: string, args: JsonObject, id = crypto.randomUUID()) {
  const result = reply('', 'toolUse');
  result.content = [{ type: 'toolCall', id, name, arguments: args }];
  return result;
}

test('final submission can select an inspected scene without repeating its code; invalid selection stays repairable', async () => {
  const { runner, contexts } = await harness([
    sceneCall('inspect_scene', { output: 'complete-scene' }),
    sceneCall('submit_output', { candidateId: 'missing' }),
    sceneCall('submit_output', { candidateId: 'candidate-1', output: 'ambiguous' }),
    sceneCall('submit_output', { candidateId: 'candidate-1' }),
  ]);
  let validations = 0;
  expect(await runner.run({ ...base, outputMode: 'submit-only', validate: async () => { validations++; }, sceneTools: {
    inspect: async () => inspectionReport,
  } })).toBe('complete-scene');
  expect(validations).toBeGreaterThanOrEqual(2);
  expect(contexts).toHaveLength(4);
  expect(JSON.stringify(contexts.at(-1))).toContain('Unknown candidateId');
  expect(JSON.stringify(contexts.at(-1))).toContain('exactly one');
});

test('bounded recipe tool remains available without web access and reports failed reads for recovery', async () => {
  const { runner, contexts } = await harness([
    sceneCall('read_animlib_reference', { id: '../../private' }),
    sceneCall('read_animlib_reference', { id: 'example', offset: 1000, limit: 1000 }),
    reply('complete'),
  ]);
  const referenceTools = createReferenceTools([{ id: 'example', title: 'Recipe', content: 'a'.repeat(1000) + 'correct page' }]);
  expect(await runner.run({ ...base, referenceTools, allowWeb: false })).toBe('complete');
  const names = contexts[0].messages.flatMap(m => m.role === 'system' ? (m.toolsAdded ?? []).map(t => t.name) : []);
  expect(names).toContain('read_animlib_reference'); expect(names).not.toContain('web_enable');
  expect(JSON.stringify(contexts[2])).toContain('Unknown animlib reference ID');
  const result = contexts[2].messages.find(m => m.role === 'toolResult' && m.toolCallId !== undefined && JSON.stringify(m.content).includes('correct page'));
  expect(result).toBeDefined(); expect(JSON.stringify(result)).toContain('1012');
});

test('catalog search forwards discipline and readiness filters', async () => {
  const query = { query: 'normal modes', domain: 'physics', readiness: 'ready', limit: 2 };
  const { runner } = await harness([sceneCall('search_visualization_catalog', query), reply('complete')]);
  let searched: unknown;
  await runner.run({ ...base, allowWeb: false, catalogTools: {
    async search(input) { searched = input; return { entries: [], total: 0, offset: 0, limit: 2 }; },
    async read() { throw new Error('Not required'); },
  } });
  expect(searched).toEqual(query);
});
const inspectionReport = { viewport: { width: 960, height: 540 }, times: [1], warnings: [], bounds: [], truncated: false, note: 'sampled' };
const previewImage = { type: 'image' as const, mimeType: 'image/png', data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGOQi7rzHwAEQgJUZSSrPwAAAABJRU5ErkJggg==' };
const editableScene = `export default scene({},s=>{s.text('label',{text:'Readable title',position:[5,0]});s.circle('dot',{position:[-1,0],radius:.4});s.wait(4);});`;
const layoutEdits = [{ before: '[5,0]', after: '[0,0]' }];
const editedScene = editableScene.replace('[5,0]', '[0,0]');

test.each(['validated-reference', 'submit-only'] as const)('inspect exact edits validate a new immutable candidate for %s completion', async outputMode => {
  const { runner, contexts } = await harness([
    sceneCall('inspect_scene', { output: editableScene }),
    sceneCall('inspect_scene', { candidateId: 'candidate-1', edits: layoutEdits, times: [1] }),
    sceneCall('inspect_scene', { candidateId: 'candidate-1' }),
    outputMode === 'submit-only' ? sceneCall('submit_output', { candidateId: 'candidate-2' }) : reply('{"candidateId":"candidate-2"}'),
    outputMode === 'submit-only' ? sceneCall('submit_output', { candidateId: 'candidate-1' }) : reply('{"candidateId":"candidate-1"}'),
  ]);
  const checked: string[] = [], inspected: string[] = [];
  expect(await runner.run({ ...base, allowWeb: false, outputMode,
    validate: async source => { checked.push(source); await compileSource(source); },
    sceneTools: { async inspect(source) { inspected.push(source); return inspectionReport; } },
  })).toBe(editedScene);
  expect(checked.slice(0, 2)).toEqual([editableScene, editedScene]);
  expect(checked.at(-1)).toBe(editedScene);
  expect(inspected).toEqual([editableScene, editedScene, editableScene]);
  expect(JSON.stringify(contexts[2])).toContain('candidate-2');
  expect(JSON.stringify(contexts[0])).toContain('edits');
});

test.each([
  ['no match', [{ before: 'absent', after: 'fixed' }], 'exactly once'],
  ['duplicate match', [{ before: 'position', after: 'position2' }], 'exactly once'],
  ['overlap', [{ before: 'position:[5,0]', after: 'position:[1,0]' }, { before: '[5,0]', after: '[0,0]' }], 'overlap'],
  ['excessive change', [{ before: 'Readable title', after: 'a'.repeat(100) }], '25%'],
] as const)('inspect exact edits reject %s without mutating or allocating a candidate', async (_name, edits, diagnostic) => {
  const { runner, contexts } = await harness([
    call('validate_output', editableScene),
    sceneCall('inspect_scene', { candidateId: 'candidate-1', edits: [...edits] }),
    sceneCall('inspect_scene', { candidateId: 'candidate-2' }),
    sceneCall('inspect_scene', { candidateId: 'candidate-1' }),
    reply('{"candidateId":"candidate-1"}'),
  ]);
  const checked: string[] = [], inspected: string[] = [];
  expect(await runner.run({ ...base, allowWeb: false, outputMode: 'validated-reference',
    validate: async source => { checked.push(source); await compileSource(source); },
    sceneTools: { async inspect(source) { inspected.push(source); return inspectionReport; } },
  })).toBe(editableScene);
  expect(inspected).toEqual([editableScene]);
  expect(checked).toEqual([editableScene, editableScene]);
  expect(JSON.stringify(contexts.at(-1))).toContain(diagnostic);
  expect(JSON.stringify(contexts.at(-1))).toContain('Unknown candidateId');
});

test('inspect exact edits validate before assigning an ID and allow a later valid patch from the same base', async () => {
  const { runner, contexts } = await harness([
    call('validate_output', editableScene),
    sceneCall('inspect_scene', { candidateId: 'candidate-1', edits: [{ before: '[5,0]', after: '[' }] }),
    sceneCall('inspect_scene', { candidateId: 'candidate-2' }),
    sceneCall('inspect_scene', { candidateId: 'candidate-1', edits: layoutEdits }),
    reply('{"candidateId":"candidate-2"}'),
    reply('{"candidateId":"candidate-1"}'),
  ]);
  const checked: string[] = [], inspected: string[] = [];
  expect(await runner.run({ ...base, allowWeb: false, outputMode: 'validated-reference',
    validate: async source => { checked.push(source); await compileSource(source); },
    sceneTools: { async inspect(source) { inspected.push(source); return inspectionReport; } },
  })).toBe(editedScene);
  expect(checked).toEqual([editableScene, editableScene.replace('[5,0]', '['), editedScene, editedScene]);
  expect(inspected).toEqual([editedScene]);
  expect(JSON.stringify(contexts[3])).toContain('Unknown candidateId');
});

test('inspect exact edits require a candidate, reject full output, and share the four-call budget', async () => {
  const { runner, contexts } = await harness([
    call('validate_output', editableScene),
    sceneCall('inspect_scene', { edits: layoutEdits }),
    sceneCall('inspect_scene', { output: editableScene, edits: layoutEdits }),
    sceneCall('inspect_scene', { candidateId: 'candidate-1', output: editableScene, edits: layoutEdits }),
    sceneCall('inspect_scene', { candidateId: 'candidate-1', edits: layoutEdits }),
    sceneCall('inspect_scene', { candidateId: 'candidate-2', edits: [{ before: '[0,0]', after: '[2,0]' }] }),
    reply('{"candidateId":"candidate-2"}'),
    reply('{"candidateId":"candidate-1"}'),
  ]);
  const inspected: string[] = [];
  expect(await runner.run({ ...base, allowWeb: false, outputMode: 'validated-reference',
    validate: async source => { await compileSource(source); },
    sceneTools: { async inspect(source) { inspected.push(source); return inspectionReport; } },
  })).toBe(editedScene);
  expect(inspected).toEqual([editedScene]);
  expect(JSON.stringify(contexts.at(-1))).toContain('inspection budget exhausted');
  expect(JSON.stringify(contexts[4])).toContain('edits require candidateId');
});

test.each([
  ['empty list', []], ['too many edits', Array.from({ length: 81 }, () => layoutEdits[0])],
  ['oversized before', [{ before: 'x'.repeat(16001), after: 'x' }]],
  ['oversized after', [{ before: '[5,0]', after: 'x'.repeat(16001) }]],
] as const)('inspect exact edits schema rejects %s before inspection', async (_name, edits) => {
  const { runner, contexts } = await harness([
    call('validate_output', editableScene),
    sceneCall('inspect_scene', { candidateId: 'candidate-1', edits: [...edits] }),
    reply('{"candidateId":"candidate-1"}'),
  ]);
  let inspected = 0;
  expect(await runner.run({ ...base, allowWeb: false, outputMode: 'validated-reference', validate: async () => {},
    sceneTools: { async inspect() { inspected++; return inspectionReport; } },
  })).toBe(editableScene);
  expect(inspected).toBe(0);
  expect(contexts.at(-1)!.messages.filter(message => message.role === 'toolResult')
    .find(message => message.toolName === 'inspect_scene')?.isError).toBe(true);
});

test('inspect exact edits keep the reconstructed source size bound and preserve the full-source route', async () => {
  const largeSource = editableScene + '/*' + 'x'.repeat(255990 - editableScene.length - 4) + '*/';
  const { runner, contexts } = await harness([
    call('validate_output', largeSource),
    sceneCall('inspect_scene', { candidateId: 'candidate-1', edits: [{ before: 'Readable title', after: 'a'.repeat(100) }] }),
    sceneCall('inspect_scene', { output: editedScene }),
    reply('{"candidateId":"candidate-2"}'),
  ]);
  const checked: string[] = [], inspected: string[] = [];
  expect(await runner.run({ ...base, allowWeb: false, outputMode: 'validated-reference',
    validate: async source => { checked.push(source); await compileSource(source); },
    sceneTools: { async inspect(source) { inspected.push(source); return inspectionReport; } },
  })).toBe(editedScene);
  expect(checked).toEqual([largeSource, editedScene, editedScene]);
  expect(inspected).toEqual([editedScene]);
  expect(JSON.stringify(contexts.at(-1))).toContain('source size limit');
});

test('scene tools return candidate references, diagnostics and actual image content without submitting', async () => {
  const { runner, contexts } = await harness([
    sceneCall('inspect_scene', { output: 'draft', times: [1], objectIds: ['label'] }),
    sceneCall('preview_scene', { candidateId: 'candidate-1', times: [1] }),
    sceneCall('inspect_scene', { output: 'repaired', times: [1] }),
    reply('{"candidateId":"candidate-2"}'),
  ]);
  const checked: string[] = [], inspected: string[] = [], previewed: string[] = [];
  const sceneTools: NonNullable<AgentTask['sceneTools']> = {
    async inspect(source, options) { inspected.push(source); expect(options.times).toEqual([1]); return inspectionReport; },
    async preview(source) { previewed.push(source); return [{ time: 1, image: previewImage }]; },
  };
  expect(await runner.run({ ...base, outputMode: 'validated-reference', sceneTools,
    validate: async source => { checked.push(source); } })).toBe('repaired');
  expect(checked).toEqual(['draft', 'repaired', 'repaired']);
  expect(inspected).toEqual(['draft', 'repaired']); expect(previewed).toEqual(['draft']);
  const result = contexts[2].messages.find(m => m.role === 'toolResult' && m.toolName === 'preview_scene');
  expect(result?.content).toContainEqual(previewImage);
  expect(JSON.stringify(result)).toContain('candidate-1');
});

test('preview failures and exhausted budgets remain repairable without accepting an unknown reference', async () => {
  const { runner, contexts } = await harness([
    call('validate_output', 'draft'),
    sceneCall('preview_scene', { candidateId: 'missing' }),
    sceneCall('preview_scene', { candidateId: 'candidate-1' }),
    sceneCall('preview_scene', { candidateId: 'candidate-1' }),
    reply('{"candidateId":"candidate-1"}'),
  ]);
  let previews = 0;
  expect(await runner.run({ ...base, outputMode: 'validated-reference', validate: async () => {}, sceneTools: {
    inspect: async () => inspectionReport, preview: async () => { previews++; throw new Error('Chromium unavailable'); },
  } })).toBe('draft');
  expect(previews).toBe(1);
  const messages = JSON.stringify(contexts.at(-1));
  expect(messages).toContain('Unknown candidateId'); expect(messages).toContain('Chromium unavailable');
  expect(messages).toContain('preview budget exhausted');
});

test('inspection rejects ambiguous sources and enforces four calls across a run', async () => {
  const { runner, contexts } = await harness([
    sceneCall('inspect_scene', { output: 'draft', candidateId: 'candidate-1' }),
    ...Array.from({ length: 4 }, () => sceneCall('inspect_scene', { output: 'draft' })),
    reply('draft'),
  ]);
  let inspected = 0;
  expect(await runner.run({ ...base, validate: async () => {}, sceneTools: {
    inspect: async () => { inspected++; return inspectionReport; },
  } })).toBe('draft');
  expect(inspected).toBe(3);
  expect(JSON.stringify(contexts.at(-1))).toContain('exactly one');
  expect(JSON.stringify(contexts.at(-1))).toContain('inspection budget exhausted');
  const names = contexts[0].messages.flatMap(m => m.role === 'system' ? (m.toolsAdded ?? []).map(t => t.name) : []);
  expect(names).toContain('inspect_scene'); expect(names).not.toContain('preview_scene');
});

test('provider retries do not replenish scene preview budget', async () => {
  const transient = { ...reply('', 'error'), errorMessage: 'OpenAI API error (503): temporary' };
  const { runner, contexts } = await harness([
    sceneCall('preview_scene', { output: 'draft' }), sceneCall('preview_scene', { output: 'draft' }), transient,
    sceneCall('preview_scene', { output: 'draft' }), reply('draft'),
  ], async () => {});
  let previews = 0;
  expect(await runner.run({ ...base, validate: async () => {}, sceneTools: {
    inspect: async () => inspectionReport,
    preview: async () => { previews++; return [{ time: 1, image: previewImage }]; },
  } })).toBe('draft');
  expect(previews).toBe(2);
  expect(JSON.stringify(contexts.at(-1))).toContain('preview budget exhausted');
});

test('validated references preserve the review turn and select the final candidate rather than first valid output', async () => {
  const { runner, contexts } = await harness([call('validate_output', 'first', 'v1'), call('validate_output', 'revised', 'v2'), reply('{"candidateId":"candidate-2"}')]);
  const checked: string[] = [];
  expect(await runner.run({ ...base, outputMode: 'validated-reference', validate: async text => { checked.push(text); } })).toBe('revised');
  expect(checked).toEqual(['first', 'revised', 'revised']);
  expect(contexts).toHaveLength(3);
  expect(JSON.stringify(contexts[1])).toContain('candidate-1');
});

test('an unvalidated reference is repaired rather than accepted', async () => {
  const { runner } = await harness([reply('{"candidateId":"missing"}'), call('validate_output', 'repaired'), reply('{"candidateId":"candidate-1"}')]);
  expect(await runner.run({ ...base, outputMode: 'validated-reference', validate: async () => {} })).toBe('repaired');
});

test('failed validation never creates a reference', async () => {
  const { runner } = await harness([call('validate_output', 'bad'), reply('{"candidateId":"candidate-1"}'), reply('{"candidateId":"candidate-1"}'), reply('{"candidateId":"candidate-1"}')]);
  await expect(runner.run({ ...base, outputMode: 'validated-reference', validate: async () => { throw new Error('Invalid scene'); } })).rejects.toMatchObject({ code: 'VALIDATION' });
});

test('explicit submission returns validated source without a duplicate provider call', async () => {
  const { runner, contexts } = await harness([call('submit_output', 'final-source')]);
  const checked: string[] = [];
  expect(await runner.run({ ...base, outputMode: 'submit', validate: async text => { checked.push(text); } })).toBe('final-source');
  expect(checked).toEqual(['final-source', 'final-source']);
  expect(contexts).toHaveLength(1);
});

test('ordinary validation stays nonterminal in submission mode and invalid submissions can be repaired', async () => {
  const { runner, contexts } = await harness([call('validate_output', 'draft'), call('submit_output', 'bad'), call('submit_output', 'final-source')]);
  expect(await runner.run({ ...base, outputMode: 'submit', validate: async text => { if (text === 'bad') throw new Error('Fix duration'); } })).toBe('final-source');
  expect(contexts).toHaveLength(3);
  expect(JSON.stringify(contexts[2])).toContain('Fix duration');
});

test('a batch with multiple final submissions is rejected and repaired unambiguously', async () => {
  const batch = call('submit_output', 'first', 's1');
  batch.content.push(...call('submit_output', 'second', 's2').content);
  const { runner, contexts } = await harness([batch, call('submit_output', 'chosen', 's3')]);
  expect(await runner.run({ ...base, outputMode: 'submit', validate: async () => {} })).toBe('chosen');
  expect(contexts).toHaveLength(2);
});

for (const outputMode of ['validated-reference', 'submit'] as const) {
  test(`${outputMode} rejects provider errors after a valid draft`, async () => {
    const { runner } = await harness([call('validate_output', 'draft'), reply('secret-partial', 'error')]);
    await expect(runner.run({ ...base, outputMode, validate: async () => {} })).rejects.toMatchObject({ code: 'AUTH' });
  });
  test(`${outputMode} requires host validation`, async () => {
    const { runner, contexts } = await harness([reply('unvalidated')]);
    await expect(runner.run({ ...base, outputMode })).rejects.toMatchObject({ code: 'CONFIG' });
    expect(contexts).toHaveLength(0);
  });
}

test('aborting during submission validation cannot become success', async () => {
  const { runner } = await harness([call('submit_output', 'final-source')]);
  const controller = new AbortController();
  await expect(runner.run({ ...base, outputMode: 'submit', signal: controller.signal,
    validate: async () => { controller.abort(); } })).rejects.toMatchObject({ code: 'ABORTED' });
});

test('metrics report per-call usage and validation without storing source or errors', async () => {
  const { runner } = await harness([call('submit_output', 'private-source')]);
  let metrics: AgentRunMetrics | undefined;
  await runner.run({ ...base, outputMode: 'submit', validate: async () => {}, onMetrics: value => { metrics = value; } });
  expect(metrics!.providerCalls).toBe(1);
  expect(metrics!.turns).toHaveLength(1);
  expect(metrics!.turns[0]).toMatchObject({ inputTokens: 100, outputTokens: 30, reasoningTokens: 10, cacheReadTokens: 40, cacheWriteTokens: 0, textChars: 0 });
  expect(metrics!.turns[0].toolArgumentChars).toBeGreaterThan(0);
  expect(metrics!.turns[0].providerMs).toBeGreaterThanOrEqual(0);
  expect(metrics!.validations.map(item => item.kind)).toEqual(['tool', 'final']);
  expect(metrics!.elapsedMs).toBeGreaterThanOrEqual(0);
  expect(JSON.stringify(metrics)).not.toContain('private-source');
});

test('metrics callback failures cannot change the successful result', async () => {
  const { runner } = await harness([reply('result')]);
  expect(await runner.run({ ...base, onMetrics: () => { throw new Error('broken sink'); } })).toBe('result');
});


for (const completedCalls of [0, 1]) {
  test(`failure before provider stream records zero provider time after ${completedCalls} completed calls`, async () => {
    const { runner, contexts } = await harness([call('validate_output', 'draft')]);
    let metrics: AgentRunMetrics | undefined;
    const prompt = AgentSession.prototype.prompt;
    const intercept = spyOn(AgentSession.prototype, 'prompt').mockImplementation(async function (this: AgentSession, ...args: Parameters<AgentSession['prompt']>) {
      const prepare = this.agent.prepareRequest;
      this.agent.prepareRequest = async (...request) => {
        if (contexts.length === completedCalls) throw new Error('Request preparation failed.');
        return (await prepare?.(...request)) ?? undefined;
      };
      return prompt.apply(this, args);
    });
    try {
      await expect(runner.run({ ...base, validate: async () => {}, onMetrics: value => { metrics = value; } })).rejects.toMatchObject({ code: 'PROVIDER' });
    } finally { intercept.mockRestore(); }
    expect(metrics!.providerCalls).toBe(completedCalls);
    expect(metrics!.turns).toHaveLength(completedCalls + 1);
    expect(metrics!.turns.at(-1)).toMatchObject({ stopReason: 'error', providerMs: 0 });
  });
}

test('submit-only exposes terminal submission and web access and validates again before returning', async () => {
  const { runner, contexts } = await harness([call('submit_output', 'complete-source')]);
  const checked: string[] = [];
  expect(await runner.run({ ...base, outputMode: 'submit-only', validate: async output => { checked.push(output); } })).toBe('complete-source');
  expect(contexts).toHaveLength(1);
  const names = contexts[0].messages.flatMap(message => message.role === 'system' ? (message.toolsAdded ?? []).map(tool => tool.name) : []);
  expect(names).toEqual(['submit_output', 'web_enable']);
  expect(checked).toEqual(['complete-source', 'complete-source']);
});

test('submit-only returns validation errors for repair before accepting a final submission', async () => {
  const { runner, contexts } = await harness([call('submit_output', 'bad-source', 's1'), call('submit_output', 'repaired-source', 's2')]);
  const checked: string[] = [];
  expect(await runner.run({ ...base, outputMode: 'submit-only', validate: async output => {
    checked.push(output);
    if (output === 'bad-source') throw new Error('Scene duration must match the narration.');
  } })).toBe('repaired-source');
  expect(contexts).toHaveLength(2);
  expect(JSON.stringify(contexts[1])).toContain('Scene duration must match the narration.');
  expect(checked).toEqual(['bad-source', 'repaired-source', 'repaired-source']);
});

test('submit-only repairs a failure in the final host validation', async () => {
  const { runner, contexts } = await harness([call('submit_output', 'first-source', 's1'), call('submit_output', 'revised-source', 's2')]);
  let checks = 0;
  expect(await runner.run({ ...base, outputMode: 'submit-only', validate: async () => {
    if (++checks === 2) throw new Error('Final host validation failed.');
  } })).toBe('revised-source');
  expect(checks).toBe(4);
  expect(contexts).toHaveLength(2);
  expect(JSON.stringify(contexts[1])).toContain('Final host validation failed.');
});


test('provider retries discard prior candidates and report aggregate metrics once', async () => {
  const transient = { ...reply('', 'error'), errorMessage: '503 temporarily unavailable' };
  const { runner, contexts } = await harness([
    call('validate_output', 'abandoned'), transient,
    reply('{"candidateId":"candidate-1"}'), call('validate_output', 'recovered'), reply('{"candidateId":"candidate-1"}'),
  ], async () => {});
  const reports: AgentRunMetrics[] = [], checked: string[] = [];
  const output = await runner.run({ ...base, outputMode: 'validated-reference',
    validate: async text => { checked.push(text); }, onMetrics: report => { reports.push(report); } });
  expect(output).toBe('recovered');
  expect(checked).toEqual(['abandoned', 'recovered', 'recovered']);
  expect(contexts).toHaveLength(5);
  expect(JSON.stringify(contexts[2])).not.toContain('abandoned');
  expect(reports).toHaveLength(1);
  expect(reports[0].providerCalls).toBe(5);
  expect(reports[0].turns.map(turn => turn.index)).toEqual([1, 2, 3, 4, 5]);
});

test('exhausted provider retries report every failed call in one metrics result', async () => {
  const failures = Array.from({ length: 3 }, () => ({ ...reply('', 'error'), errorMessage: '503 temporarily unavailable' }));
  const { runner } = await harness(failures, async () => {});
  const reports: AgentRunMetrics[] = [];
  await expect(runner.run({ ...base, outputMode: 'validated-reference', validate: async () => {},
    onMetrics: report => { reports.push(report); } })).rejects.toMatchObject({ code: 'PROVIDER', diagnostics: { retryable: true } });
  expect(reports).toHaveLength(1);
  expect(reports[0].providerCalls).toBe(3);
  expect(reports[0].turns).toHaveLength(3);
});

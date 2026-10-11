import { expect, test } from 'bun:test';
import type { AgentTask } from '../../backend/src/agents/runtime.js';
import { constructionAnchors, constructionContext, SPECIALIST_REFERENCE_RANGES } from './phase-support';

function packet() {
  return { request: { topic: 'Show shape compatibility.', view: '2d' }, timingBasis: 'subtitle-reading',
    audioAssetId: 'clock', endMode: 'hold', videoMode: 'interactive',
    scene: { id: 'scene-2', durationSec: 35, utterances: [{ words: [{ id: 'w1', text: 'contact', startSec: 5, endSec: 6 }] }], pauses: [{ startSec: 8, endSec: 10 }] },
    planning: { lesson: { entities: [{ id: 'body', meaning: 'One connected body.' }], keyInsight: 'A spatial interface matters.' },
      shared: { accuracy: 'schematic' }, current: { id: 'scene-2', visualDescription: 'Visible connected structure.', carry: ['body'],
        interactions: [{ id: 'depth', drives: 'section' }], view: { mode: '3d', rationale: 'Depth is explanatory.' } },
      outline: [{ id: 'scene-1' }, { id: 'scene-2' }], previous: { id: 'scene-1', endsWith: 'body shown' }, next: { id: 'scene-3' },
      stateAuthority: 'Actual previous frame wins.' },
    modelAssets: { asset: { bounds: { min: [-1,-1,-1], max: [1,1,1] } } },
    previousFrame: { camera: { yaw: 0.4 }, views: [{ id: 'model', camera: { pitch: 0.3 } }],
      elements: [{ id: 'body', position: [1,2,3], scale: 1, geometry: { kind: 'mesh', vertices: 'huge geometry '.repeat(100000) } }] },
  };
}
function task(value = packet()): AgentTask {
  return { systemPrompt: 'unchanged full reference', prompt: 'Generate this scene using the authoritative narration packet and lesson plan:\nOptional host timing prelude.\n' + JSON.stringify(value),
    logContext: { videoId: 'video', sceneIndex: 1, stage: 'scene' } };
}

test('preserves approved scene context and timing while summarizing huge evaluated geometry', () => {
  const original = packet(), source = task(original), originalPrompt = source.prompt;
  const result = constructionContext(source), context = JSON.parse(result.prompt);
  expect(result.viewMode).toBe('3d');
  expect(context.request).toEqual(original.request);
  expect(context.planning).toEqual(original.planning);
  expect(context.scene).toEqual(original.scene);
  expect(context.modelAssets).toEqual(original.modelAssets);
  expect(context.audioAssetId).toBe('clock');
  expect(context.previousFrameSummary.geometryOmitted).toBe(true);
  expect(context.previousFrameSummary.elements[0]).toEqual({ id: 'body', type: 'mesh', meaning: 'One connected body.', position: [1,2,3], scale: 1 });
  expect(context.previousFrameSummary.views).toEqual(original.previousFrame.views);
  expect(context.previousFrame).toBeUndefined();
  expect(result.prompt.length).toBeLessThan(40000);
  expect(source.prompt).toBe(originalPrompt);
  expect(source.systemPrompt).toBe('unchanged full reference');
});

test('uses approved per-scene view and fails missing mode or changed prompt boundary', () => {
  const value = packet(); value.planning.current.view.mode = '2d';
  expect(constructionContext(task(value)).viewMode).toBe('2d');
  value.planning.current.view.mode = 'unknown';
  expect(() => constructionContext(task(value))).toThrow('view');
  expect(() => constructionContext({ ...task(), prompt: 'Unrecognized wrapper\n' + JSON.stringify(packet()) })).toThrow('boundary');
});

test('fails excessive semantic context or previous element count instead of truncating', () => {
  const large = packet(); large.planning.current.visualDescription = 'x'.repeat(40001);
  expect(() => constructionContext(task(large))).toThrow('40000');
  const many = packet(); many.previousFrame.elements = Array.from({ length: 129 }, (_, index) =>
    ({ id: `id${index}`, position: [0,0,0], scale: 1, geometry: { kind: 'mesh', vertices: '' } }));
  expect(() => constructionContext(task(many))).toThrow('128');
});

function references() {
  const headings: string[] = [];
  for (const [start,end] of SPECIALIST_REFERENCE_RANGES) { if (!headings.includes(start)) headings.push(start); if (end && !headings.includes(end)) headings.push(end); }
  return '# animlib scene-authoring reference\n\n' + headings.map(heading => `${heading}\n\nLiteral API for ${heading}.\n\n`).join('');
}
const checklist = 'For a complex spatial mechanism, make two construction checks before coding.\r\nExact existing checklist.\r\n\r\n';
const craft = 'Before.\r\n' + checklist + 'Implement the planned dimensional choice through its named visible evidence.\r\nAfter.';

test('extracts an exact checklist with line endings and fixed literal API ranges', () => {
  const reference = references(), anchors = constructionAnchors(craft, reference);
  expect(anchors.checklist).toBe(checklist);
  expect(anchors.apiReference).toBe(reference);
  expect(anchors.referenceExcerpts.length).toBeGreaterThan(3);
  for (const excerpt of anchors.referenceExcerpts) expect(reference).toContain(excerpt);
  expect(anchors.referenceExcerpts.join('').length).toBeLessThanOrEqual(32000);
});

test('fails missing/ambiguous anchors, missing API sections and excessive reference content', () => {
  expect(() => constructionAnchors(craft + '\r\n' + checklist, references())).toThrow();
  expect(() => constructionAnchors('No checklist', references())).toThrow();
  expect(() => constructionAnchors(craft, '# unrelated API')).toThrow();
  const large = references().replace('### Shaded meshes\n', '### Shaded meshes\n' + 'x'.repeat(32001) + '\n');
  expect(() => constructionAnchors(craft, large)).toThrow('32000');
});
